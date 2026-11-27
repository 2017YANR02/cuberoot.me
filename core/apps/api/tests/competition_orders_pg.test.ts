import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { forbidden, PlatformApiError } from '../src/platform/errors.js';

const state=vi.hoisted(()=>{
  const url=new URL(process.env.COMPETITION_TEST_DATABASE_URL??'postgres://fixture@127.0.0.1:1/fixture');
  if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Loopback PostgreSQL required');
  const schema=`competition_order_${process.pid}_${Math.random().toString(36).slice(2)}`;
  return {schema,settings:{host:url.hostname,port:Number(url.port)||5432,user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1),connection:{search_path:schema}},rooms:vi.fn(),participants:vi.fn(),retired:vi.fn()};
});
// Only the connection address changes: production query rewriting and transaction
// handling run against this suite's private schema.
vi.mock('../src/db/settings.js',()=>({databaseSettings:()=>state.settings}));
vi.mock('../src/utils/recon_helpers.js',()=>({checkRateLimit:vi.fn(),requireAuth:vi.fn()}));
vi.mock('livekit-server-sdk',async importOriginal=>({
  ...await importOriginal<typeof import('livekit-server-sdk')>(),
  RoomServiceClient:class {
    listRooms(){return state.rooms();}
    listParticipants(){return state.participants();}
    deleteRoom(room: string){state.retired(room);return Promise.resolve();}
  },
}));
vi.mock('../src/platform/payment.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/platform/payment.js')>(),
  paymentAvailability: () => ({ alipay: false, wechat: true }),
}));
vi.mock('../src/platform/auth.js',()=>({
  requirePlatformActor:async(c:{req:{header:(name:string)=>string|undefined}})=>{
    if (c.req.header('Test-Guest')) throw new PlatformApiError('UNAUTHENTICATED',401,'Login required');
    return {userId:Number(c.req.header('Test-User')??3),ownerKey:`user:${c.req.header('Test-User')??3}`,displayName:'Test entrant',isAdmin:c.req.header('Test-Admin')==='1',viaApiKey:false,wcaId:null};
  },
  requirePlatformAdmin:async(c:{req:{header:(name:string)=>string|undefined}})=>{
    if(c.req.header('Test-Admin')!=='1')forbidden('Admin access required');
    return {userId:1,ownerKey:'user:1',displayName:'Test administrator',isAdmin:true,viaApiKey:false,wcaId:null};
  },
}));
import { sql as db } from '../src/db/connection.js';
import { smartCubeTargetFacelets, SOLVED_SMART_CUBE_FACELETS } from '@cuberoot/shared/smart-cube/cubie';
import { TokenVerifier } from 'livekit-server-sdk';
const app=new Hono();
const databaseUrl=process.env.COMPETITION_TEST_DATABASE_URL;
const smartCheckIn = { deviceBrand: 'GAN', deviceName: 'GAN 16 test', facelets: SOLVED_SMART_CUBE_FACELETS };


describe.skipIf(!databaseUrl)('real competition order HTTP and PostgreSQL transaction',()=>{
  const schema=state.schema;
  const org=randomUUID(),event=randomUUID(),ticket=randomUUID(),session=randomUUID();
  let admin:ReturnType<typeof postgres>;
  const migration=(name:string)=>readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8');
  beforeAll(async()=>{
    if(!['localhost','127.0.0.1'].includes(new URL(databaseUrl!).hostname))throw new Error('Loopback PostgreSQL required');
    admin=postgres(databaseUrl!,{max:1,onnotice:()=>{}});await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    state.rooms.mockResolvedValue([]);state.participants.mockResolvedValue([]);
    vi.stubEnv('LIVEKIT_URL','wss://competition-fixture.invalid');
    vi.stubEnv('LIVEKIT_API_KEY','competition-fixture');
    vi.stubEnv('LIVEKIT_API_SECRET','competition-fixture-secret-do-not-use-in-production');
    const {platformCommerceRoutes}=await import('../src/routes/platform_commerce.js');
    const {platformCompetitionRoutes}=await import('../src/routes/platform_competitions.js');
    const {platformCompetitionAttemptRoutes}=await import('../src/routes/platform_competition_attempts.js');
    const {platformCompetitionBracketRoutes}=await import('../src/routes/platform_competition_brackets.js');
    const {platformCompetitionDeviceReportRoutes}=await import('../src/routes/platform_competition_device_reports.js');
    const {platformCompetitionEvidenceRoutes}=await import('../src/routes/platform_competition_evidence.js');
    const {platformContentRoutes}=await import('../src/routes/platform_content.js');
    const {videoRoomsRoutes}=await import('../src/routes/video_rooms.js');
    app.route('/v1/platform',platformCommerceRoutes).route('/v1',platformCompetitionRoutes).route('/v1',platformCompetitionAttemptRoutes).route('/v1',platformCompetitionBracketRoutes).route('/v1',platformCompetitionDeviceReportRoutes).route('/v1',platformCompetitionEvidenceRoutes).route('/v1',videoRoomsRoutes).route('/v1',platformContentRoutes);
    await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
      CREATE TABLE app_users(id BIGINT PRIMARY KEY, display_name TEXT NOT NULL DEFAULT '', is_admin BOOLEAN NOT NULL DEFAULT false, wca_id TEXT, country_iso2 TEXT, merged_into_user_id BIGINT);
      CREATE TABLE notifications(user_key TEXT,kind TEXT,actor_name TEXT,title TEXT,excerpt TEXT,link TEXT);
      CREATE TABLE teacher_directory_entries(id BIGINT PRIMARY KEY);`);
    await db.unsafe(migration('0142_teaching_foundation.sql').split('CREATE TABLE student_profiles')[0]);
    await db.unsafe(migration('0167_platform_core.sql'));
    await db.unsafe(migration('0224_online_competitions.sql'));
    await db.unsafe(migration('0225_competition_evidence.sql'));
    await db.unsafe(migration('0227_competition_device_reports.sql'));
    await db.unsafe(migration('0229_organizer_applications.sql'));
    await db.unsafe(migration('0260_platform_commerce_completion.sql'));
    await db.unsafe(migration('0354_competition_draft_setup.sql'));
    await db.unsafe(migration('0355_competition_draft_project_fee.sql'));
    await db.unsafe(migration('0356_competition_unified_workflow.sql'));
    await db.unsafe(migration('0357_competition_double_elimination.sql'));
    await db.unsafe(migration('0358_competition_timing_and_review.sql'));
    await db.unsafe(migration('0363_competition_arena.sql'));
    await db.unsafe(migration('0365_competition_test_mode.sql'));
    await db.unsafe(`INSERT INTO app_users(id) VALUES(1),(2),(3),(4);
      UPDATE app_users SET is_admin=true WHERE id=1;
      INSERT INTO organizations(id,slug,name,created_by_user_id,competition_organizer_approved_at) VALUES('${org}','order-test','Order test',1,NOW());
      INSERT INTO organization_members(organization_id,user_id,role,joined_at) VALUES('${org}',1,'owner',NOW()),('${org}',2,'teacher',NOW());
      INSERT INTO platform_events(id,slug,title_zh,title_en,status,starts_at,ends_at,timezone,published_at) VALUES('${event}','order-test','订单测试','Order test','published',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '3 hours','Asia/Shanghai',NOW());
      INSERT INTO platform_competitions(event_id,organization_id,registration_opens_at,registration_closes_at,commission_bps,settlement_days,settlement_anchor) VALUES('${event}','${org}',NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 minutes',0,0,'finalized');
      INSERT INTO platform_event_ticket_types(id,event_id,code,title_zh,title_en,amount_minor,currency,capacity,competition_project,competition_device) VALUES('${ticket}','${event}','333','三阶','3x3',0,'CNY',1,'333','ordinary');
      INSERT INTO platform_competition_sessions(id,event_id,starts_at,ends_at,capacity,supervisor_user_id) VALUES('${session}','${event}',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '2 hours',1,2);`);
  },60_000);
  afterAll(async()=>{await db.end();if(admin){await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}vi.unstubAllEnvs();});
  const request=(user:number,key:string,clientOrderKey:string)=>app.request('/v1/platform/orders',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,'Test-User':String(user)},body:JSON.stringify({clientOrderKey,items:[{sellableType:'event_ticket',eventTicketTypeId:ticket,quantity:1,competitionSessionId:session,device:'ordinary'}]})});
  const myEntries = (user: number) => app.request('/v1/platform/competitions/me/entries?v=2&userId=3', {
    headers: { 'Test-User': String(user) },
  });
  it('returns project arrays, registration dates and numeric zero prices in both lists',async()=>{
    for(const path of ['/v1/platform/competitions','/v1/platform/competitions/manage']){
      const response=await app.request(path,{headers:{'Test-User':'1'}});expect(response.status).toBe(200);
      const data=await response.json();expect(data.competitions).toHaveLength(1);
      expect(data.competitions[0]).toMatchObject({id:event,projects:[{id:ticket,project:'333',device:'ordinary',amountMinor:0,currency:'CNY',capacity:1}]});
      expect(Date.parse(data.competitions[0].registrationClosesAt)).toBeGreaterThan(Date.parse(data.competitions[0].registrationOpensAt));
    }
  });
  it('restricts the registration and receipts overview to competitions the caller manages', async () => {
    const overview = (headers: Record<string, string>) => app.request('/v1/platform/competitions/host/overview', { headers });
    const owner = await overview({ 'Test-User': '1' });
    expect(owner.status).toBe(200);
    expect(owner.headers.get('cache-control')).toContain('no-store');
    expect(await owner.json()).toMatchObject({
      currency: 'CNY',
      competitionCount: 1,
      totals: { registered: 0, netCollectedMinor: '0', refundedMinor: '0', organizerAmountMinor: '0' },
      competitions: [{ id: event, registered: 0 }],
    });
    const unrelated = await overview({ 'Test-User': '3' });
    expect(await unrelated.json()).toMatchObject({ competitionCount: 0, competitions: [] });
    const administrator = await overview({ 'Test-User': '3', 'Test-Admin': '1' });
    expect(await administrator.json()).toMatchObject({ competitionCount: 1, competitions: [{ id: event }] });
  });
  it('lists and edits ordinary activities without exposing competitions in the activity collection', async () => {
    const list = '/v1/platform/admin/activities';
    const adminHeaders = { 'Test-Admin': '1' };
    const writeHeaders = () => ({ ...adminHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() });
    const details = {
      slug: 'activity-fixture', titleZh: '周末线下活动', titleEn: 'Weekend event',
      startsAt: '2030-04-04T04:00:00.000Z', endsAt: '2030-04-04T07:00:00.000Z', timezone: 'Asia/Shanghai',
      venue: {}, tickets: null,
    };
    expect((await app.request(list, { headers: { 'Test-User': '1' } })).status).toBe(403);
    const created = await app.request('/v1/platform/admin/events', { method: 'POST', headers: writeHeaders(), body: JSON.stringify(details) });
    const result = await created.json();
    expect(created.status, JSON.stringify(result)).toBe(201);
    const activityId = result.event.id;
    const listing = await app.request(list + '?pageSize=1', { headers: adminHeaders });
    expect(await listing.json()).toMatchObject({ total: 1, events: [{ id: activityId }] });
    expect((await app.request(list + '/' + event, { headers: adminHeaders })).status).toBe(404);
    const patched = await app.request('/v1/platform/admin/events/' + activityId, {
      method: 'PATCH', headers: writeHeaders(), body: JSON.stringify({ ...details, titleZh: '更新后的线下活动' }),
    });
    expect(patched.status, await patched.text()).toBe(200);
    const response = await app.request(list + '/' + activityId, { headers: adminHeaders });
    expect(await response.json()).toMatchObject({ event: { id: activityId, titleZh: '更新后的线下活动' } });
  });
  it('saves multiple divisions, returns a rejection note, and publishes an approved staffed draft', async () => {
    const base = '/v1/platform/competitions';
    const now = Date.now();
    const time = (hours: number) => new Date(now + hours * 3600000).toISOString();
    const fields = {
      titleZh: '监督赛', organizationId: org, slug: 'reviewed-draft', format: 'average',
      supervisionMode: 'supervised', registrationOpensAt: time(1), registrationClosesAt: time(2),
      startsAt: time(4), endsAt: time(6), refundPolicy: 'Before start', recordingPolicy: 'Local evidence',
      projects: [{ project: '333', device: 'smart', amountMinor: 0, capacity: 16 },
        { project: 'minx', device: 'ordinary', amountMinor: 900, capacity: 8 }],
      sessions: [{ startsAt: time(4), endsAt: time(6), capacity: 24, assistanceRequested: true }],
    };
    const mutate = (path: string, body: unknown, options: { method?: string; admin?: boolean; user?: number } = {}) => app.request(base + path, {
      method: options.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), 'Test-User': String(options.user ?? 1),
        ...(options.admin ? { 'Test-Admin': '1' } : {}) },
      body: JSON.stringify(body),
    });
    expect((await mutate('/drafts', fields, { user: 2 })).status).toBe(403);
    expect((await mutate('/drafts', { ...fields, projects: [fields.projects[0], fields.projects[0]] })).status).toBe(400);
    const created = await mutate('/drafts', fields);
    const input = await created.json();
    expect(created.status, JSON.stringify(input)).toBe(201);
    const draftId = input.id;
    expect(await (await mutate('/' + draftId + '/submit', { commissionBps: 9999 })).json()).toMatchObject({ status: 'pending_approval' });
    expect((await app.request(base + '/review-queue')).status).toBe(403);
    expect(await (await app.request(base + '/review-queue', { headers: { 'Test-Admin': '1' } })).json()).toMatchObject({ competitions: [{ id: draftId }] });
    expect((await mutate('/' + draftId + '/review', { decision: 'reject' }, { admin: true })).status).toBe(400);
    expect((await mutate('/' + draftId + '/review', { decision: 'reject', note: 'Add judging details' }, { admin: true })).status).toBe(200);
    expect((await db.unsafe('SELECT review_status,review_note,commission_bps FROM platform_competitions WHERE event_id=$1', [draftId]))[0])
      .toMatchObject({ review_status: 'rejected', review_note: 'Add judging details', commission_bps: null });
    expect((await mutate('/drafts/' + draftId, fields, { method: 'PUT' })).status).toBe(200);
    expect((await mutate('/' + draftId + '/submit', {})).status).toBe(200);
    const [slot] = await db.unsafe('SELECT id FROM platform_competition_sessions WHERE event_id=$1', [draftId]);
    expect((await mutate('/' + draftId + '/review', { decision: 'approve' }, { admin: true })).status).toBe(409);
    const settings = { decision: 'approve', supervisorAssignments: [{ sessionId: slot.id, supervisorUserId: 1 }] };
    expect((await mutate('/' + draftId + '/review', settings, { admin: true })).status).toBe(409);
    expect((await db.unsafe('SELECT supervisor_user_id FROM platform_competition_sessions WHERE id=$1', [slot.id]))[0].supervisor_user_id).toBeNull();
    const queue = await (await app.request(base + '/review-queue', { headers: { 'Test-Admin': '1' } })).json();
    expect(queue.competitions[0]).toMatchObject({ sessions: [{ assistanceRequested: true, staffed: false }], projects: expect.arrayContaining(fields.projects.map(project => expect.objectContaining(project))) });
    expect((await mutate('/' + draftId + '/review', { ...settings, submittedAt: time(-20) }, { admin: true })).status).toBe(409);
    const approved = await mutate('/' + draftId + '/review', {
      ...settings, submittedAt: queue.competitions[0].submittedAt, commissionBps: 1250, settlementDays: 7, settlementAnchor: 'finalized',
    }, { admin: true });
    expect(approved.status, await approved.text()).toBe(200);
    expect(await (await app.request(base + '/' + draftId)).json()).toMatchObject({
      competition: { status: 'published', reviewStatus: 'approved', reviewNote: '', supervisionMode: 'supervised', commissionBps: 1250, settlementDays: 7, settlementAnchor: 'finalized',
        sessions: [{ staffed: true }], projects: expect.arrayContaining(fields.projects.map(project => expect.objectContaining(project))) },
    });
    expect(await db.unsafe("SELECT kind FROM notifications WHERE user_key='u1' ORDER BY kind"))
      .toEqual([{ kind: 'competition_approved' }, { kind: 'competition_rejected' }]);
  });


  it('fulfills a free entry with object snapshots and replays exactly once',async()=>{
    const key=randomUUID(),clientKey=randomUUID();
    const response=await request(3,key,clientKey);
    const body=await response.json();expect(response.status,JSON.stringify(body)).toBe(201);expect(body.status).toBe('fulfilled');
    const orderNumber=(await db.unsafe(`SELECT order_number FROM platform_orders WHERE id=$1`,[body.id]))[0].order_number;
    for(const identifier of [body.id,orderNumber]) {
      const detail=await app.request(`/v1/platform/orders/${identifier}`,{headers:{'Test-User':'3'}});
      expect(detail.status).toBe(200);expect(await detail.json()).toMatchObject({id:body.id,status:'fulfilled',items:[{sellableType:'event_ticket'}]});
      expect((await app.request(`/v1/platform/orders/${identifier}`,{headers:{'Test-User':'4'}})).status).toBe(404);
    }
    const replay=await request(3,key,clientKey);expect(replay.status).toBe(201);expect(await replay.json()).toEqual(body);expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    const rows=await db.unsafe(`SELECT o.status,jsonb_typeof(o.pricing_snapshot) pricing_type,jsonb_typeof(i.sellable_snapshot) item_type,jsonb_typeof(i.revenue_share_snapshot) share_type,r.status registration_status FROM platform_orders o JOIN platform_order_items i ON i.order_id=o.id JOIN platform_event_registrations r ON r.order_item_id=i.id WHERE o.id=$1`,[body.id]);
    expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({status:'fulfilled',pricing_type:'object',item_type:'object',share_type:'array',registration_status:'confirmed'});
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_orders`))[0].n).toBe(1);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_fulfillment_ledger WHERE entry_type='grant'`))[0].n).toBe(1);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_outbox_events WHERE jsonb_typeof(payload)<>'object'`))[0].n).toBe(0);
    expect(await (await app.request(`/v1/platform/competitions/${event}`)).json())
      .toMatchObject({ competition: { projects: [{ id: ticket, available: 0 }], sessions: [{ id: session, available: 0 }] } });
    const entries = await myEntries(3);
    expect(entries.status).toBe(200);
    expect(entries.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await entries.json()).toMatchObject({ entries: [{ competitionId: event, orderId: body.id, action: 'upcoming' }] });
    expect(await (await myEntries(4)).json()).toEqual({ entries: [] });
  },30_000);
  it('rejects duplicate project and last-seat oversell through the actual order endpoint',async()=>{
    const duplicate=await request(3,randomUUID(),randomUUID());expect(duplicate.status).toBe(409);
    const full=await request(4,randomUUID(),randomUUID());expect(full.status).toBe(409);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_orders`))[0].n).toBe(1);
  },30_000);
  it('admits only the checked-in entrant and assigned supervisor and signs restricted room credentials',async()=>{
    const registration=(await db.unsafe(`SELECT id,competition_video_generation generation FROM platform_event_registrations WHERE user_id=3`))[0];
    const token=(user:number)=>app.request('/v1/video/competition/token',{method:'POST',headers:{'Content-Type':'application/json','Test-User':String(user)},body:JSON.stringify({registrationId:registration.id})});
    // Before the session and before check-in neither party may obtain credentials.
    expect((await token(3)).status).toBe(403);
    await db.unsafe(`UPDATE platform_competition_sessions SET starts_at=NOW()-INTERVAL '1 minute' WHERE id=$1`,[session]);
    expect(await (await myEntries(3)).json()).toMatchObject({ entries: [{ registrationId: registration.id, device: 'ordinary', action: 'check_in' }] });
    expect((await token(3)).status).toBe(403);
    await db.unsafe(`UPDATE platform_event_registrations SET checked_in_at=NOW() WHERE id=$1`,[registration.id]);
    expect(await (await myEntries(3)).json()).toMatchObject({ entries: [{ registrationId: registration.id, action: 'enter' }] });
    expect((await token(1)).status).toBe(403);
    expect((await token(4)).status).toBe(403);
    const verifier=new TokenVerifier('competition-fixture','competition-fixture-secret-do-not-use-in-production');
    for(const user of [2,3]){
      const response=await token(user);expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');
      const body=await response.json();const room=`competition-${registration.id}-${registration.generation}`;
      expect(body).toMatchObject({identity:`u${user}`,room,maxParticipants:2,url:'wss://competition-fixture.invalid'});
      const claims=await verifier.verify(body.token);
      expect(claims).toMatchObject({sub:`u${user}`,video:{roomJoin:true,room,canPublish:true,canSubscribe:true,canPublishData:false,canPublishSources:['camera','microphone']},roomConfig:{maxParticipants:2}});
    }
    // Simulate a committed reassignment/refund while the external capacity lookup is in flight.
    state.rooms.mockImplementationOnce(async()=>{await db.unsafe(`UPDATE platform_event_registrations SET competition_video_generation=gen_random_uuid() WHERE id=$1`,[registration.id]);return [];});
    expect((await token(3)).status).toBe(409);
    state.rooms.mockImplementationOnce(async()=>{await db.unsafe(`UPDATE platform_event_registrations SET status='refunded',cancelled_at=NOW() WHERE id=$1`,[registration.id]);return [];});
    expect((await token(3)).status).toBe(403);
    await db.unsafe(`UPDATE platform_event_registrations SET status='confirmed',cancelled_at=NULL WHERE id=$1`,[registration.id]);
  },30_000);
  it('stores only authoritative five-attempt results as JSON arrays and ranks the round',async()=>{
    const registration=(await db.unsafe(`SELECT id,competition_video_generation generation FROM platform_event_registrations WHERE user_id=3`))[0];
    await db.unsafe(`UPDATE platform_events SET starts_at=NOW()-INTERVAL '1 minute' WHERE id=$1`,[event]);
    await db.unsafe(`UPDATE platform_competition_sessions SET starts_at=NOW()-INTERVAL '1 minute' WHERE id=$1`,[session]);
    await db.unsafe(`UPDATE platform_event_registrations SET checked_in_at=NOW() WHERE id=$1`,[registration.id]);
    const finish=(user:number)=>app.request(`/v1/platform/competitions/registrations/${registration.id}/result`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID(),'Test-User':String(user)},body:'{}'});
    expect((await finish(3)).status).toBe(403);
    expect((await finish(2)).status).toBe(400);
    await db.unsafe(`INSERT INTO platform_competition_attempts(registration_id,attempt_number,scramble,centiseconds,penalty,recorded_by,recorded_at) SELECT $1,n,'R U',900+n*100,'none',2,NOW() FROM generate_series(1,5) AS n`,[registration.id]);
    const desk = await app.request(`/v1/platform/competitions/${event}/registrations`, { headers: { 'Test-User': '2' } });
    expect(await desk.json()).toMatchObject({ registrations: [{ id: registration.id, attemptNumber: 5 }] });
    expect((await finish(2)).status).toBe(200);
    const recorded=(await db.unsafe(`SELECT status,competition_video_generation generation,jsonb_typeof(competition_attempts) json_type FROM platform_event_registrations WHERE id=$1`,[registration.id]))[0];
    expect(recorded.status).toBe('attended');expect(recorded.json_type).toBe('array');expect(recorded.generation).not.toBe(registration.generation);
    const videoAfterResult=await app.request('/v1/video/competition/token',{method:'POST',headers:{'Content-Type':'application/json','Test-User':'3'},body:JSON.stringify({registrationId:registration.id})});
    expect(videoAfterResult.status).toBe(403);
    const results=await (await app.request(`/v1/platform/competitions/${event}/results`)).json();
    expect(results.results).toHaveLength(1);expect(results.results[0]).toMatchObject({averageCentiseconds:1200,bestCentiseconds:1000,rank:1});
  },30_000);
  it('auto-binds self-service and offline orders, accepts five self attempts and validates offline results', async () => {
    const base = '/v1/platform/competitions';
    const now = Date.now();
    const time = (hours: number) => new Date(now + hours * 3600000).toISOString();
    const post = (url: string, body: unknown, user = 3, admin = false) => app.request(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), 'Test-User': String(user),
        ...(admin ? { 'Test-Admin': '1' } : {}) }, body: JSON.stringify(body),
    });
    const scores = Array.from({ length: 5 }, (_, index) => ({ centiseconds: 1200 + index * 100, penalty: 'none' }));
    for (const mode of ['self_service', 'offline'] as const) {
      const created = await post(base + '/drafts', {
        titleZh: mode, organizationId: org, slug: mode, format: 'average', supervisionMode: mode,
        registrationOpensAt: time(-2), registrationClosesAt: time(1), startsAt: time(2), endsAt: time(4),
        refundPolicy: 'Refund policy', recordingPolicy: 'Recording policy',
        offlineVenue: { city: 'Shanghai', address: 'Venue' },
        projects: [{ project: '333', device: 'ordinary', amountMinor: 0, capacity: 8 },
          { project: '333', device: 'smart', amountMinor: 0, capacity: 8 }],
      }, 1, true);
      const draft = await created.json();
      expect(created.status, JSON.stringify(draft)).toBe(201);
      const publish = await post(base + '/' + draft.id + '/submit', {}, 1, true);
      expect(publish.status, await publish.text()).toBe(200);
      const detail = await (await app.request(base + '/' + draft.id)).json();
      expect(detail.competition.sessions).toMatchObject([{ kind: mode, capacity: 16 }]);
      const orderFor = (p: { id: string; device: string }) => post('/v1/platform/orders', {
        clientOrderKey: randomUUID(), items: [{ sellableType: 'event_ticket', eventTicketTypeId: p.id, quantity: 1, device: p.device }],
      });
      for (const p of detail.competition.projects) {
        const order = await orderFor(p);
        expect(order.status, await order.text()).toBe(201);
      }
      expect((await orderFor(detail.competition.projects[0])).status).toBe(409);
      if (mode === 'self_service') {
        const division = detail.competition.projects.find((p: { device: string }) => p.device === 'smart');
        for (const user of [2, 4]) {
          expect((await post('/v1/platform/orders', { items: [{ eventTicketTypeId: division.id, quantity: 1, device: 'smart' }] }, user)).status).toBe(201);
        }
      }
      const [entry] = await db.unsafe(`SELECT r.id FROM platform_event_registrations r JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
        WHERE r.event_id=$1 AND t.competition_device='ordinary'`, [draft.id]);
      await db.unsafe("UPDATE platform_events SET starts_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [draft.id]);
      await db.unsafe("UPDATE platform_competition_sessions SET starts_at=NOW()-INTERVAL '1 minute' WHERE event_id=$1", [draft.id]);
      const registration = base + '/registrations/' + entry.id;
      if (mode === 'offline') {
        expect((await post(registration + '/check-in', {})).status).toBe(409);
        const [smartEntry] = await db.unsafe(`SELECT r.id FROM platform_event_registrations r JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
          WHERE r.event_id=$1 AND t.competition_device='smart'`, [draft.id]);
        expect((await post(base + '/' + draft.id + '/offline-results', { results: [{ registrationId: smartEntry.id, attempts: scores }] }, 1)).status).toBe(409);
        expect((await post(base + '/' + draft.id + '/offline-results', { results: [{ registrationId: entry.id, attempts: scores }] })).status).toBe(403);
        const result = await post(base + '/' + draft.id + '/offline-results', { results: [{ registrationId: entry.id, attempts: scores }] }, 1);
        expect(result.status, await result.text()).toBe(200);
      } else {
        expect((await post(registration + '/self-attempts/next', {})).status).toBe(409);
        expect((await post(registration + '/check-in', {})).status).toBe(200);
        expect((await post(registration + '/self-attempts/next', {}, 4)).status).toBe(403);
        expect((await post(registration + '/arena', {})).status).toBe(200);
        const arena = (id: string, user = 3) => app.request(id + '/arena', { headers: { 'Test-User': String(user) } });
        for (const [index, score] of scores.entries()) {
          const next = await arena(registration);
          const body = await next.json();
          expect(next.status, JSON.stringify(body)).toBe(200);
          expect(body.roundNumber).toBe(index + 1);
          if (index > 0) expect(body.scramble).toBeNull();
          await db.unsafe("UPDATE platform_competition_arena_rounds SET starts_at=clock_timestamp()-INTERVAL '1 minute' WHERE id=$1", [body.roomId]);
          await db.unsafe("UPDATE platform_competition_attempts SET issued_at=clock_timestamp()-INTERVAL '1 minute' WHERE registration_id=$1 AND attempt_number=$2", [entry.id, index + 1]);
          expect(await (await arena(registration)).json()).toMatchObject({ roundNumber: index + 1, scramble: expect.any(String) });
          const complete = registration + '/self-attempts/' + (index + 1) + '/complete';
          if (index === 0) {
            expect((await post(complete, score)).status).toBe(400);
            const clipId = randomUUID();
            await db.unsafe(`INSERT INTO platform_competition_evidence(id,registration_id,uploaded_by,mime,size_bytes,attempt_number)
              VALUES($1,$2,3,'video/mp4',100,1)`, [clipId, entry.id]);
            expect((await post(complete, { ...score, recordingEvidenceId: randomUUID() })).status).toBe(400);
            const attached = await post(complete, { ...score, recordingEvidenceId: clipId });
            expect(attached.status, await attached.clone().text()).toBe(200);
            const listEvidence = (user: string) => app.request(registration + '/evidence', { headers: { 'Test-User': user } });
            expect(await (await listEvidence('1')).json()).toMatchObject({ evidence: [{ id: clipId, attemptNumber: 1 }] });
            expect((await listEvidence('4')).status).toBe(403);
            const review = registration + '/review-clear';
            expect((await post(review, { attemptNumber: 1, decision: 'approve' }, 4)).status).toBe(403);
            const cleared = await post(review, { attemptNumber: 1, decision: 'approve' }, 1);
            expect(cleared.status, await cleared.clone().text()).toBe(200);
            expect(await cleared.json()).toMatchObject({ reviewRequired: false, centiseconds: score.centiseconds, penalty: 'none' });
            continue;
          }
          const response = await post(complete, { ...score, recordedLocally: true });
          expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
          expect(await response.json()).toEqual({ finished: index === 4 });
        }
      }
      let replayEndpoint: string | undefined;
      if (mode === 'self_service') {
        const [late, entry, peer] = await db.unsafe(`SELECT r.id FROM platform_event_registrations r JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
          WHERE r.event_id=$1 AND t.competition_device='smart' ORDER BY r.user_id`, [draft.id]);
        const smart = base + '/registrations/' + entry.id;
        const opponent = base + '/registrations/' + peer.id;
        const snapshot = (entry: string, user: number) => app.request(entry + '/arena', { headers: { 'Test-User': String(user) } }).then(res => res.json());
        expect(await snapshot(smart, 3)).toMatchObject({ checkedIn: false, roomId: null, seated: false, scramble: null, credentials: null });
        expect((await post(smart + '/arena', {})).status).toBe(409);
        for (const invalid of [{}, { ...smartCheckIn, deviceBrand: ' ' }, { ...smartCheckIn, deviceName: 'x'.repeat(101) },
          { ...smartCheckIn, facelets: 'U'.repeat(54) }, { ...smartCheckIn, facelets: 'X' + smartCheckIn.facelets.slice(1) },
          { ...smartCheckIn, facelets: smartCheckIn.facelets.slice(1) }, { ...smartCheckIn, facelets: smartCheckIn.facelets + ' ' }]) {
          expect((await post(smart + '/check-in', invalid)).status).toBe(400);
        }
        expect((await db.unsafe('SELECT checked_in_at FROM platform_event_registrations WHERE id=$1', [entry.id]))[0].checked_in_at).toBeNull();
        expect((await post(smart + '/check-in', smartCheckIn)).status).toBe(200);
        const ready = await post(smart + '/arena', {});
        expect(ready.status, await ready.clone().text()).toBe(200);
        const initial = await snapshot(smart, 3);
        expect(initial).toMatchObject({ roundNumber: 1, seated: true, scramble: null });
        expect(Date.parse(initial.startsAt) - Date.parse(initial.serverNow)).toBeGreaterThan(4000);
        expect(Date.parse(initial.startsAt) - Date.parse(initial.serverNow)).toBeLessThanOrEqual(5000);
        expect(await db.unsafe('SELECT registration_id FROM platform_competition_attempts WHERE registration_id=$1', [late.id])).toEqual([]);
        await db.unsafe("UPDATE platform_competition_arena_rounds SET starts_at=clock_timestamp()-INTERVAL '30 seconds' WHERE id=$1", [initial.roomId]);
        await db.unsafe('UPDATE platform_competition_attempts SET issued_at=(SELECT starts_at FROM platform_competition_arena_rounds WHERE id=$1) WHERE arena_round_id=$1', [initial.roomId]);
        const first = await snapshot(smart, 3);
        expect(first.scramble).toEqual(expect.any(String));
        expect(first.players.map((player: { id: string }) => player.id)).toEqual([entry.id]);
        expect(await (await myEntries(4)).json()).toMatchObject({
          entries: [expect.objectContaining({ registrationId: peer.id, device: 'smart', action: 'check_in' })],
        });
        expect(await snapshot(opponent, 4)).toMatchObject({ checkedIn: false, roomId: null, seated: false, scramble: null, credentials: null });
        expect((await post(opponent + '/check-in', smartCheckIn, 4)).status).toBe(200);
        expect(await snapshot(opponent, 4)).toMatchObject({ checkedIn: true, roomId: first.roomId, seated: false, scramble: null, credentials: null });
        expect((await post(opponent + '/arena', {}, 4)).status).toBe(200);
        expect(await snapshot(opponent, 4)).toMatchObject({ checkedIn: true, seated: true, roundNumber: 1, startsAt: first.startsAt, scramble: first.scramble });
        const { authorizeCompetitionLive } = await import('../src/platform/competition_live.js');
        expect(await authorizeCompetitionLive(first.roomId, first.credentials)).toBe(true);
        expect(await authorizeCompetitionLive(first.roomId, { ...first.credentials, playerId: '000004' })).toBe(false);
        const endpoint = smart + '/attempts/1/telemetry';
        replayEndpoint = endpoint;
        const bind = { serverIssuedAt: first.startsAt, scramble: first.scramble, startFacelets: smartCubeTargetFacelets(first.scramble) };
        const start = await post(endpoint + '/start', bind);
        expect(start.status, await start.clone().text()).toBe(201);
        const { runId } = await start.json();
        await db.unsafe("UPDATE platform_competition_device_reports SET started_at=clock_timestamp()-INTERVAL '25 seconds' WHERE registration_id=$1", [entry.id]);
        await db.unsafe("UPDATE platform_competition_attempts SET inspect_at=clock_timestamp()-INTERVAL '25 seconds' WHERE registration_id=$1", [entry.id]);
        const autoStarted = await snapshot(smart, 3);
        expect(Date.parse(autoStarted.solveAt) - Date.parse(autoStarted.inspectAt)).toBe(16_300);
        const inverse = (first.scramble as string).split(/\s+/).reverse();
        const moves = inverse.map((move, index) => ({
          move: move.endsWith("'") ? move.slice(0, -1) : move.endsWith('2') ? move : move + "'", elapsedMs: Math.round((index + 1) * 4500 / inverse.length),
        }));
        const report = { ...bind, runId, durationMs: 4500, inspectionMs: 16300, moves, endFacelets: SOLVED_SMART_CUBE_FACELETS,
          deviceBrand: 'fixture', disconnected: false };
        expect((await post(smart + '/self-attempts/1/complete', scores[0])).status).toBe(409);
        expect((await post(endpoint, { ...report, moves: [{ move: 'R', elapsedMs: 0 }] })).status).toBe(400);
        const telemetry = await post(endpoint, report);
        expect(telemetry.status, await telemetry.text()).toBe(201);
        expect(await snapshot(smart, 3)).toMatchObject({ roundNumber: 1, scramble: first.scramble });
        expect((await db.unsafe("SELECT centiseconds,penalty,review_required FROM platform_competition_attempts WHERE registration_id=$1", [entry.id]))[0])
          .toMatchObject({ centiseconds: 450, penalty: 'none', review_required: false });
        await db.unsafe("UPDATE platform_competition_arena_rounds SET starts_at=clock_timestamp()-INTERVAL '120 seconds' WHERE id=$1", [first.roomId]);
        const countdown = await snapshot(smart, 3);
        expect(countdown).toMatchObject({ roundNumber: 2, scramble: null, players: expect.arrayContaining([
          expect.objectContaining({ id: peer.id, attempts: [expect.objectContaining({ penalty: 'DNF', dnfReason: 'scramble_timeout' })] }),
        ]) });
        expect(Date.parse(countdown.startsAt) - Date.parse(countdown.serverNow)).toBeGreaterThan(6000);
        expect(Date.parse(countdown.startsAt) - Date.parse(countdown.serverNow)).toBeLessThanOrEqual(7000);
        const list = await app.request(smart + '/attempts', { headers: { 'Test-User': '3' } }).then(res => res.json());
        expect(list.attempts).toEqual([expect.objectContaining({ attemptNumber: 1, synchronized: true })]);
        expect((await post(opponent + '/arena/phase', { attemptNumber: 2, phase: 'disconnected' }, 4)).status).toBe(409);
        await db.unsafe("UPDATE platform_competition_arena_rounds SET starts_at=clock_timestamp()-INTERVAL '140 seconds' WHERE id=$1", [first.roomId]);
        await db.unsafe("UPDATE platform_competition_attempts SET issued_at=clock_timestamp()-INTERVAL '90 seconds' WHERE arena_round_id=$1 AND attempt_number=2", [first.roomId]);
        await db.unsafe("UPDATE platform_competition_arena_rounds SET starts_at=clock_timestamp()-INTERVAL '90 seconds' WHERE id=$1", [first.roomId]);
        const second = await snapshot(smart, 3);
        expect(await snapshot(opponent, 4)).toMatchObject({ roundNumber: 2, scramble: second.scramble });
        const lateSeat = base + '/registrations/' + late.id;
        expect((await post(lateSeat + '/check-in', smartCheckIn, 2)).status).toBe(200);
        const joins = await Promise.all([post(lateSeat + '/arena', {}, 2), post(lateSeat + '/arena', {}, 2)]);
        for (const join of joins) expect(join.status, await join.clone().text()).toBe(200);
        const lateSnapshots = await Promise.all([snapshot(lateSeat, 2), snapshot(lateSeat, 2)]);
        for (const joined of lateSnapshots) expect(joined).toMatchObject({
          roomId: first.roomId, roundNumber: 2, seated: true, scramble: second.scramble,
          players: expect.arrayContaining([{ id: late.id, name: expect.any(String), wcaId: null, countryCode: null, attempts: [
            expect.objectContaining({ attemptNumber: 1, penalty: 'DNF', replay: false }),
            expect.objectContaining({ attemptNumber: 2, penalty: null }),
          ] }]),
        });
        expect(await db.unsafe('SELECT attempt_number,scramble FROM platform_competition_attempts WHERE registration_id=$1 ORDER BY attempt_number', [late.id]))
          .toEqual([{ attempt_number: 1, scramble: '' }, { attempt_number: 2, scramble: second.scramble }]);
        expect(await (await post(lateSeat + '/arena/phase', { attemptNumber: 2, phase: 'disconnected' }, 2)).json()).toEqual({ dnfReason: 'disconnected' });
        const lost = await post(opponent + '/arena/phase', { attemptNumber: 2, phase: 'disconnected' }, 4);
        expect(await lost.json()).toEqual({ dnfReason: 'disconnected' });
        await db.unsafe("UPDATE platform_competition_attempts SET inspect_at=clock_timestamp()-INTERVAL '137 seconds' WHERE registration_id=$1 AND attempt_number=2", [entry.id]);
        const { sweepCompetitionArenas } = await import('../src/platform/competition_arena.js');
        const { platformTransaction } = await import('../src/platform/db.js');
        await platformTransaction(sweepCompetitionArenas);
        expect(await snapshot(smart, 3)).toMatchObject({ roundNumber: 3, scramble: null, players: expect.arrayContaining([
          expect.objectContaining({ id: entry.id, attempts: [expect.anything(), expect.objectContaining({ penalty: 'DNF', dnfReason: 'solve_timeout' })] }),
        ]) });
      }
      expect(await (await app.request(base + '/' + draft.id + '/results')).json()).toMatchObject({
        results: [{ id: entry.id, device: 'ordinary', rank: 1, averageCentiseconds: 1400, attempts: scores }],
      });
      if (replayEndpoint) {
        const changed = await post(registration + '/review-clear', { attemptNumber: 5, decision: 'DNF' }, 1, true);
        expect(changed.status, await changed.clone().text()).toBe(200);
        expect(await changed.json()).toMatchObject({ reviewRequired: false, centiseconds: null, penalty: 'DNF' });
        expect(await db.unsafe(`SELECT metadata FROM platform_audit_events WHERE resource_id=$1 AND action='competition.self_attempt_review' ORDER BY occurred_at`, [entry.id]))
          .toMatchObject([{ metadata: { attemptNumber: 1, decision: 'approve' } }, { metadata: { attemptNumber: 5, decision: 'DNF', previous: scores[4] } }]);
        expect(await (await app.request(base + '/' + draft.id + '/results')).json()).toMatchObject({
          results: [{ id: entry.id, rank: 1, averageCentiseconds: 1400, attempts: [...scores.slice(0,4), { centiseconds: null, penalty: 'DNF' }] }],
        });
        const guest = { headers: { 'Test-Guest': '1' } };
        expect((await app.request(replayEndpoint, guest)).status).toBe(401);
        expect((await app.request(replayEndpoint, { headers: { 'Test-User': '1' } })).status).toBe(403);
        expect(await (await app.request(replayEndpoint, { headers: { 'Test-User': '3' } })).json()).toMatchObject({ report: { deviceBrand: 'fixture' } });
        await db.unsafe("UPDATE platform_events SET ends_at=NOW()-INTERVAL '1 second' WHERE id=$1", [draft.id]);
        await db.unsafe("UPDATE platform_competition_sessions SET ends_at=NOW()-INTERVAL '1 second' WHERE event_id=$1", [draft.id]);
        expect((await post(base + '/' + draft.id + '/close-sessions', {}, 1, true)).status).toBe(200);
        expect((await post(base + '/' + draft.id + '/finalize', {}, 1, true)).status).toBe(200);
        const replay = await app.request(replayEndpoint, guest);
        expect(replay.status, await replay.clone().text()).toBe(200);
        expect(await replay.json()).toMatchObject({ report: { scramble: expect.any(String), durationMs: 4500, moves: expect.any(Array), inspectionMs: 16300 } });
        const scoreboard = await (await app.request(base + '/' + draft.id + '/results')).json();
        expect(scoreboard.results.find((row: { replayAttempts?: number[] }) => row.replayAttempts?.length).replayAttempts).toEqual([1]);
        expect((await post(registration + '/review-clear', { attemptNumber: 2, decision: 'approve' }, 1, true)).status).toBe(409);
      }
    }
  }, 30000);

  async function createBracket(slug: string, users: number[], device: 'ordinary' | 'smart' = 'ordinary') {
    const base = '/v1/platform/competitions';
    const time = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
    const post = (path: string, body: unknown, user: number, admin = false) => app.request(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(),
        'Test-User': String(user), ...(admin ? { 'Test-Admin': '1' } : {}) }, body: JSON.stringify(body),
    });
    const create = await post(base + '/drafts', {
      titleEn: 'Bracket test', organizationId: org, slug, format: 'advancement', supervisionMode: 'self_service',
      registrationOpensAt: time(-2), registrationClosesAt: time(1), startsAt: time(2), endsAt: time(4),
      refundPolicy: 'Refund policy', recordingPolicy: 'Recording policy',
      projects: [{ project: '333', device, amountMinor: 0, capacity: 16 }],
    }, 1, true);
    const draft = await create.json();
    expect(create.status, JSON.stringify(draft)).toBe(201);
    const path = base + '/' + draft.id;
    expect((await post(path + '/submit', {}, 1, true)).status).toBe(200);
    expect((await post(path + '/brackets/generate', {}, 1)).status).toBe(409);
    const detail = (await (await app.request(path)).json()).competition;
    for (const user of users) {
      const order = await post('/v1/platform/orders', { clientOrderKey: randomUUID(),
        items: [{ sellableType: 'event_ticket', eventTicketTypeId: detail.projects[0].id, quantity: 1, device }],
      }, user);
      expect(order.status, await order.text()).toBe(201);
    }
    await db.unsafe(`UPDATE platform_competitions SET registration_closes_at=NOW()-INTERVAL '2 minutes' WHERE event_id=$1`, [draft.id]);
    await db.unsafe(`UPDATE platform_events SET starts_at=NOW()-INTERVAL '1 minute' WHERE id=$1`, [draft.id]);
    const generations = await Promise.all([post(path + '/brackets/generate', {}, 1), post(path + '/brackets/generate', {}, 1)]);
    for (const response of generations) expect(response.status, await response.text()).toBe(200);
    const read = async () => {
      const response = await app.request(path + '/brackets');
      expect(response.status, await response.clone().text()).toBe(200);
      return response.json();
    };
    return { base, eventId: draft.id, path, post, read };
  }

  it('runs a three-player double-elimination bracket through a bye, loser drop, draw and BO5 final', async () => {
    const { base, eventId, path, post, read } = await createBracket('bracket-test', [2, 3, 4]);
    expect(await (await myEntries(2)).json()).toMatchObject({ entries: expect.arrayContaining([
      expect.objectContaining({ competitionId: eventId, action: 'enter_bracket' }),
    ]) });
    const { matches } = await read();
    expect(matches.filter((match: { side: string; round: number }) => match.side === 'winners' && match.round === 1)).toEqual([
      expect.objectContaining({ status: 'bye', playerB: null, winner: expect.any(String) }),
      expect.objectContaining({ status: 'ready', playerA: expect.any(String), playerB: expect.any(String) }),
    ]);
    const userFor = async (id: string) => Number((await db.unsafe('SELECT user_id FROM platform_event_registrations WHERE id=$1', [id]))[0].user_id);
    const play = async (match: { id: string; playerA: string; playerB: string }, outcomes: Array<'a' | 'b' | 'tie'>) => {
      const seat = base + '/matches/' + match.id;
      const a = await userFor(match.playerA), b = await userFor(match.playerB);
      const get = (user: number) => app.request(seat, { headers: { 'Test-User': String(user) } });
      expect((await get(1)).status).toBe(403);
      for (const [index, outcome] of outcomes.entries()) {
        const gameNumber = index + 1;
        for (const ready of index === 0 ? await Promise.all([post(seat + '/ready', { gameNumber }, a), post(seat + '/ready', { gameNumber }, b)]) : []) {
          expect(ready.status, await ready.text()).toBe(200);
        }
        const [[game], before] = await Promise.all([
          db.unsafe(`SELECT start_at,GREATEST(ready_a_at,ready_b_at) AS ready_at FROM platform_competition_match_games WHERE match_id=$1 AND game_number=$2`, [match.id, gameNumber]),
          get(a),
        ]);
        expect(Number(new Date(String(game.start_at))) - Number(new Date(String(game.ready_at)))).toBeCloseTo(gameNumber === 1 ? 5000 : 7000, -1);
        expect((await read()).matches.find((row: { id: string }) => row.id === match.id))
          .toMatchObject({ status: 'in_progress', gameNumber });
        expect(await before.json()).toMatchObject({ gameNumber, scramble: null, ownReady: true, opponentReady: true });
        expect((await post(seat + '/result', { gameNumber, centiseconds: 1300, penalty: 'none' }, a)).status).toBe(409);
        await db.unsafe(`UPDATE platform_competition_match_games SET start_at=NOW()-INTERVAL '30 seconds' WHERE match_id=$1 AND game_number=$2`, [match.id, gameNumber]);
        const sides = await Promise.all([get(a).then(res => res.json()), get(b).then(res => res.json())]);
        expect(sides[0].scramble).toBe(sides[1].scramble);
        expect(sides[0].scramble).toEqual(expect.any(String));
        for (const user of [a, b]) {
          expect((await post(seat + '/phase', { gameNumber, phase: 'inspecting' }, user)).status).toBe(200);
          const phase = await post(seat + '/phase', { gameNumber, phase: 'solving' }, user);
          expect(phase.status, await phase.text()).toBe(200);
        }
        await db.unsafe(`UPDATE platform_competition_match_games SET
          inspect_a_at=inspect_a_at-INTERVAL '20 seconds',inspect_b_at=inspect_b_at-INTERVAL '20 seconds',
          solve_a_at=solve_a_at-INTERVAL '20 seconds',solve_b_at=solve_b_at-INTERVAL '20 seconds'
          WHERE match_id=$1 AND game_number=$2`, [match.id, gameNumber]);
        expect(await (await get(b)).json()).toMatchObject({ opponentPhase: 'solving' });
        const first = await post(seat + '/result', { gameNumber, centiseconds: outcome === 'b' ? 1400 : 1300, penalty: 'none' }, a);
        expect(first.status, await first.text()).toBe(200);
        const waiting = await (await get(b)).json();
        expect(waiting).toMatchObject({ ownResult: null, opponentFinished: true });
        expect(waiting).not.toHaveProperty('opponentResult');
        const second = await post(seat + '/result', { gameNumber, centiseconds: outcome === 'a' ? 1400 : 1300, penalty: 'none' }, b);
        expect(second.status, await second.text()).toBe(200);
        expect(await (await get(a)).json()).toMatchObject({
          scramble: null,
          lastGame: { gameNumber, winner: outcome === 'a' ? 'own' : outcome === 'b' ? 'opponent' : 'draw',
            ownResult: { centiseconds: outcome === 'b' ? 1400 : 1300, penalty: 'none' },
            opponentResult: { centiseconds: outcome === 'a' ? 1400 : 1300, penalty: 'none' } },
        });
      }
    };
    const opener = matches.find((match: { side: string; round: number; status: string }) => match.side === 'winners' && match.round === 1 && match.status === 'ready');
    await play(opener, ['a', 'a']);
    let bracket = await read();
    const upper = bracket.matches.find((match: { side: string; round: number }) => match.side === 'winners' && match.round === 2);
    expect(upper).toMatchObject({ status: 'ready', playerB: opener.playerA });
    await play(upper, ['a', 'a']);
    bracket = await read();
    const lower = bracket.matches.find((match: { side: string; round: number }) => match.side === 'losers' && match.round === 2);
    expect(lower).toMatchObject({ status: 'ready', playerA: opener.playerB, playerB: opener.playerA });
    await play(lower, ['b', 'b']);
    bracket = await read();
    const final = bracket.matches.find((match: { side: string }) => match.side === 'grand_final');
    expect(final).toMatchObject({ bestOf: 5, status: 'ready', playerA: upper.playerA, playerB: opener.playerA });
    await play(final, ['a', 'b', 'tie', 'a', 'b', 'b']);
    bracket = await read();
    expect(bracket.matches.find((match: { id: string }) => match.id === final.id)).toMatchObject({
      bestOf: 5, status: 'completed', winner: final.playerB, scoreA: 2, scoreB: 3,
    });
    expect(bracket.standings.sort((a: { rank: number }, b: { rank: number }) => a.rank - b.rank)).toMatchObject([
      { id: final.playerB, rank: 1, wins: 7 }, { id: final.playerA, rank: 2, wins: 4 }, { id: opener.playerB, rank: 3, wins: 0 },
    ]);
    await db.unsafe(`UPDATE platform_events SET ends_at=NOW()-INTERVAL '1 second' WHERE id=$1`, [eventId]);
    expect((await post(path + '/finalize', {}, 1, true)).status).toBe(200);
  }, 30000);

  it('keeps the first inspection timestamp, applies the official +2 and forces both timeout paths', async () => {
    const { base, post, read } = await createBracket('timed-bracket', [2, 3]);
    const first = (await read()).matches.find((match: { status: string }) => match.status === 'ready');
    const seat = base + '/matches/' + first.id;
    const user = async (id: string) => Number((await db.unsafe('SELECT user_id FROM platform_event_registrations WHERE id=$1', [id]))[0].user_id);
    const a = await user(first.playerA), b = await user(first.playerB);
    const get = (entrant: number) => app.request(seat, { headers: { 'Test-User': String(entrant) } });
    const phase = (entrant: number, gameNumber: number, action: string) => post(seat + '/phase', { gameNumber, phase: action }, entrant);
    async function begin(gameNumber: number, age: number) {
      if (gameNumber === 1) {
        expect((await post(seat + '/ready', { gameNumber }, a)).status).toBe(200);
        expect((await post(seat + '/ready', { gameNumber }, b)).status).toBe(200);
      }
      await db.unsafe('UPDATE platform_competition_match_games SET start_at=NOW()-make_interval(secs=>$3) WHERE match_id=$1 AND game_number=$2',
        [first.id, gameNumber, age]);
    }
    await begin(1, 30);
    expect((await phase(a, 1, 'solving')).status).toBe(409);
    expect(await (await phase(a, 1, 'timeout')).json()).toEqual({ inspectAt: null, solveAt: null });
    expect((await post(seat + '/result', { gameNumber: 1, centiseconds: 40, penalty: 'none' }, a)).status).toBe(409);
    const inside = await phase(a, 1, 'inspecting');
    expect(inside.status, await inside.clone().text()).toBe(200);
    const { inspectAt } = await inside.json();
    expect(await (await get(a)).json()).toMatchObject({ activeGame: { authoritativeTiming: true, gameNumber: 1, inspectAt } });
    expect(await (await phase(a, 1, 'inspecting')).json()).toMatchObject({ inspectAt });
    await db.unsafe("UPDATE platform_competition_match_games SET inspect_a_at=NOW()-INTERVAL '16 seconds' WHERE match_id=$1 AND game_number=1", [first.id]);
    expect((await phase(a, 1, 'solving')).status).toBe(200);
    const plusTwo = await post(seat + '/result', { gameNumber: 1, centiseconds: 40, penalty: 'none' }, a);
    expect(plusTwo.status, await plusTwo.clone().text()).toBe(200);
    expect(await plusTwo.json()).toMatchObject({ result: { centiseconds: 40, penalty: '+2' } });
    expect((await phase(b, 1, 'inspecting')).status).toBe(200);
    await db.unsafe("UPDATE platform_competition_match_games SET inspect_b_at=NOW()-INTERVAL '18 seconds' WHERE match_id=$1 AND game_number=1", [first.id]);
    const late = await phase(b, 1, 'solving');
    expect(await late.json()).toMatchObject({ result: { centiseconds: null, penalty: 'DNF' } });
    expect(await (await get(b)).json()).toMatchObject({ lastGame: { winner: 'opponent', ownResult: { penalty: 'DNF' }, opponentResult: { penalty: '+2' } } });
    await begin(2, 121);
    const expiredScramble = await phase(a, 2, 'timeout');
    expect(await expiredScramble.json()).toMatchObject({ inspectAt: null, result: { penalty: 'DNF' } });
    const { closeExpiredCompetitionGames } = await import('../src/routes/platform_competition_brackets.js');
    const { platformTransaction } = await import('../src/platform/db.js');
    await platformTransaction(closeExpiredCompetitionGames);
    expect(await (await get(a)).json()).toMatchObject({ activeGame: { gameNumber: 3, scramble: null }, lastGame: { gameNumber: 2, winner: 'draw', opponentResult: { penalty: 'DNF' } } });
  }, 30_000);

  it('shares a smart duel scramble, scores automatic observation and advances after a Bluetooth loss', async () => {
    const { base, eventId, post, read } = await createBracket('arena-smart-duel', [2, 3], 'smart');
    const match = (await read()).matches.find((row: { status: string }) => row.status === 'ready');
    const [a, b] = await Promise.all([match.playerA, match.playerB].map(async (id: string) =>
      Number((await db.unsafe('SELECT user_id FROM platform_event_registrations WHERE id=$1', [id]))[0].user_id)));
    const seat = base + '/matches/' + match.id;
    const get = (user: number) => app.request(seat, { headers: { 'Test-User': String(user) } }).then(res => res.json());
    expect((await post(seat + '/ready', { gameNumber: 1 }, a)).status).toBe(409);
    await db.unsafe("UPDATE platform_competition_sessions SET starts_at=clock_timestamp()-INTERVAL '1 minute' WHERE event_id=$1", [eventId]);
    expect((await post(base + '/registrations/' + match.playerA + '/check-in', smartCheckIn, a)).status).toBe(200);
    expect((await post(base + '/registrations/' + match.playerB + '/check-in', smartCheckIn, b)).status).toBe(200);
    expect((await post(seat + '/ready', { gameNumber: 1 }, a)).status).toBe(200);
    expect(await get(b)).toMatchObject({ ownReady: false, opponentReady: true, scramble: null });
    expect((await post(seat + '/ready', { gameNumber: 1 }, b)).status).toBe(200);
    expect(await get(a)).toMatchObject({ ownReady: true, opponentReady: true, scramble: null });
    const shift = (gameNumber: number, seconds: number) => db.unsafe(`UPDATE platform_competition_match_games
      SET start_at=clock_timestamp()-$3*INTERVAL '1 second' WHERE match_id=$1 AND game_number=$2`, [match.id, gameNumber, seconds]);
    await shift(1, 40);
    const game = await get(a);
    expect(await get(b)).toMatchObject({ scramble: game.scramble, startAt: game.startAt });
    const telemetry = seat + '/games/1/telemetry';
    const bind = { serverIssuedAt: game.startAt, scramble: game.scramble, startFacelets: smartCubeTargetFacelets(game.scramble) };
    const started = await post(telemetry + '/start', bind, a);
    expect(started.status, await started.clone().text()).toBe(201);
    const { runId } = await started.json();
    await db.unsafe(`UPDATE platform_competition_match_games SET run_a_at=CASE WHEN run_a=$2 THEN clock_timestamp()-INTERVAL '25 seconds' END,
      run_b_at=CASE WHEN run_b=$2 THEN clock_timestamp()-INTERVAL '25 seconds' END,
      inspect_a_at=CASE WHEN run_a=$2 THEN clock_timestamp()-INTERVAL '25 seconds' END,
      inspect_b_at=CASE WHEN run_b=$2 THEN clock_timestamp()-INTERVAL '25 seconds' END WHERE match_id=$1`, [match.id, runId]);
    const inverse = (game.scramble as string).split(/\s+/).reverse();
    const moves = inverse.map((move, index) => ({
      move: move.endsWith("'") ? move.slice(0, -1) : move.endsWith('2') ? move : move + "'", elapsedMs: Math.round((index + 1) * 4000 / inverse.length),
    }));
    const valid = await post(telemetry, { ...bind, runId, inspectionMs: 16300, durationMs: 4000, moves,
      endFacelets: SOLVED_SMART_CUBE_FACELETS, deviceBrand: 'fixture', disconnected: false }, a);
    expect(valid.status, await valid.clone().text()).toBe(201);
    expect(await get(a)).toMatchObject({ gameNumber: 1, ownResult: { centiseconds: 400, penalty: 'none' }, opponentFinished: false });
    expect(await get(b)).toMatchObject({ activeGame: { opponentResult: { centiseconds: 400, penalty: 'none' } } });
    const lost = await post(seat + '/phase', { gameNumber: 1, phase: 'disconnected', disconnected: true }, b);
    expect(lost.status, await lost.clone().text()).toBe(200);
    expect(await get(a)).toMatchObject({ gameNumber: 2, scramble: null, ownScore: 1,
      lastGame: { winner: 'own', opponentResult: { penalty: 'DNF', dnfReason: 'disconnected' } } });
    const replays = await app.request(telemetry, { headers: { 'Test-User': String(b) } }).then(res => res.json());
    expect(replays).toMatchObject({ own: null, opponent: { inspectionMs: 16300, durationMs: 4000 } });
    await shift(2, 121);
    expect(await get(a)).toMatchObject({ gameNumber: 3, scramble: null, lastGame: { winner: 'draw',
      ownResult: { dnfReason: 'scramble_timeout' }, opponentResult: { dnfReason: 'scramble_timeout' } } });
  }, 30_000);

  it.each([
    { label: 'best-single', results: [[1200, 1500], [1400, 1000]], expectSlot: 'b' },
    { label: 'original-seed', results: [[1200, 1500], [1400, 1200]], expectSlot: 'a' },
    { label: 'no-valid-times', results: [[null, null]], expectSlot: null },
  ])('resolves a tied bracket at event close by $label', async ({ label, results, expectSlot }) => {
    const { eventId, path, post, read } = await createBracket('cutoff-' + label, [2, 3]);
    const match = (await read()).matches.find((row: { status: string }) => row.status === 'ready');
    for (const [index, [a, b]] of results.entries()) {
      await db.unsafe(`INSERT INTO platform_competition_match_games(match_id,game_number,result_a,result_b,winner_registration_id,resolved_at)
        VALUES($1,$2,$3::jsonb,$4::jsonb,$5::uuid,NOW())`, [match.id, index + 1,
        { centiseconds: a, penalty: a === null ? 'DNF' : 'none' }, { centiseconds: b, penalty: b === null ? 'DNF' : 'none' },
        a === null || b === null ? null : a < b ? match.playerA : match.playerB]);
    }
    const score = results.length === 1 ? 0 : 1;
    await db.unsafe('UPDATE platform_competition_matches SET score_a=$2,score_b=$2 WHERE id=$1', [match.id, score]);
    await db.unsafe("UPDATE platform_events SET ends_at=NOW()-INTERVAL '1 second' WHERE id=$1", [eventId]);
    const closed = await post(path + '/close-sessions', {}, 1);
    expect(closed.status, await closed.clone().text()).toBe(200);
    const actual = (await read()).matches.find((row: { id: string }) => row.id === match.id);
    expect(actual.winner).toBe(expectSlot === 'a' ? match.playerA : expectSlot === 'b' ? match.playerB : null);
  });


  const competitionBase = '/v1/platform/competitions';
  const testAdminHeaders = { Authorization: 'Bearer fixture', 'Test-Admin': '1', 'Test-User': '1' };
  const testMemberHeaders = { Authorization: 'Bearer fixture', 'Test-User': '3' };
  function postTest(path: string, body: unknown = {}, headers: Record<string, string> = testAdminHeaders, key = randomUUID()) {
    return app.request(path, { method: 'POST', headers: {
      ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': key,
    }, body: JSON.stringify(body) });
  }

  it('guards test competition mutations and keeps formal competitions outside the workflow', async () => {
    for (const path of ['/test', `/${event}/test/start-now`, `/${event}/test/cleanup`]) {
      expect((await postTest(competitionBase + path, {}, testMemberHeaders)).status).toBe(403);
    }
    for (const action of ['start-now', 'cleanup']) {
      expect((await postTest(`${competitionBase}/${event}/test/${action}`)).status).toBe(409);
    }
  });

  it('fulfills free direct entry using the real order graph and isolates test events from public and host statistics', async () => {
    const readOverview = async () => (await app.request(competitionBase + '/host/overview', { headers: testAdminHeaders })).json();
    const before = await readOverview();
    const creationKey = randomUUID();
    const response = await postTest(competitionBase + '/test', { autoEnter: true }, testAdminHeaders, creationKey);
    const created = await response.json();
    expect(response.status, JSON.stringify(created)).toBe(201);
    expect(await (await postTest(competitionBase + '/test', { autoEnter: true }, testAdminHeaders, creationKey)).json()).toEqual(created);
    expect(created).toMatchObject({ id: expect.any(String), slug: expect.stringMatching(/^test-/), registrationId: expect.any(String) });
    expect(await readOverview()).toEqual(before);
    const lobby = await (await app.request(competitionBase)).json();
    expect(lobby.competitions.some((item: { id: string }) => item.id === created.id)).toBe(false);
    for (const candidate of ['/v1/platform/events', '/v1/platform/search?q=测试赛']) {
      const listed = await (await app.request(candidate)).json();
      expect((listed.events ?? listed.results).some((item: { id: string }) => item.id === created.id)).toBe(false);
    }
    expect((await app.request(competitionBase + '/' + created.slug)).status).toBe(404);
    const direct = await app.request(competitionBase + '/' + created.slug, { headers: testMemberHeaders });
    expect(direct.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(await direct.json()).toMatchObject({ competition: { id: created.id, isTest: true, canManage: false, projects: [{ amountMinor: 0 }] } });
    const graph = await db.unsafe(`
      SELECT r.status,o.status AS order_status,o.total_amount_minor::int AS total,r.checked_in_at
      FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id
      JOIN platform_orders o ON o.id=i.order_id WHERE r.id=$1`, [created.registrationId]);
    expect(graph).toEqual([{ status: 'confirmed', order_status: 'fulfilled', total: 0, checked_in_at: null }]);
    const arena = await app.request(`${competitionBase}/registrations/${created.registrationId}/arena`, { headers: testAdminHeaders });
    expect(arena.status).toBe(200);
    expect(await arena.json()).toMatchObject({ checkedIn: false });

    const ordinary = await (await postTest(competitionBase + '/test', { autoEnter: true, device: 'ordinary', project: '222' })).json();
    const ordinaryArena = await app.request(`${competitionBase}/registrations/${ordinary.registrationId}/arena`, { headers: testAdminHeaders });
    expect(await ordinaryArena.json()).toMatchObject({ checkedIn: true });
  });

  it('starts a supervised test bracket when ready and retires its rooms on cleanup', async () => {
    const options = await (await app.request(competitionBase + '/test/options', { headers: testAdminHeaders })).json();
    expect(options.supervisors.map((user: { id: number }) => user.id).sort()).toEqual([1, 2]);
    const response = await postTest(competitionBase + '/test', { format: 'advancement', supervisionMode: 'supervised', device: 'ordinary' });
    const created = await response.json();
    expect(response.status, JSON.stringify(created)).toBe(201);
    expect(created.registrationId).toBeNull();
    const path = competitionBase + '/' + created.id;
    const detail = await (await app.request(path, { headers: testMemberHeaders })).json();
    const register = (user: number) => postTest('/v1/platform/orders', { items: [{
      sellableType: 'event_ticket', eventTicketTypeId: detail.competition.projects[0].id,
      competitionSessionId: detail.competition.sessions[0].id, device: 'ordinary',
    }] }, { 'Test-User': String(user) });
    expect((await register(1)).status).toBe(409);
    expect((await register(3)).status).toBe(201);
    const tooSoon = await postTest(path + '/test/start-now');
    expect(tooSoon.status).toBe(409);
    expect(await tooSoon.json()).toMatchObject({ error: { message: expect.stringContaining('two confirmed') } });
    expect((await register(4)).status).toBe(201);
    const start = await postTest(path + '/test/start-now');
    const started = await start.json();
    expect(start.status, JSON.stringify(started)).toBe(200);
    expect(started).toMatchObject({ started: true, bracketsGenerated: true });
    const [sales] = await db.unsafe(`SELECT t.sales_end_at=c.registration_closes_at AS same_deadline,
      t.sales_end_at<=NOW() AS sales_closed FROM platform_event_ticket_types t
      JOIN platform_competitions c ON c.event_id=t.event_id WHERE t.id=$1`, [detail.competition.projects[0].id]);
    expect(sales).toEqual({ same_deadline: true, sales_closed: true });
    expect((await app.request(path + '/brackets')).status).toBe(404);
    const brackets = await (await app.request(path + '/brackets', { headers: testMemberHeaders })).json();
    expect(brackets.generated).toBe(true);
    expect(brackets.matches).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'ready' })]));
    const registrations = await (await app.request(path + '/registrations', { headers: testMemberHeaders })).json();
    expect(registrations.registrations).toEqual([expect.objectContaining({ canCheckIn: true })]);
    expect((await postTest(`${competitionBase}/registrations/${registrations.registrations[0].id}/check-in`, {}, testMemberHeaders)).status).toBe(200);
    expect((await postTest(`${competitionBase}/registrations/${registrations.registrations[0].id}/disputes`, {
      reason: 'Fixture dispute',
    }, testMemberHeaders)).status).toBe(201);
    await db.unsafe("UPDATE organization_members SET role='admin' WHERE organization_id=$1 AND user_id=2", [options.organizationId]);
    const organizerHeaders = { 'Test-User': '2' };
    const supervisorRegistrations = await (await app.request(path + '/registrations', { headers: testAdminHeaders })).json();
    expect(supervisorRegistrations.registrations).toHaveLength(2);
    expect(await (await app.request(path + '/registrations', { headers: organizerHeaders })).json()).toEqual({ registrations: [] });
    expect(await (await app.request(path + '/disputes', { headers: organizerHeaders })).json()).toEqual({ disputes: [] });
    const ownDisputes = await (await app.request(path + '/disputes', { headers: testMemberHeaders })).json();
    expect(ownDisputes.disputes).toEqual([expect.objectContaining({ reason: 'Fixture dispute' })]);
    const before = await db.unsafe('SELECT id::text,competition_video_generation::text AS generation FROM platform_event_registrations WHERE event_id=$1', [created.id]);
    state.retired.mockClear();
    const cleanup = await postTest(path + '/test/cleanup');
    expect(cleanup.status, await cleanup.clone().text()).toBe(200);
    expect(await cleanup.json()).toEqual({ id: created.id, status: 'cancelled' });
    for (const row of before) expect(state.retired).toHaveBeenCalledWith(`competition-${row.id}-${row.generation}`);
    expect(await db.unsafe('SELECT status FROM platform_events WHERE id=$1', [created.id])).toEqual([{ status: 'cancelled' }]);
    const after = await db.unsafe('SELECT id::text,status,cancelled_at,competition_video_generation::text AS generation FROM platform_event_registrations WHERE event_id=$1', [created.id]);
    expect(after.every(row => row.status === 'cancelled' && row.cancelled_at && before.find(old => old.id === row.id)?.generation !== row.generation)).toBe(true);
    for (const [endpoint, headers, field, key] of [
      ['/manage', testAdminHeaders, 'competitions', 'id'],
      ['/me/supervised', testAdminHeaders, 'competitions', 'id'],
      ['/me/entries', testMemberHeaders, 'entries', 'competitionId'],
    ] as const) {
      const list = await (await app.request(competitionBase + endpoint, { headers })).json();
      expect(list[field].some((item: Record<string, unknown>) => item[key] === created.id)).toBe(false);
    }
  });

  it('rejects paid pricing and refuses to clean up an anomalous non-zero test order', async () => {
    const response = await postTest(competitionBase + '/test', { autoEnter: true });
    const created = await response.json();
    expect(response.status, JSON.stringify(created)).toBe(201);
    await db.unsafe(`UPDATE platform_orders o SET subtotal_amount_minor=100,total_amount_minor=100
      FROM platform_order_items i JOIN platform_event_registrations r ON r.order_item_id=i.id
      WHERE o.id=i.order_id AND r.id=$1`, [created.registrationId]);
    const cleanup = await postTest(`${competitionBase}/${created.id}/test/cleanup`);
    expect(cleanup.status).toBe(409);
    expect(await cleanup.json()).toMatchObject({ error: { message: expect.stringContaining('non-zero order') } });
    expect(await db.unsafe('SELECT status FROM platform_events WHERE id=$1', [created.id])).toEqual([{ status: 'published' }]);

    const open = await (await postTest(competitionBase + '/test')).json();
    const [ticket] = await db.unsafe(`UPDATE platform_event_ticket_types SET amount_minor=100 WHERE event_id=$1 RETURNING id::text`, [open.id]);
    const order = await postTest('/v1/platform/orders', {
      items: [{ sellableType: 'event_ticket', eventTicketTypeId: ticket.id, device: 'smart' }],
    }, testMemberHeaders);
    expect(order.status).toBe(409);
    expect(await order.json()).toMatchObject({ error: { message: 'Test competition tickets must be free' } });
  });

});
