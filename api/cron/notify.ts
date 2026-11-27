// Hourly: moves pre-orders that came out today to the Backlog, sends release alerts that are
// due, announces a new What's new entry once it's live, syncs PlayStation for those whose last sync is 8 hours old, then fills in OpenCritic
// scores with whatever is left of its allowance, from the queue the daily job builds (so it
// doesn't read every library each hour). Called by the hourly trigger with CRON_SECRET.
import { adminDb } from '../_lib/admin.js';
import { isCron, json } from '../_lib/auth.js';
import { runAnnounce, runNotify, runPreorderArrivals } from '../_lib/jobs.js';
import { runOpenCriticRefresh } from '../_lib/opencritic.js';
import { runPsnSync } from '../_lib/psn.js';

/** OpenCritic calls per hourly run: room for the day's searches, and quick to finish. */
const HOURLY_OPENCRITIC_CALLS = 50;

export async function GET(request: Request): Promise<Response> {
  if (!isCron(request)) return json({ error: 'Forbidden' }, 403);
  try {
    const db = adminDb();
    const arrivals = await runPreorderArrivals(db);
    const notify = await runNotify(db);
    // On their own: a What's new, PlayStation or OpenCritic problem never holds up alerts.
    const whatsNew = await runAnnounce(db).catch((error: unknown) => {
      console.error(error);
      return { error: "What's new failed" };
    });
    const playstation = await runPsnSync(db).catch((error: unknown) => {
      console.error(error);
      return { error: 'PlayStation sync failed' };
    });
    const opencritic = await runOpenCriticRefresh(db, Date.now(), HOURLY_OPENCRITIC_CALLS).catch(
      (error: unknown) => {
        console.error(error);
        return { error: 'OpenCritic refresh failed' };
      },
    );
    return json({ ...notify, arrivals, whatsNew, playstation, opencritic });
  } catch (error) {
    console.error(error);
    return json({ error: 'Notify failed' }, 500);
  }
}
