import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type FirestoreError,
} from 'firebase/firestore';
import { syncedFields, type IgdbSyncGame } from '../../../api/_lib/igdb-sync.js';
import {
  DEFAULT_SETTINGS,
  type Completion,
  statusLabel,
  type Status,
  type TrackedGame,
  type UserSettings,
} from '../../../api/_lib/models.js';
import { PLATFORMS, type PlatformKey } from '../../../api/_lib/platforms.js';
import { AuthService } from './auth.service';
import { db } from './db';
import { ToastService } from './toast.service';

/** The fields you edit on a game. */
export type GameEdits = Partial<
  Pick<
    TrackedGame,
    | 'completion'
    | 'hoursPlayed'
    | 'rating'
    | 'notes'
    | 'notify'
    | 'myPlatform'
    | 'pricePaid'
    | 'boughtFrom'
    | 'orderedOn'
  >
>;

/** Your games and settings, kept live from Firestore (and its on-device cache). */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  // null while the first snapshot is loading.
  private readonly gamesState = signal<TrackedGame[] | null>(null);
  private readonly settingsState = signal<UserSettings>(DEFAULT_SETTINGS);

  readonly games = computed(() => this.gamesState() ?? []);
  readonly loading = computed(() => this.gamesState() === null);
  readonly byId = computed(() => new Map(this.games().map((g) => [g.igdbId, g])));
  readonly settings = this.settingsState.asReadonly();
  readonly loadError = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const user = this.auth.user();
      this.gamesState.set(null);
      this.settingsState.set(DEFAULT_SETTINGS);
      this.loadError.set(null);
      if (!user) return;

      const stopGames = onSnapshot(
        collection(db, 'users', user.uid, 'games'),
        (snap) => this.gamesState.set(snap.docs.map((d) => d.data() as TrackedGame)),
        (error) => this.onLoadError(error),
      );
      const stopSettings = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => this.settingsState.set({ ...DEFAULT_SETTINGS, ...snap.data() }),
        (error) => this.onLoadError(error),
      );
      onCleanup(() => {
        stopGames();
        stopSettings();
      });
    });
  }

  /** Adds a game from IGDB. Platform defaults to your default one (PS5) if the game is on it. */
  add(game: IgdbSyncGame, status: Status, completion: Completion | null = null): void {
    const now = Date.now();
    const myPlatform = this.platformFor(game);
    const tracked: TrackedGame = {
      igdbId: game.id,
      ...syncedFields(game, myPlatform, now),
      status,
      completion,
      myPlatform,
      hoursPlayed: null,
      rating: null,
      notes: '',
      notify: false,
      addedAt: now,
      purchasedAt: null,
      startedAt: null,
      shelvedAt: null,
      completedAt: null,
      updatedAt: now,
      ...statusStamps({ status: 'wishlist' } as TrackedGame, status, now),
    };
    this.write(setDoc(this.gameDoc(game.id), tracked), `Added to ${statusLabel(status)}`);
  }

  /** For Completed, pass how far you got. */
  setStatus(game: TrackedGame, status: Status, completion?: Completion): void {
    if (game.status === status) return;
    const now = Date.now();
    this.write(
      updateDoc(this.gameDoc(game.igdbId), {
        status,
        ...(completion ? { completion } : {}),
        // A game you still want to buy isn't pre-ordered. Its price etc. are kept, in case
        // this was a mis-tap.
        ...(status === 'wishlist' && game.preordered ? { preordered: false } : {}),
        ...statusStamps(game, status, now),
        updatedAt: now,
      }),
    );
  }

  /**
   * Pre-ordering an upcoming game counts as buying it, so it moves from Wishlist to Backlog.
   * Undoing it moves it back and clears the details.
   */
  setPreordered(game: TrackedGame, preordered: boolean, today: string): void {
    const now = Date.now();
    const upcoming = !game.releaseDate || game.releaseDate > today;
    let status = game.status;
    if (preordered && status === 'wishlist') status = 'backlog';
    if (!preordered && status === 'backlog' && upcoming) status = 'wishlist';
    this.write(
      updateDoc(this.gameDoc(game.igdbId), {
        ...(preordered ? { preordered: true } : NOT_PREORDERED),
        ...(status !== game.status ? { status, ...statusStamps(game, status, now) } : {}),
        updatedAt: now,
      }),
    );
  }

  edit(game: TrackedGame, edits: GameEdits): void {
    this.write(updateDoc(this.gameDoc(game.igdbId), { ...edits, updatedAt: Date.now() }));
  }

  /** Changes your platform and re-picks the release date for it. */
  setPlatform(game: TrackedGame, details: IgdbSyncGame, myPlatform: PlatformKey): void {
    const now = Date.now();
    this.write(
      updateDoc(this.gameDoc(game.igdbId), {
        ...syncedFields(details, myPlatform, now),
        myPlatform,
        updatedAt: now,
      }),
    );
  }

  /** Refreshes the IGDB copy (name, cover, release date) when the game screen loads newer data. */
  refresh(game: TrackedGame, details: IgdbSyncGame): void {
    const fresh = syncedFields(details, game.myPlatform);
    const changed =
      fresh.name !== game.name ||
      fresh.coverId !== game.coverId ||
      fresh.releaseDate !== game.releaseDate ||
      fresh.releaseLabel !== game.releaseLabel;
    if (changed) this.write(updateDoc(this.gameDoc(game.igdbId), { ...fresh }));
  }

  remove(game: TrackedGame): void {
    this.write(deleteDoc(this.gameDoc(game.igdbId)), `Removed ${game.name}`);
  }

  saveSettings(patch: Partial<UserSettings>): void {
    this.write(setDoc(this.userDoc(), patch, { merge: true }));
  }

  /** The secret key in your calendar link, created the first time it's needed. */
  calendarKey(reset = false): string {
    const existing = this.settings().calendarKey;
    if (existing && !reset) return existing;
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const key = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    this.saveSettings({ calendarKey: key });
    this.settingsState.update((s) => ({ ...s, calendarKey: key }));
    return key;
  }

  private platformFor(game: IgdbSyncGame): PlatformKey {
    const on = new Set((game.platforms ?? []).map((p) => (typeof p === 'number' ? p : p.id)));
    const preferred = this.settings().defaultPlatform;
    if (!on.size || on.has(PLATFORMS.find((p) => p.key === preferred)!.igdbId)) return preferred;
    return PLATFORMS.find((p) => on.has(p.igdbId))?.key ?? preferred;
  }

  private uid(): string {
    const user = this.auth.user();
    if (!user) throw new Error('Not signed in');
    return user.uid;
  }

  private userDoc() {
    return doc(db, 'users', this.uid());
  }

  private gameDoc(id: number) {
    return doc(db, 'users', this.uid(), 'games', String(id));
  }

  // Firestore updates the on-device copy (and the screen) right away and syncs in the
  // background, so writes aren't awaited: offline, the promise only settles once back online.
  private write(pending: Promise<void>, success?: string): void {
    if (success) this.toast.show(success);
    pending.catch((error: FirestoreError) =>
      this.toast.error(
        error.code === 'permission-denied'
          ? "Couldn't save: the database refused it (are the Firestore rules published?)"
          : "Couldn't save your change. Try again.",
        error,
      ),
    );
  }

  private onLoadError(error: FirestoreError): void {
    console.error(error);
    this.loadError.set(
      error.code === 'permission-denied'
        ? 'The database refused access. Publish the Firestore rules (see PLAN.md).'
        : "Couldn't load your library.",
    );
    this.gamesState.update((games) => games ?? []);
  }
}

/** Dates stamped when a game moves to a new status. Earlier stamps are kept. */
const NOT_PREORDERED = { preordered: false, pricePaid: null, boughtFrom: null, orderedOn: null };

export function statusStamps(
  game: Pick<TrackedGame, 'status' | 'purchasedAt' | 'startedAt'>,
  status: Status,
  now: number,
): Partial<TrackedGame> {
  switch (status) {
    case 'backlog':
      return { purchasedAt: game.purchasedAt ?? now };
    case 'playing':
      return { purchasedAt: game.purchasedAt ?? now, startedAt: game.startedAt ?? now };
    case 'shelved':
      return { shelvedAt: now };
    case 'completed':
      return { completedAt: now, purchasedAt: game.purchasedAt ?? now };
    default:
      return {};
  }
}
