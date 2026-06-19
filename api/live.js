/**
 * API Endpoint: Live Timing
 * Consolidated endpoint for live timing data from Assetto Corsa API
 * Merges: live-basic, live-leaderboard
 * 
 * GET /api/live?type=basic       - Get basic live timing info
 * GET /api/live?type=leaderboard - Get live timing leaderboard
 * GET /api/live                  - Get both basic and leaderboard data
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type } = req.query;

  try {
    // Return both if no type specified
    if (!type) {
      const [basicData, leaderboardData] = await Promise.all([
        fetchLiveBasic(),
        fetchLiveLeaderboard()
      ]);

      res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
      return res.status(200).json({
        basic: basicData,
        leaderboard: leaderboardData
      });
    }

    // Return specific type
    if (type === 'basic') {
      const data = await fetchLiveBasic();
      res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
      return res.status(200).json(data);
    }

    if (type === 'leaderboard') {
      const data = await fetchLiveLeaderboard();
      res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
      return res.status(200).json(data);
    }

    return res.status(400).json({
      error: 'Invalid type parameter',
      usage: {
        'Get both': '/api/live',
        'Get basic': '/api/live?type=basic',
        'Get leaderboard': '/api/live?type=leaderboard'
      }
    });

  } catch (error) {
    console.error('Live timing API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch live timing data',
      message: error.message
    });
  }
}

// Helper: Fetch basic live timing
async function fetchLiveBasic() {
  const apiUrl = 'https://sg.assettohosting.com:10027/api/live-timings/basic.json';

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SimRacingTharavadu/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Basic API returned ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Helper: Fetch live leaderboard
async function fetchLiveLeaderboard() {
  const apiUrl = 'https://sg.assettohosting.com:10027/api/live-timings/leaderboard.json';

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SimRacingTharavadu/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Leaderboard API returned ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Made with Bob