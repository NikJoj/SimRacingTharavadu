/* ═══════════════════════════════════════════════════
   APP - Application Initialization & Orchestration
   ═══════════════════════════════════════════════════ */

/**
 * Initialize the application
 */
function init() {
  renderEventsGrid();
  renderRegisterEvents();
  renderLeaguesGrid();
  renderLeagueRegister();
  if (CONFIG.DEMO_MODE) document.getElementById('reg-config-banner').style.display = 'block';
  if (CONFIG.DEMO_MODE) document.getElementById('league-reg-config-banner').style.display = 'block';
  const first = appEvents.find(e => e.status === 'ongoing');
  if (first) renderLeaderboard(first.id);
}

// Start loading data when DOM is ready
loadData();

// Made with Bob
