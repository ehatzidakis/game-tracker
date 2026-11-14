import type { TrackedGame } from '../../../api/_lib/models.js';
import type { PsnGame, PsnMatch } from '../../../api/_lib/psn-match.js';
import {
  pickTrophyList,
  platinumMoves,
  platinumUpdate,
  psnUpdates,
  shouldAlert,
  type TrophyListData,
} from '../../../api/_lib/psn-sync.js';

const now = Date.parse('2026-11-14T12:00:00Z');
const counts = (bronze: number, silver: number, gold: number, platinum: number) => ({
  bronze,
  silver,
  gold,
  platinum,
});

const game = (igdbId: number, extra: Partial<TrackedGame> = {}) =>
  ({
    igdbId,
    name: `Game ${igdbId}`,
    myPlatform: 'ps5',
    hoursPlayed: null,
    ...extra,
  }) as TrackedGame;
const psnGame = (conceptId: number, hours: number, last = '2026-11-01T20:00:00Z'): PsnGame => ({
  conceptId,
  name: `PSN ${conceptId}`,
  titleIds: [],
  playSeconds: hours * 3600,
  firstPlayedAt: Date.parse('2026-10-01T20:00:00Z'),
  lastPlayedAt: Date.parse(last),
});
const list = (id: string, platform: string, progress: number): TrophyListData => ({
  npCommunicationId: id,
  trophyTitlePlatform: platform,
  progress,
  definedTrophies: counts(40, 10, 3, 1),
  earnedTrophies: counts(30, 6, 1, 0),
  lastUpdatedDateTime: '2026-11-01T21:00:00Z',
});
const match = (conceptId: number, igdbId: number | null): PsnMatch => ({
  conceptId,
  igdbId,
  by: 'store',
});

describe('PlayStation sync updates', () => {
  it('replaces your hours with PlayStation’s, keeping yours the first time, and adds the trophies', () => {
    const updates = psnUpdates(
      [game(1, { hoursPlayed: 40.5 })],
      [psnGame(100, 45.5)],
      [match(100, 1)],
      [list('NPWR1', 'PS5', 72)],
      new Map([[1, ['NPWR1']]]),
      now,
    );
    expect(updates.get(1)).toEqual({
      hoursPlayed: 45.5,
      hoursPlayedManual: 40.5,
      playstation: {
        playSeconds: 45.5 * 3600,
        firstPlayedAt: Date.parse('2026-10-01T20:00:00Z'),
        lastPlayedAt: Date.parse('2026-11-01T20:00:00Z'),
        trophies: {
          earned: counts(30, 6, 1, 0),
          defined: counts(40, 10, 3, 1),
          progress: 72,
          lastEarnedAt: Date.parse('2026-11-01T21:00:00Z'),
          platform: 'PS5',
        },
        syncedAt: now,
      },
    });
  });

  it('adds up every PlayStation game matched to one library game (the CoD launcher and the game)', () => {
    const updates = psnUpdates(
      [game(1)],
      [psnGame(100, 3), psnGame(101, 11.5, '2026-10-20T10:00:00Z')],
      [match(100, 1), match(101, 1)],
      [],
      new Map(),
      now,
    );
    expect(updates.get(1)?.hoursPlayed).toBe(14.5);
    // Nothing typed in before: nothing to keep.
    expect(updates.get(1)?.hoursPlayedManual).toBeUndefined();
    expect(updates.get(1)?.playstation?.lastPlayedAt).toBe(Date.parse('2026-11-01T20:00:00Z'));
  });

  it('rounds PlayStation’s time down to the minute, as PlayStation shows it', () => {
    const g = psnGame(100, 0);
    g.playSeconds = 113 * 3600 + 9 * 60 + 33;
    const update = psnUpdates([game(1)], [g], [match(100, 1)], [], new Map(), now).get(1)!;
    expect(update.hoursPlayed).toBe((113 * 60 + 9) / 60);
    // Already what you typed: no change.
    const typed = game(1, { hoursPlayed: (113 * 60 + 9) / 60 });
    expect(
      psnUpdates([typed], [g], [match(100, 1)], [], new Map(), now).get(1)?.hoursPlayed,
    ).toBeUndefined();
  });

  it('never writes 0 hours over yours, and changes nothing when nothing changed', () => {
    const first = psnUpdates(
      [game(1, { hoursPlayed: 12 })],
      [psnGame(100, 0)],
      [match(100, 1)],
      [],
      new Map(),
      now,
    ).get(1)!;
    expect(first.hoursPlayed).toBeUndefined();
    expect(first.playstation?.playSeconds).toBe(0);

    // The same again later: no update at all.
    const synced = game(1, { hoursPlayed: 12, playstation: first.playstation });
    expect(
      psnUpdates([synced], [psnGame(100, 0)], [match(100, 1)], [], new Map(), now + 1000).size,
    ).toBe(0);
  });

  it('keeps only your first hours: later PlayStation changes don’t overwrite the backup', () => {
    const synced = game(1, {
      hoursPlayed: 45.5,
      hoursPlayedManual: 40.5,
      playstation: { playSeconds: 45.5 * 3600 } as TrackedGame['playstation'],
    });
    const update = psnUpdates([synced], [psnGame(100, 50)], [match(100, 1)], [], new Map(), now);
    expect(update.get(1)?.hoursPlayed).toBe(50);
    expect(update.get(1)?.hoursPlayedManual).toBeUndefined();
  });

  it('drops the PlayStation block of a game no longer matched, but never its hours', () => {
    const was = game(1, {
      hoursPlayed: 20,
      playstation: { playSeconds: 72000 } as TrackedGame['playstation'],
    });
    const update = psnUpdates(
      [was, game(2)],
      [psnGame(100, 5)],
      [match(100, null)],
      [],
      new Map(),
      now,
    );
    expect(update.get(1)).toEqual({ playstation: null });
    // Never matched, nothing there: untouched.
    expect(update.has(2)).toBe(false);
  });

  it('shows the trophy list for your platform, else the one furthest along', () => {
    const ps4 = list('A', 'PS4', 90);
    const ps5 = list('B', 'PS5,PSPC', 20);
    expect(pickTrophyList([ps4, ps5], 'ps5')?.npCommunicationId).toBe('B');
    expect(pickTrophyList([ps4, ps5], 'pc')?.npCommunicationId).toBe('A');
    expect(pickTrophyList([], 'ps5')).toBeNull();
  });
});

describe('a Platinum completes its game', () => {
  const plat = (id: string, platinum: number, platform = 'PS5'): TrophyListData => ({
    ...list(id, platform, platinum ? 100 : 60),
    earnedTrophies: counts(40, 10, 3, platinum),
    npServiceName: platform === 'PS5' ? 'trophy2' : 'trophy',
  });

  it('finds games with a Platinum that aren’t Completed with Platinum yet', () => {
    const library = [
      game(1, { status: 'backlog', playing: true }),
      game(2, { status: 'completed', completion: 'main' }),
      game(3, { status: 'completed', completion: 'platinum' }),
      game(4, { status: 'shelved' }),
    ];
    const moves = platinumMoves(
      library,
      [plat('A', 1), plat('B', 1, 'PS4'), plat('C', 1), plat('D', 0)],
      new Map([
        [1, ['A']],
        [2, ['B']],
        [3, ['C']],
        [4, ['D']],
      ]),
    );
    expect(moves).toEqual([
      { igdbId: 1, listId: 'A', serviceName: 'trophy2', completes: true },
      { igdbId: 2, listId: 'B', serviceName: 'trophy', completes: false },
    ]);
  });

  it('moves it to Completed on the day of the Platinum, and stops Playing', () => {
    const platinumAt = Date.parse('2026-11-10T21:30:00Z');
    expect(platinumUpdate(game(1, { status: 'backlog', playing: true }), platinumAt, now)).toEqual({
      status: 'completed',
      completion: 'platinum',
      completedAt: platinumAt,
      purchasedAt: platinumAt,
      playing: false,
      updatedAt: now,
    });
  });

  it('only raises how far you got on a game already Completed, keeping its date', () => {
    const done = game(2, { status: 'completed', completion: 'main', completedAt: 5 });
    expect(platinumUpdate(done, Date.parse('2026-11-10T21:30:00Z'), now)).toEqual({
      completion: 'platinum',
      updatedAt: now,
    });
  });
});

describe('telling you the sync isn’t working', () => {
  const hour = 3_600_000;
  it('tells you right away when the sign-in needs a new token, once per outage', () => {
    expect(shouldAlert({ lastOkAt: now - hour }, true, now)).toBe(true);
    expect(shouldAlert({ lastOkAt: now - hour, alertedAt: now - 1 }, true, now)).toBe(false);
  });

  it('waits a day before telling you about other failures', () => {
    expect(shouldAlert({ lastOkAt: now - 8 * hour }, false, now)).toBe(false);
    expect(shouldAlert({ lastOkAt: now - 25 * hour }, false, now)).toBe(true);
    // Never worked yet (just linked): nothing to compare with.
    expect(shouldAlert(undefined, false, now)).toBe(false);
  });
});
