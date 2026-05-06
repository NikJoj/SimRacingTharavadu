/**
 * Serverless Function: Championship Standings
 * Fetches championship standings from Assetto Corsa API
 * 
 * Usage: /api/standings?championshipId=YOUR_CHAMPIONSHIP_ID
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

  // Get championship ID from query parameter
  const { championshipId } = req.query;

  if (!championshipId) {
    return res.status(400).json({
      error: 'Missing championshipId parameter',
      usage: '/api/standings?championshipId=YOUR_CHAMPIONSHIP_ID'
    });
  }

  const apiUrl = `https://sg.assettohosting.com:10027/championship/${championshipId}/standings.json`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SimRacingTharavadu/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Return the data with cache headers
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error fetching championship standings:', error);
    return res.status(500).json({
      error: 'Failed to fetch championship standings',
      message: error.message,
      championshipId: championshipId
    });
  }
}

// Made with Bob
