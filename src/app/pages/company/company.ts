import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  LucideActivity,
  LucideBuilding2,
  LucideCalendar,
  LucideExternalLink,
  LucideMapPin,
  LucideUsers,
} from '@lucide/angular';
import { describeRelease } from '../../../../api/_lib/release.js';
import { countryName } from '../../core/countries';
import {
  COMPANY_ROLES,
  companyGames,
  logoUrl,
  IgdbService,
  type CompanyDetails,
} from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { PageTitle } from '../../core/page-title';
import {
  CardGrid,
  gameMarks,
  yearOf,
  type GridCard,
  type GridFilter,
} from '../../shared/card-grid';

/** IGDB website types, with friendlier names; others keep IGDB's. */
const SITE_LABELS: Record<string, string> = {
  'Official Website': 'Official website',
  Twitter: 'X (Twitter)',
  Youtube: 'YouTube',
};

/** "1 Nov 1986", "Nov 1986", "1986"; IGDB's start_date_format works like a release date's. */
export function foundedLabel(company: Pick<CompanyDetails, 'start_date' | 'start_date_format'>) {
  if (!company.start_date) return null;
  const { label } = describeRelease({
    platform: 0,
    date: company.start_date,
    format: company.start_date_format ?? 0,
    region: null,
    human: null,
  });
  return label === 'TBA' ? null : label;
}

/** "active" → "Active". */
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Fact = { icon: 'country' | 'founded' | 'size' | 'status'; label: string };

/**
 * A developer or publisher: its logo, name, details from IGDB in two short lines (country,
 * founded, size, status, parent company), description, every game it's credited with as a grid
 * of covers you can filter (developed, published, ported, supported, DLC, episodes, seasons,
 * cancelled), and its links.
 */
@Component({
  selector: 'app-company',
  imports: [
    RouterLink,
    CardGrid,
    LucideActivity,
    LucideBuilding2,
    LucideCalendar,
    LucideExternalLink,
    LucideMapPin,
    LucideUsers,
  ],
  template: `
    @if (details.data(); as c) {
      <article>
        <!-- Logos are mostly dark on a see-through background, so they sit on a white tile. The
             image fills a fixed box and scales inside it (iPhone Safari ignores max-height
             in a grid cell, which let tall logos spill out). -->
        @if (c.logo) {
          <div class="h-24 w-40 overflow-hidden rounded-[14px] bg-white p-3">
            <img [src]="logoUrl(c.logo.image_id)" alt="" class="block size-full object-contain" />
          </div>
        } @else {
          <div class="grid size-20 place-items-center rounded-[14px] bg-group text-muted">
            <svg lucideBuilding2 [size]="36" [strokeWidth]="1.75"></svg>
          </div>
        }

        <h1 class="mt-4 text-[24px] leading-7.25 font-bold tracking-[0.005em] text-balance">
          {{ c.name }}
        </h1>

        <!-- Its details at a glance, as a game's "my data": an icon and a few words each. -->
        @if (facts().length || c.parent) {
          <ul
            class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[15px] leading-5 text-muted"
            aria-label="Details"
          >
            @for (fact of facts(); track fact.icon) {
              <li class="num flex items-center gap-1.5">
                @switch (fact.icon) {
                  @case ('country') {
                    <svg lucideMapPin [size]="15" [strokeWidth]="2" class="shrink-0"></svg>
                  }
                  @case ('founded') {
                    <svg lucideCalendar [size]="15" [strokeWidth]="2" class="shrink-0"></svg>
                  }
                  @case ('size') {
                    <svg lucideUsers [size]="15" [strokeWidth]="2" class="shrink-0"></svg>
                  }
                  @case ('status') {
                    <svg lucideActivity [size]="15" [strokeWidth]="2" class="shrink-0"></svg>
                  }
                }
                {{ fact.label }}
              </li>
            }
            @if (c.parent; as parent) {
              <li class="flex min-w-0 items-center gap-1.5">
                <svg lucideBuilding2 [size]="15" [strokeWidth]="2" class="shrink-0"></svg>
                <span class="min-w-0 truncate">
                  Part of
                  <a
                    [routerLink]="['/company', parent.id]"
                    class="underline decoration-muted/40 underline-offset-[3px] active:opacity-60"
                    >{{ parent.name }}</a
                  >
                </span>
              </li>
            }
          </ul>
        }

        @if (c.description) {
          <p
            class="mt-4 text-[15px] leading-5 whitespace-pre-line text-muted"
            [class.line-clamp-4]="!wholeText()"
          >
            {{ c.description }}
          </p>
          @if (!wholeText() && c.description.length > 220) {
            <button
              type="button"
              class="mt-1 text-[15px] leading-5 text-accent active:opacity-60"
              (click)="wholeText.set(true)"
            >
              More
            </button>
          }
        }

        @if (cards().length) {
          <section aria-label="Games">
            <app-card-grid
              [cards]="cards()"
              [filters]="filters"
              allLabel="All games"
              [initial]="25"
              [resetKey]="companyId()"
            />
          </section>
        }

        @if (links().length) {
          <section aria-label="Links">
            <h2 class="group-header">Links</h2>
            <div class="grouped">
              @for (link of links(); track link.url) {
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
          </section>
        }
      </article>
    } @else if (details.isError()) {
      <p class="grouped mt-6 px-4 py-3 text-[15px] leading-5 text-danger" role="alert">
        Couldn’t load this company. Check your connection and try again.
      </p>
    } @else if (details.isPending()) {
      <div class="h-24 w-40 animate-pulse rounded-[14px] bg-group"></div>
      <div class="mt-4 h-7 w-56 animate-pulse rounded-md bg-raised"></div>
    } @else {
      <p class="mt-16 text-center text-[15px] leading-5 text-muted">
        IGDB doesn’t have this company.
      </p>
    }
  `,
})
export class CompanyPage {
  /** Route parameter: the IGDB company ID. */
  readonly id = input.required<string>();

  private readonly igdb = inject(IgdbService);
  private readonly library = inject(LibraryService);

  protected readonly companyId = computed(() => Number(this.id()));
  protected readonly details = injectQuery(() => ({
    queryKey: ['igdb-company', this.companyId()],
    queryFn: () => this.igdb.company(this.companyId()),
    enabled: Number.isInteger(this.companyId()),
    staleTime: 24 * 60 * 60_000,
  }));
  /** The games it ported or supported (a second request; they join the grid when it's in). */
  private readonly credits = injectQuery(() => ({
    queryKey: ['igdb-company-credits', this.companyId()],
    queryFn: () => this.igdb.companyCredits(this.companyId()),
    enabled: Number.isInteger(this.companyId()),
    staleTime: 24 * 60 * 60_000,
  }));

  protected readonly logoUrl = logoUrl;
  protected readonly wholeText = signal(false);
  /** Developed, Published, Ported… as the grid's filters. */
  protected readonly filters: GridFilter[] = COMPANY_ROLES.map((r) => ({ ...r }));

  /** Country, founded, size and status, as IGDB has them. */
  protected readonly facts = computed((): Fact[] => {
    const c = this.details.data();
    if (!c) return [];
    const founded = foundedLabel(c);
    const facts: [Fact['icon'], string | null][] = [
      ['country', countryName(c.country)],
      ['founded', founded ? `Founded ${founded}` : null],
      ['size', c.company_size?.name ?? null],
      ['status', c.status?.name ? capitalized(c.status.name) : null],
    ];
    return facts.filter(([, label]) => !!label).map(([icon, label]) => ({ icon, label: label! }));
  });

  /** Every game it's credited with: newest first, upcoming on top, cancelled last. */
  protected readonly games = computed(() => {
    const c = this.details.data();
    return c ? companyGames(c, this.credits.data() ?? []) : [];
  });

  /** As cards: the year (or Cancelled, greyed out) under each, and your status. */
  protected readonly cards = computed((): GridCard[] =>
    this.games().map((e) => ({
      id: e.game.id,
      link: ['/game', e.game.id],
      name: e.game.name,
      coverId: e.game.cover?.image_id,
      line: e.cancelled ? 'Cancelled' : yearOf(e.game.first_release_date),
      dim: e.cancelled,
      tags: e.roles,
      ...gameMarks(this.library.byId().get(e.game.id)),
    })),
  );

  /** Its websites (https only), then its page on IGDB. */
  protected readonly links = computed(() => {
    const c = this.details.data();
    if (!c) return [];
    const sites = (c.websites ?? [])
      .map((w) => ({
        label: SITE_LABELS[w.type?.type ?? ''] ?? w.type?.type ?? 'Website',
        url: w.url.replace(/^http:\/\//, 'https://'),
      }))
      // The official website first.
      .sort(
        (a, b) => Number(b.label === 'Official website') - Number(a.label === 'Official website'),
      );
    const igdb = c.url ? [{ label: 'IGDB page', url: c.url }] : [];
    return [...sites, ...igdb].filter((l) => l.url.startsWith('https://'));
  });

  constructor() {
    // The top bar shows the company's name once you scroll.
    const pageTitle = inject(PageTitle);
    effect(() => pageTitle.override.set(this.details.data()?.name ?? null));
    inject(DestroyRef).onDestroy(() => pageTitle.override.set(null));

    // Going from one company to its parent reuses this screen: start it fresh.
    effect(() => {
      this.companyId();
      this.wholeText.set(false);
    });
  }
}
