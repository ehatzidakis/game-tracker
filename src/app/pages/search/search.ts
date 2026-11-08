import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectQuery, keepPreviousData } from '@tanstack/angular-query-experimental';
import { LucideCirclePlus, LucideCircleX, LucideLoaderCircle, LucideSearch } from '@lucide/angular';
import { Cover } from '../../shared/cover';
import { isDlc, statusLabel, type TrackedGame } from '../../../../api/_lib/models.js';
import { debounced } from '../../core/debounced';
import { countdown } from '../../core/dates';
import { coverUrl, IgdbService, type DiscoverKind, type GameSearchResult } from '../../core/igdb';
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

@Component({
  selector: 'app-search',
  imports: [RouterLink, Cover, LucideSearch, LucideCirclePlus, LucideCircleX, LucideLoaderCircle],
  templateUrl: './search.html',
})
export class SearchPage {
  private readonly igdb = inject(IgdbService);
  private readonly sheet = inject(ChoiceSheet);
  private readonly toast = inject(ToastService);
  protected readonly library = inject(LibraryService);

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
