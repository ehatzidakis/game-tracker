import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectQuery, keepPreviousData } from '@tanstack/angular-query-experimental';
import { LucideLoaderCircle, LucidePlus, LucideSearch } from '@lucide/angular';
import { statusLabel } from '../../../../api/_lib/models.js';
import { debounced } from '../../core/debounced';
import { coverUrl, IgdbService, type GameSearchResult } from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { ToastService } from '../../core/toast.service';
import { StatusPicker } from '../../shared/status-picker';

const MIN_LENGTH = 2;

@Component({
  selector: 'app-search',
  imports: [RouterLink, LucideSearch, LucidePlus, LucideLoaderCircle],
  templateUrl: './search.html',
})
export class SearchPage {
  private readonly igdb = inject(IgdbService);
  private readonly picker = inject(StatusPicker);
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

  /** IDs of games being added (fetching their details from IGDB). */
  protected readonly adding = signal<ReadonlySet<number>>(new Set());

  protected readonly coverUrl = coverUrl;
  protected readonly statusLabel = statusLabel;

  protected onInput(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
  }

  protected async add(game: GameSearchResult): Promise<void> {
    const status = await this.picker.pick(game.name, game.upcoming ? 'wishlist' : 'backlog');
    if (!status) return;

    this.adding.update((ids) => new Set(ids).add(game.id));
    try {
      const details = await this.igdb.game(game.id);
      if (!details) throw new Error(`IGDB has no game ${game.id}`);
      this.library.add(details, status);
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
