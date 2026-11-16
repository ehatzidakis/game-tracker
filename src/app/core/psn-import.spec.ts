import type { IgdbSyncGame } from '../../../api/_lib/igdb-sync.js';
import { defaultChoice, importedGame, type ImportRecord } from '../../../api/_lib/psn-import.js';

const now = Date.parse('2026-11-16T12:00:00Z');
const firstPlayed = Date.parse('2024-03-01T20:00:00Z');
const lastPlayed = Date.parse('2024-05-20T22:00:00Z');

const igdb: IgdbSyncGame = {
  id: 1942,
  name: 'The Witcher 3: Wild Hunt',
  slug: 'the-witcher-3-wild-hunt',
  cover: { image_id: 'co1wyy' },
  platforms: [48, 167],
  release_dates: [{ platform: 48, date: 1431993600, date_format: 0, release_region: 8 }],
};
const record = (extra: Partial<ImportRecord> = {}): ImportRecord => ({
  platform: 'ps5',
  firstPlayedAt: firstPlayed,
  lastPlayedAt: lastPlayed,
  platinumEarned: false,
  ...extra,
});

describe('defaultChoice', () => {
  it('puts a game with its Platinum earned in Completed, the rest in the Backlog', () => {
    expect(defaultChoice(record({ platinumEarned: true }))).toEqual({
      status: 'completed',
      completion: 'platinum',
    });
    expect(defaultChoice(record())).toEqual({ status: 'backlog', completion: null });
  });
});

describe('importedGame', () => {
  it('takes IGDB’s details and PlayStation’s platform and dates', () => {
    const game = importedGame(
      igdb,
      record(),
      { conceptId: 1, igdbId: 1942, status: 'backlog' },
      now,
    );
    expect(game).toMatchObject({
      igdbId: 1942,
      name: 'The Witcher 3: Wild Hunt',
      coverId: 'co1wyy',
      myPlatform: 'ps5',
      status: 'backlog',
      completion: null,
      hoursPlayed: null,
      purchasedAt: firstPlayed,
      startedAt: firstPlayed,
      shelvedAt: null,
      completedAt: null,
      addedAt: now,
    });
  });

  it('leaves the completed date to the sync for a Platinum you earned', () => {
    const game = importedGame(
      igdb,
      record({ platinumEarned: true }),
      { conceptId: 1, igdbId: 1942, status: 'completed' },
      now,
    );
    expect(game.completion).toBe('platinum');
    expect(game.completedAt).toBeNull();
  });

  it('completes a game you mark yourself on the last day you played it, as Main story', () => {
    const game = importedGame(
      igdb,
      record(),
      { conceptId: 1, igdbId: 1942, status: 'completed', rating: 8.5 },
      now,
    );
    expect(game).toMatchObject({ completion: 'main', completedAt: lastPlayed, rating: 8.5 });
  });

  it('shelves a game on the last day you played it', () => {
    const game = importedGame(
      igdb,
      record(),
      { conceptId: 1, igdbId: 1942, status: 'shelved' },
      now,
    );
    expect(game).toMatchObject({ status: 'shelved', shelvedAt: lastPlayed, completedAt: null });
  });

  it('keeps the purchase details you gave, and the day you bought it', () => {
    const game = importedGame(
      igdb,
      record(),
      {
        conceptId: 1,
        igdbId: 1942,
        status: 'backlog',
        pricePaid: 29.99,
        boughtFrom: 'PlayStation Store',
        orderedOn: '2024-02-14',
        physical: true,
      },
      now,
    );
    expect(game).toMatchObject({
      pricePaid: 29.99,
      boughtFrom: 'PlayStation Store',
      orderedOn: '2024-02-14',
      physical: true,
      purchasedAt: Date.parse('2024-02-14T12:00:00Z'),
    });
  });

  it('uses PS4 for a game only played on PS4, and today when PlayStation has no dates', () => {
    const game = importedGame(
      igdb,
      { platform: 'ps4', firstPlayedAt: null, lastPlayedAt: null },
      { conceptId: 1, igdbId: 1942, status: 'shelved' },
      now,
    );
    expect(game).toMatchObject({
      myPlatform: 'ps4',
      purchasedAt: now,
      shelvedAt: now,
      startedAt: null,
    });
  });
});
