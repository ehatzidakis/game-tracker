import { readAnnouncedTime } from './announced-time';

const ATHENS = 'Europe/Athens';
const NOW = Date.parse('2026-11-08T12:00:00Z');
const read = (text: string, fallbackDay = '2026-11-12', now = NOW) =>
  readAnnouncedTime(text, fallbackDay, now, ATHENS);
/** The moment as Athens wall-clock time, "2026-06-09 20:00". */
const inAthens = (ms: number | undefined) =>
  ms === undefined
    ? undefined
    : new Intl.DateTimeFormat('sv-SE', {
        timeZone: ATHENS,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(ms);

describe('readAnnouncedTime', () => {
  it('reads a typical US announcement with several zones, using the first', () => {
    const r = read(
      'Tuesday, June 9 at 10 a.m. PDT / 1 p.m. EDT / 6 p.m. BST',
      '2026-11-12',
      Date.parse('2026-05-01T12:00:00Z'),
    );
    expect(r?.read).toBe('10 a.m. PDT');
    expect(inAthens(r?.startsAt)).toBe('2026-06-09 20:00');
    expect(r?.dateFound).toBe(true);
  });

  it('works out summer or winter time for zones like PT and ET', () => {
    // February: Pacific is 8 hours behind UTC, Greece 2 ahead, so it's past midnight here.
    expect(inAthens(read('February 12, 2pm PT')?.startsAt)).toBe('2027-02-13 00:00');
    // US clocks change on 14 March 2027, Europe's on 28 March: two weeks of odd gaps.
    expect(inAthens(read('March 10, 2027 10am PT')?.startsAt)).toBe('2027-03-10 20:00');
    expect(inAthens(read('March 20, 2027 10am PT')?.startsAt)).toBe('2027-03-20 19:00');
    expect(inAthens(read('noon ET on Nov 20')?.startsAt)).toBe('2026-11-20 19:00');
  });

  it('reads 24-hour times, day-month dates, UK time and UTC offsets', () => {
    expect(inAthens(read('21:00 CET')?.startsAt)).toBe('2026-11-12 22:00');
    expect(inAthens(read('Thursday 12 November, 10pm UK time')?.startsAt)).toBe('2026-11-13 00:00');
    expect(inAthens(read('3pm UTC+9')?.startsAt)).toBe('2026-11-12 08:00');
    expect(inAthens(read('18:00 GMT on 2026-12-03')?.startsAt)).toBe('2026-12-03 20:00');
  });

  it('uses the day in Starts when the text has no date', () => {
    const r = read('6pm BST');
    expect(r?.dateFound).toBe(false);
    // BST is an hour ahead of UTC; Greece is two ahead in November.
    expect(inAthens(r?.startsAt)).toBe('2026-11-12 19:00');
  });

  it('takes a time without a zone as yours, and 12am/12pm the usual way', () => {
    expect(inAthens(read('Dec 1 at 20:00')?.startsAt)).toBe('2026-12-01 20:00');
    expect(inAthens(read('Dec 1, 12am PT')?.startsAt)).toBe('2026-12-01 10:00');
    expect(inAthens(read('Dec 1, 12pm PT')?.startsAt)).toBe('2026-12-01 22:00');
  });

  it('finds nothing without a time', () => {
    expect(read('Nintendo Direct, June 9')).toBeNull();
    expect(read('Summer Game Fest 2027')).toBeNull();
    expect(read('')).toBeNull();
  });
});
