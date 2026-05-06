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

// Made with Bob
