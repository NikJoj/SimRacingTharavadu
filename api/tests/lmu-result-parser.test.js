import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseLmuResult, validateRaceMatch, resultHash } from '../lmu-result-parser.js';
import { createResultHandler } from '../simgrid-results.js';

const xml = `<?xml version="1.0"?><!DOCTYPE rF [<!ENTITY rFEnt "rFactor Entity">]><rFactorXML><RaceResults>
<DateTime>1784994823</DateTime><TrackVenue>Bahrain International Circuit</TrackVenue><TrackCourse>Bahrain Paddock Circuit</TrackCourse>
<Race><DateTime>1784994876</DateTime><Driver><Name>A &amp; B</Name><CarType>LMGT3</CarType><CarClass>GT3</CarClass><CarNumber>007</CarNumber><TeamName>Team</TeamName><GridPos>2</GridPos><Position>1</Position><Lap num="1" et="90.5">90.5</Lap><BestLapTime>90.5</BestLapTime><Laps>1</Laps><Pitstops>0</Pitstops><FinishStatus>Finished</FinishStatus></Driver>
<Driver><Name>&lt;script&gt;bad&lt;/script&gt;</Name><CarType>LMGT3</CarType><CarClass>GT3</CarClass><CarNumber>8</CarNumber><GridPos>1</GridPos><Position>2</Position><BestLapTime>0</BestLapTime><Laps>0</Laps><FinishStatus>DNF</FinishStatus></Driver></Race>
</RaceResults></rFactorXML>`;

test('parses LMU race XML into the existing race display contract', () => {
  const data = parseLmuResult(xml, '2026_07_25_21_31_50-71R1');
  assert.equal(data.Date, '2026-07-25T15:54:36.000Z');
  assert.equal(data.TrackConfig, 'Bahrain Paddock Circuit');
  assert.equal(data.Result.length, 2);
  assert.deepEqual(data.Result[0], { Position: 1, DriverName: 'A & B', TeamName: 'Team', CarModel: 'LMGT3', CarNumber: '007',
    CarClass: 'GT3', NumLaps: 1, BestLap: 90500, TotalTime: 90500, FinishStatus: 'Finished', GridPosition: 2, Pitstops: 0 });
  assert.equal(data.Result[1].DriverName, '&lt;script&gt;bad&lt;/script&gt;');
});
test('validates filename and selected SimGrid race metadata', () => {
  const data = parseLmuResult(xml, '2026_07_25_21_31_50-71R1.xml');
  assert.equal(validateRaceMatch(data, { name: 'Bahrain', track: 'Bahrain Paddock Circuit', startsAt: data.Date }).valid, true);
  const mismatch = validateRaceMatch(data, { name: 'Portimao', track: 'Algarve', startsAt: '2026-09-09T16:00:00Z' });
  assert.equal(mismatch.valid, false); assert.equal(mismatch.warnings.length, 2);
  assert.throws(() => parseLmuResult(xml, 'race.xml'), /Filename/);
  assert.throws(() => parseLmuResult('<xml/>', '2026_07_25_21_31_50-71R1'), /not an LMU/);
});
test('result hash changes with selection or normalized result', () => {
  const data = parseLmuResult(xml, '2026_07_25_21_31_50-71R1');
  assert.notEqual(resultHash({ raceId: 1, data }), resultHash({ raceId: 2, data }));
});

process.env.JWT_SECRET = 'test-secret-not-a-real-credential'; process.env.ADMIN_USERNAME = 'admin';
function token() { const payload=Buffer.from(JSON.stringify({username:'admin',exp:Date.now()+60000})).toString('base64'); return `${payload}|${crypto.createHmac('sha256',process.env.JWT_SECRET).update(payload).digest('base64')}`; }
function request(action, hash = '') { const form=new FormData(); form.set('action',action); form.set('leagueId','3'); form.set('raceId','30'); form.set('hash',hash); form.set('file',new File([xml],'2026_07_25_21_31_50-71R1',{type:'application/xml'})); return new Request('http://local/api/simgrid-results',{method:'POST',headers:{'X-SRT-Admin-Token':token()},body:form}); }
function endpoint(race) {
  const writes=[];
  const db=async (sql,params) => {
    if(sql.startsWith('SELECT id, name')) return {rows:[{id:3,name:'Preseason',simgrid_url:'https://www.thesimgrid.com/championships/26866'}]};
    if(sql.includes('to_regclass')) return {rows:[{table_name:'simgrid_snapshots'}]};
    if(sql.startsWith('SELECT snapshot')) return {rows:[{snapshot:{races:[race]}}]};
    writes.push({sql,params}); return {rows:[{id:4,stored_at:'2026-07-25T16:00:00Z'}]};
  };
  return {handler:createResultHandler({db,init:async()=>({success:true})}),writes};
}
test('preview is read-only and mismatched confirm cannot write', async () => {
  const race={id:'30',name:'Portimao',track:'Algarve',startsAt:'2026-09-09T16:00:00Z'}; const e=endpoint(race);
  const preview=await e.handler(request('preview'),{error(){}});
  assert.equal(preview.status,200); assert.equal(preview.jsonBody.preview.validation.valid,false); assert.equal(e.writes.length,0);
  const confirm=await e.handler(request('sync',preview.jsonBody.hash),{error(){}});
  assert.equal(confirm.status,422); assert.equal(e.writes.length,0);
});
test('matching confirmation upserts one stable league/race slot', async () => {
  const data=parseLmuResult(xml,'2026_07_25_21_31_50-71R1');
  const race={id:'30',name:'Bahrain',track:'Bahrain Paddock Circuit',startsAt:data.Date}; const e=endpoint(race);
  const preview=await e.handler(request('preview'),{error(){}});
  const confirm=await e.handler(request('sync',preview.jsonBody.hash),{error(){}});
  assert.equal(confirm.status,200);
  const raceWrite=e.writes.find(write => write.sql.includes('INSERT INTO race_results'));
  assert.ok(raceWrite); assert.match(raceWrite.sql,/ON CONFLICT \(league, race_timestamp\) DO UPDATE/);
  assert.equal(raceWrite.params[5],Date.parse(data.Date));
});
