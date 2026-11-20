import { Component, computed, inject, signal } from '@angular/core';
import { LucideChevronRight, LucideListPlus, LucideTrophy } from '@lucide/angular';
import { statusLabel, type PsnGameRecord, type TrackedGame } from '../../../../api/_lib/models.js';
import { defaultChoice, type ImportStatus } from '../../../../api/_lib/psn-import.js';
import { comparableName } from '../../../../api/_lib/psn-match.js';
import { today } from '../../core/dates';
import { IgdbService, type GameSearchResult } from '../../core/igdb';
import { LibraryService } from '../../core/library.service';
import { formatPlaytime } from '../../core/playtime';
import { PsnAddAll } from '../../core/psn-add-all.service';
import { PsnService } from '../../core/psn.service';
import { ToastService } from '../../core/toast.service';
import { ChoiceSheet } from '../../shared/choice-sheet';
import { Cover } from '../../shared/cover';
import { DetailsSheet } from '../../shared/details-sheet';

const NONE = '__none';
const ADD = '__add';
const OTHER = '__other';
const SAME = '__same';

/** PlayStation's name as a search: without ™ and "PS4 & PS5". */
function searchName(name: string): string {
  return name
    .replace(/[™®©]/g, '')
    .replace(/\b(PS4|PS5)\s*(&|and)\s*(PS4|PS5)\b/gi, '')
    .trim();
}

/** "34h 21m", or "Under a minute" for a game barely started. */
function played(seconds: number): string {
  return formatPlaytime(seconds / 3600) || 'Under a minute';
}

/**
 * Settings → PlayStation games: every game on your PlayStation (demos and apps left out) and
 * which library game it is. Tap one that isn't in your library to add it; tap a matched one to
 * change its match.
 */
@Component({
  selector: 'app-playstation',
  imports: [Cover, LucideChevronRight, LucideListPlus, LucideTrophy],
  template: `
    <h1 class="large-title">PlayStation games</h1>
    <p class="mt-2 text-[15px] leading-5 text-muted">
      Playtime and trophies go to the library game each one is matched to. Tap a game that isn't in
      your library to add it, or a matched one to change its match.
    </p>
    @if (adding() || addAll.busy()) {
      <p class="mt-2 text-[15px] leading-5 text-muted" role="status">
        Adding and syncing with PlayStation…
      </p>
    } @else if (addAll.addable().length; as count) {
      <div class="grouped mt-4">
        <button type="button" class="row text-accent" (click)="addAll.addAll()">
          <svg lucideListPlus [size]="22" [strokeWidth]="1.75" class="shrink-0"></svg>
          Add all {{ count }} to Library
        </button>
      </div>
      <p class="group-footer">Platinumed games go to Completed, the rest to the Backlog.</p>
    }

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
                      class="absolute right-0.5 bottom-0.5 grid size-4 place-items-center rounded-full bg-black/75 ring-[0.5px] ring-white/20 badge-glass"
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

  protected readonly addAll = inject(PsnAddAll);
  private readonly details = inject(DetailsSheet);
  private readonly igdb = inject(IgdbService);
  private readonly toast = inject(ToastService);
  /** Adding a game (and syncing it): a few seconds. */
  protected readonly adding = signal(false);

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

  /**
   * A game not in your library: add it (as the IGDB game found for it, or another you pick), or
   * say which library game it is. A matched game: change its match.
   */
  protected async pick(game: PsnGameRecord): Promise<void> {
    if (this.adding() || this.addAll.busy()) return;
    if (game.igdbId !== null) return this.changeMatch(game);
    const found = game.igdb;
    const choice = await this.sheet.choose(
      ['', game.name, ''],
      [
        ...(found
          ? [
              {
                key: ADD,
                label: 'Add to Library',
                hint:
                  comparableName(found.name) !== comparableName(game.name)
                    ? `As ${found.name}`
                    : undefined,
              },
            ]
          : []),
        {
          key: OTHER,
          label: found ? 'Choose another game' : 'Find it on IGDB',
          hint: found ? 'If that isn’t the right game' : 'Not found by itself',
        },
        { key: SAME, label: 'It’s already in my Library…' },
      ],
    );
    if (choice === ADD && found) await this.add(game, found.id, found.name);
    if (choice === OTHER) await this.chooseOther(game);
    if (choice === SAME) await this.changeMatch(game);
  }

  /** Games on IGDB with its name (DLC left out); the one you pick is added. */
  private async chooseOther(game: PsnGameRecord): Promise<void> {
    let results: GameSearchResult[];
    try {
      results = (await this.igdb.search(searchName(game.name))).filter((r) => !r.dlcOf);
    } catch (error) {
      this.toast.error('Couldn’t search IGDB. Try again in a moment.', error);
      return;
    }
    if (!results.length) {
      this.toast.error(`Nothing on IGDB is called ${game.name}.`);
      return;
    }
    const picked = await this.sheet.choose(
      ['Which game is ', game.name, '?'],
      results.slice(0, 12).map((r) => ({
        key: String(r.id),
        label: r.name,
        hint: [r.year ?? 'TBA', ...r.platforms.slice(0, 3)].join(' · '),
      })),
    );
    const result = results.find((r) => String(r.id) === picked);
    if (result) await this.add(game, result.id, result.name);
  }

  /** Asks where it goes and your data on it (filled in by the rules), then adds it. */
  private async add(game: PsnGameRecord, igdbId: number, name: string): Promise<void> {
    if (this.library.byId().has(igdbId)) {
      this.toast.error(
        `${name} is already in your Library. Pick it with “It’s already in my Library…”.`,
      );
      return;
    }
    const initial = defaultChoice(game);
    const data = await this.details.addFromPsn(name, initial, today(), this.library.stores());
    if (!data) return;
    const status = (data.status ?? initial.status) as ImportStatus;
    this.adding.set(true);
    try {
      const { added, synced } = await this.psn.importGames([
        {
          conceptId: game.conceptId,
          igdbId,
          status,
          completion: status === 'completed' ? (data.completion ?? initial.completion) : null,
          rating: data.rating ?? null,
          pricePaid: data.pricePaid ?? null,
          boughtFrom: data.boughtFrom ?? null,
          orderedOn: data.orderedOn ?? null,
          physical: data.physical ?? false,
        },
      ]);
      if (!added) this.toast.error(`${name} is already in your Library.`);
      else if (synced) this.toast.show(`Added to ${statusLabel(status)}`);
      else this.toast.show(`Added to ${statusLabel(status)}. Playtime arrives with the next sync.`);
    } catch (error) {
      this.toast.error((error as Error).message, error);
    } finally {
      this.adding.set(false);
    }
  }

  /** Picks the library game: the most likely ones (sharing words with its name) first. */
  private async changeMatch(game: PsnGameRecord): Promise<void> {
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
