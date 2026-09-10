/**
 * API: Registrations
 * Full CRUD for driver event/league registrations, with bulk import from standings.
 *
 * GET    /api/registrations                        — all registrations
 * GET    /api/registrations?id=X                   — single registration
 * GET    /api/registrations?event=X                — by event name
 * GET    /api/registrations?driver_tag=X           — by driver tag
 * POST   /api/registrations                        — create registration
 * POST   /api/registrations?action=bulk-import     — import drivers from standings
 * PUT    /api/registrations                        — update registration  { id, ...fields }
 * DELETE /api/registrations                        — delete registration  { id }
 */

import { app } from '@azure/functions';
import { sql, query as dbQuery } from './db.js';

app.http('registrations', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    try {
      await ensureRegistrationColumns();
      const params = new URL(request.url).searchParams;

      // ── GET ─────────────────────────────────────────────────────────────────
      if (request.method === 'GET') {
        const id = params.get('id');
        const event = params.get('event');
        const driver_tag = params.get('driver_tag');

        if (id) {
          const result = await sql`SELECT * FROM registrations WHERE id = ${id}`;
          if (result.rows.length === 0) {
            return { status: 404, jsonBody: { error: 'Registration not found' } };
          }
          return { status: 200, jsonBody: { registration: result.rows[0] } };
        }

        if (event) {
          const result = await sql`SELECT * FROM registrations WHERE event = ${event} ORDER BY timestamp DESC`;
          return { status: 200, jsonBody: { registrations: result.rows } };
        }

        if (driver_tag) {
          const result = await sql`SELECT * FROM registrations WHERE driver_tag = ${driver_tag} ORDER BY timestamp DESC`;
          return { status: 200, jsonBody: { registrations: result.rows } };
        }

        const result = await sql`SELECT * FROM registrations ORDER BY timestamp DESC`;
        return { status: 200, jsonBody: { registrations: result.rows } };
      }

      // ── POST ─────────────────────────────────────────────────────────────────
      if (request.method === 'POST') {
        if (params.get('action') === 'bulk-import') {
          return await handleBulkImport(request, context);
        }

        const body = await request.json();
        const { driver_tag, discord, car_class, event, league_id, car_number, penalty_points = 0 } = body;

        if (!driver_tag || !event) {
          return { status: 400, jsonBody: { error: 'driver_tag and event are required' } };
        }

        // Duplicate check
        const existing = car_number
          ? await sql`SELECT id FROM registrations WHERE event = ${event} AND (driver_tag = ${driver_tag} OR car_number = ${car_number})`
          : await sql`SELECT id FROM registrations WHERE event = ${event} AND driver_tag = ${driver_tag}`;

        if (existing.rows.length > 0) {
          return { status: 409, jsonBody: { error: 'Duplicate registration', message: `${driver_tag} is already registered for ${event}` } };
        }

        const result = await sql`
          INSERT INTO registrations (timestamp, driver_tag, discord, car_class, event, league_id, car_number, penalty_points)
          VALUES (${new Date().toISOString()}, ${driver_tag}, ${discord}, ${car_class}, ${event}, ${league_id || null}, ${car_number || null}, ${penalty_points})
          RETURNING *
        `;

        // Increment driver count
        await incrementDriverCount(event);

        return { status: 201, jsonBody: { success: true, message: 'Registration successful', registration: result.rows[0] } };
      }

      // ── PUT ──────────────────────────────────────────────────────────────────
      if (request.method === 'PUT') {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'Registration ID is required' } };
        }

        const allowed = new Set(['driver_tag', 'discord', 'car_class', 'event', 'league_id', 'car_number', 'penalty_points']);
        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        Object.entries(updates).forEach(([key, value]) => {
          if (value !== undefined && allowed.has(key)) {
            updateFields.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
          }
        });

        if (updateFields.length === 0) {
          return { status: 400, jsonBody: { error: 'No valid fields to update' } };
        }

        values.push(id);
        const queryText = `UPDATE registrations SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await dbQuery(queryText, values);

        if (result.rows.length === 0) {
          return { status: 404, jsonBody: { error: 'Registration not found' } };
        }
        return { status: 200, jsonBody: { success: true, message: 'Registration updated', registration: result.rows[0] } };
      }

      // ── DELETE ───────────────────────────────────────────────────────────────
      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id } = body;

        if (!id) {
          return { status: 400, jsonBody: { error: 'Registration ID is required' } };
        }

        const regResult = await sql`SELECT event FROM registrations WHERE id = ${id}`;
        if (regResult.rows.length === 0) {
          return { status: 404, jsonBody: { error: 'Registration not found' } };
        }

        const eventName = regResult.rows[0].event;
        await sql`DELETE FROM registrations WHERE id = ${id}`;
        await decrementDriverCount(eventName);

        return { status: 200, jsonBody: { success: true, message: 'Registration deleted' } };
      }

      return { status: 405, jsonBody: { error: 'Method not allowed' } };

    } catch (error) {
      context.error('Registrations API error:', error);
      return { status: 500, jsonBody: { error: 'Internal server error', message: error.message } };
    }
  }
});

async function ensureRegistrationColumns() {
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS league_id INTEGER`;
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS car_number VARCHAR(50)`;
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS penalty_points INTEGER DEFAULT 0`;
}

async function incrementDriverCount(eventName) {
  try {
    await sql`UPDATE events SET drivers = drivers + 1 WHERE name = ${eventName}`;
  } catch {
    try {
      await sql`UPDATE leagues SET drivers = drivers + 1 WHERE name = ${eventName}`;
    } catch (e) {
      // Non-critical — continue
    }
  }
}

async function decrementDriverCount(eventName) {
  try {
    await sql`UPDATE events SET drivers = GREATEST(0, drivers - 1) WHERE name = ${eventName}`;
  } catch {
    try {
      await sql`UPDATE leagues SET drivers = GREATEST(0, drivers - 1) WHERE name = ${eventName}`;
    } catch (e) {
      // Non-critical — continue
    }
  }
}

async function handleBulkImport(request, context) {
  const body = await request.json();
  const { league_id, league_name, drivers } = body;

  if (!league_id || !league_name) {
    return { status: 400, jsonBody: { error: 'league_id and league_name are required' } };
  }
  if (!Array.isArray(drivers) || drivers.length === 0) {
    return { status: 400, jsonBody: { error: 'drivers array is required' } };
  }

  const results = { imported: [], updated: [], skipped: [] };

  for (const driver of drivers) {
    const driverTag = String(driver.driver_tag || driver.driverName || '').trim();
    const carNumber = driver.car_number !== undefined && driver.car_number !== null
      ? String(driver.car_number).trim() : '';
    const carClass = String(driver.car_class || driver.className || '').trim();
    const discord = String(driver.discord || '').trim();

    if (!driverTag) {
      results.skipped.push({ driver, reason: 'Missing driver name' });
      continue;
    }

    const existing = carNumber
      ? await sql`SELECT id FROM registrations WHERE event = ${league_name} AND (car_number = ${carNumber} OR driver_tag = ${driverTag}) LIMIT 1`
      : await sql`SELECT id FROM registrations WHERE event = ${league_name} AND driver_tag = ${driverTag} LIMIT 1`;

    if (existing.rows.length > 0) {
      const updated = await sql`
        UPDATE registrations
        SET driver_tag = ${driverTag}, discord = ${discord}, car_class = ${carClass},
            league_id = ${league_id}, car_number = ${carNumber || null}
        WHERE id = ${existing.rows[0].id} RETURNING *
      `;
      results.updated.push(updated.rows[0]);
    } else {
      const inserted = await sql`
        INSERT INTO registrations (timestamp, driver_tag, discord, car_class, event, league_id, car_number, penalty_points)
        VALUES (${new Date().toISOString()}, ${driverTag}, ${discord}, ${carClass}, ${league_name}, ${league_id}, ${carNumber || null}, 0)
        RETURNING *
      `;
      results.imported.push(inserted.rows[0]);
    }
  }

  // Sync driver count from actual registration count
  await sql`UPDATE leagues SET drivers = (SELECT COUNT(*) FROM registrations WHERE event = ${league_name}) WHERE id = ${league_id}`;

  return {
    status: 200,
    jsonBody: {
      success: true,
      message: `Imported ${results.imported.length} new and updated ${results.updated.length} existing registrations`,
      results
    }
  };
}
