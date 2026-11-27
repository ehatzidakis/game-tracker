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
  /**
   * The scores were typed in by hand ("Edit my data"), for the few games OpenCritic matches wrong
   * or doesn't have: topCriticScore (and its tier) and playerScore are someone's, and OpenCritic
   * isn't asked again until they're cleared. ocId is kept, so clearing goes back to the match.
   */
  manual?: boolean;
  /** Typed-in players' score, 0–100, in place of IGDB's (null: IGDB's). */
  playerScore?: number | null;
  /** Typed in with it: how many players rated it (null: not known). */
  playerCount?: number | null;
}

/**
 * Scores typed in by hand in "Edit my data", with how many critics and users they're from (null:
 * not known). All null: OpenCritic's and IGDB's.
 */
export interface OwnScores {
  critic: number | null;
  critics: number | null;
  players: number | null;
  users: number | null;
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
      /** Typed in by hand: no critic count or reviews link. */
      manual: boolean;
      /** Typed-in players' score, shown in place of IGDB's (null: IGDB's), and from how many. */
      playerScore: number | null;
      playerCount: number | null;
    }
  /** OpenCritic has no page for this game. */
  | { status: 'none' }
  /**
   * Not looked up yet and OpenCritic can't be asked right now: `limit` when today's allowance is
   * used up (it comes back at `retryAt`, ms, if known), otherwise OpenCritic didn't answer.
   */
  | { status: 'later'; limit: boolean; retryAt: number | null };

/**
 * "Check OpenCritic now": the score, when OpenCritic was last really asked about it (so a stored
 * score isn't passed off as fresh), and whether the allowance stopped the check.
 */
export interface OpenCriticCheck {
  score: OpenCriticScore;
  /** ms; null when it was never looked up. */
  checkedAt: number | null;
  limit: boolean;
  retryAt: number | null;
}

export function toScore(
  entry: OpenCriticEntry | null,
  later: { limit: boolean; retryAt: number | null } = { limit: false, retryAt: null },
): OpenCriticScore {
  if (!entry) return { status: 'later', ...later };
  if (entry.manual) {
    return {
      status: 'found',
      url: null,
      tier: entry.tier,
      topCriticScore: entry.topCriticScore,
      percentRecommended: null,
      numReviews: entry.numTopCriticReviews,
      numTopCriticReviews: entry.numTopCriticReviews,
      manual: true,
      playerScore: entry.playerScore ?? null,
      playerCount: entry.playerCount ?? null,
    };
  }
  if (!entry.ocId) return { status: 'none' };
  return {
    status: 'found',
    url: entry.url,
    tier: entry.tier,
    topCriticScore: entry.topCriticScore,
    percentRecommended: entry.percentRecommended,
    numReviews: entry.numReviews,
    numTopCriticReviews: entry.numTopCriticReviews,
    manual: false,
    playerScore: null,
    playerCount: null,
  };
}

/** OpenCritic's tier for a Top Critic Average: Mighty 84+, Strong 75+, Fair 66+, else Weak. */
export function tierFor(score: number): string {
  return score >= 84 ? 'Mighty' : score >= 75 ? 'Strong' : score >= 66 ? 'Fair' : 'Weak';
}

/**
 * Scores typed in by hand, over what's stored (its OpenCritic match is kept for when they're
 * cleared). Both null: back to OpenCritic, due for a look-up at once.
 */
export function withOwnScores(
  igdbId: number,
  stored: OpenCriticEntry | null,
  own: OwnScores,
  now: number,
): OpenCriticEntry {
  const base = stored ?? entryFrom(igdbId, null, null, 0);
  if (Object.values(own).every((v) => v === null)) {
    if (!base.manual) return base;
    // Without the typed-in scores, and due: OpenCritic is asked again right away.
    const { manual: _manual, playerScore: _playerScore, playerCount: _playerCount, ...rest } = base;
    return {
      ...rest,
      tier: null,
      topCriticScore: null,
      percentRecommended: null,
      numReviews: 0,
      numTopCriticReviews: 0,
      checkedAt: 0,
    };
  }
  return {
    ...base,
    manual: true,
    topCriticScore: own.critic,
    tier: own.critic === null ? null : tierFor(own.critic),
    numReviews: own.critics ?? 0,
    numTopCriticReviews: own.critics ?? 0,
    playerScore: own.players,
    playerCount: own.users,
    checkedAt: now,
  };
}

/**
 * Which games the job looks up first: Completed, then Backlog, then Shelved, then the Wishlist
 * (wishlisted DLC after the games), and owned DLC last (it never shows as a Library cover).
 */
export function lookupRank(game: { status: string; parentId?: number | null }): number {
  const dlc = game.parentId != null;
  if (dlc) return game.status === 'wishlist' ? 4 : 5;
  return { completed: 0, backlog: 1, shelved: 2, wishlist: 3 }[game.status] ?? 3;
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
  if (entry.manual) return false;
  return now - entry.checkedAt >= maxAgeDays(entry, now) * DAY - 2 * 3_600_000;
}

/** When a stored score falls due (ms). Never for scores typed in by hand. */
export function dueAt(entry: OpenCriticEntry, now: number): number {
  if (entry.manual) return Infinity;
  return entry.checkedAt + maxAgeDays(entry, now) * DAY - 2 * 3_600_000;
}

/** One game waiting in the queue, with when it falls due (ms). */
export interface QueuedGame {
  id: number;
  dueAt: number;
}

/**
 * The games the hourly runs work through, kept in meta/opencriticQueue (server only). Built once
 * a day from everyone's libraries, so the hourly runs don't read every library each time.
 */
export interface OpenCriticQueue {
  builtAt: number;
  /** Matched games, in order: games around release first. */
  refreshes: QueuedGame[];
  /** Games not matched yet, in lookup order (Completed first, owned DLC last). */
  searches: QueuedGame[];
}

/** Games due within this long go in the queue: until the next daily build, with slack. */
export const QUEUE_HORIZON_MS = 26 * 3_600_000;

/** A queue older than this missed a daily build (it failed or didn't run), so it's built again. */
export function queueExpired(queue: OpenCriticQueue, now: number): boolean {
  return now - queue.builtAt > QUEUE_HORIZON_MS;
}

/**
 * Builds the queue from each game's lookup rank (games in anyone's library) and its stored
 * score, if any. Games due before the next build are in it; those not due yet wait until then.
 */
export function buildQueue(
  rank: ReadonlyMap<number, number>,
  stored: ReadonlyMap<number, OpenCriticEntry>,
  now: number,
): OpenCriticQueue {
  const refreshes: (QueuedGame & { maxAge: number })[] = [];
  const searches: (QueuedGame & { rank: number })[] = [];
  for (const [id, r] of rank) {
    const entry = stored.get(id);
    const due = entry ? dueAt(entry, now) : now;
    if (due > now + QUEUE_HORIZON_MS) continue;
    if (entry?.ocId) refreshes.push({ id, dueAt: due, maxAge: maxAgeDays(entry, now) });
    else searches.push({ id, dueAt: due, rank: r });
  }
  refreshes.sort((a, b) => a.maxAge - b.maxAge || a.dueAt - b.dueAt);
  searches.sort((a, b) => a.rank - b.rank || a.dueAt - b.dueAt);
  return {
    builtAt: now,
    refreshes: refreshes.map(({ id, dueAt }) => ({ id, dueAt })),
    searches: searches.map(({ id, dueAt }) => ({ id, dueAt })),
  };
}

/** What's left of OpenCritic's allowance in the current window (null until known). */
export interface Allowance {
  requests: number | null;
  searches: number | null;
  /** When the window ends and the allowance is full again (ms). */
  resetAt: number | null;
}

/** True when at most `keep` of that allowance is left and it hasn't reset since. */
export function lowOn(
  allowance: Allowance,
  kind: 'requests' | 'searches',
  keep: number,
  now: number,
): boolean {
  const left = allowance[kind];
  if (left === null) return false;
  if (allowance.resetAt !== null && now >= allowance.resetAt) return false;
  return left <= keep;
}
