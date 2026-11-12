import {
  buildEventQuery,
  buildEventSearchQuery,
  buildGameEventsQuery,
  buildUpcomingEventsQuery,
  remakeOf,
  buildDiscoverQuery,
  linksOf,
  seriesOf,
  buildNameQuery,
  buildSearchQuery,
  rankSearchResults,
  toSearchResult,
} from './igdb';

describe('buildSearchQuery', () => {
  it('escapes quotes so a search term cannot break out of the query', () => {
    expect(buildSearchQuery('say "hi"')).toContain('search "say \\"hi\\"";');
  });

  it('trims the term and leaves out DLC and bundles', () => {
    const query = buildSearchQuery('  zelda ');
    expect(query).toContain('search "zelda";');
    expect(query).toContain('game_type = (0,1,2,4,8,9,10,11)');
  });
});

describe('toSearchResult', () => {
  it('lists our platforms first in a fixed order, then fills up to two with others', () => {
    const result = toSearchResult({
      id: 1,
      name: 'Game',
      first_release_date: 1_748_563_200,
      platforms: [
        { id: 48, abbreviation: 'PS4', name: 'PlayStation 4' },
        { id: 6, abbreviation: 'PC', name: 'PC' },
        { id: 167, abbreviation: 'PS5', name: 'PlayStation 5' },
      ],
    });
    expect(result.platforms).toEqual(['PS5', 'PS4', 'PC']);
    expect(result.year).toBe(2025);
    expect(result.coverId).toBeNull();
  });

  it('shows other platforms when none of ours match', () => {
    const result = toSearchResult({
      id: 2,
      name: 'Old game',
      platforms: [
        { id: 18, abbreviation: 'NES', name: 'NES' },
        { id: 5, abbreviation: 'Wii', name: 'Wii' },
        { id: 41, abbreviation: 'WiiU', name: 'Wii U' },
      ],
    });
    expect(result.platforms).toEqual(['NES', 'Wii']);
    expect(result.year).toBeNull();
  });
});

describe('rankSearchResults', () => {
  const year = (y: number) => Date.UTC(y, 0, 1) / 1000;
  const names = (games: { name: string }[]) => games.map((g) => g.name);

  it('puts well-known matches first, newest first, then obscure ones, then loose matches', () => {
    const searchHits = [
      { id: 1, name: 'God of War', first_release_date: year(2005), total_rating_count: 1070 },
      { id: 2, name: 'God Wars', first_release_date: year(2025) },
      {
        id: 3,
        name: 'God of War Ragnarök',
        first_release_date: year(2022),
        total_rating_count: 1202,
      },
    ];
    const nameHits = [
      { id: 4, name: 'God of War Laufey', first_release_date: year(2027), hypes: 115 },
      { id: 5, name: 'Martial Arts: God of War', first_release_date: year(2024) },
      {
        id: 3,
        name: 'God of War Ragnarök',
        first_release_date: year(2022),
        total_rating_count: 1202,
      },
    ];
    expect(names(rankSearchResults('God of War', searchHits, nameHits))).toEqual([
      'God of War Laufey',
      'God of War Ragnarök',
      'God of War',
      'Martial Arts: God of War',
      'God Wars',
    ]);
  });

  it('matches other names, ignores accents, and sends undated and cancelled games down', () => {
    const ranked = rankSearchResults(
      'gta',
      [
        { id: 1, name: 'GTA Remake', hypes: 50 },
        { id: 2, name: 'GTA Fan Game', game_status: 6, hypes: 50, first_release_date: year(2026) },
        {
          id: 3,
          name: 'Grand Theft Auto VI',
          alternative_names: [{ name: 'GTA 6' }],
          hypes: 1129,
          first_release_date: year(2026),
        },
        {
          id: 4,
          name: 'Grand Theft Auto V',
          alternative_names: [{ name: 'GTA V' }],
          total_rating_count: 4000,
          first_release_date: year(2013),
        },
      ],
      [],
    );
    expect(names(ranked)).toEqual([
      'Grand Theft Auto VI',
      'Grand Theft Auto V',
      'GTA Remake',
      'GTA Fan Game',
    ]);
    expect(
      names(rankSearchResults('ragnarok', [{ id: 9, name: 'Ragnarök', hypes: 20 }], [])),
    ).toEqual(['Ragnarök']);
  });

  it('only matches from the start of a word', () => {
    const ranked = rankSearchResults(
      'zelda',
      [
        { id: 1, name: 'Grizelda', hypes: 50, first_release_date: year(2026) },
        { id: 2, name: 'Zelda', hypes: 50, first_release_date: year(1986) },
      ],
      [],
    );
    expect(names(ranked)).toEqual(['Zelda', 'Grizelda']);
  });
});

describe('buildNameQuery', () => {
  it('finds names containing the term, newest first', () => {
    const query = buildNameQuery('god "of" war');
    expect(query).toContain('where name ~ *"god \\"of\\" war"*');
    expect(query).toContain('sort first_release_date desc;');
  });
});

describe('rankSearchResults with DLC', () => {
  it('puts DLC of a well-known game right after the games, and matches its main game', () => {
    const year = (y: number) => Date.UTC(y, 0, 1) / 1000;
    const ranked = rankSearchResults(
      'cronos',
      [
        {
          id: 1,
          name: 'Cronos: The New Dawn',
          total_rating_count: 69,
          first_release_date: year(2025),
        },
        {
          id: 2,
          name: 'Cronos: Lazarus',
          game_type: 1,
          hypes: 4,
          first_release_date: year(2026),
          parent_game: { id: 1, name: 'Cronos: The New Dawn', total_rating_count: 69 },
        },
        { id: 3, name: 'Escape from Cronos X', hypes: 1, first_release_date: year(2022) },
      ],
      [],
    );
    expect(ranked.map((g) => g.id)).toEqual([1, 2, 3]);
    expect(toSearchResult(ranked[1]).dlcOf).toEqual({ id: 1, name: 'Cronos: The New Dawn' });
    expect(toSearchResult(ranked[0]).dlcOf).toBeNull();
  });
});

describe('game page extras', () => {
  it('lists the rest of the series without DLC or the game itself, newest first', () => {
    const series = seriesOf({
      id: 1,
      name: 'God of War',
      collections: [
        {
          name: 'God of War',
          games: [
            { id: 1, name: 'God of War', first_release_date: 100 },
            { id: 2, name: 'God of War II', first_release_date: 50 },
            { id: 3, name: 'Valhalla', game_type: 1, first_release_date: 300 },
            { id: 4, name: 'Ragnarök', first_release_date: 200 },
          ],
        },
      ],
    });
    expect(series?.games.map((g) => g.name)).toEqual(['Ragnarök', 'God of War II']);
  });

  it('links the official site and the PlayStation Store, or one other store without it', () => {
    const links = linksOf({
      id: 1,
      name: 'X',
      websites: [
        { url: 'https://store.steampowered.com/app/1', type: { type: 'Steam' } },
        { url: 'https://twitch.tv/x', type: { type: 'Twitch' } },
        { url: 'https://store.playstation.com/x', type: { type: 'Playstation' } },
      ],
    });
    expect(links.map((l) => l.label)).toEqual(['PlayStation Store']);
    const noPs = linksOf({
      id: 1,
      name: 'X',
      websites: [
        { url: 'https://x.com', type: { type: 'Official Website' } },
        { url: 'https://gog.com/x', type: { type: 'GOG' } },
        { url: 'https://store.steampowered.com/app/1', type: { type: 'Steam' } },
        { url: 'https://en.wikipedia.org/x', type: { type: 'Wikipedia' } },
      ],
    });
    expect(noPs.map((l) => l.label)).toEqual(['Official website', 'Steam']);
  });

  it('builds the Search lists for one platform', () => {
    const now = Date.UTC(2026, 10, 8);
    expect(buildDiscoverQuery('anticipated', 167, now)).toContain('sort hypes desc');
    expect(buildDiscoverQuery('soon', 167, now)).toContain('sort first_release_date asc');
    expect(buildDiscoverQuery('recent', 48, now)).toContain('platforms = (48)');
  });
});

describe('remakeOf', () => {
  const original = { id: 481, name: 'Silent Hill 2', first_release_date: 1_001_289_600 };

  it('names the original of a remake or remaster, with its year', () => {
    expect(remakeOf({ game_type: 8, parent_game: original })).toEqual({
      id: 481,
      label: 'Remake of Silent Hill 2 (2001)',
    });
    expect(remakeOf({ game_type: 9, parent_game: { id: 1, name: 'Old' } })).toEqual({
      id: 1,
      label: 'Remaster of Old',
    });
  });

  it('is nothing for main games and DLC, which also have a parent game', () => {
    expect(remakeOf({ game_type: 0 })).toBeNull();
    expect(remakeOf({ game_type: 1, parent_game: original })).toBeNull();
    expect(remakeOf({ game_type: 8 })).toBeNull();
  });
});

describe('event queries', () => {
  it('searches events by name, newest first, escaping the term', () => {
    const query = buildEventSearchQuery(' state of "play" ');
    expect(query).toContain('where name ~ *"state of \\"play\\""* & start_time != null;');
    expect(query).toContain('sort start_time desc;');
  });

  it('asks for events that are not over, soonest first', () => {
    const query = buildUpcomingEventsQuery(1_794_441_600_000);
    expect(query).toContain('where end_time > 1794441600 | start_time > 1794441600;');
    expect(query).toContain('sort start_time asc;');
  });

  it('asks for the events a game was shown at, earliest first', () => {
    const query = buildGameEventsQuery(119133.9);
    expect(query).toContain('where games = (119133) & start_time != null;');
    expect(query).toContain('sort start_time asc;');
  });

  it('asks for one event with the games shown at it', () => {
    const query = buildEventQuery(1170);
    expect(query).toContain('games.name, games.cover.image_id');
    expect(query).toContain('where id = 1170;');
  });
});
