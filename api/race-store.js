/**
 * API: Race Store
 * Persistent archive of race results stored in Neon PostgreSQL.
 * Replaces Vercel Blob storage — no external blob service needed.
 *
 * GET  /api/race-store?action=leagues              — list leagues that have stored races
 * GET  /api/race-store?leagueId=X                 — list all stored races for a league
 * GET  /api/race-store?leagueId=X&timestamp=Y     — get one stored race (with full result_data)
 * POST /api/race-store?action=store&leagueId=X    — fetch latest race from Assetto + store it
 * POST /api/race-store?action=sync                — store multiple selected races
 *   body: { leagueId: number, races: Array<{ results_json_url, track, date, results_page_url? }> }
 */

import { app } from '@azure/functions';
import { sql, query } from './db.js';

const ASSETTO_BASE = 'https://sg.assettohosting.com:10027';

app.http('raceStore', {
  route: 'race-store',
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
        const result = await sql`
          SELECT DISTINCT race.league_id, race.league AS key,
                 COALESCE(league_record.name, race.league) AS name
          FROM race_results AS race
          LEFT JOIN leagues AS league_record ON league_record.id = race.league_id
          ORDER BY name
        `;
        return {
          status: 200,
          jsonBody: { success: true, leagues: result.rows }
        };
      }

      // ── GET: list or fetch stored races ───────────────────────────────────
      if (request.method === 'GET') {
        const reference = await resolveLeague(params.get('leagueId'), params.get('league'));
        const timestamp = params.get('timestamp');

        if (!reference) {
          return { status: 400, jsonBody: { error: 'Missing or invalid leagueId', usage: '/api/race-store?leagueId=1' } };
        }

        if (timestamp) {
          // Single race with full result data
          const result = await findRaces(reference, parseInt(timestamp, 10), true);
          if (result.rows.length === 0) {
            return { status: 404, jsonBody: { error: 'Race not found', leagueId: reference.id, timestamp } };
          }
          const row = result.rows[0];
          return {
            status: 200,
            headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
            jsonBody: {
              success: true, leagueId: reference.id, league: reference.name, timestamp,
              metadata: {
                track: row.track, session_date: row.date,
                race_timestamp: row.race_timestamp, session_type: row.session_type,
                results_json_url: row.results_json_url, results_page_url: row.results_page_url,
                stored_at: row.stored_at
              },
              data: row.result_data
            }
          };
        }

        // All races for league (metadata only — no result_data for performance)
        const result = await findRaces(reference);
        return {
          status: 200,
          headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' },
          jsonBody: { success: true, leagueId: reference.id, league: reference.name, count: result.rows.length, races: result.rows }
        };
      }

      // ── POST: store latest race from Assetto ───────────────────────────────
      if (request.method === 'POST') {
        const action = params.get('action');

        if (action === 'store') {
          const reference = await resolveLeague(params.get('leagueId'), params.get('league'));
          if (!reference) {
            return { status: 400, jsonBody: { error: 'Missing or invalid leagueId' } };
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
              (league, league_id, track, session_date, result_data, race_timestamp, results_json_url, results_page_url, session_type)
            VALUES
              (${reference.storageKey}, ${reference.id}, ${latestRace.track}, ${latestRace.date}, ${JSON.stringify(raceData)},
               ${raceTimestamp}, ${latestRace.results_json_url}, ${latestRace.results_page_url || ''}, 'RACE')
            ON CONFLICT (league, race_timestamp) DO NOTHING
          `;

          return {
            status: 200,
            jsonBody: {
              success: true,
              message: 'Latest race stored successfully',
              leagueId: reference.id,
              league: reference.name,
              track: latestRace.track,
              date: latestRace.date,
              race_timestamp: raceTimestamp
            }
          };
        }

        if (action === 'sync') {
          const body = await request.json();
          const { leagueId, league, races } = body;
          const reference = await resolveLeague(leagueId, league);

          if (!reference) {
            return { status: 400, jsonBody: { error: 'Missing or invalid leagueId in body' } };
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
                  (league, league_id, track, session_date, result_data, race_timestamp, results_json_url, results_page_url, session_type)
                VALUES
                  (${reference.storageKey}, ${reference.id}, ${race.track}, ${race.date}, ${JSON.stringify(raceData)},
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
              leagueId: reference.id, league: reference.name, results
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

async function resolveLeague(leagueId, legacyLeague) {
  if (leagueId) {
    const result = await sql`SELECT id, name, blob_store FROM leagues WHERE id = ${leagueId}`;
    if (result.rows.length === 0) return null;
    const league = result.rows[0];
    return {
      id: Number(league.id),
      name: league.name,
      // Use the immutable primary key for new rows; this remains stable if renamed.
      storageKey: String(league.id),
      legacyKey: league.blob_store || ''
    };
  }

  // Temporary backward compatibility for existing callers and unmigrated rows.
  if (!legacyLeague) return null;
  return { id: null, name: legacyLeague, storageKey: legacyLeague, legacyKey: legacyLeague };
}

async function findRaces(reference, timestamp, includeData = false) {
  const fields = includeData
    ? 'id, league, league_id, track, session_date AS date, race_timestamp, results_json_url, results_page_url, session_type, stored_at, result_data'
    : 'id, league, league_id, track, session_date AS date, race_timestamp, results_json_url, results_page_url, session_type, stored_at';
  const clauses = [];
  const params = [];

  if (reference.id !== null) {
    clauses.push('(league_id = $1 OR league = $2)');
    params.push(reference.id, reference.legacyKey);
  } else {
    clauses.push('league = $1');
    params.push(reference.storageKey);
  }
  if (timestamp !== undefined) {
    clauses.push(`race_timestamp = $${params.length + 1}`);
    params.push(timestamp);
  }
  const order = timestamp === undefined ? ' ORDER BY race_timestamp DESC' : '';
  return query(`SELECT ${fields} FROM race_results WHERE ${clauses.join(' AND ')}${order}`, params);
}

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
