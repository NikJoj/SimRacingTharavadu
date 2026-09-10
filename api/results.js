/**
 * API: Results List (Assetto Corsa Proxy)
 * Fetches the full list of race result files from the Assetto server.
 *
 * GET /api/results
 */

import { app } from '@azure/functions';

app.http('results', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    try {
      const response = await fetch(
        'https://sg.assettohosting.com:10027/api/results/list.json',
        { headers: { 'Accept': 'application/json', 'User-Agent': 'SimRacingTharavadu/1.0' } }
      );

      if (!response.ok) {
        throw new Error(`Assetto API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        status: 200,
        headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate' },
        jsonBody: data
      };

    } catch (error) {
      context.error('Results error:', error);
      return { status: 500, jsonBody: { error: 'Failed to fetch results list', message: error.message } };
    }
  }
});
