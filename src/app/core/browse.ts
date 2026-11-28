import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/**
 * Swiping between games: the list you opened a game from (a Library tab, the Calendar, Now playing)
 * hands its games over here, in the order you saw them, when you tap one. The game's page then
 * swipes to the games either side. Only while you stay on that game (or its trophy list): landing
 * on any other page, another game included, ends it. Kept in memory only, so a reload ends it too.
 */
@Injectable({ providedIn: 'root' })
export class BrowseService {
  private ids: readonly number[] = [];
  /** The game you're on in the list; null when not browsing. */
  private current: number | null = null;
  /** The list's address, the game you tapped there and the last one you swiped to. */
  private fromUrl: string | null = null;
  private tapped: number | null = null;
  private last: number | null = null;

  constructor() {
    inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationEnd && this.current !== null) {
        if (!onGame(event.urlAfterRedirects, this.current)) this.current = null;
      }
    });
  }

  /** You tapped `id` in a list showing `ids`, at the address `fromUrl`. */
  start(ids: readonly number[], id: number, fromUrl: string): void {
    this.ids = [...ids];
    this.current = id;
    this.fromUrl = fromUrl;
    this.tapped = id;
    this.last = id;
  }

  /** The games either side of `id` in the list; both null when you aren't browsing at `id`. */
  neighbours(id: number): { prev: number | null; next: number | null } {
    const at = this.current === id ? this.ids.indexOf(id) : -1;
    if (at < 0) return { prev: null, next: null };
    return { prev: this.ids[at - 1] ?? null, next: this.ids[at + 1] ?? null };
  }

  /** A swipe moved you to `id`. */
  moved(id: number): void {
    this.current = id;
    this.last = id;
  }

  /**
   * Back at the list's address: the game to bring into view (the last one you swiped to), once.
   * Null if you didn't swipe away from the one you tapped (the list's own scroll is right then).
   */
  takeReveal(url: string): number | null {
    if (url !== this.fromUrl || this.last === null || this.last === this.tapped) return null;
    const id = this.last;
    this.fromUrl = this.tapped = this.last = null;
    return id;
  }
}

/** The address is this game's page, or one under it (its trophy list). */
function onGame(url: string, id: number): boolean {
  const path = url.split(/[?#]/)[0];
  return path === `/game/${id}` || path.startsWith(`/game/${id}/`);
}
