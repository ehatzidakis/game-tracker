import { announcementFor, CHANGELOG, type ChangelogEntry } from '../../../api/_lib/changelog.js';
import { changelogDate } from './whats-new';

const entry = (id: string, date: string): ChangelogEntry => ({
  id,
  date,
  title: id,
  summary: id,
  items: [id],
});
const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

describe("What's new", () => {
  it('announces the newest entry once', () => {
    const log = [entry('b', '2026-11-25'), entry('a', '2026-11-20')];
    expect(announcementFor(log, null, at('2026-11-25'))?.id).toBe('b');
    expect(announcementFor(log, 'a', at('2026-11-26'))?.id).toBe('b');
    expect(announcementFor(log, 'b', at('2026-11-26'))).toBeNull();
  });

  it('never announces an old entry, or one dated in the future', () => {
    const log = [entry('b', '2026-11-25')];
    expect(announcementFor(log, null, at('2026-12-05'))).toBeNull();
    expect(announcementFor(log, null, at('2026-11-24'))).toBeNull();
    expect(announcementFor([], null, at('2026-11-25'))).toBeNull();
  });

  it('keeps the changelog newest first, with ids used once', () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const dates = CHANGELOG.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const e of CHANGELOG) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.items.length).toBeGreaterThan(0);
      expect(e.summary.length).toBeLessThanOrEqual(110);
    }
  });

  it('dates entries like the rest of the app', () => {
    expect(changelogDate('2026-11-25', new Date('2026-11-30T12:00:00'))).toBe('25 November');
    expect(changelogDate('2025-03-02', new Date('2026-11-30T12:00:00'))).toBe('2 March 2025');
  });
});
