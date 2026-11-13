// Links your PlayStation account: POST /api/psn { onlineId } with the Firebase ID token checks it
// with PlayStation and saves it on users/{uid} (field "psn"). DELETE /api/psn unlinks it.
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import type { PsnLink } from './_lib/models.js';
import { checkPsnAccount, PsnAuthError, PsnNotFound, refreshPsnGames } from './_lib/psn.js';

// PlayStation Online IDs: 3–16 letters, digits, - and _.
const LinkBody = z.object({
  onlineId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,16}$/),
});

export async function POST(request: Request): Promise<Response> {
  const uid = await verifyUser(request);
  if (!uid) return json({ error: 'Not signed in' }, 401);
  const parsed = LinkBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'That isn’t a PlayStation Online ID.' }, 400);

  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  try {
    const psn = await checkPsnAccount(db, parsed.data.onlineId);
    // Another PlayStation account than before: its games (and your matches) start over.
    const before = (await userRef.get()).data()?.['psn'] as PsnLink | undefined;
    if (before && before.accountId !== psn.accountId) {
      await db.recursiveDelete(userRef.collection('psnGames'));
    }
    await userRef.set({ psn }, { merge: true });
    // Match its games to your library straight away. If that fails, the next sync does it.
    await refreshPsnGames(db, uid).catch((error: unknown) => console.error(error));
    return json(psn);
  } catch (error) {
    if (error instanceof PsnNotFound) {
      return json({ error: 'No PlayStation account has that Online ID.' }, 404);
    }
    console.error(error);
    if (error instanceof PsnAuthError) {
      return json({ error: 'The app can’t sign in to PlayStation right now.' }, 503);
    }
    return json({ error: 'PlayStation didn’t answer. Try again in a moment.' }, 502);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const uid = await verifyUser(request);
  if (!uid) return json({ error: 'Not signed in' }, 401);
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  // Its games and your matches go too. What was synced onto your library games stays.
  await db.recursiveDelete(userRef.collection('psnGames'));
  await userRef.set({ psn: FieldValue.delete() }, { merge: true });
  return json({ ok: true });
}
