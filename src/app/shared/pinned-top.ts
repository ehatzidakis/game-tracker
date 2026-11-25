import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/**
 * A tab screen's top (<div class="pinned-top">: title, search, toolbar). It is fixed over the
 * scrolling area rather than part of it (styles.css), so when you pull down at the top only the
 * list rubber-bands, sliding under it, and the title never moves. Being fixed it takes no room,
 * so it tells the scrolling area its height (--pinned-h, on the frame around <main>) and the
 * list starts below it.
 * Its height changes with what it shows (a search's result count, the Library's filter), so it
 * keeps watching.
 */
@Directive({ selector: '.pinned-top' })
export class PinnedTop {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // A ResizeObserver reports after layout but before paint, so the list never shows a frame
    // under the top. It also fires once to start with, once the page is in place.
    const observer = new ResizeObserver(([entry]) => {
      const height = entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight;
      // Set on the frame around <main>, so the game art behind it (shell) can start below it too.
      el.closest('main')?.parentElement?.style.setProperty('--pinned-h', `${height}px`);
    });
    observer.observe(el);
    // The value is left behind on purpose: the next tab screen sets its own before it's
    // painted, and screens with a back button don't use it.
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
