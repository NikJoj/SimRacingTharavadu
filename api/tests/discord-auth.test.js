import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordAuthHandler } from '../discord-auth.js';

process.env.DISCORD_CLIENT_ID = '123456';
process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
process.env.DISCORD_REDIRECT_URI = 'https://example.test/api/discord-auth?action=callback';
process.env.DRIVER_SESSION_SECRET = 'test-driver-session-secret-123456789';

test('Discord OAuth requests only identify and signs in an already verified immutable ID', async () => {
  const writes = [];
  const db = async (sql, params) => {
    if (sql.includes('WHERE discord_user_id=$1')) return { rows: [{ id: 7, discord_user_id: '9988776655' }] };
    if (sql.startsWith('UPDATE driver_profiles SET')) writes.push(params);
    return { rows: [] };
  };
  const fetcher = async url => String(url).endsWith('/oauth2/token')
    ? { ok: true, json: async () => ({ access_token: 'private-token', token_type: 'Bearer' }) }
    : { ok: true, json: async () => ({ id: '9988776655', username: 'ShadyPC', global_name: 'Shady', avatar: 'hash' }) };
  const handler = createDiscordAuthHandler({ db, fetcher });
  const login = await handler(new Request('https://example.test/api/discord-auth?action=login'), { error() {} });
  assert.equal(login.status, 302);
  const authorize = new URL(login.headers.Location);
  assert.equal(authorize.origin, 'https://discord.com');
  assert.equal(authorize.searchParams.get('scope'), 'identify');
  const state = authorize.searchParams.get('state');
  const callback = await handler(new Request(`https://example.test/api/discord-auth?action=callback&code=one-time&state=${encodeURIComponent(state)}`,
    { headers: { cookie: `srt_discord_state=${encodeURIComponent(state)}` } }), { error() {} });
  assert.equal(callback.status, 302); assert.equal(callback.headers.Location, '/profile.html');
  assert.equal(writes.length, 1); assert.equal(writes[0][0], 'shadypc');
  assert.ok(callback.cookies.some(cookie => cookie.name === 'srt_driver_session' && cookie.httpOnly && cookie.secure));
});

test('first matching username creates a pending claim instead of exposing history', async () => {
  let claimWritten = false;
  const db = async sql => {
    if (sql.includes('WHERE discord_user_id=$1')) return { rows: [] };
    if (sql.includes("LOWER(TRIM(LEADING '@'")) return { rows: [{ id: 7, discord_user_id: null }] };
    if (sql.includes('INSERT INTO driver_login_claims')) claimWritten = true;
    return { rows: [] };
  };
  const fetcher = async url => String(url).endsWith('/oauth2/token')
    ? { ok: true, json: async () => ({ access_token: 'private-token', token_type: 'Bearer' }) }
    : { ok: true, json: async () => ({ id: '11223344', username: 'ShadyPC', global_name: 'Shady', avatar: null }) };
  const handler = createDiscordAuthHandler({ db, fetcher });
  const login = await handler(new Request('https://example.test/api/discord-auth?action=login'), { error() {} });
  const state = new URL(login.headers.Location).searchParams.get('state');
  const callback = await handler(new Request(`https://example.test/api/discord-auth?action=callback&code=one-time&state=${encodeURIComponent(state)}`,
    { headers: { cookie: `srt_discord_state=${encodeURIComponent(state)}` } }), { error() {} });
  assert.equal(callback.status, 302); assert.equal(callback.headers.Location, '/profile.html?claim=pending');
  assert.equal(claimWritten, true); assert.equal(callback.cookies.some(cookie => cookie.name === 'srt_driver_session'), false);
});

test('Discord callback rejects mismatched state before contacting Discord', async () => {
  let fetched = false;
  const handler = createDiscordAuthHandler({ db: async () => ({ rows: [] }), fetcher: async () => { fetched = true; } });
  const response = await handler(new Request('https://example.test/api/discord-auth?action=callback&code=x&state=wrong',
    { headers: { cookie: 'srt_discord_state=different' } }), { error() {} });
  assert.equal(response.status, 302); assert.match(response.headers.Location, /state/); assert.equal(fetched, false);
});
