/**
 * API: Race Store
 * Persistent archive of race results stored in Neon PostgreSQL.
 * Replaces Vercel Blob storage — no external blob service needed.
 *
 * GET  /api/race-store?action=leagues              — list leagues that have stored races
 * GET  /api/race-store?league=X                   — list all stored races for a league
 * GET  /api/race-store?league=X&timestamp=Y       — get one stored race (with full result_data)
 * POST /api/race-store?action=store&league=X      — fetch latest race from Assetto + store it
 * POST /api/race-store?action=sync                — store multiple selected races
 *   body: { league: string, races: Array<{ results_json_url, track, date, results_page_url? }> }
 */

import { app } from '@azure/functions';
import { sql } from './db.js';

const ASSETTO_BASE = 'https://sg.assettohosting.com:10027';

app.http('race-store', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    const params = new URL(request.url).searchParams;

    try {
      // ── GET: list leagues ──────────────────────────────────────────────────
      if (request.method === 'GET' && params.get('action') === 'leagues') {
        const result = await sql`SELECT DISTINCT league FROM race_results ORDER BY league`;
        return {
          status: 200,
          jsonBody: { success: true, leagues: result.rows.map(r => r.league) }
        };
      }

      // ── GET: list or fetch stored races ───────────────────────────────────
      if (request.method === 'GET') {
        const league = params.get('league');
        const timestamp = params.get('timestamp');

        if (!league) {
          return { status: 400, jsonBody: { error: 'Missing league parameter', usage: '/api/race-store?league=SRT-GT3-Season-1' } };
        }

        if (timestamp) {
          // Single race with full result data
          const result = await sql`
            SELECT id, league, track, session_date, race_timestamp,
                   results_json_url, results_page_url, session_type, stored_at, result_data
            FROM race_results
            WHERE league = ${league} AND race_timestamp = ${parseInt(timestamp, 10)}
          `;
          if (result.rows.length === 0) {
            return { status: 404, jsonBody: { error: 'Race not found', league, timestamp } };
          }
          const row = result.rows[0];
          return {
            status: 200,
            headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
            jsonBody: {
              success: true, league, timestamp,
              metadata: {
                track: row.track, session_date: row.session_date,
                race_timestamp: row.race_timestamp, session_type: row.session_type,
                results_json_url: row.results_json_url, results_page_url: row.results_page_url,
                stored_at: row.stored_at
              },
              data: row.result_data
            }
          };
        }

        // All races for league (metadata only — no result_data for performance)
        const result = await sql`
          SELECT id, league, track, session_date, race_timestamp,
                 results_json_url, results_page_url, session_type, stored_at
          FROM race_results
          WHERE league = ${league}
          ORDER BY race_timestamp DESC
        `;
        return {
          status: 200,
          headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' },
          jsonBody: { success: true, league, count: result.rows.length, races: result.rows }
        };
      }

      // ── POST: store latest race from Assetto ───────────────────────────────
      if (request.method === 'POST') {
        const action = params.get('action');

        if (action === 'store') {
          const league = params.get('league');
          if (!league) {
            return { status: 400, jsonBody: { error: 'Missing league parameter' } };
          }

          // Fetch latest race from Assetto
          const listRes = await fetch(`${ASSETTO_BASE}/api/results/list.json`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'SimRacingTharavadu/1.0' }
          });
          if (!listRes.ok) throw new Error(`Assetto list returned ${listRes.status}`);

          const list = await listRes.json();
          const allResults = Array.isArray(list) ? list : (list.results || []);
          const latestRace = allResults.find(r => r.session_type === 'RACE');

          if (!latestRace) {
            return { status: 404, jsonBody: { error: 'No RACE session found on Assetto server' } };
          }

          const raceData = await fetchRaceData(latestRace.results_json_url);
          const raceTimestamp = new Date(latestRace.date).getTime();

          await sql`
            INSERT INTO race_results
              (league, track, session_date, result_data, race_timestamp, results_json_url, results_page_url, session_type)
            VALUES
              (${league}, ${latestRace.track}, ${latestRace.date}, ${JSON.stringify(raceData)},
               ${raceTimestamp}, ${latestRace.results_json_url}, ${latestRace.results_page_url || ''}, 'RACE')
            ON CONFLICT (league, race_timestamp) DO NOTHING
          `;

          return {
            status: 200,
            jsonBody: {
              success: true,
              message: 'Latest race stored successfully',
              league,
              track: latestRace.track,
              date: latestRace.date,
              race_timestamp: raceTimestamp
            }
          };
        }

        if (action === 'sync') {
          const body = await request.json();
          const { league, races } = body;

          if (!league) {
            return { status: 400, jsonBody: { error: 'Missing league in body' } };
          }
          if (!Array.isArray(races) || races.length === 0) {
            return { status: 400, jsonBody: { error: 'Missing or empty races array in body' } };
          }

          const results = { success: [], failed: [] };

          for (const race of races) {
            try {
              const raceData = await fetchRaceData(race.results_json_url);
              const raceTimestamp = new Date(race.date).getTime();

              await sql`
                INSERT INTO race_results
                  (league, track, session_date, result_data, race_timestamp, results_json_url, results_page_url, session_type)
                VALUES
                  (${league}, ${race.track}, ${race.date}, ${JSON.stringify(raceData)},
                   ${raceTimestamp}, ${race.results_json_url}, ${race.results_page_url || ''}, ${race.session_type || 'RACE'})
                ON CONFLICT (league, race_timestamp) DO NOTHING
              `;
              results.success.push({ track: race.track, date: race.date, race_timestamp: raceTimestamp });
            } catch (err) {
              context.error(`Failed to sync race ${race.track} (${race.date}):`, err);
              results.failed.push({ track: race.track, date: race.date, error: err.message });
            }
          }

          return {
            status: 200,
            jsonBody: {
              success: true,
              message: `Synced ${results.success.length} of ${races.length} races`,
              league, results
            }
          };
        }

        return { status: 400, jsonBody: { error: 'Invalid POST action. Use: store, sync' } };
      }

      return { status: 405, jsonBody: { error: 'Method not allowed' } };

    } catch (error) {
      context.error('Race store error:', error);
      return { status: 500, jsonBody: { error: 'Internal server error', message: error.message } };
    }
  }
});

/**
 * Fetch race result JSON from Assetto server
 * @param {string} resultsJsonUrl - path like /results/download/2026_4_29_10_38_RACE.json
 */
async function fetchRaceData(resultsJsonUrl) {
  const url = resultsJsonUrl.startsWith('http')
    ? resultsJsonUrl
    : `${ASSETTO_BASE}${resultsJsonUrl}`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'SimRacingTharavadu/1.0' }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch race data: ${response.status}`);
  }
  return response.json();
}
