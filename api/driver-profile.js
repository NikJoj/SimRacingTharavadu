import { app } from '@azure/functions';
import { query } from './db.js';
import { requireDriverSession } from './discord-session.js';
import { SyncError } from './simgrid-client.js';

export function createDriverProfileHandler({ db = query } = {}) {
  return async function handler(request, context) {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      if (request.method !== 'GET') throw new SyncError('Method not allowed.', 405);
      const session = requireDriverSession(request);
      const profile = (await db(`SELECT id,display_name,discord_username,discord_user_id,discord_global_name,discord_avatar_hash,status
        FROM driver_profiles WHERE id=$1 AND discord_user_id=$2`, [session.profileId, session.discordUserId])).rows[0];
      if (!profile) throw new SyncError('Driver profile is no longer linked.', 401);
      const raceResultId = new URL(request.url).searchParams.get('raceResultId');
      if (raceResultId) {
        if (!/^\d+$/.test(raceResultId)) throw new SyncError('Invalid race result.', 400);
        const race = (await db(`SELECT result.result_data,session.track,session.session_date,session.session_type,
          COALESCE(league.name,'SRT Race') AS competition FROM race_entries entry
          JOIN race_sessions session ON session.id=entry.race_session_id
          JOIN race_results result ON result.id=session.race_result_id
          LEFT JOIN leagues league ON league.id=session.league_id
          WHERE entry.driver_profile_id=$1 AND result.id=$2`, [profile.id, Number(raceResultId)])).rows[0];
        if (!race) throw new SyncError('Race result not found for this driver.', 404);
        return { status: 200, headers, jsonBody: { race } };
      }
      const history = (await db(`SELECT entry.position,entry.grid_position,entry.car_number,entry.car_model,entry.car_class,
        entry.team_name,entry.laps,entry.best_lap,entry.total_time,entry.finish_status,
        session.track,session.session_date,session.session_type,session.league_id,result.race_timestamp,result.id AS race_result_id,
        COALESCE(league.name,'SRT Race') AS competition
        FROM race_entries entry JOIN race_sessions session ON session.id=entry.race_session_id
        JOIN race_results result ON result.id=session.race_result_id
        LEFT JOIN leagues league ON league.id=session.league_id
        WHERE entry.driver_profile_id=$1 ORDER BY session.session_date DESC NULLS LAST`, [profile.id])).rows;
      const positions = history.map(row => Number(row.position)).filter(Number.isFinite);
      const stats = { races: history.length, wins: positions.filter(value => value === 1).length,
        podiums: positions.filter(value => value >= 1 && value <= 3).length,
        averageFinish: positions.length ? Math.round((positions.reduce((sum, value) => sum + value, 0) / positions.length) * 10) / 10 : null,
        completedLaps: history.reduce((sum, row) => sum + (Number(row.laps) || 0), 0) };
      const avatarUrl = profile.discord_avatar_hash ? `https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar_hash}.png?size=128` : '';
      return { status: 200, headers, jsonBody: { profile: { ...profile, avatarUrl }, stats, history } };
    } catch (error) {
      if (!(error instanceof SyncError)) context.error('Driver profile request failed.');
      return { status: error.status || 500, headers, jsonBody: { error: error instanceof SyncError ? error.message : 'Profile could not be loaded.' } };
    }
  };
}

export const handler = createDriverProfileHandler();
app.http('driverProfile', { route: 'driver-profile', methods: ['GET'], authLevel: 'anonymous', handler });
