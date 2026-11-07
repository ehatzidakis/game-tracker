import { Injectable, signal } from '@angular/core';

/**
 * The small title and the right-hand button in the top bar. Screens with a fixed name set it in their route data
 * (`title` in `data`); the game screen sets it here once the game's name is known.
 */
@Injectable({ providedIn: 'root' })
export class PageTitle {
  readonly override = signal<string | null>(null);
  /** A button on the right of the top bar (Calendar: Subscribe). */
  readonly action = signal<{ label: string; run: () => void } | null>(null);
}
