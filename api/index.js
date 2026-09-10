/**
 * Azure Functions v4 entry point.
 * Importing each module registers its app.http() handler with the runtime.
 *
 * admin-auth and sync-poster are listed first — they have no DB dependency
 * and must register even if a DB-dependent module fails to load.
 */

import './admin-auth.js';
import './sync-poster.js';
import './home.js';
import './events.js';
import './leagues.js';
import './leaderboard.js';
import './registrations.js';
import './race-store.js';
import './standings.js';
import './championships.js';
import './live.js';
import './races.js';
import './results.js';
