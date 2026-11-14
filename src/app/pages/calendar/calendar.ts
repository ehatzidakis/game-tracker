import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideBell,
  LucideCalendarDays,
  LucideChevronRight,
  LucideDisc3,
  LucidePlus,
} from '@lucide/angular';
import type { GamingEvent, TrackedGame } from '../../../../api/_lib/models.js';
import { countdown, today } from '../../core/dates';
import { EventsService } from '../../core/events.service';
import { LibraryService } from '../../core/library.service';
import { titleMatcher } from '../../core/title-search';
import { Cover } from '../../shared/cover';
import { EventArt } from '../../shared/event-art';
import { EventSheet, timeRange } from '../../shared/event-sheet';
import { SearchField } from '../../shared/search-field';
import { calendarGroups, nextReleaseId, vagueDate } from './calendar-groups';

const WEEKDAY_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** What's in the search field, kept while the app is open (so coming back from a game keeps it). */
let currentQuery = '';
/** Sections you've folded ("2026-11", "tba"…), kept while the app is open, as in the Library. */
const collapsedGroups = new Set<string>();

const MONTH_ONLY = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });

@Component({
  selector: 'app-calendar',
  imports: [
    RouterLink,
    Cover,
    EventArt,
    SearchField,
    LucideBell,
    LucideCalendarDays,
    LucideChevronRight,
    LucideDisc3,
    LucidePlus,
  ],
  templateUrl: './calendar.html',
})
export class CalendarPage {
  protected readonly library = inject(LibraryService);
  private readonly events = inject(EventsService);
  private readonly eventSheet = inject(EventSheet);
  private readonly today = today();

  private readonly allGroups = computed(() =>
    calendarGroups(this.library.games(), this.today, this.events.events()),
  );
  /** Nothing in the calendar at all (before any search). */
  protected readonly empty = computed(() => this.allGroups().length === 0);

  /** Searching keeps the months, showing only the games and events whose title matches. */
  protected readonly query = signal(currentQuery);
  protected readonly groups = computed(() => {
    const matches = titleMatcher(this.query());
    if (!matches) return this.allGroups();
    return this.allGroups()
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          matches(item.type === 'game' ? item.game.name : item.event.title),
        ),
      }))
      .filter((group) => group.items.length);
  });

  protected setQuery(query: string): void {
    this.query.set(query);
    currentQuery = query;
  }

  private readonly collapsed = signal<ReadonlySet<string>>(new Set(collapsedGroups));

  /** Folded, unless you're searching: a fold never hides a match. */
  protected isCollapsed(key: string): boolean {
    return !this.query().trim() && this.collapsed().has(key);
  }

  protected toggleGroup(key: string): void {
    if (this.query().trim()) return;
    if (collapsedGroups.has(key)) collapsedGroups.delete(key);
    else collapsedGroups.add(key);
    this.collapsed.set(new Set(collapsedGroups));
  }

  /** "November" for this year's months, "February 2027" for later ones; the rest as they are. */
  protected heading(group: { key: string; title: string }): string {
    const month = /^(\d{4})-(\d{2})$/.exec(group.key);
    if (!month || month[1] !== this.today.slice(0, 4)) return group.title;
    return MONTH_ONLY.format(new Date(`${group.key}-01T00:00:00Z`));
  }

  /** The next game to come out (exact date, today or later). Its countdown is in blue. */
  protected readonly nextId = computed(() => nextReleaseId(this.library.games(), this.today));

  protected readonly countdown = (game: Parameters<typeof countdown>[0]) =>
    countdown(game, this.today);

  /**
   * "Thu 19": the month is in the section header. "Just released" has no month header, so it
   * gets "Thu 29 Oct".
   */
  protected shortDate(date: string, withMonth: boolean): string {
    const format = withMonth ? WEEKDAY_DAY_MONTH : WEEKDAY_DAY;
    return format.format(new Date(`${date}T00:00:00Z`)).replace(',', '');
  }

  /** "Tue 9 · 22:00–23:00 · in 3 days" for an event. */
  protected eventWhen(event: GamingEvent, date: string): string {
    const left = countdown({ releaseDate: date, releasePrecision: 'day' }, this.today);
    return [this.shortDate(date, false), timeRange(event), left].filter(Boolean).join(' · ');
  }

  protected addEvent(): void {
    void this.eventSheet.create();
  }

  /**
   * The word after a game's date: "DLC", "Playing" or "Owned"; nothing for a plain wishlist game.
   * A pre-order shows as an icon on the right instead.
   */
  protected coverLabel(game: TrackedGame): string | null {
    if (game.parentId) return 'DLC';
    if (game.preordered) return null;
    if (game.playing && game.status === 'backlog') return 'Playing';
    if (game.status === 'backlog') return 'Owned';
    return null;
  }

  protected readonly vagueDate = vagueDate;

  /** "6 games · 3 events", for what's listed now (a search narrows it). */
  protected readonly countLine = computed(() => {
    const items = this.groups().flatMap((g) => g.items);
    const events = items.filter((i) => i.type === 'event').length;
    const games = items.length - events;
    const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    return [
      games ? part(games, 'game', 'games') : '',
      events ? part(events, 'event', 'events') : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });
}
