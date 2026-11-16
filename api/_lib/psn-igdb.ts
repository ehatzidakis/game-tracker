// Finding PlayStation games on IGDB, so they can be added to the library (with a cover, dates and
// details). No network or database here, so it's easy to test: psn.ts asks IGDB and saves.
import type { PsnGameRecord, TrophyCounts } from './models.js';
import { comparableName, type PsnGame, type PsnTrophyTitle } from './psn-match.js';

/** The IGDB game a PlayStation game is, as much as the lists need to show it. */
export interface IgdbFound {
  id: number;
  name: string;
  coverId: string | null;
}

/** An IGDB game as the lookup asks for it. */
export interface IgdbCandidate {
  id: number;
  name: string;
  game_type?: number;
  cover?: { image_id: string };
}

/** A game IGDB didn't find is asked again after this long (IGDB keeps adding store ids). */
export const IGDB_RETRY_MS = 7 * 24 * 3_600_000;

/** IGDB's PS4 and PS5 platform ids, for searching by name. */
export const PLAYSTATION_PLATFORMS = [48, 167];

/**
 * IGDB game types a played PlayStation game can be, best first: main game, remaster, remake,
 * expanded game, port, standalone expansion, expansion, episode, season, fork. Never DLC (1),
 * a mod (5), a pack (13) or an update (14). A bundle (3) only with exactly its name: PlayStation
 * sells some as one game ("Crash Bandicoot N. Sane Trilogy", "Metro Redux").
 */
const TYPE_RANK = [0, 9, 8, 10, 11, 4, 2, 6, 7, 12];
const BUNDLE = 3;
/** Never a played game: left out of searches too. */
export const SEARCH_EXCLUDED_TYPES = [1, 5, 13, 14];
/** An episode (6) or a season (7): a store id leading only to one is checked by name too. */
const PART_TYPES = [6, 7];

const typeOf = (c: IgdbCandidate) => c.game_type ?? 0;

function rank(candidate: IgdbCandidate): number {
  const i = TYPE_RANK.indexOf(typeOf(candidate));
  return i < 0 ? TYPE_RANK.length : i;
}

/** Whether this game, picked by store id, is worth checking against a search by name. */
export function isPart(candidate: IgdbCandidate | undefined): boolean {
  return !!candidate && PART_TYPES.includes(typeOf(candidate));
}

/** Edition words stores add that IGDB usually doesn't have a game of its own for. */
const EDITION =
  /( (digital|standard|deluxe|ultimate|complete|gold|definitive|special|launch|premium|cross gen|game of the year|goty))+( edition)?$| edition$/;

function withoutEdition(name: string): string {
  return comparableName(name).replace(EDITION, '').trim();
}

const found = (c: IgdbCandidate): IgdbFound => ({
  id: c.id,
  name: c.name,
  coverId: c.cover?.image_id ?? null,
});

/**
 * The IGDB game for a PlayStation game, from the games IGDB lists for its PlayStation Store id
 * (`byStore`: a sure match, so the best kind wins, the same name first), or else from a search by
 * its name (only a game with the same name, or the same name without an edition like "Deluxe
 * Edition", so a sequel or a different game never slips in). A store id that leads only to an
 * episode or season gives way to a game with exactly the name ("Life Is Strange", not its
 * Episode 1). A bundle only with exactly the name. Null when nothing fits.
 */
export function pickIgdbGame(
  psnName: string,
  byStore: readonly IgdbCandidate[],
  bySearch: readonly IgdbCandidate[] = [],
): IgdbFound | null {
  const wanted = comparableName(psnName);
  const sameName = (c: IgdbCandidate) => comparableName(c.name) === wanted;
  const usable = (list: readonly IgdbCandidate[]) =>
    list.filter((c) => typeOf(c) !== BUNDLE && !SEARCH_EXCLUDED_TYPES.includes(typeOf(c)));
  const best = (list: readonly IgdbCandidate[]) =>
    [...list].sort((a, b) => Number(sameName(b)) - Number(sameName(a)) || rank(a) - rank(b))[0];

  const stored = usable(byStore);
  const storeBest = stored.length ? best(stored) : undefined;
  if (storeBest && !isPart(storeBest)) return found(storeBest);

  const searched = usable(bySearch);
  const same = searched.filter(sameName);
  if (same.length) return found(best(same));
  if (storeBest) return found(storeBest);
  const plain = withoutEdition(psnName);
  const edition = searched.filter((c) => withoutEdition(c.name) === plain);
  if (edition.length) return found(best(edition));
  const bundle = [...byStore, ...bySearch].find((c) => typeOf(c) === BUNDLE && sameName(c));
  return bundle ? found(bundle) : null;
}

/** Whether to ask IGDB about a game (again): never asked, or not found a while ago. */
export function needsLookup(
  record: Pick<PsnGameRecord, 'igdb' | 'igdbCheckedAt'> | undefined,
  now: number,
): boolean {
  if (!record || record.igdb === undefined) return true;
  return record.igdb === null && now - (record.igdbCheckedAt ?? 0) >= IGDB_RETRY_MS;
}

/** The name to search IGDB with: without ™ and "PS4 & PS5", quoted for an Apicalypse query. */
export function searchTerm(name: string): string {
  const plain = name
    .replace(/[™®©]/g, '')
    .replace(/\b(PS4|PS5)\s*(&|and)\s*(PS4|PS5)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `"${plain.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** PS5 if any version played is a PS5 one (PPSA title ids), else PS4. */
export function psnPlatform(game: Pick<PsnGame, 'titleIds'>): 'ps5' | 'ps4' {
  return game.titleIds.some((id) => id.startsWith('PPSA')) ? 'ps5' : 'ps4';
}

/** Whether a game has a Platinum and whether it's earned, from the trophy lists linked to it. */
export function platinumOf(
  conceptId: number,
  lists: readonly (PsnTrophyTitle & {
    definedTrophies: TrophyCounts;
    earnedTrophies: TrophyCounts;
  })[],
  links: ReadonlyMap<string, number>,
): { hasPlatinum: boolean; platinumEarned: boolean } {
  const mine = lists.filter((l) => links.get(l.npCommunicationId) === conceptId);
  return {
    hasPlatinum: mine.some((l) => l.definedTrophies.platinum > 0),
    platinumEarned: mine.some((l) => l.earnedTrophies.platinum > 0),
  };
}
