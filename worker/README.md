# Hourly alert trigger (Cloudflare Worker)

Calls `/api/cron/notify` every hour so release alerts arrive at the time you chose in Settings.
Without it, alerts still go out once a day with the daily job (around 13:00–14:00 Athens time).

Deploy once. Run these **inside the `worker` folder** (`cd worker` from the project root). Wrangler reads the worker's name from `wrangler.toml` here, so from anywhere else it says "Worker name missing".

1. `npx wrangler login` (free Cloudflare account; the expenses tracker's account works).
2. `npx wrangler deploy`
3. `npx wrangler secret put CRON_SECRET` and paste the same `CRON_SECRET` value as in Vercel. Until this is set, the hourly call gets `notify 403`.

Check it: Cloudflare dashboard → Workers → game-tracker-notify → Logs should show `notify 200` each hour.
