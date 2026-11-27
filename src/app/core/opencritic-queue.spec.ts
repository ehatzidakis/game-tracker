import type { Firestore } from 'firebase-admin/firestore';
import {
  buildQueue,
  lowOn,
  queueExpired,
  QUEUE_HORIZON_MS,
  type OpenCriticEntry,
  type OpenCriticQueue,
} from '../../../api/_lib/opencritic-match.js';
import { remaining, runOpenCriticRefresh } from '../../../api/_lib/opencritic.js';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const now = Date.parse('2026-11-27T12:00:00Z');

const entry = (igdbId: number, fields: Partial<OpenCriticEntry> = {}): OpenCriticEntry => ({
  igdbId,
  ocId: igdbId + 1000,
  name: `Game ${igdbId}`,
  url: null,
  tier: null,
  topCriticScore: 80,
  percentRecommended: 90,
  numReviews: 10,
  numTopCriticReviews: 5,
  releaseDate: '2020-01-01',
  checkedAt: now - 100 * DAY,
  ...fields,
});

describe('OpenCritic queue', () => {
  it('lists matched games due by the next build, those around release first', () => {
    const rank = new Map([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ]);
    const stored = new Map([
      // Old game, long overdue (90-day refresh).
      [1, entry(1)],
      // Out last week: daily refresh, due in 5 hours.
      [2, entry(2, { releaseDate: '2026-11-20', checkedAt: now - 17 * HOUR })],
      // Checked yesterday, not due for months.
      [3, entry(3, { checkedAt: now - DAY })],
      // Typed in by hand: never.
      [4, entry(4, { manual: true })],
    ]);
    const queue = buildQueue(rank, stored, now);
    expect(queue.builtAt).toBe(now);
    expect(queue.refreshes.map((g) => g.id)).toEqual([2, 1]);
    expect(queue.refreshes[0].dueAt).toBe(now + 5 * HOUR);
    expect(queue.searches).toEqual([]);
  });

  it('lists games never looked up as searches, Completed first and owned DLC last', () => {
    const rank = new Map([
      [10, 5],
      [11, 0],
      [12, 3],
    ]);
    const queue = buildQueue(rank, new Map(), now);
    expect(queue.searches).toEqual([
      { id: 11, dueAt: now },
      { id: 12, dueAt: now },
      { id: 10, dueAt: now },
    ]);
  });

  it('keeps games OpenCritic did not have as searches, when they are due again', () => {
    const stored = new Map([
      [5, entry(5, { ocId: null, releaseDate: '2026-11-20', checkedAt: now - 8 * DAY })],
    ]);
    expect(buildQueue(new Map([[5, 1]]), stored, now).searches.map((g) => g.id)).toEqual([5]);
  });

  it('is built again when a daily build was missed', () => {
    const queue: OpenCriticQueue = { builtAt: now, refreshes: [], searches: [] };
    expect(queueExpired(queue, now + 24 * HOUR)).toBe(false);
    expect(queueExpired(queue, now + QUEUE_HORIZON_MS + 1)).toBe(true);
  });

  it('knows when the allowance is used up, until it resets', () => {
    const allowance = { requests: 30, searches: 10, resetAt: now + HOUR };
    expect(lowOn(allowance, 'requests', 30, now)).toBe(true);
    expect(lowOn(allowance, 'searches', 5, now)).toBe(false);
    expect(lowOn(allowance, 'requests', 30, now + HOUR)).toBe(false);
    expect(lowOn({ requests: null, searches: null, resetAt: null }, 'requests', 30, now)).toBe(
      false,
    );
  });
});

/**
 * Just enough of Firestore (admin) for the OpenCritic job, counting document reads the way
 * Firestore bills them (a query that finds nothing still costs one).
 */
function fakeDb(docs: Record<string, object>) {
  const data = new Map(Object.entries(docs).map(([path, value]) => [path, structuredClone(value)]));
  const stats = { reads: 0, libraryReads: 0 };
  const snap = (path: string) => {
    const value = data.get(path);
    return {
      id: path.split('/').pop()!,
      exists: value !== undefined,
      data: () => (value === undefined ? undefined : structuredClone(value)),
    };
  };
  const docRef = (path: string): unknown => ({
    id: path.split('/').pop(),
    path,
    get: async () => {
      stats.reads++;
      return snap(path);
    },
    set: async (value: object) => {
      data.set(path, structuredClone(value));
    },
    collection: (name: string) => collectionRef(`${path}/${name}`),
  });
  const collectionRef = (path: string) => ({
    doc: (id: string) => docRef(`${path}/${id}`),
    get: async () => {
      const paths = [...data.keys()].filter(
        (p) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'),
      );
      stats.reads += Math.max(1, paths.length);
      if (path.endsWith('/games')) stats.libraryReads += paths.length;
      return { docs: paths.map(snap) };
    },
    listDocuments: async () => {
      const ids = new Set(
        [...data.keys()]
          .filter((p) => p.startsWith(`${path}/`))
          .map((p) => p.slice(path.length + 1).split('/')[0]),
      );
      return [...ids].map((id) => docRef(`${path}/${id}`));
    },
  });
  const db = {
    collection: collectionRef,
    getAll: async (...refs: { path: string }[]) => {
      stats.reads += refs.length;
      return refs.map((ref) => snap(ref.path));
    },
  };
  return { db: db as unknown as Firestore, data, stats };
}

/** Three users with 20 games each, none looked up on OpenCritic yet. */
function libraries(): Record<string, object> {
  const docs: Record<string, object> = {};
  for (const user of ['ann', 'bob', 'cat']) {
    for (let id = 1; id <= 20; id++) docs[`users/${user}/games/${id}`] = { status: 'backlog' };
  }
  return docs;
}

const usedUp = { requests: 10, searches: 0, resetAt: now + 6 * HOUR };

describe('OpenCritic refresh job', () => {
  beforeEach(() => {
    Object.assign(remaining, { requests: null, searches: null, resetAt: null });
    // No key: any OpenCritic call stops the run as if the allowance were used up.
    vi.stubEnv('RAPIDAPI_KEY', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('no network in tests');
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reads nothing but the saved allowance when it is used up', async () => {
    const { db, stats } = fakeDb({ ...libraries(), 'meta/opencriticQuota': usedUp });
    const result = await runOpenCriticRefresh(db, now, 50);
    expect(result).toMatchObject({ skipped: 'allowance used up' });
    expect(stats.reads).toBe(1);
    expect(stats.libraryReads).toBe(0);
  });

  it("works from the day's queue without reading any library", async () => {
    const queue: OpenCriticQueue = {
      builtAt: now - 3 * HOUR,
      refreshes: [{ id: 7, dueAt: now + 2 * HOUR }],
      searches: [],
    };
    const { db, stats } = fakeDb({ ...libraries(), 'meta/opencriticQueue': queue });
    const result = await runOpenCriticRefresh(db, now, 50);
    expect(result).toMatchObject({ built: false, refreshed: 0, waiting: 0 });
    // The saved allowance (none saved yet) and the queue: nothing else.
    expect(stats.reads).toBe(2);
    expect(stats.libraryReads).toBe(0);
  });

  it('builds the queue when there is none yet', async () => {
    const { db, data, stats } = fakeDb(libraries());
    const result = await runOpenCriticRefresh(db, now, 50);
    expect(result).toMatchObject({ built: true });
    expect(stats.libraryReads).toBe(60);
    const queue = data.get('meta/opencriticQueue') as OpenCriticQueue;
    // 20 different games across the three libraries, none looked up yet.
    expect(queue.searches.map((g) => g.id).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it('builds the queue again when the daily build was missed', async () => {
    const stale: OpenCriticQueue = { builtAt: now - 2 * DAY, refreshes: [], searches: [] };
    const { db, data } = fakeDb({ ...libraries(), 'meta/opencriticQueue': stale });
    expect(await runOpenCriticRefresh(db, now, 50)).toMatchObject({ built: true });
    expect((data.get('meta/opencriticQueue') as OpenCriticQueue).builtAt).toBe(now);
  });

  it('builds the queue in the daily run even with the allowance used up', async () => {
    const { db, data, stats } = fakeDb({ ...libraries(), 'meta/opencriticQuota': usedUp });
    const result = await runOpenCriticRefresh(db, now, 100, { rebuild: true });
    expect(result).toMatchObject({ built: true, refreshed: 0 });
    expect(stats.libraryReads).toBe(60);
    expect((data.get('meta/opencriticQueue') as OpenCriticQueue).searches).toHaveLength(20);
  });

  it('refreshes due games and takes them off the queue', async () => {
    vi.stubEnv('RAPIDAPI_KEY', 'test-key');
    const fetch = vi.fn(async (url: string) => {
      const ocId = Number(url.split('/').pop());
      return new Response(
        JSON.stringify({ id: ocId, name: `Game ${ocId - 1000}`, topCriticScore: 91 }),
        { headers: { 'x-ratelimit-requests-remaining': '150' } },
      );
    });
    vi.stubGlobal('fetch', fetch);
    const queue: OpenCriticQueue = {
      builtAt: now - HOUR,
      refreshes: [
        { id: 1, dueAt: now - DAY },
        // Refreshed on its game page since the queue was built: no call.
        { id: 2, dueAt: now - DAY },
        // Not due yet: stays.
        { id: 3, dueAt: now + HOUR },
      ],
      searches: [],
    };
    const { db, data } = fakeDb({
      'meta/opencriticQueue': queue,
      'opencritic/1': entry(1),
      'opencritic/2': entry(2, { checkedAt: now - HOUR }),
      'opencritic/3': entry(3),
    });
    const result = await runOpenCriticRefresh(db, now, 50);
    expect(result).toMatchObject({ refreshed: 1, waiting: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((data.get('opencritic/1') as OpenCriticEntry).topCriticScore).toBe(91);
    expect((data.get('meta/opencriticQueue') as OpenCriticQueue).refreshes).toEqual([
      { id: 3, dueAt: now + HOUR },
    ]);
  });

  it('keeps a game on the queue when the allowance runs out on it', async () => {
    const queue: OpenCriticQueue = {
      builtAt: now - HOUR,
      refreshes: [{ id: 1, dueAt: now - DAY }],
      searches: [],
    };
    const { db, data } = fakeDb({ 'meta/opencriticQueue': queue, 'opencritic/1': entry(1) });
    await runOpenCriticRefresh(db, now, 50);
    expect((data.get('meta/opencriticQueue') as OpenCriticQueue).refreshes).toEqual(
      queue.refreshes,
    );
  });
});
