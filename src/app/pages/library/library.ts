import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  LucideArrowUpDown,
  LucideChevronDown,
  LucideChevronRight,
  LucideCloudDownload,
  LucideDisc3,
  LucideLibraryBig,
  LucideStar,
  LucideTrophy,
} from '@lucide/angular';
import {
  eventEnd,
  type GamingEvent,
  isDlc,
  shownInLibrary,
  statusLabel,
  type Status,
  type TrackedGame,
} from '../../../../api/_lib/models.js';
import { countdown, today } from '../../core/dates';
import { formatPlaytime, formatPlaytimeClock } from '../../core/playtime';
import { EventsService } from '../../core/events.service';
import { LibraryService } from '../../core/library.service';
import { OpenCriticService } from '../../core/opencritic';
import { remember, remembered } from '../../core/remembered';
import { Cover } from '../../shared/cover';
import { EventArt } from '../../shared/event-art';
import { ScoreRing } from '../../shared/score-ring';
import { SearchField } from '../../shared/search-field';
import {
  compareBy,
  COPY_TABS,
  matchesCopy,
  type CopyFilter,
  DEFAULT_SORT,
  groupByYear,
  LIBRARY_TABS,
  searchLibrary,
  type Sort,
} from './library-sort';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'name', label: 'Name' },
  { key: 'release', label: 'Release date' },
  { key: 'critics', label: 'OpenCritic' },
];
const PLAYTIME = { key: 'playtime', label: 'Playtime' } as const;
/** Extra sorts where they make sense: Completed also by when you finished (its default). */
const TAB_SORTS: Partial<Record<Status, { key: Sort; label: string }[]>> = {
  completed: [
    { key: 'completed', label: 'Date completed' },
    { key: 'rating', label: 'Rating' },
    PLAYTIME,
    ...SORTS,
  ],
  shelved: [...SORTS, PLAYTIME],
};
const sortsFor = (tab: Status) => TAB_SORTS[tab] ?? SORTS;

/** The four game tabs, plus the gaming events that are over. */
type Tab = Status | 'events';

const EVENT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Bump to reset everyone's remembered sorts to the defaults (2: per-tab defaults, 2026-11-08). */
const SORT_KEY = 'library.sort.v2';

/**
 * The tab you're on, kept while the app is open (so coming back from a game keeps it).
 * The app always opens on Completed.
 */
let currentTab: Tab = 'completed';
/** What's in the search field, kept while the app is open (so coming back from a game keeps it). */
let currentQuery = '';
/** Completed tab showing only Platinum games, kept while the app is open. */
let platinumOnlyNow = false;
/** Physical or digital copies only (owned tabs), kept while the app is open. */
let copyNow: CopyFilter = 'all';

const COPY_OPTIONS: { key: CopyFilter; label: string }[] = [
  { key: 'all', label: 'Physical and digital' },
  { key: 'physical', label: 'Physical only' },
  { key: 'digital', label: 'Digital only' },
];
/** Year groups you've folded ("completed:2025"), kept while the app is open. */
const collapsedGroups = new Set<string>();

const EMPTY: Record<Status, { title: string; text: string }> = {
  backlog: { title: 'No backlog', text: 'Games you own but haven’t started go here.' },
  wishlist: {
    title: 'Wishlist is empty',
    text: 'Upcoming games you add show up here and in the Calendar.',
  },
  shelved: { title: 'Nothing shelved', text: 'Games you’ve put aside for now go here.' },
  completed: { title: 'No completed games yet', text: 'Finished games and your ratings go here.' },
};

@Component({
  selector: 'app-library',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    Cover,
    EventArt,
    ScoreRing,
    SearchField,
    LucideArrowUpDown,
    LucideChevronDown,
    LucideChevronRight,
    LucideCloudDownload,
    LucideDisc3,
    LucideLibraryBig,
    LucideStar,
    LucideTrophy,
  ],
  templateUrl: './library.html',
})
export class LibraryPage {
  protected readonly library = inject(LibraryService);
  private readonly events = inject(EventsService);
  private readonly openCritic = inject(OpenCriticService);
  protected readonly tabs: { key: Tab; label: string }[] = [
    ...LIBRARY_TABS.map((key) => ({ key, label: statusLabel(key) })),
    { key: 'events', label: 'Events' },
  ];
  protected readonly tab = signal<Tab>(currentTab);
  /** The Events tab lists gaming events instead of games. */
  protected readonly showEvents = computed(() => this.tab() === 'events');
  /** The game tab you're on (Completed while you're on Events, where it isn't used). */
  protected readonly filter = computed<Status>(() => {
    const tab = this.tab();
    return tab === 'events' ? 'completed' : tab;
  });

  /** Gaming events from your calendar that are over, latest first. */
  protected readonly pastEvents = computed(() => {
    const now = Date.now();
    return this.events.events().filter((e) => !e.archived && eventEnd(e) <= now);
  });
  /** "3 Sep 2026" */
  protected eventDate(event: GamingEvent): string {
    return EVENT_DATE.format(event.startsAt);
  }
  protected readonly statusLabel = statusLabel;
  /** Searching looks through the whole library, every tab, by title. */
  protected readonly query = signal(currentQuery);
  protected readonly searching = computed(() => this.query().trim() !== '');
  protected readonly matches = computed(() => searchLibrary(this.listed(), this.query()));
  protected readonly sorts = computed(() => sortsFor(this.filter()));
  /** Each tab remembers its own sort on this device. */
  private readonly sortByTab = signal<Record<Status, Sort>>(
    Object.fromEntries(
      LIBRARY_TABS.map((tab) => {
        const options = sortsFor(tab).map((o) => o.key);
        return [tab, remembered(`${SORT_KEY}.${tab}`, DEFAULT_SORT[tab], options)];
      }),
    ) as Record<Status, Sort>,
  );
  protected readonly sort = computed(() => this.sortByTab()[this.filter()]);
  protected readonly sortLabel = computed(
    () => this.sorts().find((s) => s.key === this.sort())?.label ?? '',
  );
  /** Each tab remembers whether its order is flipped, too. */
  private readonly reversedTabs = signal<ReadonlySet<Status>>(
    new Set(
      LIBRARY_TABS.filter(
        (tab) => remembered(`${SORT_KEY}.${tab}.reversed`, '0', ['0', '1']) === '1',
      ),
    ),
  );
  protected readonly reversed = computed(() => this.reversedTabs().has(this.filter()));
  /** Games and wishlisted DLC; owned DLC shows on its main game's page instead. */
  private readonly listed = computed(() => this.library.games().filter(shownInLibrary));

  /**
   * OpenCritic's Top Critic Average for the games that have one, by IGDB id: the ring on each
   * cover. One request for the whole library, read from what the server already has.
   */
  private readonly scoreIds = computed(() =>
    this.listed()
      .map((g) => g.igdbId)
      .sort((a, b) => a - b),
  );
  private readonly scoresQuery = injectQuery(() => ({
    queryKey: ['opencritic-scores', this.scoreIds().join(',')],
    queryFn: () => this.openCritic.scores(this.scoreIds()),
    enabled: this.scoreIds().length > 0,
    staleTime: 6 * 60 * 60_000,
    retry: false,
    // While asking, the last scores (or, on opening the app, the ones kept on this phone), so the
    // rings and the OpenCritic sort are there at once.
    placeholderData: (previous?: Record<string, number>) =>
      previous ?? this.openCritic.cachedScores(),
  }));
  protected readonly scores = computed<Record<string, number>>(() => this.scoresQuery.data() ?? {});

  protected readonly counts = computed(() => {
    const counts = new Map<Status, number>();
    for (const g of this.listed()) counts.set(g.status, (counts.get(g.status) ?? 0) + 1);
    return counts;
  });

  /** Completed tab: only the games you got the Platinum trophy in. */
  protected readonly platinumOnly = signal(platinumOnlyNow);
  private readonly onlyPlatinum = computed(
    () => this.filter() === 'completed' && this.platinumOnly(),
  );

  /** Physical or digital only, on the tabs of games you own. */
  protected readonly copy = signal<CopyFilter>(copyNow);
  protected readonly copyOptions = COPY_OPTIONS;
  protected readonly copyShown = computed(() => COPY_TABS.includes(this.filter()));
  private readonly copyActive = computed<CopyFilter>(() =>
    this.copyShown() ? this.copy() : 'all',
  );

  protected setCopy(event: Event): void {
    copyNow = (event.target as HTMLSelectElement).value as CopyFilter;
    this.copy.set(copyNow);
  }

  protected readonly shown = computed(() =>
    this.listed()
      .filter((g) => g.status === this.filter())
      .filter((g) => !this.onlyPlatinum() || g.completion === 'platinum')
      .filter((g) => matchesCopy(g, this.copyActive()))
      .sort(compareBy(this.sort(), this.filter(), today(), this.reversed(), this.scores()))
      // The games you're playing lead the Backlog.
      .sort((a, b) => Number(!!b.playing) - Number(!!a.playing)),
  );

  protected togglePlatinum(): void {
    platinumOnlyNow = !this.platinumOnly();
    this.platinumOnly.set(platinumOnlyNow);
  }

  /**
   * Completed (by date completed) and Wishlist (by release date) split into years:
   * "4 in 2026", that year's games, then the next year. Each year folds away.
   */
  protected readonly yearGroups = computed(() =>
    groupByYear(this.filter(), this.sort(), this.shown(), today()),
  );
  private readonly collapsed = signal<ReadonlySet<string>>(new Set(collapsedGroups));

  protected readonly emptyTitle = computed(() => {
    if (this.copyActive() !== 'all') {
      return this.copyActive() === 'physical'
        ? 'No physical copies here'
        : 'No digital copies here';
    }
    return this.onlyPlatinum() ? 'No Platinum games yet' : EMPTY[this.filter()].title;
  });
  protected readonly emptyText = computed(() => {
    if (this.copyActive() !== 'all') {
      return 'Mark a game as a physical copy in Edit my data. The disc button switches back to all.';
    }
    return this.onlyPlatinum()
      ? 'Games you completed with every trophy show here. Tap the trophy to see them all.'
      : EMPTY[this.filter()].text;
  });

  /** Hours played across a year's completed games, rounded: "4 in 2026 · 120 h". */
  protected groupHours(games: readonly TrackedGame[]): number {
    if (this.filter() !== 'completed') return 0;
    return Math.round(games.reduce((sum, g) => sum + (g.hoursPlayed ?? 0), 0));
  }
  /** "4 in 2026", shown on the Completed tab when it isn't split by year. */
  protected readonly thisYear = computed(() => {
    const year = new Date().getFullYear();
    const count = this.shown().filter(
      (g) => g.completedAt && new Date(g.completedAt).getFullYear() === year,
    ).length;
    return { year, count };
  });

  protected readonly countdown = countdown;
  protected readonly formatPlaytime = formatPlaytime;
  protected readonly formatPlaytimeClock = formatPlaytimeClock;
  protected readonly isDlc = isDlc;

  protected isCollapsed(key: string): boolean {
    return this.collapsed().has(`${this.filter()}:${key}`);
  }

  protected toggleGroup(key: string): void {
    const id = `${this.filter()}:${key}`;
    if (collapsedGroups.has(id)) collapsedGroups.delete(id);
    else collapsedGroups.add(id);
    this.collapsed.set(new Set(collapsedGroups));
  }

  protected setQuery(query: string): void {
    this.query.set(query);
    currentQuery = query;
  }

  protected setFilter(tab: Tab): void {
    this.tab.set(tab);
    currentTab = tab;
  }

  protected setSort(event: Event): void {
    const sort = (event.target as HTMLSelectElement).value as Sort;
    const tab = this.filter();
    this.sortByTab.update((sorts) => ({ ...sorts, [tab]: sort }));
    remember(`${SORT_KEY}.${tab}`, sort);
  }

  protected toggleReversed(): void {
    const tab = this.filter();
    const reversed = !this.reversed();
    this.reversedTabs.update((tabs) => {
      const next = new Set(tabs);
      if (reversed) next.add(tab);
      else next.delete(tab);
      return next;
    });
    remember(`${SORT_KEY}.${tab}.reversed`, reversed ? '1' : '0');
  }
}
