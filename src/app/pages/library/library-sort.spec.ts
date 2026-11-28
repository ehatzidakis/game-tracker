import type { GamingEvent, TrackedGame } from '../../../../api/_lib/models.js';
import {
  browseOrder,
  compareBy,
  EVENT_SORTS,
  eventYearGroups,
  sortEvents,
  COPY_TABS,
  DEFAULT_SORT,
  groupByYear,
  coverHltb,
  hltbHours,
  LIBRARY_TABS,
  matchesCopy,
  searchLibrary,
  splitEvents,
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

  it('sorts by OpenCritic score, highest first, games without one last either way', () => {
    const scores = { 1: 88, 3: 95, 4: 88 };
    const scored = () => [
      game('B', { igdbId: 1 }),
      game('None', { igdbId: 2 }),
      game('Top', { igdbId: 3 }),
      game('A', { igdbId: 4 }),
    ];
    const sorted = (reversed: boolean) =>
      names(scored().sort(compareBy('critics', 'backlog', today, reversed, scores)));
    // The same score: A–Z.
    expect(sorted(false)).toEqual(['Top', 'A', 'B', 'None']);
    expect(sorted(true)).toEqual(['A', 'B', 'Top', 'None']);
    // Before the scores have loaded, it falls back to A–Z.
    expect(names(scored().sort(compareBy('critics', 'backlog', today)))).toEqual([
      'A',
      'B',
      'None',
      'Top',
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

describe('physical, digital, subscription and rented copies', () => {
  it('filters the owned tabs by disc, download, subscription or rent', () => {
    const disc = { name: 'Disc', copy: 'physical' } as TrackedGame;
    const oldDisc = { name: 'Old disc', physical: true } as TrackedGame;
    const download = { name: 'Download', copy: 'digital' } as TrackedGame;
    const unsaid = { name: 'Unsaid' } as TrackedGame;
    const pass = { name: 'Pass', copy: 'subscription', physical: false } as TrackedGame;
    const rented = { name: 'Rented', copy: 'rent', physical: false } as TrackedGame;
    const all = [disc, oldDisc, download, unsaid, pass, rented];
    expect(all.filter((g) => matchesCopy(g, 'physical'))).toEqual([disc, oldDisc]);
    expect(all.filter((g) => matchesCopy(g, 'digital'))).toEqual([download, unsaid]);
    expect(all.filter((g) => matchesCopy(g, 'subscription'))).toEqual([pass]);
    expect(all.filter((g) => matchesCopy(g, 'rent'))).toEqual([rented]);
    expect(all.filter((g) => matchesCopy(g, 'all'))).toHaveLength(6);
    expect(COPY_TABS).toEqual(['completed', 'backlog', 'shelved']);
  });
});

describe('sorting past events', () => {
  const ev = (id: string, title: string, startsAt: string) =>
    ({ id, title, kind: 'other', igdbId: 1, startsAt: Date.parse(startsAt) }) as GamingEvent;
  const events = [
    ev('a', 'Nintendo Direct', '2026-06-10T14:00:00Z'),
    ev('b', 'The Game Awards 2025', '2025-12-12T01:00:00Z'),
    ev('c', 'State of Play', '2026-09-03T13:00:00Z'),
    ev('d', 'Nintendo Direct Mini', '2025-03-27T14:00:00Z'),
  ];
  const ids = (list: GamingEvent[]) => list.map((e) => e.id);

  it('by air date: latest first, or oldest first reversed', () => {
    expect(ids(sortEvents(events, 'airdate'))).toEqual(['c', 'a', 'b', 'd']);
    expect(ids(sortEvents(events, 'airdate', true))).toEqual(['d', 'b', 'a', 'c']);
  });

  it('by company: A–Z, each company’s latest first, events without one last either way', () => {
    expect(ids(sortEvents(events, 'company'))).toEqual(['a', 'd', 'c', 'b']);
    expect(ids(sortEvents(events, 'company', true))).toEqual(['c', 'a', 'd', 'b']);
  });

  it('by year: in groups, latest year first', () => {
    const groups = eventYearGroups(sortEvents(events, 'year'));
    expect(groups.map((g) => [g.title, ids(g.events)])).toEqual([
      ['2 in 2026', ['c', 'a']],
      ['2 in 2025', ['b', 'd']],
    ]);
    expect(EVENT_SORTS.map((s) => s.label)).toEqual(['Air date', 'Company', 'Year']);
  });
});

describe('HowLongToBeat on the Backlog', () => {
  const hltb = (main: number | null, extra: number | null, completionist: number | null) => ({
    hltb: { main, extra, completionist },
  });
  const games = [
    game('Long', hltb(40, 60, 120)),
    game('None', {}),
    game('Short', hltb(5, 8, 15)),
    game('No extra', hltb(10, null, 30)),
  ];

  it('sorts by each of its times, shortest first, games without that time last', () => {
    expect(names([...games].sort(compareBy('hltb-main', 'backlog', today)))).toEqual([
      'Short',
      'No extra',
      'Long',
      'None',
    ]);
    expect(names([...games].sort(compareBy('hltb-extra', 'backlog', today)))).toEqual([
      'Short',
      'Long',
      'No extra',
      'None',
    ]);
    expect(names([...games].sort(compareBy('hltb-completionist', 'backlog', today)))).toEqual([
      'Short',
      'No extra',
      'Long',
      'None',
    ]);
  });

  it('reversed, longest first, still with games without that time last', () => {
    expect(names([...games].sort(compareBy('hltb-main', 'backlog', today, true)))).toEqual([
      'Long',
      'No extra',
      'Short',
      'None',
    ]);
  });

  it('on the Wishlist counts only games already out, the rest last', () => {
    const wishlist = [
      game('Coming', { releaseDate: '2027-03-01', ...hltb(2, 3, 4) }),
      game('Out long', { releaseDate: '2025-01-10', ...hltb(30, 40, 50) }),
      game('Out short', { releaseDate: '2026-11-08', ...hltb(6, 9, 12) }),
      game('Out, no times', { releaseDate: '2026-02-01' }),
    ];
    expect(names([...wishlist].sort(compareBy('hltb-main', 'wishlist', today)))).toEqual([
      'Out short',
      'Out long',
      'Coming',
      'Out, no times',
    ]);
  });

  it('shows the three times in whole hours on the cover, "–" for one not typed in', () => {
    expect(hltbHours({ main: 23.5, extra: 40.2, completionist: 80 })).toEqual(['24', '40', '80']);
    expect(hltbHours({ main: 12, extra: null, completionist: 45 })).toEqual(['12', '–', '45']);
    expect(hltbHours({ main: 0.25, extra: 1, completionist: null })).toEqual(['<1', '1', '–']);
    expect(hltbHours({ main: null, extra: null, completionist: null })).toEqual([]);
    expect(hltbHours(null)).toEqual([]);
    expect(hltbHours(undefined)).toEqual([]);
  });
});

describe('HowLongToBeat on the covers', () => {
  const times = { hltb: { main: 12, extra: 24, completionist: 31 } };

  it('puts your time over the time that matches how far you got (a Platinum is Completionist)', () => {
    const done = (completion: TrackedGame['completion']) =>
      coverHltb(game('Done', { status: 'completed', hoursPlayed: 34.4, completion, ...times }), today);
    expect(done('platinum')).toEqual({
      cells: ['12', '24', '31'],
      mine: '34',
      platinum: true,
      mineColumn: 6,
    });
    expect(done('main_sides')?.mineColumn).toBe(4);
    expect(done('main_sides')?.platinum).toBe(false);
    expect(done('main')?.mineColumn).toBe(2);
  });

  it('puts your time over the logo without a completion style', () => {
    const playing = game('Playing', {
      status: 'backlog',
      playing: true,
      hoursPlayed: 5,
      completion: null,
      ...times,
    });
    expect(coverHltb(playing, today)).toEqual({
      cells: ['12', '24', '31'],
      mine: '5',
      platinum: false,
      mineColumn: 1,
    });
  });

  it('shows no time of yours where the cover never shows it, or without one', () => {
    const notPlaying = game('Backlog', { status: 'backlog', hoursPlayed: 3, ...times });
    expect(coverHltb(notPlaying, today)?.mine).toBeNull();
    const unplayed = game('Shelved', { status: 'shelved', hoursPlayed: null, ...times });
    expect(coverHltb(unplayed, today)?.mine).toBeNull();
  });

  it('puts a Platinum’s trophy over Completionist, even without a time of yours', () => {
    const plat = game('Plat', {
      status: 'completed',
      completion: 'platinum',
      hoursPlayed: null,
      ...times,
    });
    expect(coverHltb(plat, today)).toEqual({
      cells: ['12', '24', '31'],
      mine: null,
      platinum: true,
      mineColumn: 6,
    });
  });

  it('shows nothing without any time, or on a Wishlist game not out yet', () => {
    expect(coverHltb(game('None', { status: 'completed', hoursPlayed: 10 }), today)).toBeNull();
    const coming = game('Coming', { status: 'wishlist', releaseDate: '2027-01-01', ...times });
    expect(coverHltb(coming, today)).toBeNull();
    const out = game('Out', { status: 'wishlist', releaseDate: '2026-01-01', ...times });
    expect(coverHltb(out, today)?.cells).toEqual(['12', '24', '31']);
  });
});

describe('the Events tab', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const hour = 3_600_000;
  const event = (title: string, startsAt: number, extra: Partial<GamingEvent> = {}) =>
    ({ id: title, title, startsAt, durationMinutes: 60, ...extra }) as GamingEvent;

  it('splits the events into the ones to come, soonest first, the ones that are over, and archived', () => {
    const { upcoming, past, archived } = splitEvents(
      [
        event('Over', now - 48 * hour),
        event('Later', now + 300 * hour),
        event('On now', now - 0.5 * hour),
        event('Soon', now + 20 * hour),
        event('Archived', now + 10 * hour, { archived: true }),
        event('Archived past', now - 10 * hour, { archived: true }),
      ],
      now,
    );
    expect(upcoming.map((e) => e.title)).toEqual(['On now', 'Soon', 'Later']);
    expect(past.map((e) => e.title)).toEqual(['Over']);
    expect(archived.map((e) => e.title)).toEqual(['Archived', 'Archived past']);
  });
});

describe('browseOrder', () => {
  const g = (igdbId: number) => ({ igdbId }) as TrackedGame;
  it('is the games in the order shown, leaving out folded years', () => {
    const groups = [
      { key: '2026', title: '', games: [g(1), g(2)] },
      { key: '2025', title: '', games: [g(3)] },
      { key: '2024', title: '', games: [g(4), g(5)] },
    ];
    expect(browseOrder(groups, [], (key) => key === '2025')).toEqual([1, 2, 4, 5]);
    expect(browseOrder(null, [g(9), g(8)], () => true)).toEqual([9, 8]);
  });
});
