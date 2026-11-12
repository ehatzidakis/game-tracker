// Builds the calendar feed (iCalendar, RFC 5545) for /api/calendar.ics. No dependencies.
import { eventEnd, type GamingEvent, type TrackedGame } from './models.js';
import { platformLabel } from './platforms.js';
import { addDays } from './release.js';

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// Lines longer than 75 bytes are folded: CRLF plus a space, without splitting a character.
function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = '';
  for (const char of line) {
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (bytes.encode(current + char).length > limit) {
      out.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.join('\r\n ');
}

const compact = (date: string) => date.replace(/-/g, '');

function stamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * One all-day event per game with an exact release day. Vague dates ("Q3 2027") are left out
 * until IGDB has a real day; the daily refresh then adds them. Gaming events go in at their
 * time (in UTC, so calendar apps show them in your own time zone), archived ones included.
 */
export function buildCalendar(
  games: readonly TrackedGame[],
  appUrl: string,
  now = Date.now(),
  events: readonly GamingEvent[] = [],
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Game Tracker//Releases//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Game releases',
    'X-WR-TIMEZONE:Europe/Athens',
    // Ask calendar apps to check for changes every 6 hours (most decide for themselves).
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];

  const dated = games
    .filter((g) => g.releasePrecision === 'day' && g.releaseDate && g.status !== 'completed')
    .sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!));

  for (const game of dated) {
    const details = [platformLabel(game.myPlatform), game.developer].filter(Boolean).join(' · ');
    lines.push(
      'BEGIN:VEVENT',
      `UID:game-${game.igdbId}@game-tracker`,
      `DTSTAMP:${stamp(now)}`,
      `LAST-MODIFIED:${stamp(game.igdbSyncedAt || now)}`,
      `DTSTART;VALUE=DATE:${compact(game.releaseDate!)}`,
      `DTEND;VALUE=DATE:${compact(addDays(game.releaseDate!, 1))}`,
      `SUMMARY:${escapeText(`🎮 ${game.name}`)}`,
      `DESCRIPTION:${escapeText(details)}`,
      `URL:${appUrl}/game/${game.igdbId}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }

  for (const event of [...events].sort((a, b) => a.startsAt - b.startsAt)) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:event-${event.id}@game-tracker`,
      `DTSTAMP:${stamp(now)}`,
      `LAST-MODIFIED:${stamp(event.updatedAt || now)}`,
      `DTSTART:${stamp(event.startsAt)}`,
      `DTEND:${stamp(eventEnd(event))}`,
      `SUMMARY:${escapeText(`📣 ${event.title}`)}`,
      ...(event.link ? [`DESCRIPTION:${escapeText(event.link)}`, `URL:${event.link}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
