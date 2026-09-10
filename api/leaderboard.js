/**
 * API: Leaderboard
 * Full CRUD for leaderboard entries (per event + race).
 *
 * GET    /api/leaderboard                          — all entries
 * GET    /api/leaderboard?id=X                     — single entry
 * GET    /api/leaderboard?event_id=X               — all races for event
 * GET    /api/leaderboard?event_id=X&race=Y        — single race for event
 * POST   /api/leaderboard                          — create entry
 * PUT    /api/leaderboard                          — update entry  { id, ...fields }
 * DELETE /api/leaderboard                          — delete by id OR by event_id+race (bulk)
 */

import { app } from '@azure/functions';
import { sql, query as dbQuery } from './db.js';

app.http('leaderboard', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 200, body: '' };
    }

    try {
      const params = new URL(request.url).searchParams;
      const id = params.get('id');
      const event_id = params.get('event_id');
      const race = params.get('race');

      // ── GET ────────────────────────────────────────────────────────────────
      if (request.method === 'GET') {
        if (id) {
          const result = await sql`SELECT * FROM leaderboard WHERE id = ${id}`;
          if (result.rows.length === 0) {
            return { status: 404, jsonBody: { error: 'Leaderboard entry not found' } };
          }
          return { status: 200, jsonBody: { entry: result.rows[0] } };
        }

        if (event_id && race) {
          const result = await sql`
            SELECT * FROM leaderboard
            WHERE event_id = ${event_id} AND race = ${race}
            ORDER BY position ASC
          `;
          return { status: 200, jsonBody: { leaderboard: result.rows } };
        }

        if (event_id) {
          const result = await sql`
            SELECT * FROM leaderboard WHERE event_id = ${event_id} ORDER BY race, position ASC
          `;
          return { status: 200, jsonBody: { leaderboard: result.rows } };
        }

        const result = await sql`
          SELECT * FROM leaderboard ORDER BY event_id, race, position ASC
        `;
        return { status: 200, jsonBody: { leaderboard: result.rows } };
      }

      // ── POST ───────────────────────────────────────────────────────────────
      if (request.method === 'POST') {
        const body = await request.json();
        const {
          event_id: eid, race = 'Race 1',
          position, driver, tag, team, points, time, gap
        } = body;

        if (!eid || !driver || position === undefined) {
          return { status: 400, jsonBody: { error: 'event_id, driver, and position are required' } };
        }

        const result = await sql`
          INSERT INTO leaderboard (event_id, race, position, driver, tag, team, points, time, gap)
          VALUES (${eid}, ${race}, ${position}, ${driver}, ${tag}, ${team}, ${points}, ${time}, ${gap})
          RETURNING *
        `;
        return { status: 201, jsonBody: { success: true, message: 'Leaderboard entry created', entry: result.rows[0] } };
      }

      // ── PUT ────────────────────────────────────────────────────────────────
      if (request.method === 'PUT') {
        const body = await request.json();
        const { id: bodyId, ...updates } = body;

        if (!bodyId) {
          return { status: 400, jsonBody: { error: 'Entry ID is required' } };
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

        values.push(bodyId);
        const queryText = `UPDATE leaderboard SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await dbQuery(queryText, values);

        if (result.rows.length === 0) {
          return { status: 404, jsonBody: { error: 'Leaderboard entry not found' } };
        }
        return { status: 200, jsonBody: { success: true, message: 'Entry updated', entry: result.rows[0] } };
      }

      // ── DELETE ─────────────────────────────────────────────────────────────
      if (request.method === 'DELETE') {
        const body = await request.json();
        const { id: delId, event_id: delEventId, race: delRace } = body;

        if (delId) {
          const result = await sql`DELETE FROM leaderboard WHERE id = ${delId} RETURNING id`;
          if (result.rows.length === 0) {
            return { status: 404, jsonBody: { error: 'Entry not found' } };
          }
          return { status: 200, jsonBody: { success: true, message: 'Entry deleted' } };
        }

        if (delEventId && delRace) {
          const result = await sql`
            DELETE FROM leaderboard WHERE event_id = ${delEventId} AND race = ${delRace} RETURNING id
          `;
          return { status: 200, jsonBody: { success: true, message: `Deleted ${result.rows.length} entries` } };
        }

        return { status: 400, jsonBody: { error: 'Provide id or event_id+race for deletion' } };
      }

      return { status: 405, jsonBody: { error: 'Method not allowed' } };

    } catch (error) {
      context.error('Leaderboard API error:', error);
      return { status: 500, jsonBody: { error: 'Internal server error', message: error.message } };
    }
  }
});
