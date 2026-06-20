/**
 * API Endpoint: Data Management (Consolidated CRUD)
 * Handles CRUD operations for events, leagues, and leaderboard
 * Consolidates: events.js, leagues.js, leaderboard.js
 * 
 * GET    /api/data?resource=events                    - Get all events
 * GET    /api/data?resource=events&id=X               - Get single event
 * POST   /api/data?resource=events                    - Create new event
 * PUT    /api/data?resource=events                    - Update event
 * DELETE /api/data?resource=events                    - Delete event
 * 
 * GET    /api/data?resource=leagues                   - Get all leagues
 * GET    /api/data?resource=leagues&id=X              - Get single league
 * POST   /api/data?resource=leagues                   - Create new league
 * PUT    /api/data?resource=leagues                   - Update league
 * DELETE /api/data?resource=leagues                   - Delete league
 * 
 * GET    /api/data?resource=leaderboard               - Get all leaderboard entries
 * GET    /api/data?resource=leaderboard&event_id=X    - Get leaderboard for event
 * GET    /api/data?resource=leaderboard&event_id=X&race=Y - Get leaderboard for race
 * POST   /api/data?resource=leaderboard               - Create leaderboard entry
 * PUT    /api/data?resource=leaderboard               - Update leaderboard entry
 * DELETE /api/data?resource=leaderboard               - Delete leaderboard entry
 */

import { sql } from './db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { resource } = req.query;

  if (!resource) {
    return res.status(400).json({
      error: 'Missing resource parameter',
      usage: {
        'Events': '/api/data?resource=events',
        'Leagues': '/api/data?resource=leagues',
        'Leaderboard': '/api/data?resource=leaderboard'
      }
    });
  }

  try {
    // Route to appropriate handler based on resource
    if (resource === 'events') {
      return await handleEvents(req, res);
    }
    
    if (resource === 'leagues') {
      return await handleLeagues(req, res);
    }
    
    if (resource === 'leaderboard') {
      return await handleLeaderboard(req, res);
    }

    return res.status(400).json({
      error: 'Invalid resource',
      message: `Resource "${resource}" not found. Valid resources: events, leagues, leaderboard`
    });

  } catch (error) {
    console.error('Data API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// ============================================================================
// EVENTS HANDLER
// ============================================================================
async function handleEvents(req, res) {
  const { id } = req.query;

  // GET - Fetch events
  if (req.method === 'GET') {
    if (id) {
      // Get single event
      const result = await sql`
        SELECT * FROM events WHERE id = ${id}
      `;
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      return res.status(200).json({ event: result.rows[0] });
    } else {
      // Get all events
      const result = await sql`
        SELECT * FROM events ORDER BY start_date DESC
      `;
      
      return res.status(200).json({ events: result.rows });
    }
  }

  // POST - Create new event
  if (req.method === 'POST') {
    const {
      name,
      sim,
      status = 'upcoming',
      track,
      start_date,
      end_date,
      format,
      drivers = 0,
      max_drivers = 30,
      rounds = 1,
      season,
      description,
      track_mod,
      car_mod,
      practice_server,
      car_options
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    const result = await sql`
      INSERT INTO events (
        name, sim, status, track, start_date, end_date, format,
        drivers, max_drivers, rounds, season, description,
        track_mod, car_mod, practice_server, car_options
      )
      VALUES (
        ${name}, ${sim}, ${status}, ${track}, ${start_date}, ${end_date}, ${format},
        ${drivers}, ${max_drivers}, ${rounds}, ${season}, ${description},
        ${track_mod}, ${car_mod}, ${practice_server}, ${car_options}
      )
      RETURNING *
    `;

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: result.rows[0]
    });
  }

  // PUT - Update event
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE events 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      event: result.rows[0]
    });
  }

  // DELETE - Delete event
  if (req.method === 'DELETE') {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const result = await sql`
      DELETE FROM events WHERE id = ${id} RETURNING id
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}

// ============================================================================
// LEAGUES HANDLER
// ============================================================================
async function handleLeagues(req, res) {
  const { id } = req.query;

  // GET - Fetch leagues
  if (req.method === 'GET') {
    if (id) {
      // Get single league
      const result = await sql`
        SELECT * FROM leagues WHERE id = ${id}
      `;
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'League not found' });
      }
      
      return res.status(200).json({ league: result.rows[0] });
    } else {
      // Get all leagues
      const result = await sql`
        SELECT * FROM leagues ORDER BY start_date DESC
      `;
      
      return res.status(200).json({ leagues: result.rows });
    }
  }

  // POST - Create new league
  if (req.method === 'POST') {
    const {
      name,
      sim,
      status = 'upcoming',
      start_date,
      end_date,
      format,
      season,
      championship_id,
      blob_store,
      drivers = 0,
      max_drivers = 36,
      rounds = 8,
      track,
      description,
      car_options
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'League name is required' });
    }

    const result = await sql`
      INSERT INTO leagues (
        name, sim, status, start_date, end_date, format, season,
        championship_id, blob_store, drivers, max_drivers, rounds,
        track, description, car_options
      )
      VALUES (
        ${name}, ${sim}, ${status}, ${start_date}, ${end_date}, ${format}, ${season},
        ${championship_id}, ${blob_store}, ${drivers}, ${max_drivers}, ${rounds},
        ${track}, ${description}, ${car_options}
      )
      RETURNING *
    `;

    return res.status(201).json({
      success: true,
      message: 'League created successfully',
      league: result.rows[0]
    });
  }

  // PUT - Update league
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'League ID is required' });
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE leagues 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'League updated successfully',
      league: result.rows[0]
    });
  }

  // DELETE - Delete league
  if (req.method === 'DELETE') {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'League ID is required' });
    }

    const result = await sql`
      DELETE FROM leagues WHERE id = ${id} RETURNING id
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'League deleted successfully'
    });
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}

// ============================================================================
// LEADERBOARD HANDLER
// ============================================================================
async function handleLeaderboard(req, res) {
  const { event_id, race, id } = req.query;

  // GET - Fetch leaderboard entries
  if (req.method === 'GET') {
    if (id) {
      // Get single entry
      const result = await sql`
        SELECT * FROM leaderboard WHERE id = ${id}
      `;
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Leaderboard entry not found' });
      }
      
      return res.status(200).json({ entry: result.rows[0] });
    } else if (event_id && race) {
      // Get leaderboard for specific event and race
      const result = await sql`
        SELECT * FROM leaderboard 
        WHERE event_id = ${event_id} AND race = ${race}
        ORDER BY position ASC
      `;
      
      return res.status(200).json({ leaderboard: result.rows });
    } else if (event_id) {
      // Get all races for an event
      const result = await sql`
        SELECT * FROM leaderboard 
        WHERE event_id = ${event_id}
        ORDER BY race, position ASC
      `;
      
      return res.status(200).json({ leaderboard: result.rows });
    } else {
      // Get all leaderboard entries
      const result = await sql`
        SELECT * FROM leaderboard 
        ORDER BY event_id, race, position ASC
      `;
      
      return res.status(200).json({ leaderboard: result.rows });
    }
  }

  // POST - Create new leaderboard entry
  if (req.method === 'POST') {
    const {
      event_id,
      race = 'Race 1',
      position,
      driver,
      tag,
      team,
      points,
      time,
      gap
    } = req.body;

    // Validate required fields
    if (!event_id || !driver || position === undefined) {
      return res.status(400).json({ 
        error: 'Event ID, driver name, and position are required' 
      });
    }

    const result = await sql`
      INSERT INTO leaderboard (
        event_id, race, position, driver, tag, team, points, time, gap
      )
      VALUES (
        ${event_id}, ${race}, ${position}, ${driver}, ${tag}, ${team}, 
        ${points}, ${time}, ${gap}
      )
      RETURNING *
    `;

    return res.status(201).json({
      success: true,
      message: 'Leaderboard entry created successfully',
      entry: result.rows[0]
    });
  }

  // PUT - Update leaderboard entry
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Entry ID is required' });
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const query = `
      UPDATE leaderboard 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Leaderboard entry not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Leaderboard entry updated successfully',
      entry: result.rows[0]
    });
  }

  // DELETE - Delete leaderboard entry
  if (req.method === 'DELETE') {
    const { id, event_id, race } = req.body;

    if (id) {
      // Delete single entry by ID
      const result = await sql`
        DELETE FROM leaderboard WHERE id = ${id} RETURNING id
      `;

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Leaderboard entry not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Leaderboard entry deleted successfully'
      });
    } else if (event_id && race) {
      // Delete all entries for a specific race
      const result = await sql`
        DELETE FROM leaderboard 
        WHERE event_id = ${event_id} AND race = ${race}
        RETURNING id
      `;

      return res.status(200).json({
        success: true,
        message: `Deleted ${result.rows.length} entries for ${race}`
      });
    } else if (event_id) {
      // Delete all entries for an event
      const result = await sql`
        DELETE FROM leaderboard WHERE event_id = ${event_id} RETURNING id
      `;

      return res.status(200).json({
        success: true,
        message: `Deleted ${result.rows.length} entries for event ${event_id}`
      });
    } else {
      return res.status(400).json({ 
        error: 'Entry ID, or event_id (with optional race) is required' 
      });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}

// Made with Bob