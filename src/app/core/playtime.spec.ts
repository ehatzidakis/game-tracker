import { formatPlaytimeHours } from './playtime';

describe('formatPlaytimeHours', () => {
  it('rounds to the nearest hour, up from half past', () => {
    expect(formatPlaytimeHours(5 + 29 / 60)).toBe('5h');
    expect(formatPlaytimeHours(5.5)).toBe('6h');
    expect(formatPlaytimeHours(5 + 59 / 60)).toBe('6h');
    expect(formatPlaytimeHours(137 + 51 / 60)).toBe('138h');
    expect(formatPlaytimeHours(12)).toBe('12h');
  });

  it('says under an hour for less than half an hour, nothing for none', () => {
    expect(formatPlaytimeHours(20 / 60)).toBe('<1h');
    expect(formatPlaytimeHours(0.5)).toBe('1h');
    expect(formatPlaytimeHours(0)).toBe('');
    expect(formatPlaytimeHours(null)).toBe('');
  });
});
