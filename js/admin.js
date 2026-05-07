/* ═══════════════════════════════════════════════════
   ADMIN DASHBOARD - Main JavaScript
   ═══════════════════════════════════════════════════ */

// Global state
let adminData = {
  events: [],
  leagues: [],
  registrations: [],
  syncHistory: []
};

/**
 * Show loading overlay
 */
function showLoading(message = 'Processing...') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">${message}</div>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('.loading-text').textContent = message;
  }
  overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Check authentication on page load
window.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

/**
 * Check if user is authenticated
 */
async function checkAuth() {
  const token = localStorage.getItem('srt_admin_token');
  const username = localStorage.getItem('srt_admin_username');
  const expires = localStorage.getItem('srt_admin_expires');

  if (!token || !username || !expires) {
    redirectToLogin();
    return;
  }

  // Check if token expired
  if (Date.now() > parseInt(expires)) {
    showToast('Session expired. Please login again.', 'error');
    redirectToLogin();
    return;
  }

  // Validate token with server
  try {
    const response = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate', token })
    });

    const data = await response.json();

    if (!response.ok || !data.valid) {
      redirectToLogin();
      return;
    }

    // Set username in sidebar
    document.getElementById('admin-username').textContent = username;

    // Load initial data
    await loadAllData();

  } catch (error) {
    console.error('Auth check failed:', error);
    redirectToLogin();
  }
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
  localStorage.removeItem('srt_admin_token');
  localStorage.removeItem('srt_admin_username');
  localStorage.removeItem('srt_admin_expires');
  window.location.href = 'login.html';
}

/**
 * Logout user
 */
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    redirectToLogin();
  }
}

/**
 * Load all data
 */
async function loadAllData() {
  try {
    // Load events from Google Sheets
    await loadEvents();
    
    // Load leagues from Google Sheets
    await loadLeagues();
    
    // Load registrations
    await loadRegistrations();
    
    // Load sync history
    await loadSyncHistory();
    
    // Update dashboard stats
    updateDashboardStats();
    
    // Load recent activity
    loadRecentActivity();

  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Failed to load data', 'error');
  }
}

/**
 * Load events from Google Sheets
 */
async function loadEvents() {
  try {
    if (CONFIG.DEMO_MODE) {
      adminData.events = DEMO_EVENTS;
    } else {
      const response = await fetch(CONFIG.EVENTS_SHEET_URL);
      const text = await response.text();
      const json = JSON.parse(text.substring(47).slice(0, -2));
      
      const cols = ['id','name','sim','status','track','startDate','endDate','format','drivers','maxDrivers','rounds','season','description','trackMod','carMod','practiceServer','carOptions'];
      adminData.events = json.table.rows
        .map(row => {
          const obj = {};
          cols.forEach((c, i) => obj[c] = row.c[i]?.v?.toString() ?? '');
          return obj;
        })
        .filter(r => Object.values(r).some(v => v));
    }
    
    renderEventsTable();
  } catch (error) {
    console.error('Error loading events:', error);
    document.getElementById('events-table').innerHTML = '<div class="loading">Failed to load events</div>';
  }
}

/**
 * Load leagues from Google Sheets
 */
async function loadLeagues() {
  try {
    if (CONFIG.DEMO_MODE) {
      adminData.leagues = DEMO_LEAGUES;
    } else {
      const response = await fetch(CONFIG.LEAGUES_SHEET_URL);
      const text = await response.text();
      const json = JSON.parse(text.substring(47).slice(0, -2));
      
      const cols = ['id','name','sim','status','startDate','endDate','format','season','championshipId','blobStore'];
      adminData.leagues = json.table.rows
        .map(row => {
          const obj = {};
          cols.forEach((c, i) => obj[c] = row.c[i]?.v?.toString() ?? '');
          return obj;
        })
        .filter(r => Object.values(r).some(v => v));
    }
    
    renderLeaguesTable();
    populateSyncLeagueSelect();
    populateUpdateRacesLeagueSelect();
  } catch (error) {
    console.error('Error loading leagues:', error);
    document.getElementById('leagues-table').innerHTML = '<div class="loading">Failed to load leagues</div>';
  }
}

/**
 * Load registrations from Google Sheets
 */
async function loadRegistrations() {
  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL + '?action=getRegistrations');
    const data = await response.json();
    
    if (data.status === 'ok') {
      // Map the data to match expected field names
      adminData.registrations = (data.registrations || []).map(reg => ({
        timestamp: reg.Timestamp || reg.timestamp || reg.A || '',
        driverTag: reg.driverTag || reg['Driver Tag'] || reg.B || '',
        discord: reg.discord || reg.Discord || reg.C || '',
        carClass: reg.carClass || reg['Car Class'] || reg.D || '',
        event: reg.event || reg.Event || reg.E || '',
        league: reg.league || reg.League || ''
      }));
    } else {
      adminData.registrations = [];
    }
    
    renderRegistrationsTable();
    populateRegFilter();
  } catch (error) {
    console.error('Error loading registrations:', error);
    document.getElementById('registrations-table').innerHTML = '<div class="loading">Failed to load registrations</div>';
  }
}

/**
 * Load sync history from blob store
 */
async function loadSyncHistory() {
  try {
    const response = await fetch('/api/get-stored-result?list=leagues');
    const data = await response.json();
    
    if (data.success && data.leagues) {
      adminData.syncHistory = [];
      
      // Load races for each league
      for (const league of data.leagues) {
        const racesResponse = await fetch(`/api/get-stored-result?league=${league}`);
        const racesData = await racesResponse.json();
        
        if (racesData.success && racesData.races) {
          adminData.syncHistory.push(...racesData.races.map(r => ({
            ...r,
            league
          })));
        }
      }
    }
    
    renderSyncHistory();
  } catch (error) {
    console.error('Error loading sync history:', error);
    document.getElementById('sync-history').innerHTML = '<div class="loading">Failed to load sync history</div>';
  }
}

/**
 * Update dashboard statistics
 */
function updateDashboardStats() {
  document.getElementById('stat-events').textContent = adminData.events.length;
  document.getElementById('stat-leagues').textContent = adminData.leagues.filter(l => l.status === 'ongoing' || l.status === 'upcoming').length;
  document.getElementById('stat-registrations').textContent = adminData.registrations.length;
  document.getElementById('stat-syncs').textContent = adminData.syncHistory.length;
}

/**
 * Load recent activity
 */
function loadRecentActivity() {
  const activities = [];
  
  // Recent registrations
  const recentRegs = adminData.registrations.slice(-5).reverse();
  recentRegs.forEach(reg => {
    activities.push({
      text: `New registration: ${reg.driverTag} for ${reg.event || reg.league}`,
      time: reg.timestamp
    });
  });
  
  // Recent syncs
  const recentSyncs = adminData.syncHistory.slice(-3).reverse();
  recentSyncs.forEach(sync => {
    activities.push({
      text: `Race synced: ${sync.track} (${sync.league})`,
      time: sync.date
    });
  });
  
  // Sort by time
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  
  const html = activities.length > 0
    ? activities.slice(0, 8).map(a => `
        <div class="activity-item">
          ${a.text}
          <div style="font-size:0.75rem;color:var(--muted);margin-top:0.25rem;">
            ${formatDate(a.time)}
          </div>
        </div>
      `).join('')
    : '<div class="activity-item">No recent activity</div>';
  
  document.getElementById('recent-activity').innerHTML = html;
}

/**
 * Show section
 */
function showSection(sectionName) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  event.target.closest('.nav-item')?.classList.add('active');
  
  // Update sections
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(`section-${sectionName}`)?.classList.add('active');
  
  // Update title
  const titles = {
    'dashboard': 'Dashboard',
    'events': 'Events Management',
    'leagues': 'Leagues Management',
    'registrations': 'Registrations',
    'race-sync': 'Race Result Sync'
  };
  document.getElementById('page-title').textContent = titles[sectionName] || 'Dashboard';
  
  // Populate dropdowns when switching to race-sync section
  if (sectionName === 'race-sync') {
    populateSyncLeagueSelect();
    populateUpdateRacesLeagueSelect();
  }
}

/**
 * Render events table
 */
function renderEventsTable() {
  const html = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Sim</th>
            <th>Status</th>
            <th>Date</th>
            <th>Drivers</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${adminData.events.map(event => `
            <tr>
              <td><strong>${event.name}</strong></td>
              <td>${event.sim}</td>
              <td><span class="status-badge status-${event.status}">${event.status}</span></td>
              <td>${formatDate(event.startDate)}</td>
              <td>${event.drivers}/${event.maxDrivers}</td>
              <td>
                <div class="table-actions">
                  <button class="btn-icon" onclick="editEvent('${event.id}')" title="Edit">✏️</button>
                  <button class="btn-icon" onclick="deleteEvent('${event.id}')" title="Delete">🗑️</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('events-table').innerHTML = html;
}

/**
 * Render leagues table
 */
function renderLeaguesTable() {
  const html = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Sim</th>
            <th>Status</th>
            <th>Season</th>
            <th>Blob Store</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${adminData.leagues.map(league => `
            <tr>
              <td><strong>${league.name}</strong></td>
              <td>${league.sim}</td>
              <td><span class="status-badge status-${league.status}">${league.status}</span></td>
              <td>${league.season}</td>
              <td><code>${league.blobStore || 'N/A'}</code></td>
              <td>
                <div class="table-actions">
                  <button class="btn-icon" onclick="editLeague('${league.id}')" title="Edit">✏️</button>
                  <button class="btn-icon" onclick="deleteLeague('${league.id}')" title="Delete">🗑️</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('leagues-table').innerHTML = html;
}

/**
 * Render registrations table
 */
function renderRegistrationsTable() {
  const html = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Discord</th>
            <th>Event/League</th>
            <th>Car</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${adminData.registrations.map((reg, idx) => `
            <tr>
              <td><strong>${reg.driverTag}</strong></td>
              <td>${reg.discord}</td>
              <td>${reg.event || reg.league}</td>
              <td>${reg.carClass}</td>
              <td>${formatDate(reg.timestamp)}</td>
              <td>
                <div class="table-actions">
                  <button class="btn-icon" onclick="editRegistration(${idx})" title="Edit">✏️</button>
                  <button class="btn-icon" onclick="deleteRegistration(${idx})" title="Delete">🗑️</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('registrations-table').innerHTML = html || '<div class="loading">No registrations found</div>';
}

/**
 * Render sync history
 */
function renderSyncHistory() {
  const html = adminData.syncHistory.length > 0
    ? adminData.syncHistory.slice(0, 10).map(sync => `
        <div class="sync-item">
          <div class="sync-item-header">
            <span>${sync.track}</span>
            <span>${sync.league}</span>
          </div>
          <div class="sync-item-meta">
            ${formatDate(sync.date)} • ${sync.session_type}
          </div>
        </div>
      `).join('')
    : '<div class="loading">No sync history found</div>';
  
  document.getElementById('sync-history').innerHTML = html;
}

/**
 * Populate sync league select
 */
function populateSyncLeagueSelect() {
  const select = document.getElementById('sync-league');
  const options = adminData.leagues
    .filter(l => l.blobStore)
    .map(l => `<option value="${l.blobStore}">${l.name}</option>`)
    .join('');
  
  select.innerHTML = '<option value="">-- Select League --</option>' + options;
}

/**
 * Populate registration filter
 */
function populateRegFilter() {
  const select = document.getElementById('reg-filter');
  const events = adminData.events.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
  const leagues = adminData.leagues.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
  
  select.innerHTML = '<option value="">All Events/Leagues</option>' + events + leagues;
}

/**
 * Sync race result
 */
async function syncRaceResult() {
  const league = document.getElementById('sync-league').value;
  
  if (!league) {
    showToast('Please select a league', 'error');
    return;
  }
  
  const statusEl = document.getElementById('sync-status');
  statusEl.className = 'status-message loading show';
  statusEl.textContent = '🔄 Syncing race result...';
  
  try {
    const response = await fetch(`/api/store-latest-result?league=${league}`);
    const data = await response.json();
    
    if (data.success) {
      statusEl.className = 'status-message success show';
      statusEl.innerHTML = `✓ Race synced successfully!<br><small>${data.metadata.track} • ${formatDate(data.metadata.date)}</small>`;
      
      // Reload sync history
      await loadSyncHistory();
      updateDashboardStats();
      
      showToast('Race result synced successfully', 'success');
    } else {
      statusEl.className = 'status-message error show';
      statusEl.textContent = `⚠ ${data.error || 'Sync failed'}`;
      showToast('Sync failed', 'error');
    }
  } catch (error) {
    statusEl.className = 'status-message error show';
    statusEl.textContent = `⚠ ${error.message}`;
    showToast('Sync failed', 'error');
  }
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 5000);
}

/**
 * Global variable to store fetched races
 */
let availableRaces = [];

/**
 * Populate update races league select
 */
function populateUpdateRacesLeagueSelect() {
  const select = document.getElementById('update-races-league');
  const options = adminData.leagues
    .filter(l => l.blobStore)
    .map(l => `<option value="${l.blobStore}">${l.name}</option>`)
    .join('');
  
  select.innerHTML = '<option value="">-- Select League --</option>' + options;
}

/**
 * Fetch available races from Assetto Corsa API
 */
async function fetchAvailableRaces() {
  const league = document.getElementById('update-races-league').value;
  
  if (!league) {
    showToast('Please select a league', 'error');
    return;
  }
  
  const statusEl = document.getElementById('update-races-status');
  statusEl.className = 'status-message loading show';
  statusEl.textContent = '🔄 Fetching available races...';
  
  try {
    const response = await fetch('/api/fetch-races');
    const data = await response.json();
    
    if (data.success && data.races) {
      availableRaces = data.races;
      renderRacesList(data.races);
      
      document.getElementById('races-list-container').style.display = 'block';
      
      statusEl.className = 'status-message success show';
      statusEl.textContent = `✓ Found ${data.races.length} races`;
      
      setTimeout(() => {
        statusEl.classList.remove('show');
      }, 3000);
      
      showToast(`Found ${data.races.length} races`, 'success');
    } else {
      statusEl.className = 'status-message error show';
      statusEl.textContent = `⚠ ${data.error || 'Failed to fetch races'}`;
      showToast('Failed to fetch races', 'error');
    }
  } catch (error) {
    statusEl.className = 'status-message error show';
    statusEl.textContent = `⚠ ${error.message}`;
    showToast('Failed to fetch races', 'error');
  }
}

/**
 * Render races list with checkboxes
 */
function renderRacesList(races) {
  const container = document.getElementById('races-list');
  
  if (!races || races.length === 0) {
    container.innerHTML = '<div class="loading">No races found</div>';
    return;
  }
  
  const html = races.map((race, index) => `
    <div class="race-item" onclick="toggleRaceSelection(${index})">
      <input type="checkbox"
             class="race-checkbox"
             id="race-${index}"
             data-index="${index}">
      <div class="race-info">
        <div class="race-track">${race.track}</div>
        <div class="race-date">${formatDate(race.date)}</div>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = html;
  updateSelectedCount();
}

/**
 * Toggle race selection
 */
function toggleRaceSelection(index) {
  const checkbox = document.getElementById(`race-${index}`);
  checkbox.checked = !checkbox.checked;
  
  const raceItem = checkbox.closest('.race-item');
  if (checkbox.checked) {
    raceItem.classList.add('selected');
  } else {
    raceItem.classList.remove('selected');
  }
  
  updateSelectedCount();
}

/**
 * Select all races
 */
function selectAllRaces() {
  const checkboxes = document.querySelectorAll('.race-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = true;
    cb.closest('.race-item').classList.add('selected');
  });
  updateSelectedCount();
}

/**
 * Deselect all races
 */
function deselectAllRaces() {
  const checkboxes = document.querySelectorAll('.race-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = false;
    cb.closest('.race-item').classList.remove('selected');
  });
  updateSelectedCount();
}

/**
 * Update selected count and enable/disable sync button
 */
function updateSelectedCount() {
  const checkboxes = document.querySelectorAll('.race-checkbox:checked');
  const count = checkboxes.length;
  
  document.getElementById('selected-count').textContent = `${count} race${count !== 1 ? 's' : ''} selected`;
  document.getElementById('sync-selected-btn').disabled = count === 0;
}

/**
 * Sync selected races
 */
async function syncSelectedRaces() {
  const league = document.getElementById('update-races-league').value;
  
  if (!league) {
    showToast('Please select a league', 'error');
    return;
  }
  
  const checkboxes = document.querySelectorAll('.race-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast('Please select at least one race', 'error');
    return;
  }
  
  const selectedRaces = Array.from(checkboxes).map(cb => {
    const index = parseInt(cb.dataset.index);
    return availableRaces[index];
  });
  
  const statusEl = document.getElementById('update-races-status');
  statusEl.className = 'status-message loading show';
  statusEl.textContent = `🔄 Syncing ${selectedRaces.length} race${selectedRaces.length !== 1 ? 's' : ''}...`;
  
  showLoading();
  
  try {
    const response = await fetch('/api/sync-selected-races', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        league: league,
        races: selectedRaces
      })
    });
    
    const data = await response.json();
    
    hideLoading();
    
    if (data.success) {
      const successCount = data.results.success.length;
      const failedCount = data.results.failed.length;
      
      statusEl.className = 'status-message success show';
      statusEl.innerHTML = `✓ Successfully synced ${successCount} race${successCount !== 1 ? 's' : ''}!${failedCount > 0 ? `<br><small>Failed: ${failedCount}</small>` : ''}`;
      
      // Reload sync history
      await loadSyncHistory();
      updateDashboardStats();
      
      showToast(`Synced ${successCount} race${successCount !== 1 ? 's' : ''} successfully`, 'success');
      
      // Clear selections
      deselectAllRaces();
    } else {
      statusEl.className = 'status-message error show';
      statusEl.textContent = `⚠ ${data.error || 'Sync failed'}`;
      showToast('Sync failed', 'error');
    }
  } catch (error) {
    hideLoading();
    statusEl.className = 'status-message error show';
    statusEl.textContent = `⚠ ${error.message}`;
    showToast('Sync failed', 'error');
  }
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 5000);
}

/**
 * Open create/edit modal
 */
function openCreateModal(type) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  
  if (type === 'event') {
    title.textContent = 'Create Event';
    body.innerHTML = getEventForm();
  } else if (type === 'league') {
    title.textContent = 'Create League';
    body.innerHTML = getLeagueForm();
  }
  
  modal.style.display = 'flex';
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

/**
 * Get event form HTML
 */
function getEventForm(event = null) {
  return `
    <form class="modal-form" onsubmit="saveEvent(event); return false;">
      ${event ? `<input type="hidden" id="event-id" value="${event.id}">` : ''}
      <div class="form-group">
        <label>Event Name *</label>
        <input type="text" class="form-control" id="event-name" value="${event?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Simulator *</label>
        <input type="text" class="form-control" id="event-sim" value="${event?.sim || ''}" required>
      </div>
      <div class="form-group">
        <label>Status *</label>
        <select class="form-control" id="event-status" required>
          <option value="upcoming" ${event?.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
          <option value="ongoing" ${event?.status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
          <option value="closed" ${event?.status === 'closed' ? 'selected' : ''}>Closed</option>
        </select>
      </div>
      <div class="form-group">
        <label>Track *</label>
        <input type="text" class="form-control" id="event-track" value="${event?.track || ''}" required>
      </div>
      <div class="form-group">
        <label>Start Date *</label>
        <input type="datetime-local" class="form-control" id="event-start" value="${event?.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : ''}" required>
      </div>
      <div class="form-group">
        <label>End Date *</label>
        <input type="datetime-local" class="form-control" id="event-end" value="${event?.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : ''}" required>
      </div>
      <div class="form-group">
        <label>Format *</label>
        <input type="text" class="form-control" id="event-format" value="${event?.format || ''}" required>
      </div>
      <div class="form-group">
        <label>Max Drivers *</label>
        <input type="number" class="form-control" id="event-max" value="${event?.maxDrivers || '30'}" required>
      </div>
      <div class="form-group">
        <label>Car Options (comma-separated)</label>
        <input type="text" class="form-control" id="event-cars" value="${event?.carOptions || ''}" placeholder="GT3, GT4, LMP2">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="form-control" id="event-desc" rows="3">${event?.description || ''}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save Event</button>
      </div>
    </form>
  `;
}

/**
 * Get league form HTML
 */
function getLeagueForm(league = null) {
  return `
    <form class="modal-form" onsubmit="saveLeague(event); return false;">
      ${league ? `<input type="hidden" id="league-id" value="${league.id}">` : ''}
      <div class="form-group">
        <label>League Name *</label>
        <input type="text" class="form-control" id="league-name" value="${league?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Simulator *</label>
        <input type="text" class="form-control" id="league-sim" value="${league?.sim || ''}" required>
      </div>
      <div class="form-group">
        <label>Status *</label>
        <select class="form-control" id="league-status" required>
          <option value="upcoming" ${league?.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
          <option value="ongoing" ${league?.status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
          <option value="closed" ${league?.status === 'closed' ? 'selected' : ''}>Closed</option>
        </select>
      </div>
      <div class="form-group">
        <label>Season *</label>
        <input type="text" class="form-control" id="league-season" value="${league?.season || '2026'}" required>
      </div>
      <div class="form-group">
        <label>Championship ID</label>
        <input type="text" class="form-control" id="league-champ" value="${league?.championshipId || ''}" placeholder="UUID from Assetto API">
      </div>
      <div class="form-group">
        <label>Blob Store Folder *</label>
        <input type="text" class="form-control" id="league-blob" value="${league?.blobStore || ''}" placeholder="SRT-GT3-Season-1" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save League</button>
      </div>
    </form>
  `;
}

/**
 * Save event (create or update)
 */
async function saveEvent(e) {
  e.preventDefault();
  
  const eventData = {
    name: document.getElementById('event-name').value,
    sim: document.getElementById('event-sim').value,
    status: document.getElementById('event-status').value,
    track: document.getElementById('event-track').value,
    startDate: new Date(document.getElementById('event-start').value).toISOString(),
    endDate: new Date(document.getElementById('event-end').value).toISOString(),
    format: document.getElementById('event-format').value,
    maxDrivers: document.getElementById('event-max').value,
    carOptions: document.getElementById('event-cars').value,
    description: document.getElementById('event-desc').value
  };

  // Check if editing (has id) or creating new
  const eventId = document.getElementById('event-id')?.value;
  const action = eventId ? 'updateEvent' : 'createEvent';
  
  if (eventId) {
    eventData.id = eventId;
  }

  showLoading(eventId ? 'Updating event...' : 'Creating event...');
  closeModal();

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...eventData })
    });

    // Wait for Google Sheets to update
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Reload events
    await loadEvents();
    updateDashboardStats();
    
    hideLoading();
    showToast(eventId ? 'Event updated successfully!' : 'Event created successfully!', 'success');
    
  } catch (error) {
    console.error('Error saving event:', error);
    hideLoading();
    showToast('Failed to save event. Please try again.', 'error');
  }
}

/**
 * Save league (create or update)
 */
async function saveLeague(e) {
  e.preventDefault();
  
  const leagueData = {
    name: document.getElementById('league-name').value,
    sim: document.getElementById('league-sim').value,
    status: document.getElementById('league-status').value,
    season: document.getElementById('league-season').value,
    championshipId: document.getElementById('league-champ').value,
    blobStore: document.getElementById('league-blob').value
  };

  // Check if editing (has id) or creating new
  const leagueId = document.getElementById('league-id')?.value;
  const action = leagueId ? 'updateLeague' : 'createLeague';
  
  if (leagueId) {
    leagueData.id = leagueId;
  }

  showLoading(leagueId ? 'Updating league...' : 'Creating league...');
  closeModal();

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...leagueData })
    });

    // Wait for Google Sheets to update
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Reload leagues
    await loadLeagues();
    updateDashboardStats();
    
    hideLoading();
    showToast(leagueId ? 'League updated successfully!' : 'League created successfully!', 'success');
    
  } catch (error) {
    console.error('Error saving league:', error);
    hideLoading();
    showToast('Failed to save league. Please try again.', 'error');
  }
}

/**
 * Edit event
 */
function editEvent(id) {
  const event = adminData.events.find(e => e.id === id);
  if (event) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = 'Edit Event';
    document.getElementById('modal-body').innerHTML = getEventForm(event);
    modal.style.display = 'flex';
  }
}

/**
 * Edit league
 */
function editLeague(id) {
  const league = adminData.leagues.find(l => l.id === id);
  if (league) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = 'Edit League';
    document.getElementById('modal-body').innerHTML = getLeagueForm(league);
    modal.style.display = 'flex';
  }
}

/**
 * Delete event
 */
async function deleteEvent(id) {
  if (!confirm('Are you sure you want to delete this event? This action cannot be undone!')) {
    return;
  }

  showLoading('Deleting event...');

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteEvent', id })
    });

    // Wait for Google Sheets to update
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Reload events
    await loadEvents();
    updateDashboardStats();
    
    hideLoading();
    showToast('Event deleted successfully!', 'success');
    
  } catch (error) {
    console.error('Error deleting event:', error);
    hideLoading();
    showToast('Failed to delete event. Please try again.', 'error');
  }
}

/**
 * Delete league
 */
async function deleteLeague(id) {
  if (!confirm('Are you sure you want to delete this league? This action cannot be undone!')) {
    return;
  }

  showLoading('Deleting league...');

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteLeague', id })
    });

    // Wait for Google Sheets to update
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Reload leagues
    await loadLeagues();
    updateDashboardStats();
    
    hideLoading();
    showToast('League deleted successfully!', 'success');
    
  } catch (error) {
    console.error('Error deleting league:', error);
    hideLoading();
    showToast('Failed to delete league. Please try again.', 'error');
  }
}

/**
 * Edit registration
 */
function editRegistration(idx) {
  const reg = adminData.registrations[idx];
  if (!reg) return;

  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Edit Registration';
  document.getElementById('modal-body').innerHTML = `
    <form class="modal-form" onsubmit="saveRegistration(event, ${idx + 2}); return false;">
      <div class="form-group">
        <label>Driver Tag *</label>
        <input type="text" class="form-control" id="reg-driver" value="${reg.driverTag || ''}" required>
      </div>
      <div class="form-group">
        <label>Discord *</label>
        <input type="text" class="form-control" id="reg-discord" value="${reg.discord || ''}" required>
      </div>
      <div class="form-group">
        <label>Car Class *</label>
        <input type="text" class="form-control" id="reg-car" value="${reg.carClass || ''}" required>
      </div>
      <div class="form-group">
        <label>Event/League</label>
        <input type="text" class="form-control" id="reg-event" value="${reg.event || reg.league || ''}" readonly>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `;
  modal.style.display = 'flex';
}

/**
 * Save registration changes
 */
async function saveRegistration(e, rowIndex) {
  e.preventDefault();

  const regData = {
    action: 'updateRegistration',
    rowIndex: rowIndex,
    driverTag: document.getElementById('reg-driver').value,
    discord: document.getElementById('reg-discord').value,
    carClass: document.getElementById('reg-car').value
  };

  showLoading('Updating registration...');
  closeModal();

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regData)
    });

    // Wait for Google Sheets to update
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Reload registrations
    await loadRegistrations();
    
    hideLoading();
    showToast('Registration updated successfully!', 'success');
    
  } catch (error) {
    console.error('Error updating registration:', error);
    hideLoading();
    showToast('Failed to update registration. Please try again.', 'error');
  }
}

/**
 * Delete registration
 */
async function deleteRegistration(idx) {
  if (!confirm('Are you sure you want to delete this registration?')) {
    return;
  }

  // Row index is idx + 2 (1 for header, 1 for 0-based to 1-based)
  const rowIndex = idx + 2;

  showLoading('Deleting registration...');

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteRegistration', rowIndex })
    });

    // Wait for Google Sheets to update
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Reload registrations
    await loadRegistrations();
    updateDashboardStats();
    
    hideLoading();
    showToast('Registration deleted successfully!', 'success');
    
  } catch (error) {
    console.error('Error deleting registration:', error);
    hideLoading();
    showToast('Failed to delete registration. Please try again.', 'error');
  }
}

/**
 * Export registrations to CSV
 */
function exportRegistrations() {
  if (adminData.registrations.length === 0) {
    showToast('No registrations to export', 'error');
    return;
  }
  
  const headers = ['Timestamp', 'Driver Tag', 'Discord', 'Event/League', 'Car Class'];
  const rows = adminData.registrations.map(reg => [
    reg.timestamp,
    reg.driverTag,
    reg.discord,
    reg.event || reg.league,
    reg.carClass
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `registrations-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  
  showToast('Registrations exported successfully', 'success');
}

/**
 * Filter events
 */
function filterEvents() {
  const search = document.getElementById('events-search').value.toLowerCase();
  const rows = document.querySelectorAll('#events-table tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(search) ? '' : 'none';
  });
}

/**
 * Filter leagues
 */
function filterLeagues() {
  const search = document.getElementById('leagues-search').value.toLowerCase();
  const rows = document.querySelectorAll('#leagues-table tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(search) ? '' : 'none';
  });
}

/**
 * Filter registrations
 */
function filterRegistrations() {
  const search = document.getElementById('reg-search').value.toLowerCase();
  const filter = document.getElementById('reg-filter').value;
  const rows = document.querySelectorAll('#registrations-table tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const matchesSearch = text.includes(search);
    // If filter is empty string (All Events/Leagues), show all; otherwise check if text includes filter
    const matchesFilter = filter === '' || text.includes(filter.toLowerCase());
    row.style.display = matchesSearch && matchesFilter ? '' : 'none';
  });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * Format date
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Made with Bob