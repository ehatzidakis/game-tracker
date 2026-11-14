---
target: Calendar tab, compared with Library
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:c:\\Users\\ehatzidakis\\Test\\game-tracker\\src\\app\\pages\\calendar\\calendar.html"
target_fingerprint: "sha256:41c6e6e6679c9088fc8fc27f5cd64b8e4f6e2f44a30686d3bcac11180c36366e"
target_path: "c:\\Users\\ehatzidakis\\Test\\game-tracker\\src\\app\\pages\\calendar\\calendar.html"
timestamp: 2026-11-14T16-09-18Z
slug: src-app-pages-calendar-calendar-html
---
Method: dual-agent (A: design review · B: detector + browser)

# Calendar tab critique (vs Library)

Verdict: Calendar is well built but speaks a different visual language from Library: text-led (40px thumbnails, grey cards, state as grey words) vs Library's art-led shelf (big covers, state as badges, black ground, foldable bold headers).

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Countdowns + blue next release work; pre-ordered/physical/playing not visible at a glance |
| 2 | Match system / real world | 3 | "Owned" vs Library's "Backlog"; "Later in 2028" repeats 2028 |
| 3 | User control and freedom | 3 | Search clears and survives navigation |
| 4 | Consistency and standards | 2 | Header style, badges, cover size, toolbar, event art, radii differ from Library |
| 5 | Error prevention | 3 | Little can go wrong |
| 6 | Recognition rather than recall | 3 | "Thu 19" relies on a scrolled-away month header |
| 7 | Flexibility and efficiency | 2 | No folding, counts or events filter |
| 8 | Aesthetic and minimalist design | 3 | Coloured event tiles, chips and bells compete with art and countdown |
| 9 | Error recovery | 2 | No-match state is a dead end |
| 10 | Help and documentation | 3 | Empty state explains Search and + |
| Total | | 27/40 | Good, with a clear consistency gap |

## Design specificity
LLM: Library authored (Letterboxd shelf with overlays); Calendar category-generic ("iOS Settings with covers"), its one authored touch the single blue next-release countdown.
Detector: 2 advisory design-system-font-size (11px badge, calendar.html:53, library.html:329) — DESIGN.md ramp gap, not a defect. Browser overlay: only tab-bar 10.5px labels on both pages (false positive, iOS standard, outside both pages). No overflow, no console errors; shared frame identical to the pixel.

## What's working
- One blue next-release countdown.
- Careful ordering: Just released (7 days), months, Later in…, TBA; events before that day's games with time ranges.
- Shared frame (title, search, gutter, tab bar, no-match copy) already identical.

## Priority issues
- [P1] Two visual languages for the same games. Fix: (a) 64×85 row covers with Library's badges, drop state words; or (b) Library's 3-column grid per month with date + countdown as caption. /impeccable layout
- [P1] Event rows ignore their artwork and shout: generic tile despite IGDB logo (INDIE Live Expo), solid brand-colour blocks (PlayStation blue ≈ accent, gold TGA loudest on screen), 8px radius vs 5px covers. Fix: app-event-art like Library's Events; host glyph on a dark tile. /impeccable polish (+ quieter)
- [P2] Header/grouping vocabulary: 13px uppercase grey headers in grey cards, no folding vs Library's 20px bold foldable headers on black. Fix: Library-style "November · 2" headers with fold; rows on black. /impeccable typeset
- [P2] Toolbar placement: 36px + by the title (under 44px, top-right corner), no count line. Fix: Library-style row under search: "6 games · 3 events" + "+ Event" pill. /impeccable layout
- [P3] Blue and badge noise: 5 blue marks on first screen, filled bells, "Event"/"DLC" chips, redundant year. Fix: outline bell or cover badge, drop "Event" chip, "Date not announced". /impeccable quieter

## Persona red flags
- Owner one-handed: "what am I playing" not on the opening tab; + out of thumb reach.
- New friend: bell, Event chip, Owned, blue countdown, coloured tiles unexplained; Owned vs Backlog.
- 100+ wishlist: no folding/counts/filter; ~18 months of one-row cards.

## Minor observations
- Next-release countdown blue in Calendar, grey for the same game in Library Wishlist.
- Event titles truncate to one line with a chip; Library uses 2 lines.
- No-match state: add "Search all games for '…'".
- Events never get the blue "next".
- DESIGN.md stale (grey segment thumb, opaque tab bar): /impeccable document.

## Questions to consider
1. Should Calendar be the Wishlist-by-release grid split by month, events mixed in?
2. A "Playing" strip of 2–3 covers at the top of Calendar?
3. Events as thin dated lines between covers rather than peer rows?
