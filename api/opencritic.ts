// OpenCritic score for one game: GET /api/opencritic?igdb=119133 with the Firebase ID token
// (&force=1: "Check OpenCritic now", asks OpenCritic whatever the schedule, and answers with an
// OpenCriticCheck: the score, when it was really checked, and whether the allowance stopped it).
// Served from the shared store; looked up on OpenCritic when it's missing or due.
// POST /api/opencritic with { ids: [119133, …] } gives the stored Top Critic Average of each game
// that has one, for the Library's covers. It never asks OpenCritic.
// PUT /api/opencritic with { igdb, critic, critics, players, users } saves scores typed in by hand
// (0–100, with how many critics and users, or null) for a game OpenCritic gets wrong; all null go
// back to OpenCritic's. Answers with the score.
import { z } from 'zod';
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import { openCriticFor, setOwnScores, storedScores } from './_lib/opencritic.js';
import { toScore, type OpenCriticCheck } from './_lib/opencritic-match.js';

const ScoresBody = z.object({ ids: z.array(z.number().int().positive()).max(1000) });
const Score = z.number().int().min(0).max(100).nullable();
const Count = z.number().int().min(0).max(100_000_000).nullable();
const OwnScoresBody = z.object({
  igdb: z.number().int().positive(),
  critic: Score,
  critics: Count,
  players: Score,
  users: Count,
});

export async function POST(request: Request): Promise<Response> {
  if (!(await verifyUser(request))) return json({ error: 'Not signed in' }, 401);
  const parsed = ScoresBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Bad request' }, 400);
  try {
    return json({ scores: await storedScores(adminDb(), [...new Set(parsed.data.ids)]) });
  } catch (error) {
    console.error(error);
    return json({ error: "Couldn't read the scores" }, 502);
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!(await verifyUser(request))) return json({ error: 'Not signed in' }, 401);
  const parsed = OwnScoresBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Bad request' }, 400);
  const { igdb, ...own } = parsed.data;
  try {
    const db = adminDb();
    const saved = await setOwnScores(db, igdb, own);
    if (saved.manual) return json(toScore(saved));
    // Cleared: OpenCritic's again, looked up now if the allowance allows.
    const { entry, limit, retryAt } = await openCriticFor(db, igdb);
    return json(toScore(entry, { limit, retryAt }));
  } catch (error) {
    console.error(error);
    return json({ error: "Couldn't save the scores" }, 502);
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyUser(request))) return json({ error: 'Not signed in' }, 401);
  const params = new URL(request.url).searchParams;
  const igdbId = Number(params.get('igdb'));
  if (!Number.isInteger(igdbId) || igdbId <= 0) return json({ error: 'Bad request' }, 400);
  const force = params.get('force') === '1';

  try {
    const { entry, limit, retryAt } = await openCriticFor(adminDb(), igdbId, Date.now(), force);
    const score = toScore(entry, { limit, retryAt });
    if (!force) return json(score);
    const check: OpenCriticCheck = { score, checkedAt: entry?.checkedAt ?? null, limit, retryAt };
    return json(check);
  } catch (error) {
    console.error(error);
    return json({ error: 'OpenCritic is unreachable' }, 502);
  }
}
