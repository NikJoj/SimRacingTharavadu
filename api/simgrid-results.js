import { app } from '@azure/functions';
import { query, initializeTables } from './db.js';
import { requireAdmin, championshipId, SyncError } from './simgrid-client.js';
import { parseLmuResult, validateRaceMatch, resultHash } from './lmu-result-parser.js';
import { ensureIdentitySchema, indexRaceResult, previewRaceMappings, rebuildCandidates } from './driver-identity.js';

async function readUpload(request) {
  let form;
  try { form = await request.formData(); } catch { throw new SyncError('Upload must be multipart form data.', 400); }
  const file = form.get('file');
  if (!file || typeof file.text !== 'function') throw new SyncError('Choose an LMU XML result file.', 400);
  return { action: String(form.get('action') || ''), leagueId: Number(form.get('leagueId')),
    raceId: String(form.get('raceId') || ''), hash: String(form.get('hash') || ''),
    fileName: file.name || '', xml: await file.text() };
}

export function createResultHandler({ db = query, init = initializeTables } = {}) {
  return async function handler(request, context) {
    const headers = { 'Cache-Control': 'no-store' };
    if (request.method === 'OPTIONS') return { status: 204, headers };
    try {
      if (request.method !== 'POST') throw new SyncError('Method not allowed.', 405);
      const username = requireAdmin(request);
      const upload = await readUpload(request);
      if (!['preview', 'sync'].includes(upload.action) || !Number.isSafeInteger(upload.leagueId) || upload.leagueId <= 0 || !/^\d+$/.test(upload.raceId)) {
        throw new SyncError('Select a league and race, then choose Preview.', 400);
      }
      const league = (await db('SELECT id, name, simgrid_url FROM leagues WHERE id = $1', [upload.leagueId])).rows[0];
      if (!league) throw new SyncError('League not found.', 404);
      championshipId(league.simgrid_url);
      const snapshotTable = (await db("SELECT to_regclass('public.simgrid_snapshots') AS table_name")).rows[0]?.table_name;
      if (!snapshotTable) throw new SyncError('Sync the SimGrid championship first, then upload a race result.', 409);
      const snapshotRow = (await db("SELECT snapshot FROM simgrid_snapshots WHERE league_id = $1", [upload.leagueId])).rows[0];
      const race = snapshotRow?.snapshot?.races?.find(item => String(item.id) === upload.raceId);
      if (!race) throw new SyncError('Sync the SimGrid championship first, then select one of its races.', 409);
      const result = parseLmuResult(upload.xml, upload.fileName);
      const validation = validateRaceMatch(result, race);
      const mapping = await previewRaceMappings(db, result);
      const preview = { leagueId: upload.leagueId, leagueName: league.name, race, result, validation, mapping };
      const hash = resultHash(preview);
      if (upload.action === 'preview') return { status: 200, headers, jsonBody: { preview, hash } };
      if (!validation.valid) throw new SyncError('The XML date or track does not match the selected race. Choose the correct file.', 422);
      if (upload.hash !== hash) throw new SyncError('The file or selection changed since preview. Preview again.', 409);
      const initialized = await init();
      if (!initialized.success) throw new SyncError('Race archive schema initialization failed.', 500);
      await ensureIdentitySchema(db);
      const timestamp = Date.parse(race.startsAt);
      const pageUrl = `${league.simgrid_url.replace(/[?#].*$/, '')}/results?race_id=${encodeURIComponent(race.id)}`;
      const saved = await db(`INSERT INTO race_results
        (league, league_id, track, session_date, result_data, race_timestamp, results_json_url, results_page_url, session_type)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, NULL, $7, 'RACE')
        ON CONFLICT (league, race_timestamp) DO UPDATE SET league_id = EXCLUDED.league_id,
          track = EXCLUDED.track, session_date = EXCLUDED.session_date, result_data = EXCLUDED.result_data,
          results_json_url = NULL, results_page_url = EXCLUDED.results_page_url,
          session_type = EXCLUDED.session_type, stored_at = NOW()
        RETURNING id, stored_at`, [String(league.id), league.id, race.track, race.startsAt,
        JSON.stringify(result), timestamp, pageUrl]);
      await indexRaceResult(db, saved.rows[0].id);
      await rebuildCandidates(db);
      return { status: 200, headers, jsonBody: { success: true, raceId: race.id,
        drivers: result.Result.length, storedAt: saved.rows[0].stored_at, syncedBy: username } };
    } catch (error) {
      if (!(error instanceof SyncError)) context.error('LMU result sync failed; existing race retained.');
      return { status: error.status || 500, headers, jsonBody: { error: error instanceof SyncError ? error.message : 'Result sync failed. Existing data was retained.' } };
    }
  };
}

export const handler = createResultHandler();
app.http('simgridResults', { route: 'simgrid-results', methods: ['POST', 'OPTIONS'], authLevel: 'anonymous', handler });
