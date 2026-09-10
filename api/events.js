/**
 * API: Events
 * Full CRUD for racing events.
 *
 * GET    /api/events           — list all events (ordered by start_date DESC)
 * GET    /api/events?id=X      — get single event
 * POST   /api/events           — create event
 * PUT    /api/events           — update event  { id, ...fields }
 * DELETE /api/events           — delete event  { id }
 */

import { app } from '@azure/functions';
import { sql, query as dbQuery } from './db.js';

app.http('events', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    // OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    try {
      const params = new URL(request.url).searchParams;
      const id = params.get('id');

      // ── GET ────────────────────────────────────────────────────────────────
      if (request.method === 'GET') {
        if (id) {
          const result = await sql`SELECT * FROM events WHERE id = ${id}`;
          if (result.rows.length === 0) {
            return { status: 404, jsonBody: { error: 'Event not found' } };
          }
          return { status: 200, jsonBody: { event: result.rows[0] } };
        }
        const result = await sql`SELECT * FROM events ORDER BY start_date DESC`;
        return { status: 200, jsonBody: { events: result.rows } };
      }

      // ── POST ───────────────────────────────────────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json();
        const {
          name, sim, status = 'upcoming', track,
          start_date, end_date, format,
          drivers = 0, max_drivers = 30, rounds = 1,
          season, description, track_mod, car_mod,
          practice_server, car_options
        } = body;

        if (!name) {
          return { status: 400, jsonBody: { error: 'Event name is required' } };
        }

        const result = await sql`
          INSERT INTO events (
            name, sim, status, track, start_date, end_date, format,
            drivers, max_drivers, rounds, season, description,
            track_mod, car_mod, practice_server, car_options
          ) VALUES (
            ${name}, ${sim}, ${status}, ${track}, ${start_date}, ${end_date}, ${format},
            ${drivers}, ${max_drivers}, ${rounds}, ${season}, ${description},
            ${track_mod}, ${car_mod}, ${practice_server}, ${car_options}
          ) RETURNING *
        `;
        return { status: 201, jsonBody: { success: true, message: 'Event created successfully', event: result.rows[0] } };
      }

      // ── PUT ────────────────────────────────────────────────────────────────
      if (request.method === 'PUT') {
        const body = await request.json();
        const { id: bodyId, ...updates } = body;

        if (!bodyId) {
          return { status: 400, jsonBody: { error: 'Event ID is required' } };
        }

        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        Object.entries(updates).forEach(([key, value]) => {
          if (value !== undefined && key !== 'created_at') {
            updateFields.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
          }
        });

        if (updateFields.length === 0) {
          return { status: 400, jsonBody: { error: 'No fields to update' } };
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(bodyId);

        const queryText = `UPDATE events SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await dbQuery(queryText, values);

        if (result.rows.length === 0) {
          return { status: 404, jsonBody: { error: 'Event not found' } };
        }
        return { status: 200, jsonBody: { success: true, message: 'Event updated successfully', event: result.rows[0] } };
      }

      // ── DELETE ─────────────────────────────────────────────────────────────
      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id: delId } = body;

        if (!delId) {
          return { status: 400, jsonBody: { error: 'Event ID is required' } };
        }

        const result = await sql`DELETE FROM events WHERE id = ${delId} RETURNING id`;
        if (result.rows.length === 0) {
          return { status: 404, jsonBody: { error: 'Event not found' } };
        }
        return { status: 200, jsonBody: { success: true, message: 'Event deleted successfully' } };
      }

      return { status: 405, jsonBody: { error: 'Method not allowed' } };

    } catch (error) {
      context.error('Events API error:', error);
      return { status: 500, jsonBody: { error: 'Internal server error', message: error.message } };
    }
  }
});
