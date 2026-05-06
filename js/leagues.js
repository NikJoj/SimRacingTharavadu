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
          <div class="league-actions">
            <button class="view-lb-btn" onclick="showLeagueDetails('${l.id}')">View Details →</button>
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
function showLeagueDetails(leagueId) {
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
  
  // Load initial tab content - default to signup tab
  switchLeagueTab('signup');
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
    case 'signup':
      loadSignupIframe();
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
    // Get the current league
    const league = appLeagues.find(l => l.id === currentLeagueId);
    
    if (!league) {
      throw new Error('League not found');
    }
    
    // Check if league has a championship ID configured
    if (!league.championshipId) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏆</div>
          <div class="empty-state-text">No championship configured for this league</div>
        </div>
      `;
      return;
    }
    
    const response = await fetch(`${CONFIG.ASSETTO_API.STANDINGS}?championshipId=${league.championshipId}`);
    
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
    // Get the current league
    const league = appLeagues.find(l => l.id === currentLeagueId);
    
    if (!league) {
      throw new Error('League not found');
    }
    
    // Check if league has a blob store configured
    if (league.blobStore) {
      // Fetch from blob store
      const response = await fetch(`/api/get-stored-result?league=${encodeURIComponent(league.blobStore)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        container.innerHTML = `<div class="data-error">⚠ ${data.error}</div>`;
        return;
      }
      
      // Check if we have races data
      if (!data.races || data.races.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🏁</div>
            <div class="empty-state-text">No races available yet</div>
          </div>
        `;
        return;
      }
      
      // Render race list from blob store
      container.innerHTML = buildRaceListFromBlobStore(data.races, league.blobStore);
    } else {
      // Fallback to Assetto API
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
      
      // Render race list from Assetto API
      container.innerHTML = buildRaceList(data.results);
    }
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
 * @param {Array} results - Array of race results from API
 * @returns {string} HTML string
 */
function buildRaceList(results) {
  let html = '<div class="race-list">';
  
  results.forEach((race, index) => {
    // Format track name (convert underscore to space and capitalize)
    const trackName = race.track ? race.track.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Track';
    
    // Format date and time
    const raceDate = race.date ? new Date(race.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : 'Date TBA';
    
    const raceTime = race.date ? new Date(race.date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) : '';
    
    // Format session type
    const sessionType = race.session_type || 'Session';
    
    // Create a unique ID from the results page URL or use index
    const raceId = race.results_page_url || `race-${index}`;
    
    html += `
      <div class="race-item" onclick="showRaceResults('${raceId}')">
        <div class="race-item-content">
          <div class="race-item-main">
            <div class="race-name">${trackName}</div>
            <div class="race-track">${sessionType}</div>
            <div class="race-details">
              <div class="race-detail-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>${raceDate}</span>
              </div>
              ${raceTime ? `
                <div class="race-detail-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>${raceTime}</span>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="race-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

/**
 * Build race list HTML from blob store data
 * @param {Array} races - Array of race metadata from blob store
 * @param {string} blobStore - Blob store name
 * @returns {string} HTML string
 */
function buildRaceListFromBlobStore(races, blobStore) {
  let html = '<div class="race-list">';
  
  races.forEach((race) => {
    // Format track name (convert underscore to space and capitalize)
    const trackName = race.track ? race.track.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Track';
    
    // Format date and time
    const raceDate = race.date ? new Date(race.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : 'Date TBA';
    
    const raceTime = race.date ? new Date(race.date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) : '';
    
    // Format session type
    const sessionType = race.session_type || 'Session';
    
    // Create race identifier for blob store
    const raceId = `blob:${blobStore}:${race.timestamp}`;
    
    html += `
      <div class="race-item" onclick="showRaceResults('${raceId}')">
        <div class="race-item-content">
          <div class="race-item-main">
            <div class="race-name">${trackName}</div>
            <div class="race-track">${sessionType}</div>
            <div class="race-details">
              <div class="race-detail-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>${raceDate}</span>
              </div>
              ${raceTime ? `
                <div class="race-detail-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>${raceTime}</span>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="race-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>
        </div>
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
 * Show race results detail page
 * @param {string} resultsUrl - URL or path to the race results JSON, or blob store identifier
 */
async function showRaceResults(resultsUrl) {
  console.log('Loading race results from:', resultsUrl);
  
  // Show the race results page
  showPage('race-results');
  
  const container = document.getElementById('race-results-content');
  container.innerHTML = '<div class="data-loading"><span class="spinner"></span> Loading race results…</div>';
  
  try {
    let apiUrl = resultsUrl;
    
    // Check if it's a blob store identifier (format: blob:storeName:timestamp)
    if (resultsUrl.startsWith('blob:')) {
      const parts = resultsUrl.split(':');
      if (parts.length === 3) {
        const blobStore = parts[1];
        const timestamp = parts[2];
        
        // Use blob store API endpoint
        apiUrl = `/api/get-stored-result?league=${encodeURIComponent(blobStore)}&timestamp=${encodeURIComponent(timestamp)}`;
        console.log('Using blob store API:', apiUrl);
        
        // Fetch from blob store
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // Extract the actual race data
        const data = result.data;
        
        // Update page title and metadata
        updateRaceResultsHeader(data);
        
        // Render race results
        container.innerHTML = buildRaceResultsDisplay(data);
        return;
      }
    }
    
    // Check if it's a relative path from Assetto API (e.g., /results/2026_4_29_10_38_RACE)
    if (resultsUrl.startsWith('/results/')) {
      // Extract filename and add .json extension if not present
      const filename = resultsUrl.replace('/results/', '');
      const jsonFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
      
      // Use our proxy API endpoint
      apiUrl = `${CONFIG.ASSETTO_API.RACE_RESULT}?file=${encodeURIComponent(jsonFilename)}`;
      console.log('Using proxy API:', apiUrl);
    }
    
    // Fetch the race results JSON
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Update page title and metadata
    updateRaceResultsHeader(data);
    
    // Render race results
    container.innerHTML = buildRaceResultsDisplay(data);
  } catch (error) {
    console.error('Error loading race results:', error);
    container.innerHTML = '<div class="data-error">⚠ Failed to load race results. Please try again later.</div>';
  }
}

/**
 * Update race results header with metadata
 * @param {Object} data - Race results data
 */
function updateRaceResultsHeader(data) {
  // Update title
  const trackName = data.TrackName ? data.TrackName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Track';
  const trackConfig = data.TrackConfig ? ` (${data.TrackConfig})` : '';
  document.getElementById('race-results-title').textContent = `${trackName}${trackConfig}`;
  
  // Build metadata
  const metaContainer = document.getElementById('race-results-meta');
  const sessionType = data.Type || 'Race';
  const date = data.Date ? new Date(data.Date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'N/A';
  
  const totalLaps = data.Laps ? data.Laps.length : 0;
  const totalDrivers = data.Result ? data.Result.length : 0;
  
  metaContainer.innerHTML = `
    <div class="race-meta-item">
      <div class="race-meta-label">Session Type</div>
      <div class="race-meta-value">${sessionType}</div>
    </div>
    <div class="race-meta-item">
      <div class="race-meta-label">Date</div>
      <div class="race-meta-value">${date}</div>
    </div>
    <div class="race-meta-item">
      <div class="race-meta-label">Total Laps</div>
      <div class="race-meta-value">${totalLaps}</div>
    </div>
    <div class="race-meta-item">
      <div class="race-meta-label">Drivers</div>
      <div class="race-meta-value">${totalDrivers}</div>
    </div>
  `;
}

/**
 * Build race results display HTML
 * @param {Object} data - Race results data
 * @returns {string} HTML string
 */
function buildRaceResultsDisplay(data) {
  let html = '<div class="lb-body">';
  
  // Podium (Top 3)
  if (data.Result && data.Result.length > 0) {
    html += '<div class="race-results-section">';
    html += '<h3 class="race-results-section-title">🏆 PODIUM</h3>';
    html += '<div class="podium-display">';
    
    const podium = data.Result.slice(0, 3);
    podium.forEach((driver, index) => {
      const position = index + 1;
      const posClass = `p${position}`;
      const carModel = driver.CarModel ? driver.CarModel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Car';
      const bestLap = driver.BestLap ? formatLapTime(driver.BestLap) : 'N/A';
      const totalTime = driver.TotalTime ? formatLapTime(driver.TotalTime) : 'N/A';
      
      html += `
        <div class="podium-card ${posClass}">
          <div class="podium-position">${getPositionSuffix(position)}</div>
          <div class="podium-driver">${driver.DriverName || 'Unknown Driver'}</div>
          <div class="podium-car">${carModel}</div>
          <div class="podium-stats">
            <div class="podium-stat">
              <span class="podium-stat-label">Best Lap</span>
              <span class="podium-stat-value">${bestLap}</span>
            </div>
            <div class="podium-stat">
              <span class="podium-stat-label">Total Time</span>
              <span class="podium-stat-value">${totalTime}</span>
            </div>
            <div class="podium-stat">
              <span class="podium-stat-label">Laps</span>
              <span class="podium-stat-value">${driver.NumLaps || 0}</span>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div></div>';
  }
  
  // Fastest Lap
  if (data.Result && data.Result.length > 0) {
    const fastestDriver = data.Result.reduce((prev, current) => {
      return (prev.BestLap && current.BestLap && prev.BestLap < current.BestLap) ? prev : current;
    });
    
    if (fastestDriver && fastestDriver.BestLap) {
      html += `
        <div class="fastest-lap-highlight">
          <div class="fastest-lap-info">
            <div class="fastest-lap-label">⚡ FASTEST LAP</div>
            <div class="fastest-lap-driver">${fastestDriver.DriverName || 'Unknown Driver'}</div>
          </div>
          <div class="fastest-lap-time">${formatLapTime(fastestDriver.BestLap)}</div>
        </div>
      `;
    }
  }
  
  // Full Results Table
  if (data.Result && data.Result.length > 0) {
    html += '<div class="race-results-section">';
    html += '<h3 class="race-results-section-title">📊 FULL RESULTS</h3>';
    html += '<table class="lb-table"><thead><tr>';
    html += '<th>Pos</th><th>Driver</th><th>Car</th><th>Laps</th><th>Best Lap</th><th>Total Time</th>';
    html += '</tr></thead><tbody>';
    
    data.Result.forEach((driver, index) => {
      const posClass = index === 0 ? 'pos-1' : index === 1 ? 'pos-2' : index === 2 ? 'pos-3' : '';
      const carModel = driver.CarModel ? driver.CarModel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Car';
      const bestLap = driver.BestLap ? formatLapTime(driver.BestLap) : 'N/A';
      const totalTime = driver.TotalTime ? formatLapTime(driver.TotalTime) : 'N/A';
      
      html += `<tr class="${posClass}">
        <td class="pos-cell">${index + 1}</td>
        <td class="driver-cell">
          <div class="driver-name">${driver.DriverName || 'Unknown Driver'}</div>
        </td>
        <td class="team-cell">${carModel}</td>
        <td class="pts-cell">${driver.NumLaps || 0}</td>
        <td class="time-cell">${bestLap}</td>
        <td class="time-cell">${totalTime}</td>
      </tr>`;
    });
    
    html += '</tbody></table></div>';
  }
  
  // Penalties Section
  if (data.Penalties && data.Penalties.length > 0) {
    html += '<div class="race-results-section">';
    html += '<h3 class="race-results-section-title">⚠️ PENALTIES</h3>';
    html += '<table class="lb-table"><thead><tr>';
    html += '<th>Driver</th><th>Lap</th><th>Infraction</th><th>Penalty</th><th>Details</th>';
    html += '</tr></thead><tbody>';
    
    data.Penalties.forEach(penalty => {
      const infractionType = getPenaltyInfractionType(penalty.InfractionType);
      const penaltyType = getPenaltyType(penalty.PenaltyType);
      const details = getPenaltyDetails(penalty);
      
      html += `<tr>
        <td class="driver-cell">
          <div class="driver-name">${penalty.DriverName || 'Unknown Driver'}</div>
        </td>
        <td class="pts-cell">${penalty.GivenOnLap || '-'}</td>
        <td class="team-cell">${infractionType}</td>
        <td class="team-cell">${penaltyType}</td>
        <td class="time-cell">${details}</td>
      </tr>`;
    });
    
    html += '</tbody></table></div>';
  }
  
  html += '</div>'; // Close lb-body
  return html;
}

/**
 * Format lap time from milliseconds to MM:SS.mmm
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string
 */
function formatLapTime(ms) {
  if (!ms || ms === 0) return 'N/A';
  
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Get position suffix (1st, 2nd, 3rd, etc.)
 * @param {number} position - Position number
 * @returns {string} Position with suffix
 */
function getPositionSuffix(position) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = position % 100;
  return position + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

/**
 * Get penalty infraction type description
 * @param {number} type - Infraction type code
 * @returns {string} Infraction description
 */
function getPenaltyInfractionType(type) {
  const types = {
    0: 'Track Limits',
    1: 'Cutting',
    2: 'Speeding',
    3: 'Pit Lane',
    4: 'False Start',
    5: 'Ignoring Blue Flags',
    6: 'Causing Collision',
    7: 'Illegal Overtake',
    8: 'Illegal Blocking',
    9: 'Unsafe Rejoin',
    10: 'Ignoring Penalties'
  };
  return types[type] || `Infraction ${type}`;
}

/**
 * Get penalty type description
 * @param {number} type - Penalty type code
 * @returns {string} Penalty description
 */
function getPenaltyType(type) {
  const types = {
    0: 'Warning',
    1: 'Disqualification',
    2: 'Time Penalty',
    3: 'Mandatory Pit Stop',
    4: 'Drive Through',
    5: 'Stop & Go',
    6: 'Post-Race Time Penalty',
    7: 'BoP Adjustment'
  };
  return types[type] || `Penalty ${type}`;
}

/**
 * Get penalty details
 * @param {Object} penalty - Penalty object
 * @returns {string} Penalty details
 */
function getPenaltyDetails(penalty) {
  const details = [];
  
  if (penalty.TimePenaltyDuration && penalty.TimePenaltyDuration > 0) {
    const seconds = Math.floor(penalty.TimePenaltyDuration / 1000000000);
    details.push(`+${seconds}s`);
  }
  
  if (penalty.DriveThroughNumLaps && penalty.DriveThroughNumLaps > 0) {
    details.push(`${penalty.DriveThroughNumLaps} lap(s)`);
  }
  
  if (penalty.BoPAmount && penalty.BoPAmount !== 0) {
    details.push(`BoP: ${penalty.BoPAmount > 0 ? '+' : ''}${penalty.BoPAmount}`);
  }
  
  if (penalty.BoPClearedInNumLaps && penalty.BoPClearedInNumLaps > 0) {
    details.push(`Cleared in ${penalty.BoPClearedInNumLaps} lap(s)`);
  }
  
  return details.length > 0 ? details.join(', ') : '-';
}

/**
 * Go back to races tab in league details
 */
function backToRaces() {
  showPage('league-details');
  switchLeagueTab('races');
}

/**
 * Load signup iframe with championship registration page
 */
function loadSignupIframe() {
  const iframe = document.getElementById('signup-iframe');
  
  if (!iframe) {
    console.error('Signup iframe not found');
    return;
  }
  
  // Get the current league
  const league = appLeagues.find(l => l.id === currentLeagueId);
  
  if (!league) {
    console.error('League not found');
    return;
  }
  
  // Check if league has a championship ID configured
  if (!league.championshipId) {
    iframe.srcdoc = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;font-family:system-ui;color:#666;">
        <div style="text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">🏆</div>
          <div>No championship configured for this league</div>
        </div>
      </div>
    `;
    return;
  }
  
  // Build the signup URL using the league's championship ID
  const signupUrl = `https://sg.assettohosting.com:10027/championship/${league.championshipId}`;
  
  // Set the iframe source
  iframe.src = signupUrl;
  
  console.log('Loading signup page:', signupUrl);
}


// Made with Bob
