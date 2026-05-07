/**
 * Serverless Function: Fetch All Races
 * Fetches all race results from Assetto Corsa API
 *
 * Usage: /api/fetch-races
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

  const resultsListUrl = 'https://sg.assettohosting.com:10027/api/results/list.json';

  try {
    // Fetch the results list
    const listResponse = await fetch(resultsListUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SimRacingTharavadu/1.0'
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to fetch results list: ${listResponse.status} ${listResponse.statusText}`);
    }

    const resultsList = await listResponse.json();

    // Ensure resultsList is an array
    const resultsArray = Array.isArray(resultsList) ? resultsList : (resultsList.results || []);

    if (!Array.isArray(resultsArray) || resultsArray.length === 0) {
      return res.status(404).json({
        error: 'No results found',
        message: 'The results list is empty or invalid format',
        debug: typeof resultsList
      });
    }

    // Filter only RACE sessions and format the data
    const races = resultsArray
      .filter(result => result.session_type === 'RACE')
      .map(race => ({
        id: race.results_json_url, // Use URL as unique identifier
        track: race.track,
        date: race.date,
        session_type: race.session_type,
        results_json_url: race.results_json_url,
        results_page_url: race.results_page_url,
        timestamp: new Date(race.date).getTime()
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by date, newest first

    return res.status(200).json({
      success: true,
      count: races.length,
      races: races
    });

  } catch (error) {
    console.error('Error fetching races:', error);
    return res.status(500).json({
      error: 'Failed to fetch races',
      message: error.message
    });
  }
}

// Made with Bob