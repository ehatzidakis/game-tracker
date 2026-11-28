import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideCheck, LucideChevronDown, LucideChevronRight, LucideTrophy } from '@lucide/angular';
import type { TrackedGame, TrophyCounts } from '../../../../api/_lib/models.js';
import { BrowseService } from '../../core/browse';
import { LibraryService } from '../../core/library.service';
import { formatPlaytime } from '../../core/playtime';
import { Cover } from '../../shared/cover';

/** The games marked Playing, the most recently played first (by PlayStation), then A–Z. */
export function playingGames(games: readonly TrackedGame[]): TrackedGame[] {
  return games
    .filter((g) => g.playing && g.status === 'backlog')
    .sort(
      (a, b) =>
        (b.playstation?.lastPlayedAt ?? 0) - (a.playstation?.lastPlayedAt ?? 0) ||
        a.name.localeCompare(b.name),
    );
}

/** The one the area shows: the one you picked while it's still Playing, else the first. */
export function shownGame(
  playing: readonly TrackedGame[],
  pickedId: number | null | undefined,
): TrackedGame | null {
  return playing.find((g) => g.igdbId === pickedId) ?? playing[0] ?? null;
}

/** "38/51" and "74%" from PlayStation, or null without a trophy list. */
export function trophySummary(
  game: TrackedGame,
): { earned: number; of: number; progress: number } | null {
  const t = game.playstation?.trophies;
  if (!t) return null;
  const sum = (c: TrophyCounts) => c.bronze + c.silver + c.gold + c.platinum;
  return { earned: sum(t.earned), of: sum(t.defined), progress: t.progress };
}

/** PlayStation's playtime ("34h 21m"), empty without one. */
export function psnPlaytime(game: TrackedGame): string {
  return formatPlaytime((game.playstation?.playSeconds ?? 0) / 3600);
}

/**
 * The top of the Calendar: the game you're playing, as a small cover with its name, PlayStation
 * playtime and trophies. With more than one Playing game, tapping it opens all of them to pick the
 * one it shows (kept in your settings). Opened is never remembered: picking, tapping or scrolling
 * anywhere else, or leaving the tab, closes it again. Settings → Now playing turns it off.
 */
@Component({
  selector: 'app-now-playing',
  imports: [Cover, NgTemplateOutlet, RouterLink, LucideCheck, LucideChevronDown, LucideChevronRight, LucideTrophy],
  host: { class: 'block' },
  template: `
    @if (shown(); as game) {
      <section class="grouped" aria-labelledby="now-playing-title">
        @if (games().length > 1) {
          <button
            type="button"
            class="row w-full text-left"
            [attr.aria-expanded]="open()"
            (click)="open.set(!open())"
          >
            @if (open()) {
              <span class="min-w-0 flex-1">
                <span id="now-playing-title" class="now-playing-label">Now playing</span>
                <span class="block text-[15px] leading-5 text-muted">
                  Pick the game to show here
                </span>
              </span>
            } @else {
              <ng-container [ngTemplateOutlet]="summary" [ngTemplateOutletContext]="{ $implicit: game, label: true }" />
            }
            <span
              class="shrink-0 text-muted transition-transform duration-200"
              [class.rotate-180]="open()"
              aria-hidden="true"
            >
              <svg lucideChevronDown [size]="18" [strokeWidth]="2.5" class="block"></svg>
            </span>
          </button>
          @if (open()) {
            <ul role="radiogroup" aria-labelledby="now-playing-title">
              @for (g of games(); track g.igdbId) {
                @let picked = g.igdbId === game.igdbId;
                <li class="row gap-0! py-0! pr-2! pl-0!">
                  <button
                    type="button"
                    role="radio"
                    class="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.75 pl-4 text-left"
                    [attr.aria-checked]="picked"
                    (click)="pick(g)"
                  >
                    <span
                      class="grid size-5.5 shrink-0 place-items-center rounded-full"
                      [class]="picked ? 'bg-accent-fill text-white' : 'ring-[1.5px] ring-faint ring-inset'"
                      aria-hidden="true"
                    >
                      @if (picked) {
                        <svg lucideCheck [size]="14" [strokeWidth]="3"></svg>
                      }
                    </span>
                    <ng-container [ngTemplateOutlet]="summary" [ngTemplateOutletContext]="{ $implicit: g, label: false }" />
                  </button>
                  <a
                    [routerLink]="['/game', g.igdbId]"
                    class="grid size-11 shrink-0 place-items-center text-faint active:opacity-60"
                    [attr.aria-label]="'Open ' + g.name"
                    (click)="browseFrom(g.igdbId)"
                  >
                    <svg lucideChevronRight [size]="18" [strokeWidth]="2.25"></svg>
                  </a>
                </li>
              }
            </ul>
          }
        } @else {
          <!-- Only one: nothing to pick, so it opens the game. -->
          <a [routerLink]="['/game', game.igdbId]" class="row" (click)="browseFrom(game.igdbId)">
            <ng-container [ngTemplateOutlet]="summary" [ngTemplateOutletContext]="{ $implicit: game, label: true }" />
            <svg
              lucideChevronRight
              [size]="18"
              [strokeWidth]="2.25"
              class="-mr-1 shrink-0 text-faint"
            ></svg>
          </a>
        }
      </section>
    }

    <!-- One game: the cover, its name with PlayStation's playtime under it, the trophies right. -->
    <ng-template #summary let-g let-label="label">
      <app-cover class="w-12 shrink-0 rounded-[5px]" size="cover_small" [coverId]="g.coverId" [name]="g.name" />
      <span class="min-w-0 flex-1">
        @if (label) {
          <span id="now-playing-title" class="now-playing-label">Now playing</span>
        }
        <span class="block truncate text-[17px] leading-5.5 font-semibold">{{ g.name }}</span>
        @if (playtime(g); as time) {
          <span class="num block text-[13px] leading-4.5 text-muted">{{ time }} played</span>
        }
      </span>
      @if (trophies(g); as tr) {
        <span class="num shrink-0 text-right" [attr.aria-label]="tr.earned + ' of ' + tr.of + ' trophies, ' + tr.progress + '%'">
          <span class="flex items-center justify-end gap-1 text-[15px] leading-5 font-semibold" aria-hidden="true">
            <svg lucideTrophy [size]="14" [strokeWidth]="2.25" class="shrink-0"></svg>
            <span>{{ tr.earned }}<span class="text-[13px] font-normal text-muted">/{{ tr.of }}</span></span>
          </span>
          <span class="block text-[13px] leading-4.5 text-muted" aria-hidden="true">{{ tr.progress }}%</span>
        </span>
      }
    </ng-template>
  `,
  styles: `
    /* Hairlines between the games when open (and under the heading), from the cover's edge. */
    li::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      left: 50px;
      height: 0.5px;
      background: var(--color-sep);
    }
    .now-playing-label {
      display: block;
      font-size: 11px;
      line-height: 14px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-accent);
    }
  `,
})
export class NowPlaying {
  private readonly library = inject(LibraryService);
  private readonly browse = inject(BrowseService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly games = computed(() => playingGames(this.library.games()));

  /** Opening a game hands over the games you're playing, so its page swipes through them. */
  protected browseFrom(id: number): void {
    this.browse.start(
      this.games().map((g) => g.igdbId),
      id,
      this.router.url,
    );
  }
  protected readonly shown = computed(() =>
    shownGame(this.games(), this.library.settings().nowPlayingId),
  );
  /** Showing every Playing game to pick from. Never kept: anything else closes it. */
  protected readonly open = signal(false);
  protected readonly playtime = psnPlaytime;
  protected readonly trophies = trophySummary;

  constructor() {
    // While open, a tap anywhere else or a scroll closes it (the tab's own controls still work).
    const close = (event: Event) => {
      if (event.type === 'pointerdown' && this.host.nativeElement.contains(event.target as Node)) {
        return;
      }
      this.open.set(false);
    };
    let scroller: HTMLElement | null = null;
    effect((onCleanup) => {
      if (!this.open()) return;
      scroller = this.host.nativeElement.closest('main');
      document.addEventListener('pointerdown', close, true);
      scroller?.addEventListener('scroll', close, { passive: true });
      onCleanup(() => {
        document.removeEventListener('pointerdown', close, true);
        scroller?.removeEventListener('scroll', close);
      });
    });
  }

  protected pick(game: TrackedGame): void {
    if (game.igdbId !== this.library.settings().nowPlayingId) {
      this.library.saveSettings({ nowPlayingId: game.igdbId });
    }
    this.open.set(false);
  }
}
