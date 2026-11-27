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
    // With a wallpaper, the top shows the same picture rather than the page colour (styles.css).
    const wall = document.createElement('div');
    wall.className = 'pinned-wall';
    wall.setAttribute('aria-hidden', 'true');
    wall.appendChild(document.createElement('div')).className = 'wall-img';
    el.prepend(wall);
    // Set on the frame around <main>, so the game art behind it (shell) can start below it too.
    // Measured afresh each time (the transform that slides it away doesn't change offsetHeight).
    const measure = () => {
      const frame = el.closest('main')?.parentElement;
      if (!frame || !el.isConnected) return;
      const value = `${el.offsetHeight}px`;
      if (frame.style.getPropertyValue('--pinned-h') !== value) {
        frame.style.setProperty('--pinned-h', value);
      }
    };
    // A ResizeObserver reports after layout but before paint, so the list never shows a frame
    // under the top. It also fires once to start with, once the page is in place.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // iOS can open the home-screen app in the background, where it doesn't lay out or deliver
    // resize reports; when the app then shows, the top had grown (search, toolbar) but the list
    // still started under the old, shorter top, cutting off its first row until you changed tab.
    // So measure again whenever the app shows or the screen changes size, and once the fonts are
    // in.
    const onVisible = () => {
      if (document.visibilityState === 'visible') requestAnimationFrame(measure);
    };
    const later = () => requestAnimationFrame(measure);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', later);
    window.addEventListener('resize', later);
    void document.fonts?.ready.then(later);
    // The value is left behind on purpose: the next tab screen sets its own before it's
    // painted, and screens with a back button don't use it.
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', later);
      window.removeEventListener('resize', later);
    });
  }
}
