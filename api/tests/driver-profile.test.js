import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signDriverValue } from '../discord-session.js';
import { createDriverProfileHandler } from '../driver-profile.js';

process.env.DRIVER_SESSION_SECRET = 'test-driver-session-secret-123456789';
function request(query = '') {
  const token = signDriverValue({ purpose: 'driver', profileId: 7, discordUserId: '9988', exp: Date.now() + 10000 });
  return new Request(`https://example.test/api/driver-profile${query}`, { headers: { cookie: `srt_driver_session=${token}` } });
}

test('driver profile consolidates mapped career statistics', async () => {
  const profile = { id: 7, display_name: 'Driver', discord_username: 'driver', discord_user_id: '9988', discord_avatar_hash: '' };
  const history = [{ position: 1, laps: 20 }, { position: 3, laps: 18 }, { position: 5, laps: 10 }];
  const db = async sql => ({ rows: sql.includes('FROM driver_profiles') ? [profile] : history });
  const response = await createDriverProfileHandler({ db })(request(), { error() {} });
  assert.equal(response.status, 200); assert.deepEqual(response.jsonBody.stats,
    { races: 3, wins: 1, podiums: 2, averageFinish: 3, completedLaps: 48 });
});

test('individual race access requires a mapping to the signed-in profile', async () => {
  const db = async sql => ({ rows: sql.includes('FROM driver_profiles') ? [{ id: 7, discord_user_id: '9988' }] : [] });
  const response = await createDriverProfileHandler({ db })(request('?raceResultId=99'), { error() {} });
  assert.equal(response.status, 404);
});
