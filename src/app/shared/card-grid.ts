import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronDown, LucideTrophy } from '@lucide/angular';
import {
  isDlc,
  statusLabel,
  type EventKind,
  type TrackedGame,
} from '../../../api/_lib/models.js';
import { moreCount } from '../core/show-more';
import { Cover } from './cover';
import { EventArt } from './event-art';

/** One card: a game's cover or an event's logo, with a line or two under it. */
export interface GridCard {
  /** Unique in the list. */
  id: string | number;
  link: (string | number)[];
  name: string;
  /** A game's cover. */
  coverId?: string | null;
  /** An event: its logo, or its host's icon when it has none. */
  event?: { logoId: string | null; kind: EventKind };
  /** Under the card: "2019", "Dec 2024", "Cancelled". */
  line: string;
  /** Under that, in white: your status ("Wishlist", "Completed"). */
  status?: string | null;
  /** The Platinum trophy on the cover. */
  platinum?: boolean;
  /** Greyed out: a cancelled game, an archived event. */
  dim?: boolean;
  /** The filters it's in (their keys). */
  tags: readonly string[];
}

/** A filter in the pill's menu; ones with a group (Year, Company) are listed under its name. */
export interface GridFilter {
  key: string;
  title: string;
  group?: string;
}

/** "2019", or "TBA" with no date yet. */
export function yearOf(date: number | undefined): string {
  return date ? String(new Date(date * 1000).getUTCFullYear()) : 'TBA';
}

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

/** Under an event's card: "13 Dec" this year, "Dec 2024" other years (a whole date won't fit). */
export function eventDateLine(ms: number, now = new Date()): string {
  return new Date(ms).getFullYear() === now.getFullYear()
    ? DAY_MONTH.format(ms)
    : MONTH_YEAR.format(ms);
}

/** Your status and Platinum for a game card, from your copy of the game (if you have one). */
export function gameMarks(game: TrackedGame | undefined): Pick<GridCard, 'status' | 'platinum'> {
  if (!game) return {};
  return {
    status: isDlc(game) && game.status === 'backlog' ? 'Owned' : statusLabel(game.status),
    platinum: game.status === 'completed' && game.completion === 'platinum',
  };
}

/**
 * A list of games or events as a grid of cards, five a row, under a toolbar like the Library's:
 * the list's name and how many, and a filter pill with the real menu laid invisibly on top. The
 * first few rows show; "Show N more" adds as many again.
 */
@Component({
  selector: 'app-card-grid',
  imports: [RouterLink, Cover, EventArt, LucideChevronDown, LucideTrophy],
  host: { class: 'block' },
  template: `
    <div class="mt-6 flex min-h-8 items-center gap-2">
      @if (title(); as t) {
        <!-- Named like the page's other sections. -->
        <h2 class="num min-w-0 truncate text-[13px] leading-4.5 text-muted uppercase">
          {{ t }} · {{ filtered().length }}
        </h2>
      } @else {
        <h2 class="num min-w-0 truncate text-[15px] leading-5 text-muted">{{ countLine() }}</h2>
      }
      @if (menu().length) {
        <label
          class="relative ml-auto flex h-8 shrink-0 items-center gap-1 rounded-full bg-group pr-3 pl-3.5 text-base text-accent active:bg-pressed"
        >
          <span class="sr-only">Show</span>
          <span aria-hidden="true">{{ filterTitle() }}</span>
          <svg lucideChevronDown [size]="16" [strokeWidth]="2.5" aria-hidden="true"></svg>
          <!-- 16px or more so iOS doesn't zoom in when it opens. -->
          <select
            class="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full text-base opacity-0"
            (change)="setFilter($event)"
          >
            <option value="" [selected]="!filter()">{{ allLabel() }} · {{ cards().length }}</option>
            @for (group of menu(); track group.name) {
              @if (group.name) {
                <optgroup [label]="group.name">
                  @for (f of group.filters; track f.key) {
                    <option [value]="f.key" [selected]="f.key === filter()">
                      {{ f.title }} · {{ f.count }}
                    </option>
                  }
                </optgroup>
              } @else {
                @for (f of group.filters; track f.key) {
                  <option [value]="f.key" [selected]="f.key === filter()">
                    {{ f.title }} · {{ f.count }}
                  </option>
                }
              }
            }
          </select>
        </label>
      }
    </div>

    <ul class="mt-3 grid grid-cols-5 gap-x-2 gap-y-3">
      @for (card of shown(); track card.id) {
        <li class="min-w-0">
          <a [routerLink]="card.link" class="block active:opacity-70" [attr.aria-label]="label(card)">
            @if (card.event; as e) {
              <app-event-art
                class="aspect-3/4 rounded-md"
                fit="contain"
                [class.dimmed]="card.dim"
                [logoId]="e.logoId"
                [kind]="e.kind"
                [iconSize]="28"
              />
            } @else {
              <app-cover [coverId]="card.coverId" [name]="card.name" [class.dimmed]="card.dim">
                @if (card.platinum) {
                  <span
                    class="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-black/75 ring-[0.5px] ring-white/20 backdrop-blur-sm"
                    aria-hidden="true"
                  >
                    <svg lucideTrophy [size]="11" [strokeWidth]="2.25"></svg>
                  </span>
                }
              </app-cover>
            }
            @if (card.event) {
              <!-- An event's logo is small at this size, and your own events show only their
                   host's icon: the name says which it is. -->
              <p class="mt-1 line-clamp-2 text-[12px] leading-4 tracking-normal" aria-hidden="true">
                {{ card.name }}
              </p>
            }
            <p
              class="num truncate text-[12px] leading-4 tracking-normal text-muted"
              [class.mt-1]="!card.event"
              aria-hidden="true"
            >
              {{ card.line }}
            </p>
            @if (card.status) {
              <p class="truncate text-[12px] leading-4 tracking-normal" aria-hidden="true">
                {{ card.status }}
              </p>
            }
          </a>
        </li>
      }
    </ul>
    @if (filtered().length > shown().length) {
      <button
        type="button"
        class="mt-3 text-[15px] leading-5 text-accent active:opacity-60"
        (click)="count.set(count() + more())"
      >
        Show {{ more() }} more
      </button>
    }
  `,
  styles: `
    /* A cancelled game or an archived event: greyed out and faded. */
    .dimmed {
      filter: grayscale(1);
      opacity: 0.45;
    }
  `,
})
export class CardGrid {
  readonly cards = input.required<readonly GridCard[]>();
  readonly filters = input<readonly GridFilter[]>([]);
  /** The list's name ("Shown at"); without one, the toolbar says "80 games". */
  readonly title = input<string | null>(null);
  /** "game" → "1 game", "80 games". */
  readonly noun = input('game');
  /** The menu's first choice: every card. */
  readonly allLabel = input('All');
  /** How many show at first: rows of five. */
  readonly initial = input(10);
  /** Starts the grid afresh (no filter, the first rows) when it changes: a new game, company… */
  readonly resetKey = input<unknown>(null);

  protected readonly filter = signal<string | null>(null);
  protected readonly count = signal(10);

  constructor() {
    effect(() => {
      this.resetKey();
      const initial = this.initial();
      untracked(() => {
        this.filter.set(null);
        this.count.set(initial);
      });
    });
  }

  /**
   * The filters that have cards, with how many, ungrouped first, then each group. None when no
   * filter would leave anything out (every game in a series a main game, say).
   */
  protected readonly menu = computed(() => {
    const total = this.cards().length;
    const counts = this.filters().map((f) => ({
      ...f,
      count: this.cards().filter((c) => c.tags.includes(f.key)).length,
    }));
    if (!counts.some((f) => f.count && f.count < total)) return [];
    const groups = new Map<string, { key: string; title: string; count: number }[]>();
    for (const f of counts) {
      const count = f.count;
      if (!count) continue;
      const name = f.group ?? '';
      groups.set(name, [...(groups.get(name) ?? []), { key: f.key, title: f.title, count }]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => Number(!!a) - Number(!!b))
      .map(([name, filters]) => ({ name, filters }));
  });

  protected readonly filtered = computed(() => {
    const key = this.filter();
    return key ? this.cards().filter((c) => c.tags.includes(key)) : this.cards();
  });
  protected readonly shown = computed(() => this.filtered().slice(0, this.count()));
  protected readonly more = computed(() => moreCount(this.shown().length, this.filtered().length));

  protected readonly filterTitle = computed(
    () => this.filters().find((f) => f.key === this.filter())?.title ?? this.allLabel(),
  );
  protected readonly countLine = computed(() => {
    const n = this.filtered().length;
    return `${n} ${this.noun()}${n === 1 ? '' : 's'}`;
  });

  protected setFilter(event: Event): void {
    this.filter.set((event.target as HTMLSelectElement).value || null);
    this.count.set(this.initial());
  }

  /** "Elden Ring, 2022, Completed, Platinum" for screen readers. */
  protected label(card: GridCard): string {
    return [card.name, card.line, card.status, card.platinum ? 'Platinum' : null]
      .filter(Boolean)
      .join(', ');
  }
}
