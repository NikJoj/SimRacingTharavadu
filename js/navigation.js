/* ═══════════════════════════════════════════════════
   NAVIGATION - Page Switching
   ═══════════════════════════════════════════════════ */

/**
 * Show a specific page and update navigation
 * @param {string} id - Page ID to show
 */
function showPage(id) {
  // Stop live timing polling when navigating away from league details
  if (typeof stopLiveTimingPolling === 'function') {
    stopLiveTimingPolling();
  }
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('tab-' + id)?.classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'leaderboard' && appEvents.length) {
    const first = appEvents.find(e => e.status === 'ongoing');
    if (first) renderLeaderboard(first.id);
  }
}

// Made with Bob
