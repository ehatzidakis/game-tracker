import {
  afterNextRender,
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
import { DetailsSheetOutlet } from '../shared/details-sheet';
import { EventSheetOutlet } from '../shared/event-sheet';
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
/** A tab screen's top only slides away once the page is this far down. */
const HIDE_TOP_AFTER = 60;
/** How far a scroll must go in one direction before the top slides away or back (no jitter). */
const HIDE_TOP_TRAVEL = 8;

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
    DetailsSheetOutlet,
    EventSheetOutlet,
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
  private readonly url = signal(this.router.url);
  /** Which tab the sliding highlight sits under; -1 off the tabs (a game's page). */
  protected readonly activeTab = computed(() =>
    this.tabs.findIndex((t) => this.url() === t.path || this.url().startsWith(t.path + '?')),
  );
  /**
   * Past the large title (or the artwork): the bar turns solid and shows the small title.
   * The scroll position itself is never a signal: the screen is only re-checked when one of these
   * flips, not on every scrolled frame (which made long lists stutter on Android).
   */
  protected readonly titleShown = signal(false);
  protected readonly scrolled = this.titleShown;
  /** Not scrolled at all: a tab's pinned top shows no fade under it. */
  protected readonly atTop = signal(true);
  /** A tab screen's top slid away: scrolling down hides it, scrolling up brings it back. */
  protected readonly topHidden = signal(false);
  private lastTop = 0;
  /** How far the page has gone in the current direction (down positive, up negative). */
  private travel = 0;
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
        this.url.set(event.urlAfterRedirects);
        const scroller = this.scroller().nativeElement;
        if (!restoring) {
          // A new page starts at the top straight away, so it never shows for a frame at the
          // old page's scroll position (that jump looked like a flicker).
          scroller.scrollTop = 0;
          this.resetScroll();
        } else {
          // Back: wait a frame so the page has rendered and is tall enough to restore into.
          const top = positions.get(event.urlAfterRedirects) ?? 0;
          this.resetScroll();
          requestAnimationFrame(() => {
            scroller.scrollTop = top;
            this.resetScroll();
          });
        }
      }
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => sub.unsubscribe());

    // A plain passive listener rather than a template (scroll) binding: a template listener runs
    // change detection for the whole app on every scroll event.
    afterNextRender(() => {
      const scroller = this.scroller().nativeElement;
      const onScroll = () => this.onScroll();
      scroller.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => scroller.removeEventListener('scroll', onScroll));
    });
  }

  /** Sets the signals that depend on where the page is (each only notifies when it changes). */
  private showPosition(top: number): void {
    this.titleShown.set(top > (this.route().hero ? TITLE_AFTER_HERO : TITLE_AFTER));
    this.atTop.set(top <= 0);
  }

  private onScroll(): void {
    const scroller = this.scroller().nativeElement;
    const top = scroller.scrollTop;
    this.showPosition(top);
    if (top <= 0) {
      // At the very top (or pulled past it): the top is always there.
      this.lastTop = 0;
      this.travel = 0;
      this.topHidden.set(false);
      return;
    }
    // Bouncing past the bottom pulls the page back up; that isn't you scrolling up.
    if (top >= scroller.scrollHeight - scroller.clientHeight) return;
    const delta = top - this.lastTop;
    this.lastTop = top;
    if (this.route().back || delta === 0) return;
    if (Math.sign(delta) !== Math.sign(this.travel)) this.travel = 0;
    this.travel += delta;
    if (this.travel <= -HIDE_TOP_TRAVEL) {
      this.topHidden.set(false);
    } else if (
      this.travel >= HIDE_TOP_TRAVEL &&
      top > HIDE_TOP_AFTER &&
      // Not while typing in its search field.
      !document.activeElement?.closest('.pinned-top')
    ) {
      this.topHidden.set(true);
    }
  }

  /** A new page, or one restored by Back: its top shows, and scrolling counts from here. */
  private resetScroll(): void {
    const top = this.scroller().nativeElement.scrollTop;
    this.showPosition(top);
    this.lastTop = top;
    this.travel = 0;
    this.topHidden.set(false);
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
