/**
 * Serverless Function: Sync Selected Races
 * Fetches selected race results from Assetto Corsa API and stores them in Vercel Blob Store
 *
 * Usage: POST /api/sync-selected-races
 * Body: { league: "SRT-GT3-Season-1", races: [{ results_json_url: "...", date: "...", track: "..." }] }
 */

import { put } from '@vercel/blob';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { league, races } = req.body;

  if (!league) {
    return res.status(400).json({
      error: 'Missing league parameter',
      usage: 'POST /api/sync-selected-races with body: { league: "...", races: [...] }'
    });
  }

  if (!races || !Array.isArray(races) || races.length === 0) {
    return res.status(400).json({
      error: 'Missing or invalid races array',
      usage: 'POST /api/sync-selected-races with body: { league: "...", races: [...] }'
    });
  }

  // Sanitize league name for use in filename
  const sanitizedLeague = league.replace(/[^a-zA-Z0-9-_]/g, '-');

  const results = {
    success: [],
    failed: []
  };

  try {
    // Process each race
    for (const race of races) {
      try {
        // Fetch the race result JSON
        const raceResultUrl = `https://sg.assettohosting.com:10027${race.results_json_url}`;
        
        const raceResponse = await fetch(raceResultUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'SimRacingTharavadu/1.0'
          }
        });

        if (!raceResponse.ok) {
          throw new Error(`Failed to fetch race result: ${raceResponse.status} ${raceResponse.statusText}`);
        }

        const raceData = await raceResponse.json();

        // Create unique filename with timestamp and league
        const timestamp = new Date(race.date).getTime();
        const raceFileName = `${sanitizedLeague}/race-${timestamp}.json`;
        const metadataFileName = `${sanitizedLeague}/metadata-${timestamp}.json`;

        // Store in Vercel Blob Store with league-specific path and metadata
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

        // Store metadata about the race
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

    // Return success response
    return res.status(200).json({
      success: true,
      message: `Synced ${results.success.length} of ${races.length} races`,
      league: league,
      results: results
    });

  } catch (error) {
    console.error('Error syncing races:', error);
    return res.status(500).json({
      error: 'Failed to sync races',
      message: error.message,
      results: results
    });
  }
}

// Made with Bob