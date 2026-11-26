import { isDlc, statusLabel, type TrackedGame } from '../../../../api/_lib/models.js';
import { countdown } from '../../core/dates';
import type { DiscoverKind, GameSearchResult } from '../../core/igdb';

/** What Search shows before you type, on your default platform; each opens in full (search/:kind). */
export const DISCOVER: readonly { kind: DiscoverKind; title: string }[] = [
  { kind: 'anticipated', title: 'Most anticipated' },
  { kind: 'soon', title: 'Coming soon' },
  { kind: 'recent', title: 'Recently released' },
];

/** The games with each one only once, where it first comes (followers change between pages). */
export function uniqueGames(games: readonly GameSearchResult[]): GameSearchResult[] {
  const seen = new Set<number>();
  return games.filter((g) => !seen.has(g.id) && !!seen.add(g.id));
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "in 11 days", "19 Nov", or the year / TBA without a day. */
export function whenText(game: GameSearchResult): string {
  if (!game.releaseDate) return game.year ? String(game.year) : 'TBA';
  const left = countdown({ releaseDate: game.releaseDate, releasePrecision: 'day' });
  return left ?? SHORT_DATE.format(Date.parse(game.releaseDate));
}

/** What a game you have shows on its cover or instead of the + button. */
export function trackedLabel(game: TrackedGame): string {
  if (!isDlc(game) || game.status === 'wishlist') return statusLabel(game.status);
  return game.status === 'completed' ? 'Completed' : 'Owned';
}
