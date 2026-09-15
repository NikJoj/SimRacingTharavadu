const profileEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const lapTime = ms => { const value=Number(ms); if(!value)return '—'; const m=Math.floor(value/60000),s=((value%60000)/1000).toFixed(3).padStart(6,'0');return `${m}:${s}`; };

async function loadDriverProfile() {
  const loading=document.getElementById('profile-loading'), login=document.getElementById('profile-login'), dashboard=document.getElementById('profile-dashboard');
  const error=new URLSearchParams(location.search).get('error');
  const claim=new URLSearchParams(location.search).get('claim');
  try {
    const response=await fetch('/api/driver-profile',{cache:'no-store'});
    if(response.status===401){loading.hidden=true;login.hidden=false;if(error||claim){const el=document.getElementById('profile-login-error');el.hidden=false;el.textContent=claim==='pending'?'Your Discord account matched an expected username. An administrator must approve the verified account before race history is shown. Sign in again after approval.':error;}return;}
    const data=await response.json(); if(!response.ok)throw new Error(data.error||'Profile could not be loaded.');
    loading.hidden=true;dashboard.hidden=false;renderProfile(data);
  } catch(err){loading.innerHTML=`<div class="data-error">${profileEscape(err.message)}</div>`;}
}

function renderProfile(data){
  const p=data.profile,s=data.stats;
  document.getElementById('profile-name').textContent=p.display_name;
  document.getElementById('profile-discord').textContent=`@${p.discord_username}${p.discord_global_name?` · ${p.discord_global_name}`:''}`;
  const avatar=document.getElementById('profile-avatar');if(p.avatarUrl)avatar.style.backgroundImage=`url("${p.avatarUrl}")`;else avatar.textContent=p.display_name.slice(0,2).toUpperCase();
  document.getElementById('profile-stats').innerHTML=[['Races',s.races],['Wins',s.wins],['Podiums',s.podiums],['Avg finish',s.averageFinish??'—'],['Laps',s.completedLaps]].map(([label,value])=>`<div class="profile-stat"><strong>${profileEscape(value)}</strong><span>${label}</span></div>`).join('');
  document.getElementById('profile-history-count').textContent=`${data.history.length} mapped result${data.history.length===1?'':'s'}`;
  document.getElementById('profile-history').innerHTML=data.history.length?data.history.map(row=>`<button class="profile-race-card" onclick="openDriverRace(${Number(row.race_result_id)})">
    <div><strong>${profileEscape(row.competition)}</strong><small>${profileEscape(row.track||'Unknown track')}</small></div>
    <div><strong>${profileEscape(new Date(row.session_date).toLocaleDateString())}</strong><small>${profileEscape(row.session_type||'Race')}</small></div>
    <div class="profile-race-value"><small>Start</small><strong>${profileEscape(row.grid_position??'—')}</strong></div><div class="profile-race-value"><small>Finish</small><strong>${profileEscape(row.position??'—')}</strong></div>
    <div class="profile-race-value"><small>Laps</small><strong>${profileEscape(row.laps??0)}</strong></div><div class="profile-race-value"><small>Best lap</small><strong>${lapTime(row.best_lap)}</strong></div><span class="profile-race-open">View →</span></button>`).join(''):'<div class="profile-empty">No mapped race results yet. Ask an admin to review your racing aliases.</div>';
}

async function openDriverRace(id){
  const modal=document.getElementById('profile-race-modal'),content=document.getElementById('profile-race-content');modal.hidden=false;content.innerHTML='<div class="data-loading"><span class="spinner"></span> Loading race result…</div>';
  try{const response=await fetch(`/api/driver-profile?raceResultId=${encodeURIComponent(id)}`,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Race result could not be loaded.');
    const race=data.race,rows=Array.isArray(race.result_data?.Result)?race.result_data.Result:[];content.innerHTML=`<h2 class="profile-result-title">${profileEscape(race.competition)}</h2><p class="profile-result-meta">${profileEscape(race.track)} · ${profileEscape(new Date(race.session_date).toLocaleString())}</p>
      <div class="profile-result-table"><table><thead><tr><th>Pos</th><th>Driver</th><th>Car</th><th>Laps</th><th>Best lap</th><th>Status</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${profileEscape(row.Position||index+1)}</td><td>${profileEscape(row.DriverName||'Unknown')}</td><td>${profileEscape(row.CarModel||row.CarClass||'—')}${row.CarNumber?` #${profileEscape(row.CarNumber)}`:''}</td><td>${profileEscape(row.NumLaps??0)}</td><td>${lapTime(row.BestLap)}</td><td>${profileEscape(row.FinishStatus||'Finished')}</td></tr>`).join('')}</tbody></table></div>`;
  }catch(err){content.innerHTML=`<div class="data-error">${profileEscape(err.message)}</div>`;}
}
function closeProfileRace(){document.getElementById('profile-race-modal').hidden=true;}
document.getElementById('profile-race-modal').addEventListener('click',event=>{if(event.target.id==='profile-race-modal')closeProfileRace();});
loadDriverProfile();
