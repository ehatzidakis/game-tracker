import { DestroyRef, inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** At most one check a minute while you move around the app. */
const CHECK_EVERY_MS = 60_000;
const RELOADED_FOR = 'app-update.reloaded-for';

/**
 * Switches to a new deploy as soon as there is one. iOS keeps a home-screen app in memory and
 * just resumes it when you open it again, so without this you'd keep the old version until the
 * app was fully closed.
 *
 * Every build names its main file after its contents (main-U3WSJJSQ.js). When the app comes back
 * to the screen, or you move to another screen, it fetches index.html and compares names; if the
 * live one is different, it reloads. Nothing is lost: every change is saved the moment you make it.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdate {
  private readonly current = loadedBundle();
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private lastCheck = 0;

  /** Starts watching. Called once, when the app starts. */
  start(): void {
    // The dev server's main.js has no hash: nothing to compare.
    if (!this.current) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void this.check(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    const sub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => void this.check(false));
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      sub.unsubscribe();
    });
  }

  private async check(always: boolean): Promise<void> {
    const now = Date.now();
    if (!always && now - this.lastCheck < CHECK_EVERY_MS) return;
    this.lastCheck = now;
    try {
      const res = await fetch('/index.html', { cache: 'no-store' });
      if (!res.ok) return;
      const live = liveBundle(await res.text());
      if (!live || live === this.current) return;
      // Reload once per new version, so a half-finished deploy can't loop.
      if (sessionStorage.getItem(RELOADED_FOR) === live) return;
      sessionStorage.setItem(RELOADED_FOR, live);
      location.reload();
    } catch {
      // Offline or storage blocked: try again next time.
    }
  }
}

/** "main-U3WSJJSQ.js" from the script tag this page was loaded with. */
function loadedBundle(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[src*="main-"]');
  return script ? liveBundle(`src="${new URL(script.src).pathname.slice(1)}"`) : null;
}

/** "main-U3WSJJSQ.js" from index.html's text. */
export function liveBundle(html: string): string | null {
  return /src="\/?(main-[\w-]+\.js)"/.exec(html)?.[1] ?? null;
}
