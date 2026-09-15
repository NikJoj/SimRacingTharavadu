import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createDriverMappingsHandler } from '../driver-mappings.js';

process.env.JWT_SECRET = 'driver-mapping-test-secret';
process.env.ADMIN_USERNAME = 'admin';

function request(body) {
  const payload = Buffer.from(JSON.stringify({ username: 'admin', exp: Date.now() + 60000 })).toString('base64');
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('base64');
  return new Request('https://example.test/api/driver-mappings', { method: 'POST',
    headers: { 'X-SRT-Admin-Token': `${payload}|${signature}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('linking a Discord member to a discovered name creates a verified profile and backfills history', async () => {
  const statements = [];
  const db = async (sql, params = []) => {
    statements.push({ sql, params });
    if (sql.includes('SELECT * FROM driver_name_candidates WHERE id=$1')) return { rows: [{ id: 8, sample_name: 'Race Driver', normalized_name: 'race driver', status: 'unmatched', driver_profile_id: null }] };
    if (sql.includes('INSERT INTO driver_profiles')) return { rows: [{ id: 22 }] };
    return { rows: [] };
  };
  const discordMembers = async () => [{ id: '998877', username: 'race.driver', globalName: 'Race Driver', avatarHash: 'avatar' }];
  const response = await createDriverMappingsHandler({ db, discordMembers })(request({ action: 'confirm-discord-members',
    links: [{ memberId: '998877', candidateId: 8 }] }), { error() {} });
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.linked, 1);
  assert.ok(statements.some(call => call.sql.includes('INSERT INTO driver_profiles') && call.params.includes('998877')));
  assert.ok(statements.some(call => call.sql.includes('UPDATE race_entries') && call.params.includes('race driver')));
  assert.ok(statements.some(call => call.sql.includes("status='approved'") && call.params.includes(8)));
});
