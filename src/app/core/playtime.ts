// Time played is stored as hours (hoursPlayed), possibly with a fraction for the minutes:
// 34h 21m is 34.35. Older entries like 12.5 read as 12h 30m.

/** 34.35 → { hours: 34, minutes: 21 }. */
export function splitPlaytime(hours: number): { hours: number; minutes: number } {
  const total = Math.round(hours * 60);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** 34.35 → "34h 21m", 34 → "34h", 0.35 → "21m". Empty for nothing played. */
export function formatPlaytime(hours: number | null | undefined): string {
  if (!hours) return '';
  const split = splitPlaytime(hours);
  if (!split.hours && !split.minutes) return '';
  if (!split.minutes) return `${split.hours}h`;
  return split.hours ? `${split.hours}h ${split.minutes}m` : `${split.minutes}m`;
}

/** Cover badges, minutes always two digits: 34.35 → "34h 21m", 5.1 → "5h 06m". Empty for nothing played. */
export function formatPlaytimeClock(hours: number | null | undefined): string {
  if (!hours) return '';
  const split = splitPlaytime(hours);
  if (!split.hours && !split.minutes) return '';
  return `${split.hours}h ${String(split.minutes).padStart(2, '0')}m`;
}

/**
 * The hours and minutes fields → hours ("34", "21" → 34.35). An empty field counts as 0, both
 * empty (or both 0) → null. Anything that isn't a whole number, or minutes over 59 → undefined.
 */
export function parsePlaytime(hoursText: string, minutesText: string): number | null | undefined {
  const read = (text: string) => {
    const clean = text.trim();
    if (clean === '') return 0;
    return /^\d{1,6}$/.test(clean) ? Number(clean) : undefined;
  };
  const hours = read(hoursText);
  const minutes = read(minutesText);
  if (hours === undefined || minutes === undefined || minutes > 59) return undefined;
  const total = hours * 60 + minutes;
  return total ? total / 60 : null;
}
