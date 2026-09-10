/**
 * API: Live Timing (Assetto Corsa Proxy)
 * Proxies real-time live timing data from the Assetto server.
 *
 * GET /api/live                  — both basic info and leaderboard
 * GET /api/live?type=basic       — session / server info only
 * GET /api/live?type=leaderboard — live driver leaderboard only
 */

import { app } from '@azure/functions';

app.http('live', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    const type = new URL(request.url).searchParams.get('type');

    try {
      if (!type) {
        const [basicData, leaderboardData] = await Promise.all([
          fetchLiveBasic(),
          fetchLiveLeaderboard()
        ]);
        return {
          status: 200,
          headers: { 'Cache-Control': 's-maxage=5, stale-while-revalidate' },
          jsonBody: { basic: basicData, leaderboard: leaderboardData }
        };
      }

      if (type === 'basic') {
        const data = await fetchLiveBasic();
        return { status: 200, headers: { 'Cache-Control': 's-maxage=5, stale-while-revalidate' }, jsonBody: data };
      }

      if (type === 'leaderboard') {
        const data = await fetchLiveLeaderboard();
        return { status: 200, headers: { 'Cache-Control': 's-maxage=5, stale-while-revalidate' }, jsonBody: data };
      }

      return { status: 400, jsonBody: { error: 'Invalid type. Use: basic, leaderboard, or omit for both' } };

    } catch (error) {
      context.error('Live timing error:', error);
      return { status: 500, jsonBody: { error: 'Failed to fetch live timing data', message: error.message } };
    }
  }
});

async function fetchLiveBasic() {
  const res = await fetch('https://sg.assettohosting.com:10027/api/live-timings/basic.json', {
    headers: { 'Accept': 'application/json', 'User-Agent': 'SimRacingTharavadu/1.0' }
  });
  if (!res.ok) throw new Error(`Basic API returned ${res.status}`);
  return res.json();
}

async function fetchLiveLeaderboard() {
  const res = await fetch('https://sg.assettohosting.com:10027/api/live-timings/leaderboard.json', {
    headers: { 'Accept': 'application/json', 'User-Agent': 'SimRacingTharavadu/1.0' }
  });
  if (!res.ok) throw new Error(`Leaderboard API returned ${res.status}`);
  return res.json();
}
