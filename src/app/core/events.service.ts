import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';
import type { GamingEvent } from '../../../api/_lib/models.js';
import { AuthService } from './auth.service';
import { db } from './db';
import { LibraryService } from './library.service';
import { ToastService } from './toast.service';

/** What you fill in for an event. */
export type EventFields = Pick<GamingEvent, 'title' | 'startsAt' | 'link' | 'kind' | 'archived'>;

/** Your gaming events, kept live from Firestore (users/{uid}/events). */
@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly auth = inject(AuthService);
  private readonly library = inject(LibraryService);
  private readonly toast = inject(ToastService);

  private readonly state = signal<GamingEvent[]>([]);

  /** Newest first. */
  readonly events = computed(() => [...this.state()].sort((a, b) => b.startsAt - a.startsAt));
  readonly byId = computed(() => new Map(this.state().map((e) => [e.id, e])));
  /** The ones you can still link a game to: not archived. */
  readonly available = computed(() => this.events().filter((e) => !e.archived));

  constructor() {
    effect((onCleanup) => {
      const user = this.auth.user();
      this.state.set([]);
      if (!user) return;
      const stop = onSnapshot(
        collection(db, 'users', user.uid, 'events'),
        (snap) => this.state.set(snap.docs.map((d) => d.data() as GamingEvent)),
        (error) => console.error(error),
      );
      onCleanup(stop);
    });
  }

  /** Saves a new event and returns it. */
  add(fields: EventFields): GamingEvent {
    const now = Date.now();
    const ref = doc(collection(db, 'users', this.uid(), 'events'));
    const event: GamingEvent = { id: ref.id, ...fields, createdAt: now, updatedAt: now };
    this.write(setDoc(ref, event), `Added ${event.title}`);
    return event;
  }

  update(event: GamingEvent, fields: Partial<EventFields>): void {
    this.write(updateDoc(this.eventDoc(event.id), { ...fields, updatedAt: Date.now() }));
  }

  /** Deletes the event and unlinks it from your games. */
  remove(event: GamingEvent): void {
    const batch = writeBatch(db);
    batch.delete(this.eventDoc(event.id));
    for (const game of this.library.games()) {
      const unlink = {
        ...(game.firstShownEventId === event.id ? { firstShownEventId: null } : {}),
        ...(game.dateAnnouncedEventId === event.id ? { dateAnnouncedEventId: null } : {}),
      };
      if (Object.keys(unlink).length) {
        batch.update(doc(db, 'users', this.uid(), 'games', String(game.igdbId)), unlink);
      }
    }
    this.write(batch.commit(), `Deleted ${event.title}`);
  }

  private uid(): string {
    const user = this.auth.user();
    if (!user) throw new Error('Not signed in');
    return user.uid;
  }

  private eventDoc(id: string) {
    return doc(db, 'users', this.uid(), 'events', id);
  }

  // Like the library: the screen updates right away, the write syncs in the background.
  private write(pending: Promise<void>, success?: string): void {
    if (success) this.toast.show(success);
    pending.catch((error: FirestoreError) =>
      this.toast.error("Couldn't save the event. Try again.", error),
    );
  }
}
