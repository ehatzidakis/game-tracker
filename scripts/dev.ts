// Local development: runs the /api functions on port 3001 and `ng serve` on 4300 (set in
// angular.json; not Angular's usual 4200, which other projects on this machine use). It listens
// on the whole network (host 0.0.0.0), so a phone on the same Wi-Fi can open the "Network"
// address `ng serve` prints.
// The Angular dev server forwards /api to port 3001 (see proxy.conf.json), so `ng serve` on its
// own shows the app but every /api call fails: always start with `npm start`.
// Started by `npm start` (through tsx, which loads secrets from .env).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { GET as calendar } from '../api/calendar.ts';
import { GET as daily } from '../api/cron/daily.ts';
import { GET as notify } from '../api/cron/notify.ts';
import { POST as igdb } from '../api/igdb.ts';
import { GET as opencritic, POST as opencriticScores } from '../api/opencritic.ts';
import { DELETE as psnUnlink, POST as psnLink } from '../api/psn.ts';
import { POST as psnSync } from '../api/psn-sync.ts';
import { POST as pushTest } from '../api/push-test.ts';

type Handler = (request: Request) => Promise<Response>;
// Same paths as on Vercel (vercel.json rewrites /api/calendar.ics to /api/calendar).
const routes: Record<string, Partial<Record<string, Handler>>> = {
  '/api/igdb': { POST: igdb },
  '/api/opencritic': { GET: opencritic, POST: opencriticScores },
  '/api/calendar.ics': { GET: calendar },
  '/api/push-test': { POST: pushTest },
  '/api/psn': { POST: psnLink, DELETE: psnUnlink },
  '/api/psn-sync': { POST: psnSync },
  '/api/cron/daily': { GET: daily },
  '/api/cron/notify': { GET: notify },
};

const API_PORT = 3001;

createServer(async (req, res) => {
  // Keep the original host so links built from the request (calendar URLs) point at the tunnel.
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? `localhost:${API_PORT}`;
  const url = new URL(req.url ?? '/', `http://${host}`);
  const handler = routes[url.pathname]?.[req.method ?? 'GET'];
  if (!handler) {
    res.writeHead(404).end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
  }

  try {
    const response = await handler(
      new Request(url, {
        method: req.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end();
  }
}).listen(API_PORT, () => console.log(`API functions on http://localhost:${API_PORT}`));

const ng = spawn('npx', ['ng', 'serve'], { stdio: 'inherit', shell: true });
ng.on('exit', (code) => process.exit(code ?? 0));
