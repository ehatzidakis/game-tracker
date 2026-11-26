import { Component, computed, DestroyRef, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { LucideLoaderCircle, LucidePlus } from '@lucide/angular';
import { platformIgdbId, platformLabel } from '../../../../api/_lib/platforms.js';
import { DISCOVER_PAGE, IgdbService, type GameSearchResult } from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { PageTitle } from '../../core/page-title';
import { Cover } from '../../shared/cover';
import { DISCOVER, trackedLabel, uniqueGames, whenText } from '../search/discover-lists';

/**
 * One of Search's lists in full (search/:kind, from "See all" by its strip): three covers a row
 * like the Library, 20 at a time, the 21st place a "Load more" tile while IGDB has more.
 */
@Component({
  selector: 'app-discover',
  imports: [RouterLink, Cover, LucidePlus, LucideLoaderCircle],
  template: `
    @if (section(); as s) {
      <h1 class="large-title">{{ s.title }}</h1>
      <p class="-mt-1 text-[15px] leading-5 text-muted">{{ platformName() }}</p>

      @if (query.isPending()) {
        <ul class="mt-4 grid grid-cols-3 gap-x-3 gap-y-5" aria-hidden="true">
          @for (i of placeholders; track i) {
            <li><div class="aspect-3/4 animate-pulse rounded-md bg-group"></div></li>
          }
        </ul>
      } @else if (query.isError()) {
        <div class="mx-auto mt-12 max-w-72 text-center">
          <p class="text-[15px] leading-5 text-muted">Couldn’t load the list. Check your connection.</p>
          <button
            type="button"
            class="mt-3 text-[17px] text-accent active:opacity-60"
            (click)="query.refetch()"
          >
            Try again
          </button>
        </div>
      } @else {
        <ul class="mt-4 grid grid-cols-3 gap-x-3 gap-y-5">
          @for (game of games(); track game.id) {
            @let tracked = library.byId().get(game.id);
            <li class="min-w-0">
              <a [routerLink]="['/game', game.id]" class="block active:opacity-70">
                <app-cover [coverId]="game.coverId" [name]="game.name">
                  @if (tracked) {
                    <span
                      class="absolute bottom-1.5 left-1.5 rounded-[5px] bg-black/70 px-1.5 py-0.75 text-[11px] leading-none font-semibold tracking-normal badge-glass"
                    >
                      {{ trackedLabel(tracked) }}
                    </span>
                  }
                </app-cover>
                <p class="mt-1.5 line-clamp-2 text-[13px] leading-4 tracking-normal">
                  {{ game.name }}
                </p>
                <p class="num mt-0.5 text-[12px] leading-4 tracking-normal text-muted">
                  {{ whenText(game) }}
                </p>
              </a>
            </li>
          } @empty {
            <li class="col-span-3 mt-8 text-center text-[15px] text-muted">
              Nothing here on {{ platformName() }} right now.
            </li>
          }
          @if (query.hasNextPage()) {
            <!-- The next 20, in the place after the last cover. -->
            <li>
              <button
                type="button"
                class="grid aspect-3/4 w-full place-content-center justify-items-center gap-2 rounded-md bg-group text-accent active:opacity-60"
                [attr.aria-label]="query.isFetchNextPageError() ? 'Try again' : 'Load ' + page + ' more'"
                [attr.aria-busy]="query.isFetchingNextPage()"
                (click)="loadMore()"
              >
                <span class="grid size-9 place-items-center rounded-full bg-raised" aria-hidden="true">
                  @if (query.isFetchingNextPage()) {
                    <svg lucideLoaderCircle [size]="20" [strokeWidth]="2.25" class="animate-spin text-muted"></svg>
                  } @else {
                    <svg lucidePlus [size]="20" [strokeWidth]="2.5"></svg>
                  }
                </span>
                <span class="text-[13px] leading-4 font-semibold tracking-normal" aria-hidden="true">
                  {{ query.isFetchNextPageError() ? 'Try again' : 'Load more' }}
                </span>
              </button>
            </li>
          }
        </ul>
      }
    } @else {
      <p class="mt-12 text-center text-[15px] text-muted">There’s no such list.</p>
    }
  `,
})
export class DiscoverPage {
  /** "anticipated", "soon" or "recent", from the route. */
  readonly kind = input.required<string>();
  private readonly igdb = inject(IgdbService);
  protected readonly library = inject(LibraryService);

  protected readonly section = computed(() => DISCOVER.find((d) => d.kind === this.kind()) ?? null);
  private readonly platform = computed(() => this.library.settings().defaultPlatform);
  protected readonly platformName = computed(() => platformLabel(this.platform()));
  protected readonly page = DISCOVER_PAGE;
  protected readonly placeholders = Array.from({ length: 9 }, (_, i) => i);

  protected readonly query = injectInfiniteQuery(() => ({
    queryKey: ['igdb-discover-all', this.kind(), this.platform()],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      this.igdb.discover(
        this.section()!.kind,
        platformIgdbId(this.platform()),
        pageParam,
        DISCOVER_PAGE,
      ),
    initialPageParam: 0,
    // A short page is the last one.
    getNextPageParam: (last: GameSearchResult[], pages: GameSearchResult[][]) =>
      last.length < DISCOVER_PAGE ? undefined : pages.length * DISCOVER_PAGE,
    enabled: !!this.section(),
    staleTime: 60 * 60_000,
  }));
  protected readonly games = computed(() => uniqueGames(this.query.data()?.pages.flat() ?? []));

  protected readonly whenText = whenText;
  protected readonly trackedLabel = trackedLabel;

  constructor() {
    const pageTitle = inject(PageTitle);
    effect(() => pageTitle.override.set(this.section()?.title ?? null));
    inject(DestroyRef).onDestroy(() => pageTitle.override.set(null));
  }

  protected loadMore(): void {
    if (!this.query.isFetchingNextPage()) void this.query.fetchNextPage();
  }
}
