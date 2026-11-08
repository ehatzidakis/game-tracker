import type { Status, TrackedGame } from '../../../../api/_lib/models.js';

export type Sort = 'recent' | 'name' | 'release' | 'completed';

/** Library tabs: Completed first, then the usual order. */
export const LIBRARY_TABS: readonly Status[] = [
  'completed',
  'playing',
  'backlog',
  'wishlist',
  'shelved',
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
  /** "4 in 2026", or "3 without a date". */
  title: string;
  games: TrackedGame[];
}

/** Completed games (already sorted, latest first) split by the year you finished them. */
export function completedByYear(games: readonly TrackedGame[]): YearGroup[] {
  const groups = new Map<string, TrackedGame[]>();
  for (const g of games) {
    const key = g.completedAt ? String(new Date(g.completedAt).getFullYear()) : '';
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  return [...groups].map(([year, list]) => ({
    title: year ? `${list.length} in ${year}` : `${list.length} without a date`,
    games: list,
  }));
}
