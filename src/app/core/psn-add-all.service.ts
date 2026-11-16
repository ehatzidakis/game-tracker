import { computed, inject, Injectable, signal } from '@angular/core';
import type { PsnGameRecord } from '../../../api/_lib/models.js';
import { defaultChoice } from '../../../api/_lib/psn-import.js';
import { ChoiceSheet } from '../shared/choice-sheet';
import { LibraryService } from './library.service';
import { PsnService } from './psn.service';
import { ToastService } from './toast.service';

const ADD = 'add';

/** "1 game", "12 games". */
function games(n: number): string {
  return n === 1 ? '1 game' : `${n} games`;
}

/**
 * What "Add all" says before adding: where they go, that the Backlog ones can be moved, and that
 * games IGDB didn't find stay behind.
 */
export function addAllMessage(completed: number, backlog: number, notFound: number): string {
  const where = [
    completed
      ? `${completed === 1 ? '1 with a Platinum goes' : `${completed} with a Platinum go`} to Completed`
      : '',
    backlog
      ? `${completed ? `the other ${backlog}` : games(backlog)} ${backlog === 1 ? 'goes' : 'go'} to the Backlog`
      : '',
  ]
    .filter(Boolean)
    .join(', ');
  return [
    `${where[0].toUpperCase()}${where.slice(1)}.`,
    backlog ? 'You can move any of them to Completed or Shelved from there.' : '',
    notFound
      ? `${games(notFound)} not found on IGDB ${notFound === 1 ? 'stays' : 'stay'} here, to add one by one.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * "Add all" (Settings → PlayStation, and its Games page): every PlayStation game that isn't in the
 * library and was found on IGDB goes in at once: Platinum earned → Completed, the rest →
 * Backlog. It says so first, and that they can be moved afterwards.
 */
@Injectable({ providedIn: 'root' })
export class PsnAddAll {
  private readonly psn = inject(PsnService);
  private readonly library = inject(LibraryService);
  private readonly sheet = inject(ChoiceSheet);
  private readonly toast = inject(ToastService);

  /** Adding them (and syncing): a few seconds. */
  readonly busy = signal(false);

  /** The games it would add: found on IGDB, that game not in the library yet, each IGDB game once. */
  readonly addable = computed((): PsnGameRecord[] => {
    const inLibrary = this.library.byId();
    const seen = new Set<number>();
    return this.psn
      .unmatched()
      .filter(
        (g) =>
          !!g.igdb && !inLibrary.has(g.igdb.id) && !seen.has(g.igdb.id) && !!seen.add(g.igdb.id),
      );
  });

  /** Asks first (what goes where), then adds them all. */
  async addAll(): Promise<void> {
    const adding = this.addable();
    if (!adding.length || this.busy()) return;
    const completed = adding.filter((g) => defaultChoice(g).status === 'completed').length;
    const notFound = this.psn.unmatched().filter((g) => g.igdb === null).length;
    const choice = await this.sheet.choose(
      ['Add ', games(adding.length), ' to your Library?'],
      [{ key: ADD, label: `Add ${games(adding.length)}` }],
      null,
      addAllMessage(completed, adding.length - completed, notFound),
    );
    if (choice !== ADD) return;

    this.busy.set(true);
    try {
      const { added, synced } = await this.psn.importGames(
        adding.map((g) => ({ conceptId: g.conceptId, igdbId: g.igdb!.id, ...defaultChoice(g) })),
      );
      this.toast.show(
        `Added ${games(added)} to your Library` +
          (synced ? '' : '. Playtime arrives with the next sync'),
      );
    } catch (error) {
      this.toast.error((error as Error).message, error);
    } finally {
      this.busy.set(false);
    }
  }
}
