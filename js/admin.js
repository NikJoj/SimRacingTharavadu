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
 * Load events from database
 */
async function loadEvents() {
  try {
    if (CONFIG.DEMO_MODE) {
      adminData.events = DEMO_EVENTS;
    } else {
      const response = await fetch(`${CONFIG.API_ENDPOINTS.DATA}?resource=events`);
      const data = await response.json();
      
      // Transform database format to admin format
      adminData.events = (data.events || []).map(e => ({
        id: String(e.id),
        name: e.name || '',
        sim: e.sim || '',
        status: e.status || 'upcoming',
        track: e.track || '',
        startDate: e.start_date || '',
        endDate: e.end_date || '',
        format: e.format || '',
        drivers: String(e.drivers || 0),
        maxDrivers: String(e.max_drivers || 30),
        rounds: String(e.rounds || 1),
        season: e.season || '',
        description: e.description || '',
        trackMod: e.track_mod || '',
        carMod: e.car_mod || '',
        practiceServer: e.practice_server || '',
        carOptions: e.car_options || ''
      }));
    }
    
    renderEventsTable();
  } catch (error) {
    console.error('Error loading events:', error);
    document.getElementById('events-table').innerHTML = '<div class="loading">Failed to load events</div>';
  }
}

/**
 * Load leagues from database
 */
async function loadLeagues() {
  try {
    if (CONFIG.DEMO_MODE) {
      adminData.leagues = DEMO_LEAGUES;
    } else {
      const response = await fetch(`${CONFIG.API_ENDPOINTS.DATA}?resource=leagues`);
      const data = await response.json();
      
      // Transform database format to admin format
      adminData.leagues = (data.leagues || []).map(l => ({
        id: String(l.id),
        name: l.name || '',
        sim: l.sim || '',
        status: l.status || 'upcoming',
        startDate: l.start_date || '',
        endDate: l.end_date || '',
        format: l.format || '',
        season: l.season || '',
        championshipId: l.championship_id || '',
        blobStore: l.blob_store || '',
        drivers: String(l.drivers || 0),
        maxDrivers: String(l.max_drivers || 36),
        rounds: String(l.rounds || 8),
        track: l.track || '',
        description: l.description || '',
        carOptions: l.car_options || ''
      }));
    }
    
    renderLeaguesTable();
    populateRegFilter();
  } catch (error) {
    console.error('Error loading leagues:', error);
    document.getElementById('leagues-table').innerHTML = '<div class="loading">Failed to load leagues</div>';
  }
}

/**
 * Load registrations from database
 */
async function loadRegistrations() {
  try {
    const response = await fetch(CONFIG.API_ENDPOINTS.REGISTRATIONS);
    const data = await response.json();
    
    // Transform database format to admin format
    adminData.registrations = (data.registrations || []).map(reg => ({
      id: reg.id,
      timestamp: reg.timestamp || reg.created_at || '',
      driverTag: reg.driver_tag || '',
      discord: reg.discord || '',
      carClass: reg.car_class || '',
      carNumber: reg.car_number || '',
      penaltyPoints: String(reg.penalty_points || 0),
      leagueId: reg.league_id ? String(reg.league_id) : '',
      event: reg.event || '',
      league: reg.event || ''  // Same field in database
    }));
    
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
    const response = await fetch(`${CONFIG.ASSETTO_API.RACES}?action=leagues`);
    const data = await response.json();
    
    if (data.success && data.leagues) {
      adminData.syncHistory = [];
      
      // Load races for each league
      for (const league of data.leagues) {
        const racesResponse = await fetch(`${CONFIG.ASSETTO_API.RACES}?action=stored&league=${encodeURIComponent(league)}`);
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
    // League dropdown will be populated when races are fetched
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
            <th>Car #</th>
            <th>Car</th>
            <th>Penalty Points</th>
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
              <td>${reg.carNumber ?? '-'}</td>
              <td>${reg.carClass}</td>
              <td>${reg.penaltyPoints || '0'}</td>
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
    const response = await fetch(`${CONFIG.ASSETTO_API.RACES}?action=store&league=${encodeURIComponent(league)}`, {
      method: 'POST'
    });
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
let pendingDriverImport = {
  league: null,
  drivers: []
};

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
  const statusEl = document.getElementById('update-races-status');
  statusEl.className = 'status-message loading show';
  statusEl.textContent = '🔄 Fetching available races...';
  
  try {
    const response = await fetch(`${CONFIG.ASSETTO_API.RACES}?action=list`);
    const data = await response.json();
    
    if (data.success && data.races) {
      availableRaces = data.races;
      renderRacesList(data.races);
      
      // Populate league dropdown when showing races
      populateUpdateRacesLeagueSelect();
      
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
    const response = await fetch(`${CONFIG.ASSETTO_API.RACES}?action=sync`, {
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
 * Open driver import modal
 */
function openDriverImportModal() {
  const modal = document.getElementById('modal');
  const importableLeagues = adminData.leagues.filter(l => l.championshipId);
  const options = importableLeagues
    .map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`)
    .join('');

  pendingDriverImport = {
    league: null,
    drivers: []
  };

  document.getElementById('modal-title').textContent = 'Sync League Drivers';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-form">
      <div class="form-group">
        <label>League</label>
        <select class="form-control" id="driver-import-league">
          <option value="">-- Select League --</option>
          ${options}
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn-primary" onclick="previewLeagueDrivers()">Import Drivers</button>
      </div>
      <div id="driver-import-status" class="status-message"></div>
      <div id="driver-import-preview" class="driver-import-preview"></div>
    </div>
  `;
  modal.style.display = 'flex';
}

/**
 * Fetch standings and show import preview
 */
async function previewLeagueDrivers() {
  const leagueId = document.getElementById('driver-import-league').value;
  const league = adminData.leagues.find(l => l.id === leagueId);
  const statusEl = document.getElementById('driver-import-status');
  const previewEl = document.getElementById('driver-import-preview');

  if (!league) {
    showToast('Please select a league', 'error');
    return;
  }

  if (!league.championshipId) {
    showToast('Selected league has no championship ID', 'error');
    return;
  }

  statusEl.className = 'status-message loading show';
  statusEl.textContent = 'Fetching championship standings...';
  previewEl.innerHTML = '';

  try {
    const response = await fetch(`${CONFIG.ASSETTO_API.STANDINGS}?championshipId=${encodeURIComponent(league.championshipId)}`);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.message || data.error || 'Failed to fetch standings');
    }

    const drivers = extractDriversFromStandings(data);
    pendingDriverImport = {
      league,
      drivers
    };

    if (drivers.length === 0) {
      statusEl.className = 'status-message error show';
      statusEl.textContent = 'No drivers found in championship standings';
      return;
    }

    statusEl.className = 'status-message success show';
    statusEl.textContent = `Found ${drivers.length} driver${drivers.length !== 1 ? 's' : ''}`;
    previewEl.innerHTML = buildDriverImportPreview(drivers);
  } catch (error) {
    console.error('Error previewing league drivers:', error);
    statusEl.className = 'status-message error show';
    statusEl.textContent = error.message;
  }
}

/**
 * Extract driver rows from championship standings response
 */
function extractDriversFromStandings(data) {
  const drivers = [];
  const seen = new Set();

  if (data.DriverStandings) {
    Object.entries(data.DriverStandings).forEach(([className, classDrivers]) => {
      if (!Array.isArray(classDrivers)) return;

      classDrivers.forEach(entry => {
        const car = entry.Car || {};
        const driver = car.Driver || {};
        const driverName = driver.Name || entry.DriverName || '';
        const carNumber = car.CarId || entry.CarId || entry.CarNumber || '';
        const key = `${driverName}|${carNumber}`;

        if (!driverName || seen.has(key)) return;
        seen.add(key);

        drivers.push({
          driver_tag: driverName,
          car_number: carNumber,
          car_class: className,
          discord: '',
          penalty_points: 0
        });
      });
    });
  }

  return drivers.sort((a, b) => {
    const an = parseInt(a.car_number || '99999', 10);
    const bn = parseInt(b.car_number || '99999', 10);
    if (an !== bn) return an - bn;
    return a.driver_tag.localeCompare(b.driver_tag);
  });
}

/**
 * Escape external text before rendering it into admin HTML
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build driver import preview table
 */
function buildDriverImportPreview(drivers) {
  return `
    <div class="table-wrapper driver-import-table">
      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Car #</th>
            <th>Class</th>
          </tr>
        </thead>
        <tbody>
          ${drivers.map(driver => `
            <tr>
              <td><strong>${escapeHtml(driver.driver_tag)}</strong></td>
              <td>${escapeHtml(driver.car_number || '-')}</td>
              <td>${escapeHtml(driver.car_class || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" onclick="importPreviewedLeagueDrivers()">Final Import</button>
    </div>
  `;
}

/**
 * Commit previewed drivers to registrations
 */
async function importPreviewedLeagueDrivers() {
  const { league, drivers } = pendingDriverImport;

  if (!league || !drivers.length) {
    showToast('Preview drivers before importing', 'error');
    return;
  }

  showLoading('Importing league drivers...');

  try {
    const response = await fetch(`${CONFIG.API_ENDPOINTS.REGISTRATIONS}?action=bulk-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        league_id: league.id,
        league_name: league.name,
        drivers
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || result.error || 'Failed to import drivers');
    }

    await loadRegistrations();
    await loadLeagues();
    updateDashboardStats();
    hideLoading();
    closeModal();
    showToast(`${result.results.imported.length} imported, ${result.results.updated.length} updated`, 'success');
  } catch (error) {
    console.error('Error importing league drivers:', error);
    hideLoading();
    showToast(`Failed to import drivers: ${error.message}`, 'error');
  }
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
      <div class="form-group">
        <label>Event Poster ${event ? '' : '*'}</label>
        <input type="file" class="form-control" id="event-poster" accept="image/png,image/jpeg,image/jpg" onchange="previewPoster(this, 'event-poster-preview')" ${event ? '' : 'required'}>
        <small style="color: #888; display: block; margin-top: 5px;">
          ${event ? `Will be saved as: poster${event.id}.png (leave empty to keep existing)` : 'Will be saved as: poster<id>.png after creation'}
        </small>
        <div id="event-poster-preview" class="poster-preview-container"></div>
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
        <label>Start Date *</label>
        <input type="datetime-local" class="form-control" id="league-start" value="${league?.startDate ? new Date(league.startDate).toISOString().slice(0, 16) : ''}" required>
      </div>
      <div class="form-group">
        <label>End Date *</label>
        <input type="datetime-local" class="form-control" id="league-end" value="${league?.endDate ? new Date(league.endDate).toISOString().slice(0, 16) : ''}" required>
      </div>
      <div class="form-group">
        <label>Championship ID</label>
        <input type="text" class="form-control" id="league-champ" value="${league?.championshipId || ''}" placeholder="UUID from Assetto API">
      </div>
      <div class="form-group">
        <label>Blob Store Folder *</label>
        <input type="text" class="form-control" id="league-blob" value="${league?.blobStore || ''}" placeholder="SRT-GT3-Season-1" required>
      </div>
      <div class="form-group">
        <label>League Poster ${league ? '' : '*'}</label>
        <input type="file" class="form-control" id="league-poster" accept="image/png,image/jpeg,image/jpg" onchange="previewPoster(this, 'league-poster-preview')" ${league ? '' : 'required'}>
        <small style="color: #888; display: block; margin-top: 5px;">
          ${league ? `Will be saved as: leaguePoster${league.id}.png (leave empty to keep existing)` : 'Will be saved as: leaguePoster<id>.png after creation'}
        </small>
        <div id="league-poster-preview" class="poster-preview-container"></div>
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
    start_date: new Date(document.getElementById('event-start').value).toISOString(),
    end_date: new Date(document.getElementById('event-end').value).toISOString(),
    format: document.getElementById('event-format').value,
    max_drivers: document.getElementById('event-max').value,
    car_options: document.getElementById('event-cars').value,
    description: document.getElementById('event-desc').value
  };

  // Check if editing (has id) or creating new
  const eventId = document.getElementById('event-id')?.value;
  
  if (eventId) {
    eventData.id = eventId;
  }

  // Get poster file
  const posterInput = document.getElementById('event-poster');
  const posterFile = posterInput?.files[0];

  showLoading(eventId ? 'Updating event...' : 'Creating event...');
  closeModal();

  try {
    // Save event to database
    const method = eventId ? 'PUT' : 'POST';
    const response = await fetch(`${CONFIG.API_ENDPOINTS.DATA}?resource=events`, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to save event');
    }

    // Get the event ID from response
    const finalEventId = eventId || result.event?.id;
    
    if (!finalEventId) {
      throw new Error('Failed to get event ID after creation');
    }

    // Reload events
    await loadEvents();

    // Upload poster to GitHub if provided
    if (posterFile && finalEventId) {
      try {
        showLoading('Syncing poster to GitHub...');
        await uploadPosterToGitHub(posterFile, `poster${finalEventId}.png`, 'event');
        showToast(eventId ? 'Event and poster updated successfully!' : 'Event created and poster synced!', 'success');
      } catch (posterError) {
        console.error('Poster upload failed:', posterError);
        showToast(`Event saved but poster sync failed: ${posterError.message}`, 'error');
      }
    } else {
      showToast(eventId ? 'Event updated successfully!' : 'Event created successfully!', 'success');
    }
    
    updateDashboardStats();
    hideLoading();
    
  } catch (error) {
    console.error('Error saving event:', error);
    hideLoading();
    showToast(`Failed to save event: ${error.message}`, 'error');
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
    start_date: new Date(document.getElementById('league-start').value).toISOString(),
    end_date: new Date(document.getElementById('league-end').value).toISOString(),
    championship_id: document.getElementById('league-champ').value,
    blob_store: document.getElementById('league-blob').value
  };

  // Check if editing (has id) or creating new
  const leagueId = document.getElementById('league-id')?.value;
  
  if (leagueId) {
    leagueData.id = leagueId;
  }

  // Get poster file
  const posterInput = document.getElementById('league-poster');
  const posterFile = posterInput?.files[0];

  showLoading(leagueId ? 'Updating league...' : 'Creating league...');
  closeModal();

  try {
    // Save league to database
    const method = leagueId ? 'PUT' : 'POST';
    const response = await fetch(`${CONFIG.API_ENDPOINTS.DATA}?resource=leagues`, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leagueData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to save league');
    }

    // Get the league ID from response
    const finalLeagueId = leagueId || result.league?.id;
    
    if (!finalLeagueId) {
      throw new Error('Failed to get league ID after creation');
    }

    // Reload leagues
    await loadLeagues();

    // Upload poster to GitHub if provided
    if (posterFile && finalLeagueId) {
      try {
        showLoading('Syncing poster to GitHub...');
        await uploadPosterToGitHub(posterFile, `leaguePoster${finalLeagueId}.png`, 'league');
        showToast(leagueId ? 'League and poster updated successfully!' : 'League created and poster synced!', 'success');
      } catch (posterError) {
        console.error('Poster upload failed:', posterError);
        showToast(`League saved but poster sync failed: ${posterError.message}`, 'error');
      }
    } else {
      showToast(leagueId ? 'League updated successfully!' : 'League created successfully!', 'success');
    }
    
    updateDashboardStats();
    hideLoading();
    
  } catch (error) {
    console.error('Error saving league:', error);
    hideLoading();
    showToast(`Failed to save league: ${error.message}`, 'error');
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
    const response = await fetch(`${CONFIG.API_ENDPOINTS.DATA}?resource=events`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to delete event');
    }
    
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
    const response = await fetch(`${CONFIG.API_ENDPOINTS.DATA}?resource=leagues`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to delete league');
    }
    
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
        <label>Car Number</label>
        <input type="text" class="form-control" id="reg-car-number" value="${reg.carNumber || ''}">
      </div>
      <div class="form-group">
        <label>Penalty Points</label>
        <input type="number" class="form-control" id="reg-penalty-points" value="${reg.penaltyPoints || '0'}" min="0" step="1">
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

  const idx = rowIndex - 2; // Convert back from rowIndex
  const reg = adminData.registrations[idx];
  if (!reg || !reg.id) {
    showToast('Registration ID not found', 'error');
    return;
  }

  const regData = {
    id: reg.id,
    driver_tag: document.getElementById('reg-driver').value,
    discord: document.getElementById('reg-discord').value,
    car_class: document.getElementById('reg-car').value,
    car_number: document.getElementById('reg-car-number').value,
    penalty_points: parseInt(document.getElementById('reg-penalty-points').value || '0', 10)
  };

  showLoading('Updating registration...');
  closeModal();

  try {
    const response = await fetch(CONFIG.API_ENDPOINTS.REGISTRATIONS, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to update registration');
    }
    
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

  const reg = adminData.registrations[idx];
  if (!reg || !reg.id) {
    showToast('Registration ID not found', 'error');
    return;
  }

  showLoading('Deleting registration...');

  try {
    const response = await fetch(CONFIG.API_ENDPOINTS.REGISTRATIONS, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reg.id })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Failed to delete registration');
    }
    
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
  
  const headers = ['Timestamp', 'Driver Tag', 'Discord', 'Event/League', 'Car Number', 'Car Class', 'Penalty Points'];
  const rows = adminData.registrations.map(reg => [
    reg.timestamp,
    reg.driverTag,
    reg.discord,
    reg.event || reg.league,
    reg.carNumber,
    reg.carClass,
    reg.penaltyPoints
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


/* ═══════════════════════════════════════════════════
   POSTER UPLOAD & GITHUB SYNC FUNCTIONS
   ═══════════════════════════════════════════════════ */

/**
 * Preview poster image before upload
 */
function previewPoster(input, previewId) {
  const previewContainer = document.getElementById(previewId);
  
  if (input.files && input.files[0]) {
    const file = input.files[0];
    
    // Validate file type
    if (!file.type.match('image/(png|jpeg|jpg)')) {
      showToast('Please select a PNG or JPG image', 'error');
      input.value = '';
      previewContainer.innerHTML = '';
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB', 'error');
      input.value = '';
      previewContainer.innerHTML = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      previewContainer.innerHTML = `
        <div style="margin-top: 10px;">
          <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;">
          <p style="margin-top: 5px; font-size: 12px; color: #666;">
            ${file.name} (${(file.size / 1024).toFixed(2)} KB)
          </p>
        </div>
      `;
    };
    reader.readAsDataURL(file);
  } else {
    previewContainer.innerHTML = '';
  }
}

/**
 * Upload poster to GitHub
 */
async function uploadPosterToGitHub(file, filename, type) {
  try {
    // Convert file to base64
    const base64Content = await fileToBase64(file);
    
    // Remove data URL prefix to get pure base64
    const base64Data = base64Content.split(',')[1];
    
    console.log(`Uploading poster: ${filename}`);
    
    // Call sync API
    const response = await fetch('/api/sync-poster', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: filename,
        content: base64Data,
        message: `Add ${filename} for ${type} via admin dashboard`
      })
    });
    
    const result = await response.json();
    
    console.log('API Response:', response.status, result);
    
    if (!response.ok) {
      // Get detailed error message
      const errorMsg = result.message || result.error || 'Failed to sync poster to GitHub';
      const errorDetails = result.details || '';
      throw new Error(`${errorMsg}${errorDetails ? ': ' + errorDetails : ''}`);
    }
    
    console.log('Poster synced to GitHub successfully:', result);
    return result;
    
  } catch (error) {
    console.error('Error uploading poster to GitHub:', error);
    console.error('Error details:', error.message);
    showToast(`Warning: ${type} saved but poster sync failed. ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}
