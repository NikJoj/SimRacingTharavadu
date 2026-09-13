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
    const portal = `<a href="${simgridEscape(simgridPortalUrl(league.simgridUrl))}" target="_blank" rel="noopener noreferrer">Open SimGrid championship ↗</a>`;
    if (!data.snapshot) {
      container.innerHTML = `<div class="empty-state">No SimGrid sync yet. An admin can preview and sync this league from the dashboard.<p>${portal}</p></div>`;
      return;
    }
    const snapshot = data.snapshot;
    const header = `<p>Saved from SimGrid · Last synced ${simgridEscape(new Date(data.syncedAt).toLocaleString())}. Changes appear after the next manual sync.</p><p>${portal}</p>`;
    if (tab === 'standings') {
      // Keep official position and adjusted score; never pass through the
      // Assetto renderer/local penalty lookup or recalculate tie-breaks.
      container.innerHTML = `${header}<p>Official adjusted scores from SimGrid. Penalties and adjustments are shown for reference, not deducted again.</p>
        <div style="overflow-x:auto"><table class="lb-table"><thead><tr><th>Pos</th><th>Driver</th><th>Car #</th><th>Class</th><th>Penalties</th><th>Adjustment</th><th>Score</th></tr></thead><tbody>
        ${snapshot.standings.map(row => `<tr><td>${simgridEscape(row.position)}</td><td>${simgridEscape(row.name)}<div class="td-driver-team">${simgridEscape(row.car)}</div></td><td>${simgridEscape(row.carNumber)}</td><td>${simgridEscape(row.className)}</td><td>${simgridEscape(row.penalties)}</td><td title="${simgridEscape(row.adjustmentReason)}">${simgridEscape(row.adjustment)}</td><td class="td-pts">${simgridEscape(row.score)}</td></tr>`).join('')}
        </tbody></table>${snapshot.standings.length ? '' : '<p>No standings published yet.</p>'}</div>`;
    } else {
      container.innerHTML = `${header}<p>Synced schedule and publication status. Detailed results and lap times are viewed on SimGrid.</p>
        <div style="overflow-x:auto"><table class="lb-table"><thead><tr><th>Race</th><th>Track</th><th>Date</th><th>Results</th></tr></thead><tbody>
        ${snapshot.races.map(race => `<tr><td>${simgridEscape(race.name)}</td><td>${simgridEscape(race.track)}</td><td>${simgridEscape(new Date(race.startsAt).toLocaleString())}</td><td>${race.resultsAvailable ? 'Available on SimGrid' : 'Not published'}</td></tr>`).join('')}
        </tbody></table></div>`;
    }
  } catch (error) {
    if (currentLeagueId === league.id) container.innerHTML = `<div class="data-error">${simgridEscape(error.message)}</div>`;
  }
}
