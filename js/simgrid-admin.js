let simgridPreview = null;
let simgridBusy = false;

function resetSimgridPreview() {
  simgridPreview = null;
  document.getElementById('simgrid-status').textContent = '';
}

function populateSimgridLeagues() {
  if (simgridBusy) return;
  const select = document.getElementById('simgrid-league');
  select.replaceChildren(new Option('-- Select SimGrid league --', ''));
  adminData.leagues.filter(league => league.simgridUrl).forEach(league => select.add(new Option(league.name, league.id)));
  const preseason = adminData.leagues.find(league => /\/championships\/26866(?:[/?#]|$)/.test(league.simgridUrl || ''));
  if (preseason) select.value = preseason.id;
  populateResultSyncLeagues();
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
}

function openSyncPreviewModal(title, content) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.querySelector('#modal .modal-dialog').classList.add('modal-dialog-wide');
  document.getElementById('modal').style.display = 'flex';
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
    openSyncPreviewModal('Preview SimGrid Sync', `
      <div class="sync-preview-heading"><div><span class="preview-kicker">Championship</span><h3>${escapeHtml(data.snapshot.name)}</h3></div><div class="preview-count">${data.snapshot.standings.length}<small>drivers</small></div></div>
      <div class="sync-preview-summary"><div><strong>Last saved</strong><span>${data.syncedAt ? escapeHtml(new Date(data.syncedAt).toLocaleString()) : 'Never'}</span></div><div><strong>Simulator</strong><span>${escapeHtml(data.snapshot.sim)}</span></div><div><strong>Sessions</strong><span>${data.snapshot.races.length}</span></div></div>
      <ul class="sync-change-list">${summary}</ul>
      <div class="preview-table"><table><thead><tr><th>Pos</th><th>Driver</th><th>Car #</th><th>Class</th><th>Score</th><th>Penalties</th><th>Adjustment</th></tr></thead><tbody>
      ${data.snapshot.standings.map(row => `<tr><td>${row.position}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.carNumber)}</td><td>${escapeHtml(row.className)}</td><td>${row.score}</td><td>${row.penalties}</td><td>${row.adjustment}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="modal-actions"><button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn-primary" id="modal-simgrid-confirm" onclick="syncSimgrid()">Confirm sync</button></div>`);
    simgridStatus('Preview ready in the dialog.');
  } catch (error) { simgridStatus(error.message, true); }
  finally { setSimgridBusy(false); }
}

async function syncSimgrid() {
  if (simgridBusy || !simgridPreview) return;
  const preview = simgridPreview;
  setSimgridBusy(true);
  const confirmButton = document.getElementById('modal-simgrid-confirm');
  if (confirmButton) { confirmButton.disabled = true; confirmButton.textContent = 'Syncing…'; }
  try {
    const result = await simgridRequest({ action: 'sync', leagueId: preview.leagueId, hash: preview.hash, revision: preview.revision });
    resetSimgridPreview();
    closeModal();
    simgridStatus(`Sync complete at ${new Date(result.syncedAt).toLocaleString()}. Drivers, official standings and schedule updated.`);
    await Promise.all([loadLeagues(), loadRegistrations()]);
  } catch (error) {
    simgridPreview = null;
    simgridStatus(`${error.message} Generate a fresh preview before retrying.`, true);
  } finally { setSimgridBusy(false); }
}

let resultUploadPreview = null;

function populateResultSyncLeagues() {
  const select = document.getElementById('result-sync-league');
  if (!select) return;
  const previous = select.value;
  select.replaceChildren(new Option('-- Select SimGrid league --', ''));
  adminData.leagues.filter(league => league.simgridUrl).forEach(league => select.add(new Option(league.name, league.id)));
  select.value = previous && adminData.leagues.some(league => String(league.id) === previous) ? previous :
    (adminData.leagues.find(league => /\/championships\/26866(?:[/?#]|$)/.test(league.simgridUrl || ''))?.id || '');
  loadResultSyncRaces();
}

async function loadResultSyncRaces() {
  const leagueId = document.getElementById('result-sync-league').value;
  const raceSelect = document.getElementById('result-sync-race');
  raceSelect.replaceChildren(new Option(leagueId ? 'Loading races…' : '-- Select league first --', ''));
  raceSelect.disabled = true;
  resultUploadPreview = null;
  if (!leagueId) return;
  try {
    const response = await fetch(`/api/simgrid?leagueId=${encodeURIComponent(leagueId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load races.');
    raceSelect.replaceChildren(new Option('-- Select race --', ''));
    (data.snapshot?.races || []).forEach(race => raceSelect.add(new Option(`${race.name} · ${new Date(race.startsAt).toLocaleDateString()}`, race.id)));
    raceSelect.disabled = !data.snapshot?.races?.length;
    if (raceSelect.disabled) resultSyncStatus('Sync the championship before uploading a result.', true);
  } catch (error) { raceSelect.replaceChildren(new Option('-- Races unavailable --', '')); resultSyncStatus(error.message, true); }
}

function resultSyncStatus(message, error = false) {
  const status = document.getElementById('result-sync-status');
  status.className = `status-message ${error ? 'error' : 'success'} show`;
  status.textContent = message;
}

async function resultUploadRequest(action, hash = '') {
  const file = document.getElementById('result-sync-file').files[0];
  if (!file) throw new Error('Choose an LMU result file.');
  if (file.size > 8 * 1024 * 1024) throw new Error('The LMU result file must be smaller than 8 MB.');
  const form = new FormData();
  form.append('action', action); form.append('leagueId', document.getElementById('result-sync-league').value);
  form.append('raceId', document.getElementById('result-sync-race').value); form.append('hash', hash); form.append('file', file, file.name);
  const response = await fetch('/api/simgrid-results', { method: 'POST', headers: { 'X-SRT-Admin-Token': localStorage.getItem('srt_admin_token') || '' }, body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Result upload failed.');
  return data;
}

async function previewRaceResult() {
  const league = document.getElementById('result-sync-league').value;
  const race = document.getElementById('result-sync-race').value;
  if (!league || !race) return resultSyncStatus('Select a league and race.', true);
  const button = document.getElementById('result-preview-button'); button.disabled = true;
  resultSyncStatus('Validating the result file…');
  try {
    const data = await resultUploadRequest('preview');
    resultUploadPreview = data;
    const p = data.preview, valid = p.validation.valid;
    const warning = valid ? '<div class="preview-validation valid">Date and track match the selected SimGrid race.</div>' :
      `<div class="preview-validation invalid"><strong>This file cannot be synced.</strong><ul>${p.validation.warnings.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
    openSyncPreviewModal('Preview League Race Result', `
      <div class="sync-preview-heading"><div><span class="preview-kicker">${escapeHtml(p.leagueName)}</span><h3>${escapeHtml(p.race.name)}</h3><p>${escapeHtml(p.result.sourceFile)}</p></div><div class="preview-count">${p.result.Result.length}<small>drivers</small></div></div>
      <div class="sync-preview-summary"><div><strong>XML track</strong><span>${escapeHtml(p.result.TrackName)} · ${escapeHtml(p.result.TrackConfig)}</span></div><div><strong>XML date</strong><span>${escapeHtml(new Date(p.result.Date).toLocaleString())}</span></div><div><strong>Winner laps</strong><span>${p.result.TotalLaps}</span></div></div>
      ${warning}
      <div class="mapping-preview-strip"><div><strong>${p.mapping?.total ?? p.result.Result.length}</strong><span>Drivers</span></div><div><strong>${p.mapping?.matched ?? 0}</strong><span>Mapped</span></div><div><strong>${p.mapping?.unmatched ?? p.result.Result.length}</strong><span>Needs review</span></div></div>
      <div class="preview-table"><table><thead><tr><th>Pos</th><th>Driver</th><th>Car #</th><th>Class</th><th>Laps</th><th>Best lap</th><th>Status</th></tr></thead><tbody>
      ${p.result.Result.map((row, index) => `<tr><td>${row.Position}</td><td>${escapeHtml(row.DriverName)}<small class="mapping-row-status">${p.mapping?.drivers?.[index]?.matched ? `→ ${escapeHtml(p.mapping.drivers[index].profile)}` : 'Needs mapping'}</small></td><td>${escapeHtml(row.CarNumber)}</td><td>${escapeHtml(row.CarClass)}</td><td>${row.NumLaps}</td><td>${formatPreviewMs(row.BestLap)}</td><td>${escapeHtml(row.FinishStatus)}</td></tr>`).join('')}</tbody></table></div>
      <div class="modal-actions"><button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn-primary" id="modal-result-confirm" onclick="syncRaceResultUpload()" ${valid ? '' : 'disabled'}>Confirm race sync</button></div>`);
    resultSyncStatus(valid ? 'Preview ready in the dialog.' : 'File does not match the selected race.', !valid);
  } catch (error) { resultSyncStatus(error.message, true); }
  finally { button.disabled = false; }
}

function formatPreviewMs(ms) {
  if (!ms) return '—';
  const minutes = Math.floor(ms / 60000), seconds = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${minutes}:${seconds}`;
}

async function syncRaceResultUpload() {
  if (!resultUploadPreview?.preview?.validation?.valid) return;
  const button = document.getElementById('modal-result-confirm'); button.disabled = true; button.textContent = 'Syncing…';
  try {
    const data = await resultUploadRequest('sync', resultUploadPreview.hash);
    resultUploadPreview = null; closeModal();
    resultSyncStatus(`Race result synced for ${data.drivers} drivers.`);
    await loadSyncHistory();
  } catch (error) { button.disabled = false; button.textContent = 'Confirm race sync'; resultSyncStatus(error.message, true); }
}
