import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  LucideCalendarCheck,
  LucideChevronRight,
  LucideExternalLink,
  LucidePencil,
  LucidePlus,
} from '@lucide/angular';
import { eventCompany, igdbEventFields, igdbIdOf } from '../../../../api/_lib/igdb-events.js';
import { eventEnd } from '../../../../api/_lib/models.js';
import { daysBetween } from '../../../../api/_lib/release.js';
import { today } from '../../core/dates';
import { EventsService } from '../../core/events.service';
import { IgdbService } from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { PageTitle } from '../../core/page-title';
import { CardGrid, gameMarks, yearOf, type GridCard, type GridFilter } from '../../shared/card-grid';
import { EventArt } from '../../shared/event-art';
import { EventSheet } from '../../shared/event-sheet';
import { localDate } from '../calendar/calendar-groups';

const DAY_TIME = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
/** "Thu 3 Sep 2026, 16:00" */
const dayTime = (ms: number) => DAY_TIME.format(ms).replace(',', '');

/**
 * A gaming event: its logo, name, start and end in your time, the games shown at it, and when
 * it was listed. Events from IGDB are added to your calendar (or removed) here; ones you made
 * yourself are edited here.
 */
@Component({
  selector: 'app-event',
  imports: [
    RouterLink,
    CardGrid,
    EventArt,
    LucideCalendarCheck,
    LucideChevronRight,
    LucideExternalLink,
    LucidePencil,
    LucidePlus,
  ],
  template: `
    @if (view(); as e) {
      <article>
        <!-- IGDB's logo is wide; an event of your own gets its host's icon. -->
        @if (e.logoId) {
          <app-event-art
            class="aspect-video rounded-[10px]"
            [logoId]="e.logoId"
            [kind]="e.kind"
            size="screenshot_big"
            [eager]="true"
          />
        } @else {
          <app-event-art class="size-20 rounded-[14px]" [kind]="e.kind" [iconSize]="80" />
        }

        <h1 class="mt-4 text-[24px] leading-[29px] font-bold tracking-[0.005em] text-balance">
          {{ e.title }}
        </h1>
        <p class="num mt-1 text-[15px] leading-5 text-muted">
          {{ e.starts }}
          @if (e.state) {
            <span [class.text-accent]="!e.over"> · {{ e.state }}</span>
          }
        </p>
        @if (stored()) {
          <p class="mt-2 flex items-center gap-1.5 text-[15px] leading-5 text-muted">
            <svg lucideCalendarCheck [size]="15" [strokeWidth]="2" class="shrink-0"></svg>
            {{ e.over ? 'In your Library' : 'In your Calendar' }}
          </p>
        } @else if (details.data()) {
          <button type="button" class="button-primary mt-5" (click)="add()">
            <svg lucidePlus [size]="20" [strokeWidth]="2.5"></svg>
            {{ e.over ? 'Add to Library' : 'Add to Calendar' }}
          </button>
        }

        <div class="grouped mt-6">
          <!-- Who holds it (read from its name), opening the company's page. -->
          @if (e.company; as company) {
            <a [routerLink]="['/company', company.id]" class="row">
              <span class="shrink-0">Company</span>
              <span class="row-value min-w-0 truncate">{{ company.name }}</span>
              <svg
                lucideChevronRight
                [size]="18"
                [strokeWidth]="2.25"
                class="-mr-1 shrink-0 text-faint"
              ></svg>
            </a>
          }
          <div class="row">
            <span class="flex-1">Starts</span>
            <span class="row-value num">{{ e.starts }}</span>
          </div>
          @if (e.ends) {
            <div class="row">
              <span class="flex-1">Ends</span>
              <span class="row-value num">{{ e.ends }}</span>
            </div>
          }
          @if (e.listed) {
            <div class="row">
              <span class="flex-1">{{ e.listedLabel }}</span>
              <span class="row-value num">{{ e.listed }}</span>
            </div>
          }
        </div>
        <p class="group-footer">Times are in your time zone.</p>

        @if (e.description) {
          <!-- Folded: the first paragraph, up to four lines. -->
          <p
            class="mt-5 text-[15px] leading-5 whitespace-pre-line text-muted"
            [class.line-clamp-4]="!wholeText()"
          >
            {{ wholeText() ? e.description : e.intro }}
          </p>
          @if (!wholeText() && (e.intro !== e.description || e.description.length > 220)) {
            <button
              type="button"
              class="mt-1 text-[15px] leading-5 text-accent active:opacity-60"
              (click)="wholeText.set(true)"
            >
              More
            </button>
          }
        }

        @if (e.links.length) {
          <div class="grouped mt-6">
            @for (link of e.links; track link.url) {
              <a [href]="link.url" target="_blank" rel="noopener" class="row text-accent">
                <span class="flex-1">{{ link.label }}</span>
                <svg
                  lucideExternalLink
                  [size]="16"
                  [strokeWidth]="2"
                  class="shrink-0 text-faint"
                ></svg>
              </a>
            }
          </div>
        }

        @if (games().length) {
          <section aria-label="Games shown">
            <app-card-grid
              title="Games shown"
              [cards]="games()"
              [filters]="gameFilters"
              [initial]="15"
              [resetKey]="id()"
            />
          </section>
        }

        @if (stored(); as mine) {
          <div class="grouped mt-8">
            @if (!mine.igdbId) {
              <button type="button" class="row text-accent" (click)="edit()">
                <svg lucidePencil [size]="18" [strokeWidth]="2" class="shrink-0"></svg>
                Edit event
              </button>
            } @else {
              <button type="button" class="row justify-center text-danger" (click)="remove()">
                {{ e.over ? 'Remove from Library' : 'Remove from Calendar' }}
              </button>
            }
          </div>
        }
      </article>
    } @else if (details.isError()) {
      <p class="grouped mt-6 px-4 py-3 text-[15px] leading-5 text-danger" role="alert">
        Couldn’t load this event. Check your connection and try again.
      </p>
    } @else if (details.isPending() && igdbId() !== null) {
      <div class="aspect-video animate-pulse rounded-[10px] bg-group"></div>
      <div class="mt-4 h-7 w-56 animate-pulse rounded-md bg-raised"></div>
    } @else {
      <p class="mt-16 text-center text-[15px] leading-5 text-muted">
        This event isn’t in your calendar any more.
      </p>
    }
  `,
})
export class EventPage {
  /** Route parameter: "igdb-1170" for an IGDB event, or the id of one you made. */
  readonly id = input.required<string>();

  private readonly igdb = inject(IgdbService);
  private readonly events = inject(EventsService);
  private readonly library = inject(LibraryService);
  private readonly sheet = inject(EventSheet);

  protected readonly igdbId = computed(() => igdbIdOf(this.id()));
  /** Your copy, if the event is in your calendar. */
  protected readonly stored = computed(() => this.events.byId().get(this.id()) ?? null);

  protected readonly details = injectQuery(() => ({
    queryKey: ['igdb-event', this.igdbId()],
    queryFn: () => this.igdb.event(this.igdbId()!),
    enabled: this.igdbId() !== null,
    staleTime: 60 * 60_000,
  }));

  protected readonly wholeText = signal(false);

  /** What the page shows: IGDB's latest when there is one, otherwise your copy. */
  protected readonly view = computed(() => {
    const d = this.details.data();
    const mine = this.stored();
    const event = (d ? igdbEventFields(d) : null) ?? mine;
    if (!event) return null;

    const now = Date.now();
    const end = eventEnd(event);
    const over = end <= now;
    const days = daysBetween(today(), localDate(event.startsAt));
    const state = over
      ? 'Over'
      : event.startsAt <= now
        ? 'On now'
        : days <= 0
          ? 'Today'
          : days === 1
            ? 'Tomorrow'
            : `in ${days} days`;

    const official = d?.event_networks?.find((n) => n.network_type?.name === 'Official website');
    const links = [
      d?.live_stream_url
        ? { label: over ? 'Watch it again' : 'Watch live', url: d.live_stream_url }
        : null,
      official ? { label: 'Official website', url: official.url } : null,
      !d && event.link ? { label: 'Open link', url: event.link } : null,
    ].filter((l): l is { label: string; url: string } => !!l && l.url.startsWith('https://'));

    return {
      title: event.title,
      kind: event.kind,
      company: eventCompany(event),
      logoId: event.logoId ?? null,
      starts: dayTime(event.startsAt),
      ends: event.durationMinutes ? dayTime(end) : null,
      over,
      state,
      description: d?.description?.trim() ?? '',
      intro: d?.description?.trim().split(/\n/)[0] ?? '',
      links,
      listedLabel: d ? 'Listed on IGDB' : 'Added',
      listed: d?.created_at
        ? SHORT_DATE.format(d.created_at * 1000)
        : !d && mine
          ? SHORT_DATE.format(mine.createdAt)
          : null,
    };
  });

  /**
   * The games shown at it as cards, yours first, then the rest, each A–Z: the year under each and
   * your status, to filter by upcoming, out, or in your library.
   */
  protected readonly games = computed((): GridCard[] => {
    const mine = this.library.byId();
    const now = Date.now() / 1000;
    return [...(this.details.data()?.games ?? [])]
      .sort(
        (a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.name.localeCompare(b.name),
      )
      .map((g) => {
        const tracked = mine.get(g.id);
        const out = !!g.first_release_date && g.first_release_date <= now;
        return {
          id: g.id,
          link: ['/game', g.id],
          name: g.name,
          coverId: g.cover?.image_id,
          line: yearOf(g.first_release_date),
          tags: [out ? 'out' : 'upcoming', ...(tracked ? ['mine'] : [])],
          ...gameMarks(tracked),
        };
      });
  });
  protected readonly gameFilters: GridFilter[] = [
    { key: 'upcoming', title: 'Upcoming' },
    { key: 'out', title: 'Out' },
    { key: 'mine', title: 'In my library' },
  ];

  constructor() {
    // The top bar shows the event's name once you scroll past it.
    const pageTitle = inject(PageTitle);
    effect(() => pageTitle.override.set(this.view()?.title ?? null));
    inject(DestroyRef).onDestroy(() => pageTitle.override.set(null));

    // An event of your own that's deleted (in its sheet) has no page left: go back.
    let had = false;
    effect(() => {
      if (this.stored()) had = true;
      else if (had && this.igdbId() === null) {
        had = false;
        history.back();
      }
    });

    // Keep your copy current (a time that moved, a new logo).
    effect(() => {
      const mine = this.stored();
      const d = this.details.data();
      if (mine?.igdbId && d) this.events.refreshFromIgdb(mine, d);
    });
  }

  /** Your status for a game ("Wishlist", "Completed"), or the year it came out. */
  protected add(): void {
    const d = this.details.data();
    if (d) this.events.addFromIgdb(d);
  }

  protected remove(): void {
    const mine = this.stored();
    if (mine && confirm(`Remove ${mine.title}?`)) this.events.remove(mine);
  }

  /** Opens the sheet for an event of your own. */
  protected edit(): void {
    const mine = this.stored();
    if (mine) void this.sheet.edit(mine);
  }
}
