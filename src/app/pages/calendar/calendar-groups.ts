import { eventEnd, type GamingEvent, type TrackedGame } from '../../../../api/_lib/models.js';
import { addDays } from '../../../../api/_lib/release.js';

/** A row in the Calendar: a game coming out, or a gaming event. */
export type CalendarItem =
  | { type: 'game'; id: string; game: TrackedGame }
  | { type: 'event'; id: string; event: GamingEvent; date: string };

export interface CalendarGroup {
  key: string;
  title: string;
  items: CalendarItem[];
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** How long a released game stays at the top under "Just released". */
export const JUST_RELEASED_DAYS = 7;

/** "YYYY-MM-DD" of a time, in your time zone. */
export function localDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTH_LONG = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
const QUARTER_MONTHS = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];

/**
 * A game without an exact day, in words its header ("Later in 2027", "TBA") doesn't already say:
 * "In November", "Jul–Sep", or "Date not announced" for a year alone or no date at all.
 */
export function vagueDate(
  game: Pick<TrackedGame, 'releaseDate' | 'releasePrecision' | 'releaseLabel'>,
): string {
  const date = game.releaseDate ? new Date(`${game.releaseDate}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Date not announced';
  if (game.releasePrecision === 'month') return `In ${MONTH_LONG.format(date)}`;
  if (game.releasePrecision === 'quarter') {
    const q = /^Q([1-4])\b/.exec(game.releaseLabel)?.[1];
    return QUARTER_MONTHS[q ? Number(q) - 1 : Math.floor(date.getUTCMonth() / 3)];
  }
  if (game.releasePrecision === 'day') return game.releaseLabel;
  return 'Date not announced';
}

/**
 * The next game to come out: the earliest exact day, today or later, among games the Calendar
 * lists (not completed or shelved). Its countdown is the one blue countdown, in the Calendar and
 * the Library alike.
 */
export function nextReleaseId(games: readonly TrackedGame[], today: string): number | null {
  let next: TrackedGame | null = null;
  for (const g of games) {
    if (g.status === 'completed' || g.status === 'shelved') continue;
    if (g.releasePrecision !== 'day' || !g.releaseDate || g.releaseDate < today) continue;
    if (
      !next ||
      g.releaseDate < next.releaseDate! ||
      (g.releaseDate === next.releaseDate && g.name.localeCompare(next.name) < 0)
    )
      next = g;
  }
  return next?.igdbId ?? null;
}

const gameItem = (game: TrackedGame): CalendarItem => ({
  type: 'game',
  id: `game-${game.igdbId}`,
  game,
});

/**
 * Upcoming games in calendar order: just released, then exact dates by month, then vague dates
 * by year ("Later in 2027"), then TBA. Completed and shelved games are left out.
 * Gaming events join the months on the day they start, each before that day's games, until
 * they're over (they move to the Library's Events tab then). Archived ones are left out.
 */
export function calendarGroups(
  games: readonly TrackedGame[],
  today: string,
  events: readonly GamingEvent[] = [],
  dateOf: (ms: number) => string = localDate,
  now = Date.now(),
): CalendarGroup[] {
  const relevant = games.filter((g) => g.status !== 'completed' && g.status !== 'shelved');
  const byDate = (a: TrackedGame, b: TrackedGame) =>
    (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '') || a.name.localeCompare(b.name);

  const groups: CalendarGroup[] = [];
  const add = (key: string, title: string, item: CalendarItem) => {
    let group = groups.find((g) => g.key === key);
    if (!group) groups.push((group = { key, title, items: [] }));
    group.items.push(item);
  };

  const since = addDays(today, -JUST_RELEASED_DAYS);
  const recent = relevant
    .filter(
      (g) => g.releasePrecision === 'day' && g.releaseDate! < today && g.releaseDate! >= since,
    )
    .sort(byDate)
    .reverse();
  for (const g of recent) add('recent', 'Just released', gameItem(g));

  // Exact days, games and events together: by day, events first (by time), then games by name.
  const dated: { date: string; order: number; item: CalendarItem }[] = [
    ...events
      .filter((e) => !e.archived && eventEnd(e) > now)
      .map((e) => ({ event: e, date: dateOf(e.startsAt) }))
      .map(({ event, date }) => ({
        date,
        order: event.startsAt,
        item: { type: 'event', id: `event-${event.id}`, event, date } as CalendarItem,
      })),
    ...relevant
      .filter((g) => g.releasePrecision === 'day' && g.releaseDate! >= today)
      .map((g) => ({ date: g.releaseDate!, order: Number.MAX_SAFE_INTEGER, item: gameItem(g) })),
  ];
  const nameOf = (item: CalendarItem) => (item.type === 'game' ? item.game.name : item.event.title);
  dated.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.order - b.order ||
      nameOf(a.item).localeCompare(nameOf(b.item)),
  );
  for (const { date, item } of dated) {
    const month = date.slice(0, 7);
    add(month, MONTH.format(new Date(`${month}-01T00:00:00Z`)), item);
  }

  const vague = relevant
    .filter(
      (g) =>
        g.releasePrecision !== 'day' && g.releasePrecision !== 'tbd' && g.releaseDate! >= today,
    )
    .sort(byDate);
  for (const g of vague) {
    const year = g.releaseDate!.slice(0, 4);
    add(`later-${year}`, `Later in ${year}`, gameItem(g));
  }

  const tba = relevant.filter((g) => !g.releaseDate).sort((a, b) => a.name.localeCompare(b.name));
  for (const g of tba) add('tba', 'TBA', gameItem(g));

  return groups;
}
