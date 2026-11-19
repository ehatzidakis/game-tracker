import type { OpenCriticCheck, OpenCriticScore } from '../../../api/_lib/opencritic-match.js';
import { describeCheck } from './opencritic';

const now = Date.parse('2026-11-19T12:00:00Z');
const found = (extra: object = {}): OpenCriticScore => ({
  status: 'found',
  url: null,
  tier: 'Mighty',
  topCriticScore: 99,
  percentRecommended: 99,
  numReviews: 89,
  numTopCriticReviews: 61,
  manual: false,
  playerScore: null,
  playerCount: null,
  ...extra,
});
const checked = (
  score: OpenCriticScore,
  extra: Partial<OpenCriticCheck> = {},
): OpenCriticCheck => ({
  score,
  checkedAt: now - 1000,
  limit: false,
  retryAt: null,
  ...extra,
});

describe('describeCheck', () => {
  it('gives the score, its tier and how many top critics, when just checked', () => {
    expect(describeCheck(checked(found()), now)).toBe(
      'Up to date: 99 (Mighty) from 61 top critics.',
    );
    expect(
      describeCheck(
        checked(found({ tier: null, numTopCriticReviews: 1, topCriticScore: 80 })),
        now,
      ),
    ).toBe('Up to date: 80 from 1 top critic.');
  });

  it('says when there is no score yet', () => {
    expect(describeCheck(checked(found({ topCriticScore: null, numReviews: 3 })), now)).toBe(
      'Up to date: no score yet, 3 critics so far.',
    );
    expect(describeCheck(checked(found({ topCriticScore: null, numReviews: 0 })), now)).toBe(
      'Up to date: no reviews yet.',
    );
  });

  it('says when OpenCritic has no page for it', () => {
    expect(describeCheck(checked({ status: 'none' }), now)).toBe(
      'Up to date: OpenCritic has no page for this game yet.',
    );
  });

  it('never passes an old stored score off as fresh when the allowance is used up', () => {
    const old = Date.parse('2026-11-03T09:00:00Z');
    const limited = (retryAt: number | null, checkedAt: number | null = old) =>
      checked(found(), { checkedAt, limit: true, retryAt });
    expect(describeCheck(limited(now + 5 * 3_600_000), now)).toBe(
      'Couldn’t check: today’s OpenCritic allowance is used up. It comes back in about 5 hours. The score shown is from 3 Nov.',
    );
    expect(describeCheck(limited(now + 20 * 60_000), now)).toContain('within the hour');
    expect(describeCheck(limited(null, null), now)).toBe(
      'Couldn’t check: today’s OpenCritic allowance is used up. It comes back tomorrow.',
    );
  });

  it('says when the game uses scores typed in by hand (OpenCritic isn’t asked)', () => {
    expect(describeCheck(checked(found({ manual: true }), { checkedAt: 0 }), now)).toBe(
      'This game uses the scores typed in above. Clear them to use OpenCritic’s again.',
    );
  });

  it('says when OpenCritic didn’t answer', () => {
    expect(describeCheck(checked(found(), { checkedAt: now - 86_400_000 }), now)).toBe(
      'OpenCritic didn’t answer. Try again in a moment.',
    );
  });
});
