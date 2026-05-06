/* ═══════════════════════════════════════════════════
   LEAGUES - League Grid, Cards, Pagination
   ═══════════════════════════════════════════════════ */

// Leagues grid pagination
const LEAGUES_PAGE_SIZE = 3;
let leaguesPage = 1;

/**
 * Get leagues sorted by latest first
 * @returns {Array<Object>} Sorted leagues
 */
function getLeaguesSortedLatestFirst() {
  return [...appLeagues].sort((a, b) => {
    const ad = Date.parse(a.startDate || '') || 0;
    const bd = Date.parse(b.startDate || '') || 0;
    if (bd !== ad) return bd - ad;
    const ai = parseInt(a.id || '0', 10) || 0;
    const bi = parseInt(b.id || '0', 10) || 0;
    return bi - ai;
  });
}

/**
 * Build HTML for a single league card
 * @param {Object} l - League object
 * @returns {string} HTML string
 */
function buildLeagueCardHTML(l) {
  const statusLabel = l.status === 'ongoing' ? 'Live Now' : l.status === 'upcoming' ? 'Upcoming' : 'Closed';
  return `
    <div class="league-card ${l.status}">
      <div class="league-poster">
        <img src="leaguePoster${l.id}.png" alt="${l.name} Poster" onerror="this.src='srtLogo.png';">
      </div>
      <div class="league-content">
        <div class="event-badge ${l.status}">${statusLabel}</div>
        <div class="league-name">${l.name}</div>
        <div class="league-sim">${l.sim}</div>
        <div class="league-meta">
          <div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${formatEventDate(l.startDate, l.endDate)}</div>
          ${formatEventTime(l.startDate, l.endDate) ? `<div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${formatEventTime(l.startDate, l.endDate)}</div>` : ''}
        </div>
        <div class="league-footer">
          <div class="drivers-count"><span>${l.drivers}</span> / ${l.maxDrivers} Drivers</div>
          <div class="league-actions">
            <button class="view-details-btn" onclick="showLeagueDetails('${l.id}')">View Details</button>
            ${l.status === 'upcoming'
              ? `<button class="view-lb-btn" onclick="showPage('league-register')">Register →</button>`
              : l.status === 'ongoing'
              ? `<button class="view-lb-btn" onclick="showLB('${l.id}')">Leaderboard →</button>`
              : `<span style="color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:0.8rem;font-weight:600;letter-spacing:0.1em;">Registration Closed</span>`}
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * Set leagues page number
 * @param {number} nextPage - Page number to set
 */
function setLeaguesPage(nextPage) {
  const all = getLeaguesSortedLatestFirst();
  const totalPages = Math.max(1, Math.ceil(all.length / LEAGUES_PAGE_SIZE));
  leaguesPage = Math.min(Math.max(1, nextPage), totalPages);
  renderLeaguesGrid();
}

/**
 * Render leagues grid with pagination
 */
function renderLeaguesGrid() {
  const el = document.getElementById('leagues-grid');
  const pager = document.getElementById('leagues-pagination');
  if (!el) return;
  if (!appLeagues.length) {
    el.innerHTML = '<div class="data-error">No leagues found.</div>';
    if (pager) pager.style.display = 'none';
    return;
  }
  const all = getLeaguesSortedLatestFirst();

  const totalPages = Math.max(1, Math.ceil(all.length / LEAGUES_PAGE_SIZE));
  if (leaguesPage > totalPages) leaguesPage = totalPages;
  if (leaguesPage < 1) leaguesPage = 1;

  const start = (leaguesPage - 1) * LEAGUES_PAGE_SIZE;
  const pageItems = all.slice(start, start + LEAGUES_PAGE_SIZE);
  el.innerHTML = pageItems.map(buildLeagueCardHTML).join('');

  if (pager) {
    if (totalPages <= 1) {
      pager.style.display = 'none';
    } else {
      pager.style.display = 'flex';
      pager.innerHTML = `
        <button class="events-page-btn" onclick="setLeaguesPage(${leaguesPage - 1})" ${leaguesPage <= 1 ? 'disabled' : ''}>← Prev</button>
        <div class="events-page-info">Page ${leaguesPage} / ${totalPages}</div>
        <button class="events-page-btn" onclick="setLeaguesPage(${leaguesPage + 1})" ${leaguesPage >= totalPages ? 'disabled' : ''}>Next →</button>
      `;
    }
  }
}

/* ═══════════════════════════════════════════════════
   LEAGUE DETAILS PAGE - Tab Management & Data Loading
   ═══════════════════════════════════════════════════ */

// Store current league ID and tab
let currentLeagueId = null;
let currentLeagueTab = 'standings';

/**
 * Show league details page (called from Leaderboard button)
 * @param {string} leagueId - League ID
 */
function showLB(leagueId) {
  currentLeagueId = leagueId;
  const league = appLeagues.find(l => l.id === leagueId);
  
  if (!league) {
    console.error('League not found:', leagueId);
    return;
  }
  
  // Update page title
  document.getElementById('league-details-title').textContent = league.name;
  
  // Show the page
  showPage('league-details');
  
  // Load initial tab content
  switchLeagueTab('standings');
}

/**
 * Switch between league tabs
 * @param {string} tabName - Tab name (standings, races, live)
 */
function switchLeagueTab(tabName) {
  currentLeagueTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll('.league-tab').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    }
  });
  
  // Update tab panels
  document.querySelectorAll('.league-tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(`league-tab-${tabName}`).classList.add('active');
  
  // Load content based on tab
  switch(tabName) {
    case 'standings':
      loadLeagueStandings();
      break;
    case 'races':
      loadLeagueRaces();
      break;
    case 'live':
      loadLiveTiming();
      break;
  }
}

/**
 * Load championship standings
 */
async function loadLeagueStandings() {
  const container = document.getElementById('league-standings-content');
  container.innerHTML = '<div class="data-loading"><span class="spinner"></span> Loading standings…</div>';
  
  try {
    const response = await fetch(`${CONFIG.ASSETTO_API.STANDINGS}?championshipId=${CONFIG.ASSETTO_CHAMPIONSHIP_ID}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      container.innerHTML = `<div class="data-error">⚠ ${data.error}</div>`;
      return;
    }
    
    // Check if we have standings data
    if (!data.standings || data.standings.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏆</div>
          <div class="empty-state-text">No standings available yet</div>
        </div>
      `;
      return;
    }
    
    // Render standings table
    container.innerHTML = buildStandingsTable(data.standings);
  } catch (error) {
    console.error('Error loading standings:', error);
    container.innerHTML = '<div class="data-error">⚠ Failed to load standings. Please try again later.</div>';
  }
}

/**
 * Load race details list
 */
async function loadLeagueRaces() {
  const container = document.getElementById('league-races-content');
  container.innerHTML = '<div class="data-loading"><span class="spinner"></span> Loading races…</div>';
  
  try {
    const response = await fetch(CONFIG.ASSETTO_API.RESULTS);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      container.innerHTML = `<div class="data-error">⚠ ${data.error}</div>`;
      return;
    }
    
    // Check if we have results data
    if (!data.results || data.results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏁</div>
          <div class="empty-state-text">No races available yet</div>
        </div>
      `;
      return;
    }
    
    // Render race list
    container.innerHTML = buildRaceList(data.results);
  } catch (error) {
    console.error('Error loading races:', error);
    container.innerHTML = '<div class="data-error">⚠ Failed to load races. Please try again later.</div>';
  }
}

/**
 * Load live timing data
 */
async function loadLiveTiming() {
  const container = document.getElementById('league-live-content');
  container.innerHTML = '<div class="data-loading"><span class="spinner"></span> Loading live timings…</div>';
  
  try {
    const response = await fetch(CONFIG.ASSETTO_API.LIVE_BASIC);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      container.innerHTML = `<div class="data-error">⚠ ${data.error}</div>`;
      return;
    }
    
    // Check if session is active
    if (!data.sessionActive) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⏱️</div>
          <div class="empty-state-text">No active session</div>
        </div>
      `;
      return;
    }
    
    // Render live timing
    container.innerHTML = buildLiveTimingDisplay(data);
  } catch (error) {
    console.error('Error loading live timing:', error);
    container.innerHTML = '<div class="data-error">⚠ Failed to load live timing. Please try again later.</div>';
  }
}

/**
 * Build standings table HTML
 * @param {Array} standings - Array of standing entries
 * @returns {string} HTML string
 */
function buildStandingsTable(standings) {
  let html = '<div class="lb-table"><table><thead><tr>';
  html += '<th>Pos</th><th>Driver</th><th>Team</th><th>Points</th><th>Best Time</th>';
  html += '</tr></thead><tbody>';
  
  standings.forEach((entry, idx) => {
    const posClass = idx === 0 ? 'pos-1' : idx === 1 ? 'pos-2' : idx === 2 ? 'pos-3' : '';
    html += `<tr class="${posClass}">
      <td class="pos-cell">${idx + 1}</td>
      <td class="driver-cell">
        <div class="driver-name">${entry.driverName || 'Unknown Driver'}</div>
        ${entry.tag ? `<div class="driver-tag">${entry.tag}</div>` : ''}
      </td>
      <td class="team-cell">${entry.team || '-'}</td>
      <td class="pts-cell">${entry.points || 0}</td>
      <td class="time-cell">${entry.bestLap || '-'}</td>
    </tr>`;
  });
  
  html += '</tbody></table></div>';
  return html;
}

/**
 * Build race list HTML
 * @param {Array} results - Array of race results
 * @returns {string} HTML string
 */
function buildRaceList(results) {
  let html = '<div class="race-list">';
  
  results.forEach(race => {
    const raceDate = race.date ? new Date(race.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }) : 'Date TBA';
    
    html += `
      <div class="race-item" onclick="showRaceResults('${race.id}')">
        <div class="race-info">
          <div class="race-name">${race.name || 'Race ' + (results.indexOf(race) + 1)}</div>
          <div class="race-meta">${race.track || 'Track TBA'} • ${raceDate}</div>
        </div>
        <div class="race-arrow">→</div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

/**
 * Build live timing display HTML
 * @param {Object} data - Live timing data
 * @returns {string} HTML string
 */
function buildLiveTimingDisplay(data) {
  let html = `
    <div class="live-timing-header">
      <div class="live-status">
        <span class="live-indicator"></span>
        <span>LIVE</span>
      </div>
      <div class="session-info">
        ${data.sessionType || 'Session'} • ${data.track || 'Track'}
      </div>
    </div>
  `;
  
  html += '<div class="lb-table"><table><thead><tr>';
  html += '<th>Pos</th><th>Driver</th><th>Gap</th><th>Last Lap</th><th>Best Lap</th>';
  html += '</tr></thead><tbody>';
  
  if (data.entries && data.entries.length > 0) {
    data.entries.forEach(entry => {
      html += `<tr>
        <td class="pos-cell">${entry.position || '-'}</td>
        <td class="driver-cell">
          <div class="driver-name">${entry.driverName || 'Unknown'}</div>
        </td>
        <td class="gap-cell">${entry.gap || '-'}</td>
        <td class="time-cell">${entry.lastLap || '-'}</td>
        <td class="time-cell">${entry.bestLap || '-'}</td>
      </tr>`;
    });
  } else {
    html += '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem;">No timing data available</td></tr>';
  }
  
  html += '</tbody></table></div>';
  return html;
}

/**
 * Show race results (placeholder for future implementation)
 * @param {string} raceId - Race ID
 */
function showRaceResults(raceId) {
  console.log('Show results for race:', raceId);
  // TODO: Implement race results modal or detailed view
  alert('Race results view will be implemented in the next phase.\n\nRace ID: ' + raceId);
}


// Made with Bob
