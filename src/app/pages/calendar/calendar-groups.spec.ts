import type { GamingEvent, TrackedGame } from '../../../../api/_lib/models.js';
import {
  calendarBrowseOrder,
  calendarGroups,
  nextReleaseId,
  vagueDate,
  vagueDateWithYear,
  type CalendarGroup,
} from './calendar-groups';

const ids = (groups: CalendarGroup[]) =>
  groups.map((g) => [
    g.title,
    g.items.map((x) => (x.type === 'game' ? x.game.igdbId : x.event.id)),
  ]);

function event(id: string, startsAt: string, archived = false): GamingEvent {
  return { id, title: id, startsAt: Date.parse(startsAt), kind: 'other', archived } as GamingEvent;
}

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
  it('orders months, later, TBA, leaving out games already out', () => {
    const groups = calendarGroups(
      [
        game(1, null, 'tbd'),
        game(2, '2027-09-30', 'quarter'),
        game(3, '2026-12-03', 'day'),
        game(4, '2026-11-19', 'day', 'backlog'),
        // Out yesterday: gone (it stays only until the day it comes out).
        game(5, '2026-11-06', 'day'),
        game(6, '2026-01-01', 'day'),
        // Out today: still there.
        game(8, '2026-11-07', 'day'),
        game(7, '2026-11-20', 'day', 'completed'),
      ],
      '2026-11-07',
    );
    expect(ids(groups)).toEqual([
      ['November 2026', [8, 4]],
      ['December 2026', [3]],
      ['Later in 2027', [2]],
      ['TBA', [1]],
    ]);
  });

  it('puts events in their month, before that day’s games, leaving out finished and archived ones', () => {
    const dateOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const groups = calendarGroups(
      [game(4, '2026-11-19', 'day'), game(3, '2027-01-10', 'day')],
      '2026-11-07',
      [
        event('sop', '2026-11-19T20:00:00Z'),
        event('direct', '2026-12-05T14:00:00Z'),
        event('old', '2026-11-01T20:00:00Z'),
        // Started 40 minutes ago: still on (an hour long without a duration).
        event('live', '2026-11-07T09:20:00Z'),
        // Earlier today, over by now.
        event('over', '2026-11-07T08:00:00Z'),
        event('done', '2026-11-20T20:00:00Z', true),
      ],
      dateOf,
      Date.parse('2026-11-07T10:00:00Z'),
    );
    expect(ids(groups)).toEqual([
      ['November 2026', ['live', 'sop', 4]],
      ['December 2026', ['direct']],
      ['January 2027', [3]],
    ]);
  });

  it('shows a game released today as upcoming', () => {
    expect(calendarGroups([game(1, '2026-11-07', 'day')], '2026-11-07')[0].title).toBe(
      'November 2026',
    );
  });
});

describe('vagueDate', () => {
  const at = (
    releaseDate: string | null,
    releasePrecision: TrackedGame['releasePrecision'],
    releaseLabel: string,
  ) => vagueDate({ releaseDate, releasePrecision, releaseLabel });

  it('leaves out the year the header already shows', () => {
    expect(at('2027-11-01', 'month', 'Nov 2027')).toBe('In November');
    expect(at('2027-09-30', 'quarter', 'Q3 2027')).toBe('Jul–Sep');
  });

  it('says the date is not announced for a year alone or no date', () => {
    expect(at('2028-12-31', 'year', '2028')).toBe('Date not announced');
    expect(at(null, 'tbd', 'TBA')).toBe('Date not announced');
  });
});

describe('nextReleaseId', () => {
  it('is the earliest exact day from today, leaving out released, vague and finished games', () => {
    const games = [
      game(1, '2026-11-10', 'day'), // already out
      game(2, '2026-11-01', 'month'), // no exact day
      game(3, '2026-11-20', 'day', 'completed'),
      game(4, '2026-11-25', 'day', 'backlog'),
      game(5, '2026-12-01', 'day'),
    ];
    expect(nextReleaseId(games, '2026-11-14')).toBe(4);
    expect(nextReleaseId([game(1, '2026-11-10', 'day')], '2026-11-14')).toBeNull();
  });
});

describe('vagueDateWithYear', () => {
  it('adds the year, for cards with no header to give it', () => {
    const at = (
      releaseDate: string | null,
      releasePrecision: TrackedGame['releasePrecision'],
      releaseLabel: string,
    ) => vagueDateWithYear({ releaseDate, releasePrecision, releaseLabel });
    expect(at('2027-11-01', 'month', 'Nov 2027')).toBe('Nov 2027');
    expect(at('2027-09-30', 'quarter', 'Q3 2027')).toBe('Jul–Sep 2027');
    expect(at('2028-12-31', 'year', '2028')).toBe('2028');
    expect(at(null, 'tbd', 'TBA')).toBe('Date not announced');
  });
});

describe('calendarBrowseOrder', () => {
  const game = (igdbId: number) => ({ type: 'game', id: `g${igdbId}`, game: { igdbId } as TrackedGame }) as const;
  const event = { type: 'event', id: 'e', event: {} as GamingEvent, date: '2026-12-01' } as const;
  it('is the games in calendar order, skipping events and folded months', () => {
    const groups: CalendarGroup[] = [
      { key: '2026-11', title: '', items: [game(1), event, game(2)] },
      { key: '2026-12', title: '', items: [game(3)] },
      { key: '2027-01', title: '', items: [event, game(4)] },
    ];
    expect(calendarBrowseOrder(groups, (key) => key === '2026-12')).toEqual([1, 2, 4]);
    expect(calendarBrowseOrder(groups, () => false)).toEqual([1, 2, 3, 4]);
  });
});
