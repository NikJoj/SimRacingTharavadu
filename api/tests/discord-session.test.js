import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDiscordUsername, signDriverValue, verifyDriverValue, cookieValue } from '../discord-session.js';

const key = 'test-driver-session-secret-123456789';

test('normalizes admin-entered Discord usernames', () => {
  assert.equal(normalizeDiscordUsername('@ShadyPC'), 'shadypc');
  assert.equal(normalizeDiscordUsername('  shadypc  '), 'shadypc');
});

test('driver session signatures enforce purpose, integrity, and expiry', () => {
  const value = signDriverValue({ purpose: 'driver', profileId: 4, exp: Date.now() + 10000 }, key);
  assert.equal(verifyDriverValue(value, 'driver', key).profileId, 4);
  assert.throws(() => verifyDriverValue(`${value}x`, 'driver', key), /invalid/);
  assert.throws(() => verifyDriverValue(value, 'discord_state', key), /expired/);
  const expired = signDriverValue({ purpose: 'driver', exp: 1 }, key);
  assert.throws(() => verifyDriverValue(expired, 'driver', key), /expired/);
});

test('reads only the requested cookie', () => {
  const request = { headers: new Headers({ cookie: 'other=1; srt_driver_session=abc.def; theme=dark' }) };
  assert.equal(cookieValue(request, 'srt_driver_session'), 'abc.def');
});
