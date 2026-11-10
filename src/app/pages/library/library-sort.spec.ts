import type { TrackedGame } from '../../../../api/_lib/models.js';
import {
  compareBy,
  COPY_TABS,
  DEFAULT_SORT,
  groupByYear,
  LIBRARY_TABS,
  matchesCopy,
  searchLibrary,
} from './library-sort';

const game = (name: string, extra: Partial<TrackedGame>) => ({ name, ...extra }) as TrackedGame;
const names = (games: TrackedGame[]) => games.map((g) => g.name);
const today = '2026-11-08';

describe('library sorting', () => {
  it('opens on Completed, with each tab’s own default sort', () => {
    expect(LIBRARY_TABS).toEqual(['completed', 'wishlist', 'backlog', 'shelved']);
    expect(DEFAULT_SORT).toEqual({
      completed: 'completed',
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

  it('sorts Completed by rating, highest first, unrated last', () => {
    const rated = [
      game('A', { rating: 7 }),
      game('B', { rating: null }),
      game('C', { rating: 8.5 }),
    ];
    expect(names(rated.sort(compareBy('rating', 'completed', today)))).toEqual(['C', 'A', 'B']);
  });

  it('sorts by playtime, most played first, none last, and flips either way', () => {
    const played = () => [
      game('A', { hoursPlayed: 12.5 }),
      game('B', { hoursPlayed: null }),
      game('C', { hoursPlayed: 40 }),
      game('D', { hoursPlayed: 0 }),
    ];
    expect(names(played().sort(compareBy('playtime', 'shelved', today)))).toEqual([
      'C',
      'A',
      'B',
      'D',
    ]);
    expect(names(played().sort(compareBy('playtime', 'shelved', today, true)))).toEqual([
      'A',
      'C',
      'B',
      'D',
    ]);
  });

  it('reverses each sort, keeping games without a value last', () => {
    const rated = [
      game('A', { rating: 7 }),
      game('B', { rating: null }),
      game('C', { rating: 8.5 }),
    ];
    expect(names(rated.sort(compareBy('rating', 'completed', today, true)))).toEqual([
      'A',
      'C',
      'B',
    ]);
    const byName = [game('B', {}), game('A', {}), game('C', {})];
    expect(names(byName.sort(compareBy('name', 'backlog', today, true)))).toEqual(['C', 'B', 'A']);
    const released = [
      game('Old', { releaseDate: '2020-01-01' }),
      game('TBA', { releaseDate: null }),
      game('New', { releaseDate: '2025-01-01' }),
    ];
    expect(names(released.sort(compareBy('release', 'backlog', today, true)))).toEqual([
      'Old',
      'New',
      'TBA',
    ]);
  });

  it('flips the Wishlist order and its year groups when reversed', () => {
    const wished = [
      game('Soon', { releaseDate: '2026-12-01' }),
      game('Later', { releaseDate: '2027-05-01' }),
      game('TBA', { releaseDate: null }),
      game('Out', { releaseDate: '2026-01-01' }),
    ].sort(compareBy('release', 'wishlist', today, true));
    expect(names(wished)).toEqual(['Out', 'TBA', 'Later', 'Soon']);
    expect(groupByYear('wishlist', 'release', wished, today)!.map((g) => g.title)).toEqual([
      '1 already out',
      '1 without a date',
      '1 in 2027',
      '1 in 2026',
    ]);
  });
});

describe('library search', () => {
  const library = [
    game('God of War', {}),
    game('God of War Ragnarök', {}),
    game("Marvel's Spider-Man 2", {}),
    game('Doom Eternal', {}),
    game('Astro Bot', {}),
  ];
  const find = (q: string) => names(searchLibrary(library, q));

  it('matches titles ignoring case, accents and punctuation', () => {
    expect(find('ragnarok')).toEqual(['God of War Ragnarök']);
    expect(find('marvels')).toEqual(["Marvel's Spider-Man 2"]);
    expect(find('spider man')).toEqual(["Marvel's Spider-Man 2"]);
    expect(find('god ragnarok')).toEqual(['God of War Ragnarök']);
  });

  it('puts titles starting with what you typed first, then word starts, then the rest', () => {
    expect(find('god')).toEqual(['God of War', 'God of War Ragnarök']);
    // 'r': Ragnarök has a word starting with it, the rest just contain it.
    expect(find('r')).toEqual([
      'God of War Ragnarök',
      'Astro Bot',
      'Doom Eternal',
      'God of War',
      "Marvel's Spider-Man 2",
    ]);
    expect(find('')).toEqual([]);
    expect(find('zelda')).toEqual([]);
  });
});

describe('physical and digital copies', () => {
  it('filters the owned tabs by disc or download', () => {
    const disc = { name: 'Disc', physical: true } as TrackedGame;
    const download = { name: 'Download' } as TrackedGame;
    expect([disc, download].filter((g) => matchesCopy(g, 'physical'))).toEqual([disc]);
    expect([disc, download].filter((g) => matchesCopy(g, 'digital'))).toEqual([download]);
    expect([disc, download].filter((g) => matchesCopy(g, 'all'))).toHaveLength(2);
    expect(COPY_TABS).toEqual(['completed', 'backlog', 'shelved']);
  });
});
