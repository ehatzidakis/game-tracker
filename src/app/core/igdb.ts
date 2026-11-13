import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';

import { PLATFORMS } from '../../../api/_lib/platforms.js';
import { EVENT_FIELDS, type IgdbEvent } from '../../../api/_lib/igdb-events.js';
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
  'cover_small' | 'cover_big' | 'logo_med' | 'screenshot_med' | 'screenshot_big' | '720p' | '1080p';

export function coverUrl(imageId: string, size: ImageSize = 'cover_big'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

/**
 * A company logo, as a PNG: most are drawn on a see-through background, which a JPG fills with
 * black (a black logo on black).
 */
export function logoUrl(imageId: string): string {
  return `https://images.igdb.com/igdb/image/upload/t_logo_med/${imageId}.png`;
}

/** Everything the game screen shows, plus the fields copied into the library. */
export interface GameDetails extends IgdbSyncGame {
  first_release_date?: number;
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  platforms?: { id: number; abbreviation?: string; name: string }[];
  game_type?: number;
  /** The main game of a DLC, or the original of a remake or remaster. */
  parent_game?: { id: number; name: string; first_release_date?: number };
  game_engines?: { name: string }[];
  dlcs?: GameSummary[];
  expansions?: GameSummary[];
  /** Players' score out of 100 on IGDB, and how many ratings. (OpenCritic has no player scores.) */
  rating?: number;
  rating_count?: number;
  /** The series ("God of War") with its games. */
  collections?: { name: string; games?: (GameSummary & { game_type?: number })[] }[];
  involved_companies?: {
    company?: { id?: number; name: string };
    developer?: boolean;
    publisher?: boolean;
  }[];
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

/** IGDB game types that are a new version of an older game (its parent_game). */
const REMADE_TYPES: Record<number, string> = { 8: 'Remake', 9: 'Remaster' };

/** For a remake or remaster: the original game, to link to. "Remake of Silent Hill 2 (2001)". */
export function remakeOf(
  details: Pick<GameDetails, 'game_type' | 'parent_game'>,
): { id: number; label: string } | null {
  const kind = REMADE_TYPES[details.game_type ?? -1];
  const original = details.parent_game;
  if (!kind || !original) return null;
  const year = original.first_release_date
    ? ` (${new Date(original.first_release_date * 1000).getUTCFullYear()})`
    : '';
  return { id: original.id, label: `${kind} of ${original.name}${year}` };
}

/** A gaming event on IGDB, as Search and a game's page list it. */
export interface EventSummary {
  id: number;
  name: string;
  logoId: string | null;
  /** When it starts (ms). */
  startsAt: number;
}

/** An event's own page: IGDB's details and the games shown at it. */
export interface EventDetails extends IgdbEvent {
  games?: GameSummary[];
}

function toEventSummary(event: IgdbEvent): EventSummary | null {
  if (!event.start_time) return null;
  return {
    id: event.id,
    name: event.name,
    logoId: event.event_logo?.image_id ?? null,
    startsAt: event.start_time * 1000,
  };
}

const EVENT_SUMMARY_FIELDS = 'fields name, event_logo.image_id, start_time;';

/** Events whose name has what you typed, newest first. (IGDB can't text-search events.) */
export function buildEventSearchQuery(term: string): string {
  return [
    EVENT_SUMMARY_FIELDS,
    `where name ~ *"${escapeTerm(term)}"* & start_time != null;`,
    'sort start_time desc;',
    'limit 20;',
  ].join(' ');
}

/** A developer or publisher as Search lists it. */
export interface CompanySummary {
  id: number;
  name: string;
  logoId: string | null;
  /** ISO 3166-1 numeric. */
  country: number | null;
  /** "Developer", "Publisher" or "Developer and publisher". */
  role: string;
}

interface IgdbCompanyHit {
  id: number;
  name: string;
  logo?: { image_id: string };
  country?: number;
  /** Game ids only, to tell big companies from tiny ones. */
  developed?: number[];
  published?: number[];
}

/**
 * Companies whose name has what you typed and that made or published at least one game. (IGDB
 * can't text-search companies, so it's a name match; rankCompanies orders them.)
 */
export function buildCompanySearchQuery(term: string): string {
  return [
    'fields name, logo.image_id, country, developed, published;',
    `where name ~ *"${escapeTerm(term)}"* & (developed != null | published != null);`,
    // IGDB doesn't order these, so ask for plenty and rank them here.
    'limit 100;',
  ].join(' ');
}

const SHOWN_COMPANIES = 20;

/**
 * Names starting with what you typed first, then a word in the name starting with it, then the
 * rest; within each, the companies with the most games first (the well-known ones). IGDB has
 * some companies twice under the same name: only the bigger one is kept.
 */
export function rankCompanies(term: string, hits: readonly IgdbCompanyHit[]): CompanySummary[] {
  const phrase = normalize(term);
  const tier = (name: string) => {
    const n = normalize(name);
    if (n.startsWith(phrase)) return 0;
    return ` ${n}`.includes(` ${phrase}`) ? 1 : 2;
  };
  const size = (c: IgdbCompanyHit) => (c.developed?.length ?? 0) + (c.published?.length ?? 0);
  const names = new Set<string>();
  return [...hits]
    .sort((a, b) => tier(a.name) - tier(b.name) || size(b) - size(a))
    .filter((c) => !names.has(normalize(c.name)) && !!names.add(normalize(c.name)))
    .slice(0, SHOWN_COMPANIES)
    .map((c) => {
      const developer = !!c.developed?.length;
      const publisher = !!c.published?.length;
      return {
        id: c.id,
        name: c.name,
        logoId: c.logo?.image_id ?? null,
        country: c.country ?? null,
        role:
          developer && publisher
            ? 'Developer and publisher'
            : developer
              ? 'Developer'
              : 'Publisher',
      };
    });
}

/** Events that haven't ended yet, soonest first. */
export function buildUpcomingEventsQuery(now: number): string {
  const t = Math.floor(now / 1000);
  return [
    EVENT_SUMMARY_FIELDS,
    `where end_time > ${t} | start_time > ${t};`,
    'sort start_time asc;',
    'limit 15;',
  ].join(' ');
}

/** The events a game was shown at, earliest first: the first one is where it was revealed. */
export function buildGameEventsQuery(gameId: number): string {
  return [
    EVENT_SUMMARY_FIELDS,
    `where games = (${Math.trunc(gameId)}) & start_time != null;`,
    'sort start_time asc;',
    'limit 50;',
  ].join(' ');
}

export function buildEventQuery(id: number): string {
  return [
    `fields ${EVENT_FIELDS}, games.name, games.cover.image_id, games.first_release_date;`,
    `where id = ${Math.trunc(id)};`,
    'limit 1;',
  ].join(' ');
}

/** Undated (upcoming) first, then newest first. */
function newestFirst(a: GameSummary, b: GameSummary): number {
  return (
    (b.first_release_date ?? Number.MAX_SAFE_INTEGER) -
    (a.first_release_date ?? Number.MAX_SAFE_INTEGER)
  );
}

/** A game as listed on a company's page. */
export interface CompanyGame extends GameSummary {
  game_type?: number;
  version_parent?: number;
  game_status?: number;
}

/** A developer or publisher on IGDB, with the games it developed and published. */
export interface CompanyDetails {
  id: number;
  name: string;
  description?: string;
  logo?: { image_id: string };
  /** ISO 3166-1 numeric country code (392 is Japan). */
  country?: number;
  /** Founded (unix seconds), as exact as start_date_format says (like a release date's format). */
  start_date?: number;
  start_date_format?: number;
  company_size?: { name: string };
  status?: { name: string };
  parent?: { id: number; name: string };
  /** The company's page on IGDB. */
  url?: string;
  websites?: { url: string; type?: { type: string } }[];
  developed?: CompanyGame[];
  published?: CompanyGame[];
}

const GAME_FIELDS =
  'name, cover.image_id, first_release_date, game_type, version_parent, game_status';

export function buildCompanyQuery(id: number): string {
  const each = (list: string) =>
    GAME_FIELDS.split(', ')
      .map((f) => `${list}.${f}`)
      .join(', ');
  return [
    'fields name, description, logo.image_id, country, start_date, start_date_format,',
    'company_size.name, status.name, parent.name, url, websites.url, websites.type.type,',
    `${each('developed')}, ${each('published')};`,
    `where id = ${Math.trunc(id)};`,
    'limit 1;',
  ].join(' ');
}

/** A game a company ported or helped make (IGDB keeps these on the game's involved companies). */
export interface CompanyCredit {
  porting?: boolean;
  supporting?: boolean;
  game?: CompanyGame;
}

/** The games a company ported or supported. */
export function buildCompanyCreditsQuery(id: number): string {
  const fields = GAME_FIELDS.split(', ')
    .map((f) => `game.${f}`)
    .join(', ');
  return [
    `fields porting, supporting, ${fields};`,
    `where company = ${Math.trunc(id)} & (porting = true | supporting = true);`,
    'limit 500;',
  ].join(' ');
}

/** IGDB game types. */
const MAIN_TYPES = [0, 4, 8, 9, 10]; // main game, standalone expansion, remake, remaster, expanded
const DLC_TYPES = [1, 2]; // DLC, expansion
const EPISODE = 6;
const SEASON = 7;
/** Never listed: bundles, mods, forks, packs and updates. */
const UNLISTED_TYPES = [3, 5, 12, 13, 14];
const CANCELLED_STATUS = 6;

/** One list on a company's page. The ones past Developed and Published start folded. */
export interface CompanySection {
  key: string;
  title: string;
  games: CompanyGame[];
  folded: boolean;
}

/** Each game once, without other editions of the same game, newest first (upcoming on top). */
function listed(
  games: readonly CompanyGame[],
  keep: (game: CompanyGame) => boolean,
): CompanyGame[] {
  const seen = new Set<number>();
  return games
    .filter((g) => !g.version_parent && keep(g) && !seen.has(g.id) && !!seen.add(g.id))
    .sort(newestFirst);
}

/**
 * The lists on a company's page, empty ones left out: Developed and Published (main games,
 * remakes, remasters and the like), then, folded, Ported, Supported, DLC and expansions,
 * Episodes, Seasons and Cancelled.
 */
export function companySections(
  company: Pick<CompanyDetails, 'developed' | 'published'>,
  credits: readonly CompanyCredit[] = [],
): CompanySection[] {
  const type = (g: CompanyGame) => g.game_type ?? 0;
  const live = (types: number[]) => (g: CompanyGame) =>
    types.includes(type(g)) && g.game_status !== CANCELLED_STATUS;
  const anyLive = (g: CompanyGame) =>
    !UNLISTED_TYPES.includes(type(g)) && g.game_status !== CANCELLED_STATUS;
  const credited = (kind: 'porting' | 'supporting') =>
    credits.filter((c) => c[kind] && c.game).map((c) => c.game!);
  const made = [...(company.developed ?? []), ...(company.published ?? [])];
  const all = [...made, ...credited('porting'), ...credited('supporting')];

  const sections: [string, string, CompanyGame[], boolean][] = [
    ['developed', 'Developed', listed(company.developed ?? [], live(MAIN_TYPES)), false],
    ['published', 'Published', listed(company.published ?? [], live(MAIN_TYPES)), false],
    ['ported', 'Ported', listed(credited('porting'), anyLive), true],
    ['supported', 'Supported', listed(credited('supporting'), anyLive), true],
    ['dlcs', 'DLC and expansions', listed(made, live(DLC_TYPES)), true],
    ['episodes', 'Episodes', listed(made, live([EPISODE])), true],
    ['seasons', 'Seasons', listed(made, live([SEASON])), true],
    [
      'cancelled',
      'Cancelled',
      listed(all, (g) => !UNLISTED_TYPES.includes(type(g)) && g.game_status === CANCELLED_STATUS),
      true,
    ],
  ];
  return sections
    .map(([key, title, games, folded]) => ({ key, title, games, folded }))
    .filter((s) => s.games.length);
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
/** Other stores, in the order one is picked when there's no PlayStation Store link. */
const OTHER_STORES: [type: string, label: string][] = [
  ['Steam', 'Steam'],
  ['Xbox', 'Xbox Store'],
  ['Nintendo', 'Nintendo eShop'],
  ['Epic', 'Epic Games Store'],
  ['GOG', 'GOG'],
];

/**
 * The official website and the PlayStation Store. Without a PlayStation Store link, one other
 * store instead (Steam first).
 */
export function linksOf(details: GameDetails): { label: string; url: string }[] {
  const find = (type: string, label: string) => {
    const site = details.websites?.find(
      (w) => w.type?.type === type && w.url.startsWith('https://'),
    );
    return site ? { label, url: site.url } : null;
  };
  const official = find('Official Website', 'Official website');
  const store =
    find('Playstation', 'PlayStation Store') ??
    OTHER_STORES.map(([type, label]) => find(type, label)).find((link) => link !== null) ??
    null;
  return [official, store].filter((link) => link !== null);
}

export function buildDetailsQuery(id: number): string {
  return [
    `fields ${SYNC_FIELDS}, platforms.abbreviation, platforms.name, first_release_date,`,
    'artworks.image_id, screenshots.image_id,',
    'game_type, parent_game.name, parent_game.first_release_date, game_engines.name,',
    'dlcs.name, dlcs.cover.image_id, dlcs.first_release_date,',
    'expansions.name, expansions.cover.image_id, expansions.first_release_date,',
    'rating, rating_count,',
    'collections.name, collections.games.name, collections.games.game_type,',
    'collections.games.cover.image_id, collections.games.first_release_date,',
    'involved_companies.publisher, involved_companies.company.id, age_ratings.organization.name,',
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

  /** IGDB's events whose name has the term, newest first. */
  async searchEvents(term: string): Promise<EventSummary[]> {
    return this.eventSummaries(buildEventSearchQuery(term));
  }

  /** Developers and publishers whose name has the term, the best-known first. */
  async searchCompanies(term: string): Promise<CompanySummary[]> {
    const hits = await this.query<IgdbCompanyHit[]>('companies', buildCompanySearchQuery(term));
    return rankCompanies(term, hits);
  }

  async upcomingEvents(): Promise<EventSummary[]> {
    return this.eventSummaries(buildUpcomingEventsQuery(Date.now()));
  }

  /** The events a game was shown at. */
  async eventsOf(gameId: number): Promise<EventSummary[]> {
    return this.eventSummaries(buildGameEventsQuery(gameId));
  }

  async company(id: number): Promise<CompanyDetails | null> {
    const companies = await this.query<CompanyDetails[]>('companies', buildCompanyQuery(id));
    return companies[0] ?? null;
  }

  /** The games a company ported or supported. */
  async companyCredits(id: number): Promise<CompanyCredit[]> {
    return this.query<CompanyCredit[]>('involved_companies', buildCompanyCreditsQuery(id));
  }

  async event(id: number): Promise<EventDetails | null> {
    const events = await this.query<EventDetails[]>('events', buildEventQuery(id));
    return events[0] ?? null;
  }

  private async eventSummaries(query: string): Promise<EventSummary[]> {
    const events = await this.query<IgdbEvent[]>('events', query);
    return events.map(toEventSummary).filter((e) => e !== null);
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
