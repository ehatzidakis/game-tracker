import { describe, expect, it } from 'vitest';
import type { TrackedGame } from '../../../../api/_lib/models.js';
import { playingGames, psnPlaytime, shownGame, trophySummary } from './now-playing';

const game = (igdbId: number, name: string, extra: Partial<TrackedGame> = {}) =>
  ({ igdbId, name, status: 'backlog', playing: true, ...extra }) as TrackedGame;
const played = (at: number) => ({ playstation: { lastPlayedAt: at } }) as Partial<TrackedGame>;

describe('Now playing', () => {
  it('lists the Playing games, the most recently played first, then A–Z', () => {
    const games = [
      game(1, 'Zelda'),
      game(2, 'Astro Bot', played(100)),
      game(3, 'Balatro'),
      game(4, 'Not playing', { playing: false }),
      game(5, 'Done', { status: 'completed' }),
      game(6, 'Hades', played(200)),
    ];
    expect(playingGames(games).map((g) => g.name)).toEqual(['Hades', 'Astro Bot', 'Balatro', 'Zelda']);
  });

  it('shows the picked game while it is still Playing, else the first', () => {
    const games = [game(1, 'A'), game(2, 'B')];
    expect(shownGame(games, 2)?.name).toBe('B');
    expect(shownGame(games, 9)?.name).toBe('A');
    expect(shownGame(games, null)?.name).toBe('A');
    expect(shownGame([], 2)).toBeNull();
  });

  it('sums the trophies and formats PlayStation playtime', () => {
    const g = game(1, 'A', {
      playstation: {
        playSeconds: 34 * 3600 + 21 * 60,
        trophies: {
          earned: { bronze: 30, silver: 6, gold: 2, platinum: 0 },
          defined: { bronze: 40, silver: 8, gold: 2, platinum: 1 },
          progress: 74,
        },
      },
    } as Partial<TrackedGame>);
    expect(trophySummary(g)).toEqual({ earned: 38, of: 51, progress: 74 });
    expect(psnPlaytime(g)).toBe('34h 21m');
    expect(trophySummary(game(2, 'B'))).toBeNull();
    expect(psnPlaytime(game(2, 'B'))).toBe('');
  });
});
