// IGDB proxy. The browser can't call IGDB directly (CORS, and the Twitch secret must stay
// on the server), so the app posts { endpoint, query } here with its Firebase ID token.
import { z } from 'zod';
import { json, verifyUser } from './_lib/auth.js';
import { igdbRequest } from './_lib/igdb-client.js';

const RequestBody = z.object({
  endpoint: z.enum(['games', 'platforms', 'release_dates', 'screenshots', 'game_videos']),
  query: z.string().min(1).max(4000),
});

export async function POST(request: Request): Promise<Response> {
  if (!(await verifyUser(request))) return json({ error: 'Not signed in' }, 401);

  const parsed = RequestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Bad request' }, 400);
  const { endpoint, query } = parsed.data;

  try {
    const res = await igdbRequest(endpoint, query);
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'IGDB is unreachable' }, 502);
  }
}
