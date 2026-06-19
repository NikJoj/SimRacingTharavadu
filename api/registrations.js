/**
 * API Endpoint: Registrations Management
 * Handles CRUD operations for event/league registrations
 * 
 * GET    /api/registrations          - Get all registrations
 * GET    /api/registrations?id=X     - Get single registration
 * GET    /api/registrations?event=X  - Get registrations for specific event
 * POST   /api/registrations          - Create new registration
 * PUT    /api/registrations          - Update registration
 * DELETE /api/registrations          - Delete registration
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
    // GET - Fetch registrations
    if (req.method === 'GET') {
      const { id, event, driver_tag } = req.query;

      if (id) {
        // Get single registration
        const result = await sql`
          SELECT * FROM registrations WHERE id = ${id}
        `;
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Registration not found' });
        }
        
        return res.status(200).json({ registration: result.rows[0] });
      } else if (event) {
        // Get registrations for specific event
        const result = await sql`
          SELECT * FROM registrations 
          WHERE event = ${event}
          ORDER BY timestamp DESC
        `;
        
        return res.status(200).json({ registrations: result.rows });
      } else if (driver_tag) {
        // Get registrations for specific driver
        const result = await sql`
          SELECT * FROM registrations 
          WHERE driver_tag = ${driver_tag}
          ORDER BY timestamp DESC
        `;
        
        return res.status(200).json({ registrations: result.rows });
      } else {
        // Get all registrations
        const result = await sql`
          SELECT * FROM registrations 
          ORDER BY timestamp DESC
        `;
        
        return res.status(200).json({ registrations: result.rows });
      }
    }

    // POST - Create new registration
    if (req.method === 'POST') {
      const {
        driver_tag,
        discord,
        car_class,
        event
      } = req.body;

      // Validate required fields
      if (!driver_tag || !event) {
        return res.status(400).json({ 
          error: 'Driver tag and event are required' 
        });
      }

      // Check for duplicate registration
      const existing = await sql`
        SELECT id FROM registrations 
        WHERE driver_tag = ${driver_tag} AND event = ${event}
      `;

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Duplicate registration',
          message: `${driver_tag} is already registered for ${event}`
        });
      }

      const result = await sql`
        INSERT INTO registrations (
          driver_tag, discord, car_class, event
        )
        VALUES (
          ${driver_tag}, ${discord}, ${car_class}, ${event}
        )
        RETURNING *
      `;

      // Update driver count in events or leagues table
      try {
        // Try to update events table
        await sql`
          UPDATE events 
          SET drivers = drivers + 1 
          WHERE name = ${event}
        `;
      } catch (e) {
        // If not in events, try leagues
        try {
          await sql`
            UPDATE leagues 
            SET drivers = drivers + 1 
            WHERE name = ${event}
          `;
        } catch (e2) {
          console.log('Could not update driver count:', e2.message);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        registration: result.rows[0]
      });
    }

    // PUT - Update registration
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Registration ID is required' });
      }

      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'timestamp' && key !== 'created_at') {
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
        UPDATE registrations 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await sql.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Registration not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Registration updated successfully',
        registration: result.rows[0]
      });
    }

    // DELETE - Delete registration
    if (req.method === 'DELETE') {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Registration ID is required' });
      }

      // Get registration details before deleting
      const regResult = await sql`
        SELECT event FROM registrations WHERE id = ${id}
      `;

      if (regResult.rows.length === 0) {
        return res.status(404).json({ error: 'Registration not found' });
      }

      const eventName = regResult.rows[0].event;

      // Delete the registration
      await sql`
        DELETE FROM registrations WHERE id = ${id}
      `;

      // Update driver count
      try {
        await sql`
          UPDATE events 
          SET drivers = GREATEST(0, drivers - 1)
          WHERE name = ${eventName}
        `;
      } catch (e) {
        try {
          await sql`
            UPDATE leagues 
            SET drivers = GREATEST(0, drivers - 1)
            WHERE name = ${eventName}
          `;
        } catch (e2) {
          console.log('Could not update driver count:', e2.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Registration deleted successfully'
      });
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Registrations API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Made with Bob