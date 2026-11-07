import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideBell, LucideCalendarPlus } from '@lucide/angular';
import { countdown, today } from '../../core/dates';
import { LibraryService } from '../../core/library.service';
import { Cover } from '../../shared/cover';
import { calendarGroups } from './calendar-groups';

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });

@Component({
  selector: 'app-calendar',
  imports: [RouterLink, Cover, LucideBell, LucideCalendarPlus],
  templateUrl: './calendar.html',
})
export class CalendarPage {
  protected readonly library = inject(LibraryService);
  private readonly today = today();

  protected readonly groups = computed(() => calendarGroups(this.library.games(), this.today));
  protected readonly countdown = (game: Parameters<typeof countdown>[0]) =>
    countdown(game, this.today);

  protected day(date: string): string {
    return String(Number(date.slice(8, 10)));
  }

  protected weekday(date: string): string {
    return WEEKDAY.format(new Date(`${date}T00:00:00Z`));
  }

  /** Opens the iPhone's "Subscribe to calendar" prompt for your feed. */
  protected subscribe(): void {
    const key = this.library.calendarKey();
    location.href = `webcal://${location.host}/api/calendar.ics?key=${key}`;
  }
}
