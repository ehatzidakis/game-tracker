import { inject, Injectable } from '@angular/core';
import type { OpenCriticScore } from '../../../api/_lib/opencritic-match.js';
import { AuthService } from './auth.service';

// The last answers are kept on the phone, so covers and game pages show their score the moment
// the app opens, while the server (slow to wake up) is asked for the latest in the background.
const SCORES_KEY = 'opencritic.scores.v1';
const PAGES_KEY = 'opencritic.pages.v1';
/** Game pages remembered, the most recently opened ones. */
const MAX_PAGES = 300;

function read<T>(key: string): T | null {
  try {
    const text = localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: just don't remember.
  }
}

/** OpenCritic scores, from our server (which keeps the RapidAPI key and the daily limits). */
@Injectable({ providedIn: 'root' })
export class OpenCriticService {
  private readonly auth = inject(AuthService);

  async score(igdbId: number): Promise<OpenCriticScore> {
    const res = await fetch(`/api/opencritic?igdb=${Math.trunc(igdbId)}`, {
      headers: { Authorization: `Bearer ${await this.auth.idToken()}` },
    });
    if (!res.ok) throw new Error(`OpenCritic request failed (${res.status})`);
    const score = (await res.json()) as OpenCriticScore;
    // Only real answers are remembered; "can't ask right now" isn't worth showing later.
    if (score.status !== 'later') {
      const pages = read<Record<string, OpenCriticScore>>(PAGES_KEY) ?? {};
      delete pages[igdbId];
      pages[igdbId] = score;
      const keys = Object.keys(pages);
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) delete pages[old];
      write(PAGES_KEY, pages);
    }
    return score;
  }

  /** The last answer for a game page on this phone, if there is one. */
  cachedScore(igdbId: number): OpenCriticScore | undefined {
    return read<Record<string, OpenCriticScore>>(PAGES_KEY)?.[igdbId];
  }

  /** The stored Top Critic Average of each of these games that has one, by IGDB id. */
  async scores(igdbIds: readonly number[]): Promise<Record<string, number>> {
    if (!igdbIds.length) return {};
    const res = await fetch('/api/opencritic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.auth.idToken()}`,
      },
      body: JSON.stringify({ ids: igdbIds.slice(0, 1000) }),
    });
    if (!res.ok) throw new Error(`OpenCritic scores request failed (${res.status})`);
    const scores = ((await res.json()) as { scores: Record<string, number> }).scores;
    write(SCORES_KEY, scores);
    return scores;
  }

  /** The Library's scores from the last time on this phone (empty the first time). */
  cachedScores(): Record<string, number> {
    return read<Record<string, number>>(SCORES_KEY) ?? {};
  }
}
