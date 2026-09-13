let simgridPreview = null;
let simgridBusy = false;

function resetSimgridPreview() {
  simgridPreview = null;
  document.getElementById('simgrid-sync-button').disabled = true;
  document.getElementById('simgrid-preview').replaceChildren();
  document.getElementById('simgrid-status').textContent = '';
}

function populateSimgridLeagues() {
  if (simgridBusy) return;
  const select = document.getElementById('simgrid-league');
  select.replaceChildren(new Option('-- Select SimGrid league --', ''));
  adminData.leagues.filter(league => league.simgridUrl).forEach(league => select.add(new Option(league.name, league.id)));
  const preseason = adminData.leagues.find(league => /\/championships\/26866(?:[/?#]|$)/.test(league.simgridUrl || ''));
  if (preseason) select.value = preseason.id;
  resetSimgridPreview();
}

function simgridStatus(message, error = false) {
  const status = document.getElementById('simgrid-status');
  status.className = `status-message ${error ? 'error' : 'success'} show`;
  status.textContent = message;
}

async function simgridRequest(body) {
  const response = await fetch('/api/simgrid', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SRT-Admin-Token': localStorage.getItem('srt_admin_token') || '' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'SimGrid request failed.');
  return data;
}

function setSimgridBusy(busy) {
  simgridBusy = busy;
  document.getElementById('simgrid-league').disabled = busy;
  document.getElementById('simgrid-preview-button').disabled = busy;
  document.getElementById('simgrid-sync-button').disabled = busy || !simgridPreview;
}

async function previewSimgrid() {
  if (simgridBusy) return;
  resetSimgridPreview();
  const leagueId = document.getElementById('simgrid-league').value;
  if (!leagueId) return simgridStatus('Select a SimGrid league. Add its championship URL in the league editor if it is missing.', true);
  setSimgridBusy(true);
  simgridStatus('Reading SimGrid. No data is being saved yet…');
  try {
    const data = await simgridRequest({ action: 'preview', leagueId });
    simgridPreview = { ...data, leagueId };
    const summary = Object.entries(data.changes).map(([area, diff]) =>
      `<li>${escapeHtml(area)}: ${diff.added} new, ${diff.updated} changed, ${diff.removed} removed/withdrawn</li>`).join('');
    document.getElementById('simgrid-preview').innerHTML = `
      <h4>${escapeHtml(data.snapshot.name)} · ${escapeHtml(data.snapshot.sim)}</h4>
      <p>Last saved: ${data.syncedAt ? escapeHtml(new Date(data.syncedAt).toLocaleString()) : 'Never'}</p>
      <ul>${summary}</ul>
      <p>Confirm replaces the saved standings, including SimGrid adjustments. Withdrawn imported drivers are retained but marked inactive. Existing local-only registrations are preserved. No local penalty deductions are applied to these standings.</p>
      <div class="data-table" style="overflow-x:auto"><table><thead><tr><th>Pos</th><th>Driver</th><th>Car #</th><th>Class</th><th>Official score</th><th>Penalties</th><th>Adjustment</th></tr></thead><tbody>
      ${data.snapshot.standings.map(row => `<tr><td>${row.position}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.carNumber)}</td><td>${escapeHtml(row.className)}</td><td>${row.score}</td><td>${row.penalties}</td><td>${row.adjustment}</td></tr>`).join('')}
      </tbody></table></div>
      <h4>Schedule</h4><ul>${data.snapshot.races.map(race => `<li>${escapeHtml(race.name)} — ${escapeHtml(new Date(race.startsAt).toLocaleString())} — ${race.resultsAvailable ? 'Results available on SimGrid' : 'Results not published'}</li>`).join('')}</ul>`;
    simgridStatus('Preview ready. Review the changes, then confirm sync.');
  } catch (error) { simgridStatus(error.message, true); }
  finally { setSimgridBusy(false); }
}

async function syncSimgrid() {
  if (simgridBusy || !simgridPreview) return;
  const preview = simgridPreview;
  setSimgridBusy(true);
  simgridStatus('Verifying the preview and saving to Neon…');
  try {
    const result = await simgridRequest({ action: 'sync', leagueId: preview.leagueId, hash: preview.hash, revision: preview.revision });
    resetSimgridPreview();
    simgridStatus(`Sync complete at ${new Date(result.syncedAt).toLocaleString()}. Drivers, official standings and schedule updated.`);
    await Promise.all([loadLeagues(), loadRegistrations()]);
  } catch (error) {
    simgridPreview = null;
    simgridStatus(`${error.message} Generate a fresh preview before retrying.`, true);
  } finally { setSimgridBusy(false); }
}
