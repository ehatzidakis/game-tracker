import { Component, computed, input } from '@angular/core';

/** The ring's radius in its 36-unit drawing; the stroke is 3 wide, so it just fits. */
const RADIUS = 15.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The ring's colour, by OpenCritic's own tiers: Mighty (84 and up) green, Strong (75–83) yellow,
 * Fair (67–74) orange, Weak (under 67) red. iOS's dark-mode system colours, which all read well
 * on the black badge.
 */
const TIERS: readonly { from: number; color: string }[] = [
  { from: 84, color: '#30d158' },
  { from: 75, color: '#ffd60a' },
  { from: 67, color: '#ff9f0a' },
  { from: 0, color: '#ff453a' },
];

export function scoreColor(score: number): string {
  return TIERS.find((tier) => score >= tier.from)!.color;
}

/**
 * A score out of 100 in a ring that's filled as far as the score (50 is half the circle, 94
 * nearly all of it) and coloured by how good it is. Used for OpenCritic's Top Critic Average on
 * Library covers.
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
          [attr.stroke]="color()"
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
  protected readonly color = computed(() => scoreColor(this.shown()));
  /** The filled part, then a gap as long as the whole ring. */
  protected readonly dash = computed(
    () => `${((CIRCUMFERENCE * this.shown()) / 100).toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`,
  );
}
