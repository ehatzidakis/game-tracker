import type { TrackedGame } from '../../../../api/_lib/models.js';
import { addDays } from '../../../../api/_lib/release.js';

export interface CalendarGroup {
  key: string;
  title: string;
  games: TrackedGame[];
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** How long a released game stays at the top under "Just released". */
export const JUST_RELEASED_DAYS = 14;

/**
 * Upcoming games in calendar order: just released, then exact dates by month, then vague dates
 * by year ("Later in 2027"), then TBA. Completed and shelved games are left out.
 */
export function calendarGroups(games: readonly TrackedGame[], today: string): CalendarGroup[] {
  const relevant = games.filter((g) => g.status !== 'completed' && g.status !== 'shelved');
  const byDate = (a: TrackedGame, b: TrackedGame) =>
    (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '') || a.name.localeCompare(b.name);

  const groups: CalendarGroup[] = [];
  const add = (key: string, title: string, game: TrackedGame) => {
    let group = groups.find((g) => g.key === key);
    if (!group) groups.push((group = { key, title, games: [] }));
    group.games.push(game);
  };

  const since = addDays(today, -JUST_RELEASED_DAYS);
  const recent = relevant
    .filter((g) => g.releasePrecision === 'day' && g.releaseDate! < today && g.releaseDate! >= since)
    .sort(byDate)
    .reverse();
  for (const g of recent) add('recent', 'Just released', g);

  const exact = relevant
    .filter((g) => g.releasePrecision === 'day' && g.releaseDate! >= today)
    .sort(byDate);
  for (const g of exact) {
    const month = g.releaseDate!.slice(0, 7);
    add(month, MONTH.format(new Date(`${month}-01T00:00:00Z`)), g);
  }

  const vague = relevant
    .filter((g) => g.releasePrecision !== 'day' && g.releasePrecision !== 'tbd' && g.releaseDate! >= today)
    .sort(byDate);
  for (const g of vague) {
    const year = g.releaseDate!.slice(0, 4);
    add(`later-${year}`, `Later in ${year}`, g);
  }

  const tba = relevant.filter((g) => !g.releaseDate).sort((a, b) => a.name.localeCompare(b.name));
  for (const g of tba) add('tba', 'TBA', g);

  return groups;
}
