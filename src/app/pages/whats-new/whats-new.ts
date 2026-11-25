import { Component, inject } from '@angular/core';
import { changelogDate, WhatsNew } from '../../core/whats-new';

/**
 * Settings → What's new, also opened by tapping a What's new notification: every entry of the
 * changelog, newest first, each a date over a group with its title and what changed.
 */
@Component({
  selector: 'app-whats-new',
  template: `
    <h1 class="large-title">What’s new</h1>

    @for (entry of news.entries; track entry.id) {
      <section [attr.aria-labelledby]="'news-' + entry.id">
        <h2 class="group-header num">{{ date(entry.date) }}</h2>
        <div class="grouped">
          <div class="px-4 py-3">
            <p [id]="'news-' + entry.id" class="text-[17px] leading-5.5 font-semibold">
              {{ entry.title }}
            </p>
            <ul class="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-5 marker:text-muted">
              @for (item of entry.items; track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          </div>
        </div>
      </section>
    }
  `,
})
export class WhatsNewPage {
  protected readonly news = inject(WhatsNew);
  protected readonly date = changelogDate;

  constructor() {
    this.news.markSeen();
  }
}
