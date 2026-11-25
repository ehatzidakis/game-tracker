import { computed, Injectable, signal } from '@angular/core';
import { CHANGELOG } from '../../../api/_lib/changelog.js';

const SEEN_KEY = 'whats-new.seen';

/**
 * What's new (api/_lib/changelog.ts), and whether this phone has opened the newest entry yet:
 * until it has, Settings marks its What's new row New.
 */
@Injectable({ providedIn: 'root' })
export class WhatsNew {
  readonly entries = CHANGELOG;
  readonly latest = CHANGELOG[0] ?? null;
  private readonly seen = signal(readSeen());
  readonly unseen = computed(() => !!this.latest && this.seen() !== this.latest.id);

  markSeen(): void {
    if (!this.latest) return;
    this.seen.set(this.latest.id);
    try {
      localStorage.setItem(SEEN_KEY, this.latest.id);
    } catch {
      // Storage blocked: it shows as new again next time.
    }
  }
}

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

/** "25 November", with the year if it isn't this year's. */
export function changelogDate(date: string, now = new Date()): string {
  const day = new Date(`${date}T12:00:00`);
  return day.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    ...(day.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}
