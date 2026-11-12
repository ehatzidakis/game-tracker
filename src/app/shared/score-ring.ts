import { Component, computed, input } from '@angular/core';

/** The ring's radius in its 36-unit drawing; the stroke is 3 wide, so it just fits. */
const RADIUS = 15.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A score out of 100 in a ring that's filled as far as the score: 50 is half the circle, 94
 * nearly all of it. Used for OpenCritic's Top Critic Average on Library covers.
 */
@Component({
  selector: 'app-score-ring',
  host: {
    class:
      'relative grid shrink-0 place-items-center rounded-full bg-black/75 text-white backdrop-blur-sm',
    role: 'img',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[attr.aria-label]': '"OpenCritic " + shown()',
  },
  template: `
    <!-- Starts at the top and runs clockwise. -->
    <svg viewBox="0 0 36 36" class="absolute inset-0 size-full -rotate-90" aria-hidden="true">
      <circle
        cx="18"
        cy="18"
        [attr.r]="radius"
        fill="none"
        stroke="rgb(255 255 255 / 0.22)"
        stroke-width="3"
      />
      @if (shown() > 0) {
        <circle
          cx="18"
          cy="18"
          [attr.r]="radius"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          [attr.stroke-dasharray]="dash()"
        />
      }
    </svg>
    <span
      class="num relative leading-none font-semibold tracking-normal"
      [class]="shown() === 100 ? 'text-[9px]' : 'text-[11px]'"
      aria-hidden="true"
      >{{ shown() }}</span
    >
  `,
})
export class ScoreRing {
  readonly score = input.required<number>();
  /** Diameter in px. */
  readonly size = input(28);
  protected readonly radius = RADIUS;
  protected readonly shown = computed(() => Math.max(0, Math.min(100, Math.round(this.score()))));
  /** The filled part, then a gap as long as the whole ring. */
  protected readonly dash = computed(
    () => `${((CIRCUMFERENCE * this.shown()) / 100).toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`,
  );
}
