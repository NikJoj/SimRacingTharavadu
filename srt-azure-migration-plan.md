# SRT Portal — Azure Migration & API Restructure Plan

## Overview

**Goal:** Migrate the SimRacingTharavadu portal from Vercel (free, 12-function limit) to Azure Static Web Apps + Azure Functions (free, unlimited functions), restructure APIs into clean logical units, replace Vercel Blob with Neon PostgreSQL for race result storage, reconcile the `revamp` branch with `main`, and produce a Swagger API document.

**Outcome:** A single clean `main` branch, 14 logically separated API files, zero Vercel dependencies, running free on Azure indefinitely at current traffic levels, with full Swagger documentation.

**Platform stack after migration:**
- **Hosting:** Azure Static Web Apps (Free tier) — static HTML/CSS/JS
- **Functions:** Azure Functions v4 (Node.js) — built into Azure SWA
- **Database:** Neon PostgreSQL (existing, free) — events, leagues, leaderboard, registrations, **race results**
- **Poster storage:** GitHub API (existing `sync-poster.js` pattern — unchanged)
- **CI/CD:** GitHub Actions (built into Azure SWA — automatic)

---

## Current State

### Branch situation
- Local `main` (commit `766f80370`) — most recent, has Season 2 updates, `simgridUrl` support, bug fixes
- Local `revamp` (commit `38e61a521`) = `origin/main` on GitHub — older, missing Season 2 changes
- Goal: make local `main` the single source of truth, push to `origin/main`, delete `revamp`

### Current API files (12 active + 1 utility)
| File | Lines | What it does |
|---|---|---|
| `api/home.js` | 50 | Read-only aggregate: events + leagues + leaderboard in one call |
| `api/data.js` | ~530 | **Mega-consolidated** CRUD for events, leagues, leaderboard — needs splitting |
| `api/races.js` | 475 | **Mega-consolidated** race proxy + blob archive — needs splitting |
| `api/live.js` | 113 | Proxy to Assetto live-timings (basic + leaderboard) |
| `api/standings.js` | 60 | Proxy to Assetto championship standings |
| `api/championships.js` | 50 | Proxy to Assetto championships list |
| `api/results.js` | 50 | Proxy to Assetto results list |
| `api/registrations.js` | 374 | Full CRUD for driver registrations + bulk import |
| `api/admin-auth.js` | 143 | JWT-like login + token validation |
| `api/sync-poster.js` | 148 | Upload poster images to GitHub via API |
| `api/db.js` | 162 | Shared utility: Neon connection, table DDL |

### Vercel dependencies to remove
- `@vercel/blob` — used in `api/races.js` for `put()` and `list()` calls
- `vercel.json` — CORS config, replaced by Azure SWA `staticwebapp.config.json`
- `vercel` devDependency in `package.json`

---

## Target API Structure (14 files)

| File | Methods | Domain |
|---|---|---|
| `api/home.js` | GET | Read-only aggregate (unchanged) |
| `api/events.js` | GET, POST, PUT, DELETE | Events CRUD (split from data.js) |
| `api/leagues.js` | GET, POST, PUT, DELETE | Leagues CRUD (split from data.js) |
| `api/leaderboard.js` | GET, POST, PUT, DELETE | Leaderboard CRUD (split from data.js) |
| `api/races.js` | GET | Assetto race proxy: list races + fetch result JSON |
| `api/race-store.js` | GET, POST | Race archive CRUD — reads/writes to Neon `race_results` table |
| `api/live.js` | GET | Assetto live timings proxy (unchanged) |
| `api/standings.js` | GET | Assetto standings proxy (unchanged) |
| `api/championships.js` | GET | Assetto championships proxy (unchanged) |
| `api/results.js` | GET | Assetto results list proxy (unchanged) |
| `api/registrations.js` | GET, POST, PUT, DELETE | Registrations CRUD (unchanged) |
| `api/admin-auth.js` | POST | Admin login + token validation (unchanged) |
| `api/sync-poster.js` | POST | GitHub poster upload (unchanged) |
| `api/db.js` | — | Shared utility: connection + DDL (extended with race_results table) |

### New Neon table: `race_results`
Replaces all Vercel Blob storage. One new table in the existing database:
```sql
CREATE TABLE IF NOT EXISTS race_results (
  id SERIAL PRIMARY KEY,
  league VARCHAR(100) NOT NULL,
  track VARCHAR(200),
  session_date TIMESTAMPTZ,
  result_data JSONB NOT NULL,
  stored_at TIMESTAMPTZ DEFAULT NOW(),
  race_timestamp BIGINT NOT NULL,
  results_json_url TEXT,
  results_page_url TEXT,
  session_type VARCHAR(50) DEFAULT 'RACE',
  UNIQUE(league, race_timestamp)
);
CREATE INDEX IF NOT EXISTS idx_race_results_league ON race_results(league);
CREATE INDEX IF NOT EXISTS idx_race_results_timestamp ON race_results(race_timestamp DESC);
```

---

## Sub-Tasks

---

### Sub-Task 1 — Reconcile branches: make local `main` the single source of truth

**Status:** `[ ] pending`

**Intent:** The local `main` branch has Season 2 updates, `simgridUrl` support in `data-service.js` and `config.js`, and bug fixes that are absent from `revamp` and `origin/main`. We need to make this the definitive codebase before doing anything else.

**Expected Outcomes:**
- `origin/main` on GitHub equals local `main`
- Local `revamp` branch deleted
- All Season 2 changes (DEMO_LEAGUES entry 3, `simgridUrl` mapping) confirmed present
- Clean starting point for all subsequent sub-tasks

**Todo List:**
1. Verify local `main` has all Season 2 changes: check `js/config.js` for DEMO_LEAGUES entry with id `"3"` and `simgridUrl`, check `js/data-service.js` for `simgridUrl: l.simgrid_url` mapping
2. Force push local `main` to `origin/main`: `git push origin main --force-with-lease`
3. Delete local `revamp` branch: `git branch -d revamp`
4. Confirm GitHub shows the correct commit

**Relevant Context:**
- `js/config.js` line 71 — DEMO_LEAGUES entry 3 with `simgridUrl`
- `js/data-service.js` line 77 — `simgridUrl: l.simgrid_url || ''`
- Season 2 plan: `season2-simgrid-plan.md`

---

### Sub-Task 2 — Extend `api/db.js` with `race_results` table DDL

**Status:** `[ ] pending`

**Intent:** Add the `race_results` table definition to the shared DB utility so the table is created automatically on first deploy, exactly like the existing 4 tables. Also add `simgrid_url` column to leagues table (needed for Season 2).

**Expected Outcomes:**
- `api/db.js` `initializeTables()` creates `race_results` table and its indexes
- `api/db.js` `initializeTables()` adds `simgrid_url` column to `leagues` table via `ADD COLUMN IF NOT EXISTS`
- No changes to existing table definitions

**Todo List:**
1. In `api/db.js` `initializeTables()`, add `CREATE TABLE IF NOT EXISTS race_results` block with all columns listed in the Target API Structure section above
2. Add `CREATE INDEX IF NOT EXISTS idx_race_results_league` and `idx_race_results_timestamp`
3. Add `ALTER TABLE leagues ADD COLUMN IF NOT EXISTS simgrid_url TEXT` (idempotent, safe)

**Relevant Context:**
- `api/db.js` lines 59–161 — `initializeTables()` function
- The `sql` tag wrapper in `db.js` returns `{ rows }` — use `neonSql()` directly for DDL as the existing pattern shows

---

### Sub-Task 3 — Split `api/data.js` into `events.js`, `leagues.js`, `leaderboard.js`

**Status:** `[ ] pending`

**Intent:** Extract each of the three resource handlers from the consolidated `data.js` into their own dedicated files. Each file is a direct 1:1 extraction — no logic changes, just re-routing. This makes each domain independently readable, testable, and extendable.

**Expected Outcomes:**
- `api/events.js` — full CRUD for events (extracted from `handleEvents` in data.js)
- `api/leagues.js` — full CRUD for leagues (extracted from `handleLeagues` in data.js), with `simgrid_url` added to INSERT and dynamic UPDATE
- `api/leaderboard.js` — full CRUD for leaderboard entries (extracted from `handleLeaderboard` in data.js)
- `api/data.js` deleted
- All existing functionality preserved — same query parameters, same response shapes

**Todo List:**
1. Create `api/events.js` — copy `handleEvents` body directly as the default export handler. Keep the same request/response shape: `GET ?id=`, `POST`, `PUT`, `DELETE`. Import `sql` and `query` from `./db.js`
2. Create `api/leagues.js` — copy `handleLeagues` body. Add `simgrid_url` to the INSERT fields and include it in the allowed dynamic update fields
3. Create `api/leaderboard.js` — copy `handleLeaderboard` body. Keep `GET ?event_id=&race=`, `POST`, `PUT`, `DELETE ?id=` and bulk `DELETE ?event_id=&race=`
4. Delete `api/data.js`
5. Update `js/config.js` — replace `DATA: '/api/data'` with three separate entries: `EVENTS: '/api/events'`, `LEAGUES: '/api/leagues'`, `LEADERBOARD: '/api/leaderboard'`
6. Update `admin.html` — find all fetch calls to `/api/data?resource=events`, `/api/data?resource=leagues`, `/api/data?resource=leaderboard` and update to the new direct endpoints

**Relevant Context:**
- `api/data.js` lines 83–229 — `handleEvents` function
- `api/data.js` lines 234–379 — `handleLeagues` function, note `blob_store` field (keep for backward compat even though we move to DB for race storage)
- `api/data.js` lines 384–end — `handleLeaderboard` function
- `js/config.js` lines 8–12 — `API_ENDPOINTS` block
- The dynamic update builder pattern (lines 165–192 in data.js) is identical across all three handlers — copy as-is

---

### Sub-Task 4 — Split `api/races.js`: extract `race-store.js`, replace blob with Neon

**Status:** `[ ] pending`

**Intent:** The current `races.js` mixes two very different concerns: (1) proxying the live Assetto Corsa server API to bypass CORS, and (2) archiving race results into persistent storage. These should be separate files. The storage backend is also changed from Vercel Blob to Neon PostgreSQL.

**Expected Outcomes:**
- `api/races.js` — pure Assetto proxy: `action=list` (all races), `action=result&file=X` (download one result JSON). Removes all blob/storage imports
- `api/race-store.js` — race archive: `GET ?league=X` (list stored races), `GET ?league=X&timestamp=Y` (get one stored race), `GET ?action=leagues` (list leagues with stored data), `POST ?action=store&league=X` (store latest from Assetto), `POST ?action=sync` (store multiple). Uses Neon `race_results` table via `sql` from `db.js`
- `@vercel/blob` removed from `package.json` dependencies
- Existing stored races in Vercel Blob are migrated to `race_results` table (see Sub-Task 8)

**Todo List:**
1. Create `api/races.js` (replace existing) — keep only `handleFetchRaces` (action=list) and `handleRaceResult` (action=result). Remove all blob imports and storage handlers
2. Create `api/race-store.js` — new file implementing:
   - `GET ?league=X` → `SELECT id, league, track, session_date, race_timestamp, results_json_url, results_page_url, session_type, stored_at FROM race_results WHERE league=$1 ORDER BY race_timestamp DESC`
   - `GET ?league=X&timestamp=Y` → `SELECT result_data FROM race_results WHERE league=$1 AND race_timestamp=$2`
   - `GET ?action=leagues` → `SELECT DISTINCT league FROM race_results ORDER BY league`
   - `POST ?action=store&league=X` → fetch latest from Assetto, INSERT INTO race_results
   - `POST ?action=sync` → loop races array, INSERT each into race_results (upsert on conflict)
3. Remove `@vercel/blob` from `package.json` dependencies
4. Update `js/config.js` `ASSETTO_API` block: add `RACE_STORE: '/api/race-store'` entry
5. Update `admin.html` — find all fetch calls that use `/api/races?action=stored`, `/api/races?action=store`, `/api/races?action=sync`, `/api/races?action=leagues` and point them to `/api/race-store`

**Relevant Context:**
- `api/races.js` lines 86–160 — `handleFetchRaces` and `handleRaceResult` (keep these)
- `api/races.js` lines 162–473 — `handleGetStored`, `handleListLeagues`, `handleStoreLatest`, `handleSyncSelected` (move to race-store.js, rewrite storage calls)
- The Neon `sql` tag from `db.js` supports template literals; for inserts use parameterised `neonSql.query()` pattern for JSONB data
- Use `ON CONFLICT (league, race_timestamp) DO NOTHING` for idempotent sync operations

---

### Sub-Task 5 — Azure infrastructure setup

**Status:** `[ ] pending`

**Intent:** Create the Azure Static Web App resource, link it to the GitHub repository, and configure all environment variables. This is the one-time cloud setup step.

**Expected Outcomes:**
- Azure Static Web App created (Free tier) in a region close to the user (e.g., Central India or Southeast Asia)
- GitHub repository linked — pushes to `main` trigger automatic deployment
- All environment variables configured in Azure portal
- `staticwebapp.config.json` added to project root (replaces `vercel.json`)
- `api/package.json` created for Azure Functions dependencies

**Todo List:**
1. Create Azure account at portal.azure.com (free, no credit card required for Static Web Apps Free tier — but a card IS required to activate the account; it won't be charged)
2. Create Static Web App: Azure Portal → Create Resource → Static Web App → Free plan → link GitHub repo `SimRacingTharavadu` → branch `main` → App location `/` → API location `api` → Output location `/`
3. Add `staticwebapp.config.json` to project root (see template in Relevant Context below)
4. Create `api/package.json` with Azure Functions runtime and Neon dependency (no `@vercel/blob`)
5. Add all environment variables in Azure Portal → Static Web App → Configuration → Application settings:
   - `DATABASE_URL`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_BRANCH`
6. Remove `vercel.json` from repo (or keep for reference — CORS is now in `staticwebapp.config.json`)
7. Remove `vercel` devDependency from root `package.json`

**Relevant Context:**

`staticwebapp.config.json` template:
```json
{
  "globalHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  },
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "*.{css,js,png,jpg,ico}"]
  }
}
```

`api/package.json` template:
```json
{
  "name": "srt-api",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@neondatabase/serverless": "^1.1.0",
    "@azure/functions": "^4.0.0"
  }
}
```

---

### Sub-Task 6 — Rewrite all API handler signatures for Azure Functions v4

**Status:** `[ ] pending`

**Intent:** Azure Functions v4 uses a different module export pattern from Vercel. Every API file needs its handler signature updated. The business logic (SQL queries, fetch calls, response data) does NOT change — only the wrapper pattern.

**Expected Outcomes:**
- All 13 API files (excluding `db.js`) use Azure Functions v4 `app.http()` registration pattern
- `req.query.X` → `new URL(request.url).searchParams.get('X')`
- `req.body` → `await request.json()`
- `res.status(200).json(data)` → `return { status: 200, jsonBody: data }`
- `res.setHeader(...)` → headers on the return object
- `crypto` import unchanged (built-in Node.js, available in Azure Functions)
- All existing query parameter names, response shapes, and HTTP methods preserved

**Vercel → Azure pattern mapping:**
```js
// BEFORE (Vercel)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60');
  const { championshipId } = req.query;
  const body = req.body;
  return res.status(200).json({ data });
}

// AFTER (Azure Functions v4)
import { app } from '@azure/functions';
app.http('standings', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const params = new URL(request.url).searchParams;
    const championshipId = params.get('championshipId');
    const body = await request.json();
    return {
      status: 200,
      headers: { 'Cache-Control': 's-maxage=60' },
      jsonBody: { data }
    };
  }
});
```

**Todo List:**
1. Rewrite `api/home.js` — GET only, no body parsing needed
2. Rewrite `api/events.js` — GET/POST/PUT/DELETE, body parsing for POST/PUT/DELETE
3. Rewrite `api/leagues.js` — GET/POST/PUT/DELETE, body parsing for POST/PUT/DELETE
4. Rewrite `api/leaderboard.js` — GET/POST/PUT/DELETE, body parsing for POST/PUT/DELETE
5. Rewrite `api/races.js` — GET only, query params only
6. Rewrite `api/race-store.js` — GET/POST, body parsing for POST sync action
7. Rewrite `api/live.js` — GET only
8. Rewrite `api/standings.js` — GET only
9. Rewrite `api/championships.js` — GET only
10. Rewrite `api/results.js` — GET only
11. Rewrite `api/registrations.js` — GET/POST/PUT/DELETE — most complex body parsing
12. Rewrite `api/admin-auth.js` — POST only, `crypto` import stays
13. Rewrite `api/sync-poster.js` — POST only

**Note on OPTIONS preflight:** Azure SWA handles CORS at the platform level via `staticwebapp.config.json`, so the `OPTIONS` preflight handling block in each function can be removed. The `globalHeaders` in the config file covers it.

**Relevant Context:**
- Azure Functions v4 docs: https://learn.microsoft.com/en-us/azure/azure-functions/functions-node-upgrade-v4
- Each function name in `app.http('name', ...)` must match the filename (e.g., file `standings.js` → `app.http('standings', ...)`)

---

### Sub-Task 7 — Update frontend JS to use new API endpoints

**Status:** `[ ] pending`

**Intent:** After splitting `data.js` and `races.js`, the frontend config and admin panel need their API endpoint references updated. The public-facing `index.html` only calls `/api/home` and `/api/registrations` — these are unchanged. The admin panel calls all CRUD endpoints.

**Expected Outcomes:**
- `js/config.js` `API_ENDPOINTS` updated to three separate CRUD endpoints
- `js/config.js` `ASSETTO_API` updated with `RACE_STORE` entry
- `admin.html` all fetch calls updated to new endpoint paths
- `index.html` unchanged (uses only `home` and `registrations`)
- `js/data-service.js` unchanged (uses only `home`)

**Todo List:**
1. Update `js/config.js`:
   - Replace `DATA: '/api/data'` with `EVENTS: '/api/events'`, `LEAGUES: '/api/leagues'`, `LEADERBOARD: '/api/leaderboard'`
   - Add `RACE_STORE: '/api/race-store'` to `ASSETTO_API` block
2. Audit `admin.html` for all fetch URL strings containing `/api/data` and replace with the appropriate split endpoint
3. Audit `admin.html` for all fetch URL strings containing `/api/races?action=stored`, `action=store`, `action=sync`, `action=leagues` and replace with `/api/race-store`
4. Verify `js/data-service.js` still only calls `/api/home` — no changes needed

**Relevant Context:**
- `js/config.js` lines 8–12 — `API_ENDPOINTS` block to update
- `js/config.js` lines 27–33 — `ASSETTO_API` block to update
- `admin.html` — search for string `/api/data` and `/api/races`

---

### Sub-Task 8 — Migrate existing Vercel Blob race data to Neon

**Status:** `[ ] pending`

**Intent:** Any race results already stored in Vercel Blob need to be moved into the new `race_results` Neon table before the old infrastructure is shut down. This is a one-time data migration.

**Expected Outcomes:**
- All existing blobs from `SRT-GT3-Season-1/`, `SRT-Formula-Season-1/` etc. read and inserted into `race_results`
- Vercel Blob token can be revoked after confirmation
- `BLOB_READ_WRITE_TOKEN` env var removed from Azure config

**Todo List:**
1. Write a one-off migration script `scripts/migrate-blob-to-neon.js` that:
   - Uses `@vercel/blob` `list()` to enumerate all metadata files
   - For each metadata file: reads it, fetches the corresponding race data file
   - Inserts a row into `race_results` with all fields populated
   - Uses `ON CONFLICT DO NOTHING` so it's safe to re-run
2. Run the script locally with both `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` set
3. Verify row counts in `race_results` match expected blob count
4. Remove `BLOB_READ_WRITE_TOKEN` from Azure App Settings
5. Remove `@vercel/blob` from root `package.json`
6. Delete migration script after confirmed success (or keep in `scripts/` for reference)

**Relevant Context:**
- `api/races.js` `handleGetStored` — shows the blob listing pattern to replicate in migration script
- `api/races.js` `handleStoreLatest` — shows the metadata structure: `league`, `track`, `session_type`, `date`, `results_json_url`, `results_page_url`, `blob_url`, `race_timestamp`
- If no races have been stored yet in Blob, this sub-task is a no-op — just skip to removing the dependency

---

### Sub-Task 9 — Write Swagger / OpenAPI 3.0 specification

**Status:** `[ ] pending`

**Intent:** Produce a machine-readable and human-readable API specification for all 13 endpoints. This serves as the authoritative reference for frontend development, admin tooling, and future contributors.

**Expected Outcomes:**
- `docs/openapi.yaml` — full OpenAPI 3.0 spec covering all 13 API routes
- Every endpoint documented with: summary, parameters, request body schema, response schemas (200, 400, 404, 500)
- Grouped by tag: `Portal Data`, `Race Archive`, `Assetto Proxy`, `Admin`
- Can be rendered by Swagger UI, Redoc, or imported into Postman

**Tags and endpoints:**
- **Portal Data** (Neon DB): `home`, `events`, `leagues`, `leaderboard`, `registrations`
- **Race Archive** (Neon DB): `race-store`
- **Assetto Proxy** (Assetto Hosting API passthrough): `races`, `live`, `standings`, `championships`, `results`
- **Admin**: `admin-auth`, `sync-poster`

**Todo List:**
1. Create `docs/openapi.yaml` with `openapi: 3.0.3`, `info`, `servers`, and `tags` sections
2. Document all `Portal Data` endpoints with full request/response schemas
3. Document all `Race Archive` endpoints
4. Document all `Assetto Proxy` endpoints (note: response schema is upstream-dependent, use `type: object, additionalProperties: true`)
5. Document `Admin` endpoints including token format
6. Add `components/schemas` for reusable types: `Event`, `League`, `LeaderboardEntry`, `Registration`, `RaceResult`, `ErrorResponse`

**Relevant Context:**
- All request/response shapes are captured from reading each API file above
- `api/registrations.js` has the most complex schema (bulk-import action, duplicate detection)
- `api/admin-auth.js` token format: `base64(JSON payload).HMAC-SHA256 signature`

---

### Sub-Task 10 — Write migration guide document

**Status:** `[ ] pending`

**Intent:** Produce a step-by-step document that explains the full migration for anyone picking this up (including future you). Covers branch cleanup, Azure setup, env var migration, blob data migration, and verification.

**Expected Outcomes:**
- `MIGRATION_GUIDE.md` at project root
- Covers: prerequisites, step-by-step Azure setup, environment variable checklist, blob migration, verification checklist, rollback instructions
- References `staticwebapp.config.json` and `api/package.json` templates
- Includes a "verify it works" checklist for each endpoint group

**Todo List:**
1. Write `MIGRATION_GUIDE.md` with the following sections:
   - Prerequisites (Azure account, Azure CLI optional, Node.js)
   - Step 1: Branch cleanup (force push main, delete revamp)
   - Step 2: Azure Static Web App creation (portal walkthrough)
   - Step 3: Environment variables checklist
   - Step 4: Run blob-to-Neon migration script
   - Step 5: Verify deployment (endpoint checklist)
   - Step 6: Update DNS / custom domain
   - Rollback plan (re-enable Vercel deployment from same repo)
2. Include a table mapping old Vercel endpoints to new Azure endpoints where paths changed

---

## Implementation Order

```
Sub-Task 1  →  Branch cleanup (git only, no code)
Sub-Task 2  →  Extend db.js (foundation for storage changes)
Sub-Task 3  →  Split data.js (pure refactor, no behaviour change)
Sub-Task 4  →  Split races.js + race-store.js (replaces blob)
Sub-Task 5  →  Azure setup (infrastructure, done in parallel with 6/7)
Sub-Task 6  →  Rewrite handler signatures (platform migration)
Sub-Task 7  →  Update frontend config + admin.html
Sub-Task 8  →  Migrate blob data (one-time, do before cutting over)
Sub-Task 9  →  Swagger spec (can be done at any point after 2-4)
Sub-Task 10 →  Migration guide (written last, captures final state)
```

---

## Notes for Implementation

- `api/db.js` is a shared module imported by multiple files — it does NOT get an Azure `app.http()` registration. It stays as a plain ES module export.
- The `crypto` module used in `admin-auth.js` is a Node.js built-in available in Azure Functions — no change needed.
- Azure Functions v4 with `"type": "module"` in `api/package.json` supports ES module `import` syntax directly — no transpilation needed.
- The `@neondatabase/serverless` package works in Azure Functions Node.js runtime exactly as it does on Vercel — no driver changes needed.
- Azure SWA Free tier has no SLA but has been extremely reliable in practice for low-traffic sites. If uptime becomes critical, the Standard tier at $9/month adds 99.95% SLA.
- Keep `vercel.json` in the repo until Azure deployment is verified working — it does no harm and allows instant rollback to Vercel.

---

*Plan created: 2026*
*Made with Bob*
