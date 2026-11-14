// IGDB's gaming events (State of Play, The Game Awards…): what we ask for, and what's kept when
// you add one to your calendar. Used by the app and by the daily job, so both store the same.
import type { EventKind, GamingEvent } from './models.js';

/** An event as IGDB returns it with EVENT_FIELDS. */
export interface IgdbEvent {
  id: number;
  name: string;
  description?: string;
  event_logo?: { image_id: string };
  /** Unix seconds. */
  start_time?: number;
  end_time?: number;
  live_stream_url?: string;
  event_networks?: { url: string; network_type?: { name: string } }[];
  /** When IGDB listed it (unix seconds). */
  created_at?: number;
}

export const EVENT_FIELDS = [
  'name',
  'description',
  'event_logo.image_id',
  'start_time',
  'end_time',
  'live_stream_url',
  'event_networks.url',
  'event_networks.network_type.name',
  'created_at',
].join(', ');

/** Who's likely holding an event, from its title. Null when it doesn't say. */
export function guessKind(title: string): EventKind | null {
  const t = title.toLowerCase();
  if (/state of play|playstation|sony/.test(t)) return 'playstation';
  if (/xbox|microsoft|bethesda/.test(t)) return 'xbox';
  if (/nintendo|direct/.test(t)) return 'nintendo';
  if (/game awards|summer game fest|gamescom|opening night|showcase|keighley/.test(t)) {
    return 'showcase';
  }
  return null;
}

/** The id an IGDB event is stored under, so adding it twice gives one event. */
export function igdbEventDocId(igdbId: number): string {
  return `igdb-${Math.trunc(igdbId)}`;
}

/** The IGDB id in a stored event's id ("igdb-1170" → 1170), or null for one you made yourself. */
export function igdbIdOf(docId: string): number | null {
  const m = /^igdb-(\d+)$/.exec(docId);
  return m ? Number(m[1]) : null;
}

const https = (url: string | undefined) => (url?.startsWith('https://') ? url : null);

/** The stream if there is one, otherwise the event's official website. */
export function eventLink(event: IgdbEvent): string | null {
  const official = event.event_networks?.find((n) => n.network_type?.name === 'Official website');
  return https(event.live_stream_url) ?? https(official?.url);
}

export type IgdbEventFields = Pick<
  GamingEvent,
  'title' | 'startsAt' | 'durationMinutes' | 'link' | 'kind' | 'igdbId' | 'logoId'
>;

/** What's stored for an IGDB event. Null when IGDB has no start time for it yet. */
export function igdbEventFields(event: IgdbEvent): IgdbEventFields | null {
  if (!event.start_time) return null;
  const seconds = (event.end_time ?? 0) - event.start_time;
  return {
    title: event.name,
    startsAt: event.start_time * 1000,
    durationMinutes: seconds > 0 ? Math.round(seconds / 60) : null,
    link: eventLink(event),
    kind: guessKind(event.name) ?? 'other',
    igdbId: event.id,
    logoId: event.event_logo?.image_id ?? null,
  };
}

/** True when the stored event differs from what IGDB says now. */
export function igdbEventChanged(stored: GamingEvent, fresh: IgdbEventFields): boolean {
  return (
    stored.title !== fresh.title ||
    stored.startsAt !== fresh.startsAt ||
    (stored.durationMinutes ?? null) !== fresh.durationMinutes ||
    stored.link !== fresh.link ||
    stored.kind !== fresh.kind ||
    (stored.logoId ?? null) !== fresh.logoId
  );
}

/** The IGDB company behind an event, to show and link on its page. */
export interface EventCompany {
  id: number;
  name: string;
}

/**
 * Who holds an event, read from its name (IGDB doesn't record it): IGDB ids for the companies
 * that hold their own shows. First match wins, so "Xbox Games Showcase" is Xbox even with
 * "Bethesda" in it. Checked against IGDB on 2026-11-14.
 */
const EVENT_COMPANIES: readonly [RegExp, EventCompany][] = [
  [/state of play|playstation|\bsony\b/, { id: 10100, name: 'Sony Interactive Entertainment' }],
  [/xbox/, { id: 17966, name: 'Xbox Game Studios' }],
  [/nintendo/, { id: 70, name: 'Nintendo' }],
  [/ubisoft/, { id: 104, name: 'Ubisoft Entertainment' }],
  [/capcom/, { id: 37, name: 'Capcom' }],
  [/square enix/, { id: 26, name: 'Square Enix' }],
  [/bandai namco/, { id: 248, name: 'Bandai Namco Entertainment' }],
  [/devolver/, { id: 634, name: 'Devolver Digital' }],
  [/\bea play\b|electronic arts|\bea sports\b/, { id: 1, name: 'Electronic Arts' }],
  [/atlus/, { id: 818, name: 'Atlus' }],
  [/\bsega\b/, { id: 112, name: 'Sega' }],
  [/konami/, { id: 129, name: 'Konami' }],
  [/annapurna/, { id: 11662, name: 'Annapurna Interactive' }],
  [/bethesda/, { id: 16565, name: 'Bethesda Softworks' }],
  [/warner bros/, { id: 30651, name: 'Warner Bros. Games' }],
  [/koei tecmo/, { id: 858, name: 'Koei Tecmo Games' }],
  [/activision|call of duty/, { id: 66, name: 'Activision' }],
  [/blizz/, { id: 51, name: 'Blizzard Entertainment' }],
  [/\briot\b/, { id: 41, name: 'Riot Games' }],
  [/bungie|destiny/, { id: 620, name: 'Bungie' }],
  [/thq nordic/, { id: 10075, name: 'THQ Nordic' }],
  [/focus entertainment/, { id: 110, name: 'Focus Entertainment' }],
  [/\bnacon\b/, { id: 24760, name: 'Nacon' }],
  [/netease/, { id: 5501, name: 'NetEase Games' }],
];

/** When the name doesn't say: the host you picked, for the three platform holders. */
const COMPANY_OF_KIND: Partial<Record<EventKind, EventCompany>> = {
  playstation: EVENT_COMPANIES[0][1],
  xbox: EVENT_COMPANIES[1][1],
  nintendo: EVENT_COMPANIES[2][1],
};

/**
 * The company behind an event: from its name, else, for an event you made yourself, from the
 * host you picked (PlayStation, Xbox, Nintendo). An IGDB event's host is only guessed from its
 * name ("Wholesome Direct" reads as Nintendo), so it doesn't count. Null for showcases that
 * aren't a game company's (The Game Awards, Summer Game Fest…).
 */
export function eventCompany(
  event: Pick<GamingEvent, 'title' | 'kind' | 'igdbId'>,
): EventCompany | null {
  const t = event.title.toLowerCase();
  const named = EVENT_COMPANIES.find(([pattern]) => pattern.test(t))?.[1];
  if (named) return named;
  return event.igdbId ? null : (COMPANY_OF_KIND[event.kind] ?? null);
}
