/**
 * Serverless Function: Individual Race Result
 * Fetches a specific race result JSON from Assetto Corsa API
 * 
 * Usage: /api/race-result?file=2026_4_29_10_38_RACE.json
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

  // Get the file parameter from query string
  const { file } = req.query;

  if (!file) {
    return res.status(400).json({
      error: 'Missing file parameter',
      usage: '/api/race-result?file=2026_4_29_10_38_RACE.json'
    });
  }

  // Construct the full API URL
  const apiUrl = `https://sg.assettohosting.com:10027/results/download/${file}`;

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
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error fetching race result:', error);
    return res.status(500).json({
      error: 'Failed to fetch race result',
      message: error.message,
      file: file
    });
  }
}

// Made with Bob