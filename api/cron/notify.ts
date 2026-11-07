// Hourly: send release alerts that are due. Called by the hourly trigger with CRON_SECRET.
import { adminDb } from '../_lib/admin.js';
import { isCron, json } from '../_lib/auth.js';
import { runNotify } from '../_lib/jobs.js';

export async function GET(request: Request): Promise<Response> {
  if (!isCron(request)) return json({ error: 'Forbidden' }, 403);
  try {
    return json(await runNotify(adminDb()));
  } catch (error) {
    console.error(error);
    return json({ error: 'Notify failed' }, 500);
  }
}
