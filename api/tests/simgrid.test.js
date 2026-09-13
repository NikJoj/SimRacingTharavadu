import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { championshipId, requireAdmin, fetchSnapshot, snapshotHash, changes, gridGet } from '../simgrid-client.js';
import { createHandler } from '../simgrid.js';

process.env.JWT_SECRET = 'test-secret-not-a-real-credential';
process.env.ADMIN_USERNAME = 'admin';
process.env.SIMGRID_API_TOKEN = 'test-only';
function auth(exp = Date.now() + 60000, username = 'admin') {
  const body = Buffer.from(JSON.stringify({ username, exp })).toString('base64');
  return `Bearer ${body}|${crypto.createHmac('sha256', process.env.JWT_SECRET).update(body).digest('base64')}`;
}
function fixture() {
  const row = { id: 10, user_id: 20, championship_id: 26866, display_name: 'Driver <one>', car_number: 7,
    car: 'LMGT3', class: 'LMGT3', position_cache: 1, championship_points: 60, championship_score: 65,
    championship_penalties: 2, points_adjustment: 7, adjustment_reason: 'Correction' };
  const champ = { id: 26866, game_name: 'Le Mans Ultimate', name: 'Preseason', teams_enabled: false, spots_taken: 1, capacity: 30,
    races: [{ id: 30, race_name: 'Race', track: { name: 'Track' }, starts_at: '2026-09-09T16:00:00Z', results_available: true }] };
  const get = async path => path.startsWith('registrations?') ? [{ id: 10, user_id: 20, championship_id: 26866 }] :
    path.includes('/standings?') ? [[row], [], null, { pagination: { page: 1, per_page: 40, total: 1 } }] : champ;
  return { row, champ, get };
}

test('validates a fixed SimGrid host and numeric championship ID', () => {
  assert.equal(championshipId('https://www.thesimgrid.com/championships/26866?s=invite'), '26866');
  for (const url of ['https://evil.test/championships/26866', 'http://www.thesimgrid.com/championships/26866', 'https://www.thesimgrid.com/api/v1/users', '']) {
    assert.throws(() => championshipId(url));
  }
});
test('admin authentication checks signature, identity and expiry', () => {
  const request = value => ({ headers: new Headers({ authorization: value }) });
  assert.equal(requireAdmin(request(auth())), 'admin');
  assert.throws(() => requireAdmin(request(auth(1))), /sign in/);
  assert.throws(() => requireAdmin(request(auth(Date.now() + 10000, 'other'))), /sign in/);
  assert.throws(() => requireAdmin(request(auth() + 'x')), /sign in/);
  assert.throws(() => requireAdmin(request('')), /sign in/);
});
test('keeps official adjusted score without recalculating or double-deducting penalties', async () => {
  const f = fixture();
  const s = await fetchSnapshot('26866', f.get);
  assert.equal(s.standings[0].score, 65);
  assert.equal(s.standings[0].penalties, 2);
  assert.equal(s.drivers[0].id, '10');
  assert.equal(s.races[0].track, 'Track');
  assert.equal(s.resultsDetailAvailable, false);
  assert.equal(snapshotHash(s), snapshotHash(await fetchSnapshot('26866', f.get)));
});
test('zero scores and negative adjustments survive normalization', async () => {
  const f = fixture(); f.row.championship_score = 0; f.row.points_adjustment = -60;
  const s = await fetchSnapshot('26866', f.get);
  assert.equal(s.standings[0].score, 0); assert.equal(s.standings[0].adjustment, -60);
});
test('rejects incomplete registrations, changed schema, and unsupported teams', async () => {
  const f = fixture(); f.champ.spots_taken = 2;
  await assert.rejects(fetchSnapshot('26866', f.get), /count/);
  f.champ.spots_taken = 1; f.row.championship_score = null;
  await assert.rejects(fetchSnapshot('26866', f.get), /adjusted score/);
  f.champ.teams_enabled = true;
  await assert.rejects(fetchSnapshot('26866', f.get), /solo/);
});
test('fetches every standings page and rejects duplicated pages', async () => {
  const f = fixture(); f.champ.spots_taken = 2;
  const get = async path => {
    if (path.startsWith('registrations?')) return [{ id: 10, user_id: 20, championship_id: 26866 }, { id: 11, user_id: 21, championship_id: 26866 }];
    if (path.includes('/standings?')) {
      const page = Number(path.split('page=')[1]);
      return [[{ ...f.row, id: 9 + page, user_id: 19 + page }], [], null, { pagination: { page, per_page: 1, total: 2 } }];
    }
    return f.champ;
  };
  assert.equal((await fetchSnapshot('26866', get)).standings.length, 2);
  await assert.rejects(fetchSnapshot('26866', async path => {
    const data = await get(path);
    if (path.endsWith('page=2')) data[0][0].id = 10;
    return data;
  }), /Duplicate/);
});
test('upstream failures do not expose token or response body', async () => {
  await assert.rejects(gridGet('championships/26866', async () => ({ ok: false, status: 401 })), /HTTP 401/);
  await assert.rejects(gridGet('championships/26866', async () => ({ ok: false, status: 429 })), /rate limit/);
  await assert.rejects(gridGet('championships/26866', async () => { throw new Error('secret'); }), /could not be reached/);
});
test('change summary detects corrections and withdrawals by stable ID', async () => {
  const a = await fetchSnapshot('26866', fixture().get), b = structuredClone(a);
  b.standings[0].score = 0; b.drivers = [];
  assert.equal(changes(a, b).standings.updated, 1);
  assert.equal(changes(a, b).drivers.removed, 1);
});

async function apiFixture() {
  const snapshot = await fetchSnapshot('26866', fixture().get);
  const writes = [];
  let conflict = false;
  const db = async (sql, params) => {
    if (sql.startsWith('SELECT id, name')) return { rows: [{ id: 3, name: 'Preseason', simgrid_url: 'https://www.thesimgrid.com/championships/26866' }] };
    if (sql.includes('to_regclass')) return { rows: [{ table_name: null }] };
    writes.push({ sql, params });
    return { rows: sql.startsWith('WITH saved') && !conflict ? [{ revision: 1, synced_at: '2026-09-13T00:00:00Z' }] : [] };
  };
  const handler = createHandler({ db, fetchData: async () => snapshot });
  const call = (body, token = auth()) => handler(new Request('http://localhost/api/simgrid', { method: 'POST', headers: { authorization: token }, body: JSON.stringify(body) }), { error() {} });
  return { call, handler, snapshot, writes, setConflict: () => { conflict = true; } };
}
test('unauthorized requests and preview perform no writes', async () => {
  const f = await apiFixture();
  assert.equal((await f.call({ action: 'preview', leagueId: 3 }, '')).status, 401);
  const response = await f.call({ action: 'preview', leagueId: 3 });
  assert.equal(response.status, 200); assert.equal(response.jsonBody.revision, 0); assert.equal(f.writes.length, 0);
});
test('confirmation rejects stale hashes and accepts the exact preview', async () => {
  const f = await apiFixture();
  assert.equal((await f.call({ action: 'sync', leagueId: 3, hash: 'stale', revision: 0 })).status, 409);
  assert.equal(f.writes.length, 0);
  const result = await f.call({ action: 'sync', leagueId: 3, hash: snapshotHash(f.snapshot), revision: 0 });
  assert.equal(result.status, 200);
  assert.equal(f.writes.filter(w => w.sql.startsWith('WITH saved')).length, 1);
});
test('concurrent sync returns conflict rather than reporting success', async () => {
  const f = await apiFixture(); f.setConflict();
  assert.equal((await f.call({ action: 'sync', leagueId: 3, hash: snapshotHash(f.snapshot), revision: 0 })).status, 409);
});
test('public reads do not contact SimGrid or create tables', async () => {
  const f = await apiFixture();
  const result = await f.handler(new Request('http://localhost/api/simgrid?leagueId=3'), { error() {} });
  assert.equal(result.status, 200); assert.equal(result.jsonBody.snapshot, null); assert.equal(f.writes.length, 0);
});
