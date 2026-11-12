import {
  Component,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';
import { guessKind } from '../../../api/_lib/igdb-events.js';
import { EVENT_KINDS, type EventKind, type GamingEvent } from '../../../api/_lib/models.js';
import { readAnnouncedTime } from '../core/announced-time';
import { EventsService, type EventFields } from '../core/events.service';
import { EventIcon } from './event-icon';

export { guessKind };

interface EventRequest {
  /** Null for a new event. */
  event: GamingEvent | null;
  initial: EventFields;
  resolve: (event: GamingEvent | null) => void;
}

/** "YYYY-MM-DDTHH:mm" in your time zone, for a datetime-local field. */
export function dateTimeFieldValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A datetime-local field's value as ms, in your time zone. Null if it isn't a full date and time. */
export function fromDateTimeField(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const DAY_TIME = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "22:00", or "22:00–23:30" when the event has a duration. */
export function timeRange(event: Pick<GamingEvent, 'startsAt' | 'durationMinutes'>): string {
  const start = TIME.format(event.startsAt);
  if (!event.durationMinutes) return start;
  return `${start}–${TIME.format(event.startsAt + event.durationMinutes * 60_000)}`;
}

/** Minutes as the duration field's "H:MM" ("01:30"); empty for none. */
export function durationFieldValue(minutes: number | null | undefined): string {
  if (!minutes) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * The duration field ("01:30", from the iPhone's hours and minutes wheel) as minutes. Empty or
 * 0:00 → null. Over 9 hours, or anything else → undefined (invalid).
 */
export function fromDurationField(value: string): number | null | undefined {
  const text = value.trim();
  if (!text) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return undefined;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 9 || minutes > 59) return undefined;
  return hours * 60 + minutes || null;
}

/** Ok for a link: an http(s) address. "store.playstation.com" gets https:// added. */
export function cleanLink(text: string): string | null | undefined {
  const value = text.trim();
  if (!value) return null;
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('.') ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Creates and edits gaming events in a bottom sheet, saving them. */
@Injectable({ providedIn: 'root' })
export class EventSheet {
  private readonly events = inject(EventsService);
  readonly request = signal<EventRequest | null>(null);

  /** A new event; resolves to it once saved, or null if you cancel. */
  create(): Promise<GamingEvent | null> {
    const evening = new Date();
    evening.setHours(20, 0, 0, 0);
    return this.open(null, {
      title: '',
      startsAt: evening.getTime(),
      durationMinutes: null,
      link: null,
      kind: 'other',
      archived: false,
    });
  }

  edit(event: GamingEvent): Promise<GamingEvent | null> {
    return this.open(event, {
      title: event.title,
      startsAt: event.startsAt,
      durationMinutes: event.durationMinutes ?? null,
      link: event.link,
      kind: event.kind,
      archived: event.archived,
    });
  }

  save(fields: EventFields): void {
    const req = this.request();
    if (!req) return;
    if (req.event) {
      this.events.update(req.event, fields);
      this.finish({ ...req.event, ...fields });
    } else {
      this.finish(this.events.add(fields));
    }
  }

  delete(): void {
    const event = this.request()?.event;
    if (!event) return;
    this.events.remove(event);
    this.finish(null);
  }

  finish(event: GamingEvent | null): void {
    this.request()?.resolve(event);
    this.request.set(null);
  }

  private open(event: GamingEvent | null, initial: EventFields): Promise<GamingEvent | null> {
    this.request()?.resolve(null);
    return new Promise((resolve) => this.request.set({ event, initial, resolve }));
  }
}

/** Rendered once, in the shell. */
@Component({
  selector: 'app-event-sheet',
  imports: [EventIcon],
  template: `
    <dialog
      #dialog
      class="sheet m-0 mx-auto mt-auto w-full max-w-md bg-transparent p-0 text-label"
      aria-labelledby="event-sheet-title"
      (cancel)="$event.preventDefault(); sheet.finish(null)"
      (click)="onBackdropClick($event)"
    >
      @if (sheet.request(); as req) {
        <!-- novalidate: the fields are checked in onSubmit (a link without https:// is fine). -->
        <form
          novalidate
          class="px-2 pb-[max(env(safe-area-inset-bottom),8px)]"
          (submit)="onSubmit($event)"
        >
          <div class="grouped rounded-[14px]! bg-[rgb(44_44_46/0.94)]! backdrop-blur-xl">
            <h2
              id="event-sheet-title"
              class="px-4 pt-3.5 pb-3 text-center text-[13px] leading-[18px] font-semibold text-muted"
            >
              {{ req.event ? 'Edit gaming event' : 'New gaming event' }}
            </h2>
            <!-- 17px inputs: 16px or more stops iOS zooming in on focus. -->
            <label class="row">
              <span class="sr-only">Title</span>
              <input
                #title
                name="title"
                type="text"
                placeholder="Title, like State of Play"
                autocomplete="off"
                enterkeyhint="next"
                maxlength="80"
                class="min-w-0 flex-1 bg-transparent text-[17px] outline-none"
                [value]="req.initial.title"
                (input)="onTitle(title.value)"
              />
            </label>
            <!-- Paste the time as the announcement writes it; it's turned into your time. -->
            <div class="row flex-col items-stretch! gap-1! py-2.5!">
              <label for="event-announced" class="text-[13px] leading-[18px] text-muted">
                Time from the announcement
              </label>
              <input
                #announced
                id="event-announced"
                type="text"
                placeholder="Paste it, like June 9, 2pm PT / 5pm ET"
                autocomplete="off"
                enterkeyhint="done"
                class="min-w-0 bg-transparent text-[17px] outline-none"
                (input)="onAnnounced(announced.value, starts)"
              />
              @if (announcedNote(); as note) {
                <p
                  class="text-[13px] leading-[18px]"
                  [class]="note.ok ? 'text-accent-raised' : 'text-muted'"
                  aria-live="polite"
                >
                  {{ note.text }}
                </p>
              }
            </div>
            <label class="row">
              <span class="flex-1">Starts</span>
              <input
                #starts
                name="startsAt"
                type="datetime-local"
                required
                class="num rounded-[8px] bg-pressed px-2.5 py-1 text-[17px] outline-none scheme-dark"
                [value]="dateTimeFieldValue(req.initial.startsAt)"
              />
            </label>
            <!-- A time field so the iPhone opens its hours and minutes wheel; read as a length. -->
            <label class="row">
              <span class="flex-1">
                Duration
                <span class="block text-[13px] leading-[18px] text-muted"
                  >Hours and minutes, if known</span
                >
              </span>
              <input
                name="duration"
                type="time"
                class="num rounded-[8px] bg-pressed px-2.5 py-1 text-[17px] outline-none scheme-dark"
                [value]="durationFieldValue(req.initial.durationMinutes)"
              />
            </label>
            <div class="row flex-col items-start! gap-2! py-2.5!">
              <span id="event-kind-label" class="text-[13px] leading-[18px] text-muted"
                >Hosted by</span
              >
              <div
                class="flex flex-wrap gap-2"
                role="radiogroup"
                aria-labelledby="event-kind-label"
              >
                @for (k of kinds; track k.key) {
                  <button
                    type="button"
                    role="radio"
                    class="flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-[15px] active:opacity-60"
                    [class]="
                      kind() === k.key ? 'bg-accent-fill text-white' : 'bg-pressed text-label'
                    "
                    [attr.aria-checked]="kind() === k.key"
                    (click)="pickKind(k.key)"
                  >
                    <app-event-icon class="rounded-full!" [kind]="k.key" [size]="24" />
                    {{ k.label }}
                  </button>
                }
              </div>
            </div>
            <label class="row">
              <span class="shrink-0">Link</span>
              <input
                name="link"
                type="text"
                inputmode="url"
                placeholder="Optional"
                autocomplete="off"
                autocapitalize="off"
                class="min-w-0 flex-1 bg-transparent text-right text-[17px] outline-none"
                [value]="req.initial.link ?? ''"
              />
            </label>
            @if (req.event) {
              <div class="row">
                <div class="min-w-0 flex-1">
                  <p id="event-archived-label">Archived</p>
                  <p class="text-[13px] leading-[18px] text-muted">
                    Hidden from the Calendar and the Library. Still listed in Settings.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  class="switch"
                  aria-labelledby="event-archived-label"
                  [attr.aria-checked]="archived()"
                  (click)="archived.set(!archived())"
                >
                  <span></span>
                </button>
              </div>
            }
          </div>
          @if (error()) {
            <p class="px-4 pt-2 text-center text-[13px] text-[#ff6961]" role="alert">
              {{ error() }}
            </p>
          }
          @if (req.event) {
            <div class="grouped mt-2 rounded-[14px]! bg-[rgb(44_44_46/0.94)]! backdrop-blur-xl">
              <button
                type="button"
                class="row min-h-[50px]! justify-center text-[17px] text-danger"
                (click)="confirmDelete()"
              >
                {{ deleting() ? 'Tap again to delete' : 'Delete event' }}
              </button>
            </div>
          }
          <div class="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              class="grouped min-h-[57px] rounded-[14px]! bg-[rgb(44_44_46/0.94)]! text-[17px] text-accent-raised backdrop-blur-xl active:bg-pressed!"
              (click)="sheet.finish(null)"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="min-h-[57px] rounded-[14px] bg-accent-fill text-[17px] font-semibold text-white active:brightness-90"
            >
              Save
            </button>
          </div>
        </form>
      }
    </dialog>
  `,
  styles: `
    .sheet[open] {
      animation: sheet-up 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes sheet-up {
      from {
        transform: translateY(100%);
      }
    }
  `,
})
export class EventSheetOutlet {
  protected readonly sheet = inject(EventSheet);
  protected readonly kinds = EVENT_KINDS;
  protected readonly durationFieldValue = durationFieldValue;
  /** What the pasted announcement time came to, or why it couldn't be read. */
  protected readonly announcedNote = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly kind = signal<EventKind>('other');
  protected readonly archived = signal(false);
  protected readonly error = signal('');
  protected readonly deleting = signal(false);
  protected readonly dateTimeFieldValue = dateTimeFieldValue;
  /** Once you pick who's hosting, typing the title stops guessing it. */
  private kindPicked = false;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      const req = this.sheet.request();
      if (req && !el.open) {
        this.kind.set(req.initial.kind);
        this.announcedNote.set(null);
        this.archived.set(req.initial.archived);
        this.error.set('');
        this.deleting.set(false);
        this.kindPicked = !!req.event;
        el.showModal();
      }
      if (!req && el.open) el.close();
    });
  }

  /** Reads the pasted time and puts it in Starts, in your time. */
  protected onAnnounced(text: string, starts: HTMLInputElement): void {
    if (!text.trim()) return this.announcedNote.set(null);
    const fallbackDay = starts.value.slice(0, 10);
    const read = readAnnouncedTime(text, fallbackDay);
    if (!read) {
      return this.announcedNote.set({
        ok: false,
        text: 'No time in that yet. Include the time and its zone, like 6pm BST.',
      });
    }
    starts.value = dateTimeFieldValue(read.startsAt);
    const when = DAY_TIME.format(read.startsAt).replace(',', '');
    this.announcedNote.set({
      ok: true,
      text: read.dateFound
        ? `${read.read} is ${when} your time.`
        : `${read.read} is ${when} your time (no date in it, so the day in Starts was used).`,
    });
  }

  protected onTitle(title: string): void {
    if (this.kindPicked) return;
    this.kind.set(guessKind(title) ?? 'other');
  }

  protected pickKind(kind: EventKind): void {
    this.kindPicked = true;
    this.kind.set(kind);
  }

  protected confirmDelete(): void {
    if (this.deleting()) this.sheet.delete();
    else this.deleting.set(true);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const field = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
    const title = field('title').trim().slice(0, 80);
    if (!title) return this.error.set('Give the event a title.');
    const startsAt = fromDateTimeField(field('startsAt'));
    if (startsAt === null) return this.error.set('Pick a date and time.');
    const durationMinutes = fromDurationField(field('duration'));
    if (durationMinutes === undefined) {
      return this.error.set('Duration goes up to 9 hours and 59 minutes.');
    }
    const link = cleanLink(field('link'));
    if (link === undefined) return this.error.set('The link should be a web address.');
    this.sheet.save({
      title,
      startsAt,
      durationMinutes,
      link,
      kind: this.kind(),
      archived: this.archived(),
    });
  }

  // Tapping the dimmed area outside the sheet closes it without saving.
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.sheet.finish(null);
  }
}
