import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideBell,
  LucideCalendarDays,
  LucideChevronRight,
  LucideGrid3x3,
  LucideJoystick,
  LucideLayoutGrid,
  LucidePlus,
} from '@lucide/angular';
import type { GamingEvent, TrackedGame } from '../../../../api/_lib/models.js';
import { countdown, today } from '../../core/dates';
import { BrowseService } from '../../core/browse';
import { EventsService } from '../../core/events.service';
import { LibraryService } from '../../core/library.service';
import { titleMatcher } from '../../core/title-search';
import { Cover } from '../../shared/cover';
import { EventArt } from '../../shared/event-art';
import { EventSheet, timeRange } from '../../shared/event-sheet';
import { PreorderIcon } from '../../shared/preorder-icon';
import { remember, remembered } from '../../core/remembered';
import { SearchField } from '../../shared/search-field';
import {
  calendarBrowseOrder,
  calendarGroups,
  nextReleaseId,
  vagueDate,
  vagueDateWithYear,
  type CalendarItem,
} from './calendar-groups';
import { NowPlaying, playingGames } from './now-playing';
import { PinnedTop } from '../../shared/pinned-top';
import { TabTitle } from '../../shared/tab-title';

const WEEKDAY_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
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
    TabTitle,
    PinnedTop,
    RouterLink,
    Cover,
    EventArt,
    SearchField,
    LucideBell,
    LucideCalendarDays,
    LucideChevronRight,
    LucideGrid3x3,
    LucideJoystick,
    LucideLayoutGrid,
    PreorderIcon,
    LucidePlus,
    NowPlaying,
  ],
  templateUrl: './calendar.html',
})
export class CalendarPage {
  protected readonly library = inject(LibraryService);
  private readonly browse = inject(BrowseService);
  private readonly router = inject(Router);
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
  /** Now playing: on unless turned off with its toolbar button (kept in your settings). */
  protected readonly nowPlayingOn = computed(() => this.library.settings().nowPlaying !== false);
  /** The button shows only while some game is marked Playing. */
  protected readonly hasPlaying = computed(() => playingGames(this.library.games()).length > 0);

  protected toggleNowPlaying(): void {
    this.library.saveSettings({ nowPlaying: !this.nowPlayingOn() });
  }
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

  /** Tapping a game hands over the Calendar's games as shown, so its page swipes through them. */
  protected browseFrom(id: number): void {
    // Cards have no month headers, so nothing is folded there.
    const folded = (key: string) => !this.cardView() && this.isCollapsed(key);
    this.browse.start(calendarBrowseOrder(this.groups(), folded), id, this.router.url);
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
   * "Thu 19": the month is in the section header. With `withMonth`, "Thu 29 Oct" (for a row
   * without a month header).
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

  /** Rows, or cards like the Library's; remembered on this device. */
  protected readonly cardView = signal(
    remembered<'list' | 'cards'>('calendar-view', 'list', ['list', 'cards']) === 'cards',
  );
  /** With cards: three or four a row, remembered on this device. */
  protected readonly columns = signal(remembered<'3' | '4'>('calendar-columns', '3', ['3', '4']));

  protected toggleView(): void {
    const cards = !this.cardView();
    this.cardView.set(cards);
    remember('calendar-view', cards ? 'cards' : 'list');
  }

  protected toggleColumns(): void {
    const next = this.columns() === '4' ? '3' : '4';
    this.columns.set(next);
    remember('calendar-columns', next);
  }

  /** On a card: "5 days", "Tomorrow", "Out today" (no "in": the badge is short). */
  protected badge(countdown: string): string {
    return countdown.replace(/^in /, '');
  }

  /** On an event's card: "9 days", "Tomorrow", "Today". */
  protected eventBadge(date: string): string | null {
    const left = countdown({ releaseDate: date, releasePrecision: 'day' }, this.today);
    return left ? this.badge(left).replace('Out today', 'Today') : null;
  }

  /** "18:00–18:40" under an event's card. */
  protected eventTime(event: GamingEvent): string {
    return timeRange(event);
  }

  /** The cards: everything in calendar order, in one grid (no month headers). */
  protected readonly cardItems = computed((): CalendarItem[] =>
    this.groups().flatMap((group) => group.items),
  );

  /** A day under a card, with no header to give the month: "Thu 19 Nov", "12 Feb 2027". */
  protected cardDay(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    return date.slice(0, 4) === this.today.slice(0, 4)
      ? WEEKDAY_DAY_MONTH.format(d).replace(',', '')
      : DAY_MONTH_YEAR.format(d);
  }

  /** Under a game's card: its day ("Thu 19 Nov"), or a vague date with its year ("Nov 2027"). */
  protected cardDate(game: TrackedGame): string {
    return game.releasePrecision === 'day' && game.releaseDate
      ? this.cardDay(game.releaseDate)
      : vagueDateWithYear(game);
  }

  /** "Grand Theft Auto VI, Thu 19, in 5 days, Pre-ordered, Release alert on" for screen readers. */
  protected gameCardLabel(game: TrackedGame): string {
    return [
      game.name,
      this.cardDate(game),
      this.countdown(game),
      this.coverLabel(game),
      game.preordered ? 'Pre-ordered' : null,
      game.notify ? 'Release alert on' : null,
    ]
      .filter(Boolean)
      .join(', ');
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
