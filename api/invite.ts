// "Invite a friend" in Settings: POST /api/invite with the Firebase ID token makes a one-time
// invite (invites/{code}, server only) and answers with its code; the app turns it into the link
// loggd.quest/signup?invite=<code>. The link works once, for INVITE_DAYS days.
import { randomBytes } from 'node:crypto';
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import { newInvite } from './_lib/signup.js';

export async function POST(request: Request): Promise<Response> {
  const uid = await verifyUser(request);
  if (!uid) return json({ error: 'Not signed in' }, 401);
  const code = randomBytes(24).toString('base64url');
  const invite = newInvite(uid);
  await adminDb().collection('invites').doc(code).create(invite);
  return json({ code, expiresAt: invite.expiresAt }, 201);
}
