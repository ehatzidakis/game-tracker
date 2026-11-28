/**
 * Sideways swipes on a game's page, to the next or previous game in the list you came from
 * (core/browse.ts). The page follows your finger; let go past a third of the width, or with a
 * flick, and it goes, otherwise it springs back. Past the first or last game it only stretches.
 *
 * The element has `touch-action: pan-y`, so the browser keeps vertical scrolling (and cancels the
 * pointer once it scrolls) while sideways movement comes here. The drag writes the transform
 * straight to the element: no signals, no change detection on moved frames.
 */

export type SwipeDir = 'prev' | 'next';

/** The left edge belongs to the iPhone's own Back swipe. */
const EDGE = 24;
/** How far a finger moves before it counts as sideways or vertical. */
const LOCK = 10;
/** Goes once dragged past this share of the width... */
const DISTANCE = 1 / 3;
/** ...or flicked at least this fast (px/ms), at least this far. */
const FLICK_SPEED = 0.45;
const FLICK_MIN = 40;
/** Past the first or last game, the page moves this much of the finger's distance. */
const STRETCH = 0.3;
const SPRING_MS = 200;

/** How far the page moves for a finger `dx` along: all of it, or a stretch past an end. */
export function resist(dx: number, canPrev: boolean, canNext: boolean): number {
  const blocked = dx > 0 ? !canPrev : !canNext;
  return blocked ? dx * STRETCH : dx;
}

/** Where a drag that ended `dx` along at `velocity` px/ms goes; null springs back. */
export function decide(
  dx: number,
  velocity: number,
  width: number,
  canPrev: boolean,
  canNext: boolean,
): SwipeDir | null {
  const dir: SwipeDir = dx < 0 ? 'next' : 'prev';
  if (dx === 0 || (dir === 'next' ? !canNext : !canPrev)) return null;
  const far = Math.abs(dx) > width * DISTANCE;
  const flick =
    Math.abs(dx) > FLICK_MIN && Math.abs(velocity) >= FLICK_SPEED && Math.sign(velocity) === Math.sign(dx);
  return far || flick ? dir : null;
}

export interface SwipeOptions {
  /** The games either side, read when a drag starts. */
  neighbours(): { prev: number | null; next: number | null };
  /** False where a drag should do its own thing (a sideways strip, a field, an open sheet). */
  canStart(target: Element): boolean;
  /** Goes to the next or previous game, the page `dx` along; resolves once it's settled. */
  go(dir: SwipeDir, dx: number): Promise<void>;
}

/** Listens for swipes on `el`; returns the function that stops it. */
export function attachSwipe(el: HTMLElement, opts: SwipeOptions): () => void {
  let busy = false;
  let pointer: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let dx = 0;
  let canPrev = false;
  let canNext = false;
  /** Recent finger positions, for the speed when you let go. */
  let samples: { x: number; t: number }[] = [];

  // The page's whole width (the scrolling area's, past the page's side margins).
  const width = () =>
    el.closest('main')?.clientWidth || el.getBoundingClientRect().width || window.innerWidth;
  const place = (x: number) => {
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
  };
  const reset = () => {
    pointer = null;
    dragging = false;
    samples = [];
  };

  const springBack = () => {
    const from = el.style.transform;
    place(0);
    if (!from || typeof el.animate !== 'function' || reducedMotion()) return;
    el.animate([{ transform: from }, { transform: 'translate3d(0, 0, 0)' }], {
      duration: SPRING_MS,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    });
  };

  /** A drag that moved the page mustn't also tap a link under the finger. */
  const swallowClick = () => {
    const stop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 400);
  };

  const down = (e: PointerEvent) => {
    if (busy || pointer !== null || !e.isPrimary || e.pointerType === 'mouse') return;
    if (e.clientX < EDGE || !(e.target instanceof Element) || !opts.canStart(e.target)) return;
    const { prev, next } = opts.neighbours();
    if (prev === null && next === null) return;
    canPrev = prev !== null;
    canNext = next !== null;
    pointer = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    samples = [{ x: e.clientX, t: e.timeStamp }];
  };

  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    const x = e.clientX - startX;
    const y = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(x) < LOCK && Math.abs(y) < LOCK) return;
      // Vertical wins ties: scrolling the page must feel exactly as before.
      if (Math.abs(x) <= Math.abs(y)) return reset();
      dragging = true;
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        // Already released (the finger left); the drag still works without it.
      }
    }
    dx = x;
    samples.push({ x: e.clientX, t: e.timeStamp });
    if (samples.length > 6) samples.shift();
    place(resist(dx, canPrev, canNext));
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    const wasDragging = dragging;
    // The speed over the last 100ms: a drag that stopped before letting go isn't a flick.
    const lastSample = samples[samples.length - 1];
    const first = samples.find((s) => s.t >= (lastSample?.t ?? 0) - 100);
    const held = lastSample ? e.timeStamp - lastSample.t > 100 : true;
    const velocity =
      first && lastSample && !held
        ? (lastSample.x - first.x) / Math.max(1, lastSample.t - first.t)
        : 0;
    reset();
    if (!wasDragging) return;
    swallowClick();
    const dir = decide(dx, velocity, width(), canPrev, canNext);
    if (!dir) return springBack();
    busy = true;
    opts.go(dir, resist(dx, canPrev, canNext)).finally(() => {
      busy = false;
    });
  };

  const cancel = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    const wasDragging = dragging;
    reset();
    if (wasDragging) springBack();
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
