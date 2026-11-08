import { buildCalendar } from '../../../api/_lib/ics.js';
import type { GamingEvent, TrackedGame } from '../../../api/_lib/models.js';

const base = {
  myPlatform: 'ps5',
  developer: 'Studio, Inc; Ltd',
  status: 'wishlist',
  igdbSyncedAt: Date.UTC(2026, 10, 1),
} as const;

describe('buildCalendar', () => {
  const ics = buildCalendar(
    [
      { ...base, igdbId: 2, name: 'Second', releaseDate: '2026-12-03', releasePrecision: 'day' },
      { ...base, igdbId: 1, name: 'First', releaseDate: '2026-11-19', releasePrecision: 'day' },
      { ...base, igdbId: 3, name: 'Vague', releaseDate: '2027-09-30', releasePrecision: 'quarter' },
      {
        ...base,
        igdbId: 4,
        name: 'Done',
        releaseDate: '2026-11-20',
        releasePrecision: 'day',
        status: 'completed',
      },
    ] as unknown as TrackedGame[],
    'https://example.app',
    Date.UTC(2026, 10, 7, 12),
  );

  it('has one all-day event per exact release, in date order', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.indexOf('First')).toBeLessThan(ics.indexOf('Second'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261119\r\nDTEND;VALUE=DATE:20261120');
    expect(ics).not.toContain('Vague');
    expect(ics).not.toContain('Done');
  });

  it('escapes text and uses CRLF line endings', () => {
    expect(ics).toContain('DESCRIPTION:PS5 · Studio\\, Inc\\; Ltd');
    expect(ics).toContain('URL:https://example.app/game/1');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('folds long lines at 75 bytes', () => {
    const long = buildCalendar(
      [
        {
          ...base,
          igdbId: 9,
          name: 'A'.repeat(200),
          releaseDate: '2026-11-19',
          releasePrecision: 'day',
        },
      ] as unknown as TrackedGame[],
      'https://example.app',
    );
    for (const line of long.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('puts gaming events in at their time, an hour long without a duration', () => {
    const event = (id: string, startsAt: number, extra: Partial<GamingEvent> = {}) =>
      ({
        id,
        title: id,
        startsAt,
        link: null,
        kind: 'other',
        archived: false,
        updatedAt: 0,
        ...extra,
      }) as GamingEvent;
    const feed = buildCalendar([], 'https://example.app', Date.UTC(2026, 10, 7, 12), [
      event('Nintendo Direct', Date.UTC(2026, 11, 3, 14), {
        durationMinutes: 40,
        link: 'https://nintendo.com/direct',
      }),
      event('State of Play', Date.UTC(2026, 10, 12, 20)),
    ]);
    const lines = feed.split('\r\n');
    expect(lines.filter((l) => l.startsWith('SUMMARY:'))).toEqual([
      'SUMMARY:📣 State of Play',
      'SUMMARY:📣 Nintendo Direct',
    ]);
    expect(lines).toContain('DTSTART:20261112T200000Z');
    expect(lines).toContain('DTEND:20261112T210000Z');
    expect(lines).toContain('DTSTART:20261203T140000Z');
    expect(lines).toContain('DTEND:20261203T144000Z');
    expect(lines).toContain('URL:https://nintendo.com/direct');
  });
});
