/* ═══════════════════════════════════════════════════
   LEADERBOARD - Race Results & Standings
   ═══════════════════════════════════════════════════ */

/**
 * Show leaderboard for a specific event or league
 * @param {string} id - Event/League ID
 */
async function showLB(id) {
  showPage('leaderboard');
  await renderLeaderboard(id);
}

/**
 * Render leaderboard for an event or league
 * @param {string} eid - Event/League ID
 */
async function renderLeaderboard(eid) {
  // Check if it's a league first
  const league = appLeagues.find(l => l.id === eid);
  
  if (league) {
    // Handle league leaderboard
    await renderLeagueLeaderboard(league);
    return;
  }

  // Handle event leaderboard (existing logic)
  const ongoing = appEvents.filter(e => e.status === 'ongoing');
  document.getElementById('lb-tabs').innerHTML = ongoing.map(e =>
    `<button class="lb-tab ${e.id===eid?'active':''}" onclick="renderLeaderboard('${e.id}')">${e.name}</button>`
  ).join('') || `<div style="padding:1rem 2rem;color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:0.9rem;">No live events right now.</div>`;

  const ev = appEvents.find(e => e.id === eid);
  if (!ev) return;

  const eventData = appLB[eid] || {};

  // Support older DEMO_LB shape (array) as a single race.
  const racesMap = Array.isArray(eventData) ? {'Race 1': eventData} : eventData;
  const raceNames = Object.keys(racesMap).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const toNum = (s) => {
    const n = parseInt((s ?? '').toString(), 10);
    return Number.isFinite(n) ? n : 9999;
  };

  const renderRaceBlock = (raceName, rows) => {
    const sorted = [...(rows || [])].sort((a, b) => toNum(a.pos) - toNum(b.pos));
    const top3 = sorted.filter(r => ['1','2','3'].includes((r.pos ?? '').toString()));
    const rest = sorted.filter(r => !['1','2','3'].includes((r.pos ?? '').toString()));

    const pod = (rank, cls, label) => {
      const p = top3.find(r => (r.pos ?? '').toString() === String(rank));
      return p
        ? `<div class="podium-card ${cls}"><div class="podium-pos">${label}</div><div class="podium-name">${p.driver}</div><div class="podium-team">${p.tag} · ${p.team}</div><div class="podium-time">${p.time}</div><div class="podium-pts">${p.pts}</div><div class="podium-pts-label">Points</div></div>`
        : `<div class="podium-card ${cls}" style="opacity:0.2"><div class="podium-pos">${label}</div></div>`;
    };

    return `
      <div style="margin-top:2.25rem;">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:0.06em;">${raceName}</div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.75rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:var(--muted);">Race Results</div>
        </div>
        ${!sorted.length ? '<div class="data-error">No results posted for this race yet.</div>' : `
          <div class="lb-top3">${pod(1,'p1','P1')}${pod(2,'p2','P2')}${pod(3,'p3','P3')}</div>
          ${rest.length ? `<table class="lb-table"><thead><tr><th>Pos</th><th>Driver</th><th>Best Lap</th><th>Gap</th><th>Pts</th></tr></thead><tbody>
            ${rest.map(r=>`<tr><td class="td-pos">${r.pos}</td><td class="td-driver">${r.driver}<div class="td-driver-team">${r.tag} · ${r.team}</div></td><td class="td-time">${r.time}</td><td class="td-gap">${r.gap}</td><td class="td-pts">${r.pts}</td></tr>`).join('')}
          </tbody></table>` : ''}
        `}
      </div>
    `;
  };

  document.getElementById('lb-body').innerHTML = `
    <div style="margin-bottom:2rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
      <div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.75rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:var(--red);margin-bottom:4px;">${ev.sim}</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:0.04em;">${ev.track} — ${ev.format}</div>
      </div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.8rem;font-weight:700;letter-spacing:0.15em;color:var(--muted);text-transform:uppercase;">${formatEventDate(ev.startDate, ev.endDate)}</div>
    </div>
    ${!raceNames.length ? '<div class="data-error">No standings posted for this event yet.</div>' : raceNames.map(rn => renderRaceBlock(rn, racesMap[rn])).join('')}
  `;
}

// Made with Bob

/**
 * Render league leaderboard from Assetto Corsa API
 * @param {Object} league - League object
 */
async function renderLeagueLeaderboard(league) {
  document.getElementById('lb-tabs').innerHTML = `
    <button class="lb-tab active">${league.name}</button>
  `;

  document.getElementById('lb-body').innerHTML = `
    <div class="data-loading"><span class="spinner"></span> Loading championship standings…</div>
  `;

  // Special handling for "SRT LMU Pre Season Evaluation"
  if (league.name === "SRT LMU Pre Season Evaluation") {
    try {
      // Use serverless function to fetch championship standings
      const apiUrl = `${CONFIG.ASSETTO_API.STANDINGS}?championshipId=${CONFIG.ASSETTO_CHAMPIONSHIP_ID}`;
      console.log(`Fetching championship standings from: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse the championship data
      const standings = data.Championship?.Standings || [];
      
      if (!standings.length) {
        document.getElementById('lb-body').innerHTML = '<div class="data-error">No standings available yet.</div>';
        return;
      }

      // Sort by points (descending)
      const sortedStandings = [...standings].sort((a, b) => (b.Points || 0) - (a.Points || 0));
      
      // Get top 3 for podium
      const top3 = sortedStandings.slice(0, 3);
      const rest = sortedStandings.slice(3);

      const renderPodium = (driver, position, className, label) => {
        if (!driver) return `<div class="podium-card ${className}" style="opacity:0.2"><div class="podium-pos">${label}</div></div>`;
        
        return `
          <div class="podium-card ${className}">
            <div class="podium-pos">${label}</div>
            <div class="podium-name">${driver.Car?.Driver?.Name || 'Unknown Driver'}</div>
            <div class="podium-team">${driver.Car?.Model || 'Unknown Car'}</div>
            <div class="podium-pts">${driver.Points || 0}</div>
            <div class="podium-pts-label">Points</div>
          </div>
        `;
      };

      document.getElementById('lb-body').innerHTML = `
        <div style="margin-bottom:2rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.75rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:var(--red);margin-bottom:4px;">Assetto Corsa</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:0.04em;">${league.name}</div>
          </div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.8rem;font-weight:700;letter-spacing:0.15em;color:var(--muted);text-transform:uppercase;">Championship Standings</div>
        </div>
        
        <div class="lb-top3">
          ${renderPodium(top3[1], 2, 'p2', 'P2')}
          ${renderPodium(top3[0], 1, 'p1', 'P1')}
          ${renderPodium(top3[2], 3, 'p3', 'P3')}
        </div>
        
        ${rest.length ? `
          <table class="lb-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Driver</th>
                <th>Car</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              ${rest.map((driver, idx) => `
                <tr>
                  <td class="td-pos">${idx + 4}</td>
                  <td class="td-driver">
                    ${driver.Car?.Driver?.Name || 'Unknown Driver'}
                    <div class="td-driver-team">${driver.Car?.Driver?.Team || 'Independent'}</div>
                  </td>
                  <td style="font-size:0.85rem;color:var(--muted);">${driver.Car?.Model || 'Unknown'}</td>
                  <td class="td-pts">${driver.Points || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      `;

    } catch (error) {
      console.error('Error fetching championship standings:', error);
      document.getElementById('lb-body').innerHTML = `
        <div class="data-error">
          ⚠ Could not load championship standings from Assetto Corsa API.<br>
          <small style="display:block;margin-top:0.5rem;">${error.message}</small>
          <div style="margin-top:1rem;padding:1rem;background:rgba(255,255,255,0.03);border-left:3px solid var(--gold);font-size:0.85rem;line-height:1.6;">
            <strong style="color:var(--gold);">Alternative Solution:</strong><br>
            Due to CORS restrictions, you may need to:<br>
            1. Set up a backend proxy server, or<br>
            2. Manually sync championship data to Google Sheets<br>
            3. Contact the API provider to enable CORS
          </div>
        </div>
      `;
    }
  } else {
    // For other leagues, show message or use Google Sheets data
    document.getElementById('lb-body').innerHTML = `
      <div style="margin-bottom:2rem;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:0.04em;">${league.name}</div>
      </div>
      <div class="data-error">Leaderboard data not available for this league yet.</div>
    `;
  }
}
