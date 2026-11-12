import type { PlatformKey } from './platforms.js';

export type Status = 'wishlist' | 'backlog' | 'shelved' | 'completed';
export type Completion = 'main' | 'main_sides' | 'platinum';
export type ReleasePrecision = 'day' | 'month' | 'quarter' | 'year' | 'tbd';

/** Display order everywhere (Library filters, status pickers). */
export const STATUSES: readonly { key: Status; label: string; hint: string }[] = [
  { key: 'backlog', label: 'Backlog', hint: 'Own it, not finished' },
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

/** A release date a game had before it moved, and when we saw it change. */
export interface ReleaseChange extends Release {
  /** When the date changed to the next one (ms). */
  changedAt: number;
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
  /**
   * The dates it had before, oldest first, kept from 2026-11-12 on: IGDB only has the current
   * date, so each move is saved when the daily job (or opening the game) sees it.
   */
  releaseHistory?: ReleaseChange[];

  // Yours.
  status: Status;
  completion: Completion | null;
  myPlatform: PlatformKey;
  hoursPlayed: number | null;
  rating: number | null;
  notes: string;
  notify: boolean;
  /**
   * You're playing it now: a Backlog game, at most MAX_PLAYING at once. (Before 2026-11-09 this
   * was a status of its own; old "playing" data reads as Backlog + playing.)
   */
  playing?: boolean;

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

/**
 * A pre-order whose day has come: on your Wishlist, pre-ordered, with an exact release day that
 * is today or past (in your time zone). It moves to your Backlog then: you own it now.
 */
export function preorderArrived(
  game: Pick<TrackedGame, 'status' | 'preordered' | 'releaseDate' | 'releasePrecision'>,
  today: string,
): boolean {
  return (
    game.status === 'wishlist' &&
    !!game.preordered &&
    game.releasePrecision === 'day' &&
    !!game.releaseDate &&
    game.releaseDate <= today
  );
}

/** How many games can be marked Playing at once. */
export const MAX_PLAYING = 3;

/** Reads a stored game, turning the old "playing" status into Backlog + playing. */
export function normalizeGame(game: TrackedGame): TrackedGame {
  return (game.status as string) === 'playing'
    ? { ...game, status: 'backlog', playing: true }
    : game;
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
 * users/{uid}/events/{id}: a gaming event in your calendar (State of Play, Nintendo Direct,
 * Summer Game Fest…), added from IGDB or made by hand. Shows in the Calendar tab until it's over,
 * then in the Library's Events tab, and always in the calendar feed.
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
  /** Done with: hidden from the Calendar and the Library. Still listed in Settings. */
  archived: boolean;
  /** For an event added from IGDB: its id there. It follows IGDB (time, name) and isn't edited. */
  igdbId?: number | null;
  /** IGDB image id of its logo. */
  logoId?: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Events without a duration count as an hour long. */
export const DEFAULT_EVENT_MINUTES = 60;

/** When an event is over (ms). */
export function eventEnd(event: Pick<GamingEvent, 'startsAt' | 'durationMinutes'>): number {
  return event.startsAt + (event.durationMinutes || DEFAULT_EVENT_MINUTES) * 60_000;
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
