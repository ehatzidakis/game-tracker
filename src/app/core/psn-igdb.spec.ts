import {
  IGDB_RETRY_MS,
  isPart,
  needsLookup,
  pickIgdbGame,
  platinumOf,
  psnPlatform,
  searchTerm,
  type IgdbCandidate,
} from '../../../api/_lib/psn-igdb.js';

const now = Date.parse('2026-11-16T12:00:00Z');
const game = (id: number, name: string, game_type = 0, cover?: string): IgdbCandidate => ({
  id,
  name,
  game_type,
  ...(cover ? { cover: { image_id: cover } } : {}),
});

describe('pickIgdbGame', () => {
  it('takes the game IGDB lists for the PlayStation Store id, with its cover', () => {
    expect(pickIgdbGame('Horizon Zero Dawn™', [game(1, 'Horizon Zero Dawn', 0, 'abc')])).toEqual({
      id: 1,
      name: 'Horizon Zero Dawn',
      coverId: 'abc',
    });
  });

  it('prefers the same name, then the main game, among store matches', () => {
    const picked = pickIgdbGame('Shadow of the Tomb Raider', [
      game(1, 'Shadow of the Tomb Raider: Definitive Edition', 0),
      game(2, 'Shadow of the Tomb Raider', 0),
    ]);
    expect(picked?.id).toBe(2);
    expect(pickIgdbGame('Some Game', [game(1, 'Other Name', 9), game(2, 'Other', 0)])?.id).toBe(2);
  });

  it('never picks DLC, a pack or an update', () => {
    expect(pickIgdbGame('X', [game(1, 'X', 1), game(2, 'X', 13), game(3, 'X', 14)])).toBeNull();
  });

  it('lets a game with exactly the name win over a store match that is only an episode', () => {
    const picked = pickIgdbGame(
      'Life Is Strange™',
      [game(1, 'Life is Strange: Episode 1 - Chrysalis', 6)],
      [game(2, 'Life Is Strange 2', 0), game(3, 'Life Is Strange', 0)],
    );
    expect(picked?.name).toBe('Life Is Strange');
  });

  it('keeps the episode when the search has nothing better', () => {
    expect(pickIgdbGame('Life Is Strange', [game(1, 'Life is Strange: Episode 1', 6)])?.id).toBe(1);
    expect(isPart(game(1, 'x', 6))).toBe(true);
    expect(isPart(game(1, 'x', 0))).toBe(false);
  });

  it('only takes a searched game with the same name, never a sequel or spin-off', () => {
    const results = [
      game(1, "Marvel's Spider-Man: The Heist", 1),
      game(2, "Marvel's Spider-Man 2", 0),
      game(3, "Marvel's Spider-Man", 0),
      game(4, "Marvel's Spider-Man: Miles Morales", 4),
    ];
    expect(pickIgdbGame('Marvel’s Spider-Man', [], results)?.id).toBe(3);
    expect(pickIgdbGame('Marvel’s Spider-Man 3', [], results)).toBeNull();
  });

  it('matches a searched game without the edition in its name', () => {
    expect(pickIgdbGame('Celeste Deluxe Edition', [], [game(1, 'Celeste', 0)])?.id).toBe(1);
    expect(pickIgdbGame('Celeste Remastered', [], [game(1, 'Celeste', 0)])).toBeNull();
  });

  it('takes a bundle only with exactly its name', () => {
    const results = [game(1, 'Crash Bandicoot N. Sane Trilogy', 3), game(2, 'Crash Bandicoot', 0)];
    expect(pickIgdbGame('Crash Bandicoot N. Sane Trilogy', [], results)?.id).toBe(1);
    expect(pickIgdbGame('METRO Redux', [game(5, 'Metro Redux', 3)])?.id).toBe(5);
    expect(pickIgdbGame('Metro Collection', [game(5, 'Metro Redux', 3)])).toBeNull();
  });

  it('is null when nothing fits', () => {
    expect(pickIgdbGame('Unknown Game', [], [])).toBeNull();
  });
});

describe('needsLookup', () => {
  it('asks about games never looked up', () => {
    expect(needsLookup(undefined, now)).toBe(true);
    expect(needsLookup({}, now)).toBe(true);
  });

  it('keeps what was found, and asks again a week after IGDB had nothing', () => {
    expect(needsLookup({ igdb: { id: 1, name: 'X', coverId: null }, igdbCheckedAt: 0 }, now)).toBe(
      false,
    );
    expect(needsLookup({ igdb: null, igdbCheckedAt: now - IGDB_RETRY_MS + 1 }, now)).toBe(false);
    expect(needsLookup({ igdb: null, igdbCheckedAt: now - IGDB_RETRY_MS }, now)).toBe(true);
  });
});

describe('searchTerm', () => {
  it('drops ™ and "PS4 & PS5", and quotes the name for IGDB', () => {
    expect(searchTerm('Horizon Zero Dawn™')).toBe('"Horizon Zero Dawn"');
    expect(searchTerm('Hogwarts Legacy PS4 & PS5')).toBe('"Hogwarts Legacy"');
    expect(searchTerm('Say "Hi" \\ Bye')).toBe('"Say \\"Hi\\" \\\\ Bye"');
  });
});

describe('psnPlatform', () => {
  it('is PS5 when a PS5 version (PPSA) was played, else PS4', () => {
    expect(psnPlatform({ titleIds: ['CUSA01234', 'PPSA05678'] })).toBe('ps5');
    expect(psnPlatform({ titleIds: ['CUSA01234'] })).toBe('ps4');
  });
});

describe('platinumOf', () => {
  const counts = (platinum: number) => ({ bronze: 0, silver: 0, gold: 0, platinum });
  const list = (id: string, defined: number, earned: number) => ({
    npCommunicationId: id,
    trophyTitleName: id,
    trophyTitlePlatform: 'PS5',
    definedTrophies: counts(defined),
    earnedTrophies: counts(earned),
  });
  const links = new Map([
    ['A', 1],
    ['B', 1],
    ['C', 2],
  ]);

  it('looks at every trophy list linked to the game', () => {
    expect(platinumOf(1, [list('A', 1, 0), list('B', 1, 1)], links)).toEqual({
      hasPlatinum: true,
      platinumEarned: true,
    });
    expect(platinumOf(2, [list('C', 0, 0)], links)).toEqual({
      hasPlatinum: false,
      platinumEarned: false,
    });
    expect(platinumOf(3, [list('A', 1, 1)], links)).toEqual({
      hasPlatinum: false,
      platinumEarned: false,
    });
  });
});
