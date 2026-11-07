import { Component, computed, DestroyRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideBell, LucideCalendarDays, LucideChevronRight } from '@lucide/angular';
import { countdown, today } from '../../core/dates';
import { LibraryService } from '../../core/library.service';
import { PageTitle } from '../../core/page-title';
import { Cover } from '../../shared/cover';
import { calendarGroups } from './calendar-groups';

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

@Component({
  selector: 'app-calendar',
  imports: [RouterLink, Cover, LucideBell, LucideCalendarDays, LucideChevronRight],
  templateUrl: './calendar.html',
})
export class CalendarPage {
  protected readonly library = inject(LibraryService);
  private readonly today = today();

  constructor() {
    // Subscribe sits in the top bar, so it stays reachable while you scroll.
    const pageTitle = inject(PageTitle);
    pageTitle.action.set({ label: 'Subscribe', run: () => this.subscribe() });
    inject(DestroyRef).onDestroy(() => pageTitle.action.set(null));
  }

  protected readonly groups = computed(() => calendarGroups(this.library.games(), this.today));

  /** The next game to come out (exact date, today or later). Its countdown is in blue. */
  protected readonly nextId = computed(() => {
    for (const group of this.groups()) {
      if (group.key === 'recent') continue;
      const next = group.games.find((g) => g.releasePrecision === 'day');
      if (next) return next.igdbId;
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

  /** Opens the iPhone's "Subscribe to calendar" prompt for your feed. */
  protected subscribe(): void {
    const key = this.library.calendarKey();
    location.href = `webcal://${location.host}/api/calendar.ics?key=${key}`;
  }
}
