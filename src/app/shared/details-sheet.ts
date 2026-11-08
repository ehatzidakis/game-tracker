import {
  Component,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';
import type { TrackedGame } from '../../../api/_lib/models.js';
import { dateFieldValue, fromDateField } from '../core/dates';
import { FitWidth } from './fit-content';

/** Your own data about a game: what you paid, where and when, and how long you played. */
export interface MyData {
  pricePaid: number | null;
  boughtFrom: string | null;
  /** "YYYY-MM-DD" */
  orderedOn: string | null;
  physical: boolean;
  hoursPlayed: number | null;
  /** Milliseconds. */
  completedAt: number | null;
}

/** Which fields the sheet asks for. */
export interface SheetFields {
  purchase: boolean;
  hours: boolean;
  completed: boolean;
}

interface SheetRequest {
  /** "Pre-order details", "Purchase details", "Your data". */
  title: string;
  name: string;
  /** "Ordered on" for pre-orders, "Bought on" otherwise. */
  dateLabel: string;
  /** "Skip" when asked as you buy or pre-order, "Cancel" when editing. */
  dismiss: string;
  fields: SheetFields;
  initial: Partial<MyData>;
  /** Stores you've used before, then common ones, as buttons. */
  stores: string[];
  today: string;
  resolve: (data: Partial<MyData> | null) => void;
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
      dateLabel: kind === 'preorder' ? 'Ordered on' : 'Bought on',
      dismiss: 'Skip',
      fields: { purchase: true, hours: false, completed: false },
      initial: { orderedOn: today },
      stores,
      today,
    });
  }

  /** "Edit my data" on a game's page: the fields that apply, filled with what you entered. */
  edit(
    game: TrackedGame,
    fields: SheetFields,
    today: string,
    stores: string[],
  ): Promise<Partial<MyData> | null> {
    return this.open({
      title: 'Your data for ',
      name: game.name,
      dateLabel: game.preordered ? 'Ordered on' : 'Bought on',
      dismiss: 'Cancel',
      fields,
      initial: {
        pricePaid: game.pricePaid ?? null,
        boughtFrom: game.boughtFrom ?? null,
        orderedOn: game.orderedOn ?? null,
        physical: !!game.physical,
        hoursPlayed: game.hoursPlayed,
        completedAt: game.completedAt,
      },
      stores,
      today,
    });
  }

  finish(data: Partial<MyData> | null): void {
    this.request()?.resolve(data);
    this.request.set(null);
  }

  private open(request: Omit<SheetRequest, 'resolve'>): Promise<Partial<MyData> | null> {
    this.request()?.resolve(null);
    return new Promise((resolve) => this.request.set({ ...request, resolve }));
  }
}

/** "69,99" or "69.99" → 69.99. Empty → null. Anything else → undefined (invalid). */
export function parsePrice(text: string): number | null | undefined {
  const clean = text.trim().replace('€', '').replace(',', '.').trim();
  if (clean === '') return null;
  const price = Math.round(Number(clean) * 100) / 100;
  return Number.isFinite(price) && price >= 0 && price < 100_000 ? price : undefined;
}

/** "12,5" or "12.5" → 12.5. Empty → null. Anything else → undefined (invalid). */
export function parseHours(text: string): number | null | undefined {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const hours = Math.round(Number(clean) * 10) / 10;
  return Number.isFinite(hours) && hours >= 0 && hours <= 100_000 ? hours : undefined;
}

/** Rendered once, in the shell. */
@Component({
  selector: 'app-details-sheet',
  imports: [FitWidth],
  template: `
    <dialog
      #dialog
      class="sheet m-0 mx-auto mt-auto w-full max-w-md bg-transparent p-0 text-label"
      aria-labelledby="details-sheet-title"
      (cancel)="$event.preventDefault(); sheet.finish(null)"
      (click)="onBackdropClick($event)"
    >
      @if (sheet.request(); as req) {
        <form class="px-2 pb-[max(env(safe-area-inset-bottom),8px)]" (submit)="save($event)">
          <div class="grouped rounded-[14px]! bg-[rgb(44_44_46/0.94)]! backdrop-blur-xl">
            <h2
              id="details-sheet-title"
              class="px-4 pt-3.5 pb-1 text-center text-[13px] leading-[18px] text-muted"
            >
              {{ req.title }}<span class="font-semibold">{{ req.name }}</span>
            </h2>
            <p class="px-4 pb-3 text-center text-[13px] leading-[18px] text-muted">
              All optional. Leave anything you don't know empty.
            </p>
            <!-- 17px inputs: 16px or more stops iOS zooming in on focus. -->
            @if (req.fields.hours) {
              <label class="row">
                <span class="flex-1">Hours played</span>
                <span class="flex items-baseline gap-1">
                  <input
                    appFitWidth
                    name="hours"
                    type="text"
                    inputmode="decimal"
                    placeholder="0"
                    autocomplete="off"
                    class="num bg-transparent text-right text-[17px] outline-none"
                    [value]="req.initial.hoursPlayed ?? ''"
                  />
                  <span class="text-muted">h</span>
                </span>
              </label>
            }
            @if (req.fields.completed) {
              <label class="row">
                <span class="flex-1">Completed on</span>
                <input
                  name="completed"
                  type="date"
                  class="num rounded-[8px] bg-pressed px-2.5 py-1 text-[17px] outline-none scheme-dark"
                  [value]="dateFieldValue(req.initial.completedAt)"
                  [max]="req.today"
                />
              </label>
            }
            @if (req.fields.purchase) {
              <label class="row">
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
                  class="num rounded-[8px] bg-pressed px-2.5 py-1 text-[17px] outline-none scheme-dark"
                  [value]="req.initial.orderedOn ?? ''"
                  [max]="req.today"
                />
              </label>
              <div class="row">
                <p id="sheet-physical-label" class="flex-1">Physical copy</p>
                <button
                  type="button"
                  role="switch"
                  class="switch"
                  aria-labelledby="sheet-physical-label"
                  [attr.aria-checked]="physical()"
                  (click)="physical.set(!physical())"
                >
                  <span></span>
                </button>
              </div>
            }
          </div>
          @if (error()) {
            <p class="px-4 pt-2 text-center text-[13px] text-[#ff6961]" role="alert">
              {{ error() }}
            </p>
          }
          <div class="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              class="grouped min-h-[57px] rounded-[14px]! bg-[rgb(44_44_46/0.94)]! text-[17px] text-accent-raised backdrop-blur-xl active:bg-pressed!"
              (click)="sheet.finish(null)"
            >
              {{ req.dismiss }}
            </button>
            <button
              type="submit"
              class="min-h-[57px] rounded-[14px] bg-accent-fill text-[17px] font-semibold text-white active:brightness-90"
            >
              Save
            </button>
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
  protected readonly error = signal('');
  /** What's in the store field, so the matching store button shows as picked. */
  protected readonly storeText = signal('');
  protected readonly physical = signal(false);
  protected readonly dateFieldValue = dateFieldValue;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      const req = this.sheet.request();
      if (req && !el.open) {
        this.error.set('');
        this.storeText.set(req.initial.boughtFrom ?? '');
        this.physical.set(!!req.initial.physical);
        el.showModal();
      }
      if (!req && el.open) el.close();
    });
  }

  protected save(event: Event): void {
    event.preventDefault();
    const req = this.sheet.request();
    if (!req) return;
    const form = event.target as HTMLFormElement;
    const field = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
    const data: Partial<MyData> = {};

    if (req.fields.hours) {
      const hours = parseHours(field('hours'));
      if (hours === undefined) return this.error.set('Hours should be a number, like 12 or 12.5.');
      data.hoursPlayed = hours;
    }
    if (req.fields.completed) {
      // An emptied date keeps the old one: a completed game always has one.
      data.completedAt = fromDateField(field('completed')) ?? req.initial.completedAt ?? null;
    }
    if (req.fields.purchase) {
      const price = parsePrice(field('price'));
      if (price === undefined) return this.error.set('Price should be a number, like 69.99.');
      const ordered = field('ordered');
      data.pricePaid = price;
      data.boughtFrom = field('store').trim().slice(0, 60) || null;
      data.orderedOn = /^\d{4}-\d{2}-\d{2}$/.test(ordered) ? ordered : null;
      data.physical = this.physical();
    }
    this.sheet.finish(data);
  }

  // Tapping the dimmed area outside the sheet closes it without saving.
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.sheet.finish(null);
  }
}
