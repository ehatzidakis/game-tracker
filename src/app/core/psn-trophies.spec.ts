import { describe, expect, it } from 'vitest';
import type { TrophyProgress } from '../../../api/_lib/models.js';
import {
  buildTrophyList,
  findTrophyList,
  type ProfileTrophyList,
} from '../../../api/_lib/psn-trophies.js';

const counts = (bronze: number, silver: number, gold: number, platinum: number) => ({
  bronze,
  silver,
  gold,
  platinum,
});

describe('buildTrophyList', () => {
  it('puts your progress on each trophy and groups them, the game first', () => {
    const list = buildTrophyList(
      'NPWR1',
      'PS5',
      [
        { trophyId: 0, trophyHidden: false, trophyType: 'platinum', trophyName: 'All of it', trophyDetail: 'Every trophy', trophyIconUrl: 'p.png', trophyGroupId: 'default' },
        { trophyId: 1, trophyHidden: true, trophyType: 'gold', trophyName: ' The end ', trophyGroupId: 'default' },
        { trophyId: 2, trophyHidden: false, trophyType: 'bronze', trophyName: 'Collector', trophyGroupId: 'default', trophyProgressTargetValue: '10' },
        { trophyId: 3, trophyHidden: false, trophyType: 'silver', trophyName: 'DLC boss', trophyGroupId: '001' },
      ],
      [
        { trophyId: 0, earned: false, trophyEarnedRate: '2.5' },
        { trophyId: 1, earned: true, earnedDateTime: '2026-11-01T20:00:00Z', trophyEarnedRate: '30.1' },
        { trophyId: 2, earned: false, trophyEarnedRate: '12', progress: '7', trophyProgressTargetValue: '10' },
        { trophyId: 3, earned: false },
      ],
      [
        { trophyGroupId: 'default', trophyGroupName: 'Astro Bot' },
        { trophyGroupId: '001', trophyGroupName: 'Winter Wonder' },
      ],
    );
    expect(list.groups.map((g) => [g.id, g.name, g.trophies.length])).toEqual([
      ['default', 'Astro Bot', 3],
      ['001', 'Winter Wonder', 1],
    ]);
    const [platinum, end, collector] = list.groups[0].trophies;
    expect(platinum).toMatchObject({ grade: 'platinum', earned: false, rate: 2.5, progress: null, icon: 'p.png' });
    expect(end).toMatchObject({ name: 'The end', hidden: true, earned: true, earnedAt: Date.parse('2026-11-01T20:00:00Z'), rate: 30.1 });
    expect(collector.progress).toEqual({ value: 7, target: 10 });
    expect(list.groups[1].trophies[0]).toMatchObject({ earned: false, rate: null, earnedAt: null });
  });
});

describe('findTrophyList', () => {
  const trophies: TrophyProgress = {
    earned: counts(3, 1, 0, 0),
    defined: counts(30, 8, 3, 1),
    progress: 9,
    lastEarnedAt: null,
    platform: 'PS5',
  };
  const list = (id: string, extra: Partial<ProfileTrophyList> = {}): ProfileTrophyList => ({
    npCommunicationId: id,
    npServiceName: 'trophy2',
    trophyTitlePlatform: 'PS5',
    progress: 9,
    definedTrophies: counts(30, 8, 3, 1),
    earnedTrophies: counts(3, 1, 0, 0),
    ...extra,
  });

  it('finds the one list with the same platform and counts', () => {
    const found = findTrophyList(
      [list('A', { trophyTitlePlatform: 'PS4' }), list('B'), list('C', { progress: 10 })],
      trophies,
    );
    expect(found?.npCommunicationId).toBe('B');
  });

  it('gives nothing when two lists look the same', () => {
    expect(findTrophyList([list('A'), list('B')], trophies)).toBeNull();
    expect(findTrophyList([], trophies)).toBeNull();
  });
});
