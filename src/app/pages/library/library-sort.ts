import type { Status, TrackedGame } from '../../../../api/_lib/models.js';

export type Sort = 'recent' | 'name' | 'release' | 'completed' | 'rating';

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
 * "Release date" means newest release first, except on the Wishlist, where it means what's
 * coming soonest: upcoming games nearest first, then games without a date, then ones already out
 * (newest first).
 */
export function compareBy(
  sort: Sort,
  tab: Status,
  today: string,
): (a: TrackedGame, b: TrackedGame) => number {
  switch (sort) {
    case 'name':
      return byName;
    case 'completed':
      // Latest finished first; games without a date last.
      return (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0) || byName(a, b);
    case 'rating':
      // Highest first; unrated last.
      return (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b);
    case 'release':
      if (tab === 'wishlist') {
        const rank = (g: TrackedGame) => (!g.releaseDate ? 1 : g.releaseDate >= today ? 0 : 2);
        return (a, b) =>
          rank(a) - rank(b) ||
          (rank(a) === 0
            ? a.releaseDate!.localeCompare(b.releaseDate!)
            : (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')) ||
          byName(a, b);
      }
      // Newest release first; TBA last.
      return (a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || byName(a, b);
    default:
      return (a, b) => b.updatedAt - a.updatedAt;
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
