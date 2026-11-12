// OpenCritic score for one game: GET /api/opencritic?igdb=119133 with the Firebase ID token.
// Served from the shared store; looked up on OpenCritic when it's missing or due.
// POST /api/opencritic with { ids: [119133, …] } gives the stored Top Critic Average of each game
// that has one, for the Library's covers. It never asks OpenCritic.
import { z } from 'zod';
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import { openCriticFor, storedScores } from './_lib/opencritic.js';
import { toScore } from './_lib/opencritic-match.js';

const ScoresBody = z.object({ ids: z.array(z.number().int().positive()).max(1000) });

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

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyUser(request))) return json({ error: 'Not signed in' }, 401);
  const igdbId = Number(new URL(request.url).searchParams.get('igdb'));
  if (!Number.isInteger(igdbId) || igdbId <= 0) return json({ error: 'Bad request' }, 400);

  try {
    return json(toScore(await openCriticFor(adminDb(), igdbId)));
  } catch (error) {
    console.error(error);
    return json({ error: 'OpenCritic is unreachable' }, 502);
  }
}
