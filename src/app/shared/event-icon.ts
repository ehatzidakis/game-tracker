import { Component, computed, input } from '@angular/core';
import { LucideGamepad2, LucideMic } from '@lucide/angular';
import type { EventKind } from '../../../api/_lib/models.js';

// PlayStation logo from Simple Icons (CC0). Simple Icons no longer carries Xbox or Nintendo, so
// those are plain shapes in their colours: a circled X, and a pair of Joy-Con.
export const PLAYSTATION =
  'M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z';

const BACKGROUND: Record<EventKind, string> = {
  playstation: '#0070d1',
  xbox: '#107c10',
  nintendo: '#e60012',
  showcase: '#b8892d',
  other: '#3a3a3c',
};

/** A gaming event's square tile: who's holding it, on their colour. */
@Component({
  selector: 'app-event-icon',
  imports: [LucideMic, LucideGamepad2],
  host: {
    class: 'grid shrink-0 place-items-center rounded-[8px] text-white',
    '[style.background]': 'background()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    'aria-hidden': 'true',
  },
  template: `
    @switch (kind()) {
      @case ('playstation') {
        <svg viewBox="0 0 24 24" [attr.width]="glyph()" [attr.height]="glyph()" fill="currentColor">
          <path [attr.d]="playstation" />
        </svg>
      }
      @case ('xbox') {
        <svg
          viewBox="0 0 24 24"
          [attr.width]="glyph()"
          [attr.height]="glyph()"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M8.2 7.6 15.8 16.4M15.8 7.6 8.2 16.4" />
        </svg>
      }
      @case ('nintendo') {
        <svg viewBox="0 0 24 24" [attr.width]="glyph()" [attr.height]="glyph()" fill="currentColor">
          <path d="M10.6 3.5H8.4a4.4 4.4 0 0 0-4.4 4.4v8.2a4.4 4.4 0 0 0 4.4 4.4h2.2z" />
          <path d="M13.4 3.5h2.2a4.4 4.4 0 0 1 4.4 4.4v8.2a4.4 4.4 0 0 1-4.4 4.4h-2.2z" />
          <circle cx="7.6" cy="8.6" r="1.5" [attr.fill]="background()" />
          <circle cx="16.4" cy="13.6" r="1.5" [attr.fill]="background()" />
        </svg>
      }
      @case ('showcase') {
        <svg lucideMic [size]="glyph()" [strokeWidth]="2.25"></svg>
      }
      @default {
        <svg lucideGamepad2 [size]="glyph()" [strokeWidth]="2.25"></svg>
      }
    }
  `,
})
export class EventIcon {
  readonly kind = input.required<EventKind>();
  /** Tile size in px. */
  readonly size = input(40);
  protected readonly playstation = PLAYSTATION;
  protected readonly background = computed(() => BACKGROUND[this.kind()] ?? BACKGROUND.other);
  protected readonly glyph = computed(() => Math.round(this.size() * 0.55));
}
