import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDiscordMembers } from '../discord-members.js';

process.env.DISCORD_BOT_TOKEN = 'private-test-token';
process.env.DISCORD_GUILD_ID = '1234567890';

test('fetches non-bot Discord members without exposing the bot token', async () => {
  let authorization = '';
  const members = await fetchDiscordMembers(async (url, options) => {
    authorization = options.headers.Authorization;
    assert.equal(new URL(url).pathname, '/api/v10/guilds/1234567890/members');
    return new Response(JSON.stringify([
      { user: { id: '10', username: 'driver', global_name: 'Driver', avatar: 'hash' }, nick: 'SRT Driver' },
      { user: { id: '11', username: 'helper', bot: true } }
    ]), { status: 200 });
  });
  assert.equal(authorization, 'Bot private-test-token');
  assert.deepEqual(members, [{ id: '10', username: 'driver', globalName: 'Driver', nickname: 'SRT Driver', avatarHash: 'hash' }]);
  assert.doesNotMatch(JSON.stringify(members), /private-test-token/);
});

test('explains Discord member-list permission failures', async () => {
  await assert.rejects(() => fetchDiscordMembers(async () => new Response('', { status: 403 })), /Server Members Intent/);
});

test('explains when the configured bot cannot see the guild', async () => {
  await assert.rejects(() => fetchDiscordMembers(async () => new Response('', { status: 404 })), /install this exact bot application/);
});
