/**
 * API: Championship Standings (Assetto Corsa Proxy)
 * Fetches standings for a specific championship from the Assetto server.
 *
 * GET /api/standings?championshipId=X
 */

import { app } from '@azure/functions';

app.http('standings', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    const championshipId = new URL(request.url).searchParams.get('championshipId');

    if (!championshipId) {
      return { status: 400, jsonBody: { error: 'Missing championshipId parameter', usage: '/api/standings?championshipId=YOUR_ID' } };
    }

    try {
      const response = await fetch(
        `https://sg.assettohosting.com:10027/championship/${championshipId}/standings.json`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'SimRacingTharavadu/1.0' } }
      );

      if (!response.ok) {
        throw new Error(`Assetto API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        status: 200,
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' },
        jsonBody: data
      };

    } catch (error) {
      context.error('Standings error:', error);
      return { status: 500, jsonBody: { error: 'Failed to fetch standings', message: error.message, championshipId } };
    }
  }
});
