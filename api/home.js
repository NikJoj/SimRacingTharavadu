/**
 * API: Home (Read-only aggregate)
 * Returns events, leagues, and leaderboard in a single call for the public homepage.
 * Initializes DB tables on first call (idempotent).
 *
 * GET /api/home
 */

import { app } from '@azure/functions';
import { sql, initializeTables } from './db.js';

app.http('home', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    try {
      // Ensure schema is up-to-date on every cold start (no-op if tables exist)
      await initializeTables();

      const [eventsResult, leaguesResult, leaderboardResult] = await Promise.all([
        sql`SELECT * FROM events ORDER BY start_date DESC`,
        sql`SELECT * FROM leagues ORDER BY start_date DESC`,
        sql`SELECT * FROM leaderboard ORDER BY event_id, race, position ASC`
      ]);

      return {
        status: 200,
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' },
        jsonBody: {
          events: eventsResult.rows,
          leagues: leaguesResult.rows,
          leaderboard: leaderboardResult.rows
        }
      };

    } catch (error) {
      context.error('Home API error:', error);
      return { status: 500, jsonBody: { error: 'Internal server error', message: error.message } };
    }
  }
});
