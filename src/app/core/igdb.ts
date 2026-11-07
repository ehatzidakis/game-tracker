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
  /** True if there's no release date yet or it's in the future. */
  upcoming: boolean;
  /** Our platforms first (PS5, Xbox, PC, Switch 2), then up to two others. */
  platforms: string[];
}

interface IgdbGame {
  id: number;
  name: string;
  cover?: { image_id: string };
  first_release_date?: number;
  platforms?: { id: number; abbreviation?: string; name: string }[];
}

// Main games, standalone expansions, remakes, remasters, expanded games and ports.
// Leaves out DLC, bundles, mods, episodes and updates.
const SEARCHABLE_GAME_TYPES = '(0,4,8,9,10,11)';

export function buildSearchQuery(term: string): string {
  const safe = term
    .trim()
    .slice(0, 100)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  return [
    `search "${safe}";`,
    'fields name, cover.image_id, first_release_date, platforms.abbreviation, platforms.name;',
    `where version_parent = null & game_type = ${SEARCHABLE_GAME_TYPES};`,
    'limit 20;',
  ].join(' ');
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
    upcoming: !game.first_release_date || game.first_release_date * 1000 > Date.now(),
  };
}

export type ImageSize = 'cover_small' | 'cover_big' | 'screenshot_med' | 'screenshot_big' | '720p' | '1080p';

export function coverUrl(imageId: string, size: ImageSize = 'cover_big'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

/** Everything the game screen shows, plus the fields copied into the library. */
export interface GameDetails extends IgdbSyncGame {
  summary?: string;
  first_release_date?: number;
  total_rating?: number;
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  videos?: { video_id: string; name?: string }[];
  platforms?: { id: number; abbreviation?: string; name: string }[];
}

export function buildDetailsQuery(id: number): string {
  return [
    `fields ${SYNC_FIELDS}, platforms.abbreviation, platforms.name, summary, first_release_date,`,
    'total_rating, artworks.image_id, screenshots.image_id, videos.video_id, videos.name;',
    `where id = ${Math.trunc(id)};`,
    'limit 1;',
  ].join(' ');
}

@Injectable({ providedIn: 'root' })
export class IgdbService {
  private readonly auth = inject(AuthService);

  async search(term: string): Promise<GameSearchResult[]> {
    const games = await this.query<IgdbGame[]>('games', buildSearchQuery(term));
    return games.map(toSearchResult);
  }

  async game(id: number): Promise<GameDetails | null> {
    const games = await this.query<GameDetails[]>('games', buildDetailsQuery(id));
    return games[0] ?? null;
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
