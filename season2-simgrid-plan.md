# Season 2 SimGrid League Card — Plan

## Overview

Add a Season 2 league card to the Leagues section that:
- Displays identically to the Season 1 card in layout and style
- Uses the poster image `leaguePoster3.png` (already present in workspace root)
- Shows title "SRT Season 2 Pre Season Testing", sim "Le Mans Ultimate", status "upcoming", no fixed dates
- On "View Details →" opens the `league-details` page with **only** the "Sign up" tab visible,
  containing the SimGrid iframe at `https://www.thesimgrid.com/championships/26866?s=mEGb31AK`
- The other three tabs (Live Timings, Championship Standings, Race Details) are hidden for this league

---

## Sub-Tasks

---

### Sub-Task 1 — Add Season 2 league entry to DEMO_LEAGUES and data-service mapping

**Intent**
The Season 2 league must exist in the app data so the grid renderer picks it up and the detail view
can read its SimGrid URL. This avoids hardcoding anything in HTML; the card is generated the same
way as Season 1.

**Expected Outcomes**
- `DEMO_LEAGUES` in `js/config.js` contains a Season 2 entry with `simgridUrl` set, `championshipId`
  empty, and `id: "3"` so that `leaguePoster3.png` is used automatically
- The league transform in `js/data-service.js` maps `simgrid_url` (DB column) → `simgridUrl` (app field)

**Todo List**
1. In `js/config.js` — append a new entry to `DEMO_LEAGUES`:
   `id: "3"`, `name: "SRT Season 2 Pre Season Testing"`, `sim: "Le Mans Ultimate"`,
   `status: "upcoming"`, `startDate: ""`, `endDate: ""`, `format: ""`, `rounds: ""`,
   `season: "2025"`, `description: ""`, `carOptions: ""`, `blobStore: ""`,
   `championshipId: ""`, `simgridUrl: "https://www.thesimgrid.com/championships/26866?s=mEGb31AK"`
2. In `js/data-service.js` — add `simgridUrl: l.simgrid_url || ''` to the DB league transform
   inside `loadData()` (alongside the existing `championshipId` mapping)

**Relevant Context**
- [`js/config.js` lines 68–71](js/config.js:68) — `DEMO_LEAGUES` array (current ids are "1" and "2")
- [`js/data-service.js` lines 67–84](js/data-service.js:67) — league DB→app transform

**Status** — `[ ] pending`

---

### Sub-Task 2 — Route SimGrid leagues to a single-tab detail view

**Intent**
When a league has `simgridUrl` set, `showLeagueDetails` should hide the three Assetto-API-dependent
tabs and show only the "Sign up" tab. `loadSignupIframe` should use `simgridUrl` when
`championshipId` is absent.

**Expected Outcomes**
- Clicking "View Details →" on Season 2 opens `league-details` with only the "Sign up" tab button visible
- The Sign up tab panel immediately loads the SimGrid URL in the existing `#signup-iframe`
- Season 1 behaviour is completely unchanged (all four tabs visible, Assetto iframe used)

**Todo List**
1. In `js/leagues.js` — inside `showLeagueDetails()`: after finding the league object, check if
   `league.simgridUrl` is set. If yes, hide the `live`, `standings`, and `races` tab buttons
   (set `display:none` on those `.league-tab[data-tab]` elements). If no `simgridUrl`, ensure all
   tab buttons are restored to visible (so returning to a Season 1 league works correctly).
2. In `js/leagues.js` — inside `loadSignupIframe()`: after the existing `!league.championshipId`
   early-return block, add an `else if (league.simgridUrl)` branch that sets
   `iframe.src = league.simgridUrl` directly.
3. In `js/leagues.js` — inside `showLeagueDetails()`: also update the text content of the
   `signup` tab button to "Championship Portal" when `league.simgridUrl` is set, and restore
   it to "Sign up" otherwise.
4. The default `switchLeagueTab('signup')` call already at the end of `showLeagueDetails()` will
   trigger `loadSignupIframe()` — no changes needed to `switchLeagueTab()` itself.

**Relevant Context**
- [`js/leagues.js` lines 113–133](js/leagues.js:113) — `showLeagueDetails()`
- [`js/leagues.js` lines 1153–1189](js/leagues.js:1153) — `loadSignupIframe()`
- [`index.html` lines 252–256](index.html:252) — tab buttons with `data-tab` attributes

**Status** — `[ ] pending`

---

### Sub-Task 3 — Verify poster and card rendering (no code changes)

**Intent**
Confirm the Season 2 card will render with the correct poster, title, sim label, and "Upcoming"
badge without any new CSS.

**Expected Outcomes**
- `leaguePoster3.png` used as card image (file confirmed present ✓)
- Card shows gold left-border stripe (`.league-card.upcoming::before`)
- `onerror` fallback to `srtLogo.png` still works if poster is missing

**Todo List**
1. Confirm `leaguePoster3.png` exists — ✓ already verified
2. Confirm `buildLeagueCardHTML` uses `leaguePoster${l.id}.png` — ✓ line 34 of `js/leagues.js`
3. No CSS changes needed

**Relevant Context**
- [`js/leagues.js` line 34](js/leagues.js:34) — poster `src` pattern
- [`css/leagues.css` lines 39–42](css/leagues.css:39) — `.league-card.upcoming::before` gold stripe

**Status** — `[ ] pending`

---

## Decisions

| Question | Decision |
|---|---|
| Poster image | `leaguePoster3.png` |
| League id | `"3"` (drives poster filename automatically) |
| Title | "SRT Season 2 Pre Season Testing" |
| Sim | "Le Mans Ultimate" |
| Status | "upcoming" |
| Start/end dates | Blank |
| Detail page | Existing `league-details` page, Sign up tab only |
| Other tabs for Season 2 | Hidden entirely |
| SimGrid URL | `https://www.thesimgrid.com/championships/26866?s=mEGb31AK` |
| Sign up tab label | "Championship Portal" for SimGrid leagues, "Sign up" for Assetto leagues |
