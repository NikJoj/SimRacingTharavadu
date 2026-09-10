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

The complete request and response contract is in `docs/openapi.yaml`.

## Neon PostgreSQL

The data layer is implemented in `api/db.js` with `@neondatabase/serverless`. It creates and evolves the schema idempotently during initialization.

Primary tables: `events`, `leagues`, `leaderboard`, `registrations`, and `race_results`.

Race results use `race_results.league_id` for new records. The former `leagues.blob_store` value remains only as legacy compatibility data so historical records can be linked safely; it is not required for new leagues and is not a storage location.

## Required Azure configuration

Configure these application settings in Azure Static Web Apps. Never place their real values in the repository.

| Setting | Required by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Data and race archive functions | Neon PostgreSQL connection string |
| `ADMIN_USERNAME` | `login-auth` | Dashboard username |
| `ADMIN_PASSWORD` | `login-auth` | Dashboard password |
| `JWT_SECRET` | `login-auth` | HMAC signing secret for the short-lived dashboard token |
| `GITHUB_TOKEN` | `sync-poster` | GitHub token with repository-contents write access |
| `GITHUB_OWNER` | `sync-poster` | GitHub repository owner |
| `GITHUB_REPO` | `sync-poster` | Repository name; defaults to `SimRacingTharavadu` |
| `GITHUB_BRANCH` | `sync-poster` | Target branch; defaults to `main` |

`.env.example` provides safe placeholders for local development. The local `.env` file is ignored and must never be committed.

## Security and operations

- The static site and API use same-origin `/api` requests; frontend code has no database credentials.
- The admin login endpoint issues a two-hour HMAC-signed token and the browser validates it before showing the dashboard.
- Azure Functions currently use anonymous function authorization. The dashboard token is a UI session check, not server-side authorization for CRUD routes. Add server-side token validation before treating the dashboard as a security boundary.
- Rotate database, GitHub, and admin secrets if they have ever been committed or shared.
- Add Application Insights if request-level monitoring is required.

## Local development

1. Copy `.env.example` to `.env.local` and replace placeholders with development values.
2. Install dependencies in `api/`.
3. Run Azure Functions Core Tools from `api/`; functions are served under `http://localhost:7071/api`.
4. Serve the repository root with a local static server that proxies `/api` to the Functions host, or test API endpoints directly.

## Removed legacy infrastructure

Vercel deployment configuration, Vercel Blob migration tooling, Google Apps Script administration, and their setup files are not part of the Azure + Neon runtime. The live Assetto Hosting integration remains implemented by the Azure Functions proxy endpoints.
