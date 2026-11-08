---
name: Game Tracker
description: A native-feeling iOS dark app for one player's release calendar and game library.
colors:
  ground: "#000000"
  group: "#1c1c1e"
  raised: "#2c2c2e"
  pressed: "#3a3a3c"
  segment-thumb: "#636366"
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

# Design System: Game Tracker

## Overview

**Creative North Star: "The Native Shelf"**

Game Tracker is the category standard on purpose: it behaves and looks like a well-made iOS app in dark mode, so the owner's hands already know it. Large titles that hand off to a small centred title, inset grouped lists, segmented controls, switches, action sheets and a four-tab bar are used as iOS uses them, finished to the polish of Letterboxd and Things 3. Nothing is invented for its own sake.

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
- **Tint Blue** (accent): links, the active tab, the next release's countdown, the release-alert bell, text actions, focus rings and the caret. Text and icons on black and grouped surfaces only (5:1 on the group grey).
- **Sheet Blue** (accent-raised): the same tint, lifted so it still reads on raised surfaces: action-sheet choices, "Suggested", Cancel (5:1 on the raised grey).
- **Fill Blue** (accent-fill): the blue that carries white text or a white knob: the primary button, the "on" switch track, the confirm button in the pre-order sheet (5.2:1 under white).

### Neutral
- **True Black** (ground): the page, the frame behind the tab bar, the status-bar theme colour. Covers sit directly on it.
- **Group Grey** (group): inset grouped lists, notes field, trailer and screenshot placeholders.
- **Raised Grey** (raised): sheets, toasts, cover placeholders, inline date and time fields on group surfaces.
- **Pressed Grey** (pressed): a tapped row, and inline fields that sit on an already-raised sheet.
- **Thumb Grey** (segment-thumb): the selected segment. Grey, not blue, on purpose.
- **Bar Black** (tab-bar): the opaque tab bar, one step off true black so it reads as a bar.
- **Hairline** (separator): 0.5px inset separators, the top bar's bottom edge once solid, the tab bar's top edge.
- **Control Fill** (fill): segmented-control track and the search field.
- **Label White** (label): primary text.
- **Secondary Grey** (muted): secondary text, group headers and footers, placeholders, row values (5.9:1 on group, 7.3:1 on black).
- **Decoration Grey** (faint): disclosure chevrons and empty decoration only. Never text.
- **System Red** (danger): destructive rows (Remove, Sign Out, Make a new link), errors, the error toast icon.

### Named Rules
**The Contrast-Picks-the-Blue Rule.** The accent has three values and the surface decides which one: Tint Blue on black and group grey, Sheet Blue on raised sheets, Fill Blue whenever white sits on top. Never put Tint Blue text on a raised surface.

**The Rare Blue Rule.** Blue marks what you can act on and the one thing that is next. Selection states inside controls (segmented thumb) stay grey; only switches turn blue, as in iOS. If a screen looks blue, something is wrong.

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
- **Nav Title** (600, 17px): the game's name in the Game screen's solid top bar; also the weight of primary buttons and Cancel.
- **Body** (400, 17px/22px, -0.02em): row labels, inputs, text actions. All text inputs are 17px so iOS never zooms on focus.
- **Subhead** (400, 15px/20px): row subtitles (date · countdown · status), developer line, counts, toasts, inline errors.
- **Footnote** (400, 13px/18px, -0.005em): group headers (uppercase), group footers, sheet headings, row hints, platform lists.
- **Segment** (500, 13px/18px; 600 when selected): segmented-control labels; five-segment controls step down to 12.5px to fit a 390px phone.
- **Caption** (400, 12–13px/16px, normal tracking): names and meta under Library grid covers; 11px semibold for the badge on a cover.
- **Tab Label** (500, 10px): tab bar labels under 24px icons.

### Named Rules
**The Tabular Figures Rule.** Every date, countdown, count, rating and hour uses tabular numerals so columns of figures don't shimmer.

**The Countdown Holds Together Rule.** Countdowns always show days ("in 6 months (194 days)"), and each countdown never breaks across lines.

## Layout

A single phone-width column (max 28rem, centred on a desktop browser) inside a fixed app frame. The frame never scrolls; only the middle area does, vertically, and nothing may make the page wider than the screen. Sideways movement exists only inside the screenshot strip, which snaps per image and hides its scrollbar.

The page gutter is 16px. Grouped lists sit inside that gutter; rows are at least 44px tall with 11px by 16px padding and 12px gaps. Separators are inset 16px for text rows, 68px for rows that start with a 40px cover, 52px for rows that start with a 22px icon. Group headers sit 22px above their list; footers follow 7px below. The Library grid is three columns with 12px gutters and 20px between rows.

Only the Game screen has a top bar: 44px plus the safe-area inset, laid over the content, see-through over the hero art and solid with the game's name once the art has scrolled away, with the back button on the left. Tab screens have no bar: the large title scrolls away with the page. One-time actions (subscribing to the calendar) live in Settings, not on the tab screens. The tab bar is a normal row at the bottom of the frame, not a floating fixed bar, and uses only part of the home-indicator inset. Sheets keep an 8px margin from the screen edges and respect the bottom safe area.

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

Gently rounded, continuous iOS geometry. Corners grow with the size of the object: list thumbnails 5px, covers 6px, segments 7px, inline fields 8px, segmented tracks 9px, grouped lists and media 10px, primary buttons 12px, action sheets 14px, switches and toasts fully round. Covers are always 3:4 and carry a 0.5px inner white hairline (15% white) so dark box art doesn't melt into black. Trailers and screenshots are 16:9 at 10px. Lines are always hairlines (0.5px).

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
- **State:** the selected segment gets the Thumb Grey thumb, semibold label and a soft shadow; changes ease over 160ms.
- **Use:** Library's status filter, a game's status, completion, rating (1–10) and platform; the default platform in Settings.

### Switch
- **Style:** 51 by 31px pill, grey track off, Fill Blue track on, white 27px knob that slides 20px over 200ms with an iOS spring-like ease.

### Inputs / Fields
- **In rows:** borderless, transparent, right-aligned 17px values in the row (Price, Bought from, Hours played).
- **Date and time:** a small 8px-rounded chip one step up the grey ladder from its surface.
- **Search field:** 36px tall, Control Fill, 10px radius, leading muted search icon, its own clear button.
- **Notes:** a grouped-surface textarea, 17px.
- **Focus:** the global Tint Blue ring; the caret is Tint Blue.

### Navigation
- **Top bar (Game screen only):** see-through at rest; turns into a 90% near-black blurred bar with a hairline at the same moment its small centred 17px semibold title fades in (200ms). Back button: a 36px blurred dark circle over art, plain Tint Blue chevron once solid.
- **Tab bar:** four tabs (Calendar, Library, Search, Settings), opaque Bar Black with a hairline top edge, 24px Lucide icons over 10px labels; the active tab is Tint Blue.

### Action Sheet
iOS action sheet from the bottom: choices in one 14px-rounded raised group (94% Raised Grey with blur), Cancel in its own group below, 57px rows, Sheet Blue text, a muted 13px heading with the game's name in semibold. Slides up over 280ms; the backdrop dims to 50% black and dismisses on tap.

### Cover
The signature element: 3:4 box art, 6px radius (5px at list size), hairline inner edge, Raised Grey placeholder that shows the game's name when IGDB has none. In the Library grid it may carry one small blurred black badge at its bottom-left (completion level or Pre-ordered).

### Toast
A rounded pill of raised grey with blur and a floating shadow, just above the tab bar: a check (Tint Blue) or alert (System Red) icon and a 15px message. Rises in over 220ms; tap to dismiss.

## Do's and Don'ts

### Do:
- **Do** start every tab screen with a 34px bold large title, its action on the right of the same row, and let both scroll away. **Don't** add a collapsing bar to tab screens.
- **Do** put lists in inset grouped sections (10px radius, Group Grey, 0.5px inset separators, 44px minimum rows).
- **Do** lead list rows with the game's cover, and keep covers 3:4 with their hairline edge.
- **Do** choose the blue by its background: Tint Blue on black and group, Sheet Blue on raised sheets, Fill Blue under white.
- **Do** use the native control for the job: segmented control for one-of-few, switch for on/off, action sheet for a choice.
- **Do** set text inputs at 17px and every figure in tabular numerals.
- **Do** use Lucide icons for every icon.

### Don't:
- **Don't** colour the selected segment blue; the thumb is Thumb Grey.
- **Don't** add glow, neon, RGB effects, or anything that echoes the PS5 interface or Sony's branding.
- **Don't** add imagery other than game art (covers, screenshots, trailers).
- **Don't** use Decoration Grey for text.
- **Don't** float the tab bar over content with a fixed position or make it translucent; it is an opaque row.
- **Don't** add shadows to static surfaces; step up the grey ladder instead.
- **Don't** let anything scroll sideways except the screenshot strip.
