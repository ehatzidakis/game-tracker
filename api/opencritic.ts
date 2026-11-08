// OpenCritic score for one game: GET /api/opencritic?igdb=119133 with the Firebase ID token.
// Served from the shared store; looked up on OpenCritic when it's missing or due.
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import { openCriticFor } from './_lib/opencritic.js';
import { toScore } from './_lib/opencritic-match.js';

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
