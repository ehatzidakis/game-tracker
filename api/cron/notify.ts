// Hourly: moves pre-orders that came out today to the Backlog, then sends release alerts that
// are due. Called by the hourly trigger with CRON_SECRET.
import { adminDb } from '../_lib/admin.js';
import { isCron, json } from '../_lib/auth.js';
import { runNotify, runPreorderArrivals } from '../_lib/jobs.js';

export async function GET(request: Request): Promise<Response> {
  if (!isCron(request)) return json({ error: 'Forbidden' }, 403);
  try {
    const db = adminDb();
    const arrivals = await runPreorderArrivals(db);
    return json({ ...(await runNotify(db)), arrivals });
  } catch (error) {
    console.error(error);
    return json({ error: 'Notify failed' }, 500);
  }
}
