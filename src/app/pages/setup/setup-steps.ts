// The first-time setup's rules (setup.ts): three steps over your PlayStation catalog, each
// showing only the games not marked in an earlier step. No Angular here, so it's easy to test.
import type { Completion, PsnGameRecord } from '../../../../api/_lib/models.js';
import type { ImportChoice, ImportStatus } from '../../../../api/_lib/psn-import.js';

export interface SetupStep {
  list: ImportStatus;
  /** The list's name, for the step counter and the summary. */
  title: string;
  question: string;
  hint: string;
}

export const SETUP_STEPS: readonly SetupStep[] = [
  {
    list: 'completed',
    title: 'Completed',
    question: 'Which have you finished?',
    hint: 'Games with their Platinum are already marked. Tap a cover to mark or unmark it.',
  },
  {
    list: 'shelved',
    title: 'Shelved',
    question: 'Which do you know you’ll never finish?',
    hint: 'They go to Shelved, out of your way.',
  },
  {
    list: 'backlog',
    title: 'Backlog',
    question: 'Which have you promised yourself you’ll finish?',
    hint: 'Games you don’t mark here are left out. You can add them later from Settings → PlayStation.',
  },
];

/** The game's PlayStation concept id → the list you put it in. */
export type SetupMarks = ReadonlyMap<number, ImportStatus>;

type SetupGame = Pick<PsnGameRecord, 'conceptId' | 'platinumEarned'> & {
  igdb?: PsnGameRecord['igdb'];
};

/** Where you start: games with their Platinum earned are marked Completed. */
export function initialMarks(games: readonly SetupGame[]): Map<number, ImportStatus> {
  return new Map(
    games.filter((g) => g.platinumEarned).map((g) => [g.conceptId, 'completed' as ImportStatus]),
  );
}

/** The games a step shows: those not marked in an earlier step. */
export function shownAt<T extends SetupGame>(
  step: number,
  games: readonly T[],
  marks: SetupMarks,
): T[] {
  const earlier = new Set(SETUP_STEPS.slice(0, step).map((s) => s.list));
  return games.filter((g) => {
    const mark = marks.get(g.conceptId);
    return !mark || !earlier.has(mark);
  });
}

/** Marks or unmarks a game for this step's list. */
export function toggled(
  marks: SetupMarks,
  conceptId: number,
  list: ImportStatus,
): Map<number, ImportStatus> {
  const next = new Map(marks);
  if (next.get(conceptId) === list) next.delete(conceptId);
  else next.set(conceptId, list);
  return next;
}

/** How many go in each list, and how many are left out. */
export function setupCounts(
  games: readonly SetupGame[],
  marks: SetupMarks,
): Record<ImportStatus, number> & { total: number; leftOut: number } {
  const counts = { completed: 0, shelved: 0, backlog: 0 };
  for (const g of games) {
    const mark = marks.get(g.conceptId);
    if (mark) counts[mark]++;
  }
  const total = counts.completed + counts.shelved + counts.backlog;
  return { ...counts, total, leftOut: games.length - total };
}

/**
 * What to add: each marked game as the IGDB game found for it. Completed is Platinum when you
 * earned it, else Main story (changeable on the game's page).
 */
export function setupChoices(games: readonly SetupGame[], marks: SetupMarks): ImportChoice[] {
  return games.flatMap((g) => {
    const status = marks.get(g.conceptId);
    if (!status || !g.igdb) return [];
    const completion: Completion | null =
      status === 'completed' ? (g.platinumEarned ? 'platinum' : 'main') : null;
    return [{ conceptId: g.conceptId, igdbId: g.igdb.id, status, completion }];
  });
}
