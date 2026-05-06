/* ═══════════════════════════════════════════════════
   DATA SERVICE - API/Sheet Data Management
   ═══════════════════════════════════════════════════ */

// Global data storage
let appEvents = [];
let appLeagues = [];
let appLB = {};

/**
 * Fetch data from Google Sheets via JSONP
 * @param {string} url - Google Sheets visualization API URL
 * @returns {Promise<Object>} Sheet data
 */
async function fetchGSheet(url) {
  // Google visualization endpoint always calls
  // `google.visualization.Query.setResponse(data)` when the script loads.
  // We temporarily override that function and resolve the promise when
  // it's invoked. Sequential loading (events → leaderboard) avoids races.
  return new Promise((resolve, reject) => {
    // ensure google namespace exists
    window.google = window.google || {};
    window.google.visualization = window.google.visualization || {};
    window.google.visualization.Query = window.google.visualization.Query || {};

    window.google.visualization.Query.setResponse = data => {
      resolve(data);
    };

    const s = document.createElement('script');
    s.src = url;
    s.onerror = () => reject(new Error('Failed to load Google Sheets JSONP'));
    document.body.appendChild(s);
  });
}

/**
 * Parse Google Sheets rows into objects
 * @param {Object} data - Raw sheet data
 * @param {Array<string>} cols - Column names
 * @returns {Array<Object>} Parsed rows
 */
function parseRows(data, cols) {
  return data.table.rows
    .map(row => { const o = {}; cols.forEach((c,i) => o[c] = row.c[i]?.v?.toString() ?? ''); return o; })
    .filter(r => Object.values(r).some(v => v));
}

/**
 * Load all data (events, leagues, leaderboard)
 */
async function loadData() {
  if (CONFIG.DEMO_MODE) {
    appEvents = DEMO_EVENTS;
    appEvents.forEach(e => {
      if (parseInt(e.drivers) >= parseInt(e.maxDrivers)) e.status = 'closed';
    });
    appLeagues = DEMO_LEAGUES;
    appLeagues.forEach(l => {
      if (parseInt(l.drivers) >= parseInt(l.maxDrivers)) l.status = 'closed';
    });
    appLB = DEMO_LB;
    init();
    return;
  }
  try {
    // fetch events first, then leaderboard (avoids callback race conditions)
    const evData = await fetchGSheet(CONFIG.EVENTS_SHEET_URL);
    const lgData = await fetchGSheet(CONFIG.LEAGUES_SHEET_URL);
    const lbData = await fetchGSheet(CONFIG.LEADERBOARD_SHEET_URL);

    appEvents = parseRows(evData, ['id','name','sim','status','track','startDate','endDate','format','drivers','maxDrivers','rounds','season','description','trackMod','carMod','practiceServer','carOptions']);
    appEvents.forEach(e => {
      if (parseInt(e.drivers) >= parseInt(e.maxDrivers)) e.status = 'closed';
    });
    appLeagues = parseRows(lgData, ['id','name','sim','status','track','startDate','endDate','format','drivers','maxDrivers','rounds','season','description','trackMod','carMod','practiceServer','carOptions','blobStore','championshipId']);
    appLeagues.forEach(l => {
      if (parseInt(l.drivers) >= parseInt(l.maxDrivers)) l.status = 'closed';
    });
    const lbRows = parseRows(lbData, ['eventId','race','pos','driver','tag','team','pts','time','gap']);
    appLB = {};
    // Backward compatible: if the sheet doesn't have "race" column yet,
    // we treat everything as Race 1.
    lbRows.forEach(r => {
      const race = normalizeRaceName(r.race);
      if (!appLB[r.eventId]) appLB[r.eventId] = {};
      if (!appLB[r.eventId][race]) appLB[r.eventId][race] = [];
      appLB[r.eventId][race].push(r);
    });
    init();
  } catch(e) {
    document.getElementById('events-grid').innerHTML = `<div class="data-error">⚠ Could not load sheet data.<br><small>${e.message}</small></div>`;
  }
}

// Made with Bob
