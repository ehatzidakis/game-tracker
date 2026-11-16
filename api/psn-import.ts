// Adds PlayStation games to your library: POST /api/psn-import { games: [ImportChoice…] } with the
// Firebase ID token. Each becomes a library game (IGDB's details, your choices, dates from
// PlayStation; see psn-import.ts), matched to its PlayStation game for good, then the sync runs
// so playtime, trophies and Platinum dates arrive straight away. Games already in the library
// are left as they are. Answers { added, skipped, synced }.
import { z } from 'zod';
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import { igdbQuery } from './_lib/igdb-client.js';
import { SYNC_FIELDS, type IgdbSyncGame } from './_lib/igdb-sync.js';
import type { PsnGameRecord } from './_lib/models.js';
import { syncPsnUser } from './_lib/psn.js';
import { IMPORT_STATUSES, importedGame } from './_lib/psn-import.js';

const Choice = z.object({
  conceptId: z.number().int(),
  igdbId: z.number().int().positive(),
  status: z.enum(IMPORT_STATUSES),
  completion: z.enum(['main', 'main_sides', 'platinum']).nullable().optional(),
  rating: z.number().min(1).max(10).multipleOf(0.5).nullable().optional(),
  pricePaid: z.number().min(0).max(100_000).nullable().optional(),
  boughtFrom: z.string().trim().max(60).nullable().optional(),
  orderedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  physical: z.boolean().optional(),
});
const Body = z.object({ games: z.array(Choice).min(1).max(500) });

export async function POST(request: Request): Promise<Response> {
  const uid = await verifyUser(request);
  if (!uid) return json({ error: 'Not signed in' }, 401);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Those games can’t be added.' }, 400);

  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  if (!(await userRef.get()).data()?.['psn']) {
    return json({ error: 'Connect your PlayStation account first.' }, 400);
  }

  // Only PlayStation games you have, each IGDB game once, and none already in the library.
  const choices = parsed.data.games;
  const recordSnaps = await db.getAll(
    ...choices.map((c) => userRef.collection('psnGames').doc(String(c.conceptId))),
  );
  const records = new Map(
    recordSnaps.filter((s) => s.exists).map((s) => [Number(s.id), s.data() as PsnGameRecord]),
  );
  const gameSnaps = await db.getAll(
    ...choices.map((c) => userRef.collection('games').doc(String(c.igdbId))),
  );
  const inLibrary = new Set(gameSnaps.filter((s) => s.exists).map((s) => Number(s.id)));
  const seen = new Set<number>();
  const wanted = choices.filter(
    (c) =>
      records.has(c.conceptId) &&
      !inLibrary.has(c.igdbId) &&
      !seen.has(c.igdbId) &&
      !!seen.add(c.igdbId),
  );

  const igdb = new Map<number, IgdbSyncGame>();
  const ids = wanted.map((c) => c.igdbId);
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await igdbQuery<IgdbSyncGame[]>(
      'games',
      `fields ${SYNC_FIELDS}; where id = (${ids.slice(i, i + 500).join(',')}); limit 500;`,
    );
    for (const row of rows) igdb.set(row.id, row);
  }

  const now = Date.now();
  const adding = wanted.filter((c) => igdb.has(c.igdbId));
  // Two writes per game, 500 to a batch.
  for (let i = 0; i < adding.length; i += 200) {
    const batch = db.batch();
    for (const choice of adding.slice(i, i + 200)) {
      const record = records.get(choice.conceptId)!;
      batch.set(
        userRef.collection('games').doc(String(choice.igdbId)),
        importedGame(igdb.get(choice.igdbId)!, record, choice, now),
      );
      batch.update(userRef.collection('psnGames').doc(String(choice.conceptId)), {
        igdbId: choice.igdbId,
        matchedBy: 'manual',
      });
    }
    await batch.commit();
  }

  // Playtime, trophies and Platinum dates now. If PlayStation fails, the next sync brings them.
  const sync = adding.length ? await syncPsnUser(db, uid).catch(() => null) : null;
  return json(
    { added: adding.length, skipped: choices.length - adding.length, synced: !!sync?.ok },
    adding.length ? 201 : 200,
  );
}
