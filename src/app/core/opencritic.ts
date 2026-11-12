import { inject, Injectable } from '@angular/core';
import type { OpenCriticScore } from '../../../api/_lib/opencritic-match.js';
import { AuthService } from './auth.service';

/** OpenCritic scores, from our server (which keeps the RapidAPI key and the daily limits). */
@Injectable({ providedIn: 'root' })
export class OpenCriticService {
  private readonly auth = inject(AuthService);

  async score(igdbId: number): Promise<OpenCriticScore> {
    const res = await fetch(`/api/opencritic?igdb=${Math.trunc(igdbId)}`, {
      headers: { Authorization: `Bearer ${await this.auth.idToken()}` },
    });
    if (!res.ok) throw new Error(`OpenCritic request failed (${res.status})`);
    return res.json() as Promise<OpenCriticScore>;
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
    return ((await res.json()) as { scores: Record<string, number> }).scores;
  }
}
