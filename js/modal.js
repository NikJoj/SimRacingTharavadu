/* ═══════════════════════════════════════════════════
   MODAL - Event/League Details Modal
   ═══════════════════════════════════════════════════ */

/**
 * Show event details in modal
 * @param {string} id - Event ID
 */
function showEventDetails(id) {
  const event = appEvents.find(e => e.id === id);
  if (!event) return;

  // Poster
  document.getElementById('modal-poster').src = `poster${event.id}.png`;
  document.getElementById('modal-poster').onerror = function() { this.src = 'srtLogo.png'; };

  // Badge
  document.getElementById('modal-badge').className = `event-badge ${event.status}`;
  document.getElementById('modal-badge').innerHTML = `${event.status === 'ongoing' ? 'Live Now' : event.status === 'upcoming' ? 'Upcoming' : 'Closed'}`;

  // Name and Sim
  document.getElementById('modal-name').textContent = event.name;
  document.getElementById('modal-sim').textContent = event.sim;

  // Meta
  const metaHTML = `
    <div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${formatEventDate(event.startDate, event.endDate)}</div>
    ${formatEventTime(event.startDate, event.endDate) ? `<div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${formatEventTime(event.startDate, event.endDate)}</div>` : ''}
    <div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${event.track}</div>
    <div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>${event.format}</div>
  `;
  document.getElementById('modal-meta').innerHTML = metaHTML;

  // Description
  document.getElementById('modal-description').textContent = event.description;

  // Mod-links
  document.getElementById('modal-tracklinks').innerHTML = event.trackMod ? `<a href="${event.trackMod}" target="_blank" rel="noopener noreferrer">Link to Track Mod</a>` : '';
  document.getElementById('modal-carlinks').innerHTML = event.carMod ? `<a href="${event.carMod}" target="_blank" rel="noopener noreferrer">Link to Car Mod</a>` : '';
  document.getElementById('modal-practice').innerHTML = event.practiceServer ? `<a href="${event.practiceServer}" target="_blank" rel="noopener noreferrer">Practice Server</a>` : '';

  // Drivers
  document.getElementById('modal-drivers').innerHTML = `<span>${event.drivers}</span> / ${event.maxDrivers} Drivers`;

  // Buttons
  const buttonsHTML = event.status === 'ongoing'
    ? `<button class="view-lb-btn" onclick="closeModal(); showLB('${event.id}')">Leaderboard →</button>`
    : event.status === 'upcoming' ? `<button class="view-lb-btn" onclick="closeModal(); showPage('register')">Register →</button>` : `<div style="color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:0.8rem;font-weight:600;letter-spacing:0.1em;">Registration Closed</div>`;
  document.getElementById('modal-buttons').innerHTML = buttonsHTML;

  // Dim the background page
  const activePage = document.querySelector('.page.active');
  if (activePage) activePage.style.filter = 'brightness(0.1)';

  document.getElementById('event-modal').style.display = 'block';
}

/**
 * Show league details in modal
 * @param {string} id - League ID
 */
function showLeagueDetails(id) {
  const league = appLeagues.find(l => l.id === id);
  if (!league) return;

  document.getElementById('modal-poster').src = `leaguePoster${league.id}.png`;
  document.getElementById('modal-poster').onerror = function() { this.src = 'srtLogo.png'; };

  document.getElementById('modal-badge').className = `event-badge ${league.status}`;
  document.getElementById('modal-badge').innerHTML = `${league.status === 'ongoing' ? 'Live Now' : league.status === 'upcoming' ? 'Upcoming' : 'Closed'}`;

  document.getElementById('modal-name').textContent = league.name;
  document.getElementById('modal-sim').textContent = league.sim;

  const metaHTML = `
    <div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${formatEventDate(league.startDate, league.endDate)}</div>
    ${formatEventTime(league.startDate, league.endDate) ? `<div class="event-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${formatEventTime(league.startDate, league.endDate)}</div>` : ''}
  `;
  document.getElementById('modal-meta').innerHTML = metaHTML;

  document.getElementById('modal-description').textContent = league.description;

  document.getElementById('modal-tracklinks').innerHTML = league.trackMod ? `<a href="${league.trackMod}" target="_blank" rel="noopener noreferrer">Link to Track Mod</a>` : '';
  document.getElementById('modal-carlinks').innerHTML = league.carMod ? `<a href="${league.carMod}" target="_blank" rel="noopener noreferrer">Link to Car Mod</a>` : '';
  document.getElementById('modal-practice').innerHTML = league.practiceServer ? `<a href="${league.practiceServer}" target="_blank" rel="noopener noreferrer">Practice Server</a>` : '';

  document.getElementById('modal-drivers').innerHTML = `<span>${league.drivers}</span> / ${league.maxDrivers} Drivers`;

  const buttonsHTML = league.status === 'upcoming' || league.status === 'ongoing'
    ? `<button class="view-lb-btn" onclick="closeModal(); showPage('league-register')">Register →</button>`
    : `<div style="color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:0.8rem;font-weight:600;letter-spacing:0.1em;">Registration Closed</div>`;
  document.getElementById('modal-buttons').innerHTML = buttonsHTML;

  const activePage = document.querySelector('.page.active');
  if (activePage) activePage.style.filter = 'brightness(0.1)';

  document.getElementById('event-modal').style.display = 'block';
}

/**
 * Close the modal
 */
function closeModal() {
  // Restore background
  const activePage = document.querySelector('.page.active');
  if (activePage) activePage.style.filter = '';

  document.getElementById('event-modal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('event-modal');
  if (event.target === modal) {
    modal.style.display = 'none';
    closeModal();
  }
}

// Made with Bob
