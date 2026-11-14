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

export type PsnGameUpdate = Partial<
  Pick<TrackedGame, 'playstation' | 'hoursPlayed' | 'hoursPlayedManual'>
>;

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
