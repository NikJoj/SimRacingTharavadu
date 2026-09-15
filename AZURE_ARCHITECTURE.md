# Azure Architecture

## Overview

SimRacingTharavadu is a static HTML, CSS, and JavaScript site hosted by Azure Static Web Apps. Dynamic requests are handled by managed Azure Functions (Node.js 20, Functions v4) and persistent portal data is stored in Neon PostgreSQL.

```
Browser
  │  static files and same-origin /api requests
  ▼
Azure Static Web Apps
  ├── Static site: HTML, CSS, JavaScript, images
  └── Managed Azure Functions: /api/*
          ├── Neon PostgreSQL: portal data and archived race results
          ├── Assetto Hosting API: live timing, championships, standings, results
          ├── SimGrid GridOS: manual LMU registration, standings and schedule sync
          └── GitHub Contents API: optional poster uploads
```

## Deployment

The GitHub Actions workflow at `.github/workflows/azure-static-web-apps-delightful-sea-069ef5610.yml` deploys pushes to the `azure` branch.

- `app_location: /` deploys the static site.
- `api_location: api` deploys the Azure Functions app.
- `staticwebapp.config.json` sets the Node.js 20 API runtime, global CORS headers, and the navigation fallback.
- `api/host.json` retains the `api` route prefix, so all functions are exposed as `/api/<route>`.

## Functions

`api/index.js` imports every function module; importing a module registers its HTTP handler with the Functions v4 runtime.

| Area | Routes | Data source |
| --- | --- | --- |
| Portal data | `/api/home`, `/api/events`, `/api/leagues`, `/api/leaderboard`, `/api/registrations` | Neon PostgreSQL |
| Race archive | `/api/race-store` | Neon PostgreSQL + Assetto Hosting |
| Assetto proxies | `/api/live`, `/api/races`, `/api/results`, `/api/championships`, `/api/standings` | Assetto Hosting |
| Admin support | `/api/login-auth`, `/api/sync-poster` | Azure configuration + GitHub Contents API |
| SimGrid | `/api/simgrid` | SimGrid GridOS → Neon snapshot + registrations |
| Driver identity | `/api/driver-mappings` | Admin-approved aliases → searchable race-entry index |
| Driver login | `/api/discord-auth`, `/api/driver-profile` | Discord OAuth2 → signed HttpOnly session → mapped history |
| LMU result upload | `/api/simgrid-results` | Admin XML upload → normalized Neon race result |

The complete request and response contract is in `docs/openapi.yaml`.

## Neon PostgreSQL

The data layer is implemented in `api/db.js` with `@neondatabase/serverless`. It creates and evolves the schema idempotently during initialization.

Primary tables: `events`, `leagues`, `leaderboard`, `registrations`, and `race_results`.

Driver identity is maintained separately from archived result JSON in
`driver_profiles`, `driver_aliases`, `driver_name_candidates`, `race_sessions`,
`race_entries`, `driver_login_claims`, and `driver_mapping_audit`. The admin dashboard scans existing
registrations and results, approves racing-name aliases against a Discord-labelled
profile, and can reverse a link. Discord usernames are preparatory metadata; a
future login flow must bind and authenticate by immutable Discord user ID.

Driver login uses Discord's OAuth2 authorization-code flow with only the
`identify` scope. A signed, short-lived HttpOnly cookie protects OAuth state.
The first login matching an admin-entered username creates a pending claim with
the verified Discord numeric ID; it does not grant race-history access. After an
admin approves the claim, the driver signs in again and receives a signed,
HttpOnly, Secure, SameSite=Lax seven-day SRT session. No Discord access or refresh
tokens are persisted. Login is optional and public pages remain available.

### Applying the driver-identity schema

The `/api/driver-mappings` endpoint and future sync hooks create the identity
tables idempotently. For a controlled production rollout, run
`docs/neon-driver-identity-migration.sql` once in the Neon SQL Editor before
deploying the matching application code. The migration only creates new tables,
indexes, and the nullable `registrations.driver_profile_id` column; it does not
rewrite or delete archived `race_results.result_data`.

After deployment, open **Admin → Driver Mapping** and choose **Scan & refresh
history**. This creates the searchable index from existing registrations and
race results. Re-running the scan is safe: race sessions are upserted, their
derived entries are rebuilt, and approved aliases are reapplied.

### Temporary database selection in Azure

Set `USE_TEST_DATABASE=true` and provide `TEST_DATABASE_URL` to switch every
database-backed API in that Azure environment to a separate Neon branch. An
invalid flag or a missing test URL fails closed instead of falling back to
production. Azure restarts the Functions environment after application settings
change; database selection is then fixed for that process lifetime.

This is intentionally a full-API switch because mapping tables have foreign keys
to registrations and the race archive in the same database. During test mode,
public registrations, admin edits, race syncs, and mapping changes all go to the
test database. Set the flag back to `false` to return to `DATABASE_URL`; writes
made while testing are not copied automatically to production.

`simgrid_snapshots` is created on the first confirmed SimGrid sync. It stores one
current normalized snapshot per league, its revision, sync time and admin name.
Registrations gain `simgrid_registration_id` (stable provider ID) and
`simgrid_active` (withdrawal status). Existing registrations default to active.

Race results use `race_results.league_id` for new records. The former `leagues.blob_store` value remains only as legacy compatibility data so historical records can be linked safely; it is not required for new leagues and is not a storage location.

## Required Azure configuration

Configure these application settings in Azure Static Web Apps. Never place their real values in the repository.

| Setting | Required by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Data and race archive functions | Neon PostgreSQL connection string |
| `USE_TEST_DATABASE` | All database-backed functions | Optional `true`/`false` selector; defaults to production |
| `TEST_DATABASE_URL` | All database-backed functions in test mode | Separate Neon test branch connection string |
| `DISCORD_CLIENT_ID` | Optional driver login | Discord application ID |
| `DISCORD_CLIENT_SECRET` | Optional driver login | Discord OAuth client secret; server-side only |
| `DISCORD_REDIRECT_URI` | Optional driver login | Exact registered callback URL ending in `/api/discord-auth?action=callback` |
| `DRIVER_SESSION_SECRET` | Optional driver login | Cookie-signing secret; falls back to `JWT_SECRET` |
| `ADMIN_USERNAME` | `login-auth` | Dashboard username |
| `ADMIN_PASSWORD` | `login-auth` | Dashboard password |
| `JWT_SECRET` | `login-auth` | HMAC signing secret for the short-lived dashboard token |
| `SIMGRID_API_TOKEN` | `simgrid` | Approved GridOS bearer token; backend only |
| `GITHUB_TOKEN` | `sync-poster` | GitHub token with repository-contents write access |
| `GITHUB_OWNER` | `sync-poster` | GitHub repository owner |
| `GITHUB_REPO` | `sync-poster` | Repository name; defaults to `SimRacingTharavadu` |
| `GITHUB_BRANCH` | `sync-poster` | Target branch; defaults to `main` |

`.env.example` provides safe placeholders for local development. The local `.env` file is ignored and must never be committed.

## Security and operations

- The static site and API use same-origin `/api` requests; frontend code has no database credentials.
- The admin login endpoint issues a two-hour HMAC-signed token and the browser validates it before showing the dashboard.
- Azure Functions currently use anonymous function authorization. The dashboard token is a UI session check, not server-side authorization for CRUD routes. Add server-side token validation before treating the dashboard as a security boundary.
- Exception: `POST /api/simgrid` validates the existing HMAC admin session server-side and requires an explicit `JWT_SECRET`. Public GET only reads normalized saved data, never the API token or raw participant metadata.
- The browser sends that session in `X-SRT-Admin-Token`, because Azure Static Web Apps can overwrite `Authorization` when forwarding to managed Functions. The backend still verifies the signature, username and expiry; the header alone grants no access. Direct/local clients retain Bearer-header compatibility.
- Rotate database, GitHub, and admin secrets if they have ever been committed or shared.
- Add Application Insights if request-level monitoring is required.

## Local development

1. Copy `.env.example` to `.env.local` and replace placeholders with development values.
2. Install dependencies in `api/`.
3. Run Azure Functions Core Tools from `api/`; functions are served under `http://localhost:7071/api`.
4. Serve the repository root with a local static server that proxies `/api` to the Functions host, or test API endpoints directly.

Core Tools does not automatically load `.env.local`. Supply the API settings in
the process environment or in `api/local.settings.json` under `Values` when
running locally. Never commit that file. For deployment, add `SIMGRID_API_TOKEN`
to Azure Static Web Apps application settings; a local token is not deployed.

## Manual SimGrid sync (Pre-Season 2)

1. In the admin league editor, set simulator to **Le Mans Ultimate** and the
   SimGrid URL to `https://www.thesimgrid.com/championships/26866`.
   Keep the Assetto championship field empty. Existing SimGrid URLs are retained.
2. Open **Race Result Sync → SimGrid — Manual Sync** and select the league.
3. Click **Preview SimGrid changes**. Review drivers, official scores, schedule,
   changes/withdrawals, and last successful sync time. Preview performs no writes.
4. Click **Confirm sync**. The backend re-fetches the same data and rejects a
   changed preview. A compare-and-swap revision and one SQL statement publish
   the snapshot, update imported registrations, mark missing imported drivers
   inactive and update the league driver count atomically. Local-only driver
   records and local penalty values are preserved, but local penalty deductions
   are never applied to SimGrid standings. No scheduler is installed.
5. Visitors open **View Details** to see saved standings and race schedule.
   They see the last sync time. The portal tab links to SimGrid for registration
   and shows the saved registration summary below the link. The browser reads
   this from `/api/simgrid`; the GridOS bearer token remains server-side.
   and detailed race results; live timing is not available for this integration.

Verified read-only against championship 26866 on 2026-09-13: 27 registrations,
27 standings rows, five sessions. GridOS requests used:

- `GET /api/v1/championships/:id`
- `GET /api/v1/registrations?registerable_type=Championship&registerable_id=:id`
- `GET /api/v1/championships/:id/standings?page=N`

The standings endpoint was verified live despite being absent from the public
[GridOS collection](https://gridos.thesimgrid.com/). Its response is a tuple with
entries at index 0 and pagination at index 3. The integration checks pagination,
IDs, registration counts and required numeric fields and rejects unexpected
shapes. Official `championship_score` and `position_cache` are displayed directly;
points and penalties are not recomputed. Subsequent manual syncs cascade corrections.

Limitations: solo LMU is supported; team championships fail explicitly. GridOS
does not supply detailed results to this integration, but admins can upload an
LMU XML result as described below. Race publication status is imported, not
assumed to mean final results. Changing a league's championship URL hides its old public snapshot
until a new sync. Withdrawals remain recoverable in registrations; historical
snapshot versions are not retained. Repeated syncs update the same stable IDs.

### Manual LMU race-result upload

After syncing the championship, an admin selects one of its races and uploads an
LMU/rFactor XML result file. Filenames must use the server format
`YYYY_MM_DD_HH_MM_SS-suffix` with an optional `.xml` extension. The backend
accepts at most 8 MB and normalizes position, driver, team, car, class, laps,
best lap, elapsed time, finish status, grid position, and pit stops.

Preview compares the XML timestamp (36-hour tolerance) and meaningful track
tokens with the selected SimGrid race. A mismatch disables confirmation and is
also rejected server-side. Confirm resubmits the file with a hash covering the
selected league, race, and normalized result. Re-uploading updates the same Neon
race row. The raw XML, telemetry, incidents, and local installation paths are
not stored. SimGrid standings remain authoritative for points, penalties, and
stewarding corrections. The public Race Details tab combines the saved SimGrid
schedule with `race_results` by the scheduled race timestamp. Synced entries
open the existing Season 1-style result page; unsynced entries remain visible
with a non-clickable status instead of implying that results are available.

Run `npm.cmd test` in `api/` for parser, authorization and mocked-handler tests.
These do not write to Neon. Before production rollout, test preview/confirmation
on a development Neon database, repeat it to check duplicates, and verify a
changed SimGrid score flows through on the next confirmed sync. Deployment and
the first database sync remain operator actions.

## Removed legacy infrastructure

Vercel deployment configuration, Vercel Blob migration tooling, Google Apps Script administration, and their setup files are not part of the Azure + Neon runtime. The live Assetto Hosting integration remains implemented by the Azure Functions proxy endpoints.
