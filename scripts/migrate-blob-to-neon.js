#!/usr/bin/env node
/**
 * One-time migration script: Vercel Blob → Neon PostgreSQL race_results table
 *
 * Run ONCE before cutting over to Azure:
 *   DATABASE_URL=... BLOB_READ_WRITE_TOKEN=... node scripts/migrate-blob-to-neon.js
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING so no duplicates will be created.
 */

import { neon } from '@neondatabase/serverless';
import { list } from '@vercel/blob';

const DATABASE_URL = process.env.DATABASE_URL;
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}
if (!BLOB_READ_WRITE_TOKEN) {
  console.error('ERROR: BLOB_READ_WRITE_TOKEN environment variable is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Starting Vercel Blob → Neon migration...\n');

  // Ensure race_results table exists
  await sql.query(`
    CREATE TABLE IF NOT EXISTS race_results (
      id SERIAL PRIMARY KEY,
      league VARCHAR(100) NOT NULL,
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
  await sql.query(`CREATE INDEX IF NOT EXISTS idx_race_results_league ON race_results(league)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS idx_race_results_timestamp ON race_results(race_timestamp DESC)`);

  console.log('✓ race_results table ready\n');

  // List all blobs
  const { blobs } = await list({ token: BLOB_READ_WRITE_TOKEN });
  const metadataBlobs = blobs.filter(b => b.pathname.includes('/metadata-'));

  console.log(`Found ${metadataBlobs.length} race metadata files in Blob storage\n`);

  if (metadataBlobs.length === 0) {
    console.log('No blob data to migrate. You can safely proceed with Azure deployment.');
    return;
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const metaBlob of metadataBlobs) {
    try {
      // Parse league name from path: "SRT-GT3-Season-1/metadata-1234567890.json"
      const parts = metaBlob.pathname.split('/');
      const league = parts[0];
      const timestampMatch = parts[1].match(/metadata-(\d+)\.json/);
      if (!timestampMatch) {
        console.warn(`  SKIP: Cannot parse timestamp from ${metaBlob.pathname}`);
        skipped++;
        continue;
      }
      const raceTimestamp = parseInt(timestampMatch[1], 10);

      // Fetch metadata
      const metaRes = await fetch(metaBlob.url);
      if (!metaRes.ok) throw new Error(`Failed to fetch metadata: ${metaRes.status}`);
      const metadata = await metaRes.json();

      // Fetch race result data
      const racePathname = `${league}/race-${raceTimestamp}.json`;
      const raceBlob = blobs.find(b => b.pathname === racePathname);
      if (!raceBlob) {
        console.warn(`  SKIP: No race data found for ${racePathname}`);
        skipped++;
        continue;
      }

      const raceRes = await fetch(raceBlob.url);
      if (!raceRes.ok) throw new Error(`Failed to fetch race data: ${raceRes.status}`);
      const raceData = await raceRes.json();

      // Insert into Neon — use tagged template so result is always an array of rows
      const rows = await sql`
        INSERT INTO race_results
          (league, track, session_date, result_data, race_timestamp,
           results_json_url, results_page_url, session_type, stored_at)
        VALUES
          (${league}, ${metadata.track || null}, ${metadata.date || null},
           ${JSON.stringify(raceData)}, ${raceTimestamp},
           ${metadata.results_json_url || null}, ${metadata.results_page_url || null},
           ${metadata.session_type || 'RACE'}, ${metadata.stored_at || new Date().toISOString()})
        ON CONFLICT (league, race_timestamp) DO NOTHING
        RETURNING id
      `;

      if (rows.length > 0) {
        console.log(`  ✓ Imported: ${league} / ${metadata.track} (${metadata.date})`);
        imported++;
      } else {
        console.log(`  = Already exists: ${league} / ${metadata.track} (${metadata.date})`);
        skipped++;
      }

    } catch (err) {
      console.error(`  ✗ Failed: ${metaBlob.pathname} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Migration complete:`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped:  ${skipped} (already existed or no data)`);
  console.log(`  Failed:   ${failed}`);
  console.log(`${'─'.repeat(50)}`);

  if (failed === 0) {
    console.log('\n✓ All races migrated successfully.');
    console.log('  You can now remove BLOB_READ_WRITE_TOKEN from your environment.');
  } else {
    console.log(`\n⚠ ${failed} race(s) failed to migrate. Review errors above and re-run.`);
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
