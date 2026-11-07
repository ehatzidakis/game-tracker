// The calendar subscription feed: /api/calendar.ics?key=… (vercel.json rewrites .ics to here).
// No sign-in: calendar apps can't sign in, so the long random key in the link is the password.
import { adminDb } from './_lib/admin.js';
import { buildCalendar } from './_lib/ics.js';
import type { TrackedGame } from './_lib/models.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') ?? '';
  if (!/^[\w-]{20,64}$/.test(key)) return new Response('Not found', { status: 404 });

  try {
    const db = adminDb();
    const users = await db.collection('users').where('calendarKey', '==', key).limit(1).get();
    if (users.empty) return new Response('Not found', { status: 404 });

    const games = await users.docs[0].ref.collection('games').get();
    const body = buildCalendar(
      games.docs.map((d) => d.data() as TrackedGame),
      `${url.protocol}//${url.host}`,
    );
    return new Response(body, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="game-releases.ics"',
        'Cache-Control': 'private, max-age=900',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response('Calendar unavailable', { status: 503 });
  }
}
