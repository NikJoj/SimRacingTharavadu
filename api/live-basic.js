/**
 * Serverless Function: Live Timing Basic
 * Fetches basic live timing information from Assetto Corsa API
 * 
 * Usage: /api/live-basic
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

  const apiUrl = 'https://sg.assettohosting.com:10027/api/live-timings/basic.json';

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

    // Return the data with minimal cache for live data
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error fetching live basic timing:', error);
    return res.status(500).json({
      error: 'Failed to fetch live basic timing',
      message: error.message
    });
  }
}

// Made with Bob
