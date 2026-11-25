import { requirePlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, sendMutation, withIdempotency, type PlatformDb } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { booleanField, enumField, integerField, readJsonObject, stringField } from '../platform/validation.js';
import type { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { finishCompetitionSelfAttempt, requireCompetitionManager, requireCompetitionRegistration, validateCompetitionAttempts, validateCompetitionAttempt } from '../platform/competitions.js';
import { competitionScramble } from '../platform/competition_workflow.js';
import { competitionSupervisionReady } from './video_rooms.js';

export const platformCompetitionAttemptRoutes = platformRouter();

function registrationId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) badRequest('Invalid registration id');
  return value;
}

type Registration = {
  id: string; user_id: number; supervisor_user_id: number; status: string; event_status: string;
  checked_in_at: string | null; in_window: boolean; competition_video_generation: string;
  competition_project: (typeof WCA_TIMED_EVENT_ORDER)[number]; competition_format: string | null; result_recorded_at: string | null;
};
async function registration(db: PlatformDb, id: string, userId: number | null, lock = false, adminRead = false): Promise<Registration> {
  const [row] = await platformQuery<Registration>(db, `SELECT r.id::text,r.user_id,r.status,r.checked_in_at,
    r.competition_video_generation::text,r.competition_project,r.result_recorded_at,s.supervisor_user_id,e.status AS event_status,c.competition_format,
    (NOW()>=s.starts_at AND NOW()<s.ends_at) AS in_window
    FROM platform_event_registrations r JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_events e ON e.id=r.event_id JOIN platform_competitions c ON c.event_id=e.id WHERE r.id=$1::uuid ${lock ? 'FOR UPDATE OF r,s' : ''}`, [id]);
  if (!row) notFound('Registration');
  if (!adminRead && (userId == null || ![Number(row.user_id),Number(row.supervisor_user_id)].includes(userId))) forbidden('Only the entrant and assigned supervisor can access attempts');
  return row;
}
async function supervised(row: Registration, userId: number | null): Promise<void> {
  if (Number(row.supervisor_user_id) !== userId || Number(row.user_id) === userId) forbidden('Only the assigned non-participating supervisor can release or record attempts');
  if (row.competition_format === 'advancement' || !['confirmed','attended'].includes(row.status) || row.event_status !== 'published' || !row.in_window || !row.checked_in_at || row.result_recorded_at) {
    conflict('Check-in, an active session and an unfinished paid registration are required');
  }
  if (!await competitionSupervisionReady(row.id,row.competition_video_generation,Number(row.user_id),Number(row.supervisor_user_id))) {
    conflict('The entrant and supervisor must both be connected with their cameras on');
  }
}

const ATTEMPTS = `SELECT a.attempt_number AS "attemptNumber",a.scramble,a.issued_at AS "issuedAt",a.centiseconds,a.penalty,a.recorded_at AS "recordedAt",a.review_required AS "reviewRequired",
  (SELECT jsonb_build_object('runId',d.run_id,'status',CASE WHEN d.report IS NULL THEN 'started' ELSE 'device_reported' END,
    'startedAt',d.started_at,'reportedAt',d.reported_at,'durationMs',d.report->'durationMs','disconnected',d.report->'disconnected',
    'deviceBrand',d.report->'deviceBrand','moveCount',jsonb_array_length(d.report->'moves'))
   FROM platform_competition_device_reports d WHERE d.registration_id=a.registration_id AND d.attempt_number=a.attempt_number) AS telemetry
  FROM platform_competition_attempts a WHERE a.registration_id=$1::uuid ORDER BY a.attempt_number`;

platformCompetitionAttemptRoutes.get('/platform/competitions/registrations/:id/attempts', async (c) => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const row = await registration(platformDb(),id,actor.userId,false,actor.isAdmin);
  if (!['confirmed','attended'].includes(row.status)) forbidden('The registration is no longer active');
  return c.json({ attempts: await platformQuery(platformDb(),ATTEMPTS,[id]) });
});

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/attempts/next', async (c) => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const body = await readJsonObject(c);
  return sendMutation(c,await withIdempotency(c,actor,`competition.attempt.next:${id}`,body,async(db) => {
    // One supervisor can actively supervise only one solve, even across competitions.
    await platformQuery(db,`SELECT pg_advisory_xact_lock(hashtextextended('competition-supervisor:' || $1::text,0))`,[actor.userId]);
    const row = await registration(db,id,actor.userId,true);
    await supervised(row,actor.userId);
    const attempts = await platformQuery(db,ATTEMPTS,[id]);
    const pending = attempts.find(attempt => !attempt.recordedAt);
    if (pending) return { status:200,body:{attempt:pending} };
    if (attempts.length >= 5) conflict('All five attempts have already been recorded');
    const busy = await platformQuery(db,`SELECT a.registration_id FROM platform_competition_attempts a
      JOIN platform_event_registrations r ON r.id=a.registration_id JOIN platform_competition_sessions s ON s.id=r.competition_session_id
      WHERE s.supervisor_user_id=$1 AND a.recorded_at IS NULL AND a.registration_id<>$2::uuid
        AND r.status IN ('confirmed','attended') AND NOW()<s.ends_at LIMIT 1`,[actor.userId,id]);
    if (busy.length) conflict('Finish the currently supervised attempt before starting another entrant');
    const scramble = await competitionScramble(row.competition_project);
    await platformQuery(db,`INSERT INTO platform_competition_attempts(registration_id,attempt_number,scramble,issued_at)
      VALUES($1::uuid,$2,$3,NOW())`,[id,attempts.length+1,scramble]);
    const fresh = await platformQuery(db,ATTEMPTS,[id]);
    return { status:201,body:{attempt:fresh[fresh.length-1]},resourceType:'competition_attempt',resourceId:id };
  }));
});

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/attempts/:number/result', async (c) => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const number = c.req.param('number');
  if (!/^[1-5]$/.test(number)) badRequest('Attempt number must be between one and five');
  const body = await readJsonObject(c);
  const result = validateCompetitionAttempt(body);
  return sendMutation(c,await withIdempotency(c,actor,`competition.attempt.result:${id}:${number}`,body,async(db) => {
    const row = await registration(db,id,actor.userId,true);
    await supervised(row,actor.userId);
    const changed = await platformQuery(db,`UPDATE platform_competition_attempts SET centiseconds=$3,penalty=$4,recorded_at=NOW(),recorded_by=$5
      WHERE registration_id=$1::uuid AND attempt_number=$2 AND recorded_at IS NULL RETURNING attempt_number`,[id,Number(number),result.centiseconds,result.penalty,actor.userId]);
    if (!changed.length) conflict('The attempt has not been issued or was already recorded');
    return { status:200,body:{attempts:await platformQuery(db,ATTEMPTS,[id])},resourceType:'competition_attempt',resourceId:id };
  }));
});

async function selfServiceRegistration(db: PlatformDb, id: string, userId: number | null) {
  const row = await requireCompetitionRegistration(db, id);
  if (Number(row.user_id) !== userId) forbidden('Only the participant can manage their attempts');
  if (row.session_kind !== 'self_service' || row.competition_format === 'advancement' || !row.checked_in_at || !row.in_window) {
    conflict('An active checked-in self-service registration is required');
  }
  return row;
}

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/self-attempts/next', async c => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const body = await readJsonObject(c);
  return sendMutation(c, await withIdempotency(c, actor, `competition.self.next:${id}`, body, async db => {
    const row = await selfServiceRegistration(db, id, actor.userId);
    if (row.status !== 'confirmed') conflict('This registration is no longer open for attempts');
    const attempts = await platformQuery(db, ATTEMPTS, [id]);
    const pending = attempts.find(attempt => !attempt.recordedAt);
    if (pending) return { status: 200, body: { attempt: pending } };
    if (attempts.length >= 5) conflict('All attempts are recorded');
    const scramble = await competitionScramble(row.competition_project);
    await platformQuery(db, `INSERT INTO platform_competition_attempts(registration_id,attempt_number,scramble)
      VALUES($1::uuid,$2,$3)`, [id, attempts.length + 1, scramble]);
    const fresh = await platformQuery(db, ATTEMPTS, [id]);
    return { status: 201, body: { attempt: fresh.at(-1) } };
  }));
});

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/self-attempts/:number/complete', async c => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const number = c.req.param('number');
  if (!/^[1-5]$/.test(number)) badRequest('Attempt number must be between one and five');
  const body = await readJsonObject(c);
  const result = validateCompetitionAttempt(body);
  if (result.penalty === 'DNS') badRequest('An issued attempt cannot be marked DNS');
  return sendMutation(c, await withIdempotency(c, actor, `competition.self.complete:${id}:${number}`, body, async db => {
    const row = await selfServiceRegistration(db, id, actor.userId);
    if (!['confirmed', 'attended'].includes(row.status) || row.device !== 'ordinary') conflict('Only ordinary self-service results can be entered manually');
    const attemptNumber = Number(number);
    const [attempt] = await platformQuery<{ recorded_at: string | null; centiseconds: number | null; penalty: string | null; elapsed_ms: string }>(
      db, `SELECT recorded_at,centiseconds,penalty,EXTRACT(EPOCH FROM NOW()-issued_at)*1000 AS elapsed_ms
      FROM platform_competition_attempts WHERE registration_id=$1::uuid AND attempt_number=$2`, [id, attemptNumber]);
    if (!attempt) notFound('Issued attempt');
    if (attempt.recorded_at) {
      if (attempt.centiseconds !== result.centiseconds || attempt.penalty !== result.penalty) conflict('This attempt already has a different result');
      return { status: 200, body: { finished: row.status === 'attended' } };
    }
    const recordedLocally = booleanField(body, 'recordedLocally');
    const evidenceId = stringField(body, 'recordingEvidenceId', { max: 36 });
    if (evidenceId) {
      const [evidence] = await platformQuery(db, `SELECT id FROM platform_competition_evidence
        WHERE id=$1::uuid AND registration_id=$2::uuid AND attempt_number=$3 AND uploaded_by=$4`,
      [registrationId(evidenceId), id, attemptNumber, actor.userId]);
      if (!evidence) badRequest('The recording evidence must belong to this attempt');
    } else if (!recordedLocally) {
      badRequest('Record this attempt locally or upload its review clip before submitting');
    }
    if ((result.centiseconds ?? 0) * 10 > Number(attempt.elapsed_ms) + 1000) badRequest('The result exceeds the time since the attempt was issued');
    const finished = await finishCompetitionSelfAttempt(db, id, attemptNumber, actor.userId, result, true);
    return { status: 200, body: { finished } };
  }));
});

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/review-clear', async c => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const body = await readJsonObject(c);
  const number = integerField(body, 'attemptNumber', { required: true, min: 1, max: 5 })!;
  const decision = enumField(body, 'decision', ['approve', 'DNF'], { required: true })!;
  const note = stringField(body, 'note', { max: 1000 }) ?? '';
  return sendMutation(c, await withIdempotency(c, actor, `competition.self.review:${id}:${number}`, body, async db => {
    const [entry] = await platformQuery<{ event_id: string }>(db,
      'SELECT event_id::text FROM platform_event_registrations WHERE id=$1::uuid AND competition_session_id IS NOT NULL', [id]);
    if (!entry) notFound('Competition registration');
    const event = await requireCompetitionManager(db, actor, entry.event_id);
    if (event.status !== 'published' || event.supervision_mode !== 'self_service' || event.competition_format === 'advancement') {
      conflict('Only an active self-service competition result can be reviewed');
    }
    const registration = await requireCompetitionRegistration(db, id);
    if (registration.session_kind !== 'self_service' || !['confirmed', 'attended'].includes(registration.status)) {
      conflict('The registration is no longer eligible for review');
    }
    const [previous] = await platformQuery<ReturnType<typeof validateCompetitionAttempt>>(db, `SELECT centiseconds,penalty
      FROM platform_competition_attempts WHERE registration_id=$1::uuid AND attempt_number=$2
        AND recorded_at IS NOT NULL AND review_required`, [id, number]);
    if (!previous) conflict('This attempt is not awaiting a spot check');
    const result = decision === 'DNF' ? { centiseconds: null, penalty: 'DNF' } : previous;
    await platformQuery(db, `UPDATE platform_competition_attempts SET review_required=FALSE,centiseconds=$3,penalty=$4
      WHERE registration_id=$1::uuid AND attempt_number=$2`, [id, number, result.centiseconds, result.penalty]);
    if (decision === 'DNF' && registration.status === 'attended') {
      const [stored] = await platformQuery<{ competition_attempts: unknown }>(db, 'SELECT competition_attempts FROM platform_event_registrations WHERE id=$1::uuid', [id]);
      const scores = validateCompetitionAttempts(stored.competition_attempts);
      scores[number - 1] = { centiseconds: null, penalty: 'DNF' };
      await platformQuery(db, 'UPDATE platform_event_registrations SET competition_attempts=$2::jsonb WHERE id=$1::uuid', [id, scores]);
    }
    await platformQuery(db, `INSERT INTO platform_audit_events(actor_user_id,actor_key,action,resource_type,resource_id,outcome,metadata)
      VALUES($1,$2,'competition.self_attempt_review','competition_registration',$3,'allowed',$4::jsonb)`,
    [actor.userId, actor.ownerKey, id, { attemptNumber: number, decision, note, previous, result }]);
    return { status: 200, body: { attemptNumber: number, reviewRequired: false, ...result } };
  }));
});
