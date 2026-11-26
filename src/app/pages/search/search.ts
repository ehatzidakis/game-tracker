import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { injectQuery, keepPreviousData } from '@tanstack/angular-query-experimental';
import {
  LucideBuilding2,
  LucideChevronRight,
  LucideCirclePlus,
  LucideCircleX,
  LucideLoaderCircle,
  LucideSearch,
} from '@lucide/angular';
import { countryName } from '../../core/countries';
import { moreCount } from '../../core/show-more';
import { Cover } from '../../shared/cover';
import { EventArt } from '../../shared/event-art';
import { igdbEventDocId } from '../../../../api/_lib/igdb-events.js';
import { daysBetween } from '../../../../api/_lib/release.js';
import { EventsService } from '../../core/events.service';
import { localDate } from '../calendar/calendar-groups';
import { debounced } from '../../core/debounced';
import { today } from '../../core/dates';
import { DISCOVER, trackedLabel, whenText } from './discover-lists';
import {
  coverUrl,
  DISCOVER_STRIP,
  IgdbService,
  logoUrl,
  type CompanySummary,
  type DiscoverKind,
  type EventSummary,
  type GameSearchResult,
} from '../../core/igdb';
import { platformIgdbId, platformLabel } from '../../../../api/_lib/platforms.js';
import { LibraryService } from '../../core/library.service';
import { ToastService } from '../../core/toast.service';
import { ChoiceSheet } from '../../shared/choice-sheet';
import { PinnedTop } from '../../shared/pinned-top';
import { TabTitle } from '../../shared/tab-title';

const MIN_LENGTH = 2;

const EVENT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const EVENT_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
/** How many events, and companies, a search lists at first; "Show N more" adds as many again. */
const SHOWN_EVENTS = 4;
const SHOWN_COMPANIES = 4;

@Component({
  selector: 'app-search',
  imports: [
    TabTitle,
    PinnedTop,
    RouterLink,
    Cover,
    EventArt,
    LucideBuilding2,
    LucideChevronRight,
    LucideSearch,
    LucideCirclePlus,
    LucideCircleX,
    LucideLoaderCircle,
  ],
  templateUrl: './search.html',
})
export class SearchPage {
  private readonly igdb = inject(IgdbService);
  private readonly sheet = inject(ChoiceSheet);
  private readonly toast = inject(ToastService);
  protected readonly library = inject(LibraryService);
  protected readonly events = inject(EventsService);

  /** Starts with ?q= when another screen sends you here to search (the Calendar's no-match link). */
  protected readonly term = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '');
  // IGDB allows about 4 requests a second, so wait for a pause in typing.
  private readonly searchTerm = debounced(
    computed(() => this.term().trim()),
    300,
  );
  protected readonly tooShort = computed(() => this.searchTerm().length < MIN_LENGTH);

  protected readonly results = injectQuery(() => ({
    queryKey: ['igdb-search', this.searchTerm()],
    queryFn: () => this.igdb.search(this.searchTerm()),
    enabled: !this.tooShort(),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  }));

  // Results come in this order: games, then gaming events, then companies.

  /** Gaming events on IGDB whose name has what you typed, newest first, after the games. */
  private readonly eventResults = injectQuery(() => ({
    queryKey: ['igdb-event-search', this.searchTerm()],
    queryFn: () => this.igdb.searchEvents(this.searchTerm()),
    enabled: !this.tooShort(),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  }));
  protected readonly foundEvents = computed(() => this.eventResults.data() ?? []);
  protected readonly eventCount = signal(SHOWN_EVENTS);
  protected readonly shownEvents = computed(() => this.foundEvents().slice(0, this.eventCount()));

  /** Developers and publishers whose name has what you typed, the best-known first, last. */
  private readonly companyResults = injectQuery(() => ({
    queryKey: ['igdb-company-search', this.searchTerm()],
    queryFn: () => this.igdb.searchCompanies(this.searchTerm()),
    enabled: !this.tooShort(),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  }));
  protected readonly foundCompanies = computed(() => this.companyResults.data() ?? []);
  protected readonly companyCount = signal(SHOWN_COMPANIES);
  protected readonly shownCompanies = computed(() =>
    this.foundCompanies().slice(0, this.companyCount()),
  );
  protected readonly more = moreCount;
  protected readonly logoUrl = logoUrl;
  /** "Japan · Developer and publisher" */
  protected companyLine(company: CompanySummary): string {
    return [countryName(company.country), company.role].filter(Boolean).join(' · ');
  }

  /** Events coming up on IGDB, as a strip before you type. */
  private readonly upcomingQuery = injectQuery(() => ({
    queryKey: ['igdb-events-upcoming'],
    queryFn: () => this.igdb.upcomingEvents(),
    staleTime: 60 * 60_000,
  }));
  protected readonly upcomingEvents = computed(() => this.upcomingQuery.data() ?? []);

  protected readonly eventDocId = igdbEventDocId;
  /** "3 Sep 2026" */
  protected eventDate(event: EventSummary): string {
    return EVENT_DATE.format(event.startsAt);
  }
  /** "Mon 30 Nov · in 18 days" for an event that's coming up. */
  protected eventWhen(event: EventSummary): string {
    const days = daysBetween(today(), localDate(event.startsAt));
    const left = days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`;
    return `${EVENT_DAY.format(event.startsAt).replace(',', '')} · ${left}`;
  }

  /** IDs of events being added (fetching their details from IGDB). */
  protected readonly addingEvents = signal<ReadonlySet<number>>(new Set());

  protected async addEvent(event: EventSummary): Promise<void> {
    this.addingEvents.update((ids) => new Set(ids).add(event.id));
    try {
      const details = await this.igdb.event(event.id);
      if (!details) throw new Error(`IGDB has no event ${event.id}`);
      this.events.addFromIgdb(details);
    } catch (error) {
      this.toast.error(`Couldn't add ${event.name}. Check your connection and try again.`, error);
    } finally {
      this.addingEvents.update((ids) => {
        const next = new Set(ids);
        next.delete(event.id);
        return next;
      });
    }
  }

  /**
   * Strips of games to browse before you type, 10 each; "See all" opens one in full
   * (pages/discover). They refresh at most once an hour.
   */
  private readonly platform = computed(() => this.library.settings().defaultPlatform);
  protected readonly platformName = computed(() => platformLabel(this.platform()));
  private readonly discoverQueries = DISCOVER.map(({ kind }) =>
    injectQuery(() => ({
      queryKey: ['igdb-discover', kind, this.platform(), DISCOVER_STRIP],
      queryFn: () => this.igdb.discover(kind, platformIgdbId(this.platform())),
      staleTime: 60 * 60_000,
    })),
  );
  protected readonly discover = computed(() =>
    DISCOVER.map((section, i) => {
      const games = this.discoverQueries[i].data() ?? [];
      return {
        ...section,
        games,
        loading: this.discoverQueries[i].isPending(),
        // A full strip: there may be more.
        full: games.length >= DISCOVER_STRIP,
      };
    }),
  );

  protected readonly whenText = whenText;

  /** IDs of games being added (fetching their details from IGDB). */
  protected readonly adding = signal<ReadonlySet<number>>(new Set());

  protected readonly coverUrl = coverUrl;
  protected readonly trackedLabel = trackedLabel;

  protected onInput(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
    this.eventCount.set(SHOWN_EVENTS);
    this.companyCount.set(SHOWN_COMPANIES);
  }

  protected async add(game: GameSearchResult): Promise<void> {
    // DLC goes straight to the wishlist; mark it owned on its page or its main game's page.
    const choice = game.dlcOf
      ? { status: 'wishlist' as const, completion: null }
      : await this.sheet.addTo(game.name, game.upcoming ? 'wishlist' : 'backlog');
    if (!choice) return;

    this.adding.update((ids) => new Set(ids).add(game.id));
    try {
      const details = await this.igdb.game(game.id);
      if (!details) throw new Error(`IGDB has no game ${game.id}`);
      this.library.add(details, choice.status, choice.completion, game.dlcOf);
    } catch (error) {
      this.toast.error(`Couldn't add ${game.name}. Check your connection and try again.`, error);
    } finally {
      this.adding.update((ids) => {
        const next = new Set(ids);
        next.delete(game.id);
        return next;
      });
    }
  }
}
