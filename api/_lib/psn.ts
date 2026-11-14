// PlayStation Network, through psn-api (unofficial: it uses PlayStation's own website calls).
// A spare PlayStation account signs in for the app with its NPSSO token (PSN_NPSSO); it then reads
// the profiles of the users who entered their Online ID, as far as their privacy lets it.
// The NPSSO gives an access token (about an hour) and a refresh token (about 2 months). Both are
// kept in meta/psnAuth (server only) and renewed as they go; the NPSSO itself is never stored,
// only a fingerprint of it, so a new one in PSN_NPSSO is noticed and used.
import { createHash } from 'node:crypto';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getUserPlayedGames,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  getUserTrophiesForSpecificTitle,
  type AuthTokensResponse,
} from 'psn-api';
import { igdbQuery } from './igdb-client.js';
import {
  PSN_SYNC_EVERY_MS,
  type PsnGameRecord,
  type PsnLink,
  type PsnSyncState,
  type TrackedGame,
  type TrophyCounts,
} from './models.js';
import { sendToUser } from './jobs.js';
import { platinumMoves, platinumUpdate, psnUpdates } from './psn-sync.js';
import {
  gamesWithoutLists,
  groupPlayed,
  linkTrophyLists,
  matchProfile,
  type PsnGame,
  type PsnPlayedTitle,
  type PsnTrophyTitle,
} from './psn-match.js';

/** The spare account can't sign in: no token, or it no longer works. Needs a new PSN_NPSSO. */
export class PsnAuthError extends Error {}

/** What's kept in meta/psnAuth. */
interface StoredAuth {
  accessToken: string;
  /** ms */
  accessExpiresAt: number;
  refreshToken: string;
  /** ms */
  refreshExpiresAt: number;
  /** sha256 of the NPSSO the tokens came from. */
  npssoFingerprint: string;
  updatedAt: number;
}

const authRef = (db: Firestore) => db.collection('meta').doc('psnAuth');
const fingerprint = (npsso: string) => createHash('sha256').update(npsso).digest('hex');
/** Renew a little before PlayStation says a token runs out. */
const MARGIN = 5 * 60_000;

function stored(tokens: AuthTokensResponse, npsso: string, now: number): StoredAuth {
  return {
    accessToken: tokens.accessToken,
    accessExpiresAt: now + tokens.expiresIn * 1000,
    refreshToken: tokens.refreshToken,
    refreshExpiresAt: now + tokens.refreshTokenExpiresIn * 1000,
    npssoFingerprint: fingerprint(npsso),
    updatedAt: now,
  };
}

let cached: StoredAuth | null = null;

/**
 * An access token for the spare account: the cached one while it's good, else renewed with the
 * refresh token, else a fresh sign-in with PSN_NPSSO. Throws PsnAuthError when none of that works.
 */
export async function psnAccessToken(
  db: Firestore,
  now = Date.now(),
): Promise<{ accessToken: string; refreshExpiresAt: number }> {
  const npsso = process.env.PSN_NPSSO?.trim();
  if (!npsso) throw new PsnAuthError('PSN_NPSSO is not set');
  const print = fingerprint(npsso);

  if (!cached || cached.npssoFingerprint !== print) {
    const snap = await authRef(db).get();
    const saved = snap.exists ? (snap.data() as StoredAuth) : null;
    cached = saved?.npssoFingerprint === print ? saved : null;
  }
  if (cached && cached.accessExpiresAt - MARGIN > now) return cached;

  let auth: StoredAuth | null = null;
  if (cached && cached.refreshExpiresAt - MARGIN > now) {
    try {
      auth = stored(await exchangeRefreshTokenForAuthTokens(cached.refreshToken), npsso, now);
    } catch (error) {
      console.error('PSN refresh failed, signing in again', error);
    }
  }
  if (!auth) {
    try {
      const code = await exchangeNpssoForAccessCode(npsso);
      auth = stored(await exchangeAccessCodeForAuthTokens(code), npsso, now);
    } catch (error) {
      throw new PsnAuthError(`PlayStation sign-in failed: ${(error as Error).message}`);
    }
  }
  cached = auth;
  await authRef(db).set(auth);
  return auth;
}

/** Everything read from one PlayStation profile, ready to match to a library. */
export interface PsnSnapshot {
  games: PsnGame[];
  lists: PsnTrophyList[];
  /** Trophy list id → the PlayStation game (concept) it belongs to. */
  links: Map<string, number>;
  /** PlayStation Store concept id → IGDB game ids, from IGDB. */
  storeIds: Map<number, number[]>;
}

/** psn-api's trophy list, with the counts the sync uses. */
export type PsnTrophyList = PsnTrophyTitle & {
  progress: number;
  definedTrophies: TrophyCounts;
  earnedTrophies: TrophyCounts;
  lastUpdatedDateTime: string;
};

/**
 * Reads a profile's played games and trophy lists (a few requests), links the lists to the games
 * (by name, then by asking PlayStation about the games left over), and looks up IGDB's store ids.
 */
export async function readPsnProfile(db: Firestore, accountId: string): Promise<PsnSnapshot> {
  const auth = { accessToken: (await psnAccessToken(db)).accessToken };

  const played: PsnPlayedTitle[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await getUserPlayedGames(auth, accountId, { limit: 200, offset });
    played.push(...(page.titles as PsnPlayedTitle[]));
    if (!page.titles.length || played.length >= page.totalItemCount) break;
  }
  const lists: PsnTrophyList[] = [];
  for (let offset = 0; ; offset += 800) {
    const page = await getUserTitles(auth, accountId, { limit: 800, offset });
    lists.push(...(page.trophyTitles as PsnTrophyList[]));
    if (!page.trophyTitles.length || lists.length >= page.totalItemCount) break;
  }
  const games = groupPlayed(played);

  // Games no list matched by name: ask PlayStation which lists their title ids have (5 at a time).
  const byName = linkTrophyLists(games, lists);
  const titleIds = gamesWithoutLists(games, byName).flatMap((g) => g.titleIds);
  const byTitleId = new Map<string, string[]>();
  for (let i = 0; i < titleIds.length; i += 5) {
    try {
      const { titles } = await getUserTrophiesForSpecificTitle(auth, accountId, {
        npTitleIds: titleIds.slice(i, i + 5).join(','),
      });
      for (const t of titles) {
        byTitleId.set(
          t.npTitleId,
          t.trophyTitles.map((l) => l.npCommunicationId),
        );
      }
    } catch (error) {
      // Some games have no trophies at all: not worth failing over.
      console.error('PSN trophy lookup by title id failed', error);
    }
  }

  // IGDB: which of its games each PlayStation Store concept is.
  const storeIds = new Map<number, number[]>();
  const concepts = games.map((g) => g.conceptId).filter((id) => id > 0);
  for (let i = 0; i < concepts.length; i += 400) {
    const ids = concepts
      .slice(i, i + 400)
      .map((c) => `"${c}"`)
      .join(',');
    const rows = await igdbQuery<{ uid: string; game: number }[]>(
      'external_games',
      `fields uid, game; where external_game_source = ${PLAYSTATION_STORE} & uid = (${ids}); limit 500;`,
    );
    for (const r of rows) {
      const id = Number(r.uid);
      storeIds.set(id, [...(storeIds.get(id) ?? []), r.game]);
    }
  }

  return { games, lists, links: linkTrophyLists(games, lists, byTitleId), storeIds };
}

/**
 * Reads a user's PlayStation profile and saves which library game each PlayStation game is
 * (users/{uid}/psnGames), keeping matches set by hand. Writes nothing to the library games
 * themselves. Null when the user hasn't linked PlayStation. Throws, writing nothing, when
 * PlayStation can't be read or answers with nothing at all.
 */
export async function refreshPsnGames(db: Firestore, uid: string, now = Date.now()) {
  const userRef = db.collection('users').doc(uid);
  const link = (await userRef.get()).data()?.['psn'] as PsnLink | undefined;
  if (!link) return null;

  const snapshot = await readPsnProfile(db, link.accountId);
  if (!snapshot.games.length && !snapshot.lists.length) {
    throw new Error(`PlayStation returned no games or trophies for ${link.onlineId}`);
  }
  const library = (await userRef.collection('games').get()).docs.map(
    (d) => d.data() as TrackedGame,
  );
  const records = userRef.collection('psnGames');
  const manual = new Map(
    (await records.get()).docs
      .map((d) => d.data() as PsnGameRecord)
      .filter((r) => r.matchedBy === 'manual')
      .map((r) => [r.conceptId, r.igdbId]),
  );
  const { matches, listsByGame } = matchProfile(snapshot, library, manual);

  const matchOf = new Map(matches.map((m) => [m.conceptId, m]));
  for (let i = 0; i < snapshot.games.length; i += 400) {
    const batch = db.batch();
    for (const game of snapshot.games.slice(i, i + 400)) {
      const match = matchOf.get(game.conceptId);
      const record: PsnGameRecord = {
        ...game,
        igdbId: match?.igdbId ?? null,
        matchedBy: match?.by ?? null,
        seenAt: now,
      };
      batch.set(records.doc(String(game.conceptId)), record);
    }
    await batch.commit();
  }
  return { link, snapshot, matches, listsByGame, library };
}

/**
 * The sync for one user: reads PlayStation, saves the matches, then writes playtime, first and
 * last played and trophies onto the matched library games (see psn-sync.ts for the rules).
 * Records how it went on users/{uid}.psnSync. When PlayStation can't be read, nothing is written
 * to any game: only the failure is recorded.
 */
export async function syncPsnUser(
  db: Firestore,
  uid: string,
  now = Date.now(),
): Promise<PsnSyncState | null> {
  const userRef = db.collection('users').doc(uid);
  const before = (await userRef.get()).data()?.['psnSync'] as PsnSyncState | undefined;
  let state: PsnSyncState;
  try {
    const read = await refreshPsnGames(db, uid, now);
    if (!read) return null;
    const updates = psnUpdates(
      read.library,
      read.snapshot.games,
      read.matches,
      read.snapshot.lists,
      read.listsByGame,
      now,
    );
    // A new Platinum completes its game, dated the day it was earned.
    const moves = platinumMoves(read.library, read.snapshot.lists, read.listsByGame);
    const byId = new Map(read.library.map((g) => [g.igdbId, g]));
    const completed: string[] = [];
    for (const move of moves) {
      const game = byId.get(move.igdbId)!;
      const at = move.completes
        ? await platinumEarnedAt(db, read.link.accountId, move, read.snapshot.lists, now)
        : now;
      updates.set(move.igdbId, {
        ...(updates.get(move.igdbId) ?? {}),
        ...platinumUpdate(game, at, now),
      });
      if (move.completes) completed.push(game.name);
    }

    const entries = [...updates];
    for (let i = 0; i < entries.length; i += 400) {
      const batch = db.batch();
      for (const [igdbId, update] of entries.slice(i, i + 400)) {
        batch.update(userRef.collection('games').doc(String(igdbId)), { ...update });
      }
      await batch.commit();
    }
    await announcePlatinums(userRef, moves, completed, byId);
    state = {
      at: now,
      ok: true,
      error: null,
      lastOkAt: now,
      changed: updates.size,
      platinums: completed.length,
    };
  } catch (error) {
    console.error(`PlayStation sync for ${uid} failed`, error);
    state = {
      at: now,
      ok: false,
      error:
        error instanceof PsnAuthError
          ? 'The app couldn’t sign in to PlayStation.'
          : 'PlayStation didn’t answer.',
      lastOkAt: before?.lastOkAt ?? null,
      changed: before?.changed ?? 0,
    };
  }
  await userRef.set({ psnSync: state }, { merge: true });
  return state;
}

/**
 * When the Platinum of a game was earned (ms): asks PlayStation for its trophy list. Falls back
 * to when the list last changed, then to now, if PlayStation won't say.
 */
async function platinumEarnedAt(
  db: Firestore,
  accountId: string,
  move: { listId: string; serviceName: 'trophy' | 'trophy2' },
  lists: readonly PsnTrophyList[],
  now: number,
): Promise<number> {
  try {
    const auth = { accessToken: (await psnAccessToken(db, now)).accessToken };
    const { trophies } = await getUserTrophiesEarnedForTitle(auth, accountId, move.listId, 'all', {
      npServiceName: move.serviceName,
    });
    const earned = trophies.find((t) => t.trophyType === 'platinum' && t.earned)?.earnedDateTime;
    const at = earned ? Date.parse(earned) : NaN;
    if (!Number.isNaN(at)) return at;
  } catch (error) {
    console.error('PSN Platinum date lookup failed', error);
  }
  const updated = lists.find((l) => l.npCommunicationId === move.listId)?.lastUpdatedDateTime;
  const at = updated ? Date.parse(updated) : NaN;
  return Number.isNaN(at) ? now : at;
}

/** "Platinum! Elden Ring moved to Completed", one each, or one for several at once. */
async function announcePlatinums(
  userRef: DocumentReference,
  moves: readonly { igdbId: number; completes: boolean }[],
  completed: readonly string[],
  byId: ReadonlyMap<number, TrackedGame>,
): Promise<void> {
  const moved = moves.filter((m) => m.completes);
  try {
    if (moved.length > 3) {
      await sendToUser(userRef, {
        title: `${moved.length} Platinums!`,
        body: `${completed.join(', ')} moved to Completed`,
        url: '/library',
        tag: 'platinums',
      });
      return;
    }
    for (const move of moved) {
      const game = byId.get(move.igdbId)!;
      await sendToUser(userRef, {
        title: `Platinum! ${game.name}`,
        body: 'Moved to Completed',
        url: `/game/${game.igdbId}`,
        tag: `platinum-${game.igdbId}`,
        icon: game.coverId
          ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${game.coverId}.jpg`
          : undefined,
      });
    }
  } catch (error) {
    // The games are completed either way; a notification that didn't go out isn't worth failing.
    console.error('Platinum notification failed', error);
  }
}

/**
 * The scheduled sync, from the hourly job: every user with PlayStation linked whose last sync is
 * PSN_SYNC_EVERY_MS old (8 hours), or who has never synced. One user failing doesn't stop the rest.
 */
export async function runPsnSync(db: Firestore, now = Date.now()) {
  const synced: string[] = [];
  const failed: string[] = [];
  const users = await db.collection('users').where('psn.accountId', '>', '').get();
  for (const user of users.docs) {
    const last = user.data()['psnSync'] as PsnSyncState | undefined;
    // A little early is fine: the hourly job may run a few minutes off.
    if (last && now - last.at < PSN_SYNC_EVERY_MS - 10 * 60_000) continue;
    const state = await syncPsnUser(db, user.id, now);
    if (state?.ok) synced.push(user.id);
    else if (state) failed.push(user.id);
  }
  return { synced: synced.length, failed: failed.length };
}

/** IGDB's external game source for the PlayStation Store (its ids are the store's concept ids). */
const PLAYSTATION_STORE = 36;

/** No PlayStation account has that Online ID. */
export class PsnNotFound extends Error {}

/**
 * Finds a PlayStation account by its Online ID and checks what the spare account can read: the
 * played games (with playtime) and the trophies. Each check is one small request.
 */
export async function checkPsnAccount(
  db: Firestore,
  onlineId: string,
  now = Date.now(),
): Promise<PsnLink> {
  const auth = { accessToken: (await psnAccessToken(db, now)).accessToken };
  let profile;
  try {
    ({ profile } = await getProfileFromUserName(auth, onlineId));
  } catch (error) {
    throw new PsnNotFound(`No PlayStation account "${onlineId}": ${(error as Error).message}`);
  }
  const readable = (read: Promise<unknown>) => read.then(() => true).catch(() => false);
  const [games, trophies] = await Promise.all([
    readable(getUserPlayedGames(auth, profile.accountId, { limit: 1, offset: 0 })),
    readable(getUserTitles(auth, profile.accountId, { limit: 1 })),
  ]);
  return {
    onlineId: profile.onlineId,
    accountId: profile.accountId,
    games,
    trophies,
    linkedAt: now,
  };
}
