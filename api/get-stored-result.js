/**
 * Serverless Function: Get Stored Race Results
 * Retrieves race results from Vercel Blob Store, optionally filtered by league
 *
 * Usage:
 * - Get all results for a league: /api/get-stored-result?league=SRT-GT3-Season-1
 * - Get specific race: /api/get-stored-result?league=SRT-GT3-Season-1&timestamp=1595959680000
 * - Get all leagues: /api/get-stored-result?list=leagues
 */

import { list } from '@vercel/blob';

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

  const { league, timestamp, list: listMode } = req.query;

  try {
    // List all leagues
    if (listMode === 'leagues') {
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

    // Get results for a specific league
    if (league) {
      const sanitizedLeague = league.replace(/[^a-zA-Z0-9-_]/g, '-');
      const prefix = `${sanitizedLeague}/`;

      // If timestamp is provided, get specific race
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

        // Fetch the race data
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

      // Sort by timestamp descending (newest first)
      races.sort((a, b) => b.timestamp - a.timestamp);

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      return res.status(200).json({
        success: true,
        league: league,
        count: races.length,
        races: races
      });
    }

    // No league specified - return error
    return res.status(400).json({
      error: 'Missing parameters',
      usage: {
        'List all leagues': '/api/get-stored-result?list=leagues',
        'Get league races': '/api/get-stored-result?league=SRT-GT3-Season-1',
        'Get specific race': '/api/get-stored-result?league=SRT-GT3-Season-1&timestamp=1595959680000'
      }
    });

  } catch (error) {
    console.error('Error retrieving stored results:', error);
    return res.status(500).json({
      error: 'Failed to retrieve stored results',
      message: error.message
    });
  }
}

// Made with Bob