import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../js/simgrid-public.js', import.meta.url), 'utf8');
test('public standings render official score and escape imported text', async () => {
  const container = { innerHTML: '' };
  const context = vm.createContext({ URL, Date, currentLeagueId: '3', document: { getElementById: () => container },
    fetch: async () => ({ ok: true, json: async () => ({ syncedAt: '2026-09-13T00:00:00Z', snapshot: {
      standings: [{ position: 1, name: '<img src=x onerror=alert(1)>', car: 'Car', carNumber: '7', className: 'LMGT3', penalties: 2, adjustment: 7, adjustmentReason: '"test"', score: 65 }], races: []
    } }) }) });
  vm.runInContext(source, context);
  await context.loadSimgridView({ id: '3', simgridUrl: 'https://www.thesimgrid.com/championships/26866' }, 'standings');
  assert.match(container.innerHTML, /td-pts">65</);
  assert.match(container.innerHTML, /&lt;img/);
  assert.doesNotMatch(container.innerHTML, /<img/);
  assert.match(container.innerHTML, /not deducted again/);
});
test('public display rejects unsafe links and explains unsynced data', async () => {
  const container = { innerHTML: '' };
  const context = vm.createContext({ URL, Date, currentLeagueId: '3', document: { getElementById: () => container },
    fetch: async () => ({ ok: true, json: async () => ({ snapshot: null }) }) });
  vm.runInContext(source, context);
  assert.equal(context.simgridPortalUrl('javascript:alert(1)'), 'https://www.thesimgrid.com/');
  await context.loadSimgridView({ id: '3', simgridUrl: 'https://www.thesimgrid.com/championships/26866' }, 'races');
  assert.match(container.innerHTML, /No SimGrid sync yet/);
});
test('switching leagues during a fetch does not render stale data', async () => {
  const container = { innerHTML: '' };
  const context = vm.createContext({ URL, Date, currentLeagueId: '99', document: { getElementById: () => container },
    fetch: async () => ({ ok: true, json: async () => ({ snapshot: null }) }) });
  vm.runInContext(source, context);
  await context.loadSimgridView({ id: '3', simgridUrl: '' }, 'races');
  assert.doesNotMatch(container.innerHTML, /No SimGrid sync yet/);
});
