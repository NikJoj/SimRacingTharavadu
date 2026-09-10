/**
 * API: Races (Assetto Corsa Proxy)
 * Proxies requests to the Assetto Corsa server API, bypassing CORS.
 * Returns live race lists and individual race result JSON files.
 *
 * GET /api/races?action=list              — list all RACE sessions from Assetto
 * GET /api/races?action=result&file=X    — fetch a specific race result JSON
 */

import { app } from '@azure/functions';

app.http('races', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    const params = new URL(request.url).searchParams;
    const action = params.get('action');

    if (!action) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing action parameter',
          usage: {
            'List races': 'GET /api/races?action=list',
            'Get race result': 'GET /api/races?action=result&file=2026_4_29_10_38_RACE.json'
          }
        }
      };
    }

    try {
      // ── list: all RACE sessions from Assetto ───────────────────────────────
      if (action === 'list') {
        const listResponse = await fetch('https://sg.assettohosting.com:10027/api/results/list.json', {
          headers: { 'Accept': 'application/json', 'User-Agent': 'SimRacingTharavadu/1.0' }
        });

        if (!listResponse.ok) {
          throw new Error(`Assetto API returned ${listResponse.status}`);
        }

        const resultsList = await listResponse.json();
        const resultsArray = Array.isArray(resultsList) ? resultsList : (resultsList.results || []);

        if (!Array.isArray(resultsArray) || resultsArray.length === 0) {
          return { status: 404, jsonBody: { error: 'No results found' } };
        }

        const races = resultsArray
          .filter(r => r.session_type === 'RACE')
          .map(r => ({
            id: r.results_json_url,
            track: r.track,
            date: r.date,
            session_type: r.session_type,
            results_json_url: r.results_json_url,
            results_page_url: r.results_page_url,
            timestamp: new Date(r.date).getTime()
          }))
          .sort((a, b) => b.timestamp - a.timestamp);

        return { status: 200, jsonBody: { success: true, count: races.length, races } };
      }

      // ── result: fetch one race result JSON ────────────────────────────────
      if (action === 'result') {
        const file = params.get('file');
        if (!file) {
          return { status: 400, jsonBody: { error: 'Missing file parameter', usage: '/api/races?action=result&file=2026_4_29_10_38_RACE.json' } };
        }

        const response = await fetch(`https://sg.assettohosting.com:10027/results/download/${file}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'SimRacingTharavadu/1.0' }
        });

        if (!response.ok) {
          throw new Error(`Assetto API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return {
          status: 200,
          headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
          jsonBody: data
        };
      }

      return { status: 400, jsonBody: { error: 'Invalid action. Use: list, result' } };

    } catch (error) {
      context.error('Races proxy error:', error);
      return { status: 500, jsonBody: { error: 'Internal server error', message: error.message } };
    }
  }
});
