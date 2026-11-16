// Links your PlayStation account: POST /api/psn { onlineId } with the Firebase ID token checks it
// with PlayStation and saves it on users/{uid} (field "psn"). DELETE /api/psn unlinks it.
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import { linkPsnAccount, PSN_ONLINE_ID, psnLinkError } from './_lib/psn.js';

const LinkBody = z.object({ onlineId: z.string().trim().regex(PSN_ONLINE_ID) });

export async function POST(request: Request): Promise<Response> {
  const uid = await verifyUser(request);
  if (!uid) return json({ error: 'Not signed in' }, 401);
  const parsed = LinkBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'That isn’t a PlayStation Online ID.' }, 400);
  try {
    return json(await linkPsnAccount(adminDb(), uid, parsed.data.onlineId));
  } catch (error) {
    const { status, message } = psnLinkError(error);
    return json({ error: message }, status);
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
