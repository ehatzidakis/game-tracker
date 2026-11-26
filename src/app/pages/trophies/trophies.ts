import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { LucideCircleCheck, LucideEyeOff, LucideTrophy } from '@lucide/angular';
import type { TrophyCounts } from '../../../../api/_lib/models.js';
import type { TrophyItem, TrophyListView } from '../../../../api/_lib/psn-trophies.js';
import { LibraryService } from '../../core/library.service';
import { PsnService } from '../../core/psn.service';

export type TrophyFilter = 'all' | 'earned' | 'left';

/** Not earned first, then the rarest (unknown rarity last), then PlayStation's own order. */
export function sortTrophies(trophies: readonly TrophyItem[]): TrophyItem[] {
  return [...trophies].sort(
    (a, b) =>
      Number(a.earned) - Number(b.earned) ||
      (a.rate ?? Infinity) - (b.rate ?? Infinity) ||
      a.id - b.id,
  );
}

export function filterTrophies(trophies: readonly TrophyItem[], filter: TrophyFilter): TrophyItem[] {
  if (filter === 'all') return [...trophies];
  return trophies.filter((t) => t.earned === (filter === 'earned'));
}

const EARNED_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * A game's trophies (game/:id/trophies, from the Trophies card on its page): the totals as on
 * the card, a filter, then every trophy by part of the game (the game itself, then each add-on),
 * with its description, when you earned it or how far along you are, its grade and how rare it is.
 * Read from PlayStation each time it opens (api/psn-trophies.ts).
 */
@Component({
  selector: 'app-trophies',
  imports: [LucideTrophy, LucideEyeOff, LucideCircleCheck],
  template: `
    <h1 class="large-title">Trophies</h1>
    @if (game(); as g) {
      <p class="-mt-1 text-[15px] leading-5 text-muted">{{ g.name }}</p>
    }

    <!-- The totals, as on the game's Trophies card. -->
    @if (summary(); as tr) {
      <section class="grouped mt-4 px-4 py-3" aria-label="Trophies earned">
        <div class="num flex items-baseline justify-between gap-3">
          <p class="flex items-center gap-1.5 text-[17px] leading-5.5 font-semibold">
            <svg lucideTrophy [size]="16" [strokeWidth]="2.25" class="shrink-0 self-center"></svg>
            {{ tr.earned }}<span class="text-[13px] font-normal text-muted">/{{ tr.of }}</span>
          </p>
          <p class="text-[17px] leading-5.5 font-semibold">{{ tr.progress }}%</p>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
          <div class="h-full rounded-full bg-label" [style.width.%]="tr.progress"></div>
        </div>
        <p
          class="num mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px] leading-5 text-muted"
        >
          @for (g of tr.grades; track g.grade) {
            <span class="flex items-center gap-1" [attr.aria-label]="g.earned + ' ' + g.grade">
              <span class="flex shrink-0" [class]="'trophy-' + g.grade" aria-hidden="true">
                <svg lucideTrophy [size]="14" [strokeWidth]="2.25"></svg>
              </span>
              <span aria-hidden="true"
                >{{ g.earned }}<span class="text-faint">/{{ g.of }}</span></span
              >
            </span>
          }
        </p>
      </section>
    }

    @if (list(); as l) {
      <div class="segmented mt-4" role="radiogroup" aria-label="Show">
        @for (f of filters(); track f.key) {
          <button
            type="button"
            role="radio"
            class="num"
            [attr.aria-checked]="filter() === f.key"
            (click)="filter.set(f.key)"
          >
            {{ f.label }} {{ f.count }}
          </button>
        }
      </div>

      @for (group of groups(); track group.id) {
        <section [attr.aria-label]="group.name">
          @if (l.groups.length > 1) {
            <h2 class="group-header flex justify-between gap-3">
              <span class="min-w-0 truncate">{{ group.name }}</span>
              <span class="num shrink-0">{{ group.earned }}/{{ group.total }}</span>
            </h2>
          } @else {
            <div class="h-4"></div>
          }
          <ul class="grouped" style="--sep-inset: 76px">
            @for (t of group.trophies; track t.id) {
              @let secret = t.hidden && !t.earned && !revealed().has(t.id);
              <li class="row items-start">
                <!-- The trophy's art; faded and grey until it's earned. -->
                @if (secret || !t.icon) {
                  <span
                    class="grid size-12 shrink-0 place-items-center rounded-lg bg-raised text-muted"
                    aria-hidden="true"
                  >
                    @if (secret) {
                      <svg lucideEyeOff [size]="20" [strokeWidth]="2"></svg>
                    } @else {
                      <svg lucideTrophy [size]="20" [strokeWidth]="2"></svg>
                    }
                  </span>
                } @else {
                  <img
                    [src]="t.icon"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    class="size-12 shrink-0 rounded-lg bg-raised object-cover"
                    [class.grayscale]="!t.earned"
                    [class.opacity-45]="!t.earned"
                  />
                }
                <div class="min-w-0 flex-1">
                  @if (secret) {
                    <p class="text-[17px] leading-5.5 font-semibold text-muted">Hidden trophy</p>
                    <button
                      type="button"
                      class="text-[15px] leading-5 text-accent active:opacity-60"
                      (click)="reveal(t.id)"
                    >
                      Show what it is
                    </button>
                  } @else {
                    <p class="text-[17px] leading-5.5 font-semibold">
                      {{ t.name }}
                      <!-- A hidden trophy keeps saying so once it's shown (or earned). -->
                      @if (t.hidden) {
                        <span
                          class="ml-1 inline-flex translate-y-[-1px] items-center gap-1 rounded-full bg-fill px-1.5 py-px align-middle text-[11px] leading-4 font-semibold text-muted"
                        >
                          <svg lucideEyeOff [size]="11" [strokeWidth]="2.5" aria-hidden="true"></svg>
                          Hidden
                        </span>
                      }
                    </p>
                    @if (t.detail) {
                      <p class="mt-0.5 text-[15px] leading-5 text-muted">{{ t.detail }}</p>
                    }
                    @if (t.hidden && !t.earned) {
                      <button
                        type="button"
                        class="mt-0.5 text-[15px] leading-5 text-accent active:opacity-60"
                        (click)="hide(t.id)"
                      >
                        Hide again
                      </button>
                    }
                  }
                  @if (t.earned && t.earnedAt) {
                    <!-- A status line, not more description: a blue check, then the date. -->
                    <p class="num mt-1.5 flex items-center gap-1 text-[13px] leading-4.5 font-medium">
                      <svg
                        lucideCircleCheck
                        [size]="14"
                        [strokeWidth]="2.5"
                        class="shrink-0 text-accent"
                        aria-hidden="true"
                      ></svg>
                      Earned {{ date(t.earnedAt) }}
                    </p>
                  } @else if (!t.earned && t.progress; as p) {
                    <div class="mt-1.5 flex items-center gap-2">
                      <div
                        class="h-1.5 flex-1 overflow-hidden rounded-full bg-raised"
                        aria-hidden="true"
                      >
                        <div
                          class="h-full rounded-full bg-label"
                          [style.width.%]="(p.value / p.target) * 100"
                        ></div>
                      </div>
                      <span
                        class="num shrink-0 text-[13px] leading-4.5 text-muted"
                        [attr.aria-label]="p.value + ' of ' + p.target"
                        >{{ p.value }}/{{ p.target }}</span
                      >
                    </div>
                  }
                </div>
                <!-- Its grade, and how many players have it. -->
                <div class="num flex shrink-0 flex-col items-end gap-1 pt-0.5">
                  <span
                    class="flex"
                    [class]="'trophy-' + t.grade"
                    role="img"
                    [attr.aria-label]="gradeLabel(t.grade)"
                  >
                    <svg lucideTrophy [size]="16" [strokeWidth]="2.25"></svg>
                  </span>
                  @if (t.rate !== null) {
                    <span
                      class="text-[13px] leading-4.5 text-muted"
                      [attr.aria-label]="t.rate + '% of players have it'"
                      >{{ t.rate }}%</span
                    >
                  }
                </div>
              </li>
            } @empty {
              <li class="row text-[15px] text-muted">
                {{ filter() === 'earned' ? 'None earned yet.' : 'All earned.' }}
              </li>
            }
          </ul>
        </section>
      }
      <p class="group-footer">
        Rarity is the share of PlayStation players who have the trophy. Hidden trophies stay hidden
        until you earn them, or tap to see them.
      </p>
    } @else if (error(); as message) {
      <div class="mx-auto mt-12 max-w-72 text-center">
        <p class="text-[15px] leading-5 text-muted">{{ message }}</p>
        <button
          type="button"
          class="mt-3 text-[17px] text-accent active:opacity-60"
          (click)="load()"
        >
          Try again
        </button>
      </div>
    } @else {
      <p class="mt-12 text-center text-[15px] text-muted">Loading trophies…</p>
    }
  `,
})
export class TrophiesPage {
  /** The game's IGDB id, from the route. */
  readonly id = input.required<string>();
  private readonly library = inject(LibraryService);
  private readonly psn = inject(PsnService);

  protected readonly game = computed(() =>
    this.library.games().find((g) => g.igdbId === Number(this.id())),
  );
  protected readonly list = signal<TrophyListView | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<TrophyFilter>('all');
  /** Hidden trophies you've tapped to see (not kept). */
  protected readonly revealed = signal<ReadonlySet<number>>(new Set());

  /** The card's totals, from the library (so they show before PlayStation answers). */
  protected readonly summary = computed(() => {
    const t = this.game()?.playstation?.trophies;
    if (!t) return null;
    const sum = (c: TrophyCounts) => c.bronze + c.silver + c.gold + c.platinum;
    const grades = (['platinum', 'gold', 'silver', 'bronze'] as const)
      .filter((grade) => t.defined[grade] > 0)
      .map((grade) => ({ grade, earned: t.earned[grade], of: t.defined[grade] }));
    return { earned: sum(t.earned), of: sum(t.defined), progress: t.progress, grades };
  });

  private readonly all = computed(() => this.list()?.groups.flatMap((g) => g.trophies) ?? []);
  protected readonly filters = computed(() => {
    const all = this.all();
    const earned = all.filter((t) => t.earned).length;
    return [
      { key: 'all' as const, label: 'All', count: all.length },
      { key: 'earned' as const, label: 'Earned', count: earned },
      { key: 'left' as const, label: 'Not earned', count: all.length - earned },
    ];
  });

  /** Each part of the game with the trophies the filter leaves, sorted; empty parts left out. */
  protected readonly groups = computed(() => {
    const list = this.list();
    if (!list) return [];
    return list.groups
      .map((g) => ({
        id: g.id,
        name: g.name,
        earned: g.trophies.filter((t) => t.earned).length,
        total: g.trophies.length,
        trophies: sortTrophies(filterTrophies(g.trophies, this.filter())),
      }))
      .filter((g, i, all) => g.trophies.length || all.every((x) => !x.trophies.length) && i === 0);
  });

  constructor() {
    effect(() => {
      this.id();
      void this.load();
    });
  }

  protected async load(): Promise<void> {
    this.error.set(null);
    try {
      this.list.set(await this.psn.trophies(Number(this.id())));
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }

  protected reveal(id: number): void {
    this.revealed.set(new Set([...this.revealed(), id]));
  }

  protected hide(id: number): void {
    this.revealed.set(new Set([...this.revealed()].filter((x) => x !== id)));
  }

  protected date(ms: number): string {
    return EARNED_DATE.format(ms);
  }

  protected gradeLabel(grade: string): string {
    return grade[0].toUpperCase() + grade.slice(1);
  }
}
