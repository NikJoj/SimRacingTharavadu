function simgridEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function simgridPortalUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'www.thesimgrid.com' && /^\/championships\/\d+\/?$/.test(url.pathname)) return url.href;
  } catch { /* Do not render untrusted links. */ }
  return 'https://www.thesimgrid.com/';
}

async function loadSimgridView(league, tab) {
  const container = document.getElementById(`league-${tab}-content`);
  container.innerHTML = '<div class="data-loading">Loading saved SimGrid data…</div>';
  try {
    const response = await fetch(`/api/simgrid?leagueId=${encodeURIComponent(league.id)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load saved data.');
    if (currentLeagueId !== league.id) return;
    if (!data.snapshot) {
      container.innerHTML = '<div class="empty-state">No standings or race data available yet.</div>';
      return;
    }
    const snapshot = data.snapshot;
    if (tab === 'standings') {
      // Keep official position and adjusted score; never pass through the
      // Assetto renderer/local penalty lookup or recalculate tie-breaks.
      container.innerHTML = `
        <div style="overflow-x:auto"><table class="lb-table"><thead><tr><th>Pos</th><th>Driver</th><th>Car #</th><th>Class</th><th>Penalties</th><th>Adjustment</th><th>Score</th></tr></thead><tbody>
        ${snapshot.standings.map(row => `<tr><td>${simgridEscape(row.position)}</td><td>${simgridEscape(row.name)}<div class="td-driver-team">${simgridEscape(row.car)}</div></td><td>${simgridEscape(row.carNumber)}</td><td>${simgridEscape(row.className)}</td><td>${simgridEscape(row.penalties)}</td><td title="${simgridEscape(row.adjustmentReason)}">${simgridEscape(row.adjustment)}</td><td class="td-pts">${simgridEscape(row.score)}</td></tr>`).join('')}
        </tbody></table>${snapshot.standings.length ? '' : '<p>No standings published yet.</p>'}</div>`;
    } else {
      const archiveResponse = await fetch(`${CONFIG.API_ENDPOINTS.RACE_STORE}?leagueId=${encodeURIComponent(league.id)}`, { cache: 'no-store' });
      const archive = await archiveResponse.json();
      if (!archiveResponse.ok) throw new Error(archive.error || 'Could not load saved race results.');
      if (currentLeagueId !== league.id) return;
      container.innerHTML = buildSimgridRaceList(snapshot.races, archive.races || [], league.id);
    }
  } catch (error) {
    if (currentLeagueId === league.id) container.innerHTML = `<div class="data-error">${simgridEscape(error.message)}</div>`;
  }
}

function buildSimgridRaceList(races, storedRaces, leagueId) {
  const savedByTimestamp = new Map(storedRaces.map(race => [String(race.race_timestamp), race]));
  if (!races.length) return '<div class="empty-state"><div class="empty-state-icon">🏁</div><div class="empty-state-text">No races scheduled yet</div></div>';
  return `<div class="race-list">${races.map(race => {
    const timestamp = Date.parse(race.startsAt);
    const stored = savedByTimestamp.get(String(timestamp));
    const date = new Date(race.startsAt);
    const validDate = !Number.isNaN(date.getTime());
    const content = `
      <div class="race-item-content">
        <div class="race-item-main">
          <div class="race-name">${simgridEscape(race.name || race.track || 'Race')}</div>
          <div class="race-track">${simgridEscape(race.track || 'Track TBA')}</div>
          <div class="race-details">
            <div class="race-detail-item"><span>${validDate ? simgridEscape(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : 'Date TBA'}</span></div>
            ${validDate ? `<div class="race-detail-item"><span>${simgridEscape(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }))}</span></div>` : ''}
            <span class="race-sync-state ${stored ? 'is-synced' : 'not-synced'}">${stored ? 'Results synced' : 'Results not synced yet'}</span>
          </div>
        </div>
        ${stored ? '<div class="race-arrow" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>' : ''}
      </div>`;
    return stored
      ? `<button type="button" class="race-item race-item-button" onclick="showRaceResults('db:${simgridEscape(leagueId)}:${simgridEscape(timestamp)}')">${content}</button>`
      : `<div class="race-item race-item-unavailable" aria-disabled="true">${content}</div>`;
  }).join('')}</div>`;
}
