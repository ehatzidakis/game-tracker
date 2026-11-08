import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

const MIN = 1;
const MAX = 10;
const STEP = 0.5;

/** Snaps a position along the bar (0 = left edge, 1 = right) to 1–10 in half points. */
export function ratingAt(ratio: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  return MIN + Math.round((clamped * (MAX - MIN)) / STEP) * STEP;
}

/**
 * Rating out of 10 in half points, as a bar you slide your finger along (or tap). It reports the
 * value while you drag (`preview`) and saves it once you let go (`changed`).
 */
@Component({
  selector: 'app-rating-slider',
  host: { class: 'block' },
  template: `
    <div
      #track
      role="slider"
      [attr.tabindex]="disabled() ? -1 : 0"
      [attr.aria-disabled]="disabled()"
      aria-label="Rating out of 10"
      [attr.aria-valuemin]="min"
      [attr.aria-valuemax]="max"
      [attr.aria-valuenow]="shown()"
      [attr.aria-valuetext]="shown() ? shown() + ' out of 10' : 'Not rated'"
      class="relative h-11 select-none"
      [class.touch-none]="!disabled()"
      (pointerdown)="start($event)"
      (pointermove)="move($event)"
      (pointerup)="end($event)"
      (pointercancel)="cancel()"
      (keydown)="key($event)"
    >
      <!-- Track, with the part up to your rating filled in blue. -->
      <div class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-fill">
        <div
          class="h-full rounded-full bg-accent-fill"
          [style.width.%]="percent()"
          [class.transition-[width]]="!dragging()"
          [class.duration-150]="!dragging()"
        ></div>
      </div>
      @if (shown(); as v) {
        <!-- A round handle while editing; a thin line marking the rating while locked. -->
        <div
          class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white transition-[width,height,border-radius] duration-200"
          [class]="
            disabled()
              ? 'h-5 w-[3px] rounded-full'
              : 'size-7 rounded-full shadow-[0_2px_8px_rgb(0_0_0/0.35)]'
          "
          [style.left.%]="percent()"
          [class.scale-110]="dragging()"
          [class.transition-[left,scale]]="!dragging()"
          [class.duration-150]="!dragging()"
        ></div>
      }
    </div>
    <!-- 1 to 10 under the bar, for orientation. -->
    <div class="relative -mt-1 h-4 text-[11px] leading-4 text-muted" aria-hidden="true">
      @for (n of ticks; track n) {
        <span
          class="num absolute -translate-x-1/2"
          [style.left.%]="((n - min) / (max - min)) * 100"
        >
          {{ n }}
        </span>
      }
    </div>
  `,
})
export class RatingSlider {
  /** The saved rating, or null if there isn't one. */
  readonly value = input<number | null>(null);
  /** Shown but locked: no sliding, and scrolling over it works normally. */
  readonly disabled = input(false);
  /** While dragging: the rating under your finger. Null when you let go. */
  readonly preview = output<number | null>();
  /** When you let go (or press an arrow key): the rating to save. */
  readonly changed = output<number>();

  protected readonly min = MIN;
  protected readonly max = MAX;
  protected readonly ticks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  protected readonly dragging = signal(false);
  private readonly dragValue = signal<number | null>(null);

  protected shown(): number | null {
    return this.dragValue() ?? this.value();
  }

  protected percent(): number {
    const v = this.shown();
    return v == null ? 0 : ((v - MIN) / (MAX - MIN)) * 100;
  }

  protected start(event: PointerEvent): void {
    if (this.disabled()) return;
    // Keep getting moves even if your finger drifts off the bar.
    this.track().nativeElement.setPointerCapture?.(event.pointerId);
    this.dragging.set(true);
    this.follow(event);
  }

  protected move(event: PointerEvent): void {
    if (this.dragging()) this.follow(event);
  }

  protected end(event: PointerEvent): void {
    if (!this.dragging()) return;
    this.follow(event);
    const value = this.dragValue();
    this.dragging.set(false);
    this.preview.emit(null);
    if (value != null && value !== this.value()) this.changed.emit(value);
    this.dragValue.set(null);
  }

  protected cancel(): void {
    this.dragging.set(false);
    this.dragValue.set(null);
    this.preview.emit(null);
  }

  protected key(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const now = this.value() ?? MIN;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? Math.min(MAX, now + STEP)
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? Math.max(MIN, now - STEP)
          : null;
    if (next == null) return;
    event.preventDefault();
    if (next !== this.value()) this.changed.emit(next);
  }

  private follow(event: PointerEvent): void {
    const box = this.track().nativeElement.getBoundingClientRect();
    const value = ratingAt((event.clientX - box.left) / box.width);
    if (value !== this.dragValue()) {
      this.dragValue.set(value);
      this.preview.emit(value);
    }
  }
}
