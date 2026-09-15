let driverMappingData = { profiles: [], candidates: [], audit: [], claims: [], discordMembers: [] };

function mappingAuthHeaders(json = false) {
  const headers = { 'X-SRT-Admin-Token': localStorage.getItem('srt_admin_token') || '' };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

function mappingStatus(message, error = false) {
  const el = document.getElementById('mapping-status');
  el.className = `status-message ${error ? 'error' : 'success'} show`;
  el.textContent = message;
}

async function mappingRequest(body) {
  const response = await fetch('/api/driver-mappings', body ? {
    method: 'POST', headers: mappingAuthHeaders(true), body: JSON.stringify(body)
  } : { headers: mappingAuthHeaders(), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Driver mapping request failed.');
  return data;
}

async function loadDriverMappings() {
  const container = document.getElementById('mapping-candidates');
  if (!container) return;
  container.innerHTML = '<div class="loading">Loading driver mappings…</div>';
  try {
    driverMappingData = await mappingRequest();
    renderDriverMappings();
  } catch (error) {
    container.innerHTML = `<div class="data-error">${escapeHtml(error.message)}</div>`;
  }
}

async function indexDriverHistory() {
  const button = document.getElementById('mapping-index-button');
  button.disabled = true; button.textContent = 'Scanning…';
  mappingStatus('Reading registrations and archived race results. Existing mappings will be preserved.');
  try {
    const result = await mappingRequest({ action: 'index' });
    mappingStatus(`Indexed ${result.entries} driver appearances from ${result.races} races.`);
    await loadDriverMappings();
  } catch (error) { mappingStatus(error.message, true); }
  finally { button.disabled = false; button.textContent = 'Scan & refresh history'; }
}

async function previewDiscordMembers() {
  const button = document.getElementById('discord-members-button');
  button.disabled = true; button.textContent = 'Fetching…';
  mappingStatus('Reading members from the SRT Discord server. No profiles are being changed yet.');
  try {
    const result = await mappingRequest({ action: 'preview-discord-members' });
    driverMappingData.discordMembers = result.members || [];
    renderDiscordMembers();
    mappingStatus(`Fetched ${driverMappingData.discordMembers.length} Discord members. Review the selections before confirming.`);
  } catch (error) { mappingStatus(error.message, true); }
  finally { button.disabled = false; button.textContent = 'Fetch Discord members'; }
}

function renderDiscordMembers() {
  const container = document.getElementById('mapping-discord-members'), members = driverMappingData.discordMembers || [];
  if (!members.length) return container.innerHTML = '<div class="loading">No Discord members loaded.</div>';
  const options = driverMappingData.profiles.map(profile => `<option value="${profile.id}">${escapeHtml(profile.display_name)} · @${escapeHtml(profile.discord_username || 'unassigned')}</option>`).join('');
  container.innerHTML = `<div class="discord-member-toolbar"><span><strong>${members.length}</strong> non-bot members · ${members.filter(member => member.matchMethod === 'discord_id').length} already linked · ${members.filter(member => member.matchMethod === 'username').length} suggested</span>
    <button class="btn-primary" onclick="confirmDiscordMembers()">Confirm selected links</button></div><div class="table-wrapper"><table><thead><tr><th>Discord member</th><th>User ID</th><th>Match</th><th>Driver profile</th></tr></thead><tbody>
    ${members.map((member, index) => `<tr class="${member.matchMethod === 'discord_id' ? 'mapping-approved' : ''}"><td><strong>${escapeHtml(member.nickname || member.globalName || member.username)}</strong><small class="mapping-normalized">@${escapeHtml(member.username)}</small></td>
      <td><code>${escapeHtml(member.id)}</code></td><td>${member.matchMethod === 'discord_id' ? '<span class="status-badge status-ongoing">Linked</span>' : member.matchMethod === 'username' ? '<span class="mapping-source">Username suggestion</span>' : '<span class="mapping-source">Needs review</span>'}</td>
      <td><select class="form-control discord-member-profile" data-member-id="${escapeHtml(member.id)}" ${member.matchMethod === 'discord_id' ? 'disabled' : ''}><option value="">Do not link</option>${options}</select></td></tr>`).join('')}</tbody></table></div>`;
  members.forEach((member, index) => { const select = container.querySelectorAll('.discord-member-profile')[index]; if (member.suggestedProfileId) select.value = String(member.suggestedProfileId); });
}

async function confirmDiscordMembers() {
  const links = [...document.querySelectorAll('.discord-member-profile:not(:disabled)')].filter(select => select.value)
    .map(select => ({ memberId: select.dataset.memberId, profileId: Number(select.value) }));
  if (!links.length) return mappingStatus('Select at least one unlinked Discord member and driver profile.', true);
  if (!confirm(`Link ${links.length} Discord member${links.length === 1 ? '' : 's'} to the selected driver profiles?`)) return;
  try {
    const result = await mappingRequest({ action: 'confirm-discord-members', links });
    mappingStatus(`Linked ${result.linked} Discord member${result.linked === 1 ? '' : 's'}. They can now sign in without approval.`);
    await loadDriverMappings(); await previewDiscordMembers();
  } catch (error) { mappingStatus(error.message, true); }
}

function renderDriverMappings() {
  const search = (document.getElementById('mapping-search')?.value || '').trim().toLowerCase();
  const candidates = driverMappingData.candidates.filter(candidate =>
    !search || candidate.sample_name.toLowerCase().includes(search) || (candidate.sources || []).join(' ').toLowerCase().includes(search));
  const unmatched = driverMappingData.candidates.filter(candidate => candidate.status !== 'approved').length;
  document.getElementById('mapping-stats').innerHTML = `
    <div><strong>${driverMappingData.profiles.length}</strong><span>Profiles</span></div>
    <div><strong>${driverMappingData.candidates.length}</strong><span>Known names</span></div>
    <div><strong>${unmatched}</strong><span>Needs review</span></div>`;
  renderLoginClaims();
  const profileOptions = driverMappingData.profiles.map(profile =>
    `<option value="${profile.id}">${escapeHtml(profile.display_name)} · @${escapeHtml(profile.discord_username || 'unassigned')}</option>`).join('');
  document.getElementById('mapping-candidates').innerHTML = candidates.length ? `<div class="table-wrapper"><table><thead><tr>
    <th>Racing name</th><th>Appearances</th><th>Sources</th><th>Resolution</th><th>Action</th></tr></thead><tbody>
    ${candidates.map(candidate => `<tr class="${candidate.status === 'approved' ? 'mapping-approved' : ''}">
      <td><strong>${escapeHtml(candidate.sample_name)}</strong><small class="mapping-normalized">${escapeHtml(candidate.normalized_name)}</small></td>
      <td>${candidate.appearances}</td><td>${(candidate.sources || []).map(source => `<span class="mapping-source">${escapeHtml(source)}</span>`).join(' ')}</td>
      <td>${candidate.status === 'approved' ? `<span class="status-badge status-ongoing">Approved</span>` : `
        <select class="form-control mapping-profile-select" id="mapping-profile-${candidate.id}" onchange="toggleNewMappingFields(${candidate.id})">
          <option value="">Create new profile</option>${profileOptions}</select>
        <div class="mapping-new-profile" id="mapping-new-${candidate.id}">
          <input class="form-control" id="mapping-name-${candidate.id}" value="${escapeHtml(candidate.sample_name)}" placeholder="Display name">
          <input class="form-control" id="mapping-discord-${candidate.id}" placeholder="Discord username">
        </div>`}</td>
      <td>${candidate.status === 'approved'
        ? `<button class="btn-secondary btn-small" onclick="unassignDriverCandidate(${candidate.id})">Undo</button>`
        : `<button class="btn-primary btn-small" onclick="assignDriverCandidate(${candidate.id})">Approve</button>`}</td>
    </tr>`).join('')}</tbody></table></div>` : '<div class="loading">No driver names found. Run the history scan first.</div>';
  renderDriverProfiles();
  renderMappingAudit();
}

function renderLoginClaims() {
  const panel = document.getElementById('mapping-claims-panel'), claims = driverMappingData.claims || [];
  panel.hidden = !claims.length;
  if (!claims.length) return;
  document.getElementById('mapping-claims').innerHTML = `<div class="table-wrapper"><table><thead><tr><th>Mapped profile</th><th>Discord account</th><th>Discord user ID</th><th>Requested</th><th>Action</th></tr></thead><tbody>
    ${claims.map(claim => `<tr><td><strong>${escapeHtml(claim.display_name)}</strong></td><td>@${escapeHtml(claim.discord_username)}${claim.discord_global_name ? `<small class="mapping-normalized">${escapeHtml(claim.discord_global_name)}</small>` : ''}</td>
      <td><code>${escapeHtml(claim.discord_user_id)}</code></td><td>${formatDate(claim.created_at)}</td><td><div class="table-actions"><button class="btn-primary btn-small" onclick="reviewDiscordClaim(${claim.id},'approve')">Approve</button><button class="btn-secondary btn-small" onclick="reviewDiscordClaim(${claim.id},'reject')">Reject</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

async function reviewDiscordClaim(claimId, decision) {
  try {
    await mappingRequest({ action: 'review-claim', claimId, decision });
    mappingStatus(`Discord login claim ${decision === 'approve' ? 'approved. The driver can now sign in again.' : 'rejected.'}`);
    await loadDriverMappings();
  } catch (error) { mappingStatus(error.message, true); }
}

function toggleNewMappingFields(candidateId) {
  document.getElementById(`mapping-new-${candidateId}`).hidden = !!document.getElementById(`mapping-profile-${candidateId}`).value;
}

async function assignDriverCandidate(candidateId) {
  const profileId = document.getElementById(`mapping-profile-${candidateId}`).value;
  const body = { action: 'assign', candidateId, profileId: profileId || null };
  if (!profileId) {
    body.displayName = document.getElementById(`mapping-name-${candidateId}`).value;
    body.discordUsername = document.getElementById(`mapping-discord-${candidateId}`).value;
  }
  try { await mappingRequest(body); mappingStatus('Driver alias approved. Future syncs will match it automatically.'); await loadDriverMappings(); }
  catch (error) { mappingStatus(error.message, true); }
}

async function unassignDriverCandidate(candidateId) {
  if (!confirm('Remove this alias mapping? Existing race data will remain, but these entries will become unmatched.')) return;
  try { await mappingRequest({ action: 'unassign', candidateId }); mappingStatus('Alias mapping removed.'); await loadDriverMappings(); }
  catch (error) { mappingStatus(error.message, true); }
}

function renderDriverProfiles() {
  document.getElementById('mapping-profiles').innerHTML = driverMappingData.profiles.length ? `<div class="table-wrapper"><table><thead><tr>
    <th>Driver</th><th>Discord username</th><th>Aliases</th><th>Race entries</th><th>Login status</th><th>Action</th></tr></thead><tbody>
    ${driverMappingData.profiles.map(profile => `<tr><td><input class="form-control" id="profile-name-${profile.id}" value="${escapeHtml(profile.display_name)}"></td>
      <td><input class="form-control" id="profile-discord-${profile.id}" value="${escapeHtml(profile.discord_username || '')}"></td>
      <td>${profile.alias_count}</td><td>${profile.race_count}</td><td>${escapeHtml(profile.status)}</td>
      <td><button class="btn-secondary btn-small" onclick="updateDriverProfile(${profile.id})">Save</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="loading">Profiles appear after the first alias is approved.</div>';
}

async function updateDriverProfile(profileId) {
  try {
    await mappingRequest({ action: 'update-profile', profileId,
      displayName: document.getElementById(`profile-name-${profileId}`).value,
      discordUsername: document.getElementById(`profile-discord-${profileId}`).value });
    mappingStatus('Driver profile updated.'); await loadDriverMappings();
  } catch (error) { mappingStatus(error.message, true); }
}

function renderMappingAudit() {
  document.getElementById('mapping-audit').innerHTML = driverMappingData.audit.length
    ? driverMappingData.audit.map(item => `<div><strong>${escapeHtml(item.action.replace('_', ' '))}</strong><span>${escapeHtml(item.normalized_name || '')}</span><time>${formatDate(item.created_at)}</time></div>`).join('')
    : '<div class="loading">No mapping changes yet.</div>';
}
