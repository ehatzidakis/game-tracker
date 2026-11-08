// Reads the time from an event announcement ("Tuesday, June 9 at 10 a.m. PDT / 6 p.m. BST",
// "February 12, 2pm PT", "21:00 CET") and turns it into a moment, so it can be shown in your
// own time. 12-hour or 24-hour clocks, time zone codes, "UTC+2", and the US/UK zone names.

export interface AnnouncedTime {
  startsAt: number;
  /** The part that was read, like "10 a.m. PDT". */
  read: string;
  /** False when the text had no date and the fallback day was used. */
  dateFound: boolean;
}

/** Codes that already say summer or winter time: hours from UTC. */
const FIXED_OFFSETS: Record<string, number> = {
  pst: -8,
  pdt: -7,
  mst: -7,
  mdt: -6,
  cst: -6,
  cdt: -5,
  est: -5,
  edt: -4,
  akst: -9,
  akdt: -8,
  hst: -10,
  utc: 0,
  gmt: 0,
  z: 0,
  wet: 0,
  west: 1,
  bst: 1,
  cet: 1,
  cest: 2,
  eet: 2,
  eest: 3,
  msk: 3,
  sgt: 8,
  hkt: 8,
  awst: 8,
  jst: 9,
  kst: 9,
  aest: 10,
  aedt: 11,
  nzst: 12,
  nzdt: 13,
};

/** Names that don't say which half of the year: the zone works it out for the date. */
const ZONES: Record<string, string> = {
  pt: 'America/Los_Angeles',
  pacific: 'America/Los_Angeles',
  mt: 'America/Denver',
  mountain: 'America/Denver',
  ct: 'America/Chicago',
  central: 'America/Chicago',
  et: 'America/New_York',
  eastern: 'America/New_York',
  uk: 'Europe/London',
  london: 'Europe/London',
  cet: 'Europe/Paris',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  greece: 'Europe/Athens',
  greek: 'Europe/Athens',
  athens: 'Europe/Athens',
  jp: 'Asia/Tokyo',
  japan: 'Asia/Tokyo',
  tokyo: 'Asia/Tokyo',
};
// "CET" is often written all year (even in summer), so it follows Paris rather than +1.
delete FIXED_OFFSETS['cet'];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Minutes ahead of UTC in a zone at a moment. */
function zoneOffset(zone: string, ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
  );
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/** A clock time on a day in a zone (or at a fixed offset) as a moment. */
function toMoment(
  day: { y: number; m: number; d: number },
  hour: number,
  minute: number,
  zone: { offset: number } | { name: string },
): number {
  const wall = Date.UTC(day.y, day.m, day.d, hour, minute);
  if ('offset' in zone) return wall - zone.offset * 60_000;
  // Twice, so a guess on the wrong side of a summer-time change settles.
  let ms = wall - zoneOffset(zone.name, wall) * 60_000;
  ms = wall - zoneOffset(zone.name, ms) * 60_000;
  return ms;
}

/** "UTC+2", "GMT-7", "UTC +09:00", a code, or a zone name, right after a time. */
function readZone(
  after: string,
): { zone: { offset: number } | { name: string }; text: string } | null {
  const offset = /^[\s(]*(?:utc|gmt)\s*([+-−])\s*(\d{1,2})(?::?(\d{2}))?/i.exec(after);
  if (offset) {
    const sign = offset[1] === '+' ? 1 : -1;
    const minutes = Number(offset[2]) * 60 + Number(offset[3] ?? 0);
    return { zone: { offset: sign * minutes }, text: offset[0].replace(/^[\s(]+/, '') };
  }
  const word = /^[\s(]*([a-z]{1,7})(?:\s+time)?\b/i.exec(after);
  if (!word) return null;
  const key = word[1].toLowerCase();
  const text = word[0].replace(/^[\s(]+/, '');
  if (key in FIXED_OFFSETS) return { zone: { offset: FIXED_OFFSETS[key] * 60 }, text };
  if (key in ZONES) return { zone: { name: ZONES[key] }, text };
  return null;
}

interface FoundTime {
  hour: number;
  minute: number;
  text: string;
  zone: { offset: number } | { name: string } | null;
}

/** The first time with a time zone; otherwise the first clear time (2pm, 14:00). */
function findTime(text: string): FoundTime | null {
  const pattern =
    /\b(?:(noon|midday|midnight)|(\d{1,2})(?![\d/])(?:[:.](\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?)(?![\w])/gi;
  let fallback: FoundTime | null = null;
  for (const m of text.matchAll(pattern)) {
    const [whole, word, h, min, ampm] = m;
    let hour: number;
    let minute = 0;
    if (word) {
      hour = word.toLowerCase() === 'midnight' ? 0 : 12;
    } else {
      hour = Number(h);
      minute = Number(min ?? 0);
      if (ampm) {
        if (hour < 1 || hour > 12) continue;
        hour = (hour % 12) + (/p/i.test(ampm) ? 12 : 0);
      }
      if (hour > 23 || minute > 59) continue;
    }
    const after = text.slice(m.index! + whole.length);
    const zone = readZone(after);
    const clear = !!(word || min || ampm);
    if (!zone && !clear) continue;
    const found = {
      hour,
      minute,
      zone: zone?.zone ?? null,
      text: `${whole}${zone ? ` ${zone.text}` : ''}`.replace(/\s+/g, ' ').trim(),
    };
    if (zone) return found;
    fallback ??= found;
  }
  return fallback;
}

/** The date in the text, if there is one. A date without a year is the next one to come. */
function findDate(text: string, today: { y: number; m: number; d: number }) {
  const t = text.toLowerCase();
  const nextYear = (m: number, d: number) => {
    const passed = Date.UTC(today.y, m, d) < Date.UTC(today.y, today.m, today.d) - 86_400_000;
    return passed ? today.y + 1 : today.y;
  };
  const monthOf = (name: string) => MONTHS.indexOf(name.slice(0, 3));

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]) - 1, d: Number(iso[3]) };

  const monthDay = new RegExp(
    String.raw`\b${MONTH}\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?`,
  ).exec(t);
  if (monthDay) {
    const m = monthOf(monthDay[1]);
    const d = Number(monthDay[2]);
    return { y: monthDay[3] ? Number(monthDay[3]) : nextYear(m, d), m, d };
  }
  const dayMonth = new RegExp(
    String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}(?:,?\s+(\d{4}))?`,
  ).exec(t);
  if (dayMonth) {
    const m = monthOf(dayMonth[2]);
    const d = Number(dayMonth[1]);
    return { y: dayMonth[3] ? Number(dayMonth[3]) : nextYear(m, d), m, d };
  }

  const shift = (days: number) => {
    const date = new Date(Date.UTC(today.y, today.m, today.d + days));
    return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() };
  };
  if (/\btomorrow\b/.test(t)) return shift(1);
  if (/\b(today|tonight)\b/.test(t)) return shift(0);
  const weekday = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/.exec(t);
  if (weekday) {
    const now = new Date(Date.UTC(today.y, today.m, today.d)).getUTCDay();
    return shift((WEEKDAYS.indexOf(weekday[1]) - now + 7) % 7);
  }
  return null;
}

/**
 * Reads an announcement's date and time. Without a time zone the time is taken as yours.
 * Without a date, `fallbackDay` ("YYYY-MM-DD", in the announcement's zone) is used.
 * Null when there's no time in it.
 */
export function readAnnouncedTime(
  text: string,
  fallbackDay: string,
  now = Date.now(),
  yourZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): AnnouncedTime | null {
  const time = findTime(text);
  if (!time) return null;
  const zone = time.zone ?? { name: yourZone };

  // "Today" in the announcement's own zone.
  const local = new Date(
    now + ('offset' in zone ? zone.offset : zoneOffset(zone.name, now)) * 60_000,
  );
  const today = { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() };
  const found = findDate(text, today);
  const [fy, fm, fd] = fallbackDay.split('-').map(Number);
  const day = found ?? (fy ? { y: fy, m: fm - 1, d: fd } : today);

  return {
    startsAt: toMoment(day, time.hour, time.minute, zone),
    read: time.text,
    dateFound: !!found,
  };
}

/** "2026-06-09" for a moment in a zone (for the fallback day). */
export function dayIn(ms: number, zone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  const d = new Date(ms + zoneOffset(zone, ms) * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
