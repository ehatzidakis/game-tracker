import {
  Component,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';

export interface PreorderDetails {
  pricePaid: number | null;
  boughtFrom: string | null;
  orderedOn: string | null;
}

/** A pre-order of an upcoming game, or buying a game that's out. */
export type PurchaseKind = 'preorder' | 'purchase';

interface PreorderRequest {
  kind: PurchaseKind;
  name: string;
  /** "YYYY-MM-DD", filled in as the order date. */
  today: string;
  /** Stores you've used before, offered as suggestions. */
  stores: string[];
  resolve: (details: PreorderDetails | null) => void;
}

/** Asks for pre-order or purchase details (all optional) as a bottom sheet. Skip resolves to null. */
@Injectable({ providedIn: 'root' })
export class PreorderSheet {
  readonly request = signal<PreorderRequest | null>(null);

  ask(
    kind: PurchaseKind,
    name: string,
    today: string,
    stores: string[],
  ): Promise<PreorderDetails | null> {
    this.request()?.resolve(null);
    return new Promise((resolve) => this.request.set({ kind, name, today, stores, resolve }));
  }

  finish(details: PreorderDetails | null): void {
    this.request()?.resolve(details);
    this.request.set(null);
  }
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
  selector: 'app-preorder-sheet',
  template: `
    <dialog
      #dialog
      class="sheet m-0 mx-auto mt-auto w-full max-w-md bg-transparent p-0 text-label backdrop:bg-black/50"
      aria-labelledby="preorder-sheet-title"
      (cancel)="$event.preventDefault(); sheet.finish(null)"
      (click)="onBackdropClick($event)"
    >
      @if (sheet.request(); as req) {
        <form
          class="px-2 pb-[max(env(safe-area-inset-bottom),8px)]"
          (submit)="save($event, price.value, store.value, date.value)"
        >
          <div class="grouped rounded-[14px]! bg-[rgb(44_44_46/0.94)]! backdrop-blur-xl">
            <h2
              id="preorder-sheet-title"
              class="px-4 pt-3.5 pb-1 text-center text-[13px] leading-[18px] text-muted"
            >
              {{ req.kind === 'preorder' ? 'Pre-order' : 'Purchase' }} details for
              <span class="font-semibold">{{ req.name }}</span>
            </h2>
            <p class="px-4 pb-3 text-center text-[13px] leading-[18px] text-muted">
              All optional. You can change them later on the game's page.
            </p>
            <!-- 17px inputs: 16px or more stops iOS zooming in on focus. -->
            <label class="row">
              <span class="flex-1">Price</span>
              <span class="text-muted">€</span>
              <input
                #price
                type="text"
                inputmode="decimal"
                placeholder="0.00"
                autocomplete="off"
                class="num w-24 bg-transparent text-right text-[17px] outline-none"
              />
            </label>
            <label class="row">
              <span class="shrink-0">Bought from</span>
              <input
                #store
                type="text"
                placeholder="Store"
                autocomplete="off"
                list="preorder-stores"
                class="min-w-0 flex-1 bg-transparent text-right text-[17px] outline-none"
              />
              <datalist id="preorder-stores">
                @for (s of req.stores; track s) {
                  <option [value]="s"></option>
                }
              </datalist>
            </label>
            <label class="row">
              <span class="flex-1">{{ req.kind === 'preorder' ? 'Ordered on' : 'Bought on' }}</span>
              <input
                #date
                type="date"
                class="num rounded-[8px] bg-pressed px-2.5 py-1 text-[17px] outline-none scheme-dark"
                [value]="req.today"
                [max]="req.today"
              />
            </label>
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
              Skip
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
export class PreorderSheetOutlet {
  protected readonly sheet = inject(PreorderSheet);
  protected readonly error = signal('');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.sheet.request() && !el.open) {
        this.error.set('');
        el.showModal();
      }
      if (!this.sheet.request() && el.open) el.close();
    });
  }

  protected save(event: Event, price: string, store: string, date: string): void {
    event.preventDefault();
    const pricePaid = parsePrice(price);
    if (pricePaid === undefined) {
      this.error.set('Price should be a number, like 69.99.');
      return;
    }
    this.sheet.finish({
      pricePaid,
      boughtFrom: store.trim().slice(0, 60) || null,
      orderedOn: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    });
  }

  // Tapping the dimmed area outside the sheet skips it.
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.sheet.finish(null);
  }
}
