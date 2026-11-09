import {
  cleanLink,
  dateTimeFieldValue,
  durationFieldValue,
  fromDateTimeField,
  fromDurationField,
  guessKind,
} from './event-sheet';

describe('event sheet helpers', () => {
  it('guesses who is holding an event from its title', () => {
    expect(guessKind('State of Play')).toBe('playstation');
    expect(guessKind('Xbox Games Showcase')).toBe('xbox');
    expect(guessKind('Nintendo Direct')).toBe('nintendo');
    expect(guessKind('Summer Game Fest 2027')).toBe('showcase');
    expect(guessKind('The Game Awards')).toBe('showcase');
    expect(guessKind('Capcom Spotlight')).toBeNull();
  });

  it('reads links, adding https:// when left out', () => {
    expect(cleanLink('')).toBeNull();
    expect(cleanLink('youtube.com/live/abc')).toBe('https://youtube.com/live/abc');
    expect(cleanLink('https://blog.playstation.com/x')).toBe('https://blog.playstation.com/x');
    expect(cleanLink('not a link')).toBeUndefined();
  });

  it('turns date and time fields into a moment in your time zone and back', () => {
    const ms = fromDateTimeField('2026-11-12T22:00')!;
    expect(new Date(ms).getHours()).toBe(22);
    expect(dateTimeFieldValue(ms)).toBe('2026-11-12T22:00');
    expect(fromDateTimeField('2026-11-12')).toBeNull();
  });

  it('reads the duration field as hours and minutes, up to 9 h 59', () => {
    expect(fromDurationField('01:30')).toBe(90);
    expect(fromDurationField('00:45')).toBe(45);
    expect(fromDurationField('')).toBeNull();
    expect(fromDurationField('00:00')).toBeNull();
    expect(fromDurationField('10:00')).toBeUndefined();
    expect(fromDurationField('1:75')).toBeUndefined();
    expect(durationFieldValue(90)).toBe('01:30');
    expect(durationFieldValue(null)).toBe('');
  });
});
