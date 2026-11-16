import { Component, computed, inject } from '@angular/core';
import { LucideChevronRight, LucideTrophy } from '@lucide/angular';
import { comparableName } from '../../../../api/_lib/psn-match.js';
import type { PsnGameRecord, TrackedGame } from '../../../../api/_lib/models.js';
import { formatPlaytime } from '../../core/playtime';
import { LibraryService } from '../../core/library.service';
import { PsnService } from '../../core/psn.service';
import { ChoiceSheet } from '../../shared/choice-sheet';
import { Cover } from '../../shared/cover';

const NONE = '__none';

/** "34h 21m", or "Under a minute" for a game barely started. */
function played(seconds: number): string {
  return formatPlaytime(seconds / 3600) || 'Under a minute';
}

/**
 * Settings → PlayStation games: every game on your PlayStation (demos and apps left out) and
 * which library game it is. Tap one to pick another, or to say it isn't in your library.
 */
@Component({
  selector: 'app-playstation',
  imports: [Cover, LucideChevronRight, LucideTrophy],
  template: `
    <h1 class="large-title">PlayStation games</h1>
    <p class="mt-2 text-[15px] leading-5 text-muted">
      Playtime and trophies go to the library game each one is matched to. Tap a game to change its
      match.
    </p>

    @for (group of groups(); track group.title) {
      <section [attr.aria-label]="group.title">
        <h2 class="group-header">{{ group.title }} · {{ group.games.length }}</h2>
        <ul class="grouped" style="--sep-inset: 68px">
          @for (g of group.games; track g.conceptId) {
            <li class="row p-0!">
              <button type="button" class="row py-2! text-left" (click)="pick(g)">
                <app-cover class="w-10 shrink-0 rounded-[5px]!" [coverId]="coverOf(g)" [name]="''">
                  @if (g.platinumEarned) {
                    <span
                      class="absolute right-0.5 bottom-0.5 grid size-4 place-items-center rounded-full bg-black/75 ring-[0.5px] ring-white/20 backdrop-blur-sm"
                    >
                      <svg lucideTrophy [size]="9" [strokeWidth]="2.5" aria-hidden="true"></svg>
                      <span class="sr-only">Platinum</span>
                    </span>
                  }
                </app-cover>
                <div class="min-w-0 flex-1">
                  <p class="truncate">{{ g.name }}</p>
                  <p class="num truncate text-[15px] leading-5 text-muted">
                    {{ played(g.playSeconds) }}
                    @if (g.platform) {
                      · {{ g.platform === 'ps5' ? 'PS5' : 'PS4' }}
                    }
                    @if (libraryName(g); as name) {
                      · {{ name }}
                    } @else if (g.igdb === null) {
                      · Not found on IGDB
                    }
                    @if (g.matchedBy === 'manual') {
                      · Set by you
                    }
                  </p>
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
      <p class="mt-16 text-center text-[15px] leading-5 text-muted">
        No PlayStation games yet. Connect your Online ID in Settings.
      </p>
    }
  `,
})
export class PlaystationPage {
  private readonly psn = inject(PsnService);
  private readonly library = inject(LibraryService);
  private readonly sheet = inject(ChoiceSheet);
  protected readonly played = played;

  /** Not in your library first (the ones to look at), then the matched ones. */
  protected readonly groups = computed(() =>
    [
      { title: 'Not in your library', games: this.psn.unmatched() },
      { title: 'Matched', games: this.psn.matched() },
    ].filter((group) => group.games.length),
  );

  protected libraryName(game: PsnGameRecord): string | null {
    return game.igdbId === null ? null : (this.library.byId().get(game.igdbId)?.name ?? null);
  }

  /** The library game's cover when it's matched, else the cover of the IGDB game it was found as. */
  protected coverOf(game: PsnGameRecord): string | null {
    const tracked = game.igdbId === null ? undefined : this.library.byId().get(game.igdbId);
    return tracked?.coverId ?? game.igdb?.coverId ?? null;
  }

  /** Picks the library game: the most likely ones (sharing words with its name) first. */
  protected async pick(game: PsnGameRecord): Promise<void> {
    const words = new Set(comparableName(game.name).split(' '));
    const shared = (g: TrackedGame) =>
      comparableName(g.name)
        .split(' ')
        .filter((w) => words.has(w)).length;
    const candidates = this.library
      .games()
      .filter((g) => g.parentId == null)
      .map((g) => ({ g, score: shared(g) }))
      .sort((a, b) => b.score - a.score || a.g.name.localeCompare(b.g.name));
    const choice = await this.sheet.choose(
      ['Which library game is ', game.name, '?'],
      [
        { key: NONE, label: 'None', hint: 'It isn’t in my library' },
        ...candidates.map(({ g }) => ({
          key: String(g.igdbId),
          label: g.name,
          hint: g.igdbId === game.igdbId ? 'Matched now' : undefined,
        })),
      ],
    );
    if (choice === null) return;
    const igdbId = choice === NONE ? null : Number(choice);
    if (igdbId !== game.igdbId || game.matchedBy !== 'manual') this.psn.setMatch(game, igdbId);
  }
}
