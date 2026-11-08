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
}
