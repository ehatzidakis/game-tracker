import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';
import {
  COMPLETIONS,
  COPY_TYPES,
  notBought,
  copyOf,
  HLTB_TIMES,
  STATUSES,
  type Completion,
  type CopyType,
  type HltbTimes,
  type Status,
  type TrackedGame,
} from '../../../api/_lib/models.js';
import { LucideExternalLink } from '@lucide/angular';
import { SheetError, SheetErrorNote } from './sheet-error';
import type { OwnScores } from '../../../api/_lib/opencritic-match.js';
import { parsePlaytime, splitPlaytime } from '../core/playtime';
import { FitWidth } from './fit-content';
import { RatingSlider } from './rating-slider';

/** Your own data about a game: what you paid, where and when, and how long you played. */
export interface MyData {
  pricePaid: number | null;
  boughtFrom: string | null;
  /** "YYYY-MM-DD" */
  orderedOn: string | null;
  /** Physical, digital, subscription or rent; null: not said. */
  copy: CopyType | null;
  /** Kept in step with copy (copy === 'physical'), for app versions that only know it. */
  physical: boolean;
  /** You sold it, and for how much (optional). Asked on a game's page once you own it. */
  sold: boolean;
  soldFor: number | null;
  hoursPlayed: number | null;
  /** Milliseconds. */
  completedAt: number | null;
  completion: Completion | null;
  hltb: HltbTimes | null;
}

export type { OwnScores };

/**
 * What "Edit my data" saves: your data, and the status and rating it also edits. `scores` only
 * when they changed.
 */
export type SheetResult = Partial<MyData> & {
  status?: Status;
  rating?: number | null;
  scores?: OwnScores;
};

/**
 * For "Edit my data" on a game's page: the status and rating are edited here too, and the other
 * fields follow the status you pick (purchase details once you own it, how far you got and the
 * rating once it's completed).
 */
export interface StatusEdit {
  status: Status;
  rating: number | null;
  released: boolean;
  /** PlayStation has the playtime, so it isn't typed in. */
  hoursFromPsn: boolean;
  preordered: boolean;
  /** The statuses offered (all of them when missing). */
  statuses?: readonly Status[];
}

/** Which fields the sheet asks for. */
export interface SheetFields {
  purchase: boolean;
  hours: boolean;
  /** How far you got (the completed date isn't edited: it's set when you complete it). */
  completed: boolean;
}

/**
 * A button under the fields that does something right away, without closing the sheet ("Check
 * OpenCritic now"). `run` answers with what to show under it.
 */
export interface SheetAction {
  label: string;
  busyLabel: string;
  run: () => Promise<string>;
}

/**
 * The scores in "Edit my data", for games OpenCritic gets wrong: the ones typed in before (if
 * any), and the ones the game shows now, as hints in the empty fields.
 */
export interface ScoresEdit {
  own: OwnScores;
  shown: OwnScores;
}

/** "Edit my data" on a game's page, beyond your own fields. */
export interface EditExtras {
  scores?: ScoresEdit;
  /** HowLongToBeat's search for the game, over its three times. */
  hltbUrl?: string;
  /** Under the scores: "Check OpenCritic now". */
  action?: SheetAction;
}

interface SheetRequest {
  /** "Pre-order details", "Purchase details", "Your data". */
  title: string;
  name: string;
  /** "Preordered on" for pre-orders, "Bought on" otherwise. */
  dateLabel: string;
  /** A pre-order: you're buying it, so Copy has no Subscription. */
  preorder?: boolean;
  /** "Skip" when asked as you buy or pre-order, "Cancel" when editing. */
  dismiss: string;
  /** The button that saves: "Save", or "Add" when adding a game. */
  confirm?: string;
  fields: SheetFields;
  initial: Partial<MyData>;
  /** Present for "Edit my data": the status and rating, with what the fields depend on. */
  statusEdit?: StatusEdit;
  /** Stores you've used before, then common ones, as buttons. */
  stores: string[];
  today: string;
  extras?: EditExtras;
  resolve: (data: SheetResult | null) => void;
}

/**
 * Asks for or edits your data on a game, as a bottom sheet. Everything is optional. Resolves to
 * the fields it showed (to save), or null if you skip or cancel.
 */
@Injectable({ providedIn: 'root' })
export class DetailsSheet {
  readonly request = signal<SheetRequest | null>(null);

  /** When you pre-order a game or buy one that's out: what, where and when (all optional). */
  askPurchase(
    kind: 'preorder' | 'purchase',
    name: string,
    today: string,
    stores: string[],
  ): Promise<Partial<MyData> | null> {
    return this.open({
      title: kind === 'preorder' ? 'Pre-order details for ' : 'Purchase details for ',
      name,
      dateLabel: kind === 'preorder' ? 'Preordered on' : 'Bought on',
      preorder: kind === 'preorder',
      dismiss: 'Skip',
      fields: { purchase: true, hours: false, completed: false },
      initial: { orderedOn: today },
      stores,
      today,
    });
  }

  /**
   * "Edit my data" on a game's page: its status and rating, and the fields that apply, filled with
   * what you entered.
   */
  edit(
    game: TrackedGame,
    fields: SheetFields,
    today: string,
    stores: string[],
    statusEdit?: StatusEdit,
    extras?: EditExtras,
  ): Promise<SheetResult | null> {
    return this.open({
      title: 'Your data for ',
      extras,
      name: game.name,
      dateLabel: game.preordered ? 'Preordered on' : 'Bought on',
      preorder: !!game.preordered,
      dismiss: 'Cancel',
      fields,
      initial: {
        pricePaid: game.pricePaid ?? null,
        boughtFrom: game.boughtFrom ?? null,
        orderedOn: game.orderedOn ?? null,
        copy: copyOf(game),
        physical: copyOf(game) === 'physical',
        sold: !!game.sold,
        soldFor: game.soldFor ?? null,
        hoursPlayed: game.hoursPlayed,
        completedAt: game.completedAt,
        completion: game.completion,
        hltb: game.hltb ?? null,
      },
      statusEdit,
      stores,
      today,
    });
  }

  /**
   * Adding a PlayStation game to the library: where it goes (Backlog, Shelved or Completed; never
   * the Wishlist, you've played it) and your data on it, filled in with where it would go anyway.
   * PlayStation has its playtime.
   */
  addFromPsn(
    name: string,
    initial: { status: Status; completion: Completion | null },
    today: string,
    stores: string[],
  ): Promise<SheetResult | null> {
    return this.open({
      title: 'Add to Library: ',
      name,
      dateLabel: 'Bought on',
      dismiss: 'Cancel',
      confirm: 'Add',
      fields: { purchase: true, hours: false, completed: initial.status === 'completed' },
      initial: { completion: initial.completion, copy: null, physical: false },
      statusEdit: {
        status: initial.status,
        rating: null,
        released: true,
        hoursFromPsn: true,
        preordered: false,
        statuses: ['backlog', 'shelved', 'completed'],
      },
      stores,
      today,
    });
  }

  finish(data: SheetResult | null): void {
    this.request()?.resolve(data);
    this.request.set(null);
  }

  private open(request: Omit<SheetRequest, 'resolve'>): Promise<SheetResult | null> {
    this.request()?.resolve(null);
    return new Promise((resolve) => this.request.set({ ...request, resolve }));
  }
}

/** A score out of 100: "86" → 86. Empty → null. Anything else (or over 100) → undefined. */
export function parseScore(text: string): number | null | undefined {
  const clean = text.trim();
  if (clean === '') return null;
  return /^\d{1,3}$/.test(clean) && Number(clean) <= 100 ? Number(clean) : undefined;
}

/** How many: "1,234" or "1234" → 1234. Empty → null. Anything else → undefined. */
export function parseCount(text: string): number | null | undefined {
  const clean = text.trim().replace(/[,.\s]/g, '');
  if (clean === '') return null;
  return /^\d{1,9}$/.test(clean) && Number(clean) <= 100_000_000 ? Number(clean) : undefined;
}

/** "69,99" or "69.99" → 69.99. Empty → null. Anything else → undefined (invalid). */
export function parsePrice(text: string): number | null | undefined {
  const clean = text.trim().replace('€', '').replace(',', '.').trim();
  if (clean === '') return null;
  const price = Math.round(Number(clean) * 100) / 100;
  return Number.isFinite(price) && price >= 0 && price < 100_000 ? price : undefined;
}

/** Rendered once, in the shell. */
@Component({
  selector: 'app-details-sheet',
  imports: [FitWidth, RatingSlider, LucideExternalLink, SheetErrorNote],
  template: `
    <dialog
      #dialog
      class="sheet m-0 mx-auto mt-auto w-full max-w-md bg-transparent p-0 text-label"
      aria-labelledby="details-sheet-title"
      (cancel)="$event.preventDefault(); sheet.finish(null)"
      (click)="onBackdropClick($event)"
    >
      @if (sheet.request(); as req) {
        <form
          class="px-2 pb-[max(env(safe-area-inset-bottom),8px)]"
          (submit)="save($event)"
          (input)="err.touched($event)"
          (click)="err.touched($event)"
        >
          <div class="grouped rounded-[14px]! bg-[rgb(44_44_46/0.94)]! backdrop-blur-xl">
            <h2
              id="details-sheet-title"
              class="px-4 pt-3.5 pb-1 text-center text-[13px] leading-4.5 text-muted"
            >
              {{ req.title }}<span class="font-semibold">{{ req.name }}</span>
            </h2>
            <p class="px-4 pb-3 text-center text-[13px] leading-4.5 text-muted">
              All optional. Leave anything you don't know empty.
            </p>
            @if (req.statusEdit) {
              <!-- The status is only changed here, so it can't be changed by a stray tap. -->
              <div class="row flex-col items-stretch! gap-2! py-2.5!">
                <span id="sheet-status-label" class="text-[13px] leading-4.5 text-muted"
                  >Status</span
                >
                <div class="segmented" role="radiogroup" aria-labelledby="sheet-status-label">
                  @for (s of statusesFor(req.statusEdit); track s.key) {
                    <button
                      type="button"
                      role="radio"
                      class="text-[12.5px]!"
                      [attr.aria-checked]="status() === s.key"
                      (click)="status.set(s.key); err.clear()"
                    >
                      {{ s.label }}
                    </button>
                  }
                </div>
              </div>
            }
            @let fields = shownFields();
            <!-- 17px inputs: 16px or more stops iOS zooming in on focus. -->
            @if (fields.hours) {
              @let played = req.initial.hoursPlayed ? splitPlaytime(req.initial.hoursPlayed) : null;
              <div class="row" data-field="hours" [class.field-invalid]="err.field() === 'hours'">
                <span class="flex-1">Playtime</span>
                <label class="flex items-baseline gap-0.5">
                  <input
                    appFitWidth
                    name="hours"
                    type="text"
                    inputmode="numeric"
                    placeholder="0"
                    autocomplete="off"
                    aria-label="Hours"
                    class="num bg-transparent text-right text-[17px] outline-none"
                    [value]="played?.hours || ''"
                  />
                  <span class="text-muted">h</span>
                </label>
                <label class="ml-0.5 flex items-baseline gap-0.5">
                  <input
                    appFitWidth
                    name="minutes"
                    type="text"
                    inputmode="numeric"
                    placeholder="0"
                    autocomplete="off"
                    aria-label="Minutes"
                    class="num bg-transparent text-right text-[17px] outline-none"
                    [value]="played?.minutes || ''"
                  />
                  <span class="text-muted">m</span>
                </label>
              </div>
            }
            @if (fields.completed) {
              <div
                class="row flex-col items-stretch! gap-2! py-2.5!"
                data-field="completion"
                [class.field-invalid]="err.field() === 'completion'"
              >
                <span id="sheet-completion-label" class="text-[13px] leading-4.5 text-muted"
                  >How far you got</span
                >
                <div class="segmented" role="radiogroup" aria-labelledby="sheet-completion-label">
                  @for (c of completions; track c.key) {
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="completion() === c.key"
                      (click)="completion.set(c.key)"
                    >
                      {{ c.label }}
                    </button>
                  }
                </div>
              </div>
              <!-- No "Completed on": it's the day you marked the game Completed (or, synced from
                   PlayStation, the day you earned the Platinum). -->
              @if (req.statusEdit) {
                <!-- Slide along the bar (or tap), 1 to 10 in half points. -->
                @let shown = ratingPreview() ?? rating();
                <div class="row flex-col items-stretch! gap-2! py-2.5!">
                  <div class="flex items-baseline gap-3 text-[13px] leading-4.5 text-muted">
                    <span id="sheet-rating-label">Rating</span>
                    <span class="num ml-auto">
                      @if (shown) {
                        <span class="text-[17px] font-semibold text-label">{{ shown }}</span
                        >/10
                      } @else {
                        Slide to rate
                      }
                    </span>
                    @if (rating() && ratingPreview() === null) {
                      <button
                        type="button"
                        class="text-danger active:opacity-60"
                        (click)="rating.set(null)"
                      >
                        Clear
                      </button>
                    }
                  </div>
                  <app-rating-slider
                    class="px-1"
                    [value]="rating()"
                    (preview)="ratingPreview.set($event)"
                    (changed)="rating.set($event)"
                  />
                </div>
              }
            }
            @if (fields.purchase) {
              <!-- How you have it, first: Subscription and Rent hide the price, store and date
                   (you didn't buy it). Neither for a pre-order. -->
              <div class="row flex-col items-stretch! gap-2! py-2.5!">
                <span id="sheet-copy-label" class="text-[13px] leading-4.5 text-muted">Copy</span>
                <div class="segmented" role="radiogroup" aria-labelledby="sheet-copy-label">
                  @for (c of copyTypesFor(req); track c.key) {
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="copy() === c.key"
                      (click)="pickCopy(c.key)"
                    >
                      {{ c.label }}
                    </button>
                  }
                </div>
              </div>
            }
            @if (fields.purchase && !notBought(copy())) {
              <label class="row" data-field="price" [class.field-invalid]="err.field() === 'price'">
                <span class="flex-1">Price</span>
                <span class="flex items-baseline gap-0.5">
                  <span class="text-muted">€</span>
                  <input
                    appFitWidth
                    name="price"
                    type="text"
                    inputmode="decimal"
                    placeholder="0.00"
                    autocomplete="off"
                    class="num bg-transparent text-right text-[17px] outline-none"
                    [value]="req.initial.pricePaid != null ? req.initial.pricePaid.toFixed(2) : ''"
                  />
                </span>
              </label>
              <label class="row">
                <span class="shrink-0">Bought from</span>
                <input
                  #store
                  name="store"
                  type="text"
                  placeholder="Store"
                  autocomplete="off"
                  class="min-w-0 flex-1 bg-transparent text-right text-[17px] outline-none"
                  [value]="req.initial.boughtFrom ?? ''"
                  (input)="storeText.set(store.value)"
                />
              </label>
              <!-- Your stores and common ones, one tap to fill the field (or type any store). -->
              <div class="row flex-wrap gap-2! py-2.5!">
                @for (s of req.stores.slice(0, 6); track s) {
                  <button
                    type="button"
                    class="rounded-full px-3 py-1 text-[15px] active:opacity-60"
                    [class]="
                      storeText() === s ? 'bg-accent-fill text-white' : 'bg-pressed text-label'
                    "
                    (click)="store.value = s; storeText.set(s)"
                  >
                    {{ s }}
                  </button>
                }
              </div>
              <label class="row">
                <span class="flex-1">{{ req.dateLabel }}</span>
                <input
                  name="ordered"
                  type="date"
                  class="num rounded-lg bg-pressed px-2.5 py-1 text-[17px] outline-none scheme-dark"
                  [value]="req.initial.orderedOn ?? ''"
                  [max]="req.today"
                />
              </label>
            }
            @if (fields.purchase) {
              <!-- Sold: on a game's page, once you own it, for a physical copy (only those can be
                   sold; picking another copy turns it off). A game marked sold before this still
                   shows it. It stays in its list, with a euro sign on its cover. -->
              @if (req.statusEdit && status() !== 'wishlist' && (copy() === 'physical' || sold())) {
                <div class="row">
                  <p id="sheet-sold-label" class="flex-1">Sold</p>
                  <button
                    type="button"
                    role="switch"
                    class="switch"
                    aria-labelledby="sheet-sold-label"
                    [attr.aria-checked]="sold()"
                    (click)="sold.set(!sold())"
                  >
                    <span></span>
                  </button>
                </div>
                @if (sold()) {
                  <label
                    class="row"
                    data-field="soldFor"
                    [class.field-invalid]="err.field() === 'soldFor'"
                  >
                    <span class="flex-1">Sold for</span>
                    <span class="flex items-baseline gap-0.5">
                      <span class="text-muted">€</span>
                      <input
                        appFitWidth
                        name="soldFor"
                        type="text"
                        inputmode="decimal"
                        placeholder="Optional"
                        autocomplete="off"
                        class="num bg-transparent text-right text-[17px] outline-none"
                        [value]="req.initial.soldFor != null ? req.initial.soldFor.toFixed(2) : ''"
                      />
                    </span>
                  </label>
                }
              }
            }
          </div>
          @let extras = req.extras;
          @if (extras?.scores || extras?.action) {
            <!-- Scores: for the few games OpenCritic matches wrong (old ones, some editions). -->
            <div class="grouped mt-2 rounded-[14px]! bg-[rgb(44_44_46/0.94)]! backdrop-blur-xl">
              <h3 class="px-4 pt-3 pb-1 text-[13px] leading-4.5 text-muted">Scores</h3>
              @if (extras?.scores; as scores) {
                <!-- Each score, then how many it's from (shown as the card's caption). -->
                <label class="row" data-field="critic" [class.field-invalid]="err.field() === 'critic'">
                  <span class="flex-1">Critic score</span>
                  <span class="flex items-baseline gap-0.5">
                    <input
                      appFitWidth
                      name="critic"
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      class="num bg-transparent text-right text-[17px] outline-none"
                      [placeholder]="scores.shown.critic ?? '–'"
                      [value]="scores.own.critic ?? ''"
                    />
                    <span class="text-muted">/100</span>
                  </span>
                </label>
                <label class="row" data-field="critics" [class.field-invalid]="err.field() === 'critics'">
                  <span class="flex-1">Critics</span>
                  <span class="flex items-baseline gap-0.5">
                    <input
                      appFitWidth
                      name="critics"
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      class="num bg-transparent text-right text-[17px] outline-none"
                      [placeholder]="scores.shown.critics ?? '–'"
                      [value]="scores.own.critics ?? ''"
                    />
                    <span class="text-muted">&nbsp;critics</span>
                  </span>
                </label>
                <label class="row" data-field="players" [class.field-invalid]="err.field() === 'players'">
                  <span class="flex-1">User score</span>
                  <span class="flex items-baseline gap-0.5">
                    <input
                      appFitWidth
                      name="players"
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      class="num bg-transparent text-right text-[17px] outline-none"
                      [placeholder]="scores.shown.players ?? '–'"
                      [value]="scores.own.players ?? ''"
                    />
                    <span class="text-muted">/100</span>
                  </span>
                </label>
                <label class="row" data-field="users" [class.field-invalid]="err.field() === 'users'">
                  <span class="flex-1">Users</span>
                  <span class="flex items-baseline gap-0.5">
                    <input
                      appFitWidth
                      name="users"
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      class="num bg-transparent text-right text-[17px] outline-none"
                      [placeholder]="scores.shown.users ?? '–'"
                      [value]="scores.own.users ?? ''"
                    />
                    <span class="text-muted">&nbsp;users</span>
                  </span>
                </label>
              }
              @if (extras?.action; as action) {
                <button
                  type="button"
                  class="row text-accent-raised disabled:opacity-40"
                  [disabled]="actionBusy()"
                  (click)="runAction(action)"
                >
                  {{ actionBusy() ? action.busyLabel : action.label }}
                </button>
                @if (actionResult()) {
                  <p class="px-4 pb-3 text-[13px] leading-4.5 text-muted" role="status">
                    {{ actionResult() }}
                  </p>
                }
              }
              @if (extras?.scores) {
                <p class="px-4 pb-3 text-[13px] leading-4.5 text-muted">
                  Only for games OpenCritic gets wrong. Typed-in scores replace OpenCritic’s for
                  everyone with the game; leave both empty to use OpenCritic’s.
                </p>
              }
            </div>
          }
          @if (extras?.hltbUrl; as hltbUrl) {
            <!-- HowLongToBeat has no API: its page is a tap away, its times typed in here. -->
            @let times = req.initial.hltb;
            <div class="grouped mt-2 rounded-[14px]! bg-[rgb(44_44_46/0.94)]! backdrop-blur-xl">
              <a [href]="hltbUrl" target="_blank" rel="noopener" class="row text-accent-raised">
                <img src="icons/hltb.png" alt="" class="size-5 shrink-0 rounded-sm" />
                <span class="flex-1">HowLongToBeat</span>
                <svg lucideExternalLink [size]="16" [strokeWidth]="2" class="shrink-0"></svg>
              </a>
              @for (t of hltbTimes; track t.key) {
                @let time = times?.[t.key] ? splitPlaytime(times![t.key]!) : null;
                <div
                  class="row"
                  [attr.data-field]="'hltb-' + t.key"
                  [class.field-invalid]="err.field() === 'hltb-' + t.key"
                >
                  <span class="flex-1">{{ t.label }}</span>
                  <label class="flex items-baseline gap-0.5">
                    <input
                      appFitWidth
                      [name]="'hltb-' + t.key + '-h'"
                      type="text"
                      inputmode="numeric"
                      placeholder="0"
                      autocomplete="off"
                      [attr.aria-label]="t.label + ', hours'"
                      class="num bg-transparent text-right text-[17px] outline-none"
                      [value]="time?.hours || ''"
                    />
                    <span class="text-muted">h</span>
                  </label>
                  <label class="ml-0.5 flex items-baseline gap-0.5">
                    <input
                      appFitWidth
                      [name]="'hltb-' + t.key + '-m'"
                      type="text"
                      inputmode="numeric"
                      placeholder="0"
                      autocomplete="off"
                      [attr.aria-label]="t.label + ', minutes'"
                      class="num bg-transparent text-right text-[17px] outline-none"
                      [value]="time?.minutes || ''"
                    />
                    <span class="text-muted">m</span>
                  </label>
                </div>
              }
            </div>
          }
          <!-- Stays at the foot of the screen when the sheet is taller than it, with why it
               couldn't save just above Save, so that's never off screen. -->
          <div class="sticky bottom-[max(env(safe-area-inset-bottom),8px)] mt-2">
            @if (err.message(); as message) {
              <app-sheet-error [message]="message" />
            }
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="grouped min-h-14.25 rounded-[14px]! bg-[rgb(44_44_46/0.94)]! text-[17px] text-accent-raised backdrop-blur-xl active:bg-pressed!"
                (click)="sheet.finish(null)"
              >
                {{ req.dismiss }}
              </button>
              <button
                type="submit"
                class="min-h-14.25 rounded-[14px] bg-accent-fill text-[17px] font-semibold text-white active:brightness-90"
              >
                {{ req.confirm ?? 'Save' }}
              </button>
            </div>
          </div>
        </form>
      }
    </dialog>
  `,
  styles: `
    .sheet[open] {
      animation: sheet-up 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes sheet-up {
      from {
        transform: translateY(100%);
      }
    }
  `,
})
export class DetailsSheetOutlet {
  protected readonly sheet = inject(DetailsSheet);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  /** Why Save didn't save, and the field to fix. */
  protected readonly err = new SheetError(() => this.dialog().nativeElement);
  /** What's in the store field, so the matching store button shows as picked. */
  protected readonly storeText = signal('');
  /** Physical, digital, subscription or rent, as picked (null: not said). */
  protected readonly copy = signal<CopyType | null>(null);
  protected readonly sold = signal(false);
  protected readonly completion = signal<Completion | null>(null);
  protected readonly completions = COMPLETIONS;
  protected readonly statuses = STATUSES;
  protected statusesFor(edit: StatusEdit): typeof STATUSES {
    return edit.statuses ? STATUSES.filter((s) => edit.statuses!.includes(s.key)) : STATUSES;
  }
  /** The status picked in the sheet ("Edit my data" only). */
  protected readonly status = signal<Status | null>(null);
  protected readonly rating = signal<number | null>(null);
  protected readonly ratingPreview = signal<number | null>(null);
  /** The extra action (req.action) is running, and what it said. */
  protected readonly actionBusy = signal(false);
  protected readonly actionResult = signal('');

  protected async runAction(action: SheetAction): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionResult.set('');
    try {
      this.actionResult.set(await action.run());
    } catch {
      this.actionResult.set('That didn’t work. Try again in a moment.');
    } finally {
      this.actionBusy.set(false);
    }
  }
  /** The fields shown: fixed, or following the status picked in "Edit my data". */
  protected readonly shownFields = computed((): SheetFields => {
    const req = this.sheet.request();
    if (!req) return { purchase: false, hours: false, completed: false };
    const edit = req.statusEdit;
    const status = this.status();
    if (!edit || !status) return req.fields;
    const owned = status !== 'wishlist';
    return {
      hours: owned && edit.released && !edit.hoursFromPsn,
      completed: status === 'completed',
      purchase: owned || edit.preordered,
    };
  });
  protected readonly splitPlaytime = splitPlaytime;
  protected readonly hltbTimes = HLTB_TIMES;

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      const req = this.sheet.request();
      if (req && !el.open) {
        this.err.clear();
        this.storeText.set(req.initial.boughtFrom ?? '');
        this.copy.set(copyOf(req.initial));
        this.sold.set(!!req.initial.sold);
        this.completion.set(req.initial.completion ?? null);
        this.status.set(req.statusEdit?.status ?? null);
        this.rating.set(req.statusEdit?.rating ?? null);
        this.ratingPreview.set(null);
        this.actionBusy.set(false);
        this.actionResult.set('');
        el.showModal();
      }
      if (!req && el.open) el.close();
    });
  }

  /** Copy's choices: no Subscription or Rent for a pre-order (you're buying it). */
  protected copyTypesFor(req: SheetRequest): typeof COPY_TYPES {
    return req.preorder ? COPY_TYPES.filter((c) => !notBought(c.key)) : COPY_TYPES;
  }

  protected readonly notBought = notBought;

  /** Only a physical copy can be sold, so another choice turns Sold off. */
  protected pickCopy(copy: CopyType): void {
    this.copy.set(copy);
    if (copy !== 'physical') this.sold.set(false);
    // A message about a field Subscription or Rent hides goes with it.
    if (notBought(copy) && this.err.field() === 'price') this.err.clear();
  }

  protected save(event: Event): void {
    event.preventDefault();
    const req = this.sheet.request();
    if (!req) return;
    const form = event.target as HTMLFormElement;
    const field = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
    const data: SheetResult = {};
    const fields = this.shownFields();

    if (req.statusEdit && this.status()) {
      data.status = this.status()!;
      if (data.status === 'completed' && !this.completion()) {
        return this.err.show('completion', 'Pick how far you got before saving.');
      }
    }
    if (fields.hours) {
      const hours = parsePlaytime(field('hours'), field('minutes'));
      if (hours === undefined) {
        return this.err.show(
          'hours',
          'Playtime should be whole hours and minutes, up to 59 minutes.',
        );
      }
      data.hoursPlayed = hours;
    }
    if (fields.completed) {
      data.completion = this.completion() ?? req.initial.completion ?? null;
      if (req.statusEdit) data.rating = this.rating();
    }
    if (fields.purchase) {
      const price = parsePrice(field('price'));
      if (price === undefined) {
        return this.err.show('price', 'Price should be a number, like 69.99.');
      }
      const ordered = field('ordered');
      data.pricePaid = price;
      data.boughtFrom = field('store').trim().slice(0, 60) || null;
      data.orderedOn = /^\d{4}-\d{2}-\d{2}$/.test(ordered) ? ordered : null;
      // With Subscription the price, store and date aren't shown, so they're saved empty.
      data.copy = this.copy();
      data.physical = this.copy() === 'physical';
      if (req.statusEdit && this.status() !== 'wishlist') {
        const soldFor = this.sold() ? parsePrice(field('soldFor')) : null;
        if (soldFor === undefined) {
          return this.err.show('soldFor', 'Sold for should be a number, like 25.');
        }
        data.sold = this.sold();
        data.soldFor = soldFor;
      }
    }
    const extras = req.extras;
    if (extras?.scores) {
      const critic = parseScore(field('critic'));
      const players = parseScore(field('players'));
      const critics = parseCount(field('critics'));
      const users = parseCount(field('users'));
      const outOf100 = 'Scores should be whole numbers from 0 to 100.';
      if (critic === undefined) return this.err.show('critic', outOf100);
      if (players === undefined) return this.err.show('players', outOf100);
      const count = 'Critics and users should be whole numbers.';
      if (critics === undefined) return this.err.show('critics', count);
      if (users === undefined) return this.err.show('users', count);
      const own: OwnScores = { critic, critics, players, users };
      if (JSON.stringify(own) !== JSON.stringify(extras.scores.own)) data.scores = own;
    }
    if (extras?.hltbUrl) {
      const times: HltbTimes = { main: null, extra: null, completionist: null };
      for (const { key } of HLTB_TIMES) {
        const hours = parsePlaytime(field(`hltb-${key}-h`), field(`hltb-${key}-m`));
        if (hours === undefined) {
          return this.err.show(
            'hltb-' + key,
            'Times should be whole hours and minutes, up to 59 minutes.',
          );
        }
        times[key] = hours;
      }
      const hltb = Object.values(times).some((t) => t !== null) ? times : null;
      const before = req.initial.hltb ?? null;
      if (JSON.stringify(hltb) !== JSON.stringify(before)) data.hltb = hltb;
    }
    this.sheet.finish(data);
  }

  // Tapping the dimmed area outside the sheet closes it without saving.
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.sheet.finish(null);
  }
}
