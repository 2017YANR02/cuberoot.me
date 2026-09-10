import type { Context } from 'hono';
import { requirePlatformActor, requirePlatformAdmin, type PlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, sendMutation, withIdempotency, type PlatformDb } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { arrayField, booleanField, enumField, integerField, isObject, isoTimestampField, readJsonObject, stringField, type JsonObject } from '../platform/validation.js';
import { competitionInteger, competitionResultSummary, requireCompetitionManager, requireCompetitionRegistration, validateCompetitionAttempts } from '../platform/competitions.js';
import { paymentAvailability } from '../platform/payment.js';

export const platformCompetitionRoutes = platformRouter();
const uuid = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) badRequest('Invalid resource id');
  return value;
};
const id = (c: Context) => uuid(c.req.param('id') ?? '');
const LIST = `SELECT e.id::text,e.slug,e.title_zh AS "titleZh",e.title_en AS "titleEn",e.status,
  e.starts_at AS "startsAt",e.ends_at AS "endsAt",o.name AS "organizationName",o.id::text AS "organizationId",
  c.submitted_at AS "submittedAt",c.registration_opens_at AS "registrationOpensAt",c.registration_closes_at AS "registrationClosesAt",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id::text,'project',t.competition_project,'device',t.competition_device,
    'amountMinor',t.amount_minor,'currency',t.currency,'capacity',t.capacity) ORDER BY t.competition_project,t.competition_device)
    FROM platform_event_ticket_types t WHERE t.event_id=e.id AND t.competition_project IS NOT NULL AND t.status='active'),'[]'::jsonb) AS projects
  FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
  JOIN organizations o ON o.id=c.organization_id`;

async function optionalActor(c: Context): Promise<PlatformActor | null> {
  return c.req.header('Authorization') ? requirePlatformActor(c) : null;
}

platformCompetitionRoutes.get('/platform/competitions', async (c) => {
  privateNoStore(c);
  const competitions = await platformQuery(platformDb(), `${LIST} WHERE e.status IN ('published','completed') AND o.status='active' ORDER BY e.starts_at DESC LIMIT 100`);
  return c.json({ competitions });
});
platformCompetitionRoutes.get('/platform/competitions/manage', async (c) => {
  const actor = await requirePlatformActor(c);
  privateNoStore(c);
  const competitions = await platformQuery(platformDb(), `${LIST} WHERE $2 OR EXISTS (SELECT 1 FROM organization_members m
    WHERE m.organization_id=o.id AND m.user_id=$1 AND m.status='active' AND m.role IN ('owner','admin')) ORDER BY e.created_at DESC LIMIT 100`, [actor.userId,actor.isAdmin]);
  return c.json({ competitions });
});
platformCompetitionRoutes.get('/platform/competitions/:id', async (c) => {
  const key = c.req.param('id');
  const actor = await optionalActor(c);
  privateNoStore(c);
  const rows = await platformQuery(platformDb(), `SELECT e.id::text,e.slug,e.title_zh AS "titleZh",e.title_en AS "titleEn",e.status,
    e.starts_at AS "startsAt",e.ends_at AS "endsAt",e.timezone,o.id::text AS "organizationId",o.name AS "organizationName",o.slug AS "organizationSlug",
    c.registration_opens_at AS "registrationOpensAt",c.registration_closes_at AS "registrationClosesAt",
    c.commission_bps AS "commissionBps",c.settlement_days AS "settlementDays",c.settlement_anchor AS "settlementAnchor",
    c.refund_policy AS "refundPolicy",c.recording_policy AS "recordingPolicy",c.submitted_at AS "submittedAt",c.finalized_at AS "finalizedAt",
    ($3 OR EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin'))) AS "canManage",
    EXISTS (SELECT 1 FROM platform_competition_sessions s WHERE s.event_id=e.id AND s.supervisor_user_id=$2) AS "canSupervise"
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id JOIN organizations o ON o.id=c.organization_id
    WHERE (e.id::text=$1 OR e.slug=$1) AND o.status='active' AND (e.status IN ('published','completed') OR $3 OR EXISTS (SELECT 1 FROM organization_members m
      WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')))`, [key,actor?.userId ?? null,actor?.isAdmin ?? false]);
  const competition = rows[0];
  if (!competition) notFound('Competition');
  const projects = await platformQuery(platformDb(), `SELECT id::text,competition_project AS project,competition_device AS device,amount_minor AS "amountMinor",currency,capacity
    FROM platform_event_ticket_types WHERE event_id=$1::uuid AND competition_project IS NOT NULL AND status='active' ORDER BY competition_project,competition_device`, [competition.id]);
  const sessions = await platformQuery(platformDb(), `SELECT s.id::text,s.starts_at AS "startsAt",s.ends_at AS "endsAt",s.capacity,
    GREATEST(s.capacity-(SELECT COUNT(*) FROM platform_event_registrations r WHERE r.competition_session_id=s.id
      AND (r.status IN ('confirmed','attended') OR (r.status='reserved' AND r.reservation_expires_at>NOW()))),0)::integer AS available,
    CASE WHEN $2 OR s.supervisor_user_id=$3 THEN s.supervisor_user_id ELSE NULL END AS "supervisorUserId",
    (s.supervisor_user_id IS NOT NULL) AS staffed,s.assistance_requested AS "assistanceRequested"
    FROM platform_competition_sessions s WHERE s.event_id=$1::uuid ORDER BY s.starts_at,s.id`, [competition.id,competition.canManage,actor?.userId ?? null]);
  return c.json({ competition: { ...competition, canPublish: actor?.isAdmin ?? false,
    projects:projects.map(p=>({...p,amountMinor:competitionInteger(p.amountMinor),capacity:competitionInteger(p.capacity)})),
    sessions:sessions.map(s=>({...s,capacity:competitionInteger(s.capacity),available:competitionInteger(s.available),supervisorUserId:s.supervisorUserId==null?null:competitionInteger(s.supervisorUserId)})) } });
});

function requiredTimestamp(body:JsonObject,key:string):string {
  const value=isoTimestampField(body,key);if(!value)badRequest(`${key} is required`);return value;
}
function windowFields(body: JsonObject) {
  const startsAt = requiredTimestamp(body,'startsAt');
  const endsAt = requiredTimestamp(body,'endsAt');
  const opens = requiredTimestamp(body,'registrationOpensAt');
  const closes = requiredTimestamp(body,'registrationClosesAt');
  if (Date.parse(endsAt)<=Date.parse(startsAt) || Date.parse(closes)<=Date.parse(opens) || Date.parse(closes)>Date.parse(endsAt)) badRequest('Invalid competition or registration window');
  return { startsAt,endsAt,opens,closes };
}
platformCompetitionRoutes.post('/platform/competitions', async (c) => {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const organizationId = uuid(stringField(body,'organizationId',{required:true})!);
  const titleZh = stringField(body,'titleZh',{max:240}) ?? '';
  const titleEn = stringField(body,'titleEn',{max:240}) ?? '';
  if (!titleZh && !titleEn) badRequest('A title is required');
  const slug = stringField(body,'slug',{required:true,max:120,pattern:/^[a-z0-9][a-z0-9_-]*$/})!;
  const dates = windowFields(body);
  const refund = stringField(body,'refundPolicy',{max:10000}) ?? '';
  const recording = stringField(body,'recordingPolicy',{max:10000}) ?? '';
  return sendMutation(c,await withIdempotency(c,actor,'competition.create',body,async(db) => {
    const orgs = await platformQuery(db, `SELECT id FROM organizations o WHERE id=$1::uuid AND status='active' AND competition_organizer_approved_at IS NOT NULL AND ($3 OR EXISTS
      (SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')))`,[organizationId,actor.userId,actor.isAdmin]);
    if (!orgs[0]) forbidden('An approved organizer and active owner or administrator access are required');
    const events = await platformQuery<{id:string}>(db, `INSERT INTO platform_events(slug,title_zh,title_en,starts_at,ends_at,timezone,venue_snapshot,created_by_user_id)
      VALUES($1,$2,$3,$4,$5,'Asia/Shanghai','{"online":true}'::jsonb,$6) RETURNING id::text`,[slug,titleZh,titleEn,dates.startsAt,dates.endsAt,actor.userId]);
    await platformQuery(db, `INSERT INTO platform_competitions(event_id,organization_id,registration_opens_at,registration_closes_at,refund_policy,recording_policy)
      VALUES($1::uuid,$2::uuid,$3,$4,$5,$6)`,[events[0].id,organizationId,dates.opens,dates.closes,refund,recording]);
    return {status:201,body:{id:events[0].id,status:'draft'}};
  }));
});
platformCompetitionRoutes.put('/platform/competitions/:id/config', async(c) => {
  const actor = await requirePlatformActor(c); const eventId=id(c); const body=await readJsonObject(c);
  const dates=windowFields(body);
  const titleZh=stringField(body,'titleZh',{max:240});
  const titleEn=stringField(body,'titleEn',{max:240});
  if(titleZh!==undefined && titleEn!==undefined && !titleZh && !titleEn)badRequest('A title is required');
  const commission=integerField(body,'commissionBps',{min:0,max:10000}) ?? null;
  const days=integerField(body,'settlementDays',{min:0,max:3650}) ?? null;
  const anchor=enumField(body,'settlementAnchor',['ended','finalized']) ?? null;
  const refund=stringField(body,'refundPolicy',{max:10000}) ?? '';
  const recording=stringField(body,'recordingPolicy',{max:10000}) ?? '';
  const projects=(arrayField(body,'projects',{required:true,maxItems:8})!).map(raw => {
    if (!isObject(raw)) badRequest('Invalid project');
    const project=enumField(raw,'project',['222','333','444','555'],{required:true})!;
    const device=enumField(raw,'device',['ordinary','smart'],{required:true})!;
    if(device==='smart' && project!=='333') badRequest('Smart cube support is currently limited to 3x3');
    return {project,device,amount:integerField(raw,'amountMinor',{required:true,min:0,max:10000000})!,capacity:integerField(raw,'capacity',{required:true,min:1,max:1000000})!};
  });
  if(new Set(projects.map(p=>p.project+p.device)).size!==projects.length) badRequest('Duplicate project and device');
  return sendMutation(c,await withIdempotency(c,actor,`competition.config:${eventId}`,body,async(db)=>{
    const event=await requireCompetitionManager(db,actor,eventId); if(event.status!=='draft') conflict('Only draft competition configuration can be edited');
    const outside=await platformQuery(db,`SELECT id FROM platform_competition_sessions WHERE event_id=$1::uuid AND (starts_at<$2 OR ends_at>$3) LIMIT 1`,[eventId,dates.startsAt,dates.endsAt]);
    if(outside.length) conflict('The new window excludes an existing supervised session');
    await platformQuery(db,`UPDATE platform_competitions SET registration_opens_at=$2,registration_closes_at=$3,commission_bps=$4,settlement_days=$5,settlement_anchor=$6,refund_policy=$7,recording_policy=$8,submitted_at=NULL WHERE event_id=$1::uuid`,[eventId,dates.opens,dates.closes,commission,days,anchor,refund,recording]);
    await platformQuery(db,`UPDATE platform_events SET starts_at=$2,ends_at=$3,title_zh=COALESCE($4,title_zh),title_en=COALESCE($5,title_en) WHERE id=$1::uuid`,[eventId,dates.startsAt,dates.endsAt,titleZh??null,titleEn??null]);
    await platformQuery(db,`UPDATE platform_event_ticket_types SET status='archived' WHERE event_id=$1::uuid`,[eventId]);
    for(const p of projects) await platformQuery(db,`INSERT INTO platform_event_ticket_types(event_id,code,title_zh,title_en,amount_minor,currency,capacity,sales_start_at,sales_end_at,competition_project,competition_device)
      VALUES($1::uuid,$2,$3,$3,$4,'CNY',$5,$6,$7,$8,$9) ON CONFLICT(event_id,code) DO UPDATE SET status='active',amount_minor=EXCLUDED.amount_minor,capacity=EXCLUDED.capacity,sales_start_at=EXCLUDED.sales_start_at,sales_end_at=EXCLUDED.sales_end_at`,[eventId,`${p.project}-${p.device}`,`${p.project} ${p.device}`,p.amount,p.capacity,dates.opens,dates.closes,p.project,p.device]);
    return {status:200,body:{id:eventId,status:'draft'}};
  }));
});
async function saveSession(c:Context){
  const actor=await requirePlatformActor(c);const eventId=id(c);const body=await readJsonObject(c);
  const sessionId=c.req.param('sessionId') ? uuid(c.req.param('sessionId')!) : null;
  const starts=requiredTimestamp(body,'startsAt');const ends=requiredTimestamp(body,'endsAt');
  const capacity=integerField(body,'capacity',{required:true,min:1,max:1000})!;
  const supervisor=integerField(body,'supervisorUserId',{min:1}) ?? null;
  const assistance=booleanField(body,'assistanceRequested') ?? false;
  if(Date.parse(ends)<=Date.parse(starts))badRequest('Session end must be after start');
  return sendMutation(c,await withIdempotency(c,actor,`competition.session:${eventId}:${sessionId ?? 'new'}`,body,async(db)=>{
    const event=await requireCompetitionManager(db,actor,eventId);if(event.status!=='draft')conflict('Sessions can only be added to drafts');
    const within=await platformQuery(db,`SELECT id FROM platform_events WHERE id=$1::uuid AND starts_at<=$2 AND ends_at>=$3`,[eventId,starts,ends]);
    if(!within.length)badRequest('Session must be inside the competition window');
    if(supervisor){
      const eligible=await platformQuery(db,`SELECT u.id FROM app_users u WHERE u.id=$1 AND ($3 OR EXISTS(SELECT 1 FROM organization_members m WHERE m.user_id=u.id AND m.organization_id=$2::uuid AND m.status='active' AND m.role IN ('owner','admin','teacher','assistant')))`,[supervisor,event.organization_id,actor.isAdmin]);
      if(!eligible.length)forbidden('Assign an active member of your organization; CubeRoot administrators can assign assistance');
      await platformQuery(db,`SELECT id FROM app_users WHERE id=$1 FOR UPDATE`,[supervisor]);
      const overlapping=await platformQuery(db,`SELECT s.id FROM platform_competition_sessions s JOIN platform_events e ON e.id=s.event_id WHERE s.supervisor_user_id=$1 AND s.starts_at<$3 AND s.ends_at>$2 AND e.status IN ('draft','published') AND ($4::uuid IS NULL OR s.id<>$4::uuid) LIMIT 1`,[supervisor,starts,ends,sessionId]);
      if(overlapping.length)conflict('Supervisor already has an overlapping session');
    }
    const rows=sessionId ? await platformQuery<{id:string}>(db,`UPDATE platform_competition_sessions SET starts_at=$3,ends_at=$4,capacity=$5,supervisor_user_id=$6,assistance_requested=$7 WHERE id=$1::uuid AND event_id=$2::uuid RETURNING id::text`,[sessionId,eventId,starts,ends,capacity,supervisor,assistance]) : await platformQuery<{id:string}>(db,`INSERT INTO platform_competition_sessions(event_id,starts_at,ends_at,capacity,supervisor_user_id,assistance_requested) VALUES($1::uuid,$2,$3,$4,$5,$6) RETURNING id::text`,[eventId,starts,ends,capacity,supervisor,assistance]);
    await platformQuery(db,`UPDATE platform_competitions SET submitted_at=NULL WHERE event_id=$1::uuid`,[eventId]);
    if(!rows.length)notFound('Session');
    return {status:sessionId ? 200 : 201,body:{id:rows[0].id}};
  }));
}
platformCompetitionRoutes.post('/platform/competitions/:id/sessions',saveSession);
platformCompetitionRoutes.patch('/platform/competitions/:id/sessions/:sessionId',saveSession);

export async function publicationProblems(db:PlatformDb,eventId:string):Promise<string[]>{
  const rows=await platformQuery<{commission_bps:number|null;settlement_days:number|null;settlement_anchor:string|null;refund_policy:string;recording_policy:string;valid_window:boolean;paid:boolean;smart:boolean;projects:number;sessions:number;unstaffed:number}>(db,`SELECT c.*,
    c.registration_closes_at>NOW() AS valid_window,
    EXISTS(SELECT 1 FROM platform_event_ticket_types t WHERE t.event_id=c.event_id AND t.status='active' AND amount_minor>0) AS paid,
    EXISTS(SELECT 1 FROM platform_event_ticket_types t WHERE t.event_id=c.event_id AND t.status='active' AND competition_device='smart') AS smart,
    (SELECT COUNT(*)::integer FROM platform_event_ticket_types t WHERE t.event_id=c.event_id AND t.status='active') AS projects,
    (SELECT COUNT(*)::integer FROM platform_competition_sessions s WHERE s.event_id=c.event_id) AS sessions,
    (SELECT COUNT(*)::integer FROM platform_competition_sessions s WHERE s.event_id=c.event_id AND s.supervisor_user_id IS NULL) AS unstaffed
    FROM platform_competitions c WHERE c.event_id=$1::uuid`,[eventId]);
  const r=rows[0];const problems:string[]=[];
  const approved=await platformQuery(db,`SELECT o.id FROM platform_competitions c JOIN organizations o ON o.id=c.organization_id WHERE c.event_id=$1::uuid AND o.status='active' AND o.competition_organizer_approved_at IS NOT NULL`,[eventId]);
  if(!approved.length)problems.push('Organizer application must be approved before competition publication');
  if(!r.valid_window)problems.push('Registration window has ended');
  if(!r.projects)problems.push('Add at least one project');
  if(r.smart)problems.push('Verified smart cube telemetry is not available yet. Use the ordinary supervised group, which also accepts smart cube hardware');
  if(!r.sessions||r.unstaffed)problems.push('Every supervised session needs an assigned supervisor');
  if(!r.refund_policy.trim()||!r.recording_policy.trim())problems.push('Refund and recording policies are required');
  if(r.paid&&(r.commission_bps==null||r.settlement_days==null||r.settlement_anchor==null))problems.push('Configure commission and settlement terms before paid publication');
  if(r.paid&&!Object.values(paymentAvailability()).some(Boolean))problems.push('Platform payment collection is not configured');
  return problems;
}
platformCompetitionRoutes.post('/platform/competitions/:id/publish',async(c)=>{
  const actor=await requirePlatformActor(c);const eventId=id(c);const body=await readJsonObject(c);
  return sendMutation(c,await withIdempotency(c,actor,`competition.publish:${eventId}`,body,async(db)=>{
    const event=await requireCompetitionManager(db,actor,eventId);if(event.status!=='draft')conflict('Only drafts may be submitted or published');
    const problems=await publicationProblems(db,eventId);if(problems.length)conflict(problems.join('; '),{problems});
    await platformQuery(db,`UPDATE platform_competitions SET submitted_at=NOW() WHERE event_id=$1::uuid`,[eventId]);
    if(actor.isAdmin)await platformQuery(db,`UPDATE platform_events SET status='published',published_at=NOW() WHERE id=$1::uuid`,[eventId]);
    return {status:200,body:{id:eventId,status:actor.isAdmin?'published':'pending_approval'}};
  }));
});

platformCompetitionRoutes.get('/platform/competitions/:id/registrations',async(c)=>{
  const actor=await requirePlatformActor(c);const eventId=id(c);privateNoStore(c);
  const registrations=await platformQuery(platformDb(),`SELECT r.id::text,r.user_id AS "userId",o.buyer_display_name_snapshot AS "displayName",r.status,r.competition_project AS project,
    t.competition_device AS device,r.competition_session_id::text AS "sessionId",i.order_id::text AS "orderId",r.checked_in_at AS "checkedInAt",
    r.competition_attempts AS attempts,r.result_recorded_at AS "resultRecordedAt",r.reservation_expires_at AS "reservationExpiresAt",
    (r.user_id=$2 AND r.status='confirmed' AND NOW()>=s.starts_at AND NOW()<s.ends_at) AS "canCheckIn",
    (s.supervisor_user_id=$2 AND r.user_id<>$2 AND r.checked_in_at IS NOT NULL AND r.status IN ('confirmed','attended') AND NOW()>=s.starts_at AND NOW()<s.ends_at) AS "canRecordResult"
    FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id JOIN platform_orders o ON o.id=i.order_id
    JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_competitions c ON c.event_id=r.event_id WHERE r.event_id=$1::uuid AND (r.user_id=$2 OR s.supervisor_user_id=$2 OR $3
      OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=c.organization_id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin'))) ORDER BY r.created_at LIMIT 1000`,[eventId,actor.userId,actor.isAdmin]);
  return c.json({registrations:registrations.map(r=>({...r,userId:competitionInteger(r.userId)}))});
});
platformCompetitionRoutes.post('/platform/competitions/registrations/:id/check-in',async(c)=>{
  const actor=await requirePlatformActor(c);const registrationId=id(c);const body=await readJsonObject(c);
  return sendMutation(c,await withIdempotency(c,actor,`competition.checkin:${registrationId}`,body,async(db)=>{
    const r=await requireCompetitionRegistration(db,registrationId);
    if(Number(r.user_id)!==actor.userId)forbidden('Only the registered participant can check in');
    if(!['confirmed','attended'].includes(r.status)||!r.in_window)conflict('Check-in requires a paid registration during its supervised session');
    await platformQuery(db,`UPDATE platform_event_registrations SET checked_in_at=COALESCE(checked_in_at,NOW()) WHERE id=$1::uuid`,[registrationId]);
    return {status:200,body:{id:registrationId,checkedIn:true}};
  }));
});
platformCompetitionRoutes.post('/platform/competitions/registrations/:id/result',async(c)=>{
  const actor=await requirePlatformActor(c);const registrationId=id(c);const body=await readJsonObject(c);
  if(body.attempts!==undefined)badRequest('Results must come from the supervised attempt workflow');
  return sendMutation(c,await withIdempotency(c,actor,`competition.result:${registrationId}`,body,async(db)=>{
    const r=await requireCompetitionRegistration(db,registrationId);
    if(Number(r.supervisor_user_id)!==actor.userId||Number(r.user_id)===actor.userId)forbidden('Only the assigned independent supervisor can record this result');
    if(r.status!=='confirmed'||!r.in_window||!r.checked_in_at)conflict('An active checked-in registration without a recorded result is required');
    const recorded=await platformQuery<{centiseconds:number|null;penalty:string}>(db,`SELECT centiseconds,penalty FROM platform_competition_attempts WHERE registration_id=$1::uuid AND recorded_at IS NOT NULL ORDER BY attempt_number`,[registrationId]);
    const attempts=validateCompetitionAttempts(recorded);
    await platformQuery(db,`UPDATE platform_event_registrations SET competition_attempts=$2::jsonb,result_recorded_by=$3,result_recorded_at=NOW(),status='attended',competition_video_generation=gen_random_uuid() WHERE id=$1::uuid`,[registrationId,attempts,actor.userId]);
    return {status:200,body:{id:registrationId,attempts,status:'attended'}};
  }));
});
platformCompetitionRoutes.post('/platform/competitions/registrations/:id/disputes',async(c)=>{
  const actor=await requirePlatformActor(c);const registrationId=id(c);const body=await readJsonObject(c);const reason=stringField(body,'reason',{required:true,max:4000})!;
  return sendMutation(c,await withIdempotency(c,actor,`competition.dispute:${registrationId}`,body,async(db)=>{
    const rows=await platformQuery(db,`SELECT r.id FROM platform_event_registrations r JOIN platform_competitions c ON c.event_id=r.event_id
      WHERE r.id=$1::uuid AND r.user_id=$2 AND r.competition_session_id IS NOT NULL AND r.status IN ('confirmed','attended') AND c.finalized_at IS NULL FOR UPDATE OF c,r`,[registrationId,actor.userId]);
    if(!rows.length)conflict('Only your active registration before finalization can be disputed');
    const inserted=await platformQuery<{id:string}>(db,`INSERT INTO platform_competition_disputes(registration_id,user_id,reason) VALUES($1::uuid,$2,$3) ON CONFLICT(registration_id) WHERE resolved_at IS NULL DO NOTHING RETURNING id::text`,[registrationId,actor.userId,reason]);
    if(!inserted.length)conflict('An unresolved dispute already exists');
    return {status:201,body:{id:inserted[0].id,status:'open'}};
  }));
});
platformCompetitionRoutes.get('/platform/competitions/:id/results',async(c)=>{
  privateNoStore(c);const eventId=id(c);
  const results=await platformQuery<{id:string;project:string;device:string;attempts:unknown;displayName:string}>(platformDb(),`SELECT r.id::text,o.buyer_display_name_snapshot AS "displayName",r.competition_project AS project,t.competition_device AS device,
    r.competition_attempts AS attempts,r.result_recorded_at AS "recordedAt",c.finalized_at AS "finalizedAt"
    FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id JOIN platform_orders o ON o.id=i.order_id
    JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id JOIN platform_competitions c ON c.event_id=r.event_id JOIN platform_events e ON e.id=r.event_id
    WHERE r.event_id=$1::uuid AND e.status IN ('published','completed') AND r.status='attended' AND r.competition_attempts IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM platform_competition_disputes d WHERE d.registration_id=r.id AND d.resolved_at IS NULL)
    ORDER BY r.competition_project,r.result_recorded_at`,[eventId]);
  const ranked=results.map(row=>({...row,...competitionResultSummary(row.attempts)})).sort((a,b)=>String(a.project).localeCompare(String(b.project))||String(a.device).localeCompare(String(b.device))||(a.averageCentiseconds??Infinity)-(b.averageCentiseconds??Infinity)||(a.bestCentiseconds??Infinity)-(b.bestCentiseconds??Infinity));
  let place=0,rank=0,previous:typeof ranked[number]|undefined;
  return c.json({results:ranked.map(row=>{
    if(!previous||previous.project!==row.project||previous.device!==row.device){place=0;rank=0;previous=undefined;}
    place++;
    if(!previous||previous.averageCentiseconds!==row.averageCentiseconds||previous.bestCentiseconds!==row.bestCentiseconds)rank=place;
    previous=row;return {...row,rank:row.averageCentiseconds===null?null:rank};
  })});
});
platformCompetitionRoutes.get('/platform/competitions/:id/disputes',async(c)=>{
  const actor=await requirePlatformActor(c);const eventId=id(c);privateNoStore(c);
  const disputes=await platformQuery(platformDb(),`SELECT d.id::text,d.registration_id::text AS "registrationId",d.reason,d.resolution,d.original_attempts AS "originalAttempts",d.corrected_attempts AS "correctedAttempts",d.created_at AS "createdAt",d.resolved_at AS "resolvedAt"
    FROM platform_competition_disputes d JOIN platform_event_registrations r ON r.id=d.registration_id JOIN platform_competitions c ON c.event_id=r.event_id
    WHERE r.event_id=$1::uuid AND (d.user_id=$2 OR $3 OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=c.organization_id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin'))) ORDER BY d.created_at DESC LIMIT 1000`,[eventId,actor.userId,actor.isAdmin]);
  return c.json({disputes});
});
platformCompetitionRoutes.post('/platform/competitions/disputes/:id/resolve',async(c)=>{
  const actor=await requirePlatformAdmin(c);const disputeId=id(c);const body=await readJsonObject(c);const resolution=stringField(body,'resolution',{required:true,max:4000})!;
  const corrected=body.correctedAttempts===undefined ? null : validateCompetitionAttempts(body.correctedAttempts);
  return sendMutation(c,await withIdempotency(c,actor,`competition.resolve:${disputeId}`,body,async(db)=>{
    const located=await platformQuery<{event_id:string;registration_id:string}>(db,`SELECT r.event_id::text,d.registration_id::text FROM platform_competition_disputes d JOIN platform_event_registrations r ON r.id=d.registration_id WHERE d.id=$1::uuid`,[disputeId]);
    if(!located.length)notFound('Dispute');
    await requireCompetitionManager(db,actor,located[0].event_id);
    const rows=await platformQuery<{competition_attempts:unknown;resolved_at:unknown;finalized_at:unknown}>(db,`SELECT r.competition_attempts,d.resolved_at,c.finalized_at FROM platform_event_registrations r JOIN platform_competition_disputes d ON d.registration_id=r.id JOIN platform_competitions c ON c.event_id=r.event_id WHERE d.id=$1::uuid FOR UPDATE OF r,d`,[disputeId]);
    if(rows[0].resolved_at||rows[0].finalized_at)conflict('The dispute is already resolved or competition finalized');
    if(corrected){
      if(!rows[0].competition_attempts)conflict('Close the supervised result before correcting it');
      await platformQuery(db,`UPDATE platform_event_registrations SET competition_attempts=$2::jsonb,competition_video_generation=gen_random_uuid() WHERE id=$1::uuid`,[located[0].registration_id,corrected]);
    }
    await platformQuery(db,`UPDATE platform_competition_disputes SET resolution=$2,resolved_by=$3,resolved_at=NOW(),original_attempts=$4::jsonb,corrected_attempts=$5::jsonb WHERE id=$1::uuid`,[disputeId,resolution,actor.userId,rows[0].competition_attempts,corrected]);
    return {status:200,body:{id:disputeId,status:'resolved'}};
  }));
});
platformCompetitionRoutes.post('/platform/competitions/:id/close-sessions',async(c)=>{
  const actor=await requirePlatformActor(c);const eventId=id(c);const body=await readJsonObject(c);
  return sendMutation(c,await withIdempotency(c,actor,`competition.close:${eventId}`,body,async(db)=>{
    const event=await requireCompetitionManager(db,actor,eventId);
    if(event.status!=='published')conflict('Only published competition sessions can be closed');
    // Preserve issued scrambles and timings. Only the published aggregate gains timeout outcomes.
    const rows=await platformQuery<{id:string}>(db,`SELECT r.id::text FROM platform_event_registrations r JOIN platform_competition_sessions s ON s.id=r.competition_session_id WHERE r.event_id=$1::uuid AND r.status='confirmed' AND r.competition_attempts IS NULL AND s.ends_at<=NOW() FOR UPDATE OF r`,[eventId]);
    for(const row of rows){
      const attempts=await platformQuery(db,`SELECT a.centiseconds,CASE WHEN a.recorded_at IS NOT NULL THEN a.penalty WHEN a.issued_at IS NOT NULL THEN 'DNF' ELSE 'DNS' END AS penalty FROM generate_series(1,5) n LEFT JOIN platform_competition_attempts a ON a.registration_id=$1::uuid AND a.attempt_number=n ORDER BY n`,[row.id]);
      const validated=validateCompetitionAttempts(attempts);
      await platformQuery(db,`UPDATE platform_event_registrations SET competition_attempts=$2::jsonb,result_recorded_by=$3,result_recorded_at=NOW(),status='attended',competition_video_generation=gen_random_uuid() WHERE id=$1::uuid`,[row.id,validated,actor.userId]);
    }
    return {status:200,body:{id:eventId,closed:rows.length}};
  }));
});
platformCompetitionRoutes.post('/platform/competitions/:id/finalize',async(c)=>{
  const actor=await requirePlatformAdmin(c);const eventId=id(c);const body=await readJsonObject(c);
  return sendMutation(c,await withIdempotency(c,actor,`competition.finalize:${eventId}`,body,async(db)=>{
    await requireCompetitionManager(db,actor,eventId);
    const eligible=await platformQuery(db,`SELECT e.id FROM platform_events e WHERE e.id=$1::uuid AND e.ends_at<=NOW() AND e.status='published'
      AND NOT EXISTS(SELECT 1 FROM platform_competition_disputes d JOIN platform_event_registrations r ON r.id=d.registration_id WHERE r.event_id=e.id AND d.resolved_at IS NULL)`,[eventId]);
    if(!eligible.length)conflict('Finalization requires an ended competition with all disputes resolved');
    const incomplete=await platformQuery(db,`SELECT id FROM platform_event_registrations WHERE event_id=$1::uuid AND status='confirmed' AND competition_attempts IS NULL LIMIT 1`,[eventId]);
    if(incomplete.length)conflict('Close ended sessions and review their results before finalization');
    await platformQuery(db,`UPDATE platform_competitions SET finalized_at=NOW() WHERE event_id=$1::uuid`,[eventId]);
    await platformQuery(db,`UPDATE platform_events SET status='completed' WHERE id=$1::uuid`,[eventId]);
    return {status:200,body:{id:eventId,status:'completed'}};
  }));
});
