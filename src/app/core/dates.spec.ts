import { countdown } from './dates';

describe('countdown', () => {
  const on = '2026-11-07';
  const day = (releaseDate: string) => countdown({ releaseDate, releasePrecision: 'day' }, on);

  it('counts in days only, however far away', () => {
    expect(day('2026-11-07')).toBe('Out today');
    expect(day('2026-11-08')).toBe('Tomorrow');
    expect(day('2026-11-19')).toBe('in 12 days');
    expect(day('2026-12-13')).toBe('in 36 days');
    expect(day('2027-05-20')).toBe('in 194 days');
  });

  it('says nothing for past or vague dates', () => {
    expect(day('2026-11-01')).toBeNull();
    expect(countdown({ releaseDate: '2027-03-31', releasePrecision: 'quarter' }, on)).toBeNull();
  });
});
