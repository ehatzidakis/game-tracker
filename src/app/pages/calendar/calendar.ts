import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideBell, LucideCalendarDays, LucideChevronRight, LucidePlus } from '@lucide/angular';
import type { GamingEvent, TrackedGame } from '../../../../api/_lib/models.js';
import { countdown, today } from '../../core/dates';
import { EventsService } from '../../core/events.service';
import { LibraryService } from '../../core/library.service';
import { titleMatcher } from '../../core/title-search';
import { Cover } from '../../shared/cover';
import { EventIcon } from '../../shared/event-icon';
import { EventSheet } from '../../shared/event-sheet';
import { SearchField } from '../../shared/search-field';
import { calendarGroups } from './calendar-groups';

const WEEKDAY_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** What's in the search field, kept while the app is open (so coming back from a game keeps it). */
let currentQuery = '';

@Component({
  selector: 'app-calendar',
  imports: [
    RouterLink,
    Cover,
    EventIcon,
    SearchField,
    LucideBell,
    LucideCalendarDays,
    LucideChevronRight,
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

  /** The next game to come out (exact date, today or later). Its countdown is in blue. */
  protected readonly nextId = computed(() => {
    for (const group of this.allGroups()) {
      if (group.key === 'recent') continue;
      const next = group.items.find(
        (item) => item.type === 'game' && item.game.releasePrecision === 'day',
      );
      if (next?.type === 'game') return next.game.igdbId;
    }
    return null;
  });

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

  /** "Tue 9 · 22:00 · in 3 days" for an event. */
  protected eventWhen(event: GamingEvent, date: string): string {
    const left = countdown({ releaseDate: date, releasePrecision: 'day' }, this.today);
    return [this.shortDate(date, false), TIME.format(event.startsAt), left]
      .filter(Boolean)
      .join(' · ');
  }

  protected addEvent(): void {
    void this.eventSheet.create();
  }

  protected editEvent(event: GamingEvent): void {
    void this.eventSheet.edit(event);
  }

  /** "Pre-ordered", "Owned" or "Playing" after the date; nothing for a plain wishlist game. */
  protected ownership(game: TrackedGame): string | null {
    if (game.preordered) return 'Pre-ordered';
    if (game.status === 'backlog') return 'Owned';
    if (game.status === 'playing') return 'Playing';
    return null;
  }
}
