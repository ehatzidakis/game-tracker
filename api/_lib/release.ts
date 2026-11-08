// Release-date logic shared by the app and the server functions. No dependencies.
import type { Release, ReleaseDateInfo, ReleasePrecision } from './models.js';

/** IGDB release_date as returned with `release_dates.*` fields. */
export interface IgdbReleaseDate {
  platform?: number;
  date?: number;
  date_format?: number;
  release_region?: number;
  human?: string;
}

export function toReleaseDateInfo(rd: IgdbReleaseDate): ReleaseDateInfo {
  return {
    platform: rd.platform ?? 0,
    date: rd.date ?? null,
    format: rd.date_format ?? 7,
    region: rd.release_region ?? null,
    human: rd.human ?? null,
  };
}

function precisionOf(rd: ReleaseDateInfo): ReleasePrecision {
  if (rd.date === null) return 'tbd';
  switch (rd.format) {
    case 0:
      return 'day';
    case 1:
      return 'month';
    case 2:
      return 'year';
    case 3:
    case 4:
    case 5:
    case 6:
      return 'quarter';
    default:
      return 'tbd';
  }
}

const PRECISION_RANK: Record<ReleasePrecision, number> = {
  day: 0,
  month: 1,
  quarter: 2,
  year: 3,
  tbd: 4,
};

// Europe first (you're in Greece), then worldwide, then anywhere else.
function regionRank(region: number | null): number {
  if (region === 1) return 0;
  if (region === 8 || region === null) return 1;
  return 2;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const TBA: Release = { date: null, precision: 'tbd', label: 'TBA' };

/**
 * The release that matters for you: the dates for your platform (or all platforms if IGDB has
 * none for it), preferring the most exact date, then Europe/worldwide, then the earliest.
 */
export function pickRelease(dates: readonly ReleaseDateInfo[], platformIgdbId: number): Release {
  const forPlatform = dates.filter((d) => d.platform === platformIgdbId);
  const candidates = forPlatform.length ? forPlatform : dates;
  if (!candidates.length) return TBA;

  const best = [...candidates].sort(
    (a, b) =>
      PRECISION_RANK[precisionOf(a)] - PRECISION_RANK[precisionOf(b)] ||
      regionRank(a.region) - regionRank(b.region) ||
      (a.date ?? Infinity) - (b.date ?? Infinity),
  )[0];

  const precision = precisionOf(best);
  if (precision === 'tbd' || best.date === null) return TBA;

  const d = new Date(best.date * 1000);
  const year = d.getUTCFullYear();
  const month = MONTHS[d.getUTCMonth()];
  const label =
    precision === 'day'
      ? `${d.getUTCDate()} ${month} ${year}`
      : precision === 'month'
        ? `${month} ${year}`
        : precision === 'quarter'
          ? `Q${best.format - 2} ${year}`
          : `${year}`;

  return { date: d.toISOString().slice(0, 10), precision, label };
}

/** Today's date as "YYYY-MM-DD" in a time zone. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Whole days from `from` to `to`, both "YYYY-MM-DD". */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Offset of a time zone from UTC at an instant, in milliseconds (Athens summer: +3h). */
function zoneOffset(timezone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant (ms) of a wall-clock time ("YYYY-MM-DD", "HH:mm") in a time zone. */
export function zonedTime(date: string, time: string, timezone: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - zoneOffset(timezone, guess);
  // Correct once in case the guess fell on the other side of a DST change.
  return guess - zoneOffset(timezone, first);
}

/**
 * When the release alert for a game is due, or null if it can't have one (no exact day).
 * Example: release 2026-11-19, 1 day before at 13:00 Athens → 2026-11-18 11:00 UTC.
 */
export function alertDueAt(
  release: { date: string | null; precision: ReleasePrecision },
  settings: { notifyDaysBefore: number; notifyTime: string; timezone: string },
): number | null {
  if (release.precision !== 'day' || !release.date) return null;
  return zonedTime(
    addDays(release.date, -settings.notifyDaysBefore),
    settings.notifyTime,
    settings.timezone,
  );
}
