import type { PlatformActor } from './auth.js';
import { platformQuery, type PlatformDb } from './db.js';
import { badRequest, conflict, forbidden, notFound, PlatformApiError } from './errors.js';
import { DEFAULT_ROUND_CONFIG, roundResult, type Solve } from '@cuberoot/shared/timer';

export function competitionInteger(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !/^\d+$/.test(value))) {
    throw new PlatformApiError('INVALID_STATE',500,'Invalid stored competition number');
  }
  const result=Number(value);
  if(!Number.isSafeInteger(result)||result<0)throw new PlatformApiError('INVALID_STATE',500,'Competition number exceeds the supported range');
  return result;
}

export function competitionResultSummary(raw:unknown){
  const solves:Solve[]=validateCompetitionAttempts(raw).map((a,index)=>({id:String(index),timeMs:(a.centiseconds??0)*10,penalty:a.penalty==='none'?'ok':a.penalty,scramble:'',event:'333',ts:0}));
  const result=roundResult(solves,{...DEFAULT_ROUND_CONFIG,on:true,format:'ao5',cutoffMs:null,limitMs:null,cumulative:false});
  return {averageCentiseconds:result.official!=null&&Number.isFinite(result.official)?result.official/10:null,
    bestCentiseconds:result.best!=null&&Number.isFinite(result.best)?result.best/10:null};
}

export async function requireCompetitionManager(db: PlatformDb, actor: PlatformActor, eventId: string) {
  const rows = await platformQuery<{ organization_id: string; status: string }>(db, `
    SELECT c.organization_id::text,e.status FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
    JOIN organizations o ON o.id=c.organization_id AND o.status='active'
    WHERE c.event_id=$1::uuid AND ($3 OR EXISTS (SELECT 1 FROM organization_members m
      WHERE m.organization_id=c.organization_id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')))
    FOR UPDATE OF c
  `, [eventId, actor.userId, actor.isAdmin]);
  if (!rows[0]) forbidden('Competition organizer access required');
  return rows[0];
}

export function validateCompetitionAttempts(raw: unknown): Array<{ centiseconds: number | null; penalty: 'none' | '+2' | 'DNF' | 'DNS' }> {
  if (!Array.isArray(raw) || raw.length !== 5) badRequest('Exactly five attempts are required');
  return raw.map(validateCompetitionAttempt);
}
export function validateCompetitionAttempt(item: unknown): { centiseconds: number | null; penalty: 'none' | '+2' | 'DNF' | 'DNS' } {
    if (!item || typeof item !== 'object') badRequest('Invalid attempt');
    const { centiseconds, penalty } = item as Record<string, unknown>;
    if (!['none','+2','DNF','DNS'].includes(String(penalty))) badRequest('Invalid attempt penalty');
    if (penalty === 'DNF' || penalty === 'DNS') {
      if (centiseconds !== null) badRequest('DNF and DNS must have null centiseconds');
    } else if (!Number.isSafeInteger(centiseconds) || Number(centiseconds) <= 0 || Number(centiseconds) > 86_400_00) {
      badRequest('Attempt time must be positive integer centiseconds up to 24 hours');
    }
    return { centiseconds: centiseconds as number | null, penalty: penalty as 'none' | '+2' | 'DNF' | 'DNS' };
}

/** Called inside the commerce transaction after ticket pricing, before any order writes. */
export async function competitionOrderContext(db: PlatformDb, input: {
  eventId: string; ticketId: string; quantity: number; userId: number; sessionId?: string; device?: string;
}): Promise<Record<string, unknown> | null> {
  const configs = await platformQuery<{ event_id: string; commission_bps: number | null; settlement_days: number | null; settlement_anchor: string | null; refund_policy: string; recording_policy: string; open: boolean; project: string; device: string; organization_id: string }>(db, `
    SELECT c.*, t.competition_project AS project,t.competition_device AS device,
      (NOW()>=c.registration_opens_at AND NOW()<c.registration_closes_at AND EXISTS(SELECT 1 FROM organizations o WHERE o.id=c.organization_id AND o.status='active')) AS open
    FROM platform_competitions c JOIN platform_event_ticket_types t ON t.event_id=c.event_id
    WHERE c.event_id=$1::uuid AND t.id=$2::uuid FOR SHARE OF c
  `, [input.eventId,input.ticketId]);
  const config = configs[0];
  if (!config) {
    if (input.sessionId) badRequest('A competition session cannot be used with this ticket');
    return null;
  }
  if (!config.open) conflict('Competition registration is closed');
  if (input.quantity !== 1) badRequest('Competition registration quantity must be one');
  if (!input.sessionId || !config.project || input.device !== config.device) badRequest('Select a valid competition project, device and supervised session');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.sessionId)) badRequest('Invalid supervised session id');
  await platformQuery(db, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`competition:${input.eventId}:${input.userId}:${config.project}`]);
  const sessions = await platformQuery<{ id: string; supervisor_user_id: number | null; capacity: number; available_time: boolean }>(db, `
    SELECT id::text,supervisor_user_id,capacity,starts_at>NOW() AS available_time
    FROM platform_competition_sessions WHERE id=$1::uuid AND event_id=$2::uuid FOR UPDATE
  `, [input.sessionId,input.eventId]);
  const session = sessions[0];
  if (!session || !session.supervisor_user_id || !session.available_time) conflict('The supervised session is unavailable');
  if (Number(session.supervisor_user_id) === input.userId) conflict('A supervisor cannot enter their own supervised session');
  const existing = await platformQuery<{ count: string; duplicate: boolean }>(db, `
    SELECT COUNT(*) FILTER (WHERE competition_session_id=$1::uuid)::text AS count,
      COALESCE(BOOL_OR(user_id=$3 AND competition_project=$4),false) AS duplicate
    FROM platform_event_registrations WHERE event_id=$2::uuid AND status IN ('reserved','confirmed','attended')
  `, [input.sessionId,input.eventId,input.userId,config.project]);
  if (existing[0]?.duplicate) conflict('You already have an active registration for this project');
  if (Number(existing[0]?.count ?? 0) >= session.capacity) conflict('The supervised session is full');
  return { sessionId: input.sessionId, project: config.project, device: config.device, organizationId: config.organization_id,
    commissionBps: config.commission_bps, settlementDays: config.settlement_days, settlementAnchor: config.settlement_anchor,
    refundPolicy: config.refund_policy, recordingPolicy: config.recording_policy };
}

export async function requireCompetitionRegistration(db: PlatformDb, id: string) {
  const rows = await platformQuery<{ id: string; user_id: number; status: string; event_id: string; competition_project: string; competition_video_generation: string; supervisor_user_id: number; in_window: boolean; checked_in_at: string | null }>(db, `
    SELECT r.id::text,r.user_id,r.status,r.event_id::text,r.checked_in_at,r.competition_project,r.competition_video_generation::text,s.supervisor_user_id,
      (NOW()>=s.starts_at AND NOW()<s.ends_at) AS in_window
    FROM platform_event_registrations r JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_events e ON e.id=r.event_id AND e.status='published'
    WHERE r.id=$1::uuid FOR UPDATE OF r
  `, [id]);
  if (!rows[0]) notFound('Competition registration');
  return rows[0];
}
