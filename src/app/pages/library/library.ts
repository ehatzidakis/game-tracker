import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowUpDown,
  LucideChevronDown,
  LucideChevronRight,
  LucideDisc3,
  LucideLibraryBig,
  LucideStar,
  LucideTrophy,
} from '@lucide/angular';
import {
  isDlc,
  shownInLibrary,
  statusLabel,
  type Status,
  type TrackedGame,
} from '../../../../api/_lib/models.js';
import { countdown, today } from '../../core/dates';
import { formatPlaytime, formatPlaytimeClock } from '../../core/playtime';
import { LibraryService } from '../../core/library.service';
import { remember, remembered } from '../../core/remembered';
import { Cover } from '../../shared/cover';
import { SearchField } from '../../shared/search-field';
import {
  compareBy,
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

/** Bump to reset everyone's remembered sorts to the defaults (2: per-tab defaults, 2026-11-08). */
const SORT_KEY = 'library.sort.v2';

/**
 * The tab you're on, kept while the app is open (so coming back from a game keeps it).
 * The app always opens on Completed.
 */
let currentTab: Status = 'completed';
/** What's in the search field, kept while the app is open (so coming back from a game keeps it). */
let currentQuery = '';
/** Completed tab showing only Platinum games, kept while the app is open. */
let platinumOnlyNow = false;
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
    SearchField,
    LucideArrowUpDown,
    LucideChevronDown,
    LucideChevronRight,
    LucideDisc3,
    LucideLibraryBig,
    LucideStar,
    LucideTrophy,
  ],
  templateUrl: './library.html',
})
export class LibraryPage {
  protected readonly library = inject(LibraryService);
  protected readonly tabs = LIBRARY_TABS.map((key) => ({ key, label: statusLabel(key) }));
  protected readonly filter = signal<Status>(currentTab);
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

  protected readonly shown = computed(() =>
    this.listed()
      .filter((g) => g.status === this.filter())
      .filter((g) => !this.onlyPlatinum() || g.completion === 'platinum')
      .sort(compareBy(this.sort(), this.filter(), today(), this.reversed()))
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

  protected readonly emptyTitle = computed(() =>
    this.onlyPlatinum() ? 'No Platinum games yet' : EMPTY[this.filter()].title,
  );
  protected readonly emptyText = computed(() =>
    this.onlyPlatinum()
      ? 'Games you completed with every trophy show here. Tap the trophy to see them all.'
      : EMPTY[this.filter()].text,
  );

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

  protected setFilter(status: Status): void {
    this.filter.set(status);
    currentTab = status;
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
