import { Component, computed, input } from '@angular/core';
import type { EventKind } from '../../../api/_lib/models.js';
import { coverUrl, type ImageSize } from '../core/igdb';
import { EventIcon } from './event-icon';

/**
 * A gaming event's picture, in whatever shape its host gives it: IGDB's logo, or (for an event
 * you made yourself) its host's icon on its colour.
 * Logos are wide. In a wide frame the logo fills it; in a tall one (a Library card) the whole
 * logo sits in the middle over a blurred copy of itself.
 */
@Component({
  selector: 'app-event-art',
  imports: [EventIcon],
  host: { class: 'relative block overflow-hidden bg-raised' },
  template: `
    @if (src(); as url) {
      @if (fit() === 'contain') {
        <img
          [src]="url"
          alt=""
          loading="lazy"
          class="absolute inset-0 size-full scale-150 object-cover opacity-55 blur-lg"
        />
      }
      <img
        [src]="url"
        alt=""
        [attr.loading]="eager() ? null : 'lazy'"
        class="relative size-full"
        [class]="fit() === 'contain' ? 'object-contain' : 'object-cover'"
      />
    } @else {
      <app-event-icon class="size-full! rounded-none!" [kind]="kind()" [size]="iconSize()" />
    }
    <!-- Hairline edge, as on covers. -->
    <span
      class="pointer-events-none absolute inset-0 rounded-[inherit] ring-[0.5px] ring-white/15 ring-inset"
      aria-hidden="true"
    ></span>
  `,
})
export class EventArt {
  readonly logoId = input<string | null | undefined>(null);
  readonly kind = input<EventKind>('other');
  readonly fit = input<'cover' | 'contain'>('cover');
  readonly size = input<ImageSize>('screenshot_med');
  /** The icon's size (px) when there's no logo. */
  readonly iconSize = input(64);
  readonly eager = input(false);
  protected readonly src = computed(() => {
    const id = this.logoId();
    return id ? coverUrl(id, this.size()) : null;
  });
}
