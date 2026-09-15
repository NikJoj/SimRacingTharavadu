/* ═══════════════════════════════════════════════════
   APP - Application Initialization & Orchestration
   ═══════════════════════════════════════════════════ */

/**
 * Initialize the application
 */
function init() {
  updateDriverAccountLink();
  renderEventsGrid();
  renderRegisterEvents();
  renderLeaguesGrid();
  renderLeagueRegister();
  if (CONFIG.DEMO_MODE) document.getElementById('reg-config-banner').style.display = 'block';
  if (CONFIG.DEMO_MODE) document.getElementById('league-reg-config-banner').style.display = 'block';
  const first = appEvents.find(e => e.status === 'ongoing');
  if (first) renderLeaderboard(first.id);
}

async function updateDriverAccountLink() {
  const link = document.getElementById('driver-account-link');
  if (!link) return;
  try {
    const response = await fetch('/api/discord-auth?action=me', { cache: 'no-store' });
    const data = await response.json();
    if (response.ok && data.authenticated) link.textContent = 'My Profile';
  } catch { /* Login remains optional; keep the default link text. */ }
}

// Start loading data when DOM is ready
loadData();

// Made with Bob
