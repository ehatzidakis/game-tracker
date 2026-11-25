// What's new in the app, for the people using it: shown on the What's new screen, and the newest
// entry is sent as a notification by the hourly job once it's live (runAnnounce in jobs.ts).
//
// Add an entry, newest first, with any change people will notice; behind-the-scenes fixes don't
// need one (no entry, no notification). Give it a new id. Write for a player, not a developer:
// what they can now do and where to find it.

export interface ChangelogEntry {
  /** Unique and never reused: the hourly job announces each id once. */
  id: string;
  /** YYYY-MM-DD, the day it went live. */
  date: string;
  title: string;
  /** One line for the notification. */
  summary: string;
  items: readonly string[];
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: '2026-11-25-backgrounds',
    date: '2026-11-25',
    title: 'Game art and a louder background',
    summary: 'Put art from your games behind the app, or try the new Arcade colours.',
    items: [
      'Game art: put a picture from one of your games behind the app, then set how soft and how bright it is. Settings → Background → Game art.',
      'Arcade: a new grape-and-pink background colour. Settings → Background → Colour.',
      'What’s new: this list. You get a short note like this when something new arrives, and can turn it off in Settings.',
    ],
  },
  {
    id: '2026-11-23-android',
    date: '2026-11-23',
    title: 'Better on Android',
    summary: 'Smoother scrolling and tidier menus on Android, and a new Slate background.',
    items: [
      'Android: scrolling is smooth, sort and filter menus open as the app’s own sheet, and the top of each screen is no longer cut off.',
      'Android: “Add to Google Calendar” in Settings adds your release calendar.',
      'Slate, a cool blue-grey, replaces the Graphite background.',
    ],
  },
];

/** An entry older than this is never announced (say the record of what was sent were lost). */
const ANNOUNCE_WITHIN_DAYS = 7;

/** The entry to announce now: the newest one, if it's recent and hasn't been sent yet. */
export function announcementFor(
  changelog: readonly ChangelogEntry[],
  announcedId: string | null,
  now = Date.now(),
): ChangelogEntry | null {
  const latest = changelog[0];
  if (!latest || latest.id === announcedId) return null;
  const age = now - Date.parse(`${latest.date}T00:00:00Z`);
  return age >= 0 && age <= ANNOUNCE_WITHIN_DAYS * 86_400_000 ? latest : null;
}
