/**
 * Database Utility Module
 * Provides connection and query functions for Neon PostgreSQL
 */

import { neon } from '@neondatabase/serverless';

// Lazy-initialize: don't call neon() at module load time — DATABASE_URL may
// not be set in the Functions runtime until the first request is handled.
let _sql = null;
function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

/**
 * Vercel-postgres compatible sql tag
 * Returns { rows } so existing API endpoints continue to work
 */
export async function sql(strings, ...values) {
  const rows = await getSql()(strings, ...values);
  return { rows };
}

/**
 * Execute a raw SQL query with positional parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result with { rows }
 */
export async function query(text, params = []) {
  try {
    const rows = await getSql().query(text, params);
    return { rows };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Test database connection
 * @returns {Promise<Object>} Connection status
 */
export async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    return {
      success: true,
      time: result.rows[0].current_time
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initialize database tables (idempotent — safe to call on every cold start)
 * Creates tables and indexes if they don't exist, adds missing columns
 */
export async function initializeTables() {
  try {
    const neonSql = getSql();
    // ── events ──────────────────────────────────────────────────────────────
    await neonSql(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sim VARCHAR(100),
        status VARCHAR(50) DEFAULT 'upcoming',
        track VARCHAR(255),
        start_date VARCHAR(100),
        end_date VARCHAR(100),
        format VARCHAR(100),
        drivers INTEGER DEFAULT 0,
        max_drivers INTEGER DEFAULT 30,
        rounds INTEGER DEFAULT 1,
        season VARCHAR(50),
        description TEXT,
        track_mod TEXT,
        car_mod TEXT,
        practice_server TEXT,
        car_options TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── leagues ─────────────────────────────────────────────────────────────
    await neonSql(`
      CREATE TABLE IF NOT EXISTS leagues (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sim VARCHAR(100),
        status VARCHAR(50) DEFAULT 'upcoming',
        start_date VARCHAR(100),
        end_date VARCHAR(100),
        format VARCHAR(100),
        season VARCHAR(50),
        championship_id VARCHAR(255),
        blob_store TEXT,
        simgrid_url TEXT,
        drivers INTEGER DEFAULT 0,
        max_drivers INTEGER DEFAULT 36,
        rounds INTEGER DEFAULT 8,
        track VARCHAR(255),
        description TEXT,
        car_options TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add simgrid_url to existing leagues tables that predate this column
    await neonSql(`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS simgrid_url TEXT`);

    // ── leaderboard ─────────────────────────────────────────────────────────
    await neonSql(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        race VARCHAR(100) DEFAULT 'Race 1',
        position INTEGER,
        driver VARCHAR(255),
        tag VARCHAR(100),
        team VARCHAR(255),
        points DECIMAL(10,2),
        time VARCHAR(50),
        gap VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── registrations ────────────────────────────────────────────────────────
    await neonSql(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        timestamp VARCHAR(100),
        driver_tag VARCHAR(100) NOT NULL,
        discord VARCHAR(255),
        car_class VARCHAR(100),
        event VARCHAR(255),
        league_id INTEGER,
        car_number VARCHAR(50),
        penalty_points INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await neonSql(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS league_id INTEGER`);
    await neonSql(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS car_number VARCHAR(50)`);
    await neonSql(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS penalty_points INTEGER DEFAULT 0`);

    // ── race_results ─────────────────────────────────────────────────────────
    // Replaces Vercel Blob storage. Stores full race JSON + metadata per league.
    await neonSql(`
      CREATE TABLE IF NOT EXISTS race_results (
        id SERIAL PRIMARY KEY,
        league VARCHAR(100) NOT NULL,
        league_id INTEGER,
        track VARCHAR(200),
        session_date TIMESTAMPTZ,
        result_data JSONB NOT NULL,
        stored_at TIMESTAMPTZ DEFAULT NOW(),
        race_timestamp BIGINT NOT NULL,
        results_json_url TEXT,
        results_page_url TEXT,
        session_type VARCHAR(50) DEFAULT 'RACE',
        UNIQUE(league, race_timestamp)
      )
    `);
    // `league` was the old Blob-folder identifier. Retain it for existing
    // records, but associate results with the actual league from now on.
    await neonSql(`ALTER TABLE race_results ADD COLUMN IF NOT EXISTS league_id INTEGER`);
    await neonSql(`
      UPDATE race_results AS race
      SET league_id = league_record.id
      FROM leagues AS league_record
      WHERE race.league_id IS NULL
        AND race.league = league_record.blob_store
    `);

    // ── indexes ───────────────────────────────────────────────────────────────
    await neonSql(`CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)`);
    await neonSql(`CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status)`);
    await neonSql(`CREATE INDEX IF NOT EXISTS idx_leagues_championship ON leagues(championship_id)`);
    await neonSql(`CREATE INDEX IF NOT EXISTS idx_leaderboard_event_race ON leaderboard(event_id, race)`);
    await neonSql(`CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event)`);
    await neonSql(`CREATE INDEX IF NOT EXISTS idx_race_results_league ON race_results(league)`);
    await neonSql(`CREATE INDEX IF NOT EXISTS idx_race_results_league_id ON race_results(league_id)`);
    await neonSql(`CREATE INDEX IF NOT EXISTS idx_race_results_timestamp ON race_results(race_timestamp DESC)`);

    return {
      success: true,
      message: 'Database tables initialized successfully'
    };
  } catch (error) {
    console.error('Database initialization error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
