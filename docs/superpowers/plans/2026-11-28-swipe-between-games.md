# Swipe Between Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a game's page opened from a Library list, the Calendar or Now playing, swiping
sideways moves through that list, with the page following your finger.

**Architecture:** A root `BrowseService` holds the ordered ids that the list hands over on tap,
plus the game you're on. A small hand-written gesture (`attachSwipe`) on the game page's host
moves it with your finger, then calls back to change game. The game page navigates with
`replaceUrl` and slides the new game in. The shell asks the service, after Back, which game to
scroll into view.

**Tech Stack:** Angular (zoneless, signals), TanStack Query, Pointer Events plus
`touch-action: pan-y`, the Web Animations API, Vitest/jsdom.

**Spec:** docs/superpowers/specs/2026-11-28-swipe-between-games-design.md

## Global Constraints

- Mobile only. iPhone home-screen app first, Android too. No sideways scroll of the page.
- Only `<main>` scrolls. The shell owns scroll save and restore.
- No signal writes on moved frames. The drag sets `style.transform` directly.
- `prefers-reduced-motion: reduce`: no slide; the game just changes.
- The left 24px is the iPhone's Back: swipes starting there are ignored.
- Commit only when the user asks.

## Review Focus

- A vertical scroll that drifts sideways must stay a scroll: direction is locked at 10px, and
  vertical wins ties (swipe test: "a mostly vertical drag never moves the page").
- A swipe started on Screenshots or Videos (`.shots`), inside a dialog, or on a form control
  doesn't page (swipe test: "ignores drags that start on a strip").
- First and last game: the page stretches and springs back, and no navigation happens (decision
  test: "no next at the end").
- A game opened from Search or a DLC link after browsing must not swipe (service test: "clears
  when you land on another game").
- Fast flicks while an animation runs are ignored (swipe test: "ignores a drag while busy").

---

### Task 1: BrowseService and the swipe decision

**Files:**
- Create: `src/app/core/browse.ts`, `src/app/core/browse.spec.ts`
- Create: `src/app/shared/swipe.ts`, `src/app/shared/swipe.spec.ts`

**Interfaces:**
- Produces, in `browse.ts`:
  - `BrowseService` (providedIn root):
    - `start(ids: readonly number[], id: number, fromUrl: string): void`
    - `neighbours(id: number): { prev: number | null; next: number | null }`: both null when
      you aren't browsing at `id`
    - `moved(id: number): void`
    - `takeReveal(url: string): number | null`: the game to bring into view after Back to `url`,
      once, and only if you swiped away from the game you tapped
  - It listens to `NavigationEnd`: any address other than `/game/<current>` (or under it, such as
    the trophy list) clears the current game, but keeps the reveal.
- Produces, in `swipe.ts`:
  - `type SwipeDir = 'prev' | 'next'`
  - `resist(dx: number, canPrev: boolean, canNext: boolean): number`: ×0.3 past an end
  - `decide(dx: number, velocity: number, width: number, canPrev: boolean, canNext: boolean): SwipeDir | null`.
    Commits past `width / 3`, or on a flick: velocity at least 0.45 px/ms in the same direction,
    with |dx| over 40. Negative dx means next.
  - `attachSwipe(el: HTMLElement, opts: { neighbours(): { prev: number | null; next: number | null }; canStart(target: Element): boolean; go(dir: SwipeDir, dx: number): Promise<void> }): () => void`.
    Touch and pen only, primary pointer. Ignores starts at `clientX < 24`. Locks direction at
    10px. Springs back over 200ms. Busy while `go` runs. Swallows the click that follows a drag.

- [ ] Tests: `decide` (past a third, a flick, a slow short drag, no next at the end); `resist`;
  the service (`start` and `neighbours`, `moved`, clears when you land on another game, kept on
  `/game/<id>/trophies`, `takeReveal` once and only after moving); `attachSwipe` with jsdom
  PointerEvents (a horizontal drag calls `go('next')`; a mostly vertical drag never moves the
  page; ignores drags that start on a strip; ignores a drag from the left edge; ignores a drag
  while busy).
- [ ] Implement until they pass: `npx ng test --watch=false`

### Task 2: Lists hand over their order

**Files:** `src/app/pages/library/library.ts/.html`, `src/app/pages/calendar/calendar.ts/.html`,
`src/app/pages/calendar/now-playing.ts`

- Library: `browseIds = computed(...)`. With `yearGroups()`, it's the games of the groups that
  aren't folded, in order; otherwise `shown()`. Each cover link gets
  `(click)="browse.start(browseIds(), game.igdbId, router.url)"` and
  `[attr.data-browse-id]="game.igdbId"`.
- Calendar: games only. In card view, the games in `cardItems()`; in the list, the games of the
  groups that aren't folded. The same click and attribute.
- Now playing: `games()` ids, on both links.
- [ ] Spec: the Library's `browseIds` skips folded years (the Library spec, or pull out a pure
  `browseOrder(groups, isCollapsed)` into library-sort.ts and test that).

### Task 3: The game page pages, and the shell reveals after Back

**Files:** `src/app/pages/game/game.ts`, `src/app/shell/shell.ts`, `src/styles.css`

- The game host gets `class: 'block'` and `style: 'touch-action: pan-y'`.
- After the first render: `attachSwipe(host, ...)`.
  - `canStart`: not inside `.shots`, `dialog`, `input`, `textarea`, `select` or `[role=slider]`,
    and no `dialog[open]` in the document.
  - `go`: animate the host out to ∓width (160ms ease-in). Call `browse.moved(next)`, then
    `router.navigate(['/game', next], { replaceUrl: true })`. Wait two frames. Animate in from
    ±width to 0 (220ms ease-out). With reduced motion, skip both animations.
- `heroImageId(d)` is pulled out of `heroUrl`. An effect on `gameId` prefetches
  `['igdb-game', id]` for both neighbours (the same `queryFn` and staleTime as `details`), then
  preloads their hero image.
- Shell: in the popstate restore's frame, after `scrollTop = top`, it calls
  `browse.takeReveal(url)`. If the `[data-browse-id]` element is hidden under the pinned top or
  the tab bar, it's centred in `<main>`.
- [ ] Verify in Chrome (touch emulation via CDP): swipe next and prev, a scrolled page lands at
  the top, a vertical scroll doesn't page, Back returns to the list with the game in view, Search
  games don't swipe.
- [ ] Update DESIGN.md and PLAN.md.
