import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { artStrength, BRIGHTNESS_MAX, BRIGHTNESS_MIN } from './backdrop';
import { GROUNDS, GroundService, MUTED } from './ground';

/**
 * Wallpapers (Settings → Wallpaper): full pictures behind the whole app, from the very top of the
 * screen, behind the logo and the tab screens' titles, unlike game art, which starts under them.
 * The shell draws one behind the page, and every place that would paint the page colour over it
 * (a tab screen's top, the fade under it, the back screens' top, the iPhone strip) draws the same
 * picture instead (.wall-img in styles.css), lined up, so the top looks see-through while the
 * list still disappears under it.
 *
 * Each row of the picture is dimmed with the page colour just enough that grey text keeps 4.5:1
 * over it (rowStrengths()), so the dark sky at the top shows almost as it is and the bright parts
 * are toned down. Brightness above 100% shows more of it, at the cost of reading.
 */
export type WallpaperKey = 'pink-planet' | 'galaxy';

export interface WallpaperOption {
  key: WallpaperKey;
  label: string;
  src: string;
  /** Pixel art drawn with big blocks: scaled up without smoothing, so the blocks stay sharp. */
  pixelated: boolean;
}

export const WALLPAPERS: readonly WallpaperOption[] = [
  { key: 'pink-planet', label: 'Pink planet', src: '/wallpapers/pink-planet.png', pixelated: true },
  { key: 'galaxy', label: 'Galaxy', src: '/wallpapers/galaxy.jpg', pixelated: false },
];

export interface WallpaperChoice {
  key: WallpaperKey;
  /** As game art's Brightness: 1 keeps grey text at 4.5:1 everywhere; more shows more. */
  brightness: number;
}

export const WALLPAPER_KEY = 'wallpaper';

/** The saved choice, or null if there is none or it can't be read. */
export function readWallpaper(raw: string | null): WallpaperChoice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WallpaperChoice>;
    if (!WALLPAPERS.some((w) => w.key === value.key)) return null;
    const b = typeof value.brightness === 'number' && Number.isFinite(value.brightness) ? value.brightness : 1;
    return {
      key: value.key as WallpaperKey,
      brightness: Math.round(Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, b)) * 100) / 100,
    };
  } catch {
    return null;
  }
}

/** The picture is judged in this many patches across and down (about text-sized on a phone). */
export const SAMPLE_COLS = 36;
export const SAMPLE_ROWS = 64;

/**
 * How strong the picture can be in each row (top to bottom, 0 to 1) with grey text at 4.5:1 over
 * every patch in it, laid over the page colour. A row also takes its neighbours' limit, so the
 * gradient between rows never runs brighter than either allows.
 */
export function rowStrengths(
  pixels: ArrayLike<number>,
  cols: number,
  rows: number,
  ground: string,
  muted: string,
): number[] {
  const own = Array.from({ length: rows }, (_, r) =>
    artStrength(
      Array.prototype.slice.call(pixels, r * cols * 4, (r + 1) * cols * 4) as number[],
      ground,
      muted,
      1,
      1,
    ),
  );
  return own.map((s, r) => Math.min(s, own[r - 1] ?? s, own[r + 1] ?? s));
}

/**
 * The page colour laid over the picture, row by row: see-through where the picture may show at
 * full strength, nearly solid where it's bright. Brightness scales each row's strength.
 */
export function scrimGradient(strengths: readonly number[], ground: string, brightness: number): string {
  const n = parseInt(ground.slice(1), 16);
  const rgb = `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  const stops = strengths.map((s, i) => {
    const alpha = 1 - Math.min(1, s * brightness);
    const at = ((i + 0.5) / strengths.length) * 100;
    return `rgb(${rgb} / ${alpha.toFixed(3)}) ${at.toFixed(2)}%`;
  });
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

/** The picture's pixels in patches (RGBA, cols × rows), or null if it can't be read. */
async function samplePicture(src: string): Promise<Uint8ClampedArray | null> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_COLS;
    canvas.height = SAMPLE_ROWS;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, SAMPLE_COLS, SAMPLE_ROWS);
    return ctx.getImageData(0, 0, SAMPLE_COLS, SAMPLE_ROWS).data;
  } catch {
    return null;
  }
}

function stored(): string | null {
  try {
    return localStorage.getItem(WALLPAPER_KEY);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class WallpaperService {
  private readonly ground = inject(GroundService);

  readonly current = signal<WallpaperChoice | null>(readWallpaper(stored()));
  readonly option = computed(() => WALLPAPERS.find((w) => w.key === this.current()?.key) ?? null);
  private readonly sample = signal<{ key: WallpaperKey; pixels: Uint8ClampedArray } | null>(null);

  /** Each row's readable strength on the background colour in use (before Brightness). */
  private readonly strengths = computed(() => {
    const option = this.option();
    const sample = this.sample();
    if (!option || sample?.key !== option.key) return null;
    const ground = GROUNDS.find((g) => g.key === this.ground.current()) ?? GROUNDS[0];
    return rowStrengths(sample.pixels, SAMPLE_COLS, SAMPLE_ROWS, ground.ground, ground.muted ?? MUTED);
  });

  constructor() {
    effect(() => {
      const option = this.option();
      if (!option || this.sample()?.key === option.key) return;
      void samplePicture(option.src).then((pixels) => {
        if (pixels && this.option()?.key === option.key) this.sample.set({ key: option.key, pixels });
      });
    });
    // On <html>: data-wall turns the picture on everywhere; the variables are what it draws.
    effect(() => {
      const root = document.documentElement;
      const option = this.option();
      const strengths = this.strengths();
      if (!option || !strengths) {
        delete root.dataset['wall'];
        return;
      }
      const ground = GROUNDS.find((g) => g.key === this.ground.current()) ?? GROUNDS[0];
      root.style.setProperty('--wall-image', `url("${option.src}")`);
      root.style.setProperty(
        '--wall-scrim',
        scrimGradient(strengths, ground.ground, this.current()?.brightness ?? 1),
      );
      root.style.setProperty('--wall-rendering', option.pixelated ? 'pixelated' : 'auto');
      root.dataset['wall'] = option.key;
    });
  }

  set(key: WallpaperKey): void {
    this.save({ key, brightness: this.current()?.brightness ?? 1 });
  }

  setBrightness(brightness: number): void {
    const now = this.current();
    if (now) this.save({ ...now, brightness });
  }

  clear(): void {
    this.current.set(null);
    try {
      localStorage.removeItem(WALLPAPER_KEY);
    } catch {
      // Storage blocked: nothing was kept.
    }
  }

  private save(choice: WallpaperChoice): void {
    const value = readWallpaper(JSON.stringify(choice));
    this.current.set(value);
    try {
      localStorage.setItem(WALLPAPER_KEY, JSON.stringify(value));
    } catch {
      // Storage blocked: it lasts until the app closes.
    }
  }
}
