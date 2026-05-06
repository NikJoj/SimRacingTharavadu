/* ═══════════════════════════════════════════════════
   EVENTS - Event Grid, Cards, Pagination
   ═══════════════════════════════════════════════════ */

// Events grid pagination
const EVENTS_PAGE_SIZE = 3;
let eventsPage = 1;

/**
 * Get events sorted by latest first
 * @returns {Array<Object>} Sorted events
 */
function getEventsSortedLatestFirst() {
  return [...appEvents].sort((a, b) => {
    const ad = Date.parse(a.startDate || '') || 0;
    const bd = Date.parse(b.startDate || '') || 0;
    if (bd !== ad) return bd - ad; // newest start first
    const ai = parseInt(a.id || '0', 10) || 0;
    const bi = parseInt(b.id || '0', 10) || 0;
    return bi - ai;
  });
}

/**
 * Build HTML for a single event card
 * @param {Object} e - Event object
 * @returns {string} HTML string
 */
function buildEventCardHTML(e) {
  return `
    <div class="event-card ${e.status}">
      <div class="event-poster">
        <img src="poster${e.id}.png" alt="${e.name} Poster" onerror="this.src='srtLogo.png';">
      </div>
      <div class="event-content">
        <div class="event-badge ${e.status}">${e.status === 'ongoing' ? 'Live Now' : e.status === 'upcoming' ? 'Upcoming' : 'Closed'}</div>
        <div class="event-name">${e.name}</div>
        <div class="event-sim">${e.sim}</div>
        <div class="event-meta">
          <div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${formatEventDate(e.startDate, e.endDate)}</div>
          ${formatEventTime(e.startDate, e.endDate) ? `<div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${formatEventTime(e.startDate, e.endDate)}</div>` : ''}
          <div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${e.track}</div>
          <div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>${e.format}</div>
        </div>
        <div class="event-footer">
          <div class="drivers-count"><span>${e.drivers}</span> / ${e.maxDrivers} Drivers</div>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            <button class="view-details-btn" onclick="showEventDetails('${e.id}')">View Details</button>
          ${e.status === 'ongoing'
            ? `<button class="view-lb-btn" onclick="showLB('${e.id}')">Leaderboard →</button>`
            : e.status === 'upcoming'
            ? `<button class="view-lb-btn" onclick="showPage('register')">Register →</button>`
            : `<button class="view-lb-btn" onclick="showLB('${e.id}')">View Results →</button>`}
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * Set events page number
 * @param {number} nextPage - Page number to set
 */
function setEventsPage(nextPage) {
  const all = getEventsSortedLatestFirst();
  const totalPages = Math.max(1, Math.ceil(all.length / EVENTS_PAGE_SIZE));
  eventsPage = Math.min(Math.max(1, nextPage), totalPages);
  renderEventsGrid();
}

/**
 * Render events grid with pagination
 */
function renderEventsGrid() {
  const el = document.getElementById('events-grid');
  const pager = document.getElementById('events-pagination');
  if (!appEvents.length) {
    el.innerHTML = '<div class="data-error">No events found.</div>';
    if (pager) pager.style.display = 'none';
    return;
  }

  const all = getEventsSortedLatestFirst();
  const totalPages = Math.max(1, Math.ceil(all.length / EVENTS_PAGE_SIZE));
  if (eventsPage > totalPages) eventsPage = totalPages;
  if (eventsPage < 1) eventsPage = 1;

  const start = (eventsPage - 1) * EVENTS_PAGE_SIZE;
  const pageItems = all.slice(start, start + EVENTS_PAGE_SIZE);
  el.innerHTML = pageItems.map(buildEventCardHTML).join('');

  if (pager) {
    if (totalPages <= 1) {
      pager.style.display = 'none';
    } else {
      pager.style.display = 'flex';
      pager.innerHTML = `
        <button class="events-page-btn" onclick="setEventsPage(${eventsPage - 1})" ${eventsPage <= 1 ? 'disabled' : ''}>← Prev</button>
        <div class="events-page-info">Page ${eventsPage} / ${totalPages}</div>
        <button class="events-page-btn" onclick="setEventsPage(${eventsPage + 1})" ${eventsPage >= totalPages ? 'disabled' : ''}>Next →</button>
      `;
    }
  }
}

// Made with Bob
