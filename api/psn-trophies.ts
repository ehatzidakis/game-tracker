// A game's trophies, for its Trophies page: GET /api/psn-trophies?game=<igdbId> with the Firebase
// ID token. Reads the game's trophy list and your progress in it from PlayStation (three requests)
// and answers with a TrophyListView (api/_lib/psn-trophies.ts). Games synced before the list's id
// was kept find it by their counts on your profile, and keep it.
import { getTitleTrophies, getTitleTrophyGroups, getUserTitles, getUserTrophiesEarnedForTitle } from 'psn-api';
import { adminDb } from './_lib/admin.js';
import { json, verifyUser } from './_lib/auth.js';
import type { PsnLink, TrackedGame } from './_lib/models.js';
import { psnAccessToken, PsnAuthError } from './_lib/psn.js';
import {
  buildTrophyList,
  findTrophyList,
  type ProfileTrophyList,
  type UserTrophyData,
} from './_lib/psn-trophies.js';

const ENGLISH = { 'Accept-Language': 'en-GB' };

export async function GET(request: Request): Promise<Response> {
  const uid = await verifyUser(request);
  if (!uid) return json({ error: 'Not signed in' }, 401);
  const igdbId = Number(new URL(request.url).searchParams.get('game'));
  if (!Number.isInteger(igdbId) || igdbId <= 0) return json({ error: 'Bad request' }, 400);

  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  const gameRef = userRef.collection('games').doc(String(igdbId));
  const [user, gameSnap] = await Promise.all([userRef.get(), gameRef.get()]);
  const link = user.data()?.['psn'] as PsnLink | undefined;
  const trophies = (gameSnap.data() as TrackedGame | undefined)?.playstation?.trophies;
  if (!link) return json({ error: 'PlayStation isn’t connected.' }, 404);
  if (!trophies) return json({ error: 'PlayStation has no trophies for this game.' }, 404);

  try {
    const auth = { accessToken: (await psnAccessToken(db)).accessToken };
    let listId = trophies.listId;
    let serviceName = trophies.serviceName;
    if (!listId) {
      const lists: ProfileTrophyList[] = [];
      for (let offset = 0; ; offset += 800) {
        const page = await getUserTitles(auth, link.accountId, { limit: 800, offset });
        lists.push(...(page.trophyTitles as ProfileTrophyList[]));
        if (!page.trophyTitles.length || lists.length >= page.totalItemCount) break;
      }
      const found = findTrophyList(lists, trophies);
      if (!found) return json({ error: 'Couldn’t find this game’s trophies on PlayStation.' }, 404);
      listId = found.npCommunicationId;
      serviceName = found.npServiceName;
      await gameRef.update({
        'playstation.trophies.listId': listId,
        'playstation.trophies.serviceName': serviceName,
      });
    }
    const service = serviceName ?? (trophies.platform.toUpperCase().includes('PS5') ? 'trophy2' : 'trophy');
    const options = { npServiceName: service, headerOverrides: ENGLISH } as const;
    const [title, mine, groups] = await Promise.all([
      getTitleTrophies(auth, listId, 'all', options),
      getUserTrophiesEarnedForTitle(auth, link.accountId, listId, 'all', options),
      getTitleTrophyGroups(auth, listId, options),
    ]);
    return json(
      buildTrophyList(
        listId,
        trophies.platform,
        title.trophies,
        mine.trophies as UserTrophyData[],
        groups.trophyGroups,
      ),
    );
  } catch (error) {
    console.error(`Trophies for game ${igdbId} failed`, error);
    if (error instanceof PsnAuthError) {
      return json({ error: 'PlayStation needs a new token, so trophies can’t be read.' }, 503);
    }
    return json({ error: 'PlayStation didn’t answer. Try again in a moment.' }, 502);
  }
}
