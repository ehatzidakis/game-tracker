import type { PlatformKey } from './platforms.js';

export type Status = 'wishlist' | 'backlog' | 'playing' | 'shelved' | 'completed';
export type Completion = 'main' | 'main_sides' | 'platinum';
export type ReleasePrecision = 'day' | 'month' | 'quarter' | 'year' | 'tbd';

/** Display order everywhere (Library filters, status pickers). */
export const STATUSES: readonly { key: Status; label: string; hint: string }[] = [
  { key: 'playing', label: 'Playing', hint: 'Playing it now' },
  { key: 'backlog', label: 'Backlog', hint: 'Own it, not started' },
  { key: 'wishlist', label: 'Wishlist', hint: 'Upcoming or not bought yet' },
  { key: 'shelved', label: 'Shelved', hint: 'Stopped for now' },
  { key: 'completed', label: 'Completed', hint: 'Finished it' },
];

export const COMPLETIONS: readonly { key: Completion; label: string }[] = [
  { key: 'main', label: 'Main story' },
  { key: 'main_sides', label: 'Main + sides' },
  { key: 'platinum', label: 'Platinum' },
];

export function statusLabel(status: Status): string {
  return STATUSES.find((s) => s.key === status)?.label ?? status;
}

export function completionLabel(completion: Completion | null | undefined): string | null {
  return COMPLETIONS.find((c) => c.key === completion)?.label ?? null;
}

/** One release date as IGDB reports it, trimmed to what we use. */
export interface ReleaseDateInfo {
  platform: number;
  /** Unix seconds. For vague dates IGDB gives the end of the period. */
  date: number | null;
  /** IGDB date_format: 0 day, 1 month, 2 year, 3–6 Q1–Q4, 7 TBD. */
  format: number;
  /** IGDB release_region: 1 Europe, 8 worldwide, … */
  region: number | null;
  human: string | null;
}

export interface Release {
  /** "YYYY-MM-DD". For vague dates this is the last day of the period, so sorting still works. */
  date: string | null;
  precision: ReleasePrecision;
  /** "19 Nov 2026", "Nov 2026", "Q3 2027", "2027" or "TBA". */
  label: string;
}

/** A game in the library: users/{uid}/games/{igdbId}. */
export interface TrackedGame {
  igdbId: number;
  // Copied from IGDB, refreshed by the daily job.
  name: string;
  slug: string | null;
  coverId: string | null;
  genres: string[];
  developer: string | null;
  /** IGDB platform IDs the game is on. */
  platforms: number[];
  releaseDate: string | null;
  releasePrecision: ReleasePrecision;
  releaseLabel: string;
  igdbSyncedAt: number;

  // Yours.
  status: Status;
  completion: Completion | null;
  myPlatform: PlatformKey;
  hoursPlayed: number | null;
  rating: number | null;
  notes: string;
  notify: boolean;

  // Pre-order or purchase (optional details). Pre-ordering an upcoming game moves it from
  // Wishlist to Backlog.
  preordered?: boolean;
  /** In euros. */
  pricePaid?: number | null;
  boughtFrom?: string | null;
  /** "YYYY-MM-DD": when you pre-ordered or bought it. */
  orderedOn?: string | null;

  // Milliseconds since 1970, or null.
  addedAt: number;
  purchasedAt: number | null;
  startedAt: number | null;
  shelvedAt: number | null;
  completedAt: number | null;
  updatedAt: number;

  /** Set by the alert job: the release date the alert was sent for, so it's sent once. */
  notifiedFor?: string | null;
}

/** users/{uid} */
export interface UserSettings {
  calendarKey: string | null;
  timezone: string;
  /** "HH:mm" */
  notifyTime: string;
  notifyDaysBefore: number;
  defaultPlatform: PlatformKey;
}

export const DEFAULT_SETTINGS: UserSettings = {
  calendarKey: null,
  timezone: 'Europe/Athens',
  notifyTime: '13:00',
  notifyDaysBefore: 1,
  defaultPlatform: 'ps5',
};
