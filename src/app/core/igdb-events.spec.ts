import {
  eventLink,
  igdbEventChanged,
  igdbEventDocId,
  igdbEventFields,
  igdbIdOf,
  type IgdbEvent,
} from '../../../api/_lib/igdb-events.js';
import { eventEnd, type GamingEvent } from '../../../api/_lib/models.js';

const stateOfPlay: IgdbEvent = {
  id: 1170,
  name: 'State of Play: 2026-9-3',
  event_logo: { image_id: 'el169' },
  start_time: 1_788_440_400,
  end_time: 1_788_447_600,
  live_stream_url: 'https://www.youtube.com/watch?v=dcTYz_mJpkU',
  event_networks: [
    { url: 'https://blog.playstation.com', network_type: { name: 'Official website' } },
  ],
};

describe('IGDB events', () => {
  it('turns an IGDB event into what is stored in your calendar', () => {
    expect(igdbEventFields(stateOfPlay)).toEqual({
      title: 'State of Play: 2026-9-3',
      startsAt: 1_788_440_400_000,
      durationMinutes: 120,
      link: 'https://www.youtube.com/watch?v=dcTYz_mJpkU',
      kind: 'playstation',
      igdbId: 1170,
      logoId: 'el169',
    });
  });

  it('has no duration without an end, and nothing to store without a start', () => {
    expect(igdbEventFields({ ...stateOfPlay, end_time: undefined })?.durationMinutes).toBeNull();
    expect(igdbEventFields({ id: 1, name: 'Some Fest' })).toBeNull();
  });

  it('links the stream, or else the official website, and only https', () => {
    expect(eventLink({ ...stateOfPlay, live_stream_url: undefined })).toBe(
      'https://blog.playstation.com',
    );
    expect(eventLink({ id: 1, name: 'x', live_stream_url: 'http://insecure.example' })).toBeNull();
  });

  it('stores an IGDB event under an id that says so', () => {
    expect(igdbEventDocId(1170)).toBe('igdb-1170');
    expect(igdbIdOf('igdb-1170')).toBe(1170);
    expect(igdbIdOf('Hk3jd82jdkQ01')).toBeNull();
  });

  it('notices when IGDB moved an event', () => {
    const fields = igdbEventFields(stateOfPlay)!;
    const stored = { id: 'igdb-1170', ...fields, archived: false, createdAt: 0, updatedAt: 0 };
    expect(igdbEventChanged(stored as GamingEvent, fields)).toBe(false);
    expect(
      igdbEventChanged(stored as GamingEvent, { ...fields, startsAt: fields.startsAt + 1 }),
    ).toBe(true);
  });

  it('counts an event without a duration as an hour long', () => {
    expect(eventEnd({ startsAt: 1000, durationMinutes: null })).toBe(1000 + 3_600_000);
    expect(eventEnd({ startsAt: 1000, durationMinutes: 30 })).toBe(1000 + 1_800_000);
  });
});
