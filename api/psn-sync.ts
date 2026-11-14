// "Sync now" in Settings: POST /api/psn-sync with the Firebase ID token runs the PlayStation sync
// for you right away. Answers with how it went (also saved on users/{uid}.psnSync).
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import type { PsnSyncState } from './_lib/models.js';
import { syncPsnUser } from './_lib/psn.js';

/** Tapping it twice in a row reads PlayStation once. */
const AGAIN_AFTER_MS = 60_000;

export async function POST(request: Request): Promise<Response> {
  const uid = await verifyUser(request);
  if (!uid) return json({ error: 'Not signed in' }, 401);
  const db = adminDb();
  const last = (await db.collection('users').doc(uid).get()).data()?.['psnSync'] as
    PsnSyncState | undefined;
  if (last?.ok && Date.now() - last.at < AGAIN_AFTER_MS) return json(last);
  const state = await syncPsnUser(db, uid);
  if (!state) return json({ error: 'Connect your PlayStation account first.' }, 400);
  return json(state, state.ok ? 200 : 502);
}
