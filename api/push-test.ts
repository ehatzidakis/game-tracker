// Sends a test notification to the signed-in user's devices (Settings → Send a test notification).
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import { sendToUser } from './_lib/jobs.js';

export async function POST(request: Request): Promise<Response> {
  const uid = await verifyUser(request);
  if (!uid) return json({ error: 'Not signed in' }, 401);
  try {
    const sent = await sendToUser(adminDb().collection('users').doc(uid), {
      title: 'Test alert',
      body: 'Release alerts work on this device.',
      url: '/settings',
      tag: 'test',
    });
    return json({ sent }, sent ? 200 : 404);
  } catch (error) {
    console.error(error);
    return json({ error: 'Push failed' }, 500);
  }
}
