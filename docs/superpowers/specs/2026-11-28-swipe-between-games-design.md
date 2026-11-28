# Swipe between games

2026-11-28. Approved approach: the list hands over its order when you tap a game (option 1).

## Why

To browse. You open a game from one of your lists, then flick left and right through the rest of
that list without going back to it each time, the way you'd flick through photos.

## What it does

- **Where it works.** On a game's page, when you opened it from:
  - any Library game list (Completed, Wishlist, Backlog, Shelved), in the exact order you saw it,
    with that tab's sort, copies filter, Platinum filter and search text;
  - the Calendar, in list or card view, games only (events are skipped);
  - Now playing (the games you're playing, in the order its sheet shows them).
- **Where it doesn't.** A game opened from Search, from a link on another game's page (DLC,
  series), or straight from an address. Not on the trophy list, and not while Edit my data or any
  other sheet is open.
- **Swipe left: the next game. Swipe right: the previous one.** The page follows your finger. If
  you let go far enough (about a third of the width) or fast enough, it slides off and the next game
  slides in from the other side. If not, it springs back. At the first or last game it stretches a
  little and springs back.
- **Each game starts at the top**, however far down you'd scrolled on the last one.
- **The left edge stays the iPhone's Back.** A swipe that starts at the left edge isn't handled by
  the page.
- **Screenshots and Videos keep scrolling sideways.** A swipe that starts on one of those strips
  scrolls the strip.
- **The top bar doesn't move.** The Back button stays still and its small title shows the new
  game's name. The game's artwork slides with the page.
- **Back returns to the list in one step**, from the Back button or the edge swipe. Moving between
  games replaces the page in the history rather than adding one. The list then scrolls so the game
  you ended on is in view; if it's already on screen, nothing moves.

## Goals, non-goals, anti-goals

- **Goal:** browsing a list feels quick and direct, like flicking through photos.
- **Non-goals:**
  - swiping from Search or from links between games;
  - surviving a reload (if the app reloads on a game, swiping is off until you open a game from a
    list again);
  - showing the next game beside the current one while you drag;
  - a "4 of 23" counter (my call; easy to add later).
- **Anti-goals:**
  - a swipe that fights vertical scrolling: scrolling down a game's page must feel exactly as it
    does now;
  - swiping in a different order from the one on screen;
  - breaking the iPhone's edge swipe back.

## Approaches

1. **The list hands over its order on tap (chosen).** Library, Calendar and Now playing already hold
   the ordered list on screen; they give it to the game page in memory when you tap a game. It's
   always the order you saw, and there's no second copy of the sorting. Lost on reload, which is
   fine.
2. **The address carries the list** (`?from=backlog&sort=…`) and the game page rebuilds the order.
   It survives a reload, but the Library's and Calendar's ordering would have to be redone and kept
   in step on the game page, which is easy to get subtly wrong.
3. **The browser history holds the list.** It also survives a reload, but it has to be carried
   along at every replace, which is more fragile than 1 for little gain.

The gesture is hand-written, with no library (the options are old and heavy for one gesture). The
page lets the browser do vertical scrolling and handles sideways movement itself. Showing the next
game beside the current one while dragging was turned down: it means two game pages at once,
roughly twice the work.

## Constraints

- Mobile only. iPhone home-screen app first (iOS 26), Android too.
- No zoom, no sideways scroll of the page itself, and the safe areas respected.
- Only `<main>` scrolls (shell). The shell saves and restores scroll positions per address
  (shell.ts).
- The game page is one component reused between ids: its `id` comes in as an input and its data
  comes from TanStack queries keyed by id, so changing the id swaps the data.
- Smoothness on Android: no signal writes and no change detection on every moved frame. The drag
  moves a transform directly.
- `prefers-reduced-motion`: no slide; the game simply changes.

## My calls (correct any of these)

- **Folded year groups:** games in a year you've folded in the Library are skipped, since you didn't
  see them.
- **Now playing with one game:** that's a list of one, so there's nothing to swipe to.
- **Events are skipped:** a Calendar list swipes between its games only, not into event pages.
- **Loading ahead:** the games on either side are loaded in the background, so the next page's
  details and artwork are usually ready.
- **No indicator:** no dots and no counter.

## Left to the builder

- The exact thresholds and spring timing, and how sideways movement is told apart from vertical.
- Where the hand-over lives (a small service is the obvious place) and how it's cleared when a
  game is opened from somewhere else.
- How the list scrolls back to the last game you viewed after Back, working with the shell's scroll
  restore.
