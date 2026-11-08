import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AppUpdate } from './core/app-update';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <!-- iOS 27 home-screen apps blur the top of the page unless a fixed, coloured element taller
         than 10px touches the top edge. This strip matches the page colour, so it's invisible. -->
    <div class="fixed inset-x-0 top-0 z-50 h-3 bg-ground pointer-events-none" aria-hidden="true"></div>
    @if (!ready()) {
      <!-- Shown while Firebase checks whether you're already signed in. -->
      <div class="fixed inset-0 grid place-items-center" role="status" aria-label="Loading">
        <div
          class="size-8 rounded-full border-2 border-raised border-t-muted animate-spin"
        ></div>
      </div>
    }
    <router-outlet />
  `,
})
export class App {
  constructor() {
    // Pick up a new deploy as soon as you reopen the app.
    inject(AppUpdate).start();
  }

  // True once the first page has been decided (signed in → app, signed out → login).
  protected readonly ready = toSignal(
    inject(Router).events.pipe(
      filter(
        (e) =>
          e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError,
      ),
      take(1),
      map(() => true),
    ),
    { initialValue: false },
  );
}
