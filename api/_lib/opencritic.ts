// OpenCritic scores, through RapidAPI (free Basic plan: 200 requests and 25 searches a day, at
// most 4 a second; past the limit calls fail, nothing is charged). The key is RAPIDAPI_KEY.
// A game is matched once by name (a search), then refreshed by its OpenCritic id (a request).
// Results are shared by all users in opencritic/{igdbId}; the app can't read that collection.
// The allowance doesn't reset at midnight: it's a 24-hour window (it reset at 18:57 UTC in
// November 2026). So the backfill runs every hour, using what's left whenever it is, and what's
// left is kept in meta/opencriticQuota so a fresh function knows without spending a call.
import type { Firestore } from 'firebase-admin/firestore';
import { igdbQuery } from './igdb-client.js';
import {
  entryFrom,
  isStale,
  lookupRank,
  matchCandidates,
  maxAgeDays,
  sameYear,
  type OcGame,
  type OcSearchResult,
  type OpenCriticEntry,
} from './opencritic-match.js';

const HOST = 'opencritic-api.p.rapidapi.com';

/** What's left in the current window, from the last reply's headers (null until known). */
export const remaining: {
  requests: number | null;
  searches: number | null;
  /** When the window ends and the allowance is full again (ms). */
  resetAt: number | null;
} = {
  requests: null,
  searches: null,
  resetAt: null,
};

/** True when at most `keep` of that allowance is left and it hasn't reset since. */
function lowOn(kind: 'requests' | 'searches', keep: number, now = Date.now()): boolean {
  const left = remaining[kind];
  if (left === null) return false;
  if (remaining.resetAt !== null && now >= remaining.resetAt) return false;
  return left <= keep;
}

const quotaRef = (db: Firestore) => db.collection('meta').doc('opencriticQuota');

/** Reads what's left from the last function that asked, unless this one already knows. */
async function loadQuota(db: Firestore, now: number): Promise<void> {
  if (remaining.resetAt !== null && now < remaining.resetAt) return;
  const saved = (await quotaRef(db).get()).data() as typeof remaining | undefined;
  if (saved?.resetAt && now < saved.resetAt) Object.assign(remaining, saved);
}

async function saveQuota(db: Firestore): Promise<void> {
  if (remaining.resetAt !== null) await quotaRef(db).set({ ...remaining });
}

/** Out of today's requests or searches (or no key): try again tomorrow. */
export class OutOfQuota extends Error {}

let lastCall = 0;

async function call<T>(path: string): Promise<T> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new OutOfQuota('RAPIDAPI_KEY is not set');
  // At most 4 calls a second.
  const wait = lastCall + 260 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();

  const res = await fetch(`https://${HOST}${path}`, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST },
  });
  const header = (name: string) => {
    const value = res.headers.get(name);
    return value === null || value === '' ? null : Number(value);
  };
  remaining.requests = header('x-ratelimit-requests-remaining') ?? remaining.requests;
  remaining.searches = header('x-ratelimit-searches-remaining') ?? remaining.searches;
  const resetIn = header('x-ratelimit-searches-reset') ?? header('x-ratelimit-requests-reset');
  if (resetIn !== null) remaining.resetAt = Date.now() + resetIn * 1000;
  if (res.status === 429) throw new OutOfQuota(`OpenCritic limit reached (${path})`);
  if (!res.ok) throw new Error(`OpenCritic ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}

interface IgdbNames {
  id: number;
  name: string;
  first_release_date?: number;
  alternative_names?: { name: string }[];
}

const isoDate = (seconds: number | undefined) =>
  seconds ? new Date(seconds * 1000).toISOString().slice(0, 10) : null;

/** Finds the game on OpenCritic by name, checking the year. Null if it isn't there. */
async function match(igdbId: number): Promise<{ game: OcGame | null; releaseDate: string | null }> {
  const [igdb] = await igdbQuery<IgdbNames[]>(
    'games',
    `fields name, first_release_date, alternative_names.name; where id = ${igdbId}; limit 1;`,
  );
  if (!igdb) return { game: null, releaseDate: null };
  const releaseDate = isoDate(igdb.first_release_date);
  const results = await call<OcSearchResult[]>(
    `/game/search?criteria=${encodeURIComponent(igdb.name)}`,
  );
  const names = [igdb.name, ...(igdb.alternative_names ?? []).map((a) => a.name)];
  for (const candidate of matchCandidates(results, names)) {
    const game = await call<OcGame>(`/game/${candidate.id}`);
    if (sameYear(releaseDate, game.firstReleaseDate)) return { game, releaseDate };
  }
  return { game: null, releaseDate };
}

/** Asks OpenCritic for the latest: by id when matched before, otherwise by name. */
async function lookUp(
  igdbId: number,
  stored: OpenCriticEntry | null,
  now: number,
): Promise<OpenCriticEntry> {
  if (stored?.ocId) {
    const game = await call<OcGame>(`/game/${stored.ocId}`);
    return entryFrom(igdbId, game, stored.releaseDate, now);
  }
  const { game, releaseDate } = await match(igdbId);
  return entryFrom(igdbId, game, releaseDate, now);
}

const entryRef = (db: Firestore, igdbId: number) => db.collection('opencritic').doc(String(igdbId));

/**
 * The stored score for a game, refreshed first when it's due. Falls back to the stored one (or
 * null, if there's none) when OpenCritic can't be asked right now; `limit` says that's because
 * the allowance is used up, and `retryAt` when it comes back.
 */
export async function openCriticFor(
  db: Firestore,
  igdbId: number,
  now = Date.now(),
): Promise<{ entry: OpenCriticEntry | null; limit: boolean; retryAt: number | null }> {
  const snap = await entryRef(db, igdbId).get();
  const stored = snap.exists ? (snap.data() as OpenCriticEntry) : null;
  if (stored && !isStale(stored, now)) return { entry: stored, limit: false, retryAt: null };
  await loadQuota(db, now);
  // A game matched before needs a request; a new one a search.
  const limited = () => ({ entry: stored, limit: true, retryAt: remaining.resetAt });
  if (lowOn(stored?.ocId ? 'requests' : 'searches', 0, now)) return limited();
  try {
    const entry = await lookUp(igdbId, stored, now);
    await entryRef(db, igdbId).set(entry);
    return { entry, limit: false, retryAt: null };
  } catch (error) {
    if (error instanceof OutOfQuota) return limited();
    console.error(error);
    return { entry: stored, limit: false, retryAt: null };
  } finally {
    await saveQuota(db).catch((error: unknown) => console.error(error));
  }
}

/**
 * The stored Top Critic Average of each game that has one, by IGDB id. Only reads what's stored
 * (no OpenCritic calls), so the Library can show scores on every cover.
 */
export async function storedScores(
  db: Firestore,
  igdbIds: readonly number[],
): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};
  const refs = igdbIds.map((id) => entryRef(db, id));
  for (let i = 0; i < refs.length; i += 300) {
    for (const snap of await db.getAll(...refs.slice(i, i + 300))) {
      const score = snap.exists ? (snap.data() as OpenCriticEntry).topCriticScore : null;
      if (score != null) scores[snap.id] = score;
    }
  }
  return scores;
}

/** Searches and requests kept back for opening game pages during the day. */
const KEEP_SEARCHES = 5;
const KEEP_REQUESTS = 30;
/** Stays well inside the function's time limit. */
const MAX_CALLS = 100;

/**
 * Refreshes due scores for every game in anyone's library (games around release first), then
 * looks up games not looked up yet (Completed, then Backlog, Shelved, Wishlist, owned DLC last),
 * as far as the allowance goes. Runs every hour, so a big library fills in as soon as the
 * allowance comes back. Keeps a few searches and requests for opening game pages.
 */
export async function runOpenCriticRefresh(db: Firestore, now = Date.now(), maxCalls = MAX_CALLS) {
  // Each game's most important status across everyone who has it.
  const rank = new Map<number, number>();
  for (const user of await db.collection('users').listDocuments()) {
    for (const doc of (await user.collection('games').get()).docs) {
      const id = Number(doc.id);
      const r = lookupRank(doc.data() as { status: string; parentId?: number | null });
      rank.set(id, Math.min(rank.get(id) ?? r, r));
    }
  }
  const ids = new Set(rank.keys());
  await loadQuota(db, now);

  const refs = [...ids].map((id) => entryRef(db, id));
  const stored = new Map<number, OpenCriticEntry>();
  for (let i = 0; i < refs.length; i += 300) {
    for (const snap of await db.getAll(...refs.slice(i, i + 300))) {
      if (snap.exists) stored.set(Number(snap.id), snap.data() as OpenCriticEntry);
    }
  }

  // Matched games that are due, those around release first, then games not matched yet.
  const due = [...ids].filter((id) => {
    const entry = stored.get(id);
    return !entry || isStale(entry, now);
  });
  const refreshes = due
    .filter((id) => stored.get(id)?.ocId)
    .sort((a, b) => maxAgeDays(stored.get(a)!, now) - maxAgeDays(stored.get(b)!, now));
  const searches = due
    .filter((id) => !stored.get(id)?.ocId)
    .sort((a, b) => rank.get(a)! - rank.get(b)!);

  let refreshed = 0;
  let matched = 0;
  let notFound = 0;
  let calls = 0;

  let failed = 0;
  // One game failing (a bad reply) doesn't stop the rest; running out of quota does.
  const update = async (id: number) => {
    try {
      const entry = await lookUp(id, stored.get(id) ?? null, now);
      await entryRef(db, id).set(entry);
      return entry;
    } catch (error) {
      if (error instanceof OutOfQuota) throw error;
      console.error(`OpenCritic update for ${id} failed`, error);
      failed++;
      return null;
    }
  };

  try {
    for (const id of refreshes) {
      if (calls >= maxCalls || lowOn('requests', KEEP_REQUESTS, now)) break;
      calls++;
      if (await update(id)) refreshed++;
    }
    for (const id of searches) {
      if (calls >= maxCalls || lowOn('requests', KEEP_REQUESTS, now)) break;
      if (lowOn('searches', KEEP_SEARCHES, now)) break;
      calls += 2;
      const entry = await update(id);
      if (entry?.ocId) matched++;
      else if (entry) notFound++;
    }
  } catch (error) {
    if (!(error instanceof OutOfQuota)) throw error;
  } finally {
    await saveQuota(db).catch((error: unknown) => console.error(error));
  }

  return {
    games: ids.size,
    refreshed,
    matched,
    notFound,
    failed,
    waiting: due.length - refreshed - matched - notFound - failed,
    left: { ...remaining },
  };
}
