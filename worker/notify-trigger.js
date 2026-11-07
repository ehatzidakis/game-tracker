// Cloudflare Worker: calls the app's alert job every hour, at :02.
// Vercel's free plan only runs scheduled jobs once a day, which can't honour the alert time
// you pick in Settings. Deploy steps are in worker/README.md.
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      fetch(`${env.APP_URL}/api/cron/notify`, {
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }).then(async (res) => console.log('notify', res.status, await res.text())),
    );
  },
};
