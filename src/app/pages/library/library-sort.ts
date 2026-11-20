import { eventCompany } from '../../../../api/_lib/igdb-events.js';
import {
  type Completion,
  eventEnd,
  type GamingEvent,
  type HltbTimes,
  type Status,
  type TrackedGame,
} from '../../../../api/_lib/models.js';
import { isReleased } from '../../core/dates';
import { searchable, titleMatcher } from '../../core/title-search';

/** Which copies a tab shows: everything, only discs, or only downloads. */
export type CopyFilter = 'all' | 'physical' | 'digital';

/** The owned tabs, where physical or digital means something. */
export const COPY_TABS: readonly Status[] = ['completed', 'backlog', 'shelved'];

export function matchesCopy(game: TrackedGame, copy: CopyFilter): boolean {
  if (copy === 'physical') return !!game.physical;
  if (copy === 'digital') return !game.physical;
  return true;
}

export type Sort =
  | 'recent'
  | 'name'
  | 'release'
  | 'completed'
  | 'rating'
  | 'playtime'
  | 'critics'
  | HltbSort;

/**
 * HowLongToBeat's three times as sorts (the Backlog's, and the Wishlist's for games already out):
 * Main story, Main + extra, Completionist.
 */
export type HltbSort = 'hltb-main' | 'hltb-extra' | 'hltb-completionist';
const HLTB_SORT_KEY: Record<HltbSort, keyof HltbTimes> = {
  'hltb-main': 'main',
  'hltb-extra': 'extra',
  'hltb-completionist': 'completionist',
};

/** Library tabs, in your order. */
export const LIBRARY_TABS: readonly Status[] = ['completed', 'wishlist', 'backlog', 'shelved'];

/** Each tab's sort until you pick another one. */
export const DEFAULT_SORT: Record<Status, Sort> = {
  completed: 'completed',
  backlog: 'release',
  wishlist: 'release',
  shelved: 'release',
};

const byName = (a: TrackedGame, b: TrackedGame) => a.name.localeCompare(b.name);

/**
 * Orders by a value, games without one last (in either direction), then by name.
 * `dir` 1 is highest first, -1 lowest first.
 */
function byValue<T extends number | string>(
  value: (g: TrackedGame) => T | null | undefined,
  dir: 1 | -1,
): (a: TrackedGame, b: TrackedGame) => number {
  return (a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va == null || vb == null) return Number(va == null) - Number(vb == null) || byName(a, b);
    const order = typeof va === 'number' ? (vb as number) - va : String(vb).localeCompare(va);
    return dir * order || byName(a, b);
  };
}

/**
 * Each sort's usual order, or the opposite when `reversed`. Games missing the value (no date,
 * no rating, no playtime, no OpenCritic score) stay last either way.
 * - Recent: last changed first. Name: A–Z. Date completed: latest first. Rating: highest first.
 *   Playtime: most played first. Release date: newest first. OpenCritic: highest Top Critic
 *   Average first, from `scores` (by IGDB id). HowLongToBeat (Main story, Main + extra,
 *   Completionist): shortest first, so the quick ones lead a backlog. On the Wishlist only games
 *   already out count (the ones whose cover shows the times); the rest go last.
 * - On the Wishlist, release date means what's coming soonest: upcoming games nearest first, then
 *   games without a date, then ones already out (newest first). Reversed, that whole order flips.
 */
export function compareBy(
  sort: Sort,
  tab: Status,
  today: string,
  reversed = false,
  scores: Readonly<Record<string, number>> = {},
): (a: TrackedGame, b: TrackedGame) => number {
  const dir = reversed ? -1 : 1;
  switch (sort) {
    case 'critics':
      return byValue((g) => scores[g.igdbId], dir);
    case 'name':
      return (a, b) => dir * byName(a, b);
    case 'completed':
      return byValue((g) => g.completedAt, dir);
    case 'rating':
      return byValue((g) => g.rating, dir);
    case 'playtime':
      return byValue((g) => g.hoursPlayed || null, dir);
    case 'hltb-main':
    case 'hltb-extra':
    case 'hltb-completionist': {
      const key = HLTB_SORT_KEY[sort];
      const counts = (g: TrackedGame) => tab !== 'wishlist' || isReleased(g, today);
      return byValue((g) => (counts(g) ? g.hltb?.[key] || null : null), reversed ? 1 : -1);
    }
    case 'release':
      if (tab === 'wishlist') {
        const rank = (g: TrackedGame) => (!g.releaseDate ? 1 : g.releaseDate >= today ? 0 : 2);
        return (a, b) =>
          dir *
            (rank(a) - rank(b) ||
              (rank(a) === 0
                ? a.releaseDate!.localeCompare(b.releaseDate!)
                : (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))) || byName(a, b);
      }
      return byValue((g) => g.releaseDate, dir);
    default:
      return (a, b) => dir * (b.updatedAt - a.updatedAt);
  }
}

export interface YearGroup {
  /** Stable id, used to remember whether the group is collapsed. */
  key: string;
  /** "4 in 2026", "3 without a date", "2 already out". */
  title: string;
  games: TrackedGame[];
}

/**
 * Splits an already-sorted tab into year groups, when its sort calls for it:
 * - Completed by date completed: the year you finished each game, latest first.
 * - Wishlist by release date: the year each upcoming game comes out, soonest first, then games
 *   without a date, then games already out.
 * Other tabs and sorts aren't grouped (null).
 */
export function groupByYear(
  tab: Status,
  sort: Sort,
  games: readonly TrackedGame[],
  today: string,
): YearGroup[] | null {
  if (tab === 'completed' && sort === 'completed') {
    return consecutive(games, (g) =>
      g.completedAt ? String(new Date(g.completedAt).getFullYear()) : 'none',
    );
  }
  if (tab === 'wishlist' && sort === 'release') {
    return consecutive(games, (g) =>
      !g.releaseDate ? 'none' : g.releaseDate < today ? 'out' : g.releaseDate.slice(0, 4),
    );
  }
  return null;
}

/** Groups neighbours with the same key, keeping the sort order. */
function consecutive(
  games: readonly TrackedGame[],
  keyOf: (g: TrackedGame) => string,
): YearGroup[] {
  const groups: YearGroup[] = [];
  for (const g of games) {
    const key = keyOf(g);
    const last = groups.at(-1);
    if (last?.key === key) last.games.push(g);
    else groups.push({ key, title: '', games: [g] });
  }
  for (const group of groups) {
    const n = group.games.length;
    group.title =
      group.key === 'none'
        ? `${n} without a date`
        : group.key === 'out'
          ? `${n} already out`
          : `${n} in ${group.key}`;
  }
  return groups;
}

/**
 * Your games whose title has every word you typed, ignoring case, accents and punctuation.
 * Titles that start with what you typed come first, then ones with a word starting with it,
 * then the rest, each A–Z.
 */
export function searchLibrary(games: readonly TrackedGame[], query: string): TrackedGame[] {
  const matches = titleMatcher(query);
  if (!matches) return [];
  const q = searchable(query);
  const rank = (name: string) => (name.startsWith(q) ? 0 : ` ${name}`.includes(` ${q}`) ? 1 : 2);
  return games
    .filter((game) => matches(game.name))
    .map((game) => ({ game, rank: rank(searchable(game.name)) }))
    .sort((x, y) => x.rank - y.rank || byName(x.game, y.game))
    .map(({ game }) => game);
}

/** How the Library's Events tab can be sorted. */
export type EventSort = 'airdate' | 'company' | 'year';

/** In the menu A–Z. */
export const EVENT_SORTS: readonly { key: EventSort; label: string }[] = [
  { key: 'airdate', label: 'Air date' },
  { key: 'company', label: 'Company' },
  { key: 'year', label: 'Year' },
];
export const DEFAULT_EVENT_SORT: EventSort = 'year';

/**
 * Events in their sort's order: by air date (and by year) the latest first; by company A–Z, the
 * ones without a company last, each company's latest first. `reversed` flips the main order;
 * events without a company stay last either way.
 */
export function sortEvents(
  events: readonly GamingEvent[],
  sort: EventSort,
  reversed = false,
): GamingEvent[] {
  const dir = reversed ? -1 : 1;
  const latest = (a: GamingEvent, b: GamingEvent) => b.startsAt - a.startsAt;
  if (sort !== 'company') return [...events].sort((a, b) => dir * latest(a, b));
  const name = (e: GamingEvent) => eventCompany(e)?.name ?? null;
  return [...events].sort((a, b) => {
    const na = name(a);
    const nb = name(b);
    if (na === null || nb === null)
      return Number(na === null) - Number(nb === null) || latest(a, b);
    return dir * na.localeCompare(nb) || latest(a, b);
  });
}

/** Already-sorted events split by the year they aired: "3 in 2026", then the next year. */
export function eventYearGroups(
  events: readonly GamingEvent[],
): { key: string; title: string; events: GamingEvent[] }[] {
  const groups: { key: string; title: string; events: GamingEvent[] }[] = [];
  for (const e of events) {
    const key = String(new Date(e.startsAt).getFullYear());
    const last = groups.at(-1);
    if (last?.key === key) last.events.push(e);
    else groups.push({ key, title: '', events: [e] });
  }
  for (const g of groups) g.title = `${g.events.length} in ${g.key}`;
  return groups;
}

/** Hours on a cover badge, whole: 23.5 → "24", under half an hour "<1", none "–". */
export function wholeHours(h: number | null | undefined): string {
  return !h ? '–' : h < 0.5 ? '<1' : String(Math.round(h));
}

/**
 * A cover's HowLongToBeat times: Main story, Main + extra and Completionist in whole hours
 * (["12", "20", "45"]), "–" for a time not typed in. Empty without any time.
 */
export function hltbHours(times: HltbTimes | null | undefined): string[] {
  if (!times || (!times.main && !times.extra && !times.completionist)) return [];
  return [times.main, times.extra, times.completionist].map(wholeHours);
}

/** Covers that show your time played: Completed, Shelved, and Backlog games you're playing. */
export function showsPlaytime(game: TrackedGame): boolean {
  return (
    game.status === 'completed' ||
    game.status === 'shelved' ||
    (game.status === 'backlog' && !!game.playing)
  );
}

/** Which of HowLongToBeat's times matches how far you got: a Platinum is its Completionist. */
const COMPLETION_CELL: Record<Completion, number> = { main: 0, main_sides: 1, platinum: 2 };

/** A cover's HowLongToBeat badge, with your own time over the matching one. */
export interface CoverHltb {
  /** Main story, Main + extra, Completionist: ["12", "24", "31"]. */
  cells: string[];
  /** Your time played in whole hours ("34"), on covers that show it and have one. */
  mine: string | null;
  /**
   * A completed game you got the Platinum in: the trophy sits with your time, over
   * Completionist (it replaces the cover's own trophy badge while the times show).
   */
  platinum: boolean;
  /**
   * The badge's grid column your time (and trophy) sits in, over the time it compares with: 2, 4 or 6 for
   * Main story, Main + extra or Completionist (between them are the hairlines), or 1, over the
   * logo, without a completion style (a game you're playing, or one shelved).
   */
  mineColumn: number;
}

/**
 * HowLongToBeat's times for a cover, when it has some: on every tab, except Wishlist games not
 * out yet. Covers that show your time played put it over the matching time instead of in a
 * badge of its own; a Platinum puts its trophy there too, over Completionist.
 */
export function coverHltb(game: TrackedGame, today: string): CoverHltb | null {
  if (game.status === 'wishlist' && !isReleased(game, today)) return null;
  const cells = hltbHours(game.hltb);
  if (!cells.length) return null;
  const mine = showsPlaytime(game) && game.hoursPlayed ? wholeHours(game.hoursPlayed) : null;
  const cell = game.completion ? COMPLETION_CELL[game.completion] : null;
  const platinum = game.status === 'completed' && game.completion === 'platinum';
  return { cells, mine, platinum, mineColumn: cell === null ? 1 : 2 + cell * 2 };
}

/**
 * The Library's Events tab: the events in your calendar still to come (or on now), soonest
 * first, which lead the tab whatever its sort, and the ones that are over. Archived ones are
 * left out of both.
 */
export function splitEvents(
  events: readonly GamingEvent[],
  now: number,
): { upcoming: GamingEvent[]; past: GamingEvent[] } {
  const shown = events.filter((e) => !e.archived);
  return {
    upcoming: shown.filter((e) => eventEnd(e) > now).sort((a, b) => a.startsAt - b.startsAt),
    past: shown.filter((e) => eventEnd(e) <= now),
  };
}
