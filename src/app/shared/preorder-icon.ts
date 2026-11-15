import { Component, input } from '@angular/core';

/**
 * Pre-ordered: a box with a clock, drawn in Lucide's style (Lucide has none). Decorative; the
 * badge or row that holds it says "Pre-ordered".
 */
@Component({
  selector: 'app-preorder-icon',
  host: { class: 'block shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="block"
    >
      <path d="M11 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 9h18" />
      <path d="M10 3v6M14 3v6" />
      <circle cx="17.5" cy="17.5" r="4.5" />
      <path d="M17.5 15.5v2l1.5 1" />
    </svg>
  `,
})
export class PreorderIcon {
  readonly size = input(16);
}
