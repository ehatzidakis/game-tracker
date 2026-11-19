import {
  entryFrom,
  isStale,
  lookupRank,
  matchCandidates,
  maxAgeDays,
  sameYear,
  tierFor,
  toScore,
  withOwnScores,
  type OpenCriticEntry,
} from '../../../api/_lib/opencritic-match.js';

const results = [
  { id: 18502, name: 'Elden Ring: Nightreign', dist: 0.5 },
  { id: 12090, name: 'Elden Ring', dist: 0 },
  { id: 7827, name: 'Eden Rising: Supremacy', dist: 0.73 },
];

describe('OpenCritic matching', () => {
  it('picks results with the same name, ignoring case, accents and punctuation', () => {
    expect(matchCandidates(results, ['ELDEN RING']).map((r) => r.id)).toEqual([12090]);
    expect(
      matchCandidates(
        [{ id: 1, name: 'Marvels Spider-Man 2', dist: 0.1 }],
        ["Marvel's Spider-Man™ 2"],
      ).map((r) => r.id),
    ).toEqual([1]);
    // An alternative name from IGDB counts too.
    expect(
      matchCandidates([{ id: 2, name: 'GTA VI', dist: 0.4 }], ['Grand Theft Auto VI', 'GTA VI']),
    ).toHaveLength(1);
  });

  it('falls back to a very close top result, and otherwise finds nothing', () => {
    expect(
      matchCandidates([{ id: 3, name: 'Doom Eternal.', dist: 0.05 }], ['Doom: Eternal']),
    ).toHaveLength(1);
    // Searching "Elden Ring Deluxe Edition": the closest result isn't close enough.
    expect(
      matchCandidates(
        [{ id: 12090, name: 'Elden Ring', dist: 0.4 }],
        ['Elden Ring Deluxe Edition'],
      ),
    ).toEqual([]);
    expect(matchCandidates([], ['Anything'])).toEqual([]);
  });

  it('tells remakes apart by year', () => {
    expect(sameYear('2023-03-24', '2023-03-24T00:00:00.000Z')).toBe(true);
    expect(sameYear('2023-03-24', '2005-01-11T00:00:00.000Z')).toBe(false);
    expect(sameYear(null, '2005-01-11')).toBe(true);
  });

  it('keeps whole scores, and none when there are too few reviews', () => {
    const entry = entryFrom(
      119133,
      {
        id: 12090,
        name: 'Elden Ring',
        tier: 'Mighty',
        topCriticScore: 95.1,
        percentRecommended: 97.13,
      },
      '2022-02-25',
      0,
    );
    expect(toScore(entry)).toMatchObject({
      status: 'found',
      tier: 'Mighty',
      topCriticScore: 95,
      percentRecommended: 97,
    });
    const early = entryFrom(
      1,
      { id: 5, name: 'Soon', tier: '', topCriticScore: -1, percentRecommended: -1 },
      null,
      0,
    );
    expect(toScore(early)).toMatchObject({
      tier: null,
      topCriticScore: null,
      percentRecommended: null,
    });
    expect(toScore(entryFrom(1, null, null, 0))).toEqual({ status: 'none' });
    expect(toScore(null)).toEqual({ status: 'later', limit: false, retryAt: null });
    expect(toScore(null, { limit: true, retryAt: 123 })).toEqual({
      status: 'later',
      limit: true,
      retryAt: 123,
    });
  });
});

describe('scores typed in by hand', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  const matched = entryFrom(
    5,
    {
      id: 77,
      name: 'Wrong Edition',
      url: 'https://opencritic.com/game/77',
      tier: 'Weak',
      topCriticScore: 51,
    },
    '2009-03-01',
    now - 86_400_000,
  );

  it('replaces the critic score (with its tier) and the players’ score, keeping the match', () => {
    const own = withOwnScores(5, matched, { critic: 88, critics: 12, players: 81, users: null }, now);
    expect(own).toMatchObject({
      manual: true,
      topCriticScore: 88,
      tier: 'Mighty',
      playerScore: 81,
    });
    expect(own.ocId).toBe(77);
    expect(toScore(own)).toEqual({
      status: 'found',
      url: null,
      tier: 'Mighty',
      topCriticScore: 88,
      percentRecommended: null,
      numReviews: 12,
      numTopCriticReviews: 12,
      manual: true,
      playerScore: 81,
      playerCount: null,
    });
    // Never due: OpenCritic isn't asked again while they're in.
    expect(isStale(own, now + 1000 * 86_400_000)).toBe(false);
  });

  it('works for a game OpenCritic doesn’t have', () => {
    const own = withOwnScores(5, null, { critic: null, critics: null, players: 70, users: 340 }, now);
    expect(toScore(own)).toMatchObject({
      status: 'found',
      topCriticScore: null,
      numTopCriticReviews: 0,
      playerScore: 70,
      playerCount: 340,
    });
  });

  it('cleared, goes back to OpenCritic’s match, due at once', () => {
    const own = withOwnScores(5, matched, { critic: 88, critics: 12, players: 81, users: null }, now);
    const cleared = withOwnScores(5, own, { critic: null, critics: null, players: null, users: null }, now);
    expect(cleared.manual).toBeUndefined();
    expect(cleared.playerScore).toBeUndefined();
    expect(cleared.playerCount).toBeUndefined();
    expect(cleared).toMatchObject({
      ocId: 77,
      topCriticScore: null,
      tier: null,
      numTopCriticReviews: 0,
      checkedAt: 0,
    });
    expect(isStale(cleared, now)).toBe(true);
    // Nothing typed in before: nothing changes.
    expect(withOwnScores(5, matched, { critic: null, critics: null, players: null, users: null }, now)).toBe(matched);
  });

  it('gives OpenCritic’s tiers', () => {
    expect([84, 83, 75, 74, 66, 65].map(tierFor)).toEqual([
      'Mighty',
      'Strong',
      'Strong',
      'Fair',
      'Fair',
      'Weak',
    ]);
  });
});

describe('lookupRank', () => {
  it('looks up Completed first, then Backlog, Shelved, Wishlist, and owned DLC last', () => {
    const order = [
      { name: 'dlc owned', status: 'completed', parentId: 1 },
      { name: 'wishlist', status: 'wishlist' },
      { name: 'dlc wished', status: 'wishlist', parentId: 1 },
      { name: 'shelved', status: 'shelved' },
      { name: 'completed', status: 'completed' },
      { name: 'backlog', status: 'backlog' },
    ]
      .sort((a, b) => lookupRank(a) - lookupRank(b))
      .map((g) => g.name);
    expect(order).toEqual([
      'completed',
      'backlog',
      'shelved',
      'wishlist',
      'dlc wished',
      'dlc owned',
    ]);
  });
});

describe('OpenCritic refresh timing', () => {
  const DAY = 86_400_000;
  const now = Date.parse('2026-11-08T12:00:00Z');
  const entry = (releaseDate: string | null, ocId: number | null = 1): OpenCriticEntry => ({
    ...entryFrom(1, ocId ? { id: ocId, name: 'X' } : null, releaseDate, now),
  });

  it('checks daily around release, less often for older games', () => {
    expect(maxAgeDays(entry('2026-11-20'), now)).toBe(1);
    expect(maxAgeDays(entry('2026-10-01'), now)).toBe(1);
    expect(maxAgeDays(entry('2026-03-01'), now)).toBe(30);
    expect(maxAgeDays(entry('2020-01-01'), now)).toBe(90);
    expect(maxAgeDays(entry('2027-06-01'), now)).toBe(14);
  });

  it('looks for a missing game at most weekly', () => {
    expect(maxAgeDays(entry('2026-11-20', null), now)).toBe(7);
    expect(maxAgeDays(entry('2020-01-01', null), now)).toBe(90);
  });

  it('is due a little early, so the daily job always catches it', () => {
    const checked = { ...entry('2026-11-20'), checkedAt: now - DAY + 60_000 };
    expect(isStale(checked, now)).toBe(true);
    expect(isStale({ ...checked, checkedAt: now - 3_600_000 }, now)).toBe(false);
  });
});
