import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { validateCompetitionDeviceReport } from '../src/platform/competition_device_reports.js';
const mocks=vi.hoisted(()=>({actor:vi.fn(),query:vi.fn(),ready:vi.fn()}));
vi.mock('../src/platform/auth.js',()=>({requirePlatformActor:mocks.actor}));
vi.mock('../src/platform/db.js',()=>({platformDb:()=>({}),platformQuery:mocks.query,
  withIdempotency:async(_c:unknown,_a:unknown,_s:unknown,_b:unknown,run:(db:object)=>Promise<unknown>)=>run({}),
  sendMutation:(c:{json:(body:unknown,status:number)=>Response},r:{body:unknown;status:number})=>c.json(r.body,r.status)}));
vi.mock('../src/routes/video_rooms.js',()=>({competitionSupervisionReady:mocks.ready}));
import { platformCompetitionDeviceReportRoutes } from '../src/routes/platform_competition_device_reports.js';
const id='11111111-1111-4111-8111-111111111111',issuedAt='2026-09-10T12:00:00.000Z';
const report={runId:id,serverIssuedAt:issuedAt,scramble:'R U',durationMs:1000,moves:[{move:'R',elapsedMs:0},{move:'U',elapsedMs:1000}],startFacelets:'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',endFacelets:'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',deviceBrand:'test',disconnected:false};
const app=new Hono().route('/v1',platformCompetitionDeviceReportRoutes),path=`/v1/platform/competitions/registrations/${id}/attempts/1/telemetry`;
const post=(suffix:string,body:unknown)=>app.request(path+suffix,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
let registration:Record<string,unknown>,attempt:Record<string,unknown>,runExists:boolean,reported:boolean;
beforeEach(()=>{
  vi.clearAllMocks();runExists=false;reported=false;
  registration={id,user_id:1,supervisor_user_id:2,status:'confirmed',checked_in_at:issuedAt,in_window:true,competition_project:'333',competition_video_generation:id};
  attempt={scramble:'R U',issued_at:issuedAt,recorded_at:null,elapsed_ms:10000};
  mocks.actor.mockResolvedValue({userId:1,isAdmin:false});mocks.ready.mockResolvedValue(true);
  mocks.query.mockImplementation(async(_db,sql,values)=>{
    if(sql.includes('SELECT r.id::text'))return [registration];
    if(sql.includes('SELECT scramble,issued_at'))return [attempt];
    if(sql.includes('INSERT INTO platform_competition_device_reports')){if(runExists)return [];runExists=true;return [{runId:id,startedAt:issuedAt}];}
    if(sql.includes('UPDATE platform_competition_device_reports')){if(!runExists||reported||values[3]!==id)return [];reported=true;return [{reportedAt:issuedAt}];}
    if(sql.includes('SELECT d.report'))return [{report,runId:id,reportedAt:issuedAt,user_id:1,supervisor_user_id:2}];
    return [];
  });
});
describe('device evidence input',()=>{
  it('rejects out-of-order, impossible timestamps, invalid stickers and missing binding',()=>{
    for(const patch of [{runId:''},{durationMs:1.5},{moves:[{move:'R',elapsedMs:1001}]},{moves:[{move:'R',elapsedMs:500},{move:'U',elapsedMs:100}]},{moves:[{move:'R3',elapsedMs:0}]},{startFacelets:'U'.repeat(54)},{serverIssuedAt:'yesterday'}])expect(()=>validateCompetitionDeviceReport({...report,...patch})).toThrow();
    expect(validateCompetitionDeviceReport(report).durationMs).toBe(1000);
    expect(validateCompetitionDeviceReport({...report,disconnected:true,moves:[]}).disconnected).toBe(true);
    expect(validateCompetitionDeviceReport({...report,disconnected:true,durationMs:0,moves:[]}).durationMs).toBe(0);
    expect(()=>validateCompetitionDeviceReport({...report,durationMs:0,moves:[]})).toThrow();
  });
});
describe('device run HTTP boundaries',()=>{
  it('binds one run and one report without creating a result',async()=>{
    expect((await post('',report)).status).toBe(409);
    expect((await post('/start',report)).status).toBe(201);
    expect((await post('/start',report)).status).toBe(409);
    expect((await post('',{...report,scramble:'U R'})).status).toBe(409);
    expect((await post('',report)).status).toBe(201);
    expect((await post('',report)).status).toBe(409);
    expect(mocks.query.mock.calls.some(call=>/UPDATE platform_(event_registrations|competition_attempts)/.test(call[1]))).toBe(false);
  });
  it.each([{status:'cancelled'},{checked_in_at:null},{in_window:false},{competition_project:'444'}])('rejects inactive registration %j',async patch=>{
    Object.assign(registration,patch);expect((await post('/start',report)).status).toBe(409);expect((await post('',report)).status).toBe(409);
  });
  it('allows only entrant mutations, never an administrator or supervisor override',async()=>{
    for(const actor of [{userId:2,isAdmin:false},{userId:3,isAdmin:true}]){mocks.actor.mockResolvedValue(actor);expect((await post('/start',report)).status).toBe(403);expect((await post('',report)).status).toBe(403);}
  });
  it('fails closed without both cameras and after supervisor confirmation',async()=>{
    mocks.ready.mockResolvedValue(false);expect((await post('/start',report)).status).toBe(409);
    mocks.ready.mockResolvedValue(true);attempt.recorded_at=issuedAt;expect((await post('/start',report)).status).toBe(409);expect((await post('',report)).status).toBe(409);
  });
  it('limits private reports to entrant, supervisor and dispute administrator',async()=>{
    mocks.actor.mockResolvedValue({userId:3,isAdmin:false});expect((await app.request(path)).status).toBe(403);
    mocks.actor.mockResolvedValue({userId:3,isAdmin:true});expect((await app.request(path)).status).toBe(200);
  });
});
