/**
 * API: Leagues
 * Full CRUD for racing leagues.
 *
 * GET    /api/leagues           — list all leagues (ordered by start_date DESC)
 * GET    /api/leagues?id=X      — get single league
 * POST   /api/leagues           — create league
 * PUT    /api/leagues           — update league  { id, ...fields }
 * DELETE /api/leagues           — delete league  { id }
 */

import { app } from '@azure/functions';
import { sql, query as dbQuery } from './db.js';

app.http('leagues', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    try {
      const params = new URL(request.url).searchParams;
      const id = params.get('id');

      // ── GET ────────────────────────────────────────────────────────────────
      if (request.method === 'GET') {
        if (id) {
          const result = await sql`SELECT * FROM leagues WHERE id = ${id}`;
          if (result.rows.length === 0) {
            return { status: 404, jsonBody: { error: 'League not found' } };
          }
          return { status: 200, jsonBody: { league: result.rows[0] } };
        }
        const result = await sql`SELECT * FROM leagues ORDER BY start_date DESC`;
        return { status: 200, jsonBody: { leagues: result.rows } };
      }

      // ── POST ───────────────────────────────────────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json();
        const {
          name, sim, status = 'upcoming',
          start_date, end_date, format, season,
          championship_id, simgrid_url, blob_store,
          drivers = 0, max_drivers = 36, rounds = 8,
          track, description, car_options
        } = body;

        if (!name) {
          return { status: 400, jsonBody: { error: 'League name is required' } };
        }

        const result = await sql`
          INSERT INTO leagues (
            name, sim, status, start_date, end_date, format, season,
            championship_id, simgrid_url, blob_store,
            drivers, max_drivers, rounds, track, description, car_options
          ) VALUES (
            ${name}, ${sim}, ${status}, ${start_date}, ${end_date}, ${format}, ${season},
            ${championship_id}, ${simgrid_url}, ${blob_store},
            ${drivers}, ${max_drivers}, ${rounds}, ${track}, ${description}, ${car_options}
          ) RETURNING *
        `;
        return { status: 201, jsonBody: { success: true, message: 'League created successfully', league: result.rows[0] } };
      }

      // ── PUT ────────────────────────────────────────────────────────────────
      if (request.method === 'PUT') {
        const body = await request.json();
        const { id: bodyId, ...updates } = body;

        if (!bodyId) {
          return { status: 400, jsonBody: { error: 'League ID is required' } };
        }

        // Allowed fields including simgrid_url
        const allowed = new Set([
          'name', 'sim', 'status', 'start_date', 'end_date', 'format', 'season',
          'championship_id', 'simgrid_url', 'blob_store',
          'drivers', 'max_drivers', 'rounds', 'track', 'description', 'car_options'
        ]);

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
          return { status: 400, jsonBody: { error: 'No fields to update' } };
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(bodyId);

        const queryText = `UPDATE leagues SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await dbQuery(queryText, values);

        if (result.rows.length === 0) {
          return { status: 404, jsonBody: { error: 'League not found' } };
        }
        return { status: 200, jsonBody: { success: true, message: 'League updated successfully', league: result.rows[0] } };
      }

      // ── DELETE ─────────────────────────────────────────────────────────────
      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id: delId } = body;

        if (!delId) {
          return { status: 400, jsonBody: { error: 'League ID is required' } };
        }

        const result = await sql`DELETE FROM leagues WHERE id = ${delId} RETURNING id`;
        if (result.rows.length === 0) {
          return { status: 404, jsonBody: { error: 'League not found' } };
        }
        return { status: 200, jsonBody: { success: true, message: 'League deleted successfully' } };
      }

      return { status: 405, jsonBody: { error: 'Method not allowed' } };

    } catch (error) {
      context.error('Leagues API error:', error);
      return { status: 500, jsonBody: { error: 'Internal server error', message: error.message } };
    }
  }
});
