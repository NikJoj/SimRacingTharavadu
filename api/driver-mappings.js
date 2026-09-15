import { app } from '@azure/functions';
import { query } from './db.js';
import { requireAdmin, SyncError } from './simgrid-client.js';
import { ensureIdentitySchema, indexAllHistory, normalizeDriverName } from './driver-identity.js';
import { normalizeDiscordUsername } from './discord-session.js';

function clean(value, max = 120) { return String(value || '').trim().slice(0, max); }

export function createDriverMappingsHandler({ db = query } = {}) {
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
        await db(`INSERT INTO driver_aliases (driver_profile_id,alias,normalized_alias,source,approved_by)
          VALUES ($1,$2,$3,'global',$4) ON CONFLICT (source,normalized_alias) DO UPDATE SET
          driver_profile_id=EXCLUDED.driver_profile_id, alias=EXCLUDED.alias, approved_by=EXCLUDED.approved_by`,
          [profileId, candidate.sample_name, candidate.normalized_name, admin]);
        await db(`UPDATE race_entries SET driver_profile_id=$1,mapping_method='approved_alias',updated_at=NOW() WHERE normalized_name=$2`, [profileId, candidate.normalized_name]);
        const registrations = (await db(`SELECT id,driver_tag FROM registrations WHERE driver_profile_id IS DISTINCT FROM $1`, [profileId])).rows;
        for (const registration of registrations) if (normalizeDriverName(registration.driver_tag) === candidate.normalized_name) {
          await db('UPDATE registrations SET driver_profile_id=$1 WHERE id=$2', [profileId, registration.id]);
        }
        await db(`UPDATE driver_name_candidates SET driver_profile_id=$1,status='approved',updated_at=NOW() WHERE id=$2`, [profileId, candidateId]);
        await db(`INSERT INTO driver_mapping_audit(action,driver_profile_id,normalized_name,details,admin_username)
          VALUES('assign',$1,$2,$3::jsonb,$4)`, [profileId, candidate.normalized_name, JSON.stringify({ alias: candidate.sample_name }), admin]);
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
