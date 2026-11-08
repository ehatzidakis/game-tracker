import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import {
  LucideCalendarDays,
  LucideChevronLeft,
  LucideLibraryBig,
  LucideSearch,
  LucideSettings,
} from '@lucide/angular';
import { PageTitle } from '../core/page-title';
import { ChoiceSheetOutlet } from '../shared/choice-sheet';
import { PreorderSheetOutlet } from '../shared/preorder-sheet';
import { ToastOutlet } from '../shared/toast';

/** What a screen's route data can say about the top bar. */
export interface ShellRouteData {
  /** Small title shown in the top bar once the large title scrolls away. */
  title?: string;
  /** Shows a back button. */
  back?: boolean;
  /** The screen starts with full-width art under the top bar. */
  hero?: boolean;
}

/** How far a screen scrolls before the small title shows: past the large title, or the hero art. */
const TITLE_AFTER = 44;
const TITLE_AFTER_HERO = 250;

/** Signed-in layout: top bar, page content, and the bottom tab bar. Mobile only. */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideCalendarDays,
    LucideChevronLeft,
    LucideLibraryBig,
    LucideSearch,
    LucideSettings,
    ToastOutlet,
    ChoiceSheetOutlet,
    PreorderSheetOutlet,
  ],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly tabs = [
    { path: '/calendar', label: 'Calendar' },
    { path: '/library', label: 'Library' },
    { path: '/search', label: 'Search' },
    { path: '/settings', label: 'Settings' },
  ] as const;

  private readonly router = inject(Router);
  private readonly pageTitle = inject(PageTitle);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  protected readonly route = signal<ShellRouteData>(this.routeData());
  private readonly scrollTop = signal(0);
  /** Past the large title (or the artwork): the bar turns solid and shows the small title. */
  protected readonly titleShown = computed(
    () => this.scrollTop() > (this.route().hero ? TITLE_AFTER_HERO : TITLE_AFTER),
  );
  protected readonly scrolled = this.titleShown;
  protected readonly title = computed(() => this.pageTitle.override() ?? this.route().title ?? '');

  constructor() {
    // Only <main> scrolls, so the router's own scroll handling (which works on the window)
    // doesn't apply. New pages start at the top; Back restores where you were.
    const positions = new Map<string, number>();
    let restoring = false;
    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        positions.set(this.router.url, this.scroller().nativeElement.scrollTop);
        restoring = event.navigationTrigger === 'popstate';
      } else if (event instanceof NavigationEnd) {
        this.route.set(this.routeData());
        const top = restoring ? (positions.get(event.urlAfterRedirects) ?? 0) : 0;
        // Wait a frame so the new page has rendered and is tall enough.
        requestAnimationFrame(() => {
          this.scroller().nativeElement.scrollTop = top;
          this.onScroll();
        });
      }
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  protected onScroll(): void {
    this.scrollTop.set(this.scroller().nativeElement.scrollTop);
  }

  protected back(): void {
    if (history.length > 1) history.back();
    else void this.router.navigateByUrl('/library');
  }

  private routeData(): ShellRouteData {
    let snapshot: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (snapshot?.firstChild) snapshot = snapshot.firstChild;
    return (snapshot?.data ?? {}) as ShellRouteData;
  }
}
