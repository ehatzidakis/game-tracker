// The sign-up page, for someone with an invite link. Firebase's own sign-up stays off; accounts
// are made here, with admin rights, only for a valid invite.
// GET /api/signup?invite=<code>: is the invite still good? (So the page can say so up front.)
// POST /api/signup { invite, email, password, onlineId? }: makes the account, uses up the invite,
// and links the PlayStation account if an Online ID was given. The app then signs in.
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb } from './_lib/admin.js';
import { json } from './_lib/auth.js';
import { linkPsnAccount, PSN_ONLINE_ID, psnLinkError } from './_lib/psn.js';
import {
  INVITE_CODE,
  INVITE_MESSAGES,
  inviteState,
  passwordOk,
  type Invite,
} from './_lib/signup.js';

const SignupBody = z.object({
  invite: z.string().regex(INVITE_CODE),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().refine(passwordOk),
  onlineId: z.union([z.literal(''), z.string().trim().regex(PSN_ONLINE_ID)]).optional(),
});

const AUTH_MESSAGES: Record<string, { status: number; message: string }> = {
  'auth/email-already-exists': {
    status: 409,
    message: 'There’s already an account with that email. Sign in instead.',
  },
  'auth/invalid-email': { status: 400, message: 'That doesn’t look like an email address.' },
  'auth/invalid-password': { status: 400, message: 'That password doesn’t meet the rules.' },
};

export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get('invite') ?? '';
  if (!INVITE_CODE.test(code)) return json({ error: INVITE_MESSAGES.missing }, 404);
  const snap = await adminDb().collection('invites').doc(code).get();
  const state = inviteState(snap.data() as Invite | undefined);
  if (state !== 'ok')
    return json({ error: INVITE_MESSAGES[state] }, state === 'missing' ? 404 : 410);
  return json({ ok: true });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = SignupBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message =
      field === 'email'
        ? 'That doesn’t look like an email address.'
        : field === 'password'
          ? 'That password doesn’t meet the rules.'
          : field === 'onlineId'
            ? 'That isn’t a PlayStation Online ID.'
            : INVITE_MESSAGES.missing;
    return json({ error: message }, 400);
  }
  const { invite: code, email, password, onlineId } = parsed.data;
  const db = adminDb();
  const inviteRef = db.collection('invites').doc(code);

  // Claim the invite first, so two sign-ups with one link can't both make an account.
  const state = await db.runTransaction(async (tx) => {
    const now = Date.now();
    const current = inviteState((await tx.get(inviteRef)).data() as Invite | undefined, now);
    if (current === 'ok') tx.update(inviteRef, { claimedAt: now });
    return current;
  });
  if (state !== 'ok')
    return json({ error: INVITE_MESSAGES[state] }, state === 'missing' ? 404 : 410);

  let uid: string;
  try {
    ({ uid } = await adminAuth().createUser({ email, password }));
  } catch (error) {
    // Free the invite again so they can retry with another email.
    await inviteRef.update({ claimedAt: FieldValue.delete() });
    const known = AUTH_MESSAGES[(error as { code?: string }).code ?? ''];
    if (!known) console.error(error);
    return json(
      { error: known?.message ?? 'Couldn’t make the account. Try again in a moment.' },
      known?.status ?? 500,
    );
  }
  await inviteRef.update({ usedBy: uid, usedAt: Date.now(), claimedAt: FieldValue.delete() });

  // The account is made either way; a PlayStation problem only means linking it later in Settings.
  let psnError: string | undefined;
  if (onlineId) {
    try {
      await linkPsnAccount(db, uid, onlineId);
    } catch (error) {
      psnError = psnLinkError(error).message;
    }
  }
  return json({ ok: true, psnError }, 201);
}
