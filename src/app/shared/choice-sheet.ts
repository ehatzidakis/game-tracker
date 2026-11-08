import {
  Component,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';
import { COMPLETIONS, STATUSES, type Completion, type Status } from '../../../api/_lib/models.js';

export interface Choice<T extends string> {
  key: T;
  label: string;
  hint?: string;
}

interface ChoiceRequest {
  /** Heading in three parts; the middle one (the game's name) is bold. */
  heading: readonly [string, string, string];
  choices: readonly Choice<string>[];
  suggested: string | null;
  resolve: (key: string | null) => void;
}

/** Asks a question as a bottom sheet. Every question resolves to null if dismissed. */
@Injectable({ providedIn: 'root' })
export class ChoiceSheet {
  readonly request = signal<ChoiceRequest | null>(null);

  choose<T extends string>(
    heading: readonly [string, string, string],
    choices: readonly Choice<T>[],
    suggested: T | null = null,
  ): Promise<T | null> {
    this.request()?.resolve(null);
    return new Promise<T | null>((resolve) =>
      this.request.set({
        heading,
        choices,
        suggested,
        resolve: resolve as (key: string | null) => void,
      }),
    );
  }

  /** How far you got, asked whenever a game becomes Completed. */
  completion(name: string): Promise<Completion | null> {
    return this.choose(['How far did you get in ', name, '?'], COMPLETIONS);
  }

  /** Which list a new game goes in, plus how far you got if that's Completed. */
  async addTo(
    name: string,
    suggested: Status,
  ): Promise<{ status: Status; completion: Completion | null } | null> {
    const status = await this.choose(['Add ', name, ' to…'], STATUSES, suggested);
    if (status !== 'completed') return status && { status, completion: null };
    const completion = await this.completion(name);
    return completion && { status, completion };
  }

  finish(key: string | null): void {
    this.request()?.resolve(key);
    this.request.set(null);
  }
}

/** Rendered once, in the shell. */
@Component({
  selector: 'app-choice-sheet',
  template: `
    <dialog
      #dialog
      class="sheet m-0 mx-auto mt-auto w-full max-w-md bg-transparent p-0 text-label"
      aria-labelledby="choice-sheet-title"
      (cancel)="$event.preventDefault(); sheet.finish(null)"
      (click)="onBackdropClick($event)"
    >
      @if (sheet.request(); as req) {
        <!-- iOS action sheet: the choices in one rounded group, Cancel in its own. -->
        <div class="px-2 pb-[max(env(safe-area-inset-bottom),8px)]">
          <div class="grouped rounded-[14px]! bg-[rgb(44_44_46/0.94)]! backdrop-blur-xl">
            <h2
              id="choice-sheet-title"
              class="truncate px-4 py-3.5 text-center text-[13px] leading-[18px] text-muted"
            >
              {{ req.heading[0] }}<span class="font-semibold">{{ req.heading[1] }}</span
              >{{ req.heading[2] }}
            </h2>
            <!-- Long lists (your gaming events) scroll inside the sheet. -->
            <div class="group-scroll max-h-[60dvh] overflow-y-auto overscroll-contain">
              @for (c of req.choices; track c.key) {
                <button type="button" class="row min-h-[57px]!" (click)="sheet.finish(c.key)">
                  <span class="min-w-0 flex-1">
                    <span class="block text-[17px]">{{ c.label }}</span>
                    @if (c.hint) {
                      <span class="block text-[13px] leading-[18px] text-muted">{{ c.hint }}</span>
                    }
                  </span>
                  @if (c.key === req.suggested) {
                    <span class="shrink-0 text-[15px] text-accent-raised">Suggested</span>
                  }
                </button>
              }
            </div>
          </div>
          <div class="grouped mt-2 rounded-[14px]! bg-[rgb(44_44_46/0.94)]! backdrop-blur-xl">
            <button
              type="button"
              class="row min-h-[57px]! justify-center text-[17px] font-semibold text-accent-raised"
              (click)="sheet.finish(null)"
            >
              Cancel
            </button>
          </div>
        </div>
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
export class ChoiceSheetOutlet {
  protected readonly sheet = inject(ChoiceSheet);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.sheet.request() && !el.open) el.showModal();
      if (!this.sheet.request() && el.open) el.close();
    });
  }

  // Tapping the dimmed area outside the sheet closes it.
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.sheet.finish(null);
  }
}
