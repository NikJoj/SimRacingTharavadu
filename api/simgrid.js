import { app } from '@azure/functions';
import { query } from './db.js';
import { championshipId, requireAdmin, fetchSnapshot, snapshotHash, changes, SyncError } from './simgrid-client.js';
import { ensureIdentitySchema, rebuildCandidates } from './driver-identity.js';

async function savedSnapshot(leagueId, query) {
  // Reads never run migrations or contact SimGrid.
  const exists = await query("SELECT to_regclass('public.simgrid_snapshots') AS table_name");
  if (!exists.rows[0].table_name) return null;
  return (await query('SELECT * FROM simgrid_snapshots WHERE league_id = $1', [leagueId])).rows[0] || null;
}

async function ensureSchema(query) {
  await query(`CREATE TABLE IF NOT EXISTS simgrid_snapshots (
    league_id INTEGER PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL, snapshot JSONB NOT NULL, synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_by TEXT NOT NULL
  )`);
  await query('ALTER TABLE registrations ADD COLUMN IF NOT EXISTS simgrid_registration_id TEXT');
  await query('ALTER TABLE registrations ADD COLUMN IF NOT EXISTS simgrid_active BOOLEAN NOT NULL DEFAULT TRUE');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_simgrid ON registrations (league_id, simgrid_registration_id)');
}

export function createHandler({ db = query, fetchData = fetchSnapshot } = {}) {
return async function handler(request, context) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return { status: 204, headers };
  try {
    const username = request.method === 'POST' ? requireAdmin(request) : null;
    let body = {};
    if (request.method === 'POST') {
      try { body = await request.json(); } catch { throw new SyncError('Invalid JSON request.', 400); }
      if (!body || !['preview', 'sync'].includes(body.action)) throw new SyncError('action must be preview or sync.', 400);
    }
    const leagueId = Number(request.method === 'GET' ? new URL(request.url).searchParams.get('leagueId') : body.leagueId);
    if (!Number.isSafeInteger(leagueId) || leagueId <= 0) throw new SyncError('A valid leagueId is required.', 400);
    const league = (await db('SELECT id, name, simgrid_url FROM leagues WHERE id = $1', [leagueId])).rows[0];
    if (!league) throw new SyncError('League not found.', 404);
    const champId = championshipId(league.simgrid_url);
    const saved = await savedSnapshot(leagueId, db);
    if (request.method === 'GET') {
      const current = saved?.snapshot?.championshipId === champId ? saved : null;
      return { status: 200, headers, jsonBody: { snapshot: current?.snapshot || null, syncedAt: current?.synced_at || null, revision: current?.revision || 0 } };
    }
    if (request.method !== 'POST') throw new SyncError('Method not allowed.', 405);
    const snapshot = await fetchData(champId);
    const hash = snapshotHash(snapshot);
    const revision = saved?.revision || 0;
    const summary = changes(saved?.snapshot, snapshot);
    if (body.action === 'preview') {
      return { status: 200, headers, jsonBody: { snapshot, hash, revision, changes: summary, syncedAt: saved?.synced_at || null } };
    }
    if (body.hash !== hash || body.revision !== revision) throw new SyncError('Data changed since preview. Preview again before syncing.', 409);
    await ensureSchema(db);
    await ensureIdentitySchema(db);
    // One SQL statement atomically publishes the snapshot and updates only
    // provider-owned registrations. Compare-and-swap rejects concurrent syncs.
    const result = await db(`WITH saved AS (
      INSERT INTO simgrid_snapshots (league_id, revision, snapshot, synced_by)
      SELECT id, $2::integer + 1, $3::jsonb, $4 FROM leagues
      WHERE id = $1 AND simgrid_url = $5
      ON CONFLICT (league_id) DO UPDATE SET revision = EXCLUDED.revision,
        snapshot = EXCLUDED.snapshot, synced_by = EXCLUDED.synced_by, synced_at = NOW()
      WHERE simgrid_snapshots.revision = $2
      RETURNING league_id, revision, synced_at
    ), incoming AS (
      SELECT d.* FROM saved, jsonb_to_recordset($3::jsonb -> 'drivers')
        AS d(id TEXT, name TEXT, "carNumber" TEXT, "className" TEXT)
    ), imported AS (
      INSERT INTO registrations (timestamp, driver_tag, event, league_id, car_number, car_class, penalty_points, simgrid_registration_id, simgrid_active)
      SELECT NOW()::text, name, $6, $1, "carNumber", "className", 0, id, TRUE FROM incoming
      ON CONFLICT (league_id, simgrid_registration_id) DO UPDATE SET
        driver_tag = EXCLUDED.driver_tag, event = EXCLUDED.event, car_number = EXCLUDED.car_number,
        car_class = EXCLUDED.car_class, simgrid_active = TRUE
      RETURNING id
    ), withdrawn AS (
      UPDATE registrations SET simgrid_active = FALSE
      WHERE league_id = $1 AND simgrid_registration_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM saved)
        AND simgrid_registration_id NOT IN (SELECT id FROM incoming)
      RETURNING id
    ), counts AS (
      UPDATE leagues SET drivers = (SELECT COUNT(*) FROM incoming), sim = 'Le Mans Ultimate', updated_at = NOW()
      WHERE id = $1 AND EXISTS (SELECT 1 FROM saved) RETURNING id
    ) SELECT revision, synced_at FROM saved`, [leagueId, revision, JSON.stringify(snapshot), username, league.simgrid_url, league.name]);
    if (!result.rows.length) throw new SyncError('Another sync or league edit occurred. Preview again.', 409);
    await rebuildCandidates(db);
    return { status: 200, headers, jsonBody: { success: true, changes: summary, revision: result.rows[0].revision, syncedAt: result.rows[0].synced_at } };
  } catch (error) {
    if (!(error instanceof SyncError)) context.error('SimGrid sync failed; no snapshot published.');
    return { status: error.status || 500, headers, jsonBody: { error: error instanceof SyncError ? error.message : 'Sync failed. The previous snapshot was retained.' } };
  }
};
}

export const handler = createHandler();

app.http('simgrid', { methods: ['GET', 'POST', 'OPTIONS'], authLevel: 'anonymous', handler });
