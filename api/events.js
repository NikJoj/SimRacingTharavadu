/**
 * API Endpoint: Events Management
 * Handles CRUD operations for events
 * 
 * GET    /api/events          - Get all events
 * GET    /api/events?id=X     - Get single event
 * POST   /api/events          - Create new event
 * PUT    /api/events          - Update event
 * DELETE /api/events          - Delete event
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
    // GET - Fetch events
    if (req.method === 'GET') {
      const { id } = req.query;

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

  } catch (error) {
    console.error('Events API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Made with Bob