---
version: 1
slug: "src-app-shell-shell-html"
primary_target: "src/app/shell/shell.html"
related_targets: ["src/app/pages/library/library.html","src/app/pages/calendar/calendar.html","src/app/pages/search/search.html","src/app/pages/game/game.html","src/app/pages/settings/settings.html"]
---

## Scope

The whole app shell and its five screens: Library, Calendar, Search, Game, Settings, plus the login screen, the choice sheet and toasts. Mode: Operate. Phone only (390–430 px wide), dark.

## Audience and job

One PS5-first player on an iPhone, short visits: see what's next and what they're playing, update a game after a session. Every change saves instantly.

## Direction contract

THESIS: The category standard on purpose: a native-feeling iOS dark app (large titles, grouped inset lists, a solid tab bar, system font), finished to Letterboxd and Things 3 polish. Game art (covers, and on the game screen a screenshot backdrop, as on a Letterboxd film page) is the only imagery; covers lead every list. Refuses invented world-building, gamer styling and anything that imitates the PS5 interface.

OWN-WORLD: True black ground, grouped surfaces in iOS dark greys (#1C1C1E, #2C2C2E), inset hairline separators, white primary labels and iOS secondary greys. One accent, a PlayStation-like blue (not Sony's brand value), used for tint: links, the active tab, switches, primary buttons and the next release. Values set by contrast: #4C86FF for text on black and grouped surfaces, #6A9BFF on raised sheets, #2462E8 behind white text. Deviation, recorded: selected segments use the iOS grey thumb (#636366), not blue, because that is the native control and keeps blue rare (guards against a PS5 look). System font (SF Pro via -apple-system) with tabular numerals for dates and counts. Covers 3:4 with small radius and a hairline edge. Lucide for every icon; stroke weight by role (1.5 empty states, 1.75 tab bar and row icons, 2 inline glyphs, 2.25–2.5 chevrons and small controls).

STORY: Open the app and in one glance see the games in progress and the next release with its countdown. Tap a game to change its status, completion, rating, hours or alert. Search finds the newest games first; adding takes the + then a status choice (two taps, a third for completion when adding straight to Completed). The app opens on Calendar; games in progress live on Library › Playing (a Playing section on Calendar is an open question for the user).

FIRST VIEWPORT: Each tab screen opens with an iOS large title (no actions beside it; subscribing to the calendar is one-time, so it lives in Settings), which scrolls away with the page, with no collapsing bar (user's call: the tab bar already says where you are). Only the Game screen has a top bar (back button, then the game's name once the art scrolls away). Library: a segmented control for the five statuses under the title, then a cover grid. Calendar: grouped inset sections per month, each row a cover, name, date and countdown, with the next release's countdown in blue. Tab bar at the bottom, opaque (iOS 26 misplaces fixed bars, so it is a normal row), four tabs, blue when active. The Game screen's bar turns solid exactly when its title appears. Countdowns always show days ("in 6 months (194 days)"), at the user's request.

FORM: canon (the category standard, chosen by the user); references Letterboxd and Things 3. seed:d13569e65fe0a07b

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

No sideways scrolling, no pinch zoom, iPhone safe areas, inputs ≥16px, fast on the phone. Not a PS5 clone, no neon or "gamer" styling.
