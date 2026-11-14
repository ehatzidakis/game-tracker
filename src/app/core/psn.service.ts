import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { collection, doc, onSnapshot, updateDoc, type FirestoreError } from 'firebase/firestore';
import type { PsnGameRecord, PsnLink, PsnSyncState } from '../../../api/_lib/models.js';
import { AuthService } from './auth.service';
import { db } from './db';
import { ToastService } from './toast.service';

/**
 * Your PlayStation account: linking it through our server (which holds the PlayStation sign-in),
 * and the games read from it (users/{uid}/psnGames, kept live). The link itself is saved on your
 * settings, so it shows through LibraryService.settings().
 */
@Injectable({ providedIn: 'root' })
export class PsnService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly state = signal<PsnGameRecord[]>([]);
  /** False until the list has been read once (so counts don't show 0 meanwhile). */
  readonly loaded = signal(false);
  /** Your PlayStation games, most played first. */
  readonly games = computed(() => [...this.state()].sort((a, b) => b.playSeconds - a.playSeconds));
  readonly matched = computed(() => this.games().filter((g) => g.igdbId !== null));
  readonly unmatched = computed(() => this.games().filter((g) => g.igdbId === null));

  constructor() {
    effect((onCleanup) => {
      const user = this.auth.user();
      this.state.set([]);
      this.loaded.set(false);
      if (!user) return;
      const stop = onSnapshot(
        collection(db, 'users', user.uid, 'psnGames'),
        (snap) => {
          this.state.set(snap.docs.map((d) => d.data() as PsnGameRecord));
          this.loaded.set(true);
        },
        (error) => console.error(error),
      );
      onCleanup(stop);
    });
  }

  /** Checks the Online ID with PlayStation and links it. Throws with a message to show. */
  async link(onlineId: string): Promise<PsnLink> {
    const res = await this.call('POST', { onlineId });
    const body = (await res.json().catch(() => ({}))) as PsnLink & { error?: string };
    if (!res.ok) throw new Error(body.error ?? 'PlayStation didn’t answer. Try again in a moment.');
    return body;
  }

  /** Runs the PlayStation sync now. Throws with a message to show when it fails. */
  async syncNow(): Promise<PsnSyncState> {
    const res = await fetch('/api/psn-sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.auth.idToken()}` },
    });
    const body = (await res.json().catch(() => ({}))) as PsnSyncState & { error?: string };
    if (!res.ok) throw new Error(body.error ?? 'PlayStation didn’t answer. Try again later.');
    return body;
  }

  async unlink(): Promise<void> {
    const res = await this.call('DELETE');
    if (!res.ok) throw new Error('Couldn’t disconnect. Try again in a moment.');
  }

  /** Says which library game a PlayStation game is (null: none). Kept on every later sync. */
  setMatch(game: PsnGameRecord, igdbId: number | null): void {
    const user = this.auth.user();
    if (!user) return;
    updateDoc(doc(db, 'users', user.uid, 'psnGames', String(game.conceptId)), {
      igdbId,
      matchedBy: 'manual',
    }).catch((error: FirestoreError) =>
      this.toast.error('Couldn’t save the match. Try again.', error),
    );
  }

  private async call(method: 'POST' | 'DELETE', body?: unknown): Promise<Response> {
    return fetch('/api/psn', {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.auth.idToken()}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}
