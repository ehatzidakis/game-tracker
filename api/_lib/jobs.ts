// The scheduled work: refreshing release dates from IGDB and sending release alerts.
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { sendNotification, setVapidDetails } from 'web-push';
import { igdbQuery } from './igdb-client.js';
import { EVENT_FIELDS, igdbEventChanged, igdbEventFields, type IgdbEvent } from './igdb-events.js';
import {
  releaseMoved,
  SYNC_FIELDS,
  syncedFields,
  syncUpdate,
  type IgdbSyncGame,
} from './igdb-sync.js';
import {
  DEFAULT_SETTINGS,
  eventEnd,
  preorderArrived,
  type GamingEvent,
  type TrackedGame,
  type UserSettings,
} from './models.js';
import { platformLabel } from './platforms.js';
import { addDays, alertDueAt, daysBetween, todayIn } from './release.js';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  icon?: string;
}

let vapidReady = false;
function setUpVapid(): void {
  if (vapidReady) return;
  setVapidDetails(
    'https://game-tracker-teal-sigma.vercel.app',
    process.env.VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY ?? '',
  );
  vapidReady = true;
}

/** Sends to every device the user turned alerts on for. Drops devices that unsubscribed. */
export async function sendToUser(
  userRef: DocumentReference,
  payload: PushPayload,
): Promise<number> {
  setUpVapid();
  const subs = await userRef.collection('pushSubscriptions').get();
  let sent = 0;
  await Promise.all(
    subs.docs.map(async (doc) => {
      const { endpoint, keys } = doc.data() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      try {
        await sendNotification({ endpoint, keys }, JSON.stringify(payload), {
          TTL: 12 * 3600,
          urgency: 'normal',
        });
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await doc.ref.delete();
        else console.error(`Push to ${doc.id} failed`, error);
      }
    }),
  );
  return sent;
}

// users/{uid} documents can be "missing" (only subcollections, no settings saved yet),
// so list them rather than query them.
async function userRefs(db: Firestore): Promise<DocumentReference[]> {
  return db.collection('users').listDocuments();
}

async function settingsOf(ref: DocumentReference): Promise<UserSettings> {
  const snap = await ref.get();
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<UserSettings> | undefined) };
}

function alertTitle(game: TrackedGame, today: string): string {
  const days = daysBetween(today, game.releaseDate!);
  if (days <= 0) return `${game.name} is out today`;
  if (days === 1) return `${game.name} is out tomorrow`;
  return `${game.name} is out in ${days} days`;
}

/**
 * Moves pre-ordered games from the Wishlist to the Backlog once their release day starts in the
 * user's time zone. Runs hourly; the app also does it when opened.
 */
export async function runPreorderArrivals(db: Firestore, now = Date.now()) {
  const moved: string[] = [];
  for (const userRef of await userRefs(db)) {
    const settings = await settingsOf(userRef);
    const today = todayIn(settings.timezone, new Date(now));
    const preorders = await userRef.collection('games').where('preordered', '==', true).get();
    const batch = db.batch();
    let writes = 0;
    for (const doc of preorders.docs) {
      const game = doc.data() as TrackedGame;
      if (!preorderArrived(game, today)) continue;
      batch.update(doc.ref, {
        status: 'backlog',
        purchasedAt: game.purchasedAt ?? now,
        updatedAt: now,
      });
      moved.push(game.name);
      writes++;
    }
    if (writes) await batch.commit();
  }
  return { moved };
}

/**
 * Sends release alerts that are due: games with the bell on and an exact release day, once the
 * chosen time (e.g. 1 day before at 13:00) has passed. Each alert is sent once per release date.
 */
export async function runNotify(db: Firestore, now = Date.now()) {
  let sent = 0;
  for (const userRef of await userRefs(db)) {
    const settings = await settingsOf(userRef);
    const today = todayIn(settings.timezone, new Date(now));
    const games = await userRef.collection('games').where('notify', '==', true).get();

    for (const doc of games.docs) {
      const game = doc.data() as TrackedGame;
      if (game.releasePrecision !== 'day' || !game.releaseDate || game.releaseDate < today)
        continue;
      if (game.notifiedFor === game.releaseDate) continue;
      const due = alertDueAt(
        { date: game.releaseDate, precision: game.releasePrecision },
        settings,
      );
      if (due === null || now < due) continue;

      const delivered = await sendToUser(userRef, {
        title: alertTitle(game, today),
        body: `${game.releaseLabel} · ${platformLabel(game.myPlatform)}`,
        url: `/game/${game.igdbId}`,
        tag: `release-${game.igdbId}`,
        icon: game.coverId
          ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${game.coverId}.jpg`
          : undefined,
      });
      // Only marked as sent if a device got it, so turning alerts on later still delivers it.
      if (delivered) {
        await doc.ref.update({ notifiedFor: game.releaseDate });
        sent += delivered;
      }
    }
  }
  return { sent };
}

function needsRefresh(game: TrackedGame, today: string): boolean {
  if (game.status === 'completed') return false;
  if (game.releasePrecision !== 'day' || !game.releaseDate) return true;
  // Dates can still move shortly before and after release.
  return game.releaseDate >= addDays(today, -30);
}

/**
 * Re-reads release dates (and name/cover) from IGDB for upcoming games. When a date moves, sends
 * a "new date" alert, whether or not the game has the release-alert bell on.
 */
export async function runDailyRefresh(db: Firestore, now = Date.now()) {
  let checked = 0;
  const changes: string[] = [];

  for (const userRef of await userRefs(db)) {
    const settings = await settingsOf(userRef);
    const today = todayIn(settings.timezone, new Date(now));
    const snap = await userRef.collection('games').get();
    const tracked = new Map(
      snap.docs
        .map((d) => d.data() as TrackedGame)
        .filter((g) => needsRefresh(g, today))
        .map((g) => [g.igdbId, g]),
    );

    const ids = [...tracked.keys()];
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const fresh = await igdbQuery<IgdbSyncGame[]>(
        'games',
        `fields ${SYNC_FIELDS}; where id = (${chunk.join(',')}); limit 500;`,
      );
      checked += fresh.length;

      const batch = db.batch();
      let writes = 0;
      for (const igdbGame of fresh) {
        const game = tracked.get(igdbGame.id);
        if (!game) continue;
        const synced = syncedFields(igdbGame, game.myPlatform, now);
        const dateMoved = releaseMoved(game, synced);
        const otherChange = synced.name !== game.name || synced.coverId !== game.coverId;
        if (!dateMoved && !otherChange) continue;

        // A date that moved also saves the old one in the game's history.
        batch.update(userRef.collection('games').doc(String(game.igdbId)), {
          ...syncUpdate(game, synced, now),
        });
        writes++;
        if (dateMoved) {
          changes.push(`${game.name}: ${game.releaseLabel} → ${synced.releaseLabel}`);
          // Every game, not only those with the release-alert bell on.
          await sendToUser(userRef, {
            title: `New date for ${synced.name}`,
            body: `${game.releaseLabel} → ${synced.releaseLabel}`,
            url: `/game/${game.igdbId}`,
            tag: `date-${game.igdbId}`,
          });
        }
      }
      if (writes) await batch.commit();
    }
  }
  return { checked, changes };
}

/**
 * Re-reads the IGDB events in everyone's calendar that aren't over yet (IGDB often lists an event
 * before its time is final), so the Calendar and the iPhone feed follow a time that moved.
 */
export async function runEventRefresh(db: Firestore, now = Date.now()) {
  let checked = 0;
  const changes: string[] = [];
  for (const userRef of await userRefs(db)) {
    const snap = await userRef.collection('events').where('igdbId', '>', 0).get();
    const current = new Map(
      snap.docs
        .map((d) => d.data() as GamingEvent)
        .filter((e) => eventEnd(e) > now)
        .map((e) => [e.igdbId!, e]),
    );
    if (!current.size) continue;
    const fresh = await igdbQuery<IgdbEvent[]>(
      'events',
      `fields ${EVENT_FIELDS}; where id = (${[...current.keys()].join(',')}); limit 500;`,
    );
    checked += fresh.length;
    const batch = db.batch();
    let writes = 0;
    for (const igdbEvent of fresh) {
      const stored = current.get(igdbEvent.id);
      const fields = igdbEventFields(igdbEvent);
      if (!stored || !fields || !igdbEventChanged(stored, fields)) continue;
      batch.update(userRef.collection('events').doc(stored.id), { ...fields, updatedAt: now });
      changes.push(fields.title);
      writes++;
    }
    if (writes) await batch.commit();
  }
  return { checked, changes };
}
