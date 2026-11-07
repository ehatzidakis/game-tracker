import type { TrackedGame } from '../../../../api/_lib/models.js';
import { calendarGroups } from './calendar-groups';

function game(
  id: number,
  releaseDate: string | null,
  precision: TrackedGame['releasePrecision'],
  status: TrackedGame['status'] = 'wishlist',
): TrackedGame {
  return {
    igdbId: id,
    name: `Game ${id}`,
    releaseDate,
    releasePrecision: precision,
    status,
  } as TrackedGame;
}

describe('calendarGroups', () => {
  it('orders just released, months, later, TBA', () => {
    const groups = calendarGroups(
      [
        game(1, null, 'tbd'),
        game(2, '2027-09-30', 'quarter'),
        game(3, '2026-12-03', 'day'),
        game(4, '2026-11-19', 'day', 'backlog'),
        game(5, '2026-11-01', 'day'),
        game(6, '2026-01-01', 'day'),
        game(7, '2026-11-20', 'day', 'completed'),
      ],
      '2026-11-07',
    );
    expect(groups.map((g) => [g.title, g.games.map((x) => x.igdbId)])).toEqual([
      ['Just released', [5]],
      ['November 2026', [4]],
      ['December 2026', [3]],
      ['Later in 2027', [2]],
      ['TBA', [1]],
    ]);
  });

  it('shows a game released today as upcoming', () => {
    expect(calendarGroups([game(1, '2026-11-07', 'day')], '2026-11-07')[0].title).toBe(
      'November 2026',
    );
  });
});
