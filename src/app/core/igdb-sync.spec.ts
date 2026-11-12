import { releaseMoved, syncUpdate, type SyncedFields } from '../../../api/_lib/igdb-sync.js';
import type { ReleaseChange, TrackedGame } from '../../../api/_lib/models.js';

const now = Date.parse('2026-11-12T11:00:00Z');

type Stored = Pick<
  TrackedGame,
  'releaseDate' | 'releasePrecision' | 'releaseLabel' | 'releaseHistory'
>;
const stored = (extra: Partial<Stored> = {}): Stored => ({
  releaseDate: '2026-05-26',
  releasePrecision: 'day',
  releaseLabel: '26 May 2026',
  ...extra,
});
const synced = (extra: Partial<SyncedFields> = {}): SyncedFields => ({
  name: 'Game',
  slug: null,
  coverId: null,
  genres: [],
  developer: null,
  platforms: [],
  releaseDate: '2026-11-19',
  releasePrecision: 'day',
  releaseLabel: '19 Nov 2026',
  igdbSyncedAt: now,
  ...extra,
});

describe('release date history', () => {
  it('saves the date a game had when IGDB moves it', () => {
    const update = syncUpdate(stored(), synced(), now);
    expect(update.releaseDate).toBe('2026-11-19');
    expect(update.releaseHistory).toEqual([
      { date: '2026-05-26', precision: 'day', label: '26 May 2026', changedAt: now },
    ]);
  });

  it('adds to the dates saved before, oldest first', () => {
    const earlier: ReleaseChange = {
      date: '2026-12-31',
      precision: 'year',
      label: '2026',
      changedAt: 1,
    };
    const update = syncUpdate(stored({ releaseHistory: [earlier] }), synced(), now);
    expect(update.releaseHistory?.map((c) => c.label)).toEqual(['2026', '26 May 2026']);
  });

  it('keeps the history as it is when only the name or cover changed', () => {
    const same = synced({
      name: 'New name',
      releaseDate: '2026-05-26',
      releaseLabel: '26 May 2026',
    });
    expect(releaseMoved(stored(), same)).toBe(false);
    expect(syncUpdate(stored(), same, now)).toBe(same);
  });

  it('saves nothing for a game that had no date yet', () => {
    const tba = stored({ releaseDate: null, releasePrecision: 'tbd', releaseLabel: 'TBA' });
    expect(releaseMoved(tba, synced())).toBe(true);
    expect(syncUpdate(tba, synced(), now).releaseHistory).toBeUndefined();
  });

  it('saves the date when a game goes back to TBA', () => {
    const update = syncUpdate(
      stored(),
      synced({ releaseDate: null, releasePrecision: 'tbd', releaseLabel: 'TBA' }),
      now,
    );
    expect(update.releaseHistory?.map((c) => c.label)).toEqual(['26 May 2026']);
  });

  it('keeps the latest 12 dates', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      date: '2026-01-01',
      precision: 'day' as const,
      label: `old ${i}`,
      changedAt: i,
    }));
    const history = syncUpdate(stored({ releaseHistory: many }), synced(), now).releaseHistory!;
    expect(history).toHaveLength(12);
    expect(history[0].label).toBe('old 1');
    expect(history.at(-1)?.label).toBe('26 May 2026');
  });
});
