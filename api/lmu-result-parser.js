import crypto from 'node:crypto';
import { SyncError } from './simgrid-client.js';

const MAX_XML_BYTES = 8 * 1024 * 1024;

function clean(value = '') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}
function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return clean(match?.[1] || '');
}
function numeric(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : fallback;
}
function fileNameOk(name) {
  return /^\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}-[A-Za-z0-9_-]+(?:\.xml)?$/i.test(name);
}

export function parseLmuResult(xml, fileName) {
  if (!fileNameOk(fileName)) throw new SyncError('Filename must look like 2026_07_25_21_31_50-71R1 or end in .xml.', 400);
  if (typeof xml !== 'string' || !xml.trim() || Buffer.byteLength(xml, 'utf8') > MAX_XML_BYTES) {
    throw new SyncError('Select a non-empty LMU result file smaller than 8 MB.', 400);
  }
  if (!/<rFactorXML\b/i.test(xml) || !/<RaceResults>/i.test(xml)) throw new SyncError('This is not an LMU/rFactor XML result file.', 400);
  const race = xml.match(/<Race>([\s\S]*?)<\/Race>/i)?.[1];
  if (!race) throw new SyncError('The result file does not contain a Race session.', 422);
  const dateSeconds = numeric(tag(race, 'DateTime'));
  const date = dateSeconds ? new Date(dateSeconds * 1000) : null;
  if (!date || Number.isNaN(date.getTime())) throw new SyncError('The race timestamp is missing or invalid.', 422);
  const drivers = [...race.matchAll(/<Driver>([\s\S]*?)<\/Driver>/gi)].map(match => {
    const block = match[1];
    const laps = [...block.matchAll(/<Lap\b([^>]*)>([^<]*)<\/Lap>/gi)];
    const lastElapsed = laps.length ? numeric(laps.at(-1)[1].match(/\bet="([^"]+)"/i)?.[1]) : 0;
    return {
      Position: numeric(tag(block, 'Position'), 9999), DriverName: tag(block, 'Name'),
      TeamName: tag(block, 'TeamName'), CarModel: tag(block, 'CarType') || tag(block, 'VehName'),
      CarNumber: tag(block, 'CarNumber'), CarClass: tag(block, 'CarClass'),
      NumLaps: numeric(tag(block, 'Laps')), BestLap: Math.round(numeric(tag(block, 'BestLapTime')) * 1000),
      TotalTime: Math.round(lastElapsed * 1000), FinishStatus: tag(block, 'FinishStatus') || 'Unknown',
      GridPosition: numeric(tag(block, 'GridPos'), 9999), Pitstops: numeric(tag(block, 'Pitstops'))
    };
  }).filter(driver => driver.DriverName && driver.Position < 9999)
    .sort((a, b) => a.Position - b.Position || a.DriverName.localeCompare(b.DriverName));
  if (!drivers.length || new Set(drivers.map(driver => driver.Position)).size !== drivers.length) {
    throw new SyncError('No valid, uniquely positioned race results were found.', 422);
  }
  const trackVenue = tag(xml, 'TrackVenue');
  const trackCourse = tag(xml, 'TrackCourse');
  return {
    source: 'lmu-xml', sourceFile: fileName, Type: 'Race', Date: date.toISOString(),
    TrackName: trackVenue || trackCourse, TrackConfig: trackCourse,
    TotalLaps: Math.max(...drivers.map(driver => driver.NumLaps)), Result: drivers, Penalties: []
  };
}

export function validateRaceMatch(result, race) {
  const expected = new Date(race.startsAt).getTime();
  const actual = new Date(result.Date).getTime();
  const hoursApart = Math.abs(expected - actual) / 3600000;
  const generic = new Set(['circuit', 'international', 'track', 'race', 'round', 'grand', 'prix', 'wec']);
  const words = value => new Set(String(value).toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 3 && !generic.has(word)) || []);
  const expectedWords = words(`${race.name} ${race.track}`);
  const actualWords = words(`${result.TrackName} ${result.TrackConfig}`);
  const trackMatched = [...expectedWords].some(word => actualWords.has(word));
  const warnings = [];
  if (hoursApart > 36) warnings.push(`XML date is ${Math.round(hoursApart)} hours from the selected SimGrid race.`);
  if (!trackMatched) warnings.push('XML track does not match the selected SimGrid race.');
  return { valid: warnings.length === 0, warnings, hoursApart, trackMatched };
}

export function resultHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
