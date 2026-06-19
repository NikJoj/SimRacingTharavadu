/**
 * Database Utility Module
 * Provides connection and query functions for Neon PostgreSQL
 */

import { sql } from '@vercel/postgres';

/**
 * Execute a SQL query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params = []) {
  try {
    const result = await sql.query(text, params);
    return result;
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
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    return { 
      success: true, 
      time: result.rows[0].current_time,
      version: result.rows[0].pg_version
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Initialize database tables (idempotent)
 * Creates tables if they don't exist
 */
export async function initializeTables() {
  try {
    // Create events table
    await sql`
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
    `;

    // Create leagues table
    await sql`
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
        drivers INTEGER DEFAULT 0,
        max_drivers INTEGER DEFAULT 36,
        rounds INTEGER DEFAULT 8,
        track VARCHAR(255),
        description TEXT,
        car_options TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create leaderboard table
    await sql`
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
    `;

    // Create registrations table
    await sql`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        timestamp VARCHAR(100),
        driver_tag VARCHAR(100) NOT NULL,
        discord VARCHAR(255),
        car_class VARCHAR(100),
        event VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_leagues_championship ON leagues(championship_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_leaderboard_event_race ON leaderboard(event_id, race)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_registrations_timestamp ON registrations(timestamp DESC)`;

    return { success: true, message: 'Database tables initialized successfully' };
  } catch (error) {
    console.error('Database initialization error:', error);
    return { success: false, error: error.message };
  }
}

// Export sql for direct use in API endpoints
export { sql };

// Made with Bob