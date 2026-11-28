import { competitionCheckInWindow } from '../platform/competition_checkin.js';
import { COMPETITION_OBSERVATION_WINDOW_MS } from '@cuberoot/shared/timer';
import { requirePlatformActor, type PlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, platformTransaction, sendMutation, withIdempotency, type PlatformDb } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { booleanField, enumField, integerField, readJsonObject, stringField } from '../platform/validation.js';
import type { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { competitionEntrant, competitionManagerAccess, finishCompetitionSelfAttempt, requireCompetitionManager, requireCompetitionRegistration, validateCompetitionAttempts, validateCompetitionAttempt } from '../platform/competitions.js';
import { competitionScramble } from '../platform/competition_workflow.js';
import { advanceCompetitionArena, arenaDnfReason, arenaEntry, arenaSolveAt, competitionArenaSnapshot, lockArenaRound, ORDINARY_ARENA_OBSERVATION_WINDOW_MS, recordArenaDnf, competitionArenaLobby, lockCompetitionArenaSession, readyCompetitionArena, requireLegacyScrambleWindow } from '../platform/competition_arena.js';
import { competitionLiveCredentials } from '../platform/competition_live.js';
import { competitionSupervisionReady } from './video_rooms.js';

export const platformCompetitionAttemptRoutes = platformRouter();

function registrationId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) badRequest('Invalid registration id');
  return value;
}

type Registration = {
  id: string; user_id: number; supervisor_user_id: number; status: string; event_status: string;
  checked_in_at: string | null; judge_entrant: boolean; supervisor_independent: boolean; can_manage: boolean; in_check_in_window: boolean; has_started: boolean; session_id: string; device: string; competition_video_generation: string;
  competition_project: (typeof WCA_TIMED_EVENT_ORDER)[number]; competition_format: string | null; result_recorded_at: string | null;
};
async function registration(db: PlatformDb, id: string, actor: PlatformActor, lock = false): Promise<Registration> {
  if (lock) {
    const [seat] = await platformQuery<{ session_id: string }>(db,
      'SELECT competition_session_id::text AS session_id FROM platform_event_registrations WHERE id=$1::uuid', [id]);
    if (seat?.session_id) await lockCompetitionArenaSession(db, seat.session_id);
  }
  const [row] = await platformQuery<Registration>(db, `SELECT r.id::text,r.user_id,r.status,r.checked_in_at,t.competition_device AS device,
    r.competition_video_generation::text,r.competition_project,r.result_recorded_at,s.supervisor_user_id,e.status AS event_status,c.competition_format,
    NOT ${competitionEntrant('e.id','s.supervisor_user_id')} AS supervisor_independent,
    ${competitionEntrant('e.id','$2')} AS judge_entrant,((c.is_test OR $3) AND ${competitionManagerAccess('$2','$3')}) AS can_manage,
    s.id::text AS session_id,${competitionCheckInWindow('s')} AS in_check_in_window,
    (s.starts_at<=clock_timestamp() AND clock_timestamp()<s.ends_at) AS has_started
    FROM platform_event_registrations r JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
    JOIN platform_events e ON e.id=r.event_id JOIN platform_competitions c ON c.event_id=e.id WHERE r.id=$1::uuid ${lock ? 'FOR UPDATE OF r' : ''}`, [id, actor.userId, actor.isAdmin === true]);
  if (!row) notFound('Registration');
  if (actor.userId !== Number(row.user_id) && !(actor.userId === Number(row.supervisor_user_id) && !row.judge_entrant)
    && (lock || !row.can_manage)) forbidden('Only the entrant and authorized competition officials can access attempts');
  return row;
}
function requireIndependentSupervisor(row: Registration, userId: number | null) {
  if (Number(row.supervisor_user_id) !== userId || Number(row.user_id) === userId || row.judge_entrant) {
    forbidden('Only the assigned non-participating supervisor can release or record attempts');
  }
}
type CameraAdmission = Pick<Registration, 'competition_video_generation' | 'checked_in_at' | 'user_id' | 'supervisor_user_id' | 'supervisor_independent' | 'status'>;
function admissionKey(row: CameraAdmission) {
  return JSON.stringify([row.competition_video_generation, row.checked_in_at, row.user_id, row.supervisor_user_id, row.status]);
}

function supervised(row: Registration, userId: number | null) {
  requireIndependentSupervisor(row, userId);
  if (row.competition_format === 'advancement' || !['confirmed','attended'].includes(row.status) || row.event_status !== 'published' || !row.in_check_in_window || !row.checked_in_at || row.result_recorded_at) {
    conflict('Check-in, an active session and an unfinished paid registration are required');
  }
}

async function checkCameras(row: CameraAdmission & { id: string }) {
  return row.supervisor_independent && await competitionSupervisionReady(row.id, row.competition_video_generation, Number(row.user_id), Number(row.supervisor_user_id))
    ? admissionKey(row) : null;
}

function requireCameras(row: CameraAdmission, credential: string | null) {
  if (!row.supervisor_independent || credential !== admissionKey(row)) conflict('The entrant and supervisor must both be connected with their cameras on');
}

async function supervisorCameras(id: string, actor: PlatformActor) {
  const row = await registration(platformDb(), id, actor);
  // Preserve idempotent replays after the session closes or the camera disconnects.
  if (Number(row.supervisor_user_id) !== actor.userId) return null;
  return row.checked_in_at && row.in_check_in_window && row.event_status === 'published'
    && row.competition_format !== 'advancement' && !row.judge_entrant && !row.result_recorded_at
    ? checkCameras(row) : null;
}

const ATTEMPTS = `SELECT a.attempt_number AS "attemptNumber",a.scramble,a.issued_at AS "issuedAt",a.centiseconds,a.penalty,a.recorded_at AS "recordedAt",a.review_required AS "reviewRequired",
  (SELECT jsonb_build_object('runId',d.run_id,'status',CASE WHEN d.report IS NULL THEN 'started' ELSE 'device_reported' END,
    'startedAt',d.started_at,'reportedAt',d.reported_at,'durationMs',d.report->'durationMs','disconnected',d.report->'disconnected',
    'deviceBrand',d.report->'deviceBrand','moveCount',jsonb_array_length(d.report->'moves'))
   FROM platform_competition_device_reports d WHERE d.registration_id=a.registration_id AND d.attempt_number=a.attempt_number) AS telemetry,
  a.arena_round_id IS NOT NULL AS synchronized
  FROM platform_competition_attempts a WHERE a.registration_id=$1::uuid AND a.issued_at<=clock_timestamp() ORDER BY a.attempt_number`;

platformCompetitionAttemptRoutes.get('/platform/competitions/registrations/:id/arena', async c => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  return c.json(await platformTransaction(async db => {
    const entry = await arenaEntry(db, id, actor.userId, true);
    const lobby = entry.in_check_in_window ? await competitionArenaLobby(db, entry) : undefined;
    const lobbyState = lobby ? {
      sessionStartsAt: lobby.sessionStartsAt, totalEntrants: lobby.totalEntrants,
      checkedInCount: lobby.checkedInCount, readyCount: lobby.readyCount, lobbyPlayers: lobby.lobbyPlayers,
      ownReady: lobby.lobbyPlayers.some(player => player.id === id && player.ready),
    } : {};
    if (!entry.checked) return {
      ...lobbyState, waitingForStart: !!lobby,
      serverNow: new Date(), checkedIn: false, roomId: null, roundNumber: null, startsAt: null,
      seated: false, completed: false, scramble: null, credentials: null, inspectAt: null, solveAt: null, players: [],
    };
    const round = await lockArenaRound(db, entry);
    if (round) await advanceCompetitionArena(db, round);
    const snapshot = await competitionArenaSnapshot(db, entry);
    const roomId = typeof snapshot?.roomId === 'string' && snapshot.seated ? snapshot.roomId : null;
    return { ...lobbyState, ...snapshot, waitingForStart: !!lobby && !round && !snapshot?.legacy, checkedIn: true, credentials: roomId ? competitionLiveCredentials(roomId, actor.userId) : null };
  }));
});

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/arena', async c => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const body = await readJsonObject(c);
  const previous = await arenaEntry(platformDb(), id, actor.userId);
  const cameras = previous.kind === 'supervised' && previous.in_check_in_window
    ? await checkCameras(await registration(platformDb(), id, actor)) : null;
  return sendMutation(c, await withIdempotency(c, actor, `competition.arena.ready:${id}`, body, async db => {
    await lockCompetitionArenaSession(db, previous.session_id);
    const entry = await arenaEntry(db, id, actor.userId);
    if (!entry.in_check_in_window || entry.session_id !== previous.session_id) conflict('The session is closed or has changed');
    if (entry.kind === 'supervised') {
      const row = await registration(db, id, actor, true);
      if (!row.checked_in_at || row.result_recorded_at || !row.in_check_in_window || row.session_id !== entry.session_id) {
        conflict('Check-in and an active unfinished registration are required');
      }
      requireCameras(row, cameras);
    }
    const roomId = await readyCompetitionArena(db, entry);
    return { status: 200, body: { roomId, waitingForStart: roomId === null } };
  }));
});

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/arena/phase', async c => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const body = await readJsonObject(c);
  const number = integerField(body, 'attemptNumber', { required: true, min: 1, max: 5 })!;
  const phase = enumField(body, 'phase', ['inspecting', 'solving', 'timeout', 'disconnected'], { required: true })!;
  const inspectionMs = integerField(body, 'inspectionMs', { min: 0, max: COMPETITION_OBSERVATION_WINDOW_MS });
  return sendMutation(c, await withIdempotency(c, actor, `competition.arena.phase:${id}:${number}`, body, async db => {
    const entry = await arenaEntry(db, id, actor.userId);
    await requireCompetitionRegistration(db, id);
    const [attempt] = await platformQuery<{
      issued_at: Date; inspect_at: Date | null; solve_at: Date | null; recorded_at: Date | null; now: Date; dnf_reason: string | null;
    }>(db, `SELECT a.*,clock_timestamp() AS now FROM platform_competition_attempts a
      WHERE a.registration_id=$1::uuid AND a.attempt_number=$2`, [id, number]);
    if (!attempt || attempt.issued_at > attempt.now) conflict('The round has not started');
    if (attempt.recorded_at) return { status: 200, body: { dnfReason: attempt.dnf_reason } };
    const smart = entry.device === 'smart';
    const reason = arenaDnfReason(attempt.issued_at, attempt.inspect_at, attempt.solve_at, attempt.now, smart)
      ?? (phase === 'disconnected' && smart ? 'disconnected' : null);
    if (reason) {
      await recordArenaDnf(db, id, number, reason);
      return { status: 200, body: { dnfReason: reason } };
    }
    if (phase === 'inspecting' && !attempt.inspect_at && entry.device === 'ordinary') {
      await platformQuery(db, 'UPDATE platform_competition_attempts SET inspect_at=$3 WHERE registration_id=$1::uuid AND attempt_number=$2', [id, number, attempt.now]);
    }
    if (phase === 'solving' && attempt.inspect_at && !attempt.solve_at) {
      if (!smart && inspectionMs !== undefined && inspectionMs > ORDINARY_ARENA_OBSERVATION_WINDOW_MS) badRequest('Invalid inspection duration');
      const solve = arenaSolveAt(attempt.inspect_at, attempt.now, inspectionMs, smart);
      if (+solve > +attempt.now + 1000) badRequest('The inspection duration exceeds the server clock');
      await platformQuery(db, 'UPDATE platform_competition_attempts SET solve_at=$3 WHERE registration_id=$1::uuid AND attempt_number=$2', [id, number, solve]);
    }
    return { status: 200, body: {} };
  }));
});

platformCompetitionAttemptRoutes.get('/platform/competitions/registrations/:id/attempts', async (c) => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const row = await registration(platformDb(),id,actor);
  if (!['confirmed','attended'].includes(row.status) || (row.device === 'smart' && !row.checked_in_at)) forbidden('An active checked-in registration is required');
  return c.json({ attempts: await platformQuery(platformDb(),ATTEMPTS,[id]) });
});

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/attempts/next', async (c) => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const body = await readJsonObject(c);
  const cameras = await supervisorCameras(id, actor);
  return sendMutation(c,await withIdempotency(c,actor,`competition.attempt.next:${id}`,body,async(db) => {
    // One supervisor can actively supervise only one solve, even across competitions.
    await platformQuery(db,`SELECT pg_advisory_xact_lock(hashtextextended('competition-supervisor:' || $1::text,0))`,[actor.userId]);
    const row = await registration(db,id,actor,true);
    supervised(row,actor.userId);
    requireCameras(row, cameras);
    const attempts = await platformQuery(db,ATTEMPTS,[id]);
    const pending = attempts.find(attempt => !attempt.recordedAt);
    if (pending) return { status:200,body:{attempt:pending} };
    const [arena] = await platformQuery(db, `SELECT 1 FROM platform_competition_arena_rounds ar
      JOIN platform_event_registrations r ON r.competition_session_id=ar.session_id AND r.competition_project=ar.project
      JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id AND t.competition_device=ar.device
      WHERE r.id=$1::uuid AND EXISTS (SELECT 1 FROM platform_competition_attempts a WHERE a.registration_id=r.id AND a.arena_round_id=ar.id)`, [id]);
    if (arena || !attempts.length) conflict('The arena releases the next scramble automatically');
    if (attempts.length >= 5) conflict('All five attempts have already been recorded');
    const busy = await platformQuery(db,`SELECT a.registration_id FROM platform_competition_attempts a
      JOIN platform_event_registrations r ON r.id=a.registration_id JOIN platform_competition_sessions s ON s.id=r.competition_session_id
      WHERE s.supervisor_user_id=$1 AND a.recorded_at IS NULL AND a.registration_id<>$2::uuid
        AND r.status IN ('confirmed','attended') AND NOW()<s.ends_at LIMIT 1`,[actor.userId,id]);
    if (busy.length) conflict('Finish the currently supervised attempt before starting another entrant');
    await requireLegacyScrambleWindow(db, { ...row, project: row.competition_project }, row.has_started);
    const scramble = await competitionScramble(row.competition_project);
    await platformQuery(db,`INSERT INTO platform_competition_attempts(registration_id,attempt_number,scramble,issued_at)
      VALUES($1::uuid,$2,$3,NOW())`,[id,attempts.length+1,scramble]);
    const fresh = await platformQuery(db,ATTEMPTS,[id]);
    return { status:201,body:{attempt:fresh[fresh.length-1]},resourceType:'competition_attempt',resourceId:id };
  }, async db => requireIndependentSupervisor(await registration(db, id, actor, true), actor.userId)));
});

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/attempts/:number/result', async (c) => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const number = c.req.param('number');
  if (!/^[1-5]$/.test(number)) badRequest('Attempt number must be between one and five');
  const body = await readJsonObject(c);
  const result = validateCompetitionAttempt(body);
  const cameras = await supervisorCameras(id, actor);
  return sendMutation(c,await withIdempotency(c,actor,`competition.attempt.result:${id}:${number}`,body,async(db) => {
    const row = await registration(db,id,actor,true);
    supervised(row,actor.userId);
    requireCameras(row, cameras);
    if (row.device === 'smart') conflict('Smart cube results require a verified device report');
    const [arena] = await platformQuery<{ issued_at: Date; inspect_at: Date | null; solve_at: Date | null; now: Date }>(db, `SELECT a.*,clock_timestamp() AS now
      FROM platform_competition_attempts a
      WHERE a.registration_id=$1::uuid AND a.attempt_number=$2 AND a.arena_round_id IS NOT NULL AND a.recorded_at IS NULL`, [id, Number(number)]);
    if (arena) {
      if (arena.issued_at > arena.now) conflict('This arena seat requires its active timing flow');
      const reason = arenaDnfReason(arena.issued_at, arena.inspect_at, arena.solve_at, arena.now, false);
      if (reason) await recordArenaDnf(db, id, Number(number), reason);
      else await finishCompetitionSelfAttempt(db, id, Number(number), actor.userId, result, false);
      return { status: 200, body: { attempts: await platformQuery(db, ATTEMPTS, [id]) } };
    }
    const changed = await platformQuery(db,`UPDATE platform_competition_attempts SET centiseconds=$3,penalty=$4,recorded_at=NOW(),recorded_by=$5
      WHERE registration_id=$1::uuid AND attempt_number=$2 AND recorded_at IS NULL AND issued_at<=clock_timestamp() RETURNING attempt_number`,[id,Number(number),result.centiseconds,result.penalty,actor.userId]);
    if (!changed.length) conflict('The attempt has not been issued or was already recorded');
    return { status:200,body:{attempts:await platformQuery(db,ATTEMPTS,[id])},resourceType:'competition_attempt',resourceId:id };
  }, async db => requireIndependentSupervisor(await registration(db, id, actor, true), actor.userId)));
});

async function selfServiceRegistration(db: PlatformDb, id: string, userId: number | null) {
  const row = await requireCompetitionRegistration(db, id);
  if (Number(row.user_id) !== userId) forbidden('Only the participant can manage their attempts');
  if (row.session_kind !== 'self_service' || row.competition_format === 'advancement' || !row.checked_in_at || !row.in_check_in_window) {
    conflict('An active checked-in self-service registration is required');
  }
  return row;
}

platformCompetitionAttemptRoutes.post('/platform/competitions/registrations/:id/self-attempts/next', async c => {
  const actor = await requirePlatformActor(c);
  const id = registrationId(c.req.param('id'));
  const body = await readJsonObject(c);
  return sendMutation(c, await withIdempotency(c, actor, `competition.self.next:${id}`, body, async db => {
    const seat = await requireCompetitionRegistration(db, id, false);
    if (Number(seat.user_id) !== actor.userId) forbidden('Only the participant can manage their attempts');
    await lockCompetitionArenaSession(db, seat.session_id);
    const row = await selfServiceRegistration(db, id, actor.userId);
    if (row.status !== 'confirmed') conflict('This registration is no longer open for attempts');
    const attempts = await platformQuery(db, ATTEMPTS, [id]);
    const pending = attempts.find(attempt => !attempt.recordedAt);
    if (pending) return { status: 200, body: { attempt: pending } };
    const [arena] = await platformQuery(db, `SELECT 1 FROM platform_competition_arena_rounds ar
      WHERE ar.session_id=$1::uuid AND ar.project=$2 AND ar.device=$3
        AND EXISTS (SELECT 1 FROM platform_competition_attempts a WHERE a.registration_id=$4::uuid AND a.arena_round_id=ar.id)`,
    [row.session_id, row.competition_project, row.device, id]);
    if (arena || !attempts.length) conflict('The arena releases the next scramble automatically');
    if (attempts.length >= 5) conflict('All attempts are recorded');
    await requireLegacyScrambleWindow(db, { ...row, project: row.competition_project }, row.has_started);
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
    const [attempt] = await platformQuery<{ recorded_at: string | null; centiseconds: number | null; penalty: string | null; elapsed_ms: string; issued_at: Date; arena_round_id: string | null; inspect_at: Date | null; solve_at: Date | null; now: Date }>(
      db, `SELECT recorded_at,centiseconds,penalty,issued_at,arena_round_id,inspect_at,solve_at,clock_timestamp() AS now,EXTRACT(EPOCH FROM clock_timestamp()-COALESCE(solve_at,issued_at))*1000 AS elapsed_ms
      FROM platform_competition_attempts WHERE registration_id=$1::uuid AND attempt_number=$2`, [id, attemptNumber]);
    if (!attempt) notFound('Issued attempt');
    if (attempt.recorded_at) {
      if (attempt.centiseconds !== result.centiseconds || attempt.penalty !== result.penalty) conflict('This attempt already has a different result');
      return { status: 200, body: { finished: row.status === 'attended' } };
    }
    if (attempt.issued_at > attempt.now) conflict('The round has not started');
    if (attempt.arena_round_id) {
      const reason = arenaDnfReason(attempt.issued_at, attempt.inspect_at, attempt.solve_at, attempt.now, false);
      if (reason) {
        await recordArenaDnf(db, id, attemptNumber, reason);
        return { status: 200, body: { finished: attemptNumber === 5, dnfReason: reason } };
      }
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
  async function authorize(db: PlatformDb) {
    const [entry] = await platformQuery<{ event_id: string }>(db,
      'SELECT event_id::text FROM platform_event_registrations WHERE id=$1::uuid AND competition_session_id IS NOT NULL', [id]);
    if (!entry) notFound('Competition registration');
    return requireCompetitionManager(db, actor, entry.event_id);
  }
  return sendMutation(c, await withIdempotency(c, actor, `competition.self.review:${id}:${number}`, body, async db => {
    const event = await authorize(db);
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
  }, authorize));
});
