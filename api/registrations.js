/**
 * API Endpoint: Registrations Management
 * Handles CRUD operations for event/league registrations
 * 
 * GET    /api/registrations          - Get all registrations
 * GET    /api/registrations?id=X     - Get single registration
 * GET    /api/registrations?event=X  - Get registrations for specific event
 * POST   /api/registrations          - Create new registration
 * POST   /api/registrations?action=bulk-import - Import league drivers from standings
 * PUT    /api/registrations          - Update registration
 * DELETE /api/registrations          - Delete registration
 */

import { sql, query as dbQuery } from './db.js';

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
    await ensureRegistrationColumns();

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
      if (req.query.action === 'bulk-import') {
        return await handleBulkImport(req, res);
      }

      const {
        driver_tag,
        discord,
        car_class,
        event,
        league_id,
        car_number,
        penalty_points = 0
      } = req.body;

      // Validate required fields
      if (!driver_tag || !event) {
        return res.status(400).json({ 
          error: 'Driver tag and event are required' 
        });
      }

      // Check for duplicate registration
      const existing = car_number
        ? await sql`
            SELECT id FROM registrations 
            WHERE event = ${event}
              AND (driver_tag = ${driver_tag} OR car_number = ${car_number})
          `
        : await sql`
            SELECT id FROM registrations 
            WHERE event = ${event}
              AND driver_tag = ${driver_tag}
          `;

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Duplicate registration',
          message: `${driver_tag} is already registered for ${event}`
        });
      }

      const result = await sql`
        INSERT INTO registrations (
          timestamp, driver_tag, discord, car_class, event, league_id, car_number, penalty_points
        )
        VALUES (
          ${new Date().toISOString()}, ${driver_tag}, ${discord}, ${car_class}, ${event}, ${league_id || null}, ${car_number || null}, ${penalty_points}
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
      const allowedFields = new Set([
        'driver_tag',
        'discord',
        'car_class',
        'event',
        'league_id',
        'car_number',
        'penalty_points'
      ]);
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && allowedFields.has(key)) {
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

      const result = await dbQuery(query, values);

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

async function ensureRegistrationColumns() {
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS league_id INTEGER`;
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS car_number VARCHAR(50)`;
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS penalty_points INTEGER DEFAULT 0`;
}

async function handleBulkImport(req, res) {
  const { league_id, league_name, drivers } = req.body;

  if (!league_id || !league_name) {
    return res.status(400).json({
      error: 'League ID and league name are required'
    });
  }

  if (!drivers || !Array.isArray(drivers) || drivers.length === 0) {
    return res.status(400).json({
      error: 'Drivers array is required'
    });
  }

  const results = {
    imported: [],
    updated: [],
    skipped: []
  };

  for (const driver of drivers) {
    const driverTag = String(driver.driver_tag || driver.driverName || '').trim();
    const carNumber = driver.car_number !== undefined && driver.car_number !== null
      ? String(driver.car_number).trim()
      : '';
    const carClass = String(driver.car_class || driver.className || '').trim();
    const discord = String(driver.discord || '').trim();
    if (!driverTag) {
      results.skipped.push({
        driver: driver,
        reason: 'Missing driver name'
      });
      continue;
    }

    const existing = carNumber
      ? await sql`
          SELECT id FROM registrations
          WHERE event = ${league_name}
            AND (car_number = ${carNumber} OR driver_tag = ${driverTag})
          LIMIT 1
        `
      : await sql`
          SELECT id FROM registrations
          WHERE event = ${league_name}
            AND driver_tag = ${driverTag}
          LIMIT 1
        `;

    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      const updateResult = await sql`
        UPDATE registrations
        SET driver_tag = ${driverTag},
            discord = ${discord},
            car_class = ${carClass},
            league_id = ${league_id},
            car_number = ${carNumber || null}
        WHERE id = ${id}
        RETURNING *
      `;

      results.updated.push(updateResult.rows[0]);
      continue;
    }

    const insertResult = await sql`
      INSERT INTO registrations (
        timestamp, driver_tag, discord, car_class, event, league_id, car_number, penalty_points
      )
      VALUES (
        ${new Date().toISOString()}, ${driverTag}, ${discord}, ${carClass}, ${league_name}, ${league_id}, ${carNumber || null}, 0
      )
      RETURNING *
    `;

    results.imported.push(insertResult.rows[0]);
  }

  await sql`
    UPDATE leagues
    SET drivers = (
      SELECT COUNT(*) FROM registrations WHERE event = ${league_name}
    )
    WHERE id = ${league_id}
  `;

  return res.status(200).json({
    success: true,
    message: `Imported ${results.imported.length} new and updated ${results.updated.length} existing registrations`,
    results
  });
}

// Made with Bob
