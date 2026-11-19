---
name: Questloggd
description: A native-feeling iOS dark app for one player's release calendar and game library.
colors:
  ground: "#000000"
  group: "#1c1c1e"
  raised: "#2c2c2e"
  pressed: "#3a3a3c"
  segment-thumb: "#2462e8"
  tab-bar: "#121214"
  separator: "rgb(84 84 88 / 0.65)"
  fill: "rgb(118 118 128 / 0.24)"
  label: "#ffffff"
  muted: "#98989f"
  faint: "#48484a"
  accent: "#4c86ff"
  accent-raised: "#6a9bff"
  accent-fill: "#2462e8"
  danger: "#ff453a"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
    letterSpacing: "0.011em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "29px"
    letterSpacing: "0.005em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "24px"
  nav-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "-0.02em"
  subhead:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.02em"
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "-0.005em"
  segment:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "-0.01em"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0em"
  tab-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0em"
rounded:
  cover-sm: "5px"
  cover: "6px"
  segment: "7px"
  field: "8px"
  track: "9px"
  group: "10px"
  button: "12px"
  sheet: "14px"
  pill: "999px"
spacing:
  hairline: "0.5px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  group-gap: "22px"
  row-min: "44px"
  cover-row-inset: "68px"
components:
  button-primary:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.label}"
    typography: "{typography.nav-title}"
    rounded: "{rounded.button}"
    height: "50px"
    width: "100%"
  grouped-list:
    backgroundColor: "{colors.group}"
    rounded: "{rounded.group}"
  row:
    backgroundColor: "{colors.group}"
    textColor: "{colors.label}"
    typography: "{typography.body}"
    padding: "11px 16px"
    height: "44px"
  row-pressed:
    backgroundColor: "{colors.pressed}"
  group-header:
    textColor: "{colors.muted}"
    typography: "{typography.footnote}"
    padding: "22px 16px 7px"
  segmented:
    backgroundColor: "{colors.fill}"
    rounded: "{rounded.track}"
    padding: "2px"
  segmented-selected:
    backgroundColor: "{colors.segment-thumb}"
    textColor: "{colors.label}"
    typography: "{typography.segment}"
    rounded: "{rounded.segment}"
    height: "28px"
  switch:
    backgroundColor: "rgb(120 120 128 / 0.32)"
    rounded: "{rounded.pill}"
    width: "51px"
    height: "31px"
  switch-on:
    backgroundColor: "{colors.accent-fill}"
  search-field:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.label}"
    typography: "{typography.body}"
    rounded: "{rounded.group}"
    height: "36px"
  inline-field:
    backgroundColor: "{colors.raised}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "4px 10px"
  cover:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.cover}"
  action-sheet:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.accent-raised}"
    rounded: "{rounded.sheet}"
    height: "57px"
  toast:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.label}"
    typography: "{typography.subhead}"
    rounded: "{rounded.pill}"
    padding: "10px 16px 10px 12px"
  tab-bar:
    backgroundColor: "{colors.tab-bar}"
    textColor: "{colors.muted}"
    typography: "{typography.tab-label}"
    height: "50px"
  tab-bar-active:
    textColor: "{colors.accent}"
---

# Design System: Questloggd

## Overview

**Creative North Star: "The Native Shelf"**

Questloggd is the category standard on purpose: it behaves and looks like a well-made iOS app in dark mode, so the owner's hands already know it. Large titles that hand off to a small centred title, inset grouped lists, segmented controls, switches, action sheets and a four-tab bar are used as iOS uses them, finished to the polish of Letterboxd and Things 3. Nothing is invented for its own sake.

The interface is quiet and the game art is loud. Covers lead every list row and fill the Library grid; the Game screen opens on a full-bleed screenshot that fades into the black page under a see-through top bar. Everything else is true black, iOS dark greys, white labels and one blue accent, used sparingly enough that the next release's countdown is the thing your eye lands on.

Density is phone-native: 17px body, 44px minimum rows, a 16px page gutter, and a single scrolling column that never scrolls sideways. It refuses gamer styling, neon or RGB glow, and anything that imitates the PS5 interface or Sony's branding.

**Key Characteristics:**
- True black ground with stepped iOS grey surfaces; depth by tone, not shadow.
- One blue accent, with three values chosen by contrast against what sits behind it.
- System font (SF Pro via -apple-system) and tabular figures for every date, count and hour.
- Covers 3:4 with a small radius and a hairline edge; game art is the only imagery.
- Native controls (segmented, switch, action sheet, tab bar) rather than custom ones.

## Colors

A near-monochrome dark palette in Apple's grey ladder, cut by one cool, PlayStation-like blue that is not Sony's brand value.

### Primary
- **Tint Blue** (accent): links, the active tab, the next release's countdown (one game, blue in the Calendar and the Library alike, and the only blue in a Calendar row; the release-alert bell there is a grey outline), text actions, focus rings and the caret. Text and icons on black and grouped surfaces only (5:1 on the group grey).
- **Sheet Blue** (accent-raised): the same tint, lifted so it still reads on raised surfaces: action-sheet choices, "Suggested", Cancel (5:1 on the raised grey).
- **Fill Blue** (accent-fill): the blue that carries white text or a white knob: the primary button, the "on" switch track, the confirm button in the pre-order sheet (5.2:1 under white).

### Neutral
- **True Black** (ground): the page, the frame behind the tab bar, the status-bar theme colour. Covers sit directly on it.
- **Group Grey** (group): inset grouped lists, notes field, cover placeholders.
- **Raised Grey** (raised): sheets, toasts, cover placeholders, inline date and time fields on group surfaces.
- **Pressed Grey** (pressed): a tapped row, and inline fields that sit on an already-raised sheet.
- **Thumb Grey** (segment-thumb): the selected segment. Grey, not blue, on purpose.
- **Tab Glass** (tab-bar): the floating tab bar, rgb(36 36 38 / 0.74) with a 24px blur and 180% saturation, on its own compositing layer so its look stays constant while pages change underneath.
- **Hairline** (separator): 0.5px inset separators, the floating tab bar's outline and the top bar's glass back button.
- **Control Fill** (fill): segmented-control track and the search field.
- **Label White** (label): primary text.
- **Secondary Grey** (muted): secondary text, group headers and footers, placeholders, row values (5.9:1 on group, 7.3:1 on black).
- **Decoration Grey** (faint): disclosure chevrons and empty decoration only. Never text.
- **System Red** (danger): destructive rows (Remove, Sign Out, Make a new link), errors, the error toast icon.

### Named Rules
**The Contrast-Picks-the-Blue Rule.** The accent has three values and the surface decides which one: Tint Blue on black and group grey, Sheet Blue on raised sheets, Fill Blue whenever white sits on top. Never put Tint Blue text on a raised surface.

**The Rare Blue Rule.** Blue marks what you can act on and the one thing that is next. Selected segments (status, completion, platforms, Library tabs), switches and the rating slider share the one blue fill, so every choice reads the same way (the owner's call, 2026-11-08). Beyond those, if a screen looks blue, something is wrong.

**The Faint-Is-Not-Text Rule.** Decoration Grey fails as text and is reserved for chevrons and empty marks.

## Typography

**Display Font:** SF Pro via -apple-system (with BlinkMacSystemFont, system-ui, Segoe UI, Roboto)
**Body Font:** the same system stack
**Label/Mono Font:** none; figures switch to tabular numerals instead

**Character:** One family, Apple's own, at Apple's own sizes and tracking. Hierarchy comes from size and weight steps, never from a second face.

### Hierarchy
- **Large Title** (700, 34px/41px, +0.011em): the first line of every tab screen; it scrolls away with the page (tab screens have no top bar; you already know which tab you're on).
- **Title** (700, 24px/29px, +0.005em, balanced wrapping): the game's name on the Game screen, next to its cover.
- **Headline** (600, 20px/24px): empty-state headings.
- **Nav Title** (700, 17px): the game's name, centred in the top bar once you scroll. Primary buttons and Cancel use 600.
- **Body** (400, 17px/22px, -0.02em): row labels, inputs, text actions. All text inputs are 17px so iOS never zooms on focus.
- **Subhead** (400, 15px/20px): row subtitles (date · countdown · status), developer line, counts, toasts, inline errors.
- **Footnote** (400, 13px/18px, -0.005em): group headers (uppercase), group footers, sheet headings, row hints, platform lists.
- **Segment** (500, 13px/18px; 600 when selected): segmented-control labels; five-segment controls step down to 12.5px to fit a 390px phone.
- **Caption** (400, 12–13px/16px, normal tracking): names and meta under Library grid covers; 11px semibold for the badge on a cover.
- **Tab Label** (600, 10.5px): tab bar labels under 24px icons.

### Named Rules
**The Tabular Figures Rule.** Every date, countdown, count, rating and hour uses tabular numerals so columns of figures don't shimmer.

**The Countdown Holds Together Rule.** Countdowns are only ever in days ("in 194 days", never weeks or months), and each countdown never breaks across lines.

## Layout

A single phone-width column (max 28rem, centred on a desktop browser) inside a fixed app frame. The frame never scrolls; only the middle area does, vertically, and nothing may make the page wider than the screen. Sideways movement exists only inside the screenshot strip, which snaps per image and hides its scrollbar.

The page gutter is 16px. Grouped lists sit inside that gutter; rows are at least 44px tall with 11px by 16px padding and 12px gaps. Separators are inset 16px for text rows, 68px for rows that start with a 40px cover (the Calendar's too: compact so a screenful shows about seven), 52px for rows that start with a 22px icon. Group headers sit 22px above their list; footers follow 7px below. The Library grid is three columns with 12px gutters and 20px between rows.

Only screens with a back button (the Game screen, Gaming events) have a top bar: 56px plus the safe-area inset, laid over the content. The back button is a 44px round frosted-glass button (the tab bar's glass, white chevron), the same over the art and after scrolling. Once you scroll, the page fades and blurs into the top of the screen behind it, with no hard edge or line (like iOS 26), and the bold title appears in the middle. Tab screens have no bar: the large title scrolls away with the page. One-time actions (subscribing to the calendar) live in Settings, not on the tab screens. The tab bar floats: a capsule inset 16px from the sides, just above the home indicator (bottom: the safe-area inset minus 14px, at least 12px), over the content, which scrolls underneath it. It is positioned inside the app frame, never pinned to the screen with `position: fixed; bottom: 0` (iOS 26 misplaces those in home-screen apps). Pages leave `--tab-bar-space` plus 16px at the bottom so their last item clears it. Sheets keep an 8px margin from the screen edges and respect the bottom safe area.

## Elevation & Depth

Flat by default, with depth carried by tone: black page, group grey lists, raised grey sheets, pressed grey on touch. Shadows appear only where iOS itself puts them: under the selected segment and the switch knob, under floating toasts, and under the Game screen's cover where it overlaps the hero art. Blur is a material, not decoration: the solid top bar, sheets, toasts and the overlay back button blur what is behind them.

### Shadow Vocabulary
- **Segment thumb** (`box-shadow: 0 3px 8px rgb(0 0 0 / 0.12), 0 3px 1px rgb(0 0 0 / 0.04)`): the selected segment only.
- **Switch knob** (`box-shadow: 0 3px 8px rgb(0 0 0 / 0.15), 0 3px 1px rgb(0 0 0 / 0.06)`): the white switch knob.
- **Floating toast** (`box-shadow: 0 8px 28px rgb(0 0 0 / 0.5)`): toasts above the tab bar.
- **Hero cover** (`box-shadow: 0 10px 30px rgb(0 0 0 / 0.6)`): the Game screen cover lifting off its backdrop.

### Named Rules
**The Tone-Not-Shadow Rule.** A new surface steps up the grey ladder (group, raised, pressed); it does not get a shadow. Shadows are for things that float over other content.

## Shapes

Gently rounded, continuous iOS geometry. Corners grow with the size of the object: list thumbnails 5px, covers 6px, segments 7px, inline fields 8px, segmented tracks 9px, grouped lists and media 10px, primary buttons 12px, action sheets 14px, switches and toasts fully round. Covers are always 3:4 and carry a 0.5px inner white hairline (15% white) so dark box art doesn't melt into black. The game screen's hero and gaming events' logos are the only 16:9 images. Game covers also badge a physical copy with a small round disc icon, top right. Lines are always hairlines (0.5px).

## Components

### Buttons
Calm and full-width, as iOS puts them at the end of a form.
- **Shape:** gently rounded (12px), 50px tall, full width.
- **Primary:** Fill Blue with white semibold label; an icon may lead it (Add to Library with a plus).
- **Pressed / Disabled:** darkens slightly (brightness 0.9) on press; 60% opacity when disabled. Focus is the global 2px Tint Blue ring offset by 2px.
- **Text actions:** most actions are plain Tint Blue 17px text (Search games, Forgot password?, More) that dims to 60% on press. Destructive actions are centred System Red rows in their own group.

### Grouped Lists
The backbone of every screen, as in iOS Settings.
- **Corner Style:** 10px, clipping its rows.
- **Background:** Group Grey; rows highlight Pressed Grey on tap.
- **Separators:** 0.5px inset hairlines between rows, never above the first.
- **Rows:** a leading cover or icon, a label with an optional 15px muted subtitle, a trailing value, switch or faint chevron.
- **Headers / Footers:** 13px muted uppercase header above, 13px muted note below.

### Segmented Control
- **Style:** Control Fill track, 2px padding, 9px radius; equal-width segments 28px tall.
- **State:** the selected segment gets the blue fill (#2462e8) with a white semibold label and a soft shadow; changes ease over 160ms.
- **Use:** Library's status filter, a game's status, completion, rating (1–10) and platform; the default platform in Settings.

### Switch
- **Style:** 51 by 31px pill, grey track off, Fill Blue track on, white 27px knob that slides 20px over 200ms with an iOS spring-like ease.

### Inputs / Fields
- **In rows:** borderless, transparent, right-aligned 17px values in the row (Price, Bought from, Playtime hours and minutes).
- **Date and time:** a small 8px-rounded chip one step up the grey ladder from its surface.
- **Search field:** 36px tall, Control Fill, 10px radius, leading muted search icon, its own clear button.
- **Notes:** a grouped-surface textarea, 17px.
- **Focus:** the global Tint Blue ring; the caret is Tint Blue.

### Navigation
- **Top bar (Game screen only):** see-through at rest; turns into a 90% near-black blurred bar with a hairline at the same moment its small centred 17px semibold title fades in (200ms). Back button: a 36px blurred dark circle over art, plain Tint Blue chevron once solid.
- **Tab bar:** four tabs (Calendar, Library, Search, Settings) in a floating Tab Glass capsule (fully round, 0.5px white outline, soft shadow, faint top highlight), 24px Lucide icons over 10.5px semibold labels. The active tab is Tint Blue over a single lighter pill (10% white) that slides between tabs (transform, 320ms, iOS spring-like ease) and hides off the tabs (a game's page). The bar itself never animates.
- **Logo:** the loggd mark, a joined "gg" whose first bowl is a progress ring three-quarters full (clockwise from the top; the last quarter a 30% track), in rounded strokes like Lucide. In the app it lives inside the **Questloggd wordmark** (shared/wordmark.ts): "Questlo", the mark in Tint Blue, then "d", 24px bold, the mark sized in ex so its bowls match the x-height. The four tab screens (Calendar, Library, Search, Settings) open with one row (shared/tab-title.ts): the wordmark on the left and the 34px large title pinned right, on one baseline. Pushed screens keep a plain large title. The login page heads with the wordmark at 28px. The home-screen icon, favicon and login mark are the mark alone in white (35% track) on Fill Blue, full bleed (public/icons/icon.svg; iOS rounds the corners).

### Action Sheet
iOS action sheet from the bottom: choices in one 14px-rounded raised group (94% Raised Grey with blur), Cancel in its own group below, 57px rows, Sheet Blue text, a muted 13px heading with the game's name in semibold. Slides up over 280ms; the backdrop dims to 50% black and dismisses on tap. A sheet may carry a muted 13px message under its heading when the choice needs saying what happens ("Add all" says what goes where). "Edit my data" is the same raised sheet with a form; adding a PlayStation game opens it in an add mode (Backlog, Shelved or Completed, never Wishlist; how far you got and the rating for Completed; purchase details), its button saying Add. "Edit my data" on a game's page also has two groups under the fields, each with a muted 13px heading or row. Scores: Critic score, Critics, User score and Users (each score out of 100 and how many it's from, empty fields hinting what's shown now), for the few games OpenCritic matches wrong; then a Sheet Blue row, "Check OpenCritic now", which asks right away without closing the sheet, its answer under it in 13px muted text ("Up to date: 99 (Mighty) from 61 top critics."), while the Scores card updates behind the sheet. HowLongToBeat: a Sheet Blue row with its icon opening its search, then Main story, Main + extra and Completionist as hours and minutes, like Playtime. Cancel and Save stay at the foot of the screen when the sheet is taller than it.

### Cover
The signature element: 3:4 box art, 6px radius (5px at list size), hairline inner edge, Raised Grey placeholder that shows the game's name when IGDB has none. In the Library grid it carries small blurred black badges: OpenCritic's Top Critic Average top left, as a white number in a ring filled as far as the score and coloured by OpenCritic's tier (84 and up green, 75–83 yellow, 67–74 orange, under 67 red: iOS dark-mode system green #30d158, yellow #ffd60a, orange #ff9f0a, red #ff453a), one of two places colours other than the blue accent appear (the other: trophy grades on a game's page, as small trophy icons in bronze #d39a6a, silver #c9d0d8, gold #e8c04a and platinum #a9c8ee, each 4.5:1 or more on black); a disc top right for a physical copy; the playtime (or DLC / Pre-ordered, only while on the Wishlist: a pre-order that's out is just a game you own) bottom left; and a round trophy bottom right for Platinum, the same size as the disc above it. Calendar rows are too small for badges: Owned, Playing or DLC follow the date in the grey line (Playing also keeps the blue outline), and a pre-order (a box with a clock, drawn in Lucide's style; Lucide has none; shared/preorder-icon.ts) and a release alert (bell) are 16px grey icons on the right. The Calendar shows no physical-copy disc: pre-orders are physical for now. A button in its toolbar (blue when on, remembered on this device) switches the rows to the Library's cards, three or four a row (a second button, shown with cards), all in one grid in calendar order with no month headers: a game's cover with the pre-order badge top left, the bell top right and how long until it's out bottom left ("5 days", "Tomorrow", blue for the next release); under it its name, then the date with its month ("Thu 19 Nov"; "12 Feb 2027" in other years; "Nov 2027" without a day) and Owned, Playing or DLC. An event's logo with how long until it starts ("Today"); under it its name, day with its month, and time.

Gaming events use IGDB's logo, which is wide (16:9): filling a wide frame in Search's lists and strips, the game page's Shown at list and the event's page; shown whole over a blurred copy of itself wherever events sit among game covers, in the cover's own 3:4 shape (the Library's Events cards, Calendar rows at 80px, Settings → All events at 40px). An event you made yourself has its host's icon in white on Raised Grey, like a cover without art, so events never outshout the covers; the host's colours appear only in the host picker of the event sheet, where they help you choose.

### Toast
A rounded pill of raised grey with blur and a floating shadow, just above the tab bar: a check (Tint Blue) or alert (System Red) icon and a 15px message. Rises in over 220ms; tap to dismiss.

### PlayStation games
Settings → PlayStation → Games lists every PlayStation game, "Not in your library" first, then Matched, as rows led by a 40px cover (the library game's, or the IGDB game it was found as) with a small round Platinum badge bottom right for a Platinum you earned. Under the name: playtime, PS5 or PS4, and the library game it's matched to or "Not found on IGDB". While some games can be added, a Tint Blue row with a list-plus icon leads the page, "Add all N to Library", with "Platinumed games go to Completed, the rest to the Backlog" under it; Settings → PlayStation shows the same action under its Games row. Tapping a game not in the library opens an action sheet: Add to Library ("As …" when IGDB's name differs), Choose another game (IGDB results with year and platforms) and It's already in my Library… (the match picker). Tapping a matched game changes its match.

### First-time setup
A full screen without the tab bar (/setup), after sign-up with a PlayStation name or linking one with an empty library: the wordmark and "Not now" on top, then "Step 1 of 3 · Completed" (13px muted uppercase), the question as a 28px bold title, a 15px muted hint, "N of M marked" with Mark all / Clear, and the PlayStation games as a three-a-row cover grid, most played first, names (two lines) and playtime under each. Tapping a cover marks it as iOS's photo picker does: an empty white ring top right becomes a Fill Blue check, and the cover gets a 2px Tint Blue outline. Each step shows only the games not marked before. A blurred bar fixed at the bottom holds Back (Raised Grey, Sheet Blue text) and the primary Next ("Next: Shelved", "Review", "Add 82 games"). The summary is a grouped list of the three counts with a footer saying how many are left out.

### Sign-up and invites
Settings → Friends makes a one-time invite link, shown in a grouped row (13px, selectable) with Share link, Copy link and New link for another friend. The link opens the sign-up page, laid out like the login page (icon, wordmark heading, grouped Email and Password rows, primary button): the password's rules sit under its group as a 13px checklist (a Tint Blue check once met, a Decoration Grey circle until then), then an optional PlayStation Online ID in its own group.

## Do's and Don'ts

### Do:
- **Do** start every tab screen with its header row (the Questloggd wordmark on the left, the 34px bold large title pinned right, on one baseline) that scrolls away; a screen's actions and counts sit in one row under its search field (Library: count, sort, reverse, filters, four a row; Calendar: count, cards, four a row and + Event). **Don't** add a collapsing bar to tab screens.
- **Do** put lists in inset grouped sections (10px radius, Group Grey, 0.5px inset separators, 44px minimum rows).
- **Do** lead list rows with the game's cover, and keep covers 3:4 with their hairline edge.
- **Do** choose the blue by its background: Tint Blue on black and group, Sheet Blue on raised sheets, Fill Blue under white.
- **Do** use the native control for the job: segmented control for one-of-few, switch for on/off, action sheet for a choice.
- **Do** set text inputs at 17px and every figure in tabular numerals.
- **Do** use Lucide icons for every icon.
- **Do** stack a game's header as name, release date (with its countdown), then Developer · Publisher, bottom-aligned with the cover so the name rises as lines are added. Your platform lives in the My platform setting, not beside the date. A pencil at the far right of the name's first line opens "Edit my data", the only place the status and rating change (status, how far you got, rating, hours, purchase details; the fields follow the status picked). On the page the status is the first value of the Progress card, and your rating sits in the Scores card.
- **Do** give what matters on a game's page room to breathe, filling the first screen so Shown at and the rest are a scroll away: up to four grouped cards under the header, each a few big values (17px semibold) with a small caption under each (13px muted), only what there is. Progress (the day you completed it over "Completed", or your status; Completion; playtime: PlayStation's with its logo); Trophies (earned of all, the percentage, a bar as full as the progress, then each grade's coloured trophy with earned/total); Scores (OpenCritic's ring opening its reviews with how many critics, the players' score with how many, your rating; scores typed in by hand look the same, with how many critics and users when typed in (otherwise captioned Critics and Players), never a link; no card at all without a critic or players' score, as before release); HowLongToBeat (Main story, Main + extra and Completionist as typed in from it, in the same three columns as the Scores card so they line up, "–" for one not typed in; no card until a time is in, and no link: "Edit my data" has it); Purchase (paid, store, bought or preordered on, physical or digital, two by two). Last played is not shown. Further down, Screenshots, Videos, Details and Links start folded, opened by their headings: screenshots and videos in strips that scroll sideways inside themselves (85% wide, 16:9, 10px radius), a screenshot opening full size, a video playing in place (YouTube, no cookies) from its thumbnail with a round blurred play button, its name under it.
- **Do** grow long lists with "Show N more", adding as many again as are showing (or what is left), never "Show all".
- **Do** let the Library show four cards a row (the grid button at the end of its toolbar, remembered on this device) with the same details: smaller badges, and time played as whole hours rounded up ("138h"). Pills show a short name where the full one is long ("Date" for Date completed, "Release" for Release date) so the count always fits.
- **Do** show any list of games or events (a company's games, a game's DLC and expansions, Shown at and series, an event's games, Settings → Gaming events) as the shared card grid (shared/card-grid.ts): five cards a row; under a game's cover its year (or Cancelled) and your status, a Platinum trophy on the cover; under an event's logo its name (two lines at most) and date ("13 Dec" this year, "Dec 2024" otherwise); cancelled games and archived events greyed out. A toolbar row above it: the list's name and count (uppercase like a section header, or "80 games" when it's the page's only list) and a filter pill whose menu lists only filters that would leave something out, grouped (Year, Company) where there are many. Rows stay for the Calendar (kept compact) and Search's results (each has its + Add button). A company's details sit in short icon lines like a game's "my data", not a table.

### Don't:
- **Don't** colour the selected segment blue; the thumb is Thumb Grey.
- **Don't** add glow, neon, RGB effects, or anything that echoes the PS5 interface or Sony's branding.
- **Don't** add imagery other than game art (covers and the game screen's screenshot backdrop).
- **Don't** use Decoration Grey for text.
- **Don't** float the tab bar over content with a fixed position or make it translucent; it is an opaque row.
- **Don't** add shadows to static surfaces; step up the grey ladder instead.
- **Don't** let anything scroll sideways except the screenshot strip.
