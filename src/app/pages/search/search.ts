import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { Cover } from '../../shared/cover';
import { EventArt } from '../../shared/event-art';
import { igdbEventDocId } from '../../../../api/_lib/igdb-events.js';
import { daysBetween } from '../../../../api/_lib/release.js';
import { EventsService } from '../../core/events.service';
import { localDate } from '../calendar/calendar-groups';
import { isDlc, statusLabel, type TrackedGame } from '../../../../api/_lib/models.js';
import { debounced } from '../../core/debounced';
import { countdown, today } from '../../core/dates';
import {
  coverUrl,
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

const MIN_LENGTH = 2;

/** What Search shows before you type, on your default platform. */
const DISCOVER: { kind: DiscoverKind; title: string }[] = [
  { kind: 'anticipated', title: 'Most anticipated' },
  { kind: 'soon', title: 'Coming soon' },
  { kind: 'recent', title: 'Recently released' },
];
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
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
/** How many events, and companies, a search lists before "Show all". */
const SHOWN_EVENTS = 4;
const SHOWN_COMPANIES = 4;

@Component({
  selector: 'app-search',
  imports: [
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

  protected readonly term = signal('');
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
  protected readonly allEvents = signal(false);
  protected readonly shownEvents = computed(() =>
    this.allEvents() ? this.foundEvents() : this.foundEvents().slice(0, SHOWN_EVENTS),
  );

  /** Developers and publishers whose name has what you typed, the best-known first, last. */
  private readonly companyResults = injectQuery(() => ({
    queryKey: ['igdb-company-search', this.searchTerm()],
    queryFn: () => this.igdb.searchCompanies(this.searchTerm()),
    enabled: !this.tooShort(),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  }));
  protected readonly foundCompanies = computed(() => this.companyResults.data() ?? []);
  protected readonly allCompanies = signal(false);
  protected readonly shownCompanies = computed(() =>
    this.allCompanies() ? this.foundCompanies() : this.foundCompanies().slice(0, SHOWN_COMPANIES),
  );
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

  /** Strips of games to browse before you type. They refresh at most once an hour. */
  private readonly platform = computed(() => this.library.settings().defaultPlatform);
  protected readonly platformName = computed(() => platformLabel(this.platform()));
  private readonly discoverQueries = DISCOVER.map(({ kind }) =>
    injectQuery(() => ({
      queryKey: ['igdb-discover', kind, this.platform()],
      queryFn: () => this.igdb.discover(kind, platformIgdbId(this.platform())),
      staleTime: 60 * 60_000,
    })),
  );
  protected readonly discover = computed(() =>
    DISCOVER.map((section, i) => ({
      ...section,
      games: this.discoverQueries[i].data() ?? [],
      loading: this.discoverQueries[i].isPending(),
    })),
  );

  /** "Thu 19 Nov · in 11 days" style line under a cover. */
  protected whenText(game: GameSearchResult): string {
    if (!game.releaseDate) return game.year ? String(game.year) : 'TBA';
    const ms = Date.parse(game.releaseDate);
    const left = countdown({ releaseDate: game.releaseDate, releasePrecision: 'day' });
    return left ?? SHORT_DATE.format(ms);
  }

  /** IDs of games being added (fetching their details from IGDB). */
  protected readonly adding = signal<ReadonlySet<number>>(new Set());

  protected readonly coverUrl = coverUrl;
  /** What a tracked result shows instead of the + button. */
  protected trackedLabel(game: TrackedGame): string {
    if (!isDlc(game) || game.status === 'wishlist') return statusLabel(game.status);
    return game.status === 'completed' ? 'Completed' : 'Owned';
  }

  protected onInput(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
    this.allEvents.set(false);
    this.allCompanies.set(false);
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
