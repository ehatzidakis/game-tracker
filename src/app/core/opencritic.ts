import { inject, Injectable } from '@angular/core';
import type {
  OpenCriticCheck,
  OpenCriticScore,
  OwnScores,
} from '../../../api/_lib/opencritic-match.js';
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

/** What "Check OpenCritic now" says, under its button in Edit my data. */
export function describeCheck(check: OpenCriticCheck, now = Date.now()): string {
  if (check.score.status === 'found' && check.score.manual) {
    return 'This game uses the scores typed in above. Clear them to use OpenCritic’s again.';
  }
  // Asked just now (or within the last few minutes, which the server doesn't repeat).
  const fresh = check.checkedAt !== null && now - check.checkedAt < 15 * 60_000;
  if (!fresh) {
    if (!check.limit) return 'OpenCritic didn’t answer. Try again in a moment.';
    const hours = check.retryAt ? Math.ceil((check.retryAt - now) / 3_600_000) : null;
    const when =
      hours === null ? 'tomorrow' : hours <= 1 ? 'within the hour' : `in about ${hours} hours`;
    const last = check.checkedAt
      ? ` The score shown is from ${new Date(check.checkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`
      : '';
    return `Couldn’t check: today’s OpenCritic allowance is used up. It comes back ${when}.${last}`;
  }
  const score = check.score;
  if (score.status !== 'found') return 'Up to date: OpenCritic has no page for this game yet.';
  const critics = (n: number) => (n === 1 ? '1 critic' : `${n} critics`);
  if (score.topCriticScore === null) {
    return score.numReviews
      ? `Up to date: no score yet, ${critics(score.numReviews)} so far.`
      : 'Up to date: no reviews yet.';
  }
  const top = score.numTopCriticReviews;
  return `Up to date: ${score.topCriticScore}${score.tier ? ` (${score.tier})` : ''} from ${top === 1 ? '1 top critic' : `${top} top critics`}.`;
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
    this.remember(igdbId, score);
    return score;
  }

  /** "Check OpenCritic now": asks OpenCritic whatever the refresh schedule says. */
  async check(igdbId: number): Promise<OpenCriticCheck> {
    const res = await fetch(`/api/opencritic?igdb=${Math.trunc(igdbId)}&force=1`, {
      headers: { Authorization: `Bearer ${await this.auth.idToken()}` },
    });
    if (!res.ok) throw new Error(`OpenCritic request failed (${res.status})`);
    const check = (await res.json()) as OpenCriticCheck;
    this.remember(igdbId, check.score);
    return check;
  }

  /**
   * Scores typed in by hand in "Edit my data" for a game OpenCritic gets wrong (0–100, with how
   * many critics and users, or null); all null go back to OpenCritic's. Answers with the score the game shows now.
   */
  async setOwnScores(igdbId: number, own: OwnScores): Promise<OpenCriticScore> {
    const res = await fetch('/api/opencritic', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.auth.idToken()}`,
      },
      body: JSON.stringify({ igdb: Math.trunc(igdbId), ...own }),
    });
    if (!res.ok) throw new Error(`Saving the scores failed (${res.status})`);
    const score = (await res.json()) as OpenCriticScore;
    this.remember(igdbId, score);
    return score;
  }

  /** Only real answers are remembered; "can't ask right now" isn't worth showing later. */
  private remember(igdbId: number, score: OpenCriticScore): void {
    if (score.status === 'later') return;
    const pages = read<Record<string, OpenCriticScore>>(PAGES_KEY) ?? {};
    delete pages[igdbId];
    pages[igdbId] = score;
    const keys = Object.keys(pages);
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) delete pages[old];
    write(PAGES_KEY, pages);
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
