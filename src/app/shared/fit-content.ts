import { afterEveryRender, Directive, ElementRef, inject } from '@angular/core';

/**
 * An input exactly as wide as what's in it (or its placeholder), so a "€" before it sits right
 * next to the amount instead of across an empty field.
 */
@Directive({
  selector: 'input[appFitWidth]',
  host: { '(input)': 'fit()', '(change)': 'fit()' },
})
export class FitWidth {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  constructor() {
    afterEveryRender(() => this.fit());
  }

  protected fit(): void {
    const length = Math.max(this.input.value.length, this.input.placeholder.length, 1);
    this.input.style.width = `${length + 0.5}ch`;
  }
}

/** A text area exactly as tall as its text: one line when empty, growing as you type. */
@Directive({
  selector: 'textarea[appGrow]',
  host: { '(input)': 'fit()', rows: '1' },
})
export class Grow {
  private readonly area = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;

  constructor() {
    afterEveryRender(() => this.fit());
  }

  protected fit(): void {
    this.area.style.height = 'auto';
    this.area.style.height = `${this.area.scrollHeight}px`;
  }
}
