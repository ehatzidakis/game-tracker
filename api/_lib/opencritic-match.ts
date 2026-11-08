// OpenCritic: what we keep per game, how a search result is matched to an IGDB game, and when a
// stored score is due for a refresh. No network or database here, so it's easy to test.

/** One result of OpenCritic's /game/search. `dist` is 0 for an exact name, up to 1. */
export interface OcSearchResult {
  id: number;
  name: string;
  dist: number;
}

/** The parts of OpenCritic's /game/{id} we use. Scores are -1 when there aren't enough reviews. */
export interface OcGame {
  id: number;
  name: string;
  url?: string;
  tier?: string;
  topCriticScore?: number;
  percentRecommended?: number;
  numReviews?: number;
  numTopCriticReviews?: number;
  firstReleaseDate?: string | null;
}

/** Stored in opencritic/{igdbId}, shared by all users. Only the server reads and writes it. */
export interface OpenCriticEntry {
  igdbId: number;
  /** Null when OpenCritic has no page for the game (yet). */
  ocId: number | null;
  name: string | null;
  url: string | null;
  /** "Mighty", "Strong", "Fair" or "Weak"; null without enough reviews. */
  tier: string | null;
  topCriticScore: number | null;
  percentRecommended: number | null;
  numReviews: number;
  numTopCriticReviews: number;
  /** IGDB's first release date, "YYYY-MM-DD", to know how often to refresh. */
  releaseDate: string | null;
  /** When OpenCritic was last asked (ms). */
  checkedAt: number;
}

/** What the game page gets from /api/opencritic. */
export type OpenCriticScore =
  | {
      status: 'found';
      url: string | null;
      tier: string | null;
      topCriticScore: number | null;
      percentRecommended: number | null;
      numReviews: number;
      numTopCriticReviews: number;
    }
  /** OpenCritic has no page for this game. */
  | { status: 'none' }
  /** Out of OpenCritic requests for today; try again later. */
  | { status: 'later' };

export function toScore(entry: OpenCriticEntry | null): OpenCriticScore {
  if (!entry) return { status: 'later' };
  if (!entry.ocId) return { status: 'none' };
  return {
    status: 'found',
    url: entry.url,
    tier: entry.tier,
    topCriticScore: entry.topCriticScore,
    percentRecommended: entry.percentRecommended,
    numReviews: entry.numReviews,
    numTopCriticReviews: entry.numTopCriticReviews,
  };
}

/** "Marvel's Spider-Man™ 2" → "marvels spider man 2"; "Ragnarök" → "ragnarok". */
export function comparable(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’™®©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Which search results could be the game, best first (at most 2, each costs a request to check):
 * results with the same name (or one of IGDB's alternative names), or else the top result if
 * its name is very close.
 */
export function matchCandidates(results: readonly OcSearchResult[], names: readonly string[]) {
  const wanted = new Set(names.map(comparable).filter(Boolean));
  const sorted = [...results].sort((a, b) => a.dist - b.dist);
  const exact = sorted.filter((r) => wanted.has(comparable(r.name)));
  if (exact.length) return exact.slice(0, 2);
  const top = sorted[0];
  return top && top.dist <= 0.15 ? [top] : [];
}

/**
 * Same game, judging by the year: remakes share names ("Resident Evil 4", 2005 and 2023), so a
 * first release more than a year apart is a different game. Unknown dates don't rule it out.
 */
export function sameYear(igdbDate: string | null, ocDate: string | null | undefined): boolean {
  if (!igdbDate || !ocDate) return true;
  const year = (date: string) => Number(date.slice(0, 4));
  return Math.abs(year(igdbDate) - year(ocDate)) <= 1;
}

const realScore = (n: number | undefined) => (n == null || n < 0 ? null : Math.round(n));

export function entryFrom(
  igdbId: number,
  game: OcGame | null,
  releaseDate: string | null,
  now: number,
): OpenCriticEntry {
  return {
    igdbId,
    ocId: game?.id ?? null,
    name: game?.name ?? null,
    url: game?.url ?? (game ? `https://opencritic.com/game/${game.id}` : null),
    tier: game?.tier || null,
    topCriticScore: realScore(game?.topCriticScore),
    percentRecommended: realScore(game?.percentRecommended),
    numReviews: game?.numReviews ?? 0,
    numTopCriticReviews: game?.numTopCriticReviews ?? 0,
    releaseDate,
    checkedAt: now,
  };
}

const DAY = 86_400_000;

/**
 * How old a stored score may get. Reviews pile up in the weeks around release, so those games
 * are checked daily; older ones rarely change. Games OpenCritic doesn't have are looked for again
 * at most weekly (searches are the scarce part: 25 a day).
 */
export function maxAgeDays(entry: OpenCriticEntry, now: number): number {
  const release = entry.releaseDate ? Date.parse(`${entry.releaseDate}T00:00:00Z`) : NaN;
  const sinceRelease = Number.isNaN(release) ? null : (now - release) / DAY;
  let days: number;
  if (sinceRelease === null) days = 14;
  else if (sinceRelease < -30) days = 14;
  else if (sinceRelease <= 60) days = 1;
  else if (sinceRelease <= 365) days = 30;
  else days = 90;
  return entry.ocId ? days : Math.max(days, 7);
}

/** Due for a refresh. Two hours' slack so the daily job catches yesterday's daily ones. */
export function isStale(entry: OpenCriticEntry, now: number): boolean {
  return now - entry.checkedAt >= maxAgeDays(entry, now) * DAY - 2 * 3_600_000;
}
