BEGIN;

CREATE TABLE IF NOT EXISTS driver_profiles (
  id SERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  discord_username TEXT,
  discord_user_id TEXT UNIQUE,
  simgrid_user_id TEXT UNIQUE,
  discord_global_name TEXT,
  discord_avatar_hash TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_login',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_profiles_discord_username
  ON driver_profiles (LOWER(discord_username)) WHERE discord_username IS NOT NULL;

ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS discord_global_name TEXT;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS discord_avatar_hash TEXT;

CREATE TABLE IF NOT EXISTS driver_aliases (
  id SERIAL PRIMARY KEY,
  driver_profile_id INTEGER NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'global',
  approved_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, normalized_alias)
);

CREATE TABLE IF NOT EXISTS race_sessions (
  id SERIAL PRIMARY KEY,
  race_result_id INTEGER NOT NULL UNIQUE REFERENCES race_results(id) ON DELETE CASCADE,
  league_id INTEGER,
  track TEXT,
  session_date TIMESTAMPTZ,
  session_type TEXT,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS race_entries (
  id SERIAL PRIMARY KEY,
  race_session_id INTEGER NOT NULL REFERENCES race_sessions(id) ON DELETE CASCADE,
  result_index INTEGER NOT NULL,
  driver_profile_id INTEGER REFERENCES driver_profiles(id) ON DELETE SET NULL,
  original_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  mapping_method TEXT NOT NULL DEFAULT 'unmatched',
  position INTEGER,
  grid_position INTEGER,
  car_number TEXT,
  car_model TEXT,
  car_class TEXT,
  team_name TEXT,
  laps INTEGER,
  best_lap BIGINT,
  total_time BIGINT,
  finish_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(race_session_id, result_index)
);

CREATE TABLE IF NOT EXISTS driver_name_candidates (
  id SERIAL PRIMARY KEY,
  normalized_name TEXT NOT NULL UNIQUE,
  sample_name TEXT NOT NULL,
  appearances INTEGER NOT NULL DEFAULT 0,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'unmatched',
  driver_profile_id INTEGER REFERENCES driver_profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_mapping_audit (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  driver_profile_id INTEGER,
  normalized_name TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_login_claims (
  id BIGSERIAL PRIMARY KEY,
  driver_profile_id INTEGER NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL UNIQUE,
  discord_username TEXT NOT NULL,
  discord_global_name TEXT,
  discord_avatar_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS driver_profile_id INTEGER REFERENCES driver_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_race_entries_driver ON race_entries(driver_profile_id);
CREATE INDEX IF NOT EXISTS idx_race_entries_name ON race_entries(normalized_name);
CREATE INDEX IF NOT EXISTS idx_driver_aliases_profile ON driver_aliases(driver_profile_id);

COMMIT;
