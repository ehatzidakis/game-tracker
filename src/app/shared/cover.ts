import { Component, computed, input } from '@angular/core';
import { coverUrl, type ImageSize } from '../core/igdb';

/** A game's box art, or its name on a plain tile when IGDB has no cover. */
@Component({
  selector: 'app-cover',
  host: { class: 'block relative aspect-[3/4] overflow-hidden rounded-lg bg-white/5' },
  template: `
    @if (src(); as url) {
      <img
        [src]="url"
        alt=""
        [attr.loading]="eager() ? null : 'lazy'"
        class="size-full object-cover"
      />
    } @else {
      <span class="absolute inset-0 grid place-items-center p-2 text-center text-xs text-zinc-500">
        {{ name() }}
      </span>
    }
    <ng-content />
  `,
})
export class Cover {
  readonly coverId = input<string | null | undefined>(null);
  readonly name = input('');
  readonly size = input<ImageSize>('cover_big');
  readonly eager = input(false);
  protected readonly src = computed(() => {
    const id = this.coverId();
    return id ? coverUrl(id, this.size()) : null;
  });
}
