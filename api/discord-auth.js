import crypto from 'node:crypto';
import { app } from '@azure/functions';
import { query } from './db.js';
import { ensureIdentitySchema } from './driver-identity.js';
import { authCookie, cookieValue, normalizeDiscordUsername, requireDriverSession, signDriverValue, verifyDriverValue } from './discord-session.js';
import { SyncError } from './simgrid-client.js';

const DISCORD_API = 'https://discord.com/api/v10';
const redirect = location => ({ status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
function configured() {
  const clientId = process.env.DISCORD_CLIENT_ID, clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new SyncError('Discord login is not configured.', 503);
  return { clientId, clientSecret, redirectUri };
}
function profileRedirect(error = '') { return `/profile.html${error ? `?error=${encodeURIComponent(error)}` : ''}`; }

async function discordUser(code, config, fetcher) {
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
    grant_type: 'authorization_code', code, redirect_uri: config.redirectUri });
  const tokenResponse = await fetcher(`${DISCORD_API}/oauth2/token`, { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000) });
  if (!tokenResponse.ok) throw new SyncError('Discord authorization could not be completed.', 401);
  const token = await tokenResponse.json();
  if (!token.access_token || token.token_type?.toLowerCase() !== 'bearer') throw new SyncError('Discord returned an invalid authorization.', 502);
  const userResponse = await fetcher(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15000) });
  if (!userResponse.ok) throw new SyncError('Discord profile could not be read.', 502);
  const user = await userResponse.json();
  if (!/^\d+$/.test(String(user.id || '')) || !normalizeDiscordUsername(user.username)) throw new SyncError('Discord returned an invalid profile.', 502);
  return user;
}

export function createDiscordAuthHandler({ db = query, fetcher = fetch } = {}) {
  return async function handler(request, context) {
    const url = new URL(request.url), action = url.searchParams.get('action') || 'me';
    try {
      if (request.method !== 'GET') throw new SyncError('Method not allowed.', 405);
      if (action === 'login') {
        const config = configured(), nonce = crypto.randomBytes(24).toString('base64url');
        const state = signDriverValue({ purpose: 'discord_state', nonce, exp: Date.now() + 10 * 60 * 1000 });
        const authorize = new URL('https://discord.com/oauth2/authorize');
        authorize.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId,
          scope: 'identify', state, redirect_uri: config.redirectUri }).toString();
        return { ...redirect(authorize.href), cookies: [authCookie('srt_discord_state', state, 600)] };
      }
      if (action === 'callback') {
        const config = configured(), code = url.searchParams.get('code'), returnedState = url.searchParams.get('state');
        const cookieState = cookieValue(request, 'srt_discord_state');
        if (!code || !returnedState || returnedState !== cookieState) throw new SyncError('Discord login state did not match. Try again.', 401);
        verifyDriverValue(returnedState, 'discord_state');
        const user = await discordUser(code, config, fetcher);
        const avatarHash = /^[A-Za-z0-9_]+$/.test(String(user.avatar || '')) ? String(user.avatar) : '';
        await ensureIdentitySchema(db);
        const username = normalizeDiscordUsername(user.username);
        let profiles = (await db(`SELECT id,discord_user_id FROM driver_profiles WHERE discord_user_id=$1`, [String(user.id)])).rows;
        if (!profiles.length) profiles = (await db(`SELECT id,discord_user_id FROM driver_profiles
          WHERE LOWER(TRIM(LEADING '@' FROM discord_username))=$1`, [username])).rows;
        if (profiles.length !== 1 || (profiles[0].discord_user_id && profiles[0].discord_user_id !== String(user.id))) {
          return { ...redirect(profileRedirect(profiles.length > 1 ? 'Your Discord username matches multiple profiles. Ask an admin to resolve it.' :
            'No approved driver profile matches this Discord username. Ask an admin to add it first.')),
            cookies: [authCookie('srt_discord_state', '', 0)] };
        }
        const profileId = profiles[0].id;
        if (!profiles[0].discord_user_id) {
          await db(`INSERT INTO driver_login_claims
            (driver_profile_id,discord_user_id,discord_username,discord_global_name,discord_avatar_hash,status)
            VALUES($1,$2,$3,$4,$5,'pending') ON CONFLICT(discord_user_id) DO UPDATE SET
            driver_profile_id=EXCLUDED.driver_profile_id,discord_username=EXCLUDED.discord_username,
            discord_global_name=EXCLUDED.discord_global_name,discord_avatar_hash=EXCLUDED.discord_avatar_hash,
            status=CASE WHEN driver_login_claims.status='approved' THEN 'approved' ELSE 'pending' END`,
            [profileId, String(user.id), username, String(user.global_name || ''), avatarHash]);
          return { ...redirect('/profile.html?claim=pending'), cookies: [authCookie('srt_discord_state', '', 0)] };
        }
        await db(`UPDATE driver_profiles SET discord_username=$1,discord_global_name=$2,
          discord_avatar_hash=$3,status='verified',updated_at=NOW() WHERE id=$4`,
          [username, String(user.global_name || ''), avatarHash, profileId]);
        const session = signDriverValue({ purpose: 'driver', profileId, discordUserId: String(user.id), exp: Date.now() + 7 * 86400000 });
        return { ...redirect(profileRedirect()), cookies: [authCookie('srt_discord_state', '', 0), authCookie('srt_driver_session', session, 604800)] };
      }
      if (action === 'logout') return { ...redirect('/'), cookies: [authCookie('srt_driver_session', '', 0)] };
      if (action === 'me') {
        try { const session = requireDriverSession(request); return { status: 200, headers: { 'Cache-Control': 'no-store' }, jsonBody: { authenticated: true, profileId: session.profileId } }; }
        catch { return { status: 200, headers: { 'Cache-Control': 'no-store' }, jsonBody: { authenticated: false } }; }
      }
      throw new SyncError('Unknown login action.', 400);
    } catch (error) {
      if (!(error instanceof SyncError)) context.error('Discord login failed.');
      if (action === 'callback' || action === 'login') return { ...redirect(profileRedirect(error instanceof SyncError ? error.message : 'Discord login failed.')),
        cookies: [authCookie('srt_discord_state', '', 0)] };
      return { status: error.status || 500, headers: { 'Cache-Control': 'no-store' }, jsonBody: { error: error instanceof SyncError ? error.message : 'Discord login failed.' } };
    }
  };
}

export const handler = createDiscordAuthHandler();
app.http('discordAuth', { route: 'discord-auth', methods: ['GET'], authLevel: 'anonymous', handler });
