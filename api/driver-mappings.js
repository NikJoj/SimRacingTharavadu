import { app } from '@azure/functions';
import { query } from './db.js';
import { requireAdmin, SyncError } from './simgrid-client.js';
import { ensureIdentitySchema, indexAllHistory, normalizeDriverName } from './driver-identity.js';
import { normalizeDiscordUsername } from './discord-session.js';
import { fetchDiscordMembers } from './discord-members.js';

function clean(value, max = 120) { return String(value || '').trim().slice(0, max); }

async function approveCandidate(db, candidate, profileId, admin) {
  await db(`INSERT INTO driver_aliases (driver_profile_id,alias,normalized_alias,source,approved_by)
    VALUES ($1,$2,$3,'global',$4) ON CONFLICT (source,normalized_alias) DO UPDATE SET
    driver_profile_id=EXCLUDED.driver_profile_id, alias=EXCLUDED.alias, approved_by=EXCLUDED.approved_by`,
    [profileId, candidate.sample_name, candidate.normalized_name, admin]);
  await db(`UPDATE race_entries SET driver_profile_id=$1,mapping_method='approved_alias',updated_at=NOW()
    WHERE normalized_name=$2`, [profileId, candidate.normalized_name]);
  const registrations = (await db(`SELECT id,driver_tag FROM registrations WHERE driver_profile_id IS DISTINCT FROM $1`, [profileId])).rows;
  for (const registration of registrations) if (normalizeDriverName(registration.driver_tag) === candidate.normalized_name) {
    await db('UPDATE registrations SET driver_profile_id=$1 WHERE id=$2', [profileId, registration.id]);
  }
  await db(`UPDATE driver_name_candidates SET driver_profile_id=$1,status='approved',updated_at=NOW() WHERE id=$2`, [profileId, candidate.id]);
  await db(`INSERT INTO driver_mapping_audit(action,driver_profile_id,normalized_name,details,admin_username)
    VALUES('assign',$1,$2,$3::jsonb,$4)`, [profileId, candidate.normalized_name, JSON.stringify({ alias: candidate.sample_name }), admin]);
}

export function createDriverMappingsHandler({ db = query, discordMembers = fetchDiscordMembers } = {}) {
  return async function handler(request, context) {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      if (request.method === 'OPTIONS') return { status: 204, headers };
      const admin = requireAdmin(request);
      await ensureIdentitySchema(db);
      if (request.method === 'GET') {
        const [profiles, candidates, audit, claims] = await Promise.all([
          db(`SELECT profile.*, COUNT(DISTINCT alias.id)::integer AS alias_count,
            COUNT(DISTINCT entry.id)::integer AS race_count FROM driver_profiles profile
            LEFT JOIN driver_aliases alias ON alias.driver_profile_id=profile.id
            LEFT JOIN race_entries entry ON entry.driver_profile_id=profile.id
            GROUP BY profile.id ORDER BY profile.display_name`),
          db(`SELECT * FROM driver_name_candidates ORDER BY
            CASE status WHEN 'unmatched' THEN 0 ELSE 1 END, appearances DESC, sample_name`),
          db('SELECT * FROM driver_mapping_audit ORDER BY created_at DESC LIMIT 30'),
          db(`SELECT claim.*,profile.display_name FROM driver_login_claims claim
            JOIN driver_profiles profile ON profile.id=claim.driver_profile_id
            WHERE claim.status='pending' ORDER BY claim.created_at`)
        ]);
        return { status: 200, headers, jsonBody: { profiles: profiles.rows, candidates: candidates.rows, audit: audit.rows, claims: claims.rows } };
      }
      if (request.method !== 'POST') throw new SyncError('Method not allowed.', 405);
      let body; try { body = await request.json(); } catch { throw new SyncError('Invalid JSON request.', 400); }
      if (body.action === 'index') {
        const result = await indexAllHistory(db);
        return { status: 200, headers, jsonBody: { success: true, ...result } };
      }
      if (body.action === 'preview-discord-members') {
        const members = await discordMembers();
        const profiles = (await db(`SELECT id,display_name,discord_username,discord_user_id FROM driver_profiles ORDER BY display_name`)).rows;
        const byId = new Map(profiles.filter(profile => profile.discord_user_id).map(profile => [String(profile.discord_user_id), profile]));
        const byUsername = new Map();
        for (const profile of profiles) {
          const username = normalizeDiscordUsername(profile.discord_username);
          if (!username) continue;
          const matches = byUsername.get(username) || [];
          matches.push(profile); byUsername.set(username, matches);
        }
        return { status: 200, headers, jsonBody: { success: true, members: members.map(member => {
          const linked = byId.get(member.id);
          const usernameMatches = byUsername.get(normalizeDiscordUsername(member.username)) || [];
          const suggested = linked || (usernameMatches.length === 1 ? usernameMatches[0] : null);
          return { ...member, linkedProfileId: linked?.id || null, linkedProfileName: linked?.display_name || '',
            suggestedProfileId: suggested?.id || null, suggestedProfileName: suggested?.display_name || '',
            matchMethod: linked ? 'discord_id' : suggested ? 'username' : 'unmatched' };
        }) } };
      }
      if (body.action === 'unlink-discord-member') {
        const profileId = Number(body.profileId), discordUserId = String(body.discordUserId || '');
        if (!Number.isSafeInteger(profileId) || profileId <= 0 || !/^\d+$/.test(discordUserId)) throw new SyncError('Choose a valid linked Discord member.', 400);
        const profile = (await db(`UPDATE driver_profiles SET discord_user_id=NULL,discord_username=NULL,
          discord_global_name=NULL,discord_avatar_hash=NULL,status='awaiting_login',updated_at=NOW()
          WHERE id=$1 AND discord_user_id=$2 RETURNING id,display_name`, [profileId, discordUserId])).rows[0];
        if (!profile) throw new SyncError('That Discord account is no longer linked to this profile. Refresh the member list.', 409);
        await db(`UPDATE driver_login_claims SET status='rejected',reviewed_by=$1,reviewed_at=NOW()
          WHERE driver_profile_id=$2 AND discord_user_id=$3 AND status IN ('pending','approved')`, [admin, profileId, discordUserId]);
        await db(`INSERT INTO driver_mapping_audit(action,driver_profile_id,details,admin_username)
          VALUES('discord_member_unlink',$1,$2::jsonb,$3)`, [profileId, JSON.stringify({ discordUserId }), admin]);
        return { status: 200, headers, jsonBody: { success: true, profileId, displayName: profile.display_name } };
      }
      if (body.action === 'confirm-discord-members') {
        if (!Array.isArray(body.links) || !body.links.length || body.links.length > 500) throw new SyncError('Choose at least one valid Discord member link.', 400);
        const selected = body.links.map(link => ({ memberId: String(link.memberId || ''),
          profileId: link.profileId ? Number(link.profileId) : null, candidateId: link.candidateId ? Number(link.candidateId) : null }));
        if (selected.some(link => !/^\d+$/.test(link.memberId) || (!!link.profileId === !!link.candidateId)
          || (link.profileId && (!Number.isSafeInteger(link.profileId) || link.profileId <= 0))
          || (link.candidateId && (!Number.isSafeInteger(link.candidateId) || link.candidateId <= 0)))
          || new Set(selected.map(link => link.memberId)).size !== selected.length
          || new Set(selected.filter(link => link.profileId).map(link => link.profileId)).size !== selected.filter(link => link.profileId).length
          || new Set(selected.filter(link => link.candidateId).map(link => link.candidateId)).size !== selected.filter(link => link.candidateId).length) {
          throw new SyncError('Each Discord member, driver profile, and discovered name may be linked only once.', 400);
        }
        const currentMembers = new Map((await discordMembers()).map(member => [member.id, member]));
        for (const link of selected) {
          const member = currentMembers.get(link.memberId);
          if (!member) throw new SyncError('A selected account is no longer a member of the SRT Discord server. Refresh the preview.', 409);
          if (link.candidateId) {
            const candidate = (await db('SELECT * FROM driver_name_candidates WHERE id=$1', [link.candidateId])).rows[0];
            if (!candidate || candidate.status === 'approved' || candidate.driver_profile_id) throw new SyncError('A selected discovered name is no longer unmatched. Refresh the preview.', 409);
            const usernameOwner = (await db('SELECT id FROM driver_profiles WHERE LOWER(discord_username)=$1', [normalizeDiscordUsername(member.username)])).rows[0];
            if (usernameOwner) throw new SyncError('This Discord username already belongs to a driver profile. Select that existing profile instead.', 409);
            link.candidate = candidate;
            continue;
          }
          const profile = (await db('SELECT id,discord_user_id FROM driver_profiles WHERE id=$1', [link.profileId])).rows[0];
          if (!profile) throw new SyncError('A selected driver profile no longer exists. Refresh the preview.', 409);
          if (profile.discord_user_id && String(profile.discord_user_id) !== member.id) throw new SyncError('A selected profile is already linked to another Discord account.', 409);
          const owner = (await db('SELECT id FROM driver_profiles WHERE discord_user_id=$1 AND id<>$2', [member.id, link.profileId])).rows[0];
          if (owner) throw new SyncError('A selected Discord account is already linked to another driver profile.', 409);
        }
        for (const link of selected) {
          const member = currentMembers.get(link.memberId), username = normalizeDiscordUsername(member.username);
          if (link.candidate) {
            link.profileId = (await db(`INSERT INTO driver_profiles
              (display_name,discord_username,discord_user_id,discord_global_name,discord_avatar_hash,status)
              VALUES($1,$2,$3,$4,$5,'verified') RETURNING id`,
              [link.candidate.sample_name, username, member.id, member.globalName, member.avatarHash])).rows[0].id;
            await approveCandidate(db, link.candidate, link.profileId, admin);
          }
          const usernameOwner = (await db(`SELECT id FROM driver_profiles WHERE LOWER(discord_username)=$1 AND id<>$2`, [username, link.profileId])).rows[0];
          await db(`UPDATE driver_profiles SET discord_user_id=$1,
            discord_username=CASE WHEN $2::boolean THEN discord_username ELSE $3 END,
            discord_global_name=$4,discord_avatar_hash=$5,status='verified',updated_at=NOW() WHERE id=$6`,
            [member.id, !!usernameOwner, username, member.globalName, member.avatarHash, link.profileId]);
          await db(`UPDATE driver_login_claims SET status='approved',reviewed_by=$1,reviewed_at=NOW()
            WHERE driver_profile_id=$2 AND discord_user_id=$3 AND status='pending'`, [admin, link.profileId, member.id]);
          await db(`INSERT INTO driver_mapping_audit(action,driver_profile_id,details,admin_username)
            VALUES('discord_member_link',$1,$2::jsonb,$3)`, [link.profileId, JSON.stringify({ discordUserId: member.id, discordUsername: username }), admin]);
        }
        return { status: 200, headers, jsonBody: { success: true, linked: selected.length } };
      }
      if (body.action === 'assign') {
        const candidateId = Number(body.candidateId), existingId = body.profileId ? Number(body.profileId) : null;
        if (!Number.isSafeInteger(candidateId) || candidateId <= 0) throw new SyncError('Choose a discovered driver.', 400);
        const candidate = (await db('SELECT * FROM driver_name_candidates WHERE id=$1', [candidateId])).rows[0];
        if (!candidate) throw new SyncError('Driver candidate not found.', 404);
        let profileId = existingId;
        if (profileId) {
          if (!(await db('SELECT id FROM driver_profiles WHERE id=$1', [profileId])).rows.length) throw new SyncError('Driver profile not found.', 404);
        } else {
          const displayName = clean(body.displayName || candidate.sample_name), discord = normalizeDiscordUsername(clean(body.discordUsername));
          if (!displayName || !discord) throw new SyncError('Display name and Discord username are required for a new profile.', 400);
          profileId = (await db(`INSERT INTO driver_profiles (display_name, discord_username)
            VALUES ($1,$2) RETURNING id`, [displayName, discord])).rows[0].id;
        }
        await approveCandidate(db, candidate, profileId, admin);
        return { status: 200, headers, jsonBody: { success: true, profileId } };
      }
      if (body.action === 'unassign') {
        const candidateId = Number(body.candidateId);
        const candidate = (await db('SELECT * FROM driver_name_candidates WHERE id=$1', [candidateId])).rows[0];
        if (!candidate) throw new SyncError('Driver candidate not found.', 404);
        await db(`DELETE FROM driver_aliases WHERE source='global' AND normalized_alias=$1`, [candidate.normalized_name]);
        await db(`UPDATE race_entries SET driver_profile_id=NULL,mapping_method='unmatched',updated_at=NOW() WHERE normalized_name=$1`, [candidate.normalized_name]);
        const registrations = (await db(`SELECT id,driver_tag FROM registrations WHERE driver_profile_id=$1`, [candidate.driver_profile_id])).rows;
        for (const registration of registrations) if (normalizeDriverName(registration.driver_tag) === candidate.normalized_name) {
          await db('UPDATE registrations SET driver_profile_id=NULL WHERE id=$1', [registration.id]);
        }
        await db(`UPDATE driver_name_candidates SET driver_profile_id=NULL,status='unmatched',updated_at=NOW() WHERE id=$1`, [candidateId]);
        await db(`INSERT INTO driver_mapping_audit(action,driver_profile_id,normalized_name,admin_username) VALUES('unassign',$1,$2,$3)`,
          [candidate.driver_profile_id, candidate.normalized_name, admin]);
        return { status: 200, headers, jsonBody: { success: true } };
      }
      if (body.action === 'update-profile') {
        const id = Number(body.profileId), displayName = clean(body.displayName), discord = normalizeDiscordUsername(clean(body.discordUsername));
        if (!Number.isSafeInteger(id) || !displayName || !discord) throw new SyncError('Profile, display name and Discord username are required.', 400);
        const result = await db(`UPDATE driver_profiles SET display_name=$1,discord_username=$2,updated_at=NOW() WHERE id=$3 RETURNING id`, [displayName, discord, id]);
        if (!result.rows.length) throw new SyncError('Driver profile not found.', 404);
        await db(`INSERT INTO driver_mapping_audit(action,driver_profile_id,details,admin_username) VALUES('update_profile',$1,$2::jsonb,$3)`, [id, JSON.stringify({ displayName, discordUsername: discord }), admin]);
        return { status: 200, headers, jsonBody: { success: true } };
      }
      if (body.action === 'review-claim') {
        const claimId = Number(body.claimId), decision = body.decision;
        if (!Number.isSafeInteger(claimId) || !['approve','reject'].includes(decision)) throw new SyncError('Choose a valid login claim and decision.', 400);
        const claim = (await db(`SELECT * FROM driver_login_claims WHERE id=$1 AND status='pending'`, [claimId])).rows[0];
        if (!claim) throw new SyncError('Pending login claim not found.', 404);
        if (decision === 'approve') {
          const profile = (await db('SELECT discord_user_id FROM driver_profiles WHERE id=$1', [claim.driver_profile_id])).rows[0];
          if (!profile || (profile.discord_user_id && profile.discord_user_id !== claim.discord_user_id)) throw new SyncError('This profile is already linked to another Discord account.', 409);
          await db(`UPDATE driver_profiles SET discord_user_id=$1,discord_username=$2,discord_global_name=$3,
            discord_avatar_hash=$4,status='verified',updated_at=NOW() WHERE id=$5`,
            [claim.discord_user_id, normalizeDiscordUsername(claim.discord_username), claim.discord_global_name || '', claim.discord_avatar_hash || '', claim.driver_profile_id]);
        }
        await db(`UPDATE driver_login_claims SET status=$1,reviewed_by=$2,reviewed_at=NOW() WHERE id=$3`, [decision === 'approve' ? 'approved' : 'rejected', admin, claimId]);
        await db(`INSERT INTO driver_mapping_audit(action,driver_profile_id,details,admin_username)
          VALUES($1,$2,$3::jsonb,$4)`, [`claim_${decision}`, claim.driver_profile_id, JSON.stringify({ discordUsername: claim.discord_username, discordUserId: claim.discord_user_id }), admin]);
        return { status: 200, headers, jsonBody: { success: true } };
      }
      throw new SyncError('Unknown mapping action.', 400);
    } catch (error) {
      if (!(error instanceof SyncError)) context.error('Driver mapping request failed.');
      const duplicateDiscord = error?.code === '23505';
      return { status: duplicateDiscord ? 409 : error.status || 500, headers,
        jsonBody: { error: duplicateDiscord ? 'That Discord username or identity is already assigned.' : error instanceof SyncError ? error.message : 'Driver mapping failed.' } };
    }
  };
}

export const handler = createDriverMappingsHandler();
app.http('driverMappings', { route: 'driver-mappings', methods: ['GET','POST','OPTIONS'], authLevel: 'anonymous', handler });
