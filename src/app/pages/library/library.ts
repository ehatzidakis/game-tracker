import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronDown, LucideLibraryBig, LucideStar } from '@lucide/angular';
import {
  completionLabel,
  STATUSES,
  type Status,
  type TrackedGame,
} from '../../../../api/_lib/models.js';
import { countdown } from '../../core/dates';
import { LibraryService } from '../../core/library.service';
import { remember, remembered } from '../../core/remembered';
import { Cover } from '../../shared/cover';

type Sort = 'recent' | 'name' | 'release';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'name', label: 'Name' },
  { key: 'release', label: 'Release date' },
];

const EMPTY: Record<Status, { title: string; text: string }> = {
  playing: { title: 'Nothing in progress', text: 'Open a game and set it to Playing.' },
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
  imports: [RouterLink, Cover, LucideChevronDown, LucideLibraryBig, LucideStar],
  templateUrl: './library.html',
})
export class LibraryPage {
  protected readonly library = inject(LibraryService);
  protected readonly statuses = STATUSES;
  protected readonly sorts = SORTS;

  protected readonly filter = signal<Status>(
    remembered(
      'library.filter',
      'playing',
      STATUSES.map((s) => s.key),
    ),
  );
  protected readonly sort = signal<Sort>(
    remembered(
      'library.sort',
      'recent',
      SORTS.map((s) => s.key),
    ),
  );

  protected readonly counts = computed(() => {
    const counts = new Map<Status, number>();
    for (const g of this.library.games()) counts.set(g.status, (counts.get(g.status) ?? 0) + 1);
    return counts;
  });

  protected readonly shown = computed(() =>
    this.library
      .games()
      .filter((g) => g.status === this.filter())
      .sort(compareBy(this.sort())),
  );

  protected readonly emptyTitle = computed(() => EMPTY[this.filter()].title);
  protected readonly emptyText = computed(() => EMPTY[this.filter()].text);

  /** "4 this year · 212 h", shown on the Completed tab. */
  protected readonly completedStats = computed(() => {
    const year = new Date().getFullYear();
    const done = this.library.games().filter((g) => g.status === 'completed');
    const thisYear = done.filter(
      (g) => g.completedAt && new Date(g.completedAt).getFullYear() === year,
    );
    const hours = done.reduce((sum, g) => sum + (g.hoursPlayed ?? 0), 0);
    return { year, thisYear: thisYear.length, hours: Math.round(hours) };
  });
  protected readonly completionLabel = completionLabel;
  protected readonly countdown = countdown;

  protected setFilter(status: Status): void {
    this.filter.set(status);
    remember('library.filter', status);
  }

  protected setSort(event: Event): void {
    const sort = (event.target as HTMLSelectElement).value as Sort;
    this.sort.set(sort);
    remember('library.sort', sort);
  }
}

function compareBy(sort: Sort): (a: TrackedGame, b: TrackedGame) => number {
  const byName = (a: TrackedGame, b: TrackedGame) => a.name.localeCompare(b.name);
  switch (sort) {
    case 'name':
      return byName;
    case 'release':
      // Newest release first; TBA last.
      return (a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || byName(a, b);
    default:
      return (a, b) => b.updatedAt - a.updatedAt;
  }
}
