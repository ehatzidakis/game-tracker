// Adding PlayStation games to the library (api/psn-import.ts). No network or database here, so
// it's easy to test.
import { syncedFields, type IgdbSyncGame } from './igdb-sync.js';
import type { Completion, PsnGameRecord, Status, TrackedGame } from './models.js';

/** The lists a PlayStation game can go to: you've played it, so never the Wishlist. */
export const IMPORT_STATUSES = ['backlog', 'shelved', 'completed'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** What you chose for one PlayStation game when adding it. */
export interface ImportChoice {
  conceptId: number;
  /** The IGDB game it is: the one found for it, or another you picked. */
  igdbId: number;
  status: ImportStatus;
  /** For Completed. Default: Platinum if you earned it, else Main story. */
  completion?: Completion | null;
  rating?: number | null;
  pricePaid?: number | null;
  boughtFrom?: string | null;
  /** "YYYY-MM-DD" */
  orderedOn?: string | null;
  physical?: boolean;
}

/** The PlayStation game's own data the new library game takes. */
export type ImportRecord = Pick<
  PsnGameRecord,
  'platform' | 'firstPlayedAt' | 'lastPlayedAt' | 'platinumEarned'
>;

/** Where a game goes when added without asking: Platinum earned → Completed, else Backlog. */
export function defaultChoice(record: ImportRecord): {
  status: ImportStatus;
  completion: Completion | null;
} {
  return record.platinumEarned
    ? { status: 'completed', completion: 'platinum' }
    : { status: 'backlog', completion: null };
}

/**
 * The library game for a PlayStation game you add. Its dates come from PlayStation: bought (unless
 * you gave the day) and started the first day you played it; shelved or completed the last day
 * you played it. A Platinum you earned leaves the completed date empty: the sync that runs right
 * after fills in the day the Platinum was earned (quietly, see platinumMoves). Playtime and
 * trophies come with that sync too.
 */
export function importedGame(
  igdb: IgdbSyncGame,
  record: ImportRecord,
  choice: ImportChoice,
  now: number,
): TrackedGame {
  const myPlatform = record.platform ?? 'ps5';
  const status: Status = choice.status;
  const completed = status === 'completed';
  const completion: Completion | null = completed
    ? (choice.completion ?? defaultChoice(record).completion ?? 'main')
    : null;
  const datedByPlatinum = completion === 'platinum' && !!record.platinumEarned;
  const lastPlayed = record.lastPlayedAt ?? now;
  const ordered = choice.orderedOn ? Date.parse(`${choice.orderedOn}T12:00:00Z`) : NaN;
  return {
    igdbId: igdb.id,
    ...syncedFields(igdb, myPlatform, now),
    status,
    completion,
    myPlatform,
    hoursPlayed: null,
    rating: completed ? (choice.rating ?? null) : null,
    notes: '',
    notify: false,
    pricePaid: choice.pricePaid ?? null,
    boughtFrom: choice.boughtFrom ?? null,
    orderedOn: choice.orderedOn ?? null,
    physical: !!choice.physical,
    addedAt: now,
    purchasedAt: Number.isFinite(ordered) ? ordered : (record.firstPlayedAt ?? now),
    startedAt: record.firstPlayedAt ?? null,
    shelvedAt: status === 'shelved' ? lastPlayed : null,
    completedAt: completed && !datedByPlatinum ? lastPlayed : null,
    updatedAt: now,
  };
}
