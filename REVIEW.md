# For your review (2026-11-07)

What Claude built while you were away, what it needs from you, and the choices it made on its own. The plan and progress are in [PLAN.md](PLAN.md). Change anything here and Claude will follow it.

## 1. What I need from you, in order

1. ~~Publish the Firestore rules~~ Done.
2. ~~Untick "Enable create (sign-up)"~~ Done.
3. ~~Commit and push~~ Done on 2026-11-07.
4. **After the deploy:** deploy the hourly alert worker ([worker/README.md](worker/README.md), three commands).
5. **On the phone:** delete and re-add the home-screen icon (it has a proper icon now). Then add a few games, open Settings → turn on notifications → "Send a test notification", and tap **Subscribe** on the Calendar tab.

## 2. Questions for you

- **Target completion.** Should a game you're playing also get a *target* ("going for Platinum")? I didn't add it.
- **What the Calendar shows.** I included every upcoming game you track, not just Wishlist, so a pre-order in Backlog still shows its date. Completed and Shelved are left out. OK?
- **Wishlist in Library.** Wishlist is also a Library tab, so released games you still want to buy have a home (the Calendar only shows upcoming ones). Keep it?
- **"New date" alerts.** When IGDB moves a release date, I send "New date for X" only for games with the bell on. Want it for every wishlist game?
- **Rating.** You're asked for a 1–10 rating only on Completed games. Want it on Shelved games too?
- **Accent colour** for the design pass: the app is all greys right now. Any colour you like (e.g. PlayStation blue)?
- **App icon.** A simple white gamepad on dark grey, as a placeholder. Keep it, or do you want something else?

## 3. Choices I made (easy to change)

**Data**
- Release dates are stored as `"2026-11-19"` text, not timestamps. That avoids time-zone shifts (a midnight UTC timestamp can show as the day before). For vague dates I store the last day of the period ("Q3 2027" → 30 Sep 2027) so sorting still works.
- When a game has several dates for your platform: an exact day beats a vague one, then **Europe** beats worldwide beats other regions, then the earliest wins.
- If a game isn't on your default platform (PS5), it's added on the first of Xbox, PC or Switch 2 it is on.
- Library order everywhere: Playing, Backlog, Wishlist, Shelved, Completed. Library opens on Playing the first time, then remembers your last tab and sort on the device.
- When adding a game, the sheet suggests **Wishlist** for unreleased games and **Backlog** for released ones. You still pick.
- Status changes stamp dates you don't see yet but can use for stats: bought (Backlog/Playing/Completed), started (Playing), shelved, completed.
- Changes save straight away (no Save button). The screen updates instantly, even offline, and syncs when back online. If a save fails you get a red message above the tab bar.

**Alerts**
- An alert is sent once per release date. If the date moves, the bell game gets a "New date" alert and then a fresh release alert for the new date.
- If you have no device with notifications on, the alert isn't marked as sent. Turn them on later and you still get it, as long as the release hasn't passed.
- Days-before options: on the day, 1, 2, 3, 5 or 7 days before. Time in 15-minute steps. Your time zone is saved when you turn notifications on.
- Hourly trigger: a **Cloudflare Worker** (precise, free, same as the expenses tracker). GitHub Actions would also work without a new account, but its schedule often runs 10–30 minutes late.
- The daily Vercel job runs at 11:00 UTC: 13:00 Athens in winter, 14:00 in summer. That way the default 13:00 alert is never early (on time in winter, an hour late in summer). Without the worker, that's when alerts arrive.

**Calendar feed**
- Only exact release days become events (all-day). Vague dates join once IGDB has a day. Titles start with 🎮 so they stand out in the iPhone Calendar.
- "Just released" on the Calendar tab keeps games for 14 days after release.

**Game screen**
- The top image is the first screenshot. IGDB "artworks" are often logos (Elden Ring's is giant text).
- The trailer is the first IGDB video. It plays inline on tap from youtube-nocookie.com, so YouTube doesn't set tracking cookies until you press play.

**Code and libraries**
- Code shared by the app and the server (release dates, data model, calendar feed) lives in `api/_lib/`. Vercel doesn't turn files starting with `_` into endpoints. The local dev server now runs through `tsx`.
- Dropped from the plan because they weren't needed: `date-fns`, `ics`, `@angular/aria`, Signal Forms, `fast-average-color`, `idb-keyval`. Added: `firebase-admin`, `web-push`, `tsx`.
- The service worker only handles notifications. It doesn't cache the app for offline start (suggestion below).

## 4. Tested, and not tested

**Tested here:** 21 automated tests (release-date picking, alert timing across summer/winter time, calendar grouping, the feed format, the game screen's controls). The server functions ran locally against your real Firestore with temporary test data: the feed returned the right event, and the daily job corrected a stale GTA VI date to 19 Nov 2026 and filled in its cover. Every screen was opened in a phone-sized Chrome with a temporary account: no errors, no sideways scrolling. The test account and data were deleted afterwards.

**Not tested yet:**
- Saving games from the app (blocked by the rules). There's no Firestore emulator here (it needs Java).
- Anything on the deployed Vercel site. The first deploy will show whether the server functions load correctly there. If search or the feed fails after deploying, tell me and I'll check the Vercel logs.
- Push notifications on the iPhone, and the Calendar **Subscribe** link opening from the home-screen app.
- The iOS 27 top-blur workaround.

## 5. Suggestions

- **Rotate the secrets** that were pasted into chat earlier (Twitch client secret and the Firebase service-account key), then update `.env` and Vercel. Also delete the service-account JSON from Downloads.
- **Turn off Google** under Authentication → Sign-in method, and delete the leftover Google account (hatzidakis.slg@…) under Users if it was only a test.
- **Faster start:** let the service worker cache the app's files, so the home-screen app opens instantly and works offline. It's small, but caching can serve stale versions after a deploy if done carelessly, so I held off until the app is live.
- **Design pass (Step 5):** accent colour, cover-tinted backgrounds on the game screen, small touches like haptic-style press states.
