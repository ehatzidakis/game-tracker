import { Component, computed, inject } from '@angular/core';
import { LucideChevronRight, LucidePlus } from '@lucide/angular';
import type { GamingEvent } from '../../../../api/_lib/models.js';
import { EventsService } from '../../core/events.service';
import { LibraryService } from '../../core/library.service';
import { EventIcon } from '../../shared/event-icon';
import { EventSheet, timeRange } from '../../shared/event-sheet';

const DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Settings → Gaming events: every event you've added, including past and archived ones (the
 * Calendar only shows what's coming up). Tap one to edit, archive or delete it.
 */
@Component({
  selector: 'app-events',
  imports: [EventIcon, LucideChevronRight, LucidePlus],
  template: `
    <h1 class="large-title">Gaming events</h1>

    <div class="grouped mt-3">
      <button type="button" class="row text-accent" (click)="add()">
        <svg lucidePlus [size]="22" [strokeWidth]="2" class="shrink-0"></svg>
        New gaming event
      </button>
    </div>
    <p class="group-footer">
      Events show in the Calendar tab until they've happened, and in your iPhone Calendar
      subscription. Games can say which event they were first shown at and which one announced
      their release date.
    </p>

    @for (group of groups(); track group.title) {
      <section [attr.aria-label]="group.title">
        <h2 class="group-header">{{ group.title }}</h2>
        <ul class="grouped" style="--sep-inset: 68px">
          @for (event of group.events; track event.id) {
            <li class="row p-0!">
              <button type="button" class="row py-2! text-left" (click)="edit(event)">
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
              </button>
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
  private readonly library = inject(LibraryService);
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

  /** How many of your games point to each event. */
  private readonly uses = computed(() => {
    const uses = new Map<string, number>();
    for (const game of this.library.games()) {
      for (const id of new Set([game.firstShownEventId, game.dateAnnouncedEventId])) {
        if (id) uses.set(id, (uses.get(id) ?? 0) + 1);
      }
    }
    return uses;
  });

  /** "Tue 9 Jun 2026 · 22:00 · 3 games" */
  protected when(event: GamingEvent): string {
    const n = this.uses().get(event.id) ?? 0;
    const games = n ? ` · ${n} ${n === 1 ? 'game' : 'games'}` : '';
    return `${DAY.format(event.startsAt).replace(',', '')} · ${timeRange(event)}${games}`;
  }

  protected add(): void {
    void this.sheet.create();
  }

  protected edit(event: GamingEvent): void {
    void this.sheet.edit(event);
  }
}
