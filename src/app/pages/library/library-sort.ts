import type { Status, TrackedGame } from '../../../../api/_lib/models.js';
import { searchable, titleMatcher } from '../../core/title-search';

export type Sort = 'recent' | 'name' | 'release' | 'completed' | 'rating' | 'playtime';

/** Library tabs, in your order. */
export const LIBRARY_TABS: readonly Status[] = [
  'completed',
  'wishlist',
  'backlog',
  'shelved',
  'playing',
];

/** Each tab's sort until you pick another one. */
export const DEFAULT_SORT: Record<Status, Sort> = {
  completed: 'completed',
  playing: 'recent',
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
 * no rating, no playtime) stay last either way.
 * - Recent: last changed first. Name: A–Z. Date completed: latest first. Rating: highest first.
 *   Playtime: most played first. Release date: newest first.
 * - On the Wishlist, release date means what's coming soonest: upcoming games nearest first, then
 *   games without a date, then ones already out (newest first). Reversed, that whole order flips.
 */
export function compareBy(
  sort: Sort,
  tab: Status,
  today: string,
  reversed = false,
): (a: TrackedGame, b: TrackedGame) => number {
  const dir = reversed ? -1 : 1;
  switch (sort) {
    case 'name':
      return (a, b) => dir * byName(a, b);
    case 'completed':
      return byValue((g) => g.completedAt, dir);
    case 'rating':
      return byValue((g) => g.rating, dir);
    case 'playtime':
      return byValue((g) => g.hoursPlayed || null, dir);
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
