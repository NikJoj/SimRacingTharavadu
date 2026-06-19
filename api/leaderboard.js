/**
 * API Endpoint: Leaderboard Management
 * Handles CRUD operations for leaderboard entries
 * 
 * GET    /api/leaderboard              - Get all leaderboard entries
 * GET    /api/leaderboard?event_id=X   - Get leaderboard for specific event
 * GET    /api/leaderboard?event_id=X&race=Y - Get leaderboard for specific race
 * POST   /api/leaderboard              - Create new leaderboard entry
 * PUT    /api/leaderboard              - Update leaderboard entry
 * DELETE /api/leaderboard              - Delete leaderboard entry
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

  try {
    // GET - Fetch leaderboard entries
    if (req.method === 'GET') {
      const { event_id, race, id } = req.query;

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

  } catch (error) {
    console.error('Leaderboard API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Made with Bob