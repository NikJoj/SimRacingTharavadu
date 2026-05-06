/**
 * Serverless Function: Championships List
 * Fetches list of all championships from Assetto Corsa API
 * 
 * Usage: /api/championships
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

  const apiUrl = 'https://sg.assettohosting.com:10027/api/championships/list.json';

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
    console.error('Error fetching championships list:', error);
    return res.status(500).json({
      error: 'Failed to fetch championships list',
      message: error.message
    });
  }
}

// Made with Bob
