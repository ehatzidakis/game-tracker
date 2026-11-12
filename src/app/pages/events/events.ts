import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronRight, LucidePlus } from '@lucide/angular';
import type { GamingEvent } from '../../../../api/_lib/models.js';
import { EventsService } from '../../core/events.service';
import { EventIcon } from '../../shared/event-icon';
import { EventSheet, timeRange } from '../../shared/event-sheet';

const DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Settings → Gaming events: every event you've added, including archived ones (the Calendar
 * shows what's coming up, the Library what's over). Tap one to open it.
 */
@Component({
  selector: 'app-events',
  imports: [RouterLink, EventIcon, LucideChevronRight, LucidePlus],
  template: `
    <h1 class="large-title">Gaming events</h1>

    <div class="grouped mt-3">
      <button type="button" class="row text-accent" (click)="add()">
        <svg lucidePlus [size]="22" [strokeWidth]="2" class="shrink-0"></svg>
        New gaming event
      </button>
    </div>
    <p class="group-footer">
      Events show in the Calendar tab until they're over, then in the Library's Events tab, and
      always in your iPhone Calendar subscription. Events IGDB lists are added from Search.
    </p>

    @for (group of groups(); track group.title) {
      <section [attr.aria-label]="group.title">
        <h2 class="group-header">{{ group.title }}</h2>
        <ul class="grouped" style="--sep-inset: 68px">
          @for (event of group.events; track event.id) {
            <li class="row p-0!">
              <a [routerLink]="['/event', event.id]" class="row py-2!">
                <app-event-icon [kind]="event.kind" [size]="40" />
                <div class="min-w-0 flex-1">
                  <p class="truncate" [class.text-muted]="event.archived">{{ event.title }}</p>
                  <p class="num text-[15px] leading-5 text-muted">{{ when(event) }}</p>
                </div>
                <svg
                  lucideChevronRight
                  [size]="18"
                  [strokeWidth]="2.25"
                  class="-mr-1 shrink-0 text-faint"
                ></svg>
              </a>
            </li>
          }
        </ul>
      </section>
    } @empty {
      <p class="mt-12 text-center text-[15px] leading-5 text-muted">
        No events yet. Add State of Play, Nintendo Direct, Summer Game Fest and the like.
      </p>
    }
  `,
})
export class EventsPage {
  private readonly events = inject(EventsService);
  private readonly sheet = inject(EventSheet);

  /** Upcoming (soonest first), then past (latest first), then archived. */
  protected readonly groups = computed(() => {
    const now = Date.now();
    const all = this.events.events();
    const upcoming = all.filter((e) => !e.archived && e.startsAt >= now).reverse();
    const past = all.filter((e) => !e.archived && e.startsAt < now);
    const archived = all.filter((e) => e.archived);
    return [
      { title: 'Upcoming', events: upcoming },
      { title: 'Past', events: past },
      { title: 'Archived', events: archived },
    ].filter((group) => group.events.length);
  });

  /** "Tue 9 Jun 2026 · 22:00" */
  protected when(event: GamingEvent): string {
    return `${DAY.format(event.startsAt).replace(',', '')} · ${timeRange(event)}`;
  }

  protected add(): void {
    void this.sheet.create();
  }
}
