// Checks who is calling: a signed-in app user (Firebase ID token) or the scheduler (CRON_SECRET).
import { timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const FIREBASE_PROJECT_ID = 'game-tracker-hatzidakis';

const firebaseKeys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

/** The signed-in user's ID, or null. Expects `Authorization: Bearer <Firebase ID token>`. */
export async function verifyUser(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), firebaseKeys, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** True for calls from Vercel Cron or the hourly trigger: `Authorization: Bearer <CRON_SECRET>`. */
export function isCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
