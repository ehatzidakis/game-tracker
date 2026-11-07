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
 * "Out today", "Tomorrow", "in 12 days", "in 5 weeks (36 days)", "in 4 months (125 days)".
 * Always shows the days. Only for exact dates.
 */
export function countdown(game: Dated, on = today()): string | null {
  if (game.releasePrecision !== 'day' || !game.releaseDate) return null;
  const days = daysBetween(on, game.releaseDate);
  if (days < 0) return null;
  if (days === 0) return 'Out today';
  if (days === 1) return 'Tomorrow';
  if (days <= 30) return `in ${days} days`;
  if (days <= 62) return `in ${Math.round(days / 7)} weeks (${days} days)`;
  return `in ${Math.round(days / 30.4)} months (${days} days)`;
}
