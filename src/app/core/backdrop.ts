import { computed, Injectable, signal } from '@angular/core';
import { coverUrl } from './igdb';

/**
 * Game art behind the app (Settings → Game art): one IGDB screenshot or artwork from a game in
 * your library, kept on this device like the background colour. The shell draws it behind the
 * page (see .game-backdrop in styles.css), blurred and see-through as set by the Blur and
 * Brightness sliders. Brightness 100% is the strongest the picture can be at that blur with grey
 * secondary text still at 4.5:1 over its brightest part (artStrength()).
 */
export interface Backdrop {
  /** IGDB image id (a screenshot or an artwork). */
  imageId: string;
  gameId: number;
  /** The game's name, shown in Settings. */
  game: string;
}

export const BACKDROP_KEY = 'backdrop';

/** The saved choice, or null if there is none or it can't be read. */
export function readBackdrop(raw: string | null): Backdrop | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Backdrop>;
    return typeof value.imageId === 'string' &&
      /^[a-z0-9]+$/i.test(value.imageId) &&
      typeof value.gameId === 'number' &&
      typeof value.game === 'string'
      ? { imageId: value.imageId, gameId: value.gameId, game: value.game }
      : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class BackdropService {
  readonly current = signal<Backdrop | null>(readBackdrop(stored()));
  /**
   * IGDB's 1080p copy: a wide picture fills a tall phone screen by its height, so only its middle
   * shows, enlarged; the smaller sizes looked blurry and blocky with Blur low.
   */
  readonly url = computed(() => {
    const art = this.current();
    return art ? coverUrl(art.imageId, '1080p') : null;
  });

  set(art: Backdrop): void {
    this.current.set(art);
    try {
      localStorage.setItem(BACKDROP_KEY, JSON.stringify(art));
    } catch {
      // Storage blocked: it lasts until the app closes.
    }
  }

  clear(): void {
    this.current.set(null);
    try {
      localStorage.removeItem(BACKDROP_KEY);
    } catch {
      // Storage blocked: nothing was kept.
    }
  }

  /** How soft and how bright it is (the sliders on the Game art screen). */
  readonly look = signal<BackdropLook>(readLook(stored(LOOK_KEY)));

  setLook(change: Partial<BackdropLook>): void {
    const look = readLook(JSON.stringify({ ...this.look(), ...change }));
    this.look.set(look);
    try {
      localStorage.setItem(LOOK_KEY, JSON.stringify(look));
    } catch {
      // Storage blocked: it lasts until the app closes.
    }
  }
}

/**
 * The sliders' values. Blur in CSS pixels. Brightness as a share of the readable strength
 * (artStrength()): 1 keeps grey text at 4.5:1 over the brightest part; more is brighter than
 * that, at the cost of reading on bright pictures.
 */
export interface BackdropLook {
  blur: number;
  brightness: number;
}

export const LOOK_KEY = 'backdrop-look';
export const DEFAULT_LOOK: BackdropLook = { blur: 12, brightness: 1 };
export const BLUR_MAX = 48;
export const BRIGHTNESS_MIN = 0.5;
export const BRIGHTNESS_MAX = 2;

/** The saved sliders, each kept in its range; the defaults for anything missing or unreadable. */
export function readLook(raw: string | null): BackdropLook {
  let value: Partial<BackdropLook> = {};
  try {
    value = raw ? (JSON.parse(raw) as Partial<BackdropLook>) : {};
  } catch {
    // Unreadable: the defaults.
  }
  const within = (v: unknown, min: number, max: number, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  return {
    blur: Math.round(within(value.blur, 0, BLUR_MAX, DEFAULT_LOOK.blur)),
    brightness:
      Math.round(
        within(value.brightness, BRIGHTNESS_MIN, BRIGHTNESS_MAX, DEFAULT_LOOK.brightness) * 100,
      ) / 100,
  };
}

function stored(key = BACKDROP_KEY): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The glow's saturation boost (the CSS filter's saturate(); artStrength() reproduces it). */
export const ART_SATURATE = 1.6;
/** The readable strength never goes past this, even for a very dark picture. */
const MAX_STRENGTH = 0.5;
/** When the picture can't be read: safe for a pure white picture on black. */
export const FALLBACK_STRENGTH = 0.18;
/** A little over 4.5:1, since the samples only approximate the blur. */
const MIN_CONTRAST = 4.7;
/** Strongest the glow gets, whatever the Brightness slider says: still a glow behind the page. */
export const STRENGTH_CAP = 0.9;
/** IGDB's thumbnail is 90 × 90: the middle of the picture. */
const SAMPLE = 90;
/** Patches judged: the brightest ones decide, so the rest needn't be checked. */
const CANDIDATES = 64;

/**
 * How opaque the glow can be while staying readable: the highest strength at which every patch
 * of the picture (RGBA), saturated like the glow and laid over the ground at that strength,
 * still gives the muted text colour MIN_CONTRAST.
 */
export function artStrength(
  pixels: ArrayLike<number> | null,
  ground: string,
  muted: string,
  /** The most it may be (a wallpaper can show at full strength where it's dark). */
  max = MAX_STRENGTH,
  /** How much the picture is saturated as shown (the glow's ART_SATURATE; 1 for none). */
  saturation = ART_SATURATE,
): number {
  if (!pixels || pixels.length < 4) return Math.min(FALLBACK_STRENGTH, max);
  const g = hexRgb(ground);
  const textL = luminance(hexRgb(muted));
  const all: Rgb[] = [];
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    all.push(saturate([pixels[i], pixels[i + 1], pixels[i + 2]], saturation));
  }
  const patches = all
    .map((c) => ({ c, l: luminance(c) }))
    .sort((a, b) => b.l - a.l)
    .slice(0, CANDIDATES)
    .map((p) => p.c);
  const readable = (strength: number): boolean =>
    patches.every((c) => {
      const mixed = g.map((v, k) => v + strength * (c[k] - v)) as Rgb;
      return contrast(textL, luminance(mixed)) >= MIN_CONTRAST;
    });
  if (readable(max)) return max;
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (readable(mid)) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 1000) / 1000;
}

/**
 * The picture as the glow shows it at this blur, in patches: averaged over about the area the
 * blur spreads each point across. One thumbnail pixel is about 12.6 screen pixels behind a
 * phone-shaped page and a blur of b spreads over about 2b, so about 567 / b patches across
 * (every pixel when it's sharp).
 */
export function patchesAt(thumb: ArrayLike<number> | null, blur: number): number[] | null {
  if (!thumb || thumb.length !== SAMPLE * SAMPLE * 4) return null;
  const n = Math.min(SAMPLE, Math.max(6, Math.round(567 / Math.max(blur, 1))));
  const out: number[] = [];
  for (let cy = 0; cy < n; cy++) {
    const y0 = Math.floor((cy * SAMPLE) / n);
    const y1 = Math.floor(((cy + 1) * SAMPLE) / n);
    for (let cx = 0; cx < n; cx++) {
      const x0 = Math.floor((cx * SAMPLE) / n);
      const x1 = Math.floor(((cx + 1) * SAMPLE) / n);
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * SAMPLE + x) * 4;
          r += thumb[i];
          g += thumb[i + 1];
          b += thumb[i + 2];
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      out.push(r / count, g / count, b / count, 255);
    }
  }
  return out;
}

/** The picture's thumbnail pixels (RGBA, 90 × 90), or null if it can't be read. */
export async function sampleArt(imageId: string): Promise<Uint8ClampedArray | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://images.igdb.com/igdb/image/upload/t_thumb/${imageId}.jpg`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SAMPLE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    return ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null;
  }
}

type Rgb = [number, number, number];

function hexRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** CSS saturate(): the filter spec's colour matrix. */
function saturate([r, g, b]: Rgb, s: number): Rgb {
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  return [
    clamp((0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b),
    clamp((0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b),
    clamp((0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b),
  ];
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
