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
  /** You own (or pre-ordered) it on disc rather than as a download. */
  physical?: boolean;

  // DLC and expansions are stored like games, plus the main game's IGDB ID and name. DLC on your
  // wishlist shows in Wishlist and the Calendar; owned DLC shows only on the main game's page.
  parentId?: number | null;
  parentName?: string | null;

  // Gaming events (users/{uid}/events) linked to the game, by event id.
  /** The event where the game was first shown. */
  firstShownEventId?: string | null;
  /** The event where its release date was announced. */
  dateAnnouncedEventId?: string | null;

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

/** True for DLC and expansions you track. */
export function isDlc(game: Pick<TrackedGame, 'parentId'>): boolean {
  return game.parentId != null;
}

/** Library tabs list games, plus DLC only while it's on your wishlist. */
export function shownInLibrary(game: Pick<TrackedGame, 'parentId' | 'status'>): boolean {
  return !isDlc(game) || game.status === 'wishlist';
}

/** Who holds a gaming event, for its icon: the three platforms, or a showcase (Summer Game Fest, The Game Awards…). */
export type EventKind = 'playstation' | 'xbox' | 'nintendo' | 'showcase' | 'other';

export const EVENT_KINDS: readonly { key: EventKind; label: string }[] = [
  { key: 'playstation', label: 'PlayStation' },
  { key: 'xbox', label: 'Xbox' },
  { key: 'nintendo', label: 'Nintendo' },
  { key: 'showcase', label: 'Showcase' },
  { key: 'other', label: 'Other' },
];

/**
 * users/{uid}/events/{id}: a gaming event you added (State of Play, Nintendo Direct, Summer Game
 * Fest…). Shows in the Calendar tab and the calendar feed; games can say they were first shown
 * or dated at one.
 */
export interface GamingEvent {
  id: string;
  title: string;
  /** When it starts (ms). */
  startsAt: number;
  /** How long it runs, if you know (minutes). The iPhone Calendar shows an hour without it. */
  durationMinutes?: number | null;
  link: string | null;
  kind: EventKind;
  /** Done with: hidden from the Calendar and from the lists you pick events from. Games keep it. */
  archived: boolean;
  createdAt: number;
  updatedAt: number;
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
