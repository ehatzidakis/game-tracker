import type { TrackedGame } from '../../../../api/_lib/models.js';
import { compareBy, DEFAULT_SORT, groupByYear, LIBRARY_TABS } from './library-sort';

const game = (name: string, extra: Partial<TrackedGame>) => ({ name, ...extra }) as TrackedGame;
const names = (games: TrackedGame[]) => games.map((g) => g.name);
const today = '2026-11-08';

describe('library sorting', () => {
  it('opens on Completed, with each tab’s own default sort', () => {
    expect(LIBRARY_TABS).toEqual(['completed', 'wishlist', 'backlog', 'shelved', 'playing']);
    expect(DEFAULT_SORT).toEqual({
      completed: 'completed',
      playing: 'recent',
      backlog: 'release',
      wishlist: 'release',
      shelved: 'release',
    });
  });

  const games = [
    game('Old', { releaseDate: '2020-05-01' }),
    game('TBA', { releaseDate: null }),
    game('Soon', { releaseDate: '2026-11-19' }),
    game('Later', { releaseDate: '2027-05-20' }),
    game('Recent', { releaseDate: '2026-10-29' }),
  ];

  it('sorts by newest release on Backlog and Shelved, TBA last', () => {
    expect(names([...games].sort(compareBy('release', 'backlog', today)))).toEqual([
      'Later',
      'Soon',
      'Recent',
      'Old',
      'TBA',
    ]);
  });

  it('sorts the Wishlist by what comes out soonest, then no date, then already out', () => {
    expect(names([...games].sort(compareBy('release', 'wishlist', today)))).toEqual([
      'Soon',
      'Later',
      'TBA',
      'Recent',
      'Old',
    ]);
  });

  it('groups completed games by year, latest first', () => {
    const at = (y: number, m: number) => new Date(y, m, 10, 12).getTime();
    const done = [
      game('A', { completedAt: at(2025, 2) }),
      game('B', { completedAt: at(2026, 9) }),
      game('C', { completedAt: null }),
      game('D', { completedAt: at(2026, 1) }),
    ].sort(compareBy('completed', 'completed', today));
    expect(
      groupByYear('completed', 'completed', done, today)!.map((g) => [g.title, names(g.games)]),
    ).toEqual([
      ['2 in 2026', ['B', 'D']],
      ['1 in 2025', ['A']],
      ['1 without a date', ['C']],
    ]);
  });

  it('groups the Wishlist by release year, soonest first, then no date, then already out', () => {
    const sorted = [...games].sort(compareBy('release', 'wishlist', today));
    expect(
      groupByYear('wishlist', 'release', sorted, today)!.map((g) => [g.title, names(g.games)]),
    ).toEqual([
      ['1 in 2026', ['Soon']],
      ['1 in 2027', ['Later']],
      ['1 without a date', ['TBA']],
      ['2 already out', ['Recent', 'Old']],
    ]);
  });

  it('only groups Completed by date completed and Wishlist by release date', () => {
    expect(groupByYear('wishlist', 'name', games, today)).toBeNull();
    expect(groupByYear('backlog', 'release', games, today)).toBeNull();
  });
});
