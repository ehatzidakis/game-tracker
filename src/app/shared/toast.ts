import { Component, inject } from '@angular/core';
import { LucideCircleAlert, LucideCircleCheck } from '@lucide/angular';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toast',
  imports: [LucideCircleAlert, LucideCircleCheck],
  // Takes no space in the tab bar's grid; the message floats just above the bar.
  host: { class: 'contents' },
  template: `
    <div
      class="pointer-events-none absolute inset-x-0 bottom-full flex justify-center px-4 pb-3"
      aria-live="polite"
    >
      @if (toast.current(); as t) {
        <button
          type="button"
          class="toast pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-raised/95 py-2.5 pr-4 pl-3 text-left text-[15px] leading-5 shadow-[0_8px_28px_rgb(0_0_0/0.5)] backdrop-blur-xl"
          [attr.role]="t.kind === 'error' ? 'alert' : null"
          (click)="toast.dismiss()"
        >
          @if (t.kind === 'error') {
            <svg lucideCircleAlert [size]="18" class="shrink-0 text-danger"></svg>
          } @else {
            <svg lucideCircleCheck [size]="18" class="shrink-0 text-accent"></svg>
          }
          <span>{{ t.message }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .toast {
      animation: toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.97);
      }
    }
  `,
})
export class ToastOutlet {
  protected readonly toast = inject(ToastService);
}
