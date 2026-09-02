/* ═══════════════════════════════════════════════════
   DATA SERVICE - Database API Data Management
   ═══════════════════════════════════════════════════ */

// Global data storage
let appEvents = [];
let appLeagues = [];
let appLB = {};

/**
 * Load all data from database API endpoints
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
    // Fetch data from PostgreSQL database via consolidated home endpoint
    const homeRes = await fetch('/api/home');

    if (!homeRes.ok) {
      throw new Error('Failed to fetch data from database');
    }

    const homeData = await homeRes.json();
    const eventsData = { events: homeData.events };
    const leaguesData = { leagues: homeData.leagues };
    const leaderboardData = { leaderboard: homeData.leaderboard };

    // Transform database format to app format
    appEvents = (eventsData.events || []).map(e => ({
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

    // Update status based on driver count
    appEvents.forEach(e => {
      if (parseInt(e.drivers) >= parseInt(e.maxDrivers)) e.status = 'closed';
    });

    appLeagues = (leaguesData.leagues || []).map(l => ({
      id: String(l.id),
      name: l.name || '',
      sim: l.sim || '',
      status: l.status || 'upcoming',
      startDate: l.start_date || '',
      endDate: l.end_date || '',
      format: l.format || '',
      season: l.season || '',
      championshipId: l.championship_id || '',
      simgridUrl: l.simgrid_url || '',
      blobStore: l.blob_store || '',
      drivers: String(l.drivers || 0),
      maxDrivers: String(l.max_drivers || 36),
      rounds: String(l.rounds || 8),
      track: l.track || '',
      description: l.description || '',
      carOptions: l.car_options || ''
    }));

    // Update status based on driver count
    appLeagues.forEach(l => {
      if (parseInt(l.drivers) >= parseInt(l.maxDrivers)) l.status = 'closed';
    });

    // Transform leaderboard data
    appLB = {};
    (leaderboardData.leaderboard || []).forEach(entry => {
      const eventId = String(entry.event_id);
      const race = normalizeRaceName(entry.race || 'Race 1');
      
      if (!appLB[eventId]) appLB[eventId] = {};
      if (!appLB[eventId][race]) appLB[eventId][race] = [];
      
      appLB[eventId][race].push({
        pos: String(entry.position),
        driver: entry.driver || '',
        tag: entry.tag || '',
        team: entry.team || '',
        pts: String(entry.points || 0),
        time: entry.time || '',
        gap: entry.gap || ''
      });
    });

    init();
  } catch(e) {
    console.error('Data loading error:', e);
    document.getElementById('events-grid').innerHTML =
      `<div class="data-error">⚠ Could not load data from database.<br><small>${e.message}</small></div>`;
  }
}

// Made with Bob
