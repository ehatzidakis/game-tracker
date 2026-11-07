import { buildNameQuery, buildSearchQuery, rankSearchResults, toSearchResult } from './igdb';

describe('buildSearchQuery', () => {
  it('escapes quotes so a search term cannot break out of the query', () => {
    expect(buildSearchQuery('say "hi"')).toContain('search "say \\"hi\\"";');
  });

  it('trims the term and leaves out DLC and bundles', () => {
    const query = buildSearchQuery('  zelda ');
    expect(query).toContain('search "zelda";');
    expect(query).toContain('game_type = (0,4,8,9,10,11)');
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
    expect(result.platforms).toEqual(['PS5', 'PC']);
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
