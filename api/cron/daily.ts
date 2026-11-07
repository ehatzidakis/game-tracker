// Daily job (Vercel Cron, once a day): refresh release dates from IGDB, then send any alerts
// that are due. The hourly trigger (/api/cron/notify) sends alerts closer to the chosen time.
import { adminDb } from '../_lib/admin.js';
import { isCron, json } from '../_lib/auth.js';
import { runDailyRefresh, runNotify } from '../_lib/jobs.js';

export async function GET(request: Request): Promise<Response> {
  if (!isCron(request)) return json({ error: 'Forbidden' }, 403);
  try {
    const db = adminDb();
    const refresh = await runDailyRefresh(db);
    const notify = await runNotify(db);
    console.log('daily', JSON.stringify({ refresh, notify }));
    return json({ refresh, notify });
  } catch (error) {
    console.error(error);
    return json({ error: 'Daily job failed' }, 500);
  }
}
