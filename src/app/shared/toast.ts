import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toast',
  // Takes no space in the tab bar's grid; the message floats just above the bar.
  host: { class: 'contents' },
  template: `
    <div class="pointer-events-none absolute inset-x-0 bottom-full flex justify-center px-4 pb-3" aria-live="polite">
      @if (toast.current(); as t) {
        <button
          type="button"
          class="pointer-events-auto max-w-full rounded-full px-4 py-2 text-sm shadow-lg"
          [class]="t.kind === 'error' ? 'bg-red-950 text-red-200 border border-red-900' : 'bg-zinc-800 text-zinc-100 border border-white/10'"
          [attr.role]="t.kind === 'error' ? 'alert' : null"
          (click)="toast.dismiss()"
        >
          {{ t.message }}
        </button>
      }
    </div>
  `,
})
export class ToastOutlet {
  protected readonly toast = inject(ToastService);
}
