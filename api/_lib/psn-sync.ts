// What the PlayStation sync writes onto library games. No network or database here, so it's easy
// to test. The rules (2026-11-14):
// - Playtime from PlayStation replaces what's stored, but only when PlayStation has some (above
//   0). The hours you typed in are kept in hoursPlayedManual the first time they're replaced.
// - A game that's no longer matched loses its PlayStation block, never its hours.
// - Nothing changes when nothing changed (no writes, no "updated" churn).
import type { PlaystationData, TrackedGame, TrophyCounts, TrophyProgress } from './models.js';
import type { PsnGame, PsnMatch } from './psn-match.js';

/** A trophy list as psn-api returns it (the parts the sync uses). */
export interface TrophyListData {
  npCommunicationId: string;
  trophyTitlePlatform: string;
  progress: number;
  definedTrophies: TrophyCounts;
  earnedTrophies: TrophyCounts;
  lastUpdatedDateTime?: string;
  /** "trophy" for PS4 lists, "trophy2" for PS5 ones: needed to ask for a list's trophies. */
  npServiceName?: 'trophy' | 'trophy2';
}

/** Minutes are what's shown, so smaller differences don't count as a change. */
const SAME_HOURS = 1 / 120;

/**
 * Of a game's trophy lists (a PS4 and a PS5 one, say), the one shown: the one for your platform,
 * else the furthest along (then the latest).
 */
export function pickTrophyList(
  lists: readonly TrophyListData[],
  myPlatform: string,
): TrophyListData | null {
  // Whole names: "PS5,PSPC" is a PS5 list (PSPC is Sony's own PC port, not "pc").
  const mine = myPlatform.toUpperCase();
  const forMine = (list: TrophyListData) =>
    Number(list.trophyTitlePlatform.toUpperCase().split(',').includes(mine));
  const ranked = [...lists].sort(
    (a, b) =>
      forMine(b) - forMine(a) ||
      b.progress - a.progress ||
      (b.lastUpdatedDateTime ?? '').localeCompare(a.lastUpdatedDateTime ?? ''),
  );
  return ranked[0] ?? null;
}

function trophiesOf(list: TrophyListData | null): TrophyProgress | null {
  if (!list) return null;
  const at = list.lastUpdatedDateTime ? Date.parse(list.lastUpdatedDateTime) : NaN;
  return {
    earned: { ...list.earnedTrophies },
    defined: { ...list.definedTrophies },
    progress: list.progress,
    lastEarnedAt: Number.isNaN(at) ? null : at,
    platform: list.trophyTitlePlatform,
  };
}

/** The block's content without when it was written, to see whether anything changed. */
const content = (data: PlaystationData | null | undefined) =>
  data ? JSON.stringify({ ...data, syncedAt: 0 }) : null;

export type PsnGameUpdate = Partial<TrackedGame>;

/**
 * The updates for each library game (by IGDB id), only for games where something changed.
 * `matches` are the PlayStation games' library games; `listsByGame` each library game's trophy
 * lists (ids, looked up in `lists`).
 */
export function psnUpdates(
  library: readonly TrackedGame[],
  games: readonly PsnGame[],
  matches: readonly PsnMatch[],
  lists: readonly TrophyListData[],
  listsByGame: ReadonlyMap<number, readonly string[]>,
  now: number,
): Map<number, PsnGameUpdate> {
  const gameByConcept = new Map(games.map((g) => [g.conceptId, g]));
  const listById = new Map(lists.map((l) => [l.npCommunicationId, l]));
  const updates = new Map<number, PsnGameUpdate>();

  for (const game of library) {
    const played = matches
      .filter((m) => m.igdbId === game.igdbId)
      .map((m) => gameByConcept.get(m.conceptId))
      .filter((g) => g !== undefined);
    const gameLists = (listsByGame.get(game.igdbId) ?? [])
      .map((id) => listById.get(id))
      .filter((l) => l !== undefined);

    if (!played.length && !gameLists.length) {
      // No longer on your PlayStation (unmatched): drop the block, keep the hours.
      if (game.playstation) updates.set(game.igdbId, { playstation: null });
      continue;
    }

    const firsts = played.map((g) => g.firstPlayedAt).filter((t) => t !== null);
    const lasts = played.map((g) => g.lastPlayedAt).filter((t) => t !== null);
    const data: PlaystationData = {
      playSeconds: played.reduce((sum, g) => sum + g.playSeconds, 0),
      firstPlayedAt: firsts.length ? Math.min(...firsts) : null,
      lastPlayedAt: lasts.length ? Math.max(...lasts) : null,
      trophies: trophiesOf(pickTrophyList(gameLists, game.myPlatform)),
      syncedAt: now,
    };

    const update: PsnGameUpdate = {};
    if (content(data) !== content(game.playstation)) update.playstation = data;
    // Added straight to Completed, before PlayStation was read: it got the day it was added.
    // Now that PlayStation says when it was last played, that's its date.
    if (
      game.status === 'completed' &&
      game.completedAt != null &&
      game.completedAt === game.addedAt &&
      data.lastPlayedAt !== null &&
      data.lastPlayedAt !== game.completedAt
    ) {
      update.completedAt = data.lastPlayedAt;
    }
    if (data.playSeconds > 0) {
      // Whole minutes, rounded down, as PlayStation itself shows it ("113h 9m" for 113:09:33).
      const hours = Math.floor(data.playSeconds / 60) / 60;
      const had = game.hoursPlayed ?? null;
      if (had === null || Math.abs(had - hours) >= SAME_HOURS) {
        update.hoursPlayed = hours;
        // The first time PlayStation replaces hours you typed in, keep yours.
        if (had !== null && game.hoursPlayedManual == null && !game.playstation?.playSeconds) {
          update.hoursPlayedManual = had;
        }
      }
    }
    if (Object.keys(update).length) updates.set(game.igdbId, update);
  }
  return updates;
}

/** A library game with a Platinum on PlayStation that isn't Completed with Platinum yet. */
export interface PlatinumMove {
  igdbId: number;
  /** The trophy list with the Platinum, to ask when it was earned. */
  listId: string;
  serviceName: 'trophy' | 'trophy2';
  /** It isn't Completed yet: it moves there (otherwise only its completion goes up to Platinum). */
  completes: boolean;
}

/**
 * The games a Platinum completes: any of their trophy lists has the Platinum earned, and they
 * aren't Completed with Platinum yet. DLC has no Platinum, so it never shows up here.
 */
export function platinumMoves(
  library: readonly TrackedGame[],
  lists: readonly TrophyListData[],
  listsByGame: ReadonlyMap<number, readonly string[]>,
): PlatinumMove[] {
  const listById = new Map(lists.map((l) => [l.npCommunicationId, l]));
  const moves: PlatinumMove[] = [];
  for (const game of library) {
    if (game.status === 'completed' && game.completion === 'platinum') continue;
    const withPlatinum = (listsByGame.get(game.igdbId) ?? [])
      .map((id) => listById.get(id))
      .filter((l) => l !== undefined && l.earnedTrophies.platinum > 0);
    const list = pickTrophyList(withPlatinum as TrophyListData[], game.myPlatform);
    if (!list) continue;
    moves.push({
      igdbId: game.igdbId,
      listId: list.npCommunicationId,
      serviceName:
        list.npServiceName ?? (/PS5/i.test(list.trophyTitlePlatform) ? 'trophy2' : 'trophy'),
      completes: game.status !== 'completed',
    });
  }
  return moves;
}

/**
 * What a Platinum changes on a game: Completed, with Platinum, completed the day the Platinum was
 * earned (`platinumAt`), no longer Playing. Already Completed: only how far you got, its date
 * stays.
 */
export function platinumUpdate(game: TrackedGame, platinumAt: number, now: number): PsnGameUpdate {
  if (game.status === 'completed') return { completion: 'platinum', updatedAt: now };
  return {
    status: 'completed',
    completion: 'platinum',
    completedAt: platinumAt,
    purchasedAt: game.purchasedAt ?? platinumAt,
    ...(game.playing ? { playing: false } : {}),
    updatedAt: now,
  };
}

/** After this long without a sync that worked, you're told (when it isn't the sign-in). */
export const SYNC_ALERT_AFTER_MS = 24 * 3_600_000;

/**
 * Whether a failed sync should tell you: once per outage, right away when the sign-in needs a
 * new token, else once it hasn't worked for a day (one bad hour isn't worth a notification).
 */
export function shouldAlert(
  before: { alertedAt?: number | null; lastOkAt?: number | null } | undefined,
  needsToken: boolean,
  now: number,
): boolean {
  if (before?.alertedAt) return false;
  if (needsToken) return true;
  return !!before?.lastOkAt && now - before.lastOkAt >= SYNC_ALERT_AFTER_MS;
}
