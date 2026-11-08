import { Injectable, signal } from '@angular/core';

/**
 * The small title in the game screen's top bar. Screens with a fixed name set it in their route data
 * (`title` in `data`); the game screen sets it here once the game's name is known.
 */
@Injectable({ providedIn: 'root' })
export class PageTitle {
  readonly override = signal<string | null>(null);
}
