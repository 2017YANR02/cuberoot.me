import { competitionCheckInWindow } from './competition_checkin.js';
import type { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
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

export function competitionEntrant(eventId: string, userId: string) {
  return `EXISTS (SELECT 1 FROM platform_event_registrations entrant
    WHERE entrant.event_id=${eventId} AND entrant.user_id=${userId}
      AND (entrant.status IN ('confirmed','attended')
        OR (entrant.status='reserved' AND entrant.reservation_expires_at>clock_timestamp())))`;
}

// Access predicates use c for the competition and e for its platform event.
export function competitionManagerRole(userId: string, admin: string, apiKey = 'FALSE') {
  return `(CASE WHEN c.is_test THEN (e.created_by_user_id=${userId} OR ${apiKey})
    ELSE (${admin} OR EXISTS (SELECT 1 FROM organization_members member
      JOIN organizations org ON org.id=member.organization_id AND org.status='active'
      WHERE member.organization_id=c.organization_id AND member.user_id=${userId}
        AND member.status='active' AND member.role IN ('owner','admin'))) END) IS TRUE`;
}

export function competitionManagerAccess(userId: string, admin: string, apiKey?: string) {
  return `(NOT ${competitionEntrant('c.event_id', userId)} AND ${competitionManagerRole(userId, admin, apiKey)})`;
}

export function competitionSupervisorAccess(eventId: string, userId: string) {
  return `(NOT ${competitionEntrant(eventId, userId)} AND EXISTS (SELECT 1 FROM platform_competition_sessions assigned
    WHERE assigned.event_id=${eventId} AND assigned.supervisor_user_id=${userId}))`;
}

export function competitionTestAudience(userId: string) {
  return `(e.created_by_user_id=${userId} OR ${competitionEntrant('e.id', userId)}
    OR ${competitionSupervisorAccess('e.id', userId)})`;
}

export async function requireCompetitionManager(db: PlatformDb, actor: PlatformActor, eventId: string, lock = true) {
  // Checkout takes a shared competition lock before writing the registration.
  // Read permissions in a fresh statement after acquiring the exclusive lock.
  if (lock) await platformQuery(db, 'SELECT event_id FROM platform_competitions WHERE event_id=$1::uuid FOR UPDATE', [eventId]);
  const [event] = await platformQuery<{
    organization_id: string; status: string; review_status: string; supervision_mode: string; competition_format: string | null;
    is_test: boolean; is_entrant: boolean; has_manager_role: boolean;
  }>(db, `SELECT c.organization_id::text,e.status,c.review_status,c.supervision_mode,c.competition_format,c.is_test,
      ${competitionEntrant('e.id','$2')} AS is_entrant,${competitionManagerRole('$2','$3','$4')} AS has_manager_role
    FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
    JOIN organizations o ON o.id=c.organization_id AND o.status='active' WHERE c.event_id=$1::uuid`,
  [eventId, actor.userId, actor.isAdmin, actor.viaApiKey === true]);
  if (event?.is_entrant) forbidden('Competitors cannot manage a competition they entered');
  if (!event?.has_manager_role) forbidden('Competition organizer access required');
  return event;
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
  const configs = await platformQuery<{ event_id: string; commission_bps: number | null; settlement_days: number | null; settlement_anchor: string | null; refund_policy: string; recording_policy: string; open: boolean; project: string; device: string; organization_id: string; supervision_mode: string; is_test: boolean; amount_minor: string | number }>(db, `
    SELECT c.*, t.competition_project AS project,t.competition_device AS device,t.amount_minor,
      (NOW()>=c.registration_opens_at AND NOW()<c.registration_closes_at AND EXISTS(SELECT 1 FROM organizations o WHERE o.id=c.organization_id AND o.status='active')) AS open
    FROM platform_competitions c JOIN platform_event_ticket_types t ON t.event_id=c.event_id
    WHERE c.event_id=$1::uuid AND t.id=$2::uuid FOR SHARE OF c
  `, [input.eventId,input.ticketId]);
  const config = configs[0];
  if (!config) {
    if (input.sessionId) badRequest('A competition session cannot be used with this ticket');
    return null;
  }
  // Organizers may enter a different supervisor's session. A live registration
  // then takes precedence over their management and judging roles for this event.
  if (!config.open) conflict('Competition registration is closed');
  if (config.is_test) {
    if (Number(config.amount_minor) !== 0) conflict('Test competition tickets must be free');
    // Re-read after taking the competition lock so cleanup and early starts cannot race a checkout.
    const [open] = await platformQuery(db, `SELECT c.event_id FROM platform_competitions c JOIN platform_events e ON e.id=c.event_id
      WHERE c.event_id=$1::uuid AND e.status='published' AND clock_timestamp()<c.registration_closes_at`, [input.eventId]);
    if (!open) conflict('Competition registration is closed');
  }
  if (input.quantity !== 1) badRequest('Competition registration quantity must be one');
  if (!config.project || input.device !== config.device || (config.supervision_mode === 'supervised' && !input.sessionId)) badRequest('Select a valid competition project, device and session');
  if (input.sessionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.sessionId)) badRequest('Invalid competition session id');
  await platformQuery(db, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`competition:${input.eventId}:${input.userId}:${input.ticketId}`]);
  const sessions = await platformQuery<{ id: string; supervisor_user_id: number | null; capacity: number; available_time: boolean }>(db, `
    SELECT id::text,supervisor_user_id,capacity,starts_at>NOW() AS available_time
    FROM platform_competition_sessions WHERE ($1::uuid IS NULL OR id=$1::uuid)
      AND event_id=$2::uuid AND session_kind=$3 FOR UPDATE
  `, [input.sessionId ?? null,input.eventId,config.supervision_mode]);
  const session = sessions[0];
  if (!session || (config.supervision_mode === 'supervised' && (!session.supervisor_user_id || !session.available_time))) conflict('The supervised session is unavailable');
  if (Number(session.supervisor_user_id) === input.userId) conflict('A supervisor cannot enter their own supervised session');
  const existing = await platformQuery<{ count: string; duplicate: boolean }>(db, `
    SELECT COUNT(*) FILTER (WHERE competition_session_id=$1::uuid)::text AS count,
      COALESCE(BOOL_OR(user_id=$3 AND ticket_type_id=$4::uuid),false) AS duplicate
    FROM platform_event_registrations WHERE event_id=$2::uuid AND status IN ('reserved','confirmed','attended')
  `, [session.id,input.eventId,input.userId,input.ticketId]);
  if (existing[0]?.duplicate) conflict('You already have an active registration for this project and device');
  if (Number(existing[0]?.count ?? 0) >= session.capacity) conflict('The supervised session is full');
  return { sessionId: session.id, project: config.project, device: config.device, organizationId: config.organization_id,
    commissionBps: config.commission_bps, settlementDays: config.settlement_days, settlementAnchor: config.settlement_anchor,
    refundPolicy: config.refund_policy, recordingPolicy: config.recording_policy };
}

export async function requireCompetitionRegistration(db: PlatformDb, id: string, lock = true) {
  const rows = await platformQuery<{ id: string; user_id: number; status: string; event_id: string; session_id: string; competition_project: (typeof WCA_TIMED_EVENT_ORDER)[number]; competition_video_generation: string; supervisor_user_id: number | null; session_kind: string; competition_format: string | null; device: string; in_check_in_window: boolean; has_started: boolean; checked_in_at: string | null }>(db, `
    SELECT r.id::text,r.user_id,r.status,r.event_id::text,s.id::text AS session_id,r.checked_in_at,r.competition_project,r.competition_video_generation::text,s.supervisor_user_id,s.session_kind,c.competition_format,t.competition_device AS device,t.amount_minor,
      ${competitionCheckInWindow('s')} AS in_check_in_window,
      (clock_timestamp()>=s.starts_at AND clock_timestamp()<s.ends_at) AS has_started
    FROM platform_event_registrations r JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_events e ON e.id=r.event_id AND e.status='published'
    JOIN platform_competitions c ON c.event_id=r.event_id
    JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
    WHERE r.id=$1::uuid ${lock ? 'FOR UPDATE OF r' : ''}
  `, [id]);
  if (!rows[0]) notFound('Competition registration');
  return rows[0];
}

export async function finishCompetitionSelfAttempt(db: PlatformDb, id: string, number: number, userId: number | null, result: ReturnType<typeof validateCompetitionAttempt>, review: boolean) {
  const [updated] = await platformQuery(db, `UPDATE platform_competition_attempts SET centiseconds=$3,penalty=$4,recorded_at=NOW(),recorded_by=$5,review_required=$6
    WHERE registration_id=$1::uuid AND attempt_number=$2 AND recorded_at IS NULL RETURNING attempt_number`,
  [id, number, result.centiseconds, result.penalty, userId, review]);
  if (!updated) conflict('The attempt has not been issued or was already recorded');
  if (number !== 5) return false;
  const recorded = await platformQuery(db, `SELECT centiseconds,penalty FROM platform_competition_attempts
    WHERE registration_id=$1::uuid AND recorded_at IS NOT NULL ORDER BY attempt_number`, [id]);
  const attempts = validateCompetitionAttempts(recorded);
  await platformQuery(db, `UPDATE platform_event_registrations SET competition_attempts=$2::jsonb,result_recorded_by=$3,
    result_recorded_at=NOW(),status='attended' WHERE id=$1::uuid`, [id, attempts, userId]);
  return true;
}
