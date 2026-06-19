/**
 * API Endpoint: Home Page Data
 * Consolidated endpoint that returns events, leagues, and leaderboard data
 * Reduces API calls from 3 to 1 for the home page
 * 
 * GET /api/home - Get all home page data (events, leagues, leaderboard)
 */

import { sql } from './db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all data in parallel for better performance
    const [eventsResult, leaguesResult, leaderboardResult] = await Promise.all([
      sql`SELECT * FROM events ORDER BY start_date DESC`,
      sql`SELECT * FROM leagues ORDER BY start_date DESC`,
      sql`SELECT * FROM leaderboard ORDER BY event_id, race, position ASC`
    ]);

    // Return consolidated response
    return res.status(200).json({
      events: eventsResult.rows,
      leagues: leaguesResult.rows,
      leaderboard: leaderboardResult.rows
    });

  } catch (error) {
    console.error('Home API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Made with Bob