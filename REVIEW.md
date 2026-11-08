# For your review (2026-11-07)

What Claude built while you were away, what it needs from you, and the choices it made on its own. The plan and progress are in [PLAN.md](PLAN.md). Change anything here and Claude will follow it.

## 1. What I need from you, in order

1. ~~Publish the Firestore rules~~ Done.
2. ~~Untick "Enable create (sign-up)"~~ Done.
3. ~~Commit and push~~ Done on 2026-11-07.
4. ~~Deploy the hourly alert worker~~ Done.
5. ~~On the phone: add games, notifications, test, Subscribe~~ Done, all working.

## 2. Questions for you (answered 2026-11-07)

- **Target completion.** No target. Instead, marking a game Completed now always asks how far you got (Main story, Main + sides, Platinum); Cancel leaves the status as it was. Same when adding a game straight to Completed.
- **What the Calendar shows.** Kept: every upcoming game you track, except Completed and Shelved.
- **Wishlist in Library.** No answer yet; kept as a tab.
- **"New date" alerts.** Now sent for every game whose date moves, bell on or not.
- **Rating.** Kept on Completed games only.
- **Accent colour.** PlayStation blue, applied in the design pass with the `impeccable` skill (now copied into this repo).
- **App icon.** It still showed a default "G" on the phone; fixed and redrawn in the design pass.

**Your other requests (done):**
- Search shows the newest games first (upcoming ones on top), so "god of war" starts with God of War Laufey and ends with the 2005 original. Well-known games come before fan games and look-alikes, and other names count too ("gta" finds Grand Theft Auto VI).
- Countdowns always show the days: "in 5 weeks (36 days)", "in 6 months (194 days)".
- Search bar has a clear (ⓧ) button. Calendar rows show "Tue 8" without the month, since the month is the section heading ("Just released" keeps "Thu 29 Oct").
- **Pre-orders.** On an upcoming game's page, under **Pre-order**, turn on **Pre-ordered**. It moves the game from Wishlist to Backlog (you've bought it) and asks for price (€), store and order date, all optional, date pre-filled with today. They stay editable on the page. The Calendar says "Pre-ordered" and the Library cover gets a "Pre-ordered" badge. Turning it off moves the game back to Wishlist and clears the details.

**Answered**
- Calendar shows only upcoming releases (no Playing section).
- Pre-orders are marked on the game's page only; adding stays simple.
- Price and store for games bought after release: an owned game that's out has a **Purchase** section (Price, Bought from, Bought on). Moving a released game from Wishlist to Backlog, Playing or Completed on its page asks for them (optional). Adding from Search asks nothing extra. Moving a game back to Wishlist keeps what you entered, in case it was a mis-tap.

**Your notes from using the app (2026-11-08), done**
- **Pre-orders stay on the Wishlist.** Turning on Pre-ordered no longer changes the status, so you can see which upcoming games you want and have already pre-ordered (Calendar says "Pre-ordered", the Wishlist cover has a badge). When it's out and you move it to Backlog or Playing, you're not asked for the price again.
- **Completed on.** Completed games have an editable "Completed on" date. The Completed tab sorts by it (latest first) by default; each tab remembers its own sort. Library always opens on Completed (and keeps your tab while the app is open).
- **Library tabs and sorts.** Tabs go Completed, Wishlist, Backlog, Shelved, Playing. Default sorts: Completed by date completed and Wishlist by release date (soonest first), both split into years ("4 in 2026", its games, then the next year; Wishlist ends with "without a date" and "already out"); tap a year to fold it (remembered while the app is open). Playing by recent; Backlog and Shelved by newest release. Pick another sort and the tab remembers it on the phone.
- **Calendar subscription** lives only in Settings now (one tap: Add to Calendar app). You do it once and the calendar keeps itself updated.
- **DLC and expansions.**
  - A game's page lists its DLC and expansions (the first 6, then "Show all"), each showing whether you own it or finished it.
  - Tap one to open its page: On wishlist, Owned, then Completed with a date, and Price. There's no store for DLC.
  - DLC appears in Search with a "DLC" label right after its main game, and + adds it straight to your Wishlist.
  - On the Wishlist it's its own entry (with a DLC badge) and shows in the Calendar.
  - Once owned it's only on the DLC's and the main game's pages. Its completion date doesn't affect the Completed tab's order.
  - Turning Owned off removes the DLC from your library (after asking).

**New versions show up right away (2026-11-08).** iOS keeps the home-screen app in memory and resumes it, so after a deploy you'd keep seeing the old version until you fully closed it. Now, whenever the app comes back to the screen (and at most once a minute as you move between screens), it checks whether a newer version is live and, if so, reloads into it. Nothing is lost, since every change saves instantly. Versioned app files are also cached on the phone for good, which makes opening the app a bit faster.

**More from using the app (2026-11-08), done**
- **Physical copies.** A "Physical copy" switch under Purchase (owned games) and Pre-order (pre-ordered games, also in the pre-order sheet). Library covers show a disc badge in the top-right corner for physical games on Completed, Backlog, Shelved and Playing, and on pre-ordered Wishlist games.
- **Game page.** Trailer, Screenshots and About are gone. New, from IGDB: Time to beat (Main story / Main + sides / Completionist, your completion level in bold, your hours next to it), Scores (critics and players, out of 100; replaced by OpenCritic on 2026-11-08), the rest of the series (tappable like DLC), Details (genres, themes, modes, publisher, PEGI rating) and Links (official site, PlayStation Store, Steam, …).
- **Bought from.** A visible button next to the field opens a list of stores (yours first, then common ones); you can still type any store. The pre-order sheet shows them as tappable buttons.
- **Search.** Before you type: Most anticipated, Coming soon (next 60 days) and Recently released (last 60 days), on your default platform, as cover strips you scroll sideways.
- **PS4** is now a platform (game page "My platform" and Settings' default platform). Xbox is labelled "Xbox" to fit five.
- **"Just released"** on the Calendar keeps a game for 7 days after its exact release date; it drops off on day 8.

**Floating tab bar (2026-11-08).** The tab bar is now a frosted capsule floating above the content, like Apple Music, with the current tab in its own pill. It sits inside the app frame rather than pinned to the screen, because iOS 26 home-screen apps misplace bars pinned to the bottom edge. Worth a look on the phone, especially right after opening the app.

**Rating slider (2026-11-08).** Ratings go from 1 to 10 in half points (8.5, 7.5…). Slide your finger along the bar (or tap it); the value shows as you drag and saves when you let go. "Clear" removes it. Also: long press does nothing anywhere (no link previews or Save to Photos), and switching tabs no longer cross-fades the screen.

**Changelog notes (2026-11-08), done**
- Completed tab can sort by **Rating** (highest first, unrated last).
- **Just released**: 7 days.
- Every screen leaves room at the bottom so its last item clears the floating tab bar.
- **Notes**: one line when empty, grows as you write.
- **Price**: the € sits right next to the amount.
- **Selections** (status, completion, platforms, Library tabs) use the same blue as the rating bar.
- **Game page top**: no platforms line. Under the date you see your data: hours played, completed on, price, store, bought/ordered on, physical copy (anything empty is left out), and **Edit my data** opens a sheet to change them. Those fields are no longer edited inline; the Pre-order switch and Release alert stay on the page for upcoming games.

**Tweaks (2026-11-08).** Your platform is back next to the release date. The rating is locked (a thin line marks it, and scrolling over it changes nothing) until you tap **Edit**; then the round handle appears, with **Clear** and **Done**.

## 5. Design pass (Step 5)

- Done with the `impeccable` skill. You picked the standard iOS look, with Letterboxd and Things 3 as the bar. Brief: [PRODUCT.md](PRODUCT.md); design system: DESIGN.md.
- Blue is used sparingly: links, the active tab, switches, buttons, and the next release's countdown. Selected segments stay iOS grey (the native control), which keeps blue rare and the app clear of a PS5 look.
- Settings is now a tab. Subscribe sits in the Calendar's top bar.
- New blue app icon. After the deploy, delete and re-add the home-screen icon.

## 6. Suggestions

- **Rotate the secrets** that were pasted into chat earlier (Twitch client secret and the Firebase service-account key), then update `.env` and Vercel. Also delete the service-account JSON from Downloads.
- **Turn off Google** under Authentication → Sign-in method, and delete the leftover Google account (hatzidakis.slg@…) under Users if it was only a test.
- **Faster start:** let the service worker cache the app's files, so the home-screen app opens instantly and works offline. It's small, but caching can serve stale versions after a deploy if done carelessly, so I held off until the app is live.
- **Design pass (Step 5):** accent colour, cover-tinted backgrounds on the game screen, small touches like haptic-style press states.
