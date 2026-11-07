# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A mobile-only web app, installed to the iPhone home screen (PWA). On a PC it shows the same phone layout.

## Users

One person: the owner, a PS5-first player who also plays on Xbox, PC and Switch 2. Uses it on an iPhone (14 Pro Max, iOS 27), usually in short visits: a quick look at what's coming out, or a quick update after a play session. Sign-up is off; there is no second user.

## Product Purpose

Game Tracker puts two things in one place: a calendar of upcoming releases the owner cares about, and a library of the games they own and play, with how far they got (Main story, Main + sides, Platinum). Both jobs matter about equally. Success: the owner never misses a release they wanted, and always knows what they're playing, what's in the backlog and what they finished.

## Positioning

A personal tracker shaped around one player's habits rather than a social catalogue: PS5 first, completion levels instead of star counts, release alerts at a time the owner chose, and the release calendar inside the iPhone Calendar.

## Operating Context

- Opened from the home screen, one-handed, often for under a minute.
- Game data (names, covers, screenshots, trailers, release dates) comes from IGDB. Covers and screenshots are the main imagery.
- Release alerts arrive as push notifications; a calendar feed adds exact release days to the iPhone Calendar.

## Capabilities and Constraints

- Screens: Library (Playing, Backlog, Wishlist, Shelved, Completed), Calendar (just released, by month, later, TBA), Search, Game, Settings.
- Mobile only: no desktop layouts, no sideways scrolling anywhere, no pinch zoom, respect iPhone safe areas.
- Text inputs at 16px or larger so iOS doesn't zoom on focus.
- Must stay fast on the phone: nothing heavy or sluggish.
- Stack: Angular 22, Tailwind 4, Firebase, Vercel.

## Brand Commitments

- Name: Game Tracker.
- Dark, cool interface with one accent colour: PlayStation blue. Glow only on press or focus, never as decoration.
- Standing preference (chosen 2026-11-07): the category standard, a native-feeling iOS app, rather than an invented visual world. Quality bar: Letterboxd and Things 3.
- Must not look like a copy of the PS5 interface or use Sony's branding. Not flashy or "gamer" styled: no neon, RGB effects or "epic" language.

## Evidence on Hand

- Real game data from IGDB at runtime. No marketing content, screenshots of the app, or testimonials exist, and none are needed.
- App icon: a placeholder (white gamepad on dark grey) in `public/icons/`.

## Product Principles

1. A glance should answer the question: what's next, what am I playing.
2. Game art leads; the interface frames it and stays quiet.
3. Every change saves instantly; no Save buttons.
4. Personal, not social: no feeds, scores from others or sharing.
