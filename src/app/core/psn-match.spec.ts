import {
  comparableName,
  durationSeconds,
  groupPlayed,
  linkTrophyLists,
  matchProfile,
  type PsnPlayedTitle,
  type PsnTrophyTitle,
} from '../../../api/_lib/psn-match.js';

const title = (
  titleId: string,
  conceptId: number,
  name: string,
  category: string,
  playDuration: string,
  first = '2024-05-07T10:00:00Z',
): PsnPlayedTitle => ({
  titleId,
  name,
  category,
  concept: { id: conceptId, name },
  playDuration,
  firstPlayedDateTime: first,
  lastPlayedDateTime: first,
});

describe('PlayStation games', () => {
  it('reads PlayStation durations', () => {
    expect(durationSeconds('PT228H56M33S')).toBe(228 * 3600 + 56 * 60 + 33);
    expect(durationSeconds('PT31M4S')).toBe(31 * 60 + 4);
    expect(durationSeconds('PT1S')).toBe(1);
    expect(durationSeconds(undefined)).toBe(0);
  });

  it('adds up PS4 and PS5, counts only the longest version per console (not the demo), skips apps', () => {
    const games = groupPlayed([
      title('PPSA13197_00', 1, 'Stellar Blade™', 'ps5_native_game', 'PT51H21M24S'),
      title(
        'PPSA18488_00',
        1,
        'Stellar Blade™',
        'ps5_native_game',
        'PT1H25M56S',
        '2024-04-17T10:00:00Z',
      ),
      title('PPSA15508_00', 2, 'The Last of Us™ Part II', 'ps5_native_game', 'PT35H17M47S'),
      title(
        'CUSA10249_00',
        2,
        'The Last of Us™ Part II',
        'ps4_game',
        'PT30H49M59S',
        '2020-06-19T10:00:00Z',
      ),
      title('PPSA05688_00', 3, 'Spotify', 'ps5_web_based_media_app', 'PT1S'),
    ]);
    expect(games.map((g) => [g.conceptId, g.playSeconds, g.titleIds.length])).toEqual([
      [1, 51 * 3600 + 21 * 60 + 24, 1], // the demo is left out completely, its id too
      [2, 66 * 3600 + 7 * 60 + 46, 2],
    ]);
    // First played: the earliest of the versions that count (the demo doesn't).
    expect(new Date(games[1].firstPlayedAt!).toISOString().slice(0, 10)).toBe('2020-06-19');
    expect(new Date(games[0].firstPlayedAt!).toISOString().slice(0, 10)).toBe('2024-05-07');
  });

  it('leaves out anything named a demo, trial or playtest', () => {
    const games = groupPlayed([
      title('PPSA00001_00', 7, 'Saros Demo', 'ps5_native_game', 'PT2H'),
      title('PPSA00002_00', 8, 'Marathon Playtest', 'ps5_native_game', 'PT3H'),
      title('PPSA00003_00', 9, 'Saros', 'ps5_native_game', 'PT29H'),
    ]);
    expect(games.map((g) => g.name)).toEqual(['Saros']);
  });

  it('compares names without ™, accents, version words or roman numerals', () => {
    expect(comparableName('Warhammer 40,000: Space Marine II')).toBe(
      comparableName('Warhammer 40,000: Space Marine 2'),
    );
    expect(comparableName('Kena: Bridge of Spirits PS4 & PS5')).toBe('kena bridge of spirits');
    expect(comparableName('Titanfall® 2 Trophies')).toBe('titanfall 2');
    expect(comparableName('Ghost of Yōtei')).toBe('ghost of yotei');
    expect(comparableName('Marvel’s Spider-Man™')).toBe('marvels spider man');
  });
});

describe('matching to the library', () => {
  const library = [
    { igdbId: 10, name: 'Stellar Blade', releaseDate: '2024-04-26' },
    { igdbId: 20, name: 'The Last of Us Part II Remastered', releaseDate: '2024-01-19' },
    { igdbId: 30, name: 'Uncharted 2: Among Thieves Remastered', releaseDate: '2016-04-08' },
    { igdbId: 31, name: "Uncharted 3: Drake's Deception Remastered", releaseDate: '2016-04-08' },
    { igdbId: 40, name: 'Resident Evil 4', releaseDate: '2005-01-11' },
    { igdbId: 41, name: 'Resident Evil 4', releaseDate: '2023-03-24' },
  ];
  const games = groupPlayed([
    title('PPSA13197_00', 1, 'Stellar Blade™', 'ps5_native_game', 'PT51H'),
    title('PPSA15508_00', 2, 'The Last of Us™ Part II', 'ps5_native_game', 'PT35H'),
    title('CUSA02320_00', 3, 'Uncharted™: The Nathan Drake Collection', 'ps4_game', 'PT1H'),
    title('PPSA04000_00', 4, 'Resident Evil 4', 'ps5_native_game', 'PT52H', '2023-04-01T10:00:00Z'),
    title('CUSA00001_00', 5, 'Fall Guys', 'ps4_game', 'PT8M'),
  ]);
  const lists: PsnTrophyTitle[] = [
    { npCommunicationId: 'NPWR1', trophyTitleName: 'Stellar Blade', trophyTitlePlatform: 'PS5' },
    {
      npCommunicationId: 'NPWR2',
      trophyTitleName: 'The Last of Us™ Part II Remastered',
      trophyTitlePlatform: 'PS5',
    },
    {
      npCommunicationId: 'NPWR3',
      trophyTitleName: 'Uncharted 2: Among Thieves™ Remastered',
      trophyTitlePlatform: 'PS4',
    },
    {
      npCommunicationId: 'NPWR4',
      trophyTitleName: 'Uncharted 3: Drake’s Deception™ Remastered',
      trophyTitlePlatform: 'PS4',
    },
  ];

  it('matches by store id, then name, then trophy list names, picking the right remake', () => {
    // PlayStation said, asked by title id, which lists the remaster and the collection have.
    const links = linkTrophyLists(
      games,
      lists,
      new Map([
        ['PPSA15508_00', ['NPWR2']],
        ['CUSA02320_00', ['NPWR3', 'NPWR4']],
      ]),
    );
    const { matches, listsByGame } = matchProfile(
      { games, lists, links, storeIds: new Map([[1, [99, 10]]]) },
      library,
    );
    expect(matches.map((m) => [m.conceptId, m.igdbId, m.by])).toEqual([
      [1, 10, 'store'],
      [2, 20, 'name'], // through its list "The Last of Us Part II Remastered"
      [3, 30, 'name'], // the collection, through its first list
      [4, 41, 'name'], // the remake: out before it was first played (2023)
      [5, null, null],
    ]);
    // Each list goes to the game with its name: the collection's lists to each Uncharted.
    expect(Object.fromEntries(listsByGame)).toEqual({
      10: ['NPWR1'],
      20: ['NPWR2'],
      30: ['NPWR3'],
      31: ['NPWR4'],
    });
  });
});
