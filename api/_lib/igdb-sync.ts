// The IGDB fields copied onto each library game. Used when adding a game (in the app) and by the
// daily job (on the server), so both store exactly the same thing.
import type { ReleaseChange, ReleaseDateInfo, TrackedGame } from './models.js';
import { platformIgdbId, type PlatformKey } from './platforms.js';
import { pickRelease, toReleaseDateInfo, type IgdbReleaseDate } from './release.js';

export const SYNC_FIELDS = [
  'name',
  'slug',
  'cover.image_id',
  'genres.name',
  'involved_companies.company.name',
  'involved_companies.developer',
  'platforms',
  'release_dates.platform',
  'release_dates.date',
  'release_dates.date_format',
  'release_dates.release_region',
  'release_dates.human',
].join(', ');

export interface IgdbSyncGame {
  id: number;
  name: string;
  slug?: string;
  cover?: { image_id: string };
  genres?: { name: string }[];
  involved_companies?: { company?: { name: string }; developer?: boolean }[];
  platforms?: (number | { id: number })[];
  release_dates?: IgdbReleaseDate[];
}

export type SyncedFields = Pick<
  TrackedGame,
  | 'name'
  | 'slug'
  | 'coverId'
  | 'genres'
  | 'developer'
  | 'platforms'
  | 'releaseDate'
  | 'releasePrecision'
  | 'releaseLabel'
  | 'igdbSyncedAt'
>;

export function releaseDatesOf(game: IgdbSyncGame): ReleaseDateInfo[] {
  return (game.release_dates ?? []).map(toReleaseDateInfo);
}

export function syncedFields(
  game: IgdbSyncGame,
  myPlatform: PlatformKey,
  now = Date.now(),
): SyncedFields {
  const release = pickRelease(releaseDatesOf(game), platformIgdbId(myPlatform));
  return {
    name: game.name,
    slug: game.slug ?? null,
    coverId: game.cover?.image_id ?? null,
    genres: (game.genres ?? []).map((g) => g.name).slice(0, 4),
    developer: game.involved_companies?.find((c) => c.developer)?.company?.name ?? null,
    platforms: (game.platforms ?? []).map((p) => (typeof p === 'number' ? p : p.id)),
    releaseDate: release.date,
    releasePrecision: release.precision,
    releaseLabel: release.label,
    igdbSyncedAt: now,
  };
}

type Dated = Pick<TrackedGame, 'releaseDate' | 'releaseLabel'>;

/** True when IGDB's date for the game differs from the stored one. */
export function releaseMoved(game: Dated, synced: Dated): boolean {
  return synced.releaseDate !== game.releaseDate || synced.releaseLabel !== game.releaseLabel;
}

/** How many earlier dates a game keeps (the latest ones). */
const MAX_RELEASE_HISTORY = 12;

/**
 * What to write when IGDB's copy of a game changed: the synced fields, plus, when the release
 * date moved, the history with the date it had until now added. A game that had no date yet (TBA)
 * adds nothing: there was no announced date to remember.
 */
export function syncUpdate(
  game: Pick<TrackedGame, 'releaseDate' | 'releasePrecision' | 'releaseLabel' | 'releaseHistory'>,
  synced: SyncedFields,
  now = Date.now(),
): SyncedFields & { releaseHistory?: ReleaseChange[] } {
  if (!releaseMoved(game, synced) || !game.releaseDate) return synced;
  const before: ReleaseChange = {
    date: game.releaseDate,
    precision: game.releasePrecision,
    label: game.releaseLabel,
    changedAt: now,
  };
  return {
    ...synced,
    releaseHistory: [...(game.releaseHistory ?? []), before].slice(-MAX_RELEASE_HISTORY),
  };
}
