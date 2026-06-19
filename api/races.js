/**
 * API Endpoint: Race Operations
 * Consolidated endpoint for all race-related operations
 * Merges: fetch-races, race-result, get-stored-result, store-latest-result, sync-selected-races
 * 
 * GET    /api/races?action=list                           - Fetch all races from Assetto API
 * GET    /api/races?action=result&file=X                  - Get specific race result
 * GET    /api/races?action=stored&league=X                - Get stored races for league
 * GET    /api/races?action=stored&league=X&timestamp=Y    - Get specific stored race
 * GET    /api/races?action=leagues                        - List all leagues
 * POST   /api/races?action=store&league=X                 - Store latest race result
 * POST   /api/races?action=sync                           - Sync selected races
 */

import { put, list } from '@vercel/blob';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  if (!action) {
    return res.status(400).json({
      error: 'Missing action parameter',
      usage: {
        'List races': 'GET /api/races?action=list',
        'Get race result': 'GET /api/races?action=result&file=2026_4_29_10_38_RACE.json',
        'Get stored races': 'GET /api/races?action=stored&league=SRT-GT3-Season-1',
        'List leagues': 'GET /api/races?action=leagues',
        'Store latest': 'POST /api/races?action=store&league=SRT-GT3-Season-1',
        'Sync races': 'POST /api/races?action=sync (with body)'
      }
    });
  }

  try {
    // GET: List all races from Assetto API
    if (action === 'list' && req.method === 'GET') {
      return await handleFetchRaces(req, res);
    }

    // GET: Get specific race result
    if (action === 'result' && req.method === 'GET') {
      return await handleRaceResult(req, res);
    }

    // GET: Get stored races from Blob Store
    if (action === 'stored' && req.method === 'GET') {
      return await handleGetStored(req, res);
    }

    // GET: List all leagues
    if (action === 'leagues' && req.method === 'GET') {
      return await handleListLeagues(req, res);
    }

    // POST: Store latest race result
    if (action === 'store' && req.method === 'POST') {
      return await handleStoreLatest(req, res);
    }

    // POST: Sync selected races
    if (action === 'sync' && req.method === 'POST') {
      return await handleSyncSelected(req, res);
    }

    return res.status(400).json({ error: 'Invalid action or method combination' });

  } catch (error) {
    console.error('Races API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Handler: Fetch all races from Assetto API
async function handleFetchRaces(req, res) {
  const resultsListUrl = 'https://sg.assettohosting.com:10027/api/results/list.json';

  const listResponse = await fetch(resultsListUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SimRacingTharavadu/1.0'
    }
  });

  if (!listResponse.ok) {
    throw new Error(`Failed to fetch results list: ${listResponse.status}`);
  }

  const resultsList = await listResponse.json();
  const resultsArray = Array.isArray(resultsList) ? resultsList : (resultsList.results || []);

  if (!Array.isArray(resultsArray) || resultsArray.length === 0) {
    return res.status(404).json({
      error: 'No results found',
      message: 'The results list is empty or invalid format'
    });
  }

  const races = resultsArray
    .filter(result => result.session_type === 'RACE')
    .map(race => ({
      id: race.results_json_url,
      track: race.track,
      date: race.date,
      session_type: race.session_type,
      results_json_url: race.results_json_url,
      results_page_url: race.results_page_url,
      timestamp: new Date(race.date).getTime()
    }))
    .sort((a, b) => b.timestamp - a.timestamp);

  return res.status(200).json({
    success: true,
    count: races.length,
    races: races
  });
}

// Handler: Get specific race result
async function handleRaceResult(req, res) {
  const { file } = req.query;

  if (!file) {
    return res.status(400).json({
      error: 'Missing file parameter',
      usage: '/api/races?action=result&file=2026_4_29_10_38_RACE.json'
    });
  }

  const apiUrl = `https://sg.assettohosting.com:10027/results/download/${file}`;

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
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).json(data);
}

// Handler: Get stored races from Blob Store
async function handleGetStored(req, res) {
  const { league, timestamp } = req.query;

  if (!league) {
    return res.status(400).json({
      error: 'Missing league parameter',
      usage: '/api/races?action=stored&league=SRT-GT3-Season-1'
    });
  }

  const sanitizedLeague = league.replace(/[^a-zA-Z0-9-_]/g, '-');
  const prefix = `${sanitizedLeague}/`;

  // Get specific race
  if (timestamp) {
    const raceFileName = `${prefix}race-${timestamp}.json`;
    const metadataFileName = `${prefix}metadata-${timestamp}.json`;

    const { blobs } = await list({ prefix });
    const raceBlob = blobs.find(b => b.pathname === raceFileName);
    const metadataBlob = blobs.find(b => b.pathname === metadataFileName);

    if (!raceBlob) {
      return res.status(404).json({
        error: 'Race not found',
        message: `No race found for league "${league}" with timestamp ${timestamp}`
      });
    }

    const raceResponse = await fetch(raceBlob.url);
    const raceData = await raceResponse.json();

    let metadata = null;
    if (metadataBlob) {
      const metadataResponse = await fetch(metadataBlob.url);
      metadata = await metadataResponse.json();
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      league: league,
      timestamp: timestamp,
      metadata: metadata,
      data: raceData
    });
  }

  // Get all races for the league
  const { blobs } = await list({ prefix });
  const races = [];
  const metadataFiles = blobs.filter(b => b.pathname.startsWith(`${prefix}metadata-`));

  for (const metadataBlob of metadataFiles) {
    const response = await fetch(metadataBlob.url);
    const metadata = await response.json();
    races.push({
      timestamp: metadata.race_timestamp,
      date: metadata.date,
      track: metadata.track,
      session_type: metadata.session_type,
      blob_url: metadata.blob_url,
      metadata_url: metadataBlob.url
    });
  }

  races.sort((a, b) => b.timestamp - a.timestamp);

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json({
    success: true,
    league: league,
    count: races.length,
    races: races
  });
}

// Handler: List all leagues
async function handleListLeagues(req, res) {
  const { blobs } = await list();
  const leagues = new Set();
  
  blobs.forEach(blob => {
    if (blob.pathname.includes('/')) {
      const leagueName = blob.pathname.split('/')[0];
      leagues.add(leagueName);
    }
  });

  return res.status(200).json({
    success: true,
    leagues: Array.from(leagues)
  });
}

// Handler: Store latest race result
async function handleStoreLatest(req, res) {
  const { league } = req.query;
  
  if (!league) {
    return res.status(400).json({
      error: 'Missing league parameter',
      usage: '/api/races?action=store&league=SRT-GT3-Season-1'
    });
  }

  const sanitizedLeague = league.replace(/[^a-zA-Z0-9-_]/g, '-');
  const resultsListUrl = 'https://sg.assettohosting.com:10027/api/results/list.json';

  const listResponse = await fetch(resultsListUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SimRacingTharavadu/1.0'
    }
  });

  if (!listResponse.ok) {
    throw new Error(`Failed to fetch results list: ${listResponse.status}`);
  }

  const resultsList = await listResponse.json();
  const resultsArray = Array.isArray(resultsList) ? resultsList : (resultsList.results || []);

  if (!Array.isArray(resultsArray) || resultsArray.length === 0) {
    return res.status(404).json({
      error: 'No results found',
      message: 'The results list is empty or invalid format'
    });
  }

  const lastRaceResult = resultsArray.find(result => result.session_type === 'RACE');

  if (!lastRaceResult) {
    return res.status(404).json({
      error: 'No race results found',
      message: 'No RACE session found in the results list'
    });
  }

  const raceResultUrl = `https://sg.assettohosting.com:10027${lastRaceResult.results_json_url}`;
  
  const raceResponse = await fetch(raceResultUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SimRacingTharavadu/1.0'
    }
  });

  if (!raceResponse.ok) {
    throw new Error(`Failed to fetch race result: ${raceResponse.status}`);
  }

  const raceData = await raceResponse.json();

  const timestamp = new Date(lastRaceResult.date).getTime();
  const raceFileName = `${sanitizedLeague}/race-${timestamp}.json`;
  const metadataFileName = `${sanitizedLeague}/metadata-${timestamp}.json`;

  const blob = await put(raceFileName, JSON.stringify(raceData, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    metadata: {
      league: league,
      track: lastRaceResult.track,
      session_type: lastRaceResult.session_type,
      date: lastRaceResult.date
    }
  });

  const metadata = {
    league: league,
    track: lastRaceResult.track,
    session_type: lastRaceResult.session_type,
    date: lastRaceResult.date,
    results_json_url: lastRaceResult.results_json_url,
    results_page_url: lastRaceResult.results_page_url,
    stored_at: new Date().toISOString(),
    blob_url: blob.url,
    race_timestamp: timestamp
  };

  const metadataBlob = await put(metadataFileName, JSON.stringify(metadata, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    metadata: {
      league: league,
      type: 'metadata'
    }
  });

  return res.status(200).json({
    success: true,
    message: 'Latest race result stored successfully',
    league: league,
    metadata: metadata,
    blob_urls: {
      result: blob.url,
      metadata: metadataBlob.url
    }
  });
}

// Handler: Sync selected races
async function handleSyncSelected(req, res) {
  const { league, races } = req.body;

  if (!league) {
    return res.status(400).json({
      error: 'Missing league parameter',
      usage: 'POST /api/races?action=sync with body: { league: "...", races: [...] }'
    });
  }

  if (!races || !Array.isArray(races) || races.length === 0) {
    return res.status(400).json({
      error: 'Missing or invalid races array',
      usage: 'POST /api/races?action=sync with body: { league: "...", races: [...] }'
    });
  }

  const sanitizedLeague = league.replace(/[^a-zA-Z0-9-_]/g, '-');

  const results = {
    success: [],
    failed: []
  };

  for (const race of races) {
    try {
      const raceResultUrl = `https://sg.assettohosting.com:10027${race.results_json_url}`;
      
      const raceResponse = await fetch(raceResultUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SimRacingTharavadu/1.0'
        }
      });

      if (!raceResponse.ok) {
        throw new Error(`Failed to fetch race result: ${raceResponse.status}`);
      }

      const raceData = await raceResponse.json();

      const timestamp = new Date(race.date).getTime();
      const raceFileName = `${sanitizedLeague}/race-${timestamp}.json`;
      const metadataFileName = `${sanitizedLeague}/metadata-${timestamp}.json`;

      const blob = await put(raceFileName, JSON.stringify(raceData, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        metadata: {
          league: league,
          track: race.track,
          session_type: race.session_type || 'RACE',
          date: race.date
        }
      });

      const metadata = {
        league: league,
        track: race.track,
        session_type: race.session_type || 'RACE',
        date: race.date,
        results_json_url: race.results_json_url,
        results_page_url: race.results_page_url || '',
        stored_at: new Date().toISOString(),
        blob_url: blob.url,
        race_timestamp: timestamp
      };

      const metadataBlob = await put(metadataFileName, JSON.stringify(metadata, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        metadata: {
          league: league,
          type: 'metadata'
        }
      });

      results.success.push({
        track: race.track,
        date: race.date,
        blob_url: blob.url,
        metadata_url: metadataBlob.url
      });

    } catch (error) {
      console.error(`Error syncing race ${race.track} (${race.date}):`, error);
      results.failed.push({
        track: race.track,
        date: race.date,
        error: error.message
      });
    }
  }

  return res.status(200).json({
    success: true,
    message: `Synced ${results.success.length} of ${races.length} races`,
    league: league,
    results: results
  });
}

// Made with Bob