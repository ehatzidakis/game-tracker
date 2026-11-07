import { Component, DestroyRef, ElementRef, inject, viewChild } from '@angular/core';
import {
  NavigationEnd,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { LucideCalendar, LucideLibrary, LucideSearch, LucideSettings } from '@lucide/angular';
import { StatusPickerSheet } from '../shared/status-picker';
import { ToastOutlet } from '../shared/toast';

/** Signed-in layout: header, page content, and the bottom tab bar. Mobile only. */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideCalendar,
    LucideLibrary,
    LucideSearch,
    LucideSettings,
    ToastOutlet,
    StatusPickerSheet,
  ],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly tabs = [
    { path: '/calendar', label: 'Calendar' },
    { path: '/library', label: 'Library' },
    { path: '/search', label: 'Search' },
  ] as const;

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // Only <main> scrolls, so the router's own scroll handling (which works on the window)
    // doesn't apply. New pages start at the top; Back restores where you were.
    const router = inject(Router);
    const positions = new Map<string, number>();
    let restoring = false;
    const sub = router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        positions.set(router.url, this.scroller().nativeElement.scrollTop);
        restoring = event.navigationTrigger === 'popstate';
      } else if (event instanceof NavigationEnd) {
        const top = restoring ? (positions.get(event.urlAfterRedirects) ?? 0) : 0;
        // Wait a frame so the new page has rendered and is tall enough.
        requestAnimationFrame(() => (this.scroller().nativeElement.scrollTop = top));
      }
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }
}
