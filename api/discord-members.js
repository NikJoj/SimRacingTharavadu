import { SyncError } from './simgrid-client.js';

const DISCORD_API = 'https://discord.com/api/v10';

function configuration() {
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  const missing = [
    ['DISCORD_BOT_TOKEN', botToken],
    ['DISCORD_GUILD_ID', guildId]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new SyncError(`Discord member sync is missing server setting${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`, 503);
  if (!/^\d+$/.test(guildId)) throw new SyncError('DISCORD_GUILD_ID must be a Discord server ID.', 503);
  return { botToken, guildId };
}

export async function fetchDiscordMembers(fetcher = fetch) {
  const { botToken, guildId } = configuration();
  const members = [];
  let after = '';
  for (let page = 0; page < 100; page++) {
    const url = new URL(`${DISCORD_API}/guilds/${guildId}/members`);
    url.searchParams.set('limit', '1000');
    if (after) url.searchParams.set('after', after);
    let response;
    try {
      response = await fetcher(url, { headers: { Authorization: `Bot ${botToken}` }, signal: AbortSignal.timeout(15000) });
    } catch {
      throw new SyncError('Discord could not be reached. No member links were changed.', 502);
    }
    if (!response.ok) {
      const message = response.status === 401 ? 'Discord rejected the bot token.'
        : response.status === 403 ? 'The Discord bot cannot list this server. Check the server ID, bot membership, and Server Members Intent.'
        : response.status === 404 ? 'Discord could not find this server for the configured bot. Check that DISCORD_GUILD_ID is the SRT server ID and install this exact bot application in that server.'
        : response.status === 429 ? 'Discord rate limited the member sync. Try again shortly.'
        : `Discord member sync returned HTTP ${response.status}.`;
      throw new SyncError(message, response.status === 429 ? 429 : 502);
    }
    let batch;
    try { batch = await response.json(); } catch { throw new SyncError('Discord returned an invalid member list.', 502); }
    if (!Array.isArray(batch)) throw new SyncError('Discord returned an invalid member list.', 502);
    const valid = batch.filter(member => /^\d+$/.test(String(member?.user?.id || '')) && !member.user.bot);
    members.push(...valid.map(member => ({
      id: String(member.user.id), username: String(member.user.username || ''),
      globalName: String(member.user.global_name || ''), nickname: String(member.nick || ''),
      avatarHash: String(member.user.avatar || '')
    })));
    if (batch.length < 1000) return members;
    after = String(batch[batch.length - 1]?.user?.id || '');
    if (!after) throw new SyncError('Discord member pagination was incomplete.', 502);
  }
  throw new SyncError('Discord server member list is too large to synchronize safely.', 502);
}
