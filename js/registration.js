/* ═══════════════════════════════════════════════════
   REGISTRATION - Form Handling & Submission
   ═══════════════════════════════════════════════════ */

/**
 * Render event registration form options
 */
function renderRegisterEvents() {
  const upcoming = appEvents.filter(e => e.status === 'upcoming');

  document.getElementById('reg-event-list').innerHTML = upcoming.length ? upcoming.map(e => `
    <div class="event-select-card">
      <div class="event-select-name">${e.name}</div>
      <div class="event-select-meta">${e.sim} · ${formatEventDate(e.startDate, e.endDate)}</div>
      <div class="event-select-meta">${e.track} · ${e.format}</div>
      <div class="event-select-meta" style="margin-top:6px;color:${e.status==='ongoing'?'var(--green)':e.status==='upcoming'?'var(--gold)':'var(--muted)'};">
        ${e.status==='ongoing'?'● Live':e.status==='upcoming'?'◌ Upcoming':'● Closed'} · ${e.drivers}/${e.maxDrivers} Drivers
      </div>
    </div>`).join('') : `<div class="data-error">No upcoming events right now.</div>`;

  document.getElementById('form-event-list').innerHTML = upcoming.length ? upcoming.map(e => `
    <div class="event-select-card" id="fev-${e.id}" onclick="selectEvent('${e.id}','${e.name.replace(/'/g,"\\'")}')">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${e.status==='ongoing'?'var(--green)':e.status==='upcoming'?'var(--gold)':'var(--muted)'};margin-bottom:4px;">${e.status==='ongoing'?'● Live':e.status==='upcoming'?'◌ Upcoming':'● Closed'}</div>
      <div class="event-select-name">${e.name}</div>
      <div class="event-select-meta">${e.sim}</div>
    </div>`).join('') : `<div class="data-error" style="grid-column:1/-1">No upcoming events right now.</div>`;
}

/**
 * Select an event for registration
 * @param {string} id - Event ID
 * @param {string} name - Event name
 */
function selectEvent(id, name) {
  const event = appEvents.find(e => e.id === id);
  if (event && event.status === 'closed') {
    alert('Registration for this event is closed.');
    return;
  }
  document.querySelectorAll('#form-event-list .event-select-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('fev-'+id)?.classList.add('selected');
  document.getElementById('f-event').value = name;

  const carSelect = document.getElementById('f-carclass');
  const optionsStr = event && event.carOptions ? event.carOptions : '';
  if (carSelect && optionsStr) {
    const cars = optionsStr.split(',').map(s => s.trim()).filter(Boolean);
    carSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select Car —';
    carSelect.appendChild(placeholder);
    cars.forEach(car => {
      const opt = document.createElement('option');
      opt.value = car;
      opt.textContent = car;
      carSelect.appendChild(opt);
    });
    carSelect.disabled = false;
  }
}

/**
 * Render league registration form options
 */
function renderLeagueRegister() {
  const upcoming = appLeagues.filter(l => l.status === 'upcoming' || l.status === 'ongoing');

  const right = document.getElementById('league-reg-list');
  const list = document.getElementById('league-form-list');
  if (!right || !list) return;

  right.innerHTML = upcoming.length ? upcoming.map(l => `
    <div class="event-select-card">
      <div class="event-select-name">${l.name}</div>
      <div class="event-select-meta">${l.sim} · ${formatEventDate(l.startDate, l.endDate)}</div>
      <div class="event-select-meta">${l.track} · ${l.format}</div>
      <div class="event-select-meta" style="margin-top:6px;color:${l.status==='ongoing'?'var(--green)':l.status==='upcoming'?'var(--gold)':'var(--muted)'};">
        ${l.status==='ongoing'?'● Live':l.status==='upcoming'?'◌ Upcoming':'● Closed'} · ${l.drivers}/${l.maxDrivers} Drivers
      </div>
    </div>`).join('') : `<div class="data-error">No leagues open right now.</div>`;

  list.innerHTML = upcoming.length ? upcoming.map(l => `
    <div class="event-select-card" id="lfev-${l.id}" onclick="selectLeague('${l.id}','${l.name.replace(/'/g,"\\'")}')">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${l.status==='ongoing'?'var(--green)':l.status==='upcoming'?'var(--gold)':'var(--muted)'};margin-bottom:4px;">${l.status==='ongoing'?'● Live':l.status==='upcoming'?'◌ Upcoming':'● Closed'}</div>
      <div class="event-select-name">${l.name}</div>
      <div class="event-select-meta">${l.sim}</div>
    </div>`).join('') : `<div class="data-error" style="grid-column:1/-1">No leagues open right now.</div>`;
}

/**
 * Select a league for registration
 * @param {string} id - League ID
 * @param {string} name - League name
 */
function selectLeague(id, name) {
  const league = appLeagues.find(l => l.id === id);
  if (league && league.status === 'closed') {
    alert('Registration for this league is closed.');
    return;
  }

  document.querySelectorAll('#league-form-list .event-select-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('lfev-'+id)?.classList.add('selected');
  document.getElementById('lf-league').value = name;

  const carSelect = document.getElementById('lf-carclass');
  const optionsStr = league && league.carOptions ? league.carOptions : '';
  if (carSelect && optionsStr) {
    const cars = optionsStr.split(',').map(s => s.trim()).filter(Boolean);
    carSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select Car —';
    carSelect.appendChild(placeholder);
    cars.forEach(car => {
      const opt = document.createElement('option');
      opt.value = car;
      opt.textContent = car;
      carSelect.appendChild(opt);
    });
    carSelect.disabled = false;
  }
}

/**
 * Submit event registration form
 */
async function submitForm() {
  const g = id => document.getElementById(id).value.trim();

  const fields = {
    driverTag:g('f-tag'),
    discord:g('f-discord'), 
    carClass:g('f-carclass'),
    event:g('f-event'), timestamp:new Date().toISOString()
  };  

  if (!fields.event)
    return setStatus('error','⚠ Please select an event first.');  
  if (!fields.discord||!fields.driverTag||!fields.carClass)
    return setStatus('error','⚠ Please fill all required fields (*).');  
  if (!document.getElementById('f-conduct').checked)
    return setStatus('error','⚠ Please agree to the racing rules to proceed.');
  if (!document.getElementById('f-discord-join').checked)
    return setStatus('error','⚠ Please confirm you will join the Discord server for race updates and communication.');

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  setStatus('loading','<span class="spinner"></span> &nbsp;Submitting registration…');

  if (CONFIG.DEMO_MODE) {
    await new Promise(r=>setTimeout(r,1400));
    setStatus('success',`✓ [Demo] ${fields.driverTag} registered for "${fields.event}". Set DEMO_MODE: false and add your Apps Script URL to enable real submissions.`);
    btn.disabled = false;
    return;
  }

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body:JSON.stringify(fields)});
    setStatus('success',`✓ ${fields.driverTag}, you're on the grid for "${fields.event}"! Look out for updates on Sim Racing Tharavadu Discord channel.`);
    resetForm();
  } catch(e) {
    setStatus('error',`⚠ Submission failed: ${e.message}. Please try again or contact us on WhatsApp.`);
  }
  btn.disabled = false;
}

/**
 * Submit league registration form
 */
async function submitLeagueForm() {
  const g = id => document.getElementById(id).value.trim();

  const fields = {
    type: 'league',
    driverTag: g('lf-tag'),
    discord: g('lf-discord'),
    carClass: g('lf-carclass'),
    league: g('lf-league'),
    timestamp: new Date().toISOString()
  };

  if (!fields.league) return setLeagueStatus('error','⚠ Please select a league first.');
  if (!fields.discord || !fields.driverTag || !fields.carClass) return setLeagueStatus('error','⚠ Please fill all required fields (*).');
  if (!document.getElementById('lf-conduct').checked) return setLeagueStatus('error','⚠ Please agree to the racing rules to proceed.');
  if (!document.getElementById('lf-discord-join').checked) return setLeagueStatus('error','⚠ Please confirm you will join the Discord server for race updates and communication.');

  const btn = document.getElementById('league-submit-btn');
  btn.disabled = true;
  setLeagueStatus('loading','<span class="spinner"></span> &nbsp;Submitting league registration…');

  if (CONFIG.DEMO_MODE) {
    await new Promise(r=>setTimeout(r,1400));
    setLeagueStatus('success',`✓ [Demo] ${fields.driverTag} registered for "${fields.league}". Set DEMO_MODE: false and add your Apps Script URL to enable real submissions.`);
    btn.disabled = false;
    return;
  }

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body:JSON.stringify(fields)});
    setLeagueStatus('success',`✓ ${fields.driverTag}, you're registered for "${fields.league}"! Look out for updates on Sim Racing Tharavadu Discord channel.`);
    resetLeagueForm();
  } catch(e) {
    setLeagueStatus('error',`⚠ Submission failed: ${e.message}. Please try again or contact us on WhatsApp.`);
  }
  btn.disabled = false;
}

/**
 * Set status message for event registration
 * @param {string} type - Message type (success, error, loading)
 * @param {string} html - Message HTML
 */
function setStatus(type, html) {
  const el = document.getElementById('status-msg');
  el.className = 'status-msg '+type;
  el.innerHTML = html;
  el.style.display = 'block';
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

/**
 * Set status message for league registration
 * @param {string} type - Message type (success, error, loading)
 * @param {string} html - Message HTML
 */
function setLeagueStatus(type, html) {
  const el = document.getElementById('league-status-msg');
  el.className = 'status-msg '+type;
  el.innerHTML = html;
  el.style.display = 'block';
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

/**
 * Reset event registration form
 */
function resetForm() {
  ['f-tag','f-discord','f-carclass'].forEach(id=>document.getElementById(id).value='');
  ['f-conduct','f-discord-join'].forEach(id=>document.getElementById(id).checked=false);  
  document.getElementById('f-event').value='';
  document.querySelectorAll('#form-event-list .event-select-card').forEach(c=>c.classList.remove('selected'));
  const carSelect = document.getElementById('f-carclass');
  if (carSelect) {
    carSelect.disabled = true;
    carSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select Event First —';
    carSelect.appendChild(placeholder);
  }
}

/**
 * Reset league registration form
 */
function resetLeagueForm() {
  ['lf-tag','lf-discord','lf-carclass'].forEach(id=>document.getElementById(id).value='');
  ['lf-conduct','lf-discord-join'].forEach(id=>document.getElementById(id).checked=false);
  document.getElementById('lf-league').value='';
  document.querySelectorAll('#league-form-list .event-select-card').forEach(c=>c.classList.remove('selected'));
  const carSelect = document.getElementById('lf-carclass');
  if (carSelect) {
    carSelect.disabled = true;
    carSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select League First —';
    carSelect.appendChild(placeholder);
  }
}

// Made with Bob
