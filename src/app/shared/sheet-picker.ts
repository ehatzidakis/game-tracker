import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { isApple } from '../core/platform';
import { ChoiceSheet, type Choice } from './choice-sheet';

/**
 * A <select> that opens the app's own bottom sheet instead of the system picker, except on
 * iPhone, whose own picker menu already fits the app. Android's picker is a large dialog list
 * that looks nothing like the rest of the app.
 *
 * The <select> stays the source of truth: the sheet sets its value and fires its change event,
 * so the page's (change) handler works the same either way. Taps go to the <label> around it,
 * which also gives the sheet its title (its .sr-only text, or the row's first text).
 */
@Directive({ selector: 'select[sheetPicker]' })
export class SheetPicker {
  constructor() {
    if (isApple()) return;
    const select = inject<ElementRef<HTMLSelectElement>>(ElementRef).nativeElement;
    const sheet = inject(ChoiceSheet);
    const label = select.closest('label');
    if (!label) return;

    // The system picker never opens: taps land on the label, not the select.
    select.style.pointerEvents = 'none';

    const open = async (event: Event): Promise<void> => {
      event.preventDefault();
      const key = await sheet.pick(titleOf(label), choicesOf(select), select.value);
      if (key === null || key === select.value) return;
      select.value = key;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') void open(event);
    };
    label.addEventListener('click', open);
    select.addEventListener('keydown', onKey);
    inject(DestroyRef).onDestroy(() => {
      label.removeEventListener('click', open);
      select.removeEventListener('keydown', onKey);
    });
  }
}

function titleOf(label: HTMLLabelElement): string {
  const text =
    label.querySelector('.sr-only')?.textContent ??
    label.querySelector('span')?.textContent ??
    label.textContent;
  return text?.trim() || 'Choose';
}

/**
 * The select's options in order, each with its <optgroup>'s name if it has one, and the line
 * under it from its data-hint.
 */
function choicesOf(select: HTMLSelectElement): Choice<string>[] {
  return Array.from(select.options).map((option) => ({
    key: option.value,
    label: option.textContent?.trim() ?? option.value,
    hint: option.dataset['hint'] || undefined,
    group:
      option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.label : undefined,
  }));
}
