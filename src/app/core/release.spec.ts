import { alertDueAt, daysBetween, pickRelease, todayIn, toReleaseDateInfo } from '../../../api/_lib/release.js';

const PS5 = 167;
const XBOX = 169;
const unix = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 1000;

describe('pickRelease', () => {
  it('uses the date for my platform', () => {
    const release = pickRelease(
      [
        toReleaseDateInfo({ platform: XBOX, date: unix('2026-10-01'), date_format: 0, release_region: 8 }),
        toReleaseDateInfo({ platform: PS5, date: unix('2026-11-19'), date_format: 0, release_region: 8 }),
      ],
      PS5,
    );
    expect(release).toEqual({ date: '2026-11-19', precision: 'day', label: '19 Nov 2026' });
  });

  it('falls back to the earliest date on any platform', () => {
    const release = pickRelease(
      [
        toReleaseDateInfo({ platform: 6, date: unix('2027-03-02'), date_format: 0, release_region: 8 }),
        toReleaseDateInfo({ platform: XBOX, date: unix('2027-02-01'), date_format: 0, release_region: 8 }),
      ],
      PS5,
    );
    expect(release.date).toBe('2027-02-01');
  });

  it('prefers an exact date, then Europe', () => {
    const release = pickRelease(
      [
        toReleaseDateInfo({ platform: PS5, date: unix('2027-09-30'), date_format: 5, release_region: 1 }),
        toReleaseDateInfo({ platform: PS5, date: unix('2027-08-10'), date_format: 0, release_region: 2 }),
        toReleaseDateInfo({ platform: PS5, date: unix('2027-08-12'), date_format: 0, release_region: 1 }),
      ],
      PS5,
    );
    expect(release.label).toBe('12 Aug 2027');
  });

  it('labels vague dates', () => {
    const at = (format: number) =>
      pickRelease([toReleaseDateInfo({ platform: PS5, date: unix('2027-09-30'), date_format: format })], PS5);
    expect(at(1)).toMatchObject({ precision: 'month', label: 'Sep 2027' });
    expect(at(5)).toMatchObject({ precision: 'quarter', label: 'Q3 2027', date: '2027-09-30' });
    expect(at(2)).toMatchObject({ precision: 'year', label: '2027' });
    expect(at(7)).toMatchObject({ precision: 'tbd', label: 'TBA', date: null });
  });

  it('is TBA without dates', () => {
    expect(pickRelease([], PS5)).toEqual({ date: null, precision: 'tbd', label: 'TBA' });
  });
});

describe('dates and alerts', () => {
  const athens = { notifyDaysBefore: 1, notifyTime: '13:00', timezone: 'Europe/Athens' };

  it('counts days', () => {
    expect(daysBetween('2026-11-07', '2026-11-19')).toBe(12);
    expect(todayIn('Europe/Athens', new Date('2026-11-07T22:30:00Z'))).toBe('2026-11-08');
  });

  it('schedules the alert the day before at 13:00 Athens time, across DST', () => {
    // Winter: Athens is UTC+2.
    expect(new Date(alertDueAt({ date: '2026-11-19', precision: 'day' }, athens)!).toISOString()).toBe(
      '2026-11-18T11:00:00.000Z',
    );
    // Summer: UTC+3.
    expect(new Date(alertDueAt({ date: '2027-07-10', precision: 'day' }, athens)!).toISOString()).toBe(
      '2027-07-09T10:00:00.000Z',
    );
  });

  it('has no alert for vague dates', () => {
    expect(alertDueAt({ date: '2027-09-30', precision: 'quarter' }, athens)).toBeNull();
  });
});
