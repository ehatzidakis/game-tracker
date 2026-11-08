// OpenCritic scores, through RapidAPI (free Basic plan: 200 requests and 25 searches a day, at
// most 4 a second; past the limit calls fail, nothing is charged). The key is RAPIDAPI_KEY.
// A game is matched once by name (a search), then refreshed by its OpenCritic id (a request).
// Results are shared by all users in opencritic/{igdbId}; the app can't read that collection.
import type { Firestore } from 'firebase-admin/firestore';
import { igdbQuery } from './igdb-client.js';
import {
  entryFrom,
  isStale,
  matchCandidates,
  maxAgeDays,
  sameYear,
  type OcGame,
  type OcSearchResult,
  type OpenCriticEntry,
} from './opencritic-match.js';

const HOST = 'opencritic-api.p.rapidapi.com';

/** What's left today, from the last reply's headers (null until the first call). */
export const remaining: { requests: number | null; searches: number | null } = {
  requests: null,
  searches: null,
};

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
 * null, if there's none) when OpenCritic can't be asked right now.
 */
export async function openCriticFor(
  db: Firestore,
  igdbId: number,
  now = Date.now(),
): Promise<OpenCriticEntry | null> {
  const snap = await entryRef(db, igdbId).get();
  const stored = snap.exists ? (snap.data() as OpenCriticEntry) : null;
  if (stored && !isStale(stored, now)) return stored;
  try {
    const entry = await lookUp(igdbId, stored, now);
    await entryRef(db, igdbId).set(entry);
    return entry;
  } catch (error) {
    if (!(error instanceof OutOfQuota)) console.error(error);
    return stored;
  }
}

/** Searches and requests kept back for opening game pages during the day. */
const KEEP_SEARCHES = 5;
const KEEP_REQUESTS = 30;
/** Stays well inside the function's time limit. */
const MAX_CALLS = 100;

/**
 * Daily: refreshes due scores for every game in anyone's library (games around release first),
 * then matches games not looked up yet, as far as today's searches allow. A big library gets
 * matched over a few days.
 */
export async function runOpenCriticRefresh(db: Firestore, now = Date.now()) {
  const ids = new Set<number>();
  for (const user of await db.collection('users').listDocuments()) {
    for (const doc of await user.collection('games').listDocuments()) ids.add(Number(doc.id));
  }

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
  const searches = due.filter((id) => !stored.get(id)?.ocId);

  let refreshed = 0;
  let matched = 0;
  let notFound = 0;
  let calls = 0;
  const lowOn = (kind: 'requests' | 'searches', keep: number) =>
    remaining[kind] !== null && remaining[kind] <= keep;

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
      if (calls >= MAX_CALLS || lowOn('requests', KEEP_REQUESTS)) break;
      calls++;
      if (await update(id)) refreshed++;
    }
    for (const id of searches) {
      if (calls >= MAX_CALLS || lowOn('requests', KEEP_REQUESTS)) break;
      if (lowOn('searches', KEEP_SEARCHES)) break;
      calls += 2;
      const entry = await update(id);
      if (entry?.ocId) matched++;
      else if (entry) notFound++;
    }
  } catch (error) {
    if (!(error instanceof OutOfQuota)) throw error;
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
