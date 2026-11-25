import { Injectable, signal } from '@angular/core';
import { remember, remembered } from './remembered';

/**
 * The app's background (the ground) and the greys stepped up from it, chosen in Settings and
 * kept on this device. Each palette lives in styles.css under :root[data-ground="…"]; Black has
 * no attribute (the tokens' own values). Every one keeps text at 4.5:1 or more on its lists and
 * sheets. Arcade, the loud one, also swaps the blue accent for pink. All stay dark: the iPhone status bar is always black in the home-screen app, so a
 * light ground would leave a band at the top.
 */
export type Ground = 'black' | 'charcoal' | 'midnight' | 'slate' | 'arcade';

export interface GroundOption {
  key: Ground;
  label: string;
  /** One line under the name in Settings. */
  hint: string;
  /** The page colour, and the grouped-list colour on it, for the swatch. */
  ground: string;
  group: string;
  /** Set when the option also changes the accent: shown as a dot on the swatch's list. */
  accent?: string;
  /** Its secondary text colour, if not the usual grey (game art keeps 4.5:1 against it). */
  muted?: string;
}

/** Secondary text on every background but Arcade (--color-muted in styles.css). */
export const MUTED = '#98989f';

export const GROUNDS: readonly GroundOption[] = [
  {
    key: 'black',
    label: 'Black',
    hint: 'True black, blends with the status bar',
    ground: '#000000',
    group: '#1c1c1e',
  },
  {
    key: 'charcoal',
    label: 'Charcoal',
    hint: 'A softer near-black',
    ground: '#0e0e10',
    group: '#1f1f22',
  },
  {
    key: 'midnight',
    label: 'Midnight',
    hint: 'Near-black with a hint of blue',
    ground: '#080b12',
    group: '#1a1f2b',
  },
  {
    key: 'slate',
    label: 'Slate',
    hint: 'Cool blue-grey, lists and covers stand out less',
    ground: '#16181c',
    group: '#22252b',
  },
  {
    key: 'arcade',
    label: 'Arcade',
    hint: 'Grape and hot pink, the pink replaces the blue',
    ground: '#120a1f',
    group: '#231736',
    accent: '#ff5cc6',
    muted: '#b4a6d0',
  },
];

/** Where the choice is kept; index.html reads the same key before the app starts (no flash). */
export const GROUND_KEY = 'ground';

/** Sets the palette on <html> and the browser's theme colour to match. */
export function applyGround(ground: Ground): void {
  const root = document.documentElement;
  if (ground === 'black') delete root.dataset['ground'];
  else root.dataset['ground'] = ground;
  const colour = GROUNDS.find((g) => g.key === ground)?.ground ?? '#000000';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colour);
}

@Injectable({ providedIn: 'root' })
export class GroundService {
  readonly current = signal<Ground>(
    remembered<Ground>(
      GROUND_KEY,
      'black',
      GROUNDS.map((g) => g.key),
    ),
  );

  constructor() {
    applyGround(this.current());
  }

  set(ground: Ground): void {
    this.current.set(ground);
    remember(GROUND_KEY, ground);
    applyGround(ground);
  }
}
