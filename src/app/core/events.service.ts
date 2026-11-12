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
import {
  igdbEventChanged,
  igdbEventDocId,
  igdbEventFields,
  type IgdbEvent,
} from '../../../api/_lib/igdb-events.js';
import type { GamingEvent } from '../../../api/_lib/models.js';
import { AuthService } from './auth.service';
import { db } from './db';
import { ToastService } from './toast.service';

/** What you fill in for an event. */
export type EventFields = Pick<
  GamingEvent,
  'title' | 'startsAt' | 'durationMinutes' | 'link' | 'kind' | 'archived'
>;

/** Your gaming events, kept live from Firestore (users/{uid}/events). */
@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly state = signal<GamingEvent[]>([]);

  /** Newest first. */
  readonly events = computed(() => [...this.state()].sort((a, b) => b.startsAt - a.startsAt));
  readonly byId = computed(() => new Map(this.state().map((e) => [e.id, e])));

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

  /**
   * Adds an event from IGDB, with its logo. Null (and a message) when IGDB has no time for it
   * yet. Adding it again just updates it.
   */
  addFromIgdb(igdbEvent: IgdbEvent): GamingEvent | null {
    const fields = igdbEventFields(igdbEvent);
    if (!fields) {
      this.toast.error("IGDB doesn't have a time for this event yet.");
      return null;
    }
    const now = Date.now();
    const id = igdbEventDocId(igdbEvent.id);
    const event: GamingEvent = { id, ...fields, archived: false, createdAt: now, updatedAt: now };
    this.write(setDoc(this.eventDoc(id), event), `Added ${event.title}`);
    return event;
  }

  /** Brings a stored IGDB event up to date (a time that moved, a new logo). */
  refreshFromIgdb(stored: GamingEvent, igdbEvent: IgdbEvent): void {
    const fields = igdbEventFields(igdbEvent);
    if (!fields || !igdbEventChanged(stored, fields)) return;
    this.write(updateDoc(this.eventDoc(stored.id), { ...fields, updatedAt: Date.now() }));
  }

  update(event: GamingEvent, fields: Partial<EventFields>): void {
    this.write(updateDoc(this.eventDoc(event.id), { ...fields, updatedAt: Date.now() }));
  }

  remove(event: GamingEvent): void {
    this.write(deleteDoc(this.eventDoc(event.id)), `Removed ${event.title}`);
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
