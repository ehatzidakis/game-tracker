import { Component, computed, inject } from '@angular/core';
import { LucidePlus } from '@lucide/angular';
import { eventCompany } from '../../../../api/_lib/igdb-events.js';
import type { GamingEvent } from '../../../../api/_lib/models.js';
import { EventsService } from '../../core/events.service';
import { CardGrid, eventDateLine, type GridCard, type GridFilter } from '../../shared/card-grid';
import { EventSheet } from '../../shared/event-sheet';

/**
 * Settings → Gaming events: every event you've added, including archived ones (the Calendar
 * shows what's coming up, the Library what's over), as cards. Tap one to open it.
 */
@Component({
  selector: 'app-events',
  imports: [CardGrid, LucidePlus],
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

    @if (cards().length) {
      <section aria-label="Events">
        <app-card-grid
          noun="event"
          allLabel="All events"
          [cards]="cards()"
          [filters]="filters()"
          [initial]="25"
        />
      </section>
    } @else {
      <p class="mt-12 text-center text-[15px] leading-5 text-muted">
        No events yet. Add State of Play, Nintendo Direct, Summer Game Fest and the like.
      </p>
    }
  `,
})
export class EventsPage {
  private readonly events = inject(EventsService);
  private readonly sheet = inject(EventSheet);

  /**
   * Every event as a card: upcoming (soonest first), then past (latest first), then archived
   * (greyed out). Filtered by when, or by company.
   */
  protected readonly cards = computed((): GridCard[] => {
    const now = Date.now();
    const all = this.events.events();
    const upcoming = all.filter((e) => !e.archived && e.startsAt >= now).reverse();
    const past = all.filter((e) => !e.archived && e.startsAt < now);
    const archived = all.filter((e) => e.archived);
    const card = (e: GamingEvent, when: string): GridCard => {
      const company = eventCompany(e);
      return {
        id: e.id,
        link: ['/event', e.id],
        name: e.title,
        event: { logoId: e.logoId ?? null, kind: e.kind },
        line: eventDateLine(e.startsAt),
        dim: e.archived,
        tags: [when, ...(company ? [`company-${company.name}`] : [])],
      };
    };
    return [
      ...upcoming.map((e) => card(e, 'upcoming')),
      ...past.map((e) => card(e, 'past')),
      ...archived.map((e) => card(e, 'archived')),
    ];
  });

  /** Upcoming, Past and Archived, then each company (A–Z). */
  protected readonly filters = computed((): GridFilter[] => {
    const companies = [
      ...new Set(
        this.cards()
          .flatMap((c) => c.tags)
          .filter((t) => t.startsWith('company-')),
      ),
    ].sort();
    return [
      { key: 'upcoming', title: 'Upcoming' },
      { key: 'past', title: 'Past' },
      { key: 'archived', title: 'Archived' },
      ...companies.map((key) => ({ key, title: key.slice(8), group: 'Company' })),
    ];
  });

  protected add(): void {
    void this.sheet.create();
  }
}
