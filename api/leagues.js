/**
 * API Endpoint: Leagues Management
 * Handles CRUD operations for leagues
 * 
 * GET    /api/leagues          - Get all leagues
 * GET    /api/leagues?id=X     - Get single league
 * POST   /api/leagues          - Create new league
 * PUT    /api/leagues          - Update league
 * DELETE /api/leagues          - Delete league
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
    // GET - Fetch leagues
    if (req.method === 'GET') {
      const { id } = req.query;

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

  } catch (error) {
    console.error('Leagues API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Made with Bob