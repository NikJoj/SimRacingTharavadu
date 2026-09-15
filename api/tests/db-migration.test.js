import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTables, selectDatabaseUrl } from '../db.js';

test('initialization adds legacy race league_id before backfill and index', async () => {
  const statements = [];
  const result = await initializeTables(async text => { statements.push(text); return []; });
  assert.equal(result.success, true);
  const add = statements.findIndex(text => text.includes('ALTER TABLE race_results ADD COLUMN IF NOT EXISTS league_id'));
  const backfill = statements.findIndex(text => text.includes('UPDATE race_results AS race'));
  const index = statements.findIndex(text => text.includes('idx_race_results_league_id'));
  assert.ok(add >= 0 && backfill > add && index > backfill);
  assert.match(statements[backfill], /race\.league_id IS NULL/);
  assert.match(statements[backfill], /race\.league = league_record\.blob_store/);
  assert.ok(statements.every(text => !/DROP TABLE|DELETE FROM|TRUNCATE/i.test(text)));
});

test('database selector uses test URL only with an explicit valid flag', () => {
  assert.equal(selectDatabaseUrl({ DATABASE_URL: 'prod' }), 'prod');
  assert.equal(selectDatabaseUrl({ DATABASE_URL: 'prod', USE_TEST_DATABASE: 'false', TEST_DATABASE_URL: 'test' }), 'prod');
  assert.equal(selectDatabaseUrl({ DATABASE_URL: 'prod', USE_TEST_DATABASE: 'TRUE', TEST_DATABASE_URL: 'test' }), 'test');
  assert.throws(() => selectDatabaseUrl({ DATABASE_URL: 'prod', USE_TEST_DATABASE: 'true' }), /TEST_DATABASE_URL/);
  assert.throws(() => selectDatabaseUrl({ DATABASE_URL: 'prod', USE_TEST_DATABASE: 'yes', TEST_DATABASE_URL: 'test' }), /true or false/);
});
