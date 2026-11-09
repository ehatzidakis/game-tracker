import {
  normalizeGame,
  preorderArrived,
  shownInLibrary,
  type TrackedGame,
} from '../../../api/_lib/models.js';

describe('shownInLibrary', () => {
  it('lists games, and DLC only while it is on the wishlist', () => {
    expect(shownInLibrary({ status: 'completed', parentId: null })).toBe(true);
    expect(shownInLibrary({ status: 'wishlist', parentId: 5 })).toBe(true);
    expect(shownInLibrary({ status: 'backlog', parentId: 5 })).toBe(false);
    expect(shownInLibrary({ status: 'completed', parentId: 5 })).toBe(false);
  });
});

describe('preorderArrived', () => {
  const game = (extra: object) =>
    ({
      status: 'wishlist',
      preordered: true,
      releaseDate: '2026-11-19',
      releasePrecision: 'day',
      ...extra,
    }) as Parameters<typeof preorderArrived>[0];

  it('is due from the release day on, only for wishlisted pre-orders with an exact day', () => {
    expect(preorderArrived(game({}), '2026-11-18')).toBe(false);
    expect(preorderArrived(game({}), '2026-11-19')).toBe(true);
    expect(preorderArrived(game({}), '2026-11-25')).toBe(true);
    expect(preorderArrived(game({ preordered: false }), '2026-11-19')).toBe(false);
    expect(preorderArrived(game({ status: 'backlog' }), '2026-11-19')).toBe(false);
    expect(preorderArrived(game({ releasePrecision: 'month' }), '2026-12-01')).toBe(false);
  });
});

describe('normalizeGame', () => {
  it('reads the old Playing status as Backlog with Playing on', () => {
    const old = { igdbId: 1, status: 'playing' } as unknown as TrackedGame;
    expect(normalizeGame(old)).toMatchObject({ status: 'backlog', playing: true });
    const fine = { igdbId: 2, status: 'shelved' } as TrackedGame;
    expect(normalizeGame(fine)).toBe(fine);
  });
});
