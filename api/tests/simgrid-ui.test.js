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
  assert.doesNotMatch(container.innerHTML, /Last synced|not deducted again|Open SimGrid championship/);
  await context.loadSimgridView({ id: '3', simgridUrl: 'https://www.thesimgrid.com/championships/26866' }, 'races');
  assert.doesNotMatch(container.innerHTML, /Last synced|Synced schedule|Open SimGrid championship/);
});
test('public display rejects unsafe links and explains unsynced data', async () => {
  const container = { innerHTML: '' };
  const context = vm.createContext({ URL, Date, currentLeagueId: '3', document: { getElementById: () => container },
    fetch: async () => ({ ok: true, json: async () => ({ snapshot: null }) }) });
  vm.runInContext(source, context);
  assert.equal(context.simgridPortalUrl('javascript:alert(1)'), 'https://www.thesimgrid.com/');
  await context.loadSimgridView({ id: '3', simgridUrl: 'https://www.thesimgrid.com/championships/26866' }, 'races');
  assert.match(container.innerHTML, /No standings or race data available yet/);
});
test('switching leagues during a fetch does not render stale data', async () => {
  const container = { innerHTML: '' };
  const context = vm.createContext({ URL, Date, currentLeagueId: '99', document: { getElementById: () => container },
    fetch: async () => ({ ok: true, json: async () => ({ snapshot: null }) }) });
  vm.runInContext(source, context);
  await context.loadSimgridView({ id: '3', simgridUrl: '' }, 'races');
  assert.doesNotMatch(container.innerHTML, /No standings or race data available yet/);
});

test('portal uses site-themed content and restores Assetto iframe when switching leagues', () => {
  const iframe = { removeAttribute(name) { delete this[name]; } };
  const portal = { innerHTML: '' }, banner = {};
  const context = vm.createContext({ URL, console, document: {
    getElementById: id => id === 'signup-iframe' ? iframe : portal,
    querySelector: () => banner
  }, appLeagues: [
    { id: '3', name: 'Preseason <test>', simgridUrl: 'https://www.thesimgrid.com/championships/26866?s=invite' },
    { id: '1', championshipId: 'assetto-id' }
  ] });
  vm.runInContext(source, context);
  vm.runInContext(readFileSync(new URL('../../js/leagues.js', import.meta.url), 'utf8'), context);
  vm.runInContext("currentLeagueId = '3'; loadSignupIframe();", context);
  assert.equal(iframe.hidden, true);
  assert.equal(banner.hidden, true);
  assert.equal(portal.hidden, false);
  assert.match(portal.innerHTML, /btn-primary simgrid-portal-link/);
  assert.match(portal.innerHTML, /Preseason &lt;test&gt;/);
  assert.match(portal.innerHTML, /26866\?s=invite/);
  vm.runInContext("currentLeagueId = '1'; loadSignupIframe();", context);
  assert.equal(iframe.hidden, false);
  assert.equal(banner.hidden, false);
  assert.equal(portal.hidden, true);
  assert.match(iframe.src, /championship\/assetto-id$/);
});
