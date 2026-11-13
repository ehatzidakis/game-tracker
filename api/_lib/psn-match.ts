// Matching PlayStation games to library games. No network or database here, so it's easy to test.
// PlayStation lists each version you played (PS4, PS5) with a "concept" id that's the same for
// all versions of a game, and the same id the PlayStation Store uses. IGDB keeps that store id
// for many games ("Playstation Store US"), so most games match exactly; the rest match by name.

/** One played game as psn-api's getUserPlayedGames returns it (the parts we use). */
export interface PsnPlayedTitle {
  titleId: string;
  name: string;
  category: string;
  concept?: { id: number; name?: string };
  firstPlayedDateTime?: string;
  lastPlayedDateTime?: string;
  /** ISO 8601 duration: "PT228H56M33S". */
  playDuration?: string;
}

/** One trophy list as psn-api's getUserTitles returns it (the parts we use). */
export interface PsnTrophyTitle {
  npCommunicationId: string;
  trophyTitleName: string;
  trophyTitlePlatform: string;
}

/** A game on PlayStation: every version of one concept together. */
export interface PsnGame {
  conceptId: number;
  name: string;
  titleIds: string[];
  /** Played time over all versions, in seconds. */
  playSeconds: number;
  /** ms */
  firstPlayedAt: number | null;
  lastPlayedAt: number | null;
}

/** Media apps and mini apps (Spotify, YouTube…) aren't games. */
const NOT_GAMES = /media_app|nongame|web_based/;

/** "PT228H56M33S" → seconds. 0 for anything else. */
export function durationSeconds(iso: string | undefined): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso ?? '');
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Math.round(Number(m[3] ?? 0));
}

const time = (iso: string | undefined) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? null : ms;
};

/** Demos, trials and playtests, when PlayStation names them as such. */
const DEMO_NAME = /\b(demo|trial|playtest)\b/i;

/**
 * The played versions grouped per game (concept). A PS4 and a PS5 version add up. Demos and apps
 * are left out completely (no playtime, dates or ids from them): apps by their category, demos by
 * their name, or, as PlayStation usually gives a demo the game's own name and concept, as the
 * shorter of two versions on the same console.
 */
export function groupPlayed(titles: readonly PsnPlayedTitle[]): PsnGame[] {
  // Without a concept, the title id stands in (negative, so it can't clash with a real one).
  const conceptOf = (t: PsnPlayedTitle) => t.concept?.id ?? -Math.abs(hash(t.titleId));
  const byConcept = new Map<number, PsnPlayedTitle[]>();
  for (const t of titles) {
    if (NOT_GAMES.test(t.category) || DEMO_NAME.test(t.name)) continue;
    byConcept.set(conceptOf(t), [...(byConcept.get(conceptOf(t)) ?? []), t]);
  }
  return [...byConcept].map(([conceptId, versions]) => {
    // The longest-played version on each console.
    const perConsole = new Map<string, PsnPlayedTitle>();
    for (const t of versions) {
      const kept = perConsole.get(t.category);
      if (!kept || durationSeconds(t.playDuration) > durationSeconds(kept.playDuration)) {
        perConsole.set(t.category, t);
      }
    }
    const counted = [...perConsole.values()];
    const firsts = counted.map((t) => time(t.firstPlayedDateTime)).filter((t) => t !== null);
    const lasts = counted.map((t) => time(t.lastPlayedDateTime)).filter((t) => t !== null);
    return {
      conceptId,
      name: counted[0].concept?.name || counted[0].name,
      titleIds: [...new Set(counted.map((t) => t.titleId))],
      playSeconds: counted.reduce((sum, t) => sum + durationSeconds(t.playDuration), 0),
      firstPlayedAt: firsts.length ? Math.min(...firsts) : null,
      lastPlayedAt: lasts.length ? Math.max(...lasts) : null,
    };
  });
}

function hash(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h || 1;
}

const ROMAN: Record<string, string> = {
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
};

/**
 * For comparing names: lowercase, no accents, ™ or ®, no punctuation, roman numerals as digits,
 * and without the words stores and trophy lists add ("PS4 & PS5", "PS5 Edition", "Trophies").
 * "Warhammer 40,000: Space Marine II" and "Space Marine 2" both end in "space marine 2".
 */
export function comparableName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’™®©]/g, '')
    .replace(/\b(ps4|ps5)\s*(&|and)\s*(ps4|ps5)\b/g, ' ')
    .replace(/\b(for )?(ps4|ps5|playstation ?[45])( (edition|version))?\b/g, ' ')
    .replace(/\btrophies$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .map((word) => ROMAN[word] ?? word)
    .join(' ');
}

/** A game in the library, as much as matching needs. */
export interface LibraryEntry {
  igdbId: number;
  name: string;
  releaseDate: string | null;
}

/** How a PlayStation game was matched: IGDB's PlayStation Store id, the name, or by hand. */
export type MatchedBy = 'store' | 'name' | 'manual';

export interface PsnMatch {
  conceptId: number;
  /** The library game, or null when none matches. */
  igdbId: number | null;
  by: MatchedBy | null;
}

/** Finds library games by name; several share one when a remake has its original's name. */
function libraryByName(library: readonly LibraryEntry[]) {
  const byName = new Map<string, LibraryEntry[]>();
  for (const g of library) {
    const key = comparableName(g.name);
    byName.set(key, [...(byName.get(key) ?? []), g]);
  }
  /** The library game with this name; of several, the latest out by `day` ("YYYY-MM-DD"). */
  return (name: string, day = '9999'): LibraryEntry | null => {
    const named = byName.get(comparableName(name)) ?? [];
    const out = named
      .filter((g) => !g.releaseDate || g.releaseDate <= day)
      .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
    return out[0] ?? named[0] ?? null;
  };
}

const dayOf = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : '9999');

/**
 * Matches each PlayStation game to a library game: first by IGDB's PlayStation Store id
 * (`storeIds`: concept id → IGDB game ids), then by its name, then by the names of its trophy
 * lists (`listNames`: concept id → names; "The Last of Us Part II" has the list "The Last of Us
 * Part II Remastered", the game in the library). Of several library games with one name (a
 * remake and its original), the latest out before it was first played wins.
 * A match set by hand (`manual`: concept id → library game, or null for "none") always wins.
 */
export function matchToLibrary(
  games: readonly PsnGame[],
  storeIds: ReadonlyMap<number, readonly number[]>,
  library: readonly LibraryEntry[],
  listNames: ReadonlyMap<number, readonly string[]> = new Map(),
  manual: ReadonlyMap<number, number | null> = new Map(),
): PsnMatch[] {
  const inLibrary = new Set(library.map((g) => g.igdbId));
  const named = libraryByName(library);
  return games.map((game) => {
    if (manual.has(game.conceptId)) {
      const igdbId = manual.get(game.conceptId) ?? null;
      // A game removed from the library since: no match.
      return {
        conceptId: game.conceptId,
        igdbId: igdbId !== null && inLibrary.has(igdbId) ? igdbId : null,
        by: 'manual',
      };
    }
    const stored = (storeIds.get(game.conceptId) ?? []).find((id) => inLibrary.has(id));
    if (stored !== undefined) return { conceptId: game.conceptId, igdbId: stored, by: 'store' };
    for (const name of [game.name, ...(listNames.get(game.conceptId) ?? [])]) {
      const found = named(name, dayOf(game.firstPlayedAt));
      if (found) return { conceptId: game.conceptId, igdbId: found.igdbId, by: 'name' };
    }
    return { conceptId: game.conceptId, igdbId: null, by: null };
  });
}

/**
 * Which library game each trophy list belongs to: the game its PlayStation game was matched to
 * (`listConcepts`: list id → concept id), or else a library game with the list's name. This
 * also covers older PS4 games PlayStation has trophies for but no playtime.
 */
export function trophyListsForLibrary(
  lists: readonly PsnTrophyTitle[],
  listConcepts: ReadonlyMap<string, number>,
  matches: readonly PsnMatch[],
  library: readonly LibraryEntry[],
): Map<number, string[]> {
  const gameOf = new Map(
    matches.filter((m) => m.igdbId !== null).map((m) => [m.conceptId, m.igdbId!]),
  );
  const named = libraryByName(library);
  const byGame = new Map<number, string[]>();
  for (const list of lists) {
    // Its own name first: a collection ("Uncharted: The Nathan Drake Collection") has a list per
    // game, each for that game in the library.
    const concept = listConcepts.get(list.npCommunicationId);
    const igdbId =
      named(list.trophyTitleName)?.igdbId ??
      (concept !== undefined ? gameOf.get(concept) : undefined);
    if (igdbId === undefined) continue;
    byGame.set(igdbId, [...(byGame.get(igdbId) ?? []), list.npCommunicationId]);
  }
  return byGame;
}

/**
 * Which PlayStation game each trophy list belongs to (list id → concept id), by name. A game can
 * have two lists (PS4 and PS5). `byTitleId` adds what PlayStation said when asked by title id
 * (title id → list ids), which wins over the name.
 */
export function linkTrophyLists(
  games: readonly PsnGame[],
  lists: readonly PsnTrophyTitle[],
  byTitleId: ReadonlyMap<string, readonly string[]> = new Map(),
): Map<string, number> {
  const conceptByName = new Map<string, number>();
  for (const g of games) conceptByName.set(comparableName(g.name), g.conceptId);
  const links = new Map<string, number>();
  for (const list of lists) {
    const conceptId = conceptByName.get(comparableName(list.trophyTitleName));
    if (conceptId !== undefined) links.set(list.npCommunicationId, conceptId);
  }
  for (const game of games) {
    for (const titleId of game.titleIds) {
      for (const listId of byTitleId.get(titleId) ?? []) links.set(listId, game.conceptId);
    }
  }
  return links;
}

/**
 * The whole match for one library: each PlayStation game's library game, and each library
 * game's trophy lists.
 */
export function matchProfile(
  snapshot: {
    games: readonly PsnGame[];
    lists: readonly PsnTrophyTitle[];
    links: ReadonlyMap<string, number>;
    storeIds: ReadonlyMap<number, readonly number[]>;
  },
  library: readonly LibraryEntry[],
  manual: ReadonlyMap<number, number | null> = new Map(),
): { matches: PsnMatch[]; listsByGame: Map<number, string[]> } {
  const listNames = new Map<number, string[]>();
  for (const list of snapshot.lists) {
    const concept = snapshot.links.get(list.npCommunicationId);
    if (concept !== undefined) {
      listNames.set(concept, [...(listNames.get(concept) ?? []), list.trophyTitleName]);
    }
  }
  const matches = matchToLibrary(snapshot.games, snapshot.storeIds, library, listNames, manual);
  const listsByGame = trophyListsForLibrary(snapshot.lists, snapshot.links, matches, library);
  return { matches, listsByGame };
}

/**
 * The PlayStation games to ask about by title id: those no trophy list was linked to by name,
 * and those with more than one version (a PS5 remaster often has its own list, under its own
 * name: "The Last of Us Part II Remastered").
 */
export function gamesWithoutLists(
  games: readonly PsnGame[],
  links: ReadonlyMap<string, number>,
): PsnGame[] {
  const linked = new Set(links.values());
  return games.filter((g) => !linked.has(g.conceptId) || g.titleIds.length > 1);
}
