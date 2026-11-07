# Game Tracker: plan

A calendar for upcoming game releases plus a library of the games I own, with how far I got in each.

This file is the source of truth for the plan. Claude ticks steps off and updates it as we go.

**Status:** Step 0 done (project initialized). Waiting on the [prerequisites](#before-we-start-what-you-need-ready) before Step 1.

---

## Before we start: what you need ready

Tick these off as you go. Values marked 🔒 are secrets: keep them out of git and paste them into Vercel's environment variables (and a local `.env`, which is git-ignored).

### 1. Firebase (new project, free Spark plan)

- [ ] Create a new Firebase project, e.g. `game-tracker` (separate from the expenses tracker, so it gets its own free quota).
- [ ] **Add a Web app** to it and copy the `firebaseConfig` object (apiKey, authDomain, projectId, …). Not secret; it goes in the app's code.
- [ ] **Authentication → Sign-in method:** enable **Google**.
- [ ] **Firestore Database:** create it in production mode. Pick a European location (e.g. `eur3` or `europe-west`). The location can't be changed later.
- [ ] **Project settings → Service accounts → Generate new private key.** Download the JSON. 🔒 The calendar feed and the daily job use it to read your games from the server.
- [ ] Later, once Vercel gives us a domain: add it under **Authentication → Settings → Authorized domains**.

### 2. Twitch developer app (for IGDB)

- [ ] Turn on **two-factor authentication** on your Twitch account (Twitch requires it before you can register apps).
- [ ] Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) → **Register Your Application**:
  - Name: anything unique, e.g. `eftihis-game-tracker`
  - OAuth Redirect URL: `http://localhost`
  - Category: Website Integration
  - Client type: **Confidential**
- [ ] Copy the **Client ID** and generate a **Client Secret**. 🔒

### 3. GitHub and Vercel

- [ ] Create an empty GitHub repo (e.g. `game-tracker`). I'll push this folder to it when you say so.
- [ ] Create a new Vercel project linked to that repo (framework: Angular, detected automatically).
- [ ] Note the domain Vercel assigns (e.g. `game-tracker-xyz.vercel.app`) and add it to Firebase authorized domains (see 1).

### 4. Decisions only you can make

- [ ] **Your platforms**, so the platform picker offers them first (e.g. PS5, Switch 2, PC/Steam, Xbox).
- [ ] **Notification time** for release alerts (default 09:00 Europe/Athens).
- [ ] **Steam import?** Optional. If yes: a Steam Web API key 🔒 ([steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)) and your SteamID64, with your game library set to public.

### Things I'll generate myself (no action needed)

- VAPID keys for push notifications (`npx web-push generate-vapid-keys`).
- `CRON_SECRET`, the random string that stops anyone else from triggering the daily job.
- The per-user calendar link key.

### Environment variables we'll end up with

| Name | Where it comes from | Used by |
|---|---|---|
| `TWITCH_CLIENT_ID` | Twitch app (2) | `/api/igdb`, daily job |
| `TWITCH_CLIENT_SECRET` 🔒 | Twitch app (2) | `/api/igdb`, daily job |
| `FIREBASE_SERVICE_ACCOUNT` 🔒 | Service account JSON (1), pasted as one line | `/api/calendar.ics`, daily job |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` 🔒 | I generate | daily job (push) |
| `CRON_SECRET` 🔒 | I generate | daily job |
| `STEAM_API_KEY` 🔒 | Optional (4) | Steam import |

---

## Build steps

- [x] **0. Initialize the project.** Angular 22 (zoneless, standalone, routing), Tailwind 4, Vitest, TanStack Query, Firebase SDK. Router has view transitions and component input binding turned on.
- [ ] **1. Foundations.** Firebase config, Google sign-in, Firestore security rules (only you can read and write your data), app shell with bottom tab bar, the `/api/igdb` proxy, and search working end to end.
- [ ] **2. Library.** Add games from search, pick status and completion, Library screen with filters, Game detail screen with your controls.
- [ ] **3. Calendar.** Calendar screen (month grid on desktop, list on phone, vague-date group), plus the `/api/calendar.ics` subscription link.
- [ ] **4. Daily job.** Vercel cron: refresh release dates from IGDB, then send push alerts for games out today or tomorrow. PWA setup so push works on iPhone.
- [ ] **5. Design pass** with the `impeccable` skill: dark, cool, one accent colour, glow only on hover and focus.
- [ ] **6. Optional extras.** Steam import, stats ("completed in 2026").

---

## Decisions so far

- **Hosting:** Vercel, for the app and three serverless functions.
- **Data:** a new Firebase project (Firestore + Google Auth) on the free plan. Quota is per project, so the expenses tracker is unaffected.
- **Game data:** IGDB, only through our own proxy (IGDB blocks browser calls and the secret must stay on the server).
- **Calendar:** a live subscription link (`.ics` feed), not a one-time download, so delays show up on their own.
- **Push:** Vercel cron + `web-push`, not Firebase Cloud Functions (those need the paid plan).
- **Completion instead of progress:** no progress percentage. Each game records which level you finished: Main story, Main + sides, or Platinum.

---

## Data model (Firestore)

```
users/{uid}
  calendarKey        secret string for the calendar link
  timezone           "Europe/Athens"
  notifyTime         "09:00"
  platforms[]        your platforms, shown first in pickers

users/{uid}/games/{igdbId}        one record per game you track
  // copied from IGDB, refreshed daily
  name, slug, coverId, genres[], developer
  platforms[]                     every platform it's on
  releaseDate        timestamp | null
  releasePrecision   "day" | "month" | "quarter" | "year" | "tbd"
  releaseLabel       "Mar 14 2027" / "Q3 2027" / "TBA"
  igdbSyncedAt

  // yours
  status             "wishlist" | "backlog" | "playing" | "shelved" | "completed"
  completion         "main" | "main_sides" | "platinum" | null
  myPlatform         the one you own or will buy it on
  hoursPlayed        optional
  rating             1–10, optional, asked for on completion
  notes
  notify             true = release alerts on
  addedAt, purchasedAt, startedAt, shelvedAt, completedAt, updatedAt

users/{uid}/pushSubscriptions/{id}
  endpoint, keys, device label
```

- **Completion:** shown as **Main story**, **Main + sides** or **Platinum**. You pick it when you mark a game Completed, and you can raise it later (e.g. Main story → Platinum). Library cards show it as a badge.
- **Release date per platform:** store the date for `myPlatform`, falling back to the earliest one.
- **Statuses:** `wishlist` means upcoming or not bought yet. The other four are for games you own. Changing status stamps the matching date.

## Screens

| Screen | What it shows |
|---|---|
| **Calendar** (home) | Upcoming releases from your wishlist. Month grid on desktop, scrolling list on phone. Countdowns ("in 12 days"). A group for vague dates ("Later in 2027", "TBA"). A "Subscribe in calendar" button that copies the link. |
| **Library** | Cover grid with filters for Playing / Backlog / Shelved / Completed, a completion badge on finished games, sorting by recent, name or release date. |
| **Search** | IGDB search as you type: cover, year, platforms. Add in one tap and pick a status. |
| **Game detail** | Large artwork, release info per platform, and your controls: status, completion, platform, hours, rating, notes, notify toggle. Trailer and screenshots. |
| **Settings** | Notifications on or off for this device, your platforms, copy or reset the calendar link, sign out. |

Navigation: bottom tab bar on mobile (Calendar, Library, Search), Settings behind an icon.

## Vercel functions

- **`/api/igdb`:** holds the Twitch secret, caches the access token, passes queries to IGDB.
- **`/api/calendar.ics?key=…`:** reads your games with the Firebase Admin SDK and returns the calendar feed.
- **`/api/cron/daily`:** refreshes release dates from IGDB in one batch, then sends pushes for releases today or tomorrow.

## Libraries

**Installed (Step 0):** Angular 22, Tailwind 4, TanStack Query, Firebase 12, Vitest.

**Added when the step needs them:**

| Library | Step | Why |
|---|---|---|
| `@angular/aria` | 1–2 | Accessible, unstyled combobox, listbox, tabs and menu. For search and the status picker. |
| Angular Signal Forms | 2 | Signal-based forms for the game detail editor. |
| `lucide-angular` | 1 | Icons. |
| `date-fns` v4 | 3 | Calendar grid, countdowns, vague dates. |
| `fast-average-color` | 2 | Tints the detail page with the cover's main colour. |
| `idb-keyval` | 1 | Small local cache, as in the expenses tracker. |
| `zod` v4 (server) | 1 | Checks IGDB responses in the proxy. |
| `ics` (server) | 3 | Builds the calendar feed. |
| `web-push` (server) | 4 | Sends notifications. |
| `firebase-admin` (server) | 3 | Reads Firestore from the functions. |

Already built in: router view transitions (on) and Angular's `animate.enter` / `animate.leave`.

## Open questions

- Should a game you're still playing also have a **target** completion level ("going for Platinum")? Easy to add as a second field if you want it.

## Log

- **2026-11-07:** Step 0 done. Angular 22 project created in this folder, TanStack Query and Firebase installed, build and tests pass. Git repo initialized, nothing committed yet. Replaced the progress percentage with a completion level.
