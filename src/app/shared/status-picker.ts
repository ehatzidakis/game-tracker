import { Component, effect, ElementRef, inject, Injectable, signal, viewChild } from '@angular/core';
import { STATUSES, type Status } from '../../../api/_lib/models.js';

interface PickRequest {
  title: string;
  suggested: Status;
  resolve: (status: Status | null) => void;
}

/** Asks which status a game goes in, as a bottom sheet. Resolves to null if dismissed. */
@Injectable({ providedIn: 'root' })
export class StatusPicker {
  readonly request = signal<PickRequest | null>(null);

  pick(title: string, suggested: Status): Promise<Status | null> {
    this.request()?.resolve(null);
    return new Promise((resolve) => this.request.set({ title, suggested, resolve }));
  }

  finish(status: Status | null): void {
    this.request()?.resolve(status);
    this.request.set(null);
  }
}

/** Rendered once, in the shell. */
@Component({
  selector: 'app-status-picker',
  template: `
    <dialog
      #dialog
      class="sheet m-0 mt-auto w-full max-w-md mx-auto bg-zinc-900 text-zinc-100 rounded-t-2xl border-t border-white/10 p-0 backdrop:bg-black/60"
      aria-labelledby="status-picker-title"
      (close)="picker.finish(null)"
      (click)="onBackdropClick($event)"
    >
      @if (picker.request(); as req) {
        <div class="px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden="true"></div>
          <h2 id="status-picker-title" class="text-sm text-zinc-400 mb-2 truncate">
            Add <span class="text-zinc-100 font-medium">{{ req.title }}</span> to…
          </h2>
          <ul class="divide-y divide-white/5">
            @for (s of statuses; track s.key) {
              <li>
                <button
                  type="button"
                  class="w-full flex items-center gap-3 py-3 text-left"
                  (click)="picker.finish(s.key)"
                >
                  <span class="font-medium">{{ s.label }}</span>
                  <span class="text-sm text-zinc-500">{{ s.hint }}</span>
                  @if (s.key === req.suggested) {
                    <span class="ml-auto text-xs rounded-full bg-white/10 px-2 py-0.5 text-zinc-300">
                      Suggested
                    </span>
                  }
                </button>
              </li>
            }
          </ul>
          <button
            type="button"
            class="mt-2 w-full rounded-xl bg-white/5 py-3 font-medium text-zinc-300"
            (click)="picker.finish(null)"
          >
            Cancel
          </button>
        </div>
      }
    </dialog>
  `,
  styles: `
    .sheet[open] {
      animation: sheet-up 180ms ease-out;
    }
    @keyframes sheet-up {
      from {
        transform: translateY(100%);
      }
    }
  `,
})
export class StatusPickerSheet {
  protected readonly picker = inject(StatusPicker);
  protected readonly statuses = STATUSES;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.picker.request() && !el.open) el.showModal();
      if (!this.picker.request() && el.open) el.close();
    });
  }

  // Tapping the dimmed area outside the sheet closes it.
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.picker.finish(null);
  }
}
