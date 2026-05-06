/**
 * Serverless Function: Store Latest Race Result
 * Fetches the latest race result from Assetto Corsa API and stores it in Vercel Blob Store
 *
 * Usage: /api/store-latest-result?league=SRT-GT3-Season-1
 */

import { put } from '@vercel/blob';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get league name from query parameter
  const { league } = req.query;
  
  if (!league) {
    return res.status(400).json({
      error: 'Missing league parameter',
      usage: '/api/store-latest-result?league=SRT-GT3-Season-1'
    });
  }

  // Sanitize league name for use in filename
  const sanitizedLeague = league.replace(/[^a-zA-Z0-9-_]/g, '-');

  const resultsListUrl = 'https://sg.assettohosting.com:10027/api/results/list.json';

  try {
    // Step 1: Fetch the results list
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

    // Step 2: Find the last race result (not practice or qualifying)
    const lastRaceResult = resultsList.find(result => result.session_type === 'RACE');

    if (!lastRaceResult) {
      return res.status(404).json({
        error: 'No race results found',
        message: 'No RACE session found in the results list'
      });
    }

    // Step 3: Fetch the actual race result JSON
    const raceResultUrl = `https://sg.assettohosting.com:10027${lastRaceResult.results_json_url}`;
    
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

    // Step 4: Create unique filename with timestamp and league
    const timestamp = new Date(lastRaceResult.date).getTime();
    const raceFileName = `${sanitizedLeague}/race-${timestamp}.json`;
    const metadataFileName = `${sanitizedLeague}/metadata-${timestamp}.json`;

    // Step 5: Store in Vercel Blob Store with league-specific path and metadata
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

    // Step 6: Store metadata about the race
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

    // Return success response
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

  } catch (error) {
    console.error('Error storing race result:', error);
    return res.status(500).json({
      error: 'Failed to store race result',
      message: error.message
    });
  }
}

// Made with Bob