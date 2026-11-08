// Daily job (Vercel Cron, once a day): refresh release dates from IGDB, send any alerts that
// are due, then update OpenCritic scores. The hourly trigger (/api/cron/notify) sends alerts closer to the chosen time.
import { adminDb } from '../_lib/admin.js';
import { isCron, json } from '../_lib/auth.js';
import { runDailyRefresh, runNotify } from '../_lib/jobs.js';
import { runOpenCriticRefresh } from '../_lib/opencritic.js';

export async function GET(request: Request): Promise<Response> {
  if (!isCron(request)) return json({ error: 'Forbidden' }, 403);
  try {
    const db = adminDb();
    const refresh = await runDailyRefresh(db);
    const notify = await runNotify(db);
    // Last, and on its own: an OpenCritic problem never holds up dates or alerts.
    const opencritic = await runOpenCriticRefresh(db).catch((error: unknown) => {
      console.error(error);
      return { error: 'OpenCritic refresh failed' };
    });
    console.log('daily', JSON.stringify({ refresh, notify, opencritic }));
    return json({ refresh, notify, opencritic });
  } catch (error) {
    console.error(error);
    return json({ error: 'Daily job failed' }, 500);
  }
}
