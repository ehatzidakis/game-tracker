import { afterRenderEffect, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

/** Room kept between the two badges, in px. */
const GAP = 4;

/**
 * For a badge in a cover's bottom right corner (the Platinum trophy): hides it when the badge
 * in the bottom left corner (an element with class `fit-against` in the same cover, such as
 * HowLongToBeat's times) is too wide to leave it room. Measured, not guessed, so it holds for
 * any digits and both card sizes. Bind it to whatever changes the left badge
 * (`[appFitsBeside]="hltb"`) so it measures again.
 */
@Directive({ selector: '[appFitsBeside]' })
export class FitsBeside {
  readonly appFitsBeside = input<unknown>();

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const check = () => {
      const other = el.parentElement?.querySelector<HTMLElement>('.fit-against');
      const fits =
        !other || other.getBoundingClientRect().right + GAP <= el.getBoundingClientRect().left;
      el.style.visibility = fits ? '' : 'hidden';
    };
    // The cover's width changes with three or four a row; the left badge's with its digits.
    const observer = new ResizeObserver(check);
    afterRenderEffect(() => {
      this.appFitsBeside();
      observer.disconnect();
      if (el.parentElement) observer.observe(el.parentElement);
      const other = el.parentElement?.querySelector('.fit-against');
      if (other) observer.observe(other);
      check();
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
