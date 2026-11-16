import { Component } from '@angular/core';
import { Wordmark } from './wordmark';

/**
 * A tab screen's header row: the Questloggd wordmark on the left and the screen's large title
 * pinned right, on one baseline. Usage: <app-tab-title>Library</app-tab-title>.
 */
@Component({
  selector: 'app-tab-title',
  imports: [Wordmark],
  host: { class: 'flex items-baseline justify-between gap-3' },
  template: `
    <app-wordmark class="text-[24px] leading-7.25 font-bold" />
    <h1 class="large-title min-w-0 truncate"><ng-content /></h1>
  `,
})
export class TabTitle {}
