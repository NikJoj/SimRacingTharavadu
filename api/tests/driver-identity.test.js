import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDriverName, extractRaceEntries, ensureIdentitySchema, previewRaceMappings } from '../driver-identity.js';

test('normalizes known SRT name variations conservatively', () => {
  assert.equal(normalizeDriverName('  SRT | Rahul_N  '), 'rahul n');
  assert.equal(normalizeDriverName('RÁHUL  27'), 'ráhul 27');
  assert.equal(normalizeDriverName(''), '');
});

test('extracts searchable entries without modifying archived result JSON', () => {
  const data = { Result: [{ DriverName: 'SRT | Arjun', Position: 2, GridPosition: 5,
    CarNumber: '46', CarModel: 'GT3', CarClass: 'LMGT3', TeamName: 'SRT', NumLaps: 20,
    BestLap: 90000, TotalTime: 2000000, FinishStatus: 'Finished' }] };
  const before = JSON.stringify(data);
  const entries = extractRaceEntries(data);
  assert.equal(entries[0].normalizedName, 'arjun');
  assert.equal(entries[0].position, 2);
  assert.equal(entries[0].carNumber, '46');
  assert.equal(JSON.stringify(data), before);
});

test('identity schema migration is idempotent and keeps mappings separate from race JSON', async () => {
  const statements = [];
  await ensureIdentitySchema(async sql => { statements.push(sql); return { rows: [] }; });
  assert.ok(statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS driver_profiles')));
  assert.ok(statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS race_entries')));
  assert.ok(statements.some(sql => sql.includes('ADD COLUMN IF NOT EXISTS driver_profile_id')));
  assert.ok(statements.every(sql => !sql.includes('UPDATE race_results SET result_data')));
});

test('race preview reports approved aliases without writing', async () => {
  const calls = [];
  const db = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('to_regclass')) return { rows: [{ table_name: 'driver_aliases' }] };
    return { rows: [{ normalized_alias: 'arjun', display_name: 'Arjun K' }] };
  };
  const summary = await previewRaceMappings(db, { Result: [
    { DriverName: 'SRT | Arjun' }, { DriverName: 'New Driver' }
  ] });
  assert.equal(summary.total, 2); assert.equal(summary.matched, 1); assert.equal(summary.unmatched, 1);
  assert.equal(summary.drivers[0].profile, 'Arjun K');
  assert.ok(calls.every(call => /^SELECT/i.test(call.sql.trim())));
});
