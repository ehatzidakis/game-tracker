// Server-side IGDB access with a cached Twitch app token.

// Kept between calls while the function stays warm. Twitch tokens last about 60 days.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getTwitchToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID ?? '',
    client_secret: process.env.TWITCH_CLIENT_SECRET ?? '',
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch token request failed with ${res.status}`);

  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function post(endpoint: string, query: string): Promise<Response> {
  return fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID ?? '',
      Authorization: `Bearer ${await getTwitchToken()}`,
      'Content-Type': 'text/plain',
    },
    body: query,
  });
}

/** Sends an Apicalypse query. Retries once with a fresh token if Twitch revoked the old one. */
export async function igdbRequest(endpoint: string, query: string): Promise<Response> {
  let res = await post(endpoint, query);
  if (res.status === 401) {
    cachedToken = null;
    res = await post(endpoint, query);
  }
  return res;
}

export async function igdbQuery<T>(endpoint: string, query: string): Promise<T> {
  const res = await igdbRequest(endpoint, query);
  if (!res.ok) throw new Error(`IGDB ${endpoint} failed with ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
