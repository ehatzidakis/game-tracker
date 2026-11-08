import { daysBetween, todayIn } from '../../../api/_lib/release.js';
import type { TrackedGame } from '../../../api/_lib/models.js';

export const TIMEZONE = 'Europe/Athens';

export function today(): string {
  return todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone || TIMEZONE);
}

type Dated = Pick<TrackedGame, 'releaseDate' | 'releasePrecision'>;

/** True once the release date has passed. Vague dates count as released after the period ends. */
export function isReleased(game: Dated, on = today()): boolean {
  return !!game.releaseDate && game.releaseDate <= on;
}

/**
 * "Out today", "Tomorrow", "in 12 days", "in 194 days": always in days, never weeks or months.
 * Only for exact dates.
 */
export function countdown(game: Dated, on = today()): string | null {
  if (game.releasePrecision !== 'day' || !game.releaseDate) return null;
  const days = daysBetween(on, game.releaseDate);
  if (days < 0) return null;
  if (days === 0) return 'Out today';
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}

/** A stored time (ms) as a date field's value, "YYYY-MM-DD" in your time zone. */
export function dateFieldValue(ms: number | null | undefined): string {
  if (ms == null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A date field's "YYYY-MM-DD" as a stored time (midday, so time zones can't shift the day). */
export function fromDateField(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime() : null;
}
