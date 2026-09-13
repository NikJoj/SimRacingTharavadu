import crypto from 'node:crypto';

export class SyncError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

export function championshipId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/championships\/([1-9]\d*)\/?$/);
    if (parsed.protocol === 'https:' && parsed.hostname === 'www.thesimgrid.com' && !parsed.port && match) return match[1];
  } catch { /* Invalid league configuration, not an upstream request. */ }
  throw new SyncError('Set a valid https://www.thesimgrid.com/championships/26866 URL on the league first.', 400);
}

export function requireAdmin(request) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new SyncError('JWT_SECRET must be configured for SimGrid sync.', 503);
  // SWA can replace Authorization when forwarding to managed Functions.
  // The custom header still carries our signed session, not a trusted identity.
  // Retain Bearer support for direct/local API clients only as a fallback.
  const token = request.headers.get('x-srt-admin-token') ??
    (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [payload, signature, extra] = token.split('|');
  const expected = crypto.createHmac('sha256', secret).update(payload || '').digest('base64');
  if (!signature || extra || signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new SyncError('Please sign in again.', 401);
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64').toString()); } catch { throw new SyncError('Please sign in again.', 401); }
  if (!Number.isFinite(data.exp) || data.exp <= Date.now() || data.username !== (process.env.ADMIN_USERNAME || 'admin')) {
    throw new SyncError('Please sign in again.', 401);
  }
  return data.username;
}

export function snapshotHash(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export async function gridGet(path, fetcher = fetch) {
  const token = process.env.SIMGRID_API_TOKEN;
  if (!token) throw new SyncError('SIMGRID_API_TOKEN is not configured on the API server.', 503);
  let response;
  try {
    response = await fetcher(`https://www.thesimgrid.com/api/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000), redirect: 'error'
    });
  } catch { throw new SyncError('SimGrid could not be reached. Nothing was synced.'); }
  if (!response.ok) {
    throw new SyncError(response.status === 429 ? 'SimGrid rate limit reached. Try again later.' :
      `SimGrid returned HTTP ${response.status}. Check API access; nothing was synced.`, response.status === 429 ? 429 : 502);
  }
  try { return await response.json(); } catch { throw new SyncError('SimGrid returned invalid JSON. Nothing was synced.'); }
}

function id(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new SyncError('Unexpected SimGrid identifier. Nothing was synced.');
  return String(value);
}
function number(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new SyncError(`Unexpected SimGrid ${field}. Nothing was synced.`);
  return value;
}
function text(value) { return typeof value === 'string' ? value : ''; }

// Based on authenticated LMU responses verified on 2026-09-13. Fail closed
// on incomplete pages or shape changes rather than erasing a good snapshot.
export async function fetchSnapshot(champId, get = gridGet) {
  const championship = await get(`championships/${champId}`);
  if (id(championship.id) !== String(champId) || championship.game_name !== 'Le Mans Ultimate' || championship.teams_enabled !== false) {
    throw new SyncError('This integration currently supports solo Le Mans Ultimate championships only.', 422);
  }
  if (!Array.isArray(championship.races)) throw new SyncError('Missing SimGrid race schedule.');
  const registrations = await get(`registrations?registerable_type=Championship&registerable_id=${champId}`);
  if (!Array.isArray(registrations)) throw new SyncError('Unexpected registration response.');
  let entries = [], total = null;
  for (let page = 1; page <= 25; page++) {
    const data = await get(`championships/${champId}/standings?page=${page}`);
    const pagination = data?.[3]?.pagination;
    if (!Array.isArray(data?.[0]) || !pagination || pagination.page !== page ||
        !Number.isInteger(pagination.total) || pagination.total < 0 || !Number.isInteger(pagination.per_page) || pagination.per_page <= 0) {
      throw new SyncError('Unexpected standings pagination. Nothing was synced.');
    }
    if (total !== null && total !== pagination.total) throw new SyncError('Standings changed while loading. Preview again.');
    total = pagination.total;
    entries.push(...data[0]);
    if (entries.length === total) break;
    if (!data[0].length || entries.length > total || page === 25) throw new SyncError('Incomplete standings. Nothing was synced.');
  }
  const standings = entries.map(entry => {
    if (String(entry.championship_id) !== String(champId) || !entry.display_name) throw new SyncError('Unexpected standings entry.');
    return {
      id: id(entry.id), userId: id(entry.user_id), name: text(entry.display_name),
      carNumber: entry.car_number == null ? '' : String(entry.car_number), car: text(entry.car),
      className: text(entry.championship_car_class?.display_name || entry.class),
      position: number(entry.position_cache, 'position'), points: number(entry.championship_points, 'points'),
      score: number(entry.championship_score, 'adjusted score'), penalties: number(entry.championship_penalties, 'penalties'),
      adjustment: number(entry.points_adjustment, 'adjustment'), adjustmentReason: text(entry.adjustment_reason)
    };
  }).sort((a, b) => a.className.localeCompare(b.className) || a.position - b.position || a.id.localeCompare(b.id));
  if (new Set(standings.map(s => s.id)).size !== standings.length) throw new SyncError('Duplicate standings entries.');
  const byId = new Map(standings.map(s => [s.id, s]));
  const drivers = registrations.map(reg => {
    if (String(reg.championship_id) !== String(champId)) throw new SyncError('Unexpected registration championship.');
    const standing = byId.get(id(reg.id));
    if (!standing || standing.userId !== id(reg.user_id)) throw new SyncError('A registration is missing from standings. Try again after SimGrid updates.');
    return { id: standing.id, userId: standing.userId, name: standing.name, carNumber: standing.carNumber, className: standing.className };
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(drivers.map(d => d.id)).size !== drivers.length || drivers.length !== championship.spots_taken) {
    throw new SyncError('Registration count does not match SimGrid. Nothing was synced.');
  }
  const races = championship.races.map(race => ({
    id: id(race.id), name: text(race.display_name || race.race_name),
    track: text(race.track?.composite_name || race.track?.name || race.track),
    startsAt: race.starts_at, resultsAvailable: race.results_available === true,
    publishedAt: race.published_at || null, ended: race.ended === true
  })).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)) || a.id.localeCompare(b.id));
  if (new Set(races.map(r => r.id)).size !== races.length || races.some(r => !Number.isFinite(Date.parse(r.startsAt)))) {
    throw new SyncError('Unexpected race schedule.');
  }
  return { championshipId: String(champId), name: text(championship.name), sim: championship.game_name,
    capacity: number(championship.capacity, 'capacity'), drivers, standings, races,
    resultsDetailAvailable: false };
}

export function changes(previous, next) {
  const diff = (before = [], after = []) => {
    const old = new Map(before.map(row => [row.id, row]));
    const current = new Set(after.map(row => row.id));
    return { added: after.filter(row => !old.has(row.id)).length,
      updated: after.filter(row => old.has(row.id) && JSON.stringify(old.get(row.id)) !== JSON.stringify(row)).length,
      removed: before.filter(row => !current.has(row.id)).length };
  };
  return { drivers: diff(previous?.drivers, next.drivers), standings: diff(previous?.standings, next.standings), races: diff(previous?.races, next.races) };
}
