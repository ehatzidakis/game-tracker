import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';

import { PLATFORMS } from '../../../api/_lib/platforms.js';
import { SYNC_FIELDS, type IgdbSyncGame } from '../../../api/_lib/igdb-sync.js';

export { PLATFORMS, type PlatformKey } from '../../../api/_lib/platforms.js';

export interface GameSearchResult {
  id: number;
  name: string;
  coverId: string | null;
  year: number | null;
  /** First release, "YYYY-MM-DD", or null when there's no date yet. */
  releaseDate: string | null;
  /** True if there's no release date yet or it's in the future. */
  upcoming: boolean;
  /** Our platforms first (PS5, Xbox, PC, Switch 2), then up to two others. */
  platforms: string[];
  /** For DLC and expansions: the main game. */
  dlcOf: { id: number; name: string } | null;
}

interface IgdbGame {
  id: number;
  name: string;
  cover?: { image_id: string };
  first_release_date?: number;
  platforms?: { id: number; abbreviation?: string; name: string }[];
  /** How many people follow it on IGDB before release. */
  hypes?: number;
  total_rating_count?: number;
  /** "GTA 6" for Grand Theft Auto VI. */
  alternative_names?: { name: string }[];
  /** 6 = cancelled. */
  game_status?: number;
  /** 1 = DLC, 2 = expansion (see DLC_GAME_TYPES). */
  game_type?: number;
  /** The main game, for DLC and expansions. */
  parent_game?: { id: number; name: string; hypes?: number; total_rating_count?: number };
}

const CANCELLED = 6;
/** Ratings plus followers on IGDB. Sons of Sparta has 15, Astro Bot 218, most fan games under 5. */
const WELL_KNOWN = 10;

/** IGDB game types for DLC and expansions, which live inside their main game. */
export const DLC_GAME_TYPES = [1, 2];

// Main games, DLC, expansions, standalone expansions, remakes, remasters, expanded games and
// ports. Leaves out bundles, mods, episodes and updates.
const SEARCHABLE_GAME_TYPES = '(0,1,2,4,8,9,10,11)';
const SEARCH_FIELDS =
  'fields name, alternative_names.name, cover.image_id, first_release_date, platforms.abbreviation, platforms.name, hypes, total_rating_count, game_status, game_type, parent_game.name, parent_game.hypes, parent_game.total_rating_count;';
const SEARCH_FILTER = `version_parent = null & game_type = ${SEARCHABLE_GAME_TYPES}`;
const MAX_RESULTS = 30;
// Fetch more than we show: the ranking below pulls well-known games up from further down.
const FETCH_LIMIT = 50;

function escapeTerm(term: string): string {
  return term.trim().slice(0, 100).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** IGDB's text search: forgiving (typos, accents), but often misses brand-new games. */
export function buildSearchQuery(term: string): string {
  return [
    `search "${escapeTerm(term)}";`,
    SEARCH_FIELDS,
    `where ${SEARCH_FILTER};`,
    `limit ${FETCH_LIMIT};`,
  ].join(' ');
}

/** Names containing the term, newest first. Catches new and upcoming games the text search ranks low. */
export function buildNameQuery(term: string): string {
  return [
    SEARCH_FIELDS,
    `where name ~ *"${escapeTerm(term)}"* & ${SEARCH_FILTER};`,
    'sort first_release_date desc;',
    `limit ${FETCH_LIMIT};`,
  ].join(' ');
}

/** Lowercase, no accents or punctuation: "Ragnarök: Valhalla" → "ragnarok valhalla". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Merges both searches, in this order:
 * 0. The name (or another name, like "GTA 6") contains what you typed from the start of a word,
 *    and the game is well known on IGDB. Newest first, so upcoming games lead.
 * 1. Other name matches: fan games, obscure releases. Newest first.
 * 2. IGDB's looser matches, in its own order.
 * 3. Cancelled games.
 * Within 0 and 1, games without a date go last: they're often rumours.
 * DLC counts as well known when its main game is, matches on the main game's name too, and comes
 * right after the games of its group ("cronos": Cronos: The New Dawn, then Cronos: Lazarus).
 */
export function rankSearchResults(
  term: string,
  searchHits: IgdbGame[],
  nameHits: IgdbGame[],
): IgdbGame[] {
  const phrase = ' ' + normalize(term);
  const seen = new Set<number>();
  const games = [...searchHits, ...nameHits].filter((g) => !seen.has(g.id) && !!seen.add(g.id));

  const matches = (g: IgdbGame) =>
    [g.name, ...(g.alternative_names ?? []).map((a) => a.name), g.parent_game?.name ?? '']
      .filter(Boolean)
      .some((name) => ` ${normalize(name)} `.includes(phrase));
  const fame = (g: { hypes?: number; total_rating_count?: number } | undefined) =>
    (g?.total_rating_count ?? 0) + (g?.hypes ?? 0);
  const tier = (g: IgdbGame) => {
    if (g.game_status === CANCELLED) return 3;
    if (!matches(g)) return 2;
    const dlc = DLC_GAME_TYPES.includes(g.game_type ?? 0);
    const known = Math.max(fame(g), dlc ? fame(g.parent_game) : 0) >= WELL_KNOWN;
    return (known ? 0 : 1) + (dlc ? 0.5 : 0);
  };
  const date = (g: IgdbGame) => g.first_release_date ?? 0;

  return games
    .map((game, index) => ({ game, index, tier: tier(game) }))
    .sort(
      (a, b) =>
        a.tier - b.tier || (a.tier < 2 ? date(b.game) - date(a.game) : 0) || a.index - b.index,
    )
    .slice(0, MAX_RESULTS)
    .map((r) => r.game);
}

export function toSearchResult(game: IgdbGame): GameSearchResult {
  const platforms = game.platforms ?? [];
  const ours = PLATFORMS.filter((p) => platforms.some((gp) => gp.id === p.igdbId)).map(
    (p) => p.label,
  );
  const others = platforms
    .filter((gp) => !PLATFORMS.some((p) => p.igdbId === gp.id))
    .slice(0, Math.max(0, 2 - ours.length))
    .map((gp) => gp.abbreviation ?? gp.name);

  return {
    id: game.id,
    name: game.name,
    coverId: game.cover?.image_id ?? null,
    year: game.first_release_date
      ? new Date(game.first_release_date * 1000).getUTCFullYear()
      : null,
    platforms: [...ours, ...others],
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
    upcoming: !game.first_release_date || game.first_release_date * 1000 > Date.now(),
    dlcOf:
      DLC_GAME_TYPES.includes(game.game_type ?? 0) && game.parent_game
        ? { id: game.parent_game.id, name: game.parent_game.name }
        : null,
  };
}

export type ImageSize =
  'cover_small' | 'cover_big' | 'screenshot_med' | 'screenshot_big' | '720p' | '1080p';

export function coverUrl(imageId: string, size: ImageSize = 'cover_big'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

/** Everything the game screen shows, plus the fields copied into the library. */
export interface GameDetails extends IgdbSyncGame {
  first_release_date?: number;
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  platforms?: { id: number; abbreviation?: string; name: string }[];
  game_type?: number;
  parent_game?: { id: number; name: string };
  dlcs?: GameSummary[];
  expansions?: GameSummary[];
  /** Critics' score out of 100, and how many reviews. */
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  /** Players' score out of 100 on IGDB, and how many ratings. */
  rating?: number;
  rating_count?: number;
  /** The series ("God of War") with its games. */
  collections?: { name: string; games?: (GameSummary & { game_type?: number })[] }[];
  involved_companies?: { company?: { name: string }; developer?: boolean; publisher?: boolean }[];
  age_ratings?: { organization?: { name: string }; rating_category?: { rating: string } }[];
  game_modes?: { name: string }[];
  themes?: { name: string }[];
  websites?: { url: string; type?: { type: string } }[];
}

/** A game as listed on another game's page (its DLC, its series) or in Search's lists. */
export interface GameSummary {
  id: number;
  name: string;
  cover?: { image_id: string };
  first_release_date?: number;
}
/** A DLC or expansion as listed on its main game's page. */
export type DlcSummary = GameSummary;

/** Time to finish in seconds, from IGDB players: main story, main + sides, everything. */
export interface TimeToBeat {
  hastily?: number;
  normally?: number;
  completely?: number;
  /** How many players it's based on. */
  count?: number;
}

/** Undated (upcoming) first, then newest first. */
function newestFirst(a: GameSummary, b: GameSummary): number {
  return (
    (b.first_release_date ?? Number.MAX_SAFE_INTEGER) -
    (a.first_release_date ?? Number.MAX_SAFE_INTEGER)
  );
}

/** The main game's DLC and expansions, expansions first, each group newest first. */
export function dlcsOf(details: Pick<GameDetails, 'dlcs' | 'expansions'>): GameSummary[] {
  return [
    ...(details.expansions ?? []).sort(newestFirst),
    ...(details.dlcs ?? []).sort(newestFirst),
  ];
}

/** Other games in the same series: main games, remakes and remasters, not DLC. Newest first. */
export function seriesOf(details: GameDetails): { name: string; games: GameSummary[] } | null {
  const collection = details.collections?.find((c) => (c.games?.length ?? 0) > 1);
  if (!collection) return null;
  const seen = new Set<number>([details.id]);
  const games = (collection.games ?? [])
    .filter(
      (g) => !DLC_GAME_TYPES.includes(g.game_type ?? 0) && !seen.has(g.id) && !!seen.add(g.id),
    )
    .sort(newestFirst);
  return games.length ? { name: collection.name, games } : null;
}

/** Store and official links worth showing, in this order, with friendlier names. */
const LINKS: [type: string, label: string][] = [
  ['Official Website', 'Official website'],
  ['Playstation', 'PlayStation Store'],
  ['Xbox', 'Xbox Store'],
  ['Nintendo', 'Nintendo eShop'],
  ['Steam', 'Steam'],
  ['Epic', 'Epic Games Store'],
  ['GOG', 'GOG'],
  ['Wikipedia', 'Wikipedia'],
];

export function linksOf(details: GameDetails): { label: string; url: string }[] {
  return LINKS.flatMap(([type, label]) => {
    const site = details.websites?.find(
      (w) => w.type?.type === type && w.url.startsWith('https://'),
    );
    return site ? [{ label, url: site.url }] : [];
  });
}

export function buildDetailsQuery(id: number): string {
  return [
    `fields ${SYNC_FIELDS}, platforms.abbreviation, platforms.name, first_release_date,`,
    'artworks.image_id, screenshots.image_id,',
    'game_type, parent_game.name, dlcs.name, dlcs.cover.image_id, dlcs.first_release_date,',
    'expansions.name, expansions.cover.image_id, expansions.first_release_date,',
    'aggregated_rating, aggregated_rating_count, rating, rating_count,',
    'collections.name, collections.games.name, collections.games.game_type,',
    'collections.games.cover.image_id, collections.games.first_release_date,',
    'involved_companies.publisher, age_ratings.organization.name,',
    'age_ratings.rating_category.rating, game_modes.name, themes.name,',
    'websites.url, websites.type.type;',
    `where id = ${Math.trunc(id)};`,
    'limit 1;',
  ].join(' ');
}

export type DiscoverKind = 'anticipated' | 'soon' | 'recent';

const DAY = 86_400;

/** Search's lists before you type, for one platform. Only games people follow on IGDB. */
export function buildDiscoverQuery(kind: DiscoverKind, platformId: number, now: number): string {
  const t = Math.floor(now / 1000);
  const where = [
    `platforms = (${Math.trunc(platformId)})`,
    'version_parent = null',
    'game_type = (0,4,8,9,10,11)',
    'hypes > 0',
  ];
  let sort = 'hypes desc';
  if (kind === 'anticipated') where.push(`first_release_date > ${t}`);
  if (kind === 'soon') {
    // A few more followers, so small indie releases don't fill the list.
    where.push(`first_release_date > ${t}`, `first_release_date < ${t + 60 * DAY}`, 'hypes > 2');
    sort = 'first_release_date asc';
  }
  if (kind === 'recent')
    where.push(`first_release_date < ${t}`, `first_release_date > ${t - 60 * DAY}`);
  return [
    'fields name, cover.image_id, first_release_date, platforms.abbreviation, platforms.name;',
    `where ${where.join(' & ')};`,
    `sort ${sort};`,
    'limit 15;',
  ].join(' ');
}

@Injectable({ providedIn: 'root' })
export class IgdbService {
  private readonly auth = inject(AuthService);

  async search(term: string): Promise<GameSearchResult[]> {
    const [searchHits, nameHits] = await Promise.allSettled([
      this.query<IgdbGame[]>('games', buildSearchQuery(term)),
      this.query<IgdbGame[]>('games', buildNameQuery(term)),
    ]);
    // The text search must work; the name search only adds to it.
    if (searchHits.status === 'rejected') throw searchHits.reason;
    const extra = nameHits.status === 'fulfilled' ? nameHits.value : [];
    return rankSearchResults(term, searchHits.value, extra).map(toSearchResult);
  }

  async game(id: number): Promise<GameDetails | null> {
    const games = await this.query<GameDetails[]>('games', buildDetailsQuery(id));
    return games[0] ?? null;
  }

  async timeToBeat(id: number): Promise<TimeToBeat | null> {
    const rows = await this.query<TimeToBeat[]>(
      'game_time_to_beats',
      `fields hastily, normally, completely, count; where game_id = ${Math.trunc(id)}; limit 1;`,
    );
    return rows[0] ?? null;
  }

  async discover(kind: DiscoverKind, platformId: number): Promise<GameSearchResult[]> {
    const games = await this.query<IgdbGame[]>(
      'games',
      buildDiscoverQuery(kind, platformId, Date.now()),
    );
    return games.map(toSearchResult);
  }

  private async query<T>(endpoint: string, query: string): Promise<T> {
    const res = await fetch('/api/igdb', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.auth.idToken()}`,
      },
      body: JSON.stringify({ endpoint, query }),
    });
    if (!res.ok) throw new Error(`IGDB request failed (${res.status})`);
    return res.json() as Promise<T>;
  }
}
