import { Component, input, signal } from '@angular/core';
import { LucideCircleAlert } from '@lucide/angular';

/**
 * Why a sheet couldn't save, shown where you'll see it. Sheets can be taller than the screen, and
 * a message in the middle of one went unseen: Save just seemed to do nothing. So the message sits
 * right above Save (which stays at the foot of the screen, <app-sheet-error>), and the field to
 * fix (the row with data-field="…") is outlined in red (.field-invalid) and scrolled into view.
 * Changing that field clears it.
 */
export class SheetError {
  readonly message = signal('');
  /** The data-field of the row to fix, or null when the message isn't about one field. */
  readonly field = signal<string | null>(null);

  constructor(private readonly root: () => HTMLElement) {}

  /** Shows the message and brings the field into view. Returns nothing, so `return err.show()`. */
  show(field: string | null, message: string): void {
    this.message.set(message);
    this.field.set(field);
    if (!field) return;
    // After the outline is drawn, so the row is where it'll be.
    requestAnimationFrame(() =>
      this.root()
        .querySelector(`[data-field="${field}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
  }

  clear(): void {
    this.message.set('');
    this.field.set(null);
  }

  /** From the form's (input) and (click): typing in or tapping the marked field clears it. */
  touched(event: Event): void {
    const field = this.field();
    const target = event.target as Element | null;
    if (field && target?.closest?.(`[data-field="${field}"]`)) this.clear();
  }
}

/** The message above a sheet's Save button. */
@Component({
  selector: 'app-sheet-error',
  imports: [LucideCircleAlert],
  host: { class: 'block' },
  template: `
    <p
      class="sheet-error mb-2 flex items-center gap-2.5 rounded-[14px] bg-[rgb(44_44_46/0.94)] px-4 py-3 text-[15px] leading-5 shadow-[0_8px_28px_rgb(0_0_0/0.5)] backdrop-blur-xl"
      role="alert"
    >
      <svg lucideCircleAlert [size]="20" class="shrink-0 text-danger" aria-hidden="true"></svg>
      {{ message() }}
    </p>
  `,
  styles: `
    .sheet-error {
      animation: sheet-error-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes sheet-error-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sheet-error {
        animation: none;
      }
    }
  `,
})
export class SheetErrorNote {
  readonly message = input.required<string>();
}
