import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTables } from '../db.js';

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
