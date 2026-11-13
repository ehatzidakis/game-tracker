import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { LucideBuilding2, LucideChevronRight, LucideExternalLink } from '@lucide/angular';
import { isDlc, statusLabel } from '../../../../api/_lib/models.js';
import { describeRelease } from '../../../../api/_lib/release.js';
import { countryName } from '../../core/countries';
import {
  companySections,
  logoUrl,
  IgdbService,
  type CompanyDetails,
  type CompanyGame,
} from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { PageTitle } from '../../core/page-title';
import { Cover } from '../../shared/cover';

/** How many games each list shows before "Show all". */
const SHOWN_GAMES = 8;

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

/**
 * A developer or publisher: its logo, name, details from IGDB (country, founded, size, status,
 * parent company), description, links, the games it developed and published, and, folded, the
 * ones it ported or supported, its DLC and expansions, episodes, seasons and cancelled games.
 */
@Component({
  selector: 'app-company',
  imports: [RouterLink, Cover, LucideBuilding2, LucideChevronRight, LucideExternalLink],
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

        <h1 class="mt-4 text-[24px] leading-[29px] font-bold tracking-[0.005em] text-balance">
          {{ c.name }}
        </h1>
        @if (summary(); as line) {
          <p class="num mt-1 text-[15px] leading-5 text-muted">{{ line }}</p>
        }

        @if (facts().length || c.parent) {
          <div class="grouped mt-6">
            @for (fact of facts(); track fact.label) {
              <div class="row">
                <span class="flex-1">{{ fact.label }}</span>
                <span class="row-value num">{{ fact.value }}</span>
              </div>
            }
            @if (c.parent; as parent) {
              <a [routerLink]="['/company', parent.id]" class="row">
                <span class="shrink-0">Part of</span>
                <span class="row-value min-w-0 truncate">{{ parent.name }}</span>
                <svg
                  lucideChevronRight
                  [size]="18"
                  [strokeWidth]="2.25"
                  class="-mr-1 shrink-0 text-faint"
                ></svg>
              </a>
            }
          </div>
        }

        @if (c.description) {
          <p
            class="mt-5 text-[15px] leading-5 whitespace-pre-line text-muted"
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

        @for (list of lists(); track list.key) {
          <section [attr.aria-label]="list.title">
            @if (list.folded) {
              <!-- Folded until you tap the heading, like the series on a game's page. -->
              <h2 class="group-header">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 text-left uppercase active:opacity-60"
                  [attr.aria-expanded]="list.open"
                  (click)="toggle(list.key)"
                >
                  {{ list.title }} · {{ list.games.length }}
                  <!-- Rotates the wrapper: the icon component manages its own classes. -->
                  <span
                    class="shrink-0 transition-transform duration-200"
                    [class.rotate-90]="list.open"
                    aria-hidden="true"
                  >
                    <svg lucideChevronRight [size]="16" [strokeWidth]="2.5" class="block"></svg>
                  </span>
                </button>
              </h2>
            } @else {
              <h2 class="group-header">{{ list.title }} · {{ list.games.length }}</h2>
            }
            @if (list.open) {
              <ul class="grouped" style="--sep-inset: 68px">
                @for (g of list.shown; track g.id) {
                  <li class="row p-0!">
                    <a [routerLink]="['/game', g.id]" class="row py-2!">
                      <app-cover
                        class="w-10 shrink-0 rounded-[5px]!"
                        [coverId]="g.cover?.image_id"
                        [name]="''"
                      />
                      <div class="min-w-0 flex-1">
                        <p class="truncate">{{ g.name }}</p>
                        <p class="num text-[15px] leading-5 text-muted">{{ gameState(g) }}</p>
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
              @if (list.games.length > list.shown.length) {
                <button
                  type="button"
                  class="group-footer text-accent! active:opacity-60"
                  (click)="showAll(list.key)"
                >
                  Show all {{ list.games.length }}
                </button>
              }
            }
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

  private readonly companyId = computed(() => Number(this.id()));
  protected readonly details = injectQuery(() => ({
    queryKey: ['igdb-company', this.companyId()],
    queryFn: () => this.igdb.company(this.companyId()),
    enabled: Number.isInteger(this.companyId()),
    staleTime: 24 * 60 * 60_000,
  }));
  /** The games it ported or supported (a second request; those lists appear when it's in). */
  private readonly credits = injectQuery(() => ({
    queryKey: ['igdb-company-credits', this.companyId()],
    queryFn: () => this.igdb.companyCredits(this.companyId()),
    enabled: Number.isInteger(this.companyId()),
    staleTime: 24 * 60 * 60_000,
  }));

  protected readonly logoUrl = logoUrl;
  protected readonly wholeText = signal(false);
  private readonly allOf = signal<ReadonlySet<string>>(new Set());
  /** The folded lists you've opened on this page. */
  private readonly opened = signal<ReadonlySet<string>>(new Set());

  /** "Japan · Founded 1 Nov 1986" under the name. */
  protected readonly summary = computed(() => {
    const c = this.details.data();
    if (!c) return null;
    const founded = foundedLabel(c);
    return [countryName(c.country), founded ? `Founded ${founded}` : null]
      .filter(Boolean)
      .join(' · ');
  });

  /** Country, founded, size and status, as IGDB has them. */
  protected readonly facts = computed(() => {
    const c = this.details.data();
    if (!c) return [];
    return [
      { label: 'Country', value: countryName(c.country) },
      { label: 'Founded', value: foundedLabel(c) },
      { label: 'Size', value: c.company_size?.name ?? null },
      { label: 'Status', value: c.status?.name ? capitalized(c.status.name) : null },
    ].filter((f): f is { label: string; value: string } => !!f.value);
  });

  /**
   * Developed and Published, open, then the folded lists. Each newest first, the first few
   * unless you ask for all.
   */
  protected readonly lists = computed(() => {
    const c = this.details.data();
    if (!c) return [];
    return companySections(c, this.credits.data() ?? []).map((list) => ({
      ...list,
      open: !list.folded || this.opened().has(list.key),
      shown: this.allOf().has(list.key) ? list.games : list.games.slice(0, SHOWN_GAMES),
    }));
  });

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
      this.allOf.set(new Set());
      this.opened.set(new Set());
    });
  }

  protected toggle(key: string): void {
    this.opened.update((keys) => {
      const next = new Set(keys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected showAll(key: string): void {
    this.allOf.update((keys) => new Set(keys).add(key));
  }

  /** Your status for a game ("Wishlist", "Completed"), or the year it came out. */
  protected gameState(game: CompanyGame): string {
    const t = this.library.byId().get(game.id);
    if (t) return isDlc(t) && t.status !== 'wishlist' ? 'Owned' : statusLabel(t.status);
    if (!game.first_release_date) return 'TBA';
    const ms = game.first_release_date * 1000;
    return String(new Date(ms).getUTCFullYear());
  }
}
