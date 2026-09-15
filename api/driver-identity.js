import { SyncError } from './simgrid-client.js';

export function normalizeDriverName(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase()
    .replace(/^srt\s*[|:_-]\s*/i, '').replace(/[_]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }

export function extractRaceEntries(resultData) {
  const rows = Array.isArray(resultData?.Result) ? resultData.Result : [];
  return rows.map((row, index) => ({
    resultIndex: index, originalName: String(row.DriverName || '').trim(),
    normalizedName: normalizeDriverName(row.DriverName), position: num(row.Position) ?? index + 1,
    gridPosition: num(row.GridPosition), carNumber: String(row.CarNumber || ''),
    carModel: String(row.CarModel || ''), carClass: String(row.CarClass || ''),
    teamName: String(row.TeamName || ''), laps: num(row.NumLaps), bestLap: num(row.BestLap),
    totalTime: num(row.TotalTime), finishStatus: String(row.FinishStatus || '')
  })).filter(row => row.originalName && row.normalizedName);
}

export async function previewRaceMappings(db, resultData) {
  const entries = extractRaceEntries(resultData);
  const exists = (await db("SELECT to_regclass('public.driver_aliases') AS table_name")).rows[0]?.table_name;
  if (!String(exists || '').endsWith('driver_aliases') || !entries.length) return { total: entries.length, matched: 0, unmatched: entries.length,
    drivers: entries.map(entry => ({ name: entry.originalName, matched: false, profile: null })) };
  const names = [...new Set(entries.map(entry => entry.normalizedName))];
  const aliases = (await db(`SELECT alias.normalized_alias, profile.display_name
    FROM driver_aliases alias JOIN driver_profiles profile ON profile.id=alias.driver_profile_id
    WHERE alias.normalized_alias = ANY($1::text[])`, [names])).rows;
  const matched = new Map(aliases.filter(row => row.normalized_alias && row.display_name)
    .map(row => [row.normalized_alias, row.display_name]));
  const drivers = entries.map(entry => ({ name: entry.originalName, matched: matched.has(entry.normalizedName),
    profile: matched.get(entry.normalizedName) || null }));
  return { total: drivers.length, matched: drivers.filter(driver => driver.matched).length,
    unmatched: drivers.filter(driver => !driver.matched).length, drivers };
}

export async function ensureIdentitySchema(db) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS driver_profiles (
      id SERIAL PRIMARY KEY, display_name TEXT NOT NULL, discord_username TEXT,
      discord_user_id TEXT UNIQUE, simgrid_user_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'awaiting_login', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_profiles_discord_username
      ON driver_profiles (LOWER(discord_username)) WHERE discord_username IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS driver_aliases (
      id SERIAL PRIMARY KEY, driver_profile_id INTEGER NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
      alias TEXT NOT NULL, normalized_alias TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'global',
      approved_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(source, normalized_alias)
    )`,
    `CREATE TABLE IF NOT EXISTS race_sessions (
      id SERIAL PRIMARY KEY, race_result_id INTEGER NOT NULL UNIQUE REFERENCES race_results(id) ON DELETE CASCADE,
      league_id INTEGER, track TEXT, session_date TIMESTAMPTZ, session_type TEXT, source TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS race_entries (
      id SERIAL PRIMARY KEY, race_session_id INTEGER NOT NULL REFERENCES race_sessions(id) ON DELETE CASCADE,
      result_index INTEGER NOT NULL, driver_profile_id INTEGER REFERENCES driver_profiles(id) ON DELETE SET NULL,
      original_name TEXT NOT NULL, normalized_name TEXT NOT NULL, mapping_method TEXT NOT NULL DEFAULT 'unmatched',
      position INTEGER, grid_position INTEGER, car_number TEXT, car_model TEXT, car_class TEXT, team_name TEXT,
      laps INTEGER, best_lap BIGINT, total_time BIGINT, finish_status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(race_session_id, result_index)
    )`,
    `CREATE TABLE IF NOT EXISTS driver_name_candidates (
      id SERIAL PRIMARY KEY, normalized_name TEXT NOT NULL UNIQUE, sample_name TEXT NOT NULL,
      appearances INTEGER NOT NULL DEFAULT 0, sources JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'unmatched', driver_profile_id INTEGER REFERENCES driver_profiles(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS driver_mapping_audit (
      id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, driver_profile_id INTEGER,
      normalized_name TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb, admin_username TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS driver_profile_id INTEGER REFERENCES driver_profiles(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_race_entries_driver ON race_entries(driver_profile_id)`,
    `CREATE INDEX IF NOT EXISTS idx_race_entries_name ON race_entries(normalized_name)`,
    `CREATE INDEX IF NOT EXISTS idx_driver_aliases_profile ON driver_aliases(driver_profile_id)`
  ];
  for (const sql of statements) await db(sql);
}

async function approvedProfile(db, normalizedName) {
  return (await db(`SELECT driver_profile_id FROM driver_aliases
    WHERE normalized_alias = $1 AND source IN ('global', 'race_result')
    ORDER BY CASE source WHEN 'race_result' THEN 0 ELSE 1 END LIMIT 1`, [normalizedName])).rows[0]?.driver_profile_id || null;
}

export async function indexRaceResult(db, raceResultId) {
  const stored = (await db(`SELECT id, league_id, track, session_date, session_type, result_data
    FROM race_results WHERE id = $1`, [raceResultId])).rows[0];
  if (!stored) throw new SyncError('Stored race could not be indexed.', 500);
  const source = stored.result_data?.source === 'lmu-xml' ? 'lmu_xml' : 'assetto';
  const session = (await db(`INSERT INTO race_sessions
    (race_result_id, league_id, track, session_date, session_type, source)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (race_result_id) DO UPDATE SET
    league_id=EXCLUDED.league_id, track=EXCLUDED.track, session_date=EXCLUDED.session_date,
    session_type=EXCLUDED.session_type, source=EXCLUDED.source, updated_at=NOW() RETURNING id`,
    [stored.id, stored.league_id, stored.track, stored.session_date, stored.session_type, source])).rows[0];
  const entries = extractRaceEntries(stored.result_data);
  let matched = 0;
  await db('DELETE FROM race_entries WHERE race_session_id = $1', [session.id]);
  for (const entry of entries) {
    const profileId = await approvedProfile(db, entry.normalizedName);
    if (profileId) matched++;
    await db(`INSERT INTO race_entries (race_session_id,result_index,driver_profile_id,original_name,normalized_name,mapping_method,
      position,grid_position,car_number,car_model,car_class,team_name,laps,best_lap,total_time,finish_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [session.id, entry.resultIndex, profileId, entry.originalName, entry.normalizedName, profileId ? 'approved_alias' : 'unmatched',
        entry.position, entry.gridPosition, entry.carNumber, entry.carModel, entry.carClass, entry.teamName,
        entry.laps, entry.bestLap, entry.totalTime, entry.finishStatus]);
  }
  return { entries: entries.length, matched };
}

export async function rebuildCandidates(db) {
  const raceNames = (await db(`SELECT entry.original_name, entry.normalized_name,
    COALESCE(league.name, session.source) AS source
    FROM race_entries entry JOIN race_sessions session ON session.id=entry.race_session_id
    LEFT JOIN leagues league ON league.id=session.league_id`)).rows;
  const registrations = (await db(`SELECT id, driver_tag, event FROM registrations WHERE TRIM(COALESCE(driver_tag,'')) <> ''`)).rows;
  const groups = new Map();
  const add = (name, normalized, source) => {
    if (!normalized) return;
    const group = groups.get(normalized) || { sampleName: name, appearances: 0, sources: new Set() };
    group.appearances++; group.sources.add(source); groups.set(normalized, group);
  };
  raceNames.forEach(row => add(row.original_name, row.normalized_name, row.source));
  for (const registration of registrations) {
    const normalized = normalizeDriverName(registration.driver_tag);
    add(registration.driver_tag, normalized, registration.event || 'registration');
    const profileId = await approvedProfile(db, normalized);
    if (profileId) await db('UPDATE registrations SET driver_profile_id=$1 WHERE id=$2', [profileId, registration.id]);
  }
  for (const [normalized, group] of groups) {
    const profileId = await approvedProfile(db, normalized);
    await db(`INSERT INTO driver_name_candidates (normalized_name,sample_name,appearances,sources,status,driver_profile_id)
      VALUES($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT(normalized_name) DO UPDATE SET
      sample_name=EXCLUDED.sample_name,appearances=EXCLUDED.appearances,sources=EXCLUDED.sources,
      status=EXCLUDED.status,driver_profile_id=EXCLUDED.driver_profile_id,updated_at=NOW()`,
      [normalized, group.sampleName, group.appearances, JSON.stringify([...group.sources].sort()), profileId ? 'approved' : 'unmatched', profileId]);
  }
}

export async function indexAllHistory(db) {
  const races = (await db('SELECT id FROM race_results ORDER BY id')).rows;
  let entries = 0;
  for (const race of races) entries += (await indexRaceResult(db, race.id)).entries;
  await rebuildCandidates(db);
  return { races: races.length, entries };
}
