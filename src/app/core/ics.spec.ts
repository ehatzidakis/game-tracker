import { buildCalendar } from '../../../api/_lib/ics.js';
import type { TrackedGame } from '../../../api/_lib/models.js';

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
      { ...base, igdbId: 4, name: 'Done', releaseDate: '2026-11-20', releasePrecision: 'day', status: 'completed' },
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
      [{ ...base, igdbId: 9, name: 'A'.repeat(200), releaseDate: '2026-11-19', releasePrecision: 'day' }] as unknown as TrackedGame[],
      'https://example.app',
    );
    for (const line of long.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
