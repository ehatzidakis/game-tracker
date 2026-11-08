import { Component, input, model } from '@angular/core';
import { LucideCircleX, LucideSearch } from '@lucide/angular';

/** An iOS search field with a clear button, for filtering what's on a screen. */
@Component({
  selector: 'app-search-field',
  imports: [LucideSearch, LucideCircleX],
  host: { class: 'relative block' },
  template: `
    <svg
      lucideSearch
      [size]="17"
      [strokeWidth]="2.25"
      class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted"
    ></svg>
    <!-- 17px text: 16px or more stops iOS zooming in on focus. -->
    <input
      #field
      type="search"
      autocomplete="off"
      enterkeyhint="search"
      class="search-field h-9 w-full rounded-[10px] bg-fill pr-9 pl-8 text-[17px] outline-none"
      [placeholder]="label()"
      [attr.aria-label]="label()"
      [value]="query()"
      (input)="query.set(field.value)"
      (keydown.enter)="field.blur()"
    />
    @if (query()) {
      <!-- Clears the search and keeps the keyboard up, as in iOS. -->
      <button
        type="button"
        class="absolute top-0 right-0 grid h-9 w-9 place-items-center text-muted active:opacity-60"
        aria-label="Clear search"
        (pointerdown)="$event.preventDefault()"
        (click)="query.set(''); field.focus()"
      >
        <svg lucideCircleX [size]="18" class="fill-current [&>*]:stroke-group"></svg>
      </button>
    }
  `,
})
export class SearchField {
  readonly query = model('');
  /** Placeholder and accessible name: "Search your library". */
  readonly label = input.required<string>();
}
