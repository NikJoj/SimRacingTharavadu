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
      adminData.registrations = data.registrations || [];
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
 * Save event (placeholder - needs Apps Script integration)
 */
async function saveEvent(e) {
  e.preventDefault();
  showToast('Event creation requires Apps Script integration. See documentation.', 'error');
  // TODO: Implement with Apps Script
}

/**
 * Save league (placeholder - needs Apps Script integration)
 */
async function saveLeague(e) {
  e.preventDefault();
  showToast('League creation requires Apps Script integration. See documentation.', 'error');
  // TODO: Implement with Apps Script
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
function deleteEvent(id) {
  if (confirm('Are you sure you want to delete this event?')) {
    showToast('Event deletion requires Apps Script integration. See documentation.', 'error');
    // TODO: Implement with Apps Script
  }
}

/**
 * Delete league
 */
function deleteLeague(id) {
  if (confirm('Are you sure you want to delete this league?')) {
    showToast('League deletion requires Apps Script integration. See documentation.', 'error');
    // TODO: Implement with Apps Script
  }
}

/**
 * Edit registration
 */
function editRegistration(idx) {
  showToast('Registration editing requires Apps Script integration. See documentation.', 'error');
  // TODO: Implement with Apps Script
}

/**
 * Delete registration
 */
function deleteRegistration(idx) {
  if (confirm('Are you sure you want to delete this registration?')) {
    showToast('Registration deletion requires Apps Script integration. See documentation.', 'error');
    // TODO: Implement with Apps Script
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
    const matchesFilter = !filter || text.includes(filter.toLowerCase());
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