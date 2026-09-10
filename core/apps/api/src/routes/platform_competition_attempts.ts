import { requirePlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, sendMutation, withIdempotency, type PlatformDb } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { readJsonObject } from '../platform/validation.js';
import { validateCompetitionAttempt } from '../platform/competitions.js';
import { generateNetBattleScramble } from '../utils/battle_scramble.js';
import { competitionSupervisionReady } from './video_rooms.js';

export const platformCompetitionAttemptRoutes = platformRouter();

function registrationId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) badRequest('Invalid registration id');
  return value;
}

type Registration = {
  id: string; user_id: number; supervisor_user_id: number; status: string; event_status: string;
  checked_in_at: string | null; in_window: boolean; competition_video_generation: string;
  competition_project: '222' | '333' | '444' | '555'; result_recorded_at: string | null;
};
async function registration(db: PlatformDb, id: string, userId: number | null, lock = false, adminRead = false): Promise<Registration> {
  const [row] = await platformQuery<Registration>(db, `SELECT r.id::text,r.user_id,r.status,r.checked_in_at,
    r.competition_video_generation::text,r.competition_project,r.result_recorded_at,s.supervisor_user_id,e.status AS event_status,
    (NOW()>=s.starts_at AND NOW()<s.ends_at) AS in_window
    FROM platform_event_registrations r JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_events e ON e.id=r.event_id WHERE r.id=$1::uuid ${lock ? 'FOR UPDATE OF r,s' : ''}`, [id]);
  if (!row) notFound('Registration');
  if (!adminRead && (userId == null || ![Number(row.user_id),Number(row.supervisor_user_id)].includes(userId))) forbidden('Only the entrant and assigned supervisor can access attempts');
  return row;
}
async function supervised(row: Registration, userId: number | null): Promise<void> {
  if (Number(row.supervisor_user_id) !== userId || Number(row.user_id) === userId) forbidden('Only the assigned non-participating supervisor can release or record attempts');
  if (!['confirmed','attended'].includes(row.status) || row.event_status !== 'published' || !row.in_window || !row.checked_in_at || row.result_recorded_at) {
    conflict('Check-in, an active session and an unfinished paid registration are required');
  }
  if (!await competitionSupervisionReady(row.id,row.competition_video_generation,Number(row.user_id),Number(row.supervisor_user_id))) {
    conflict('The entrant and supervisor must both be connected with their cameras on');
  }
}

const ATTEMPTS = `SELECT a.attempt_number AS "attemptNumber",a.scramble,a.issued_at AS "issuedAt",a.centiseconds,a.penalty,a.recorded_at AS "recordedAt",
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
    const scramble = await generateNetBattleScramble(row.competition_project);
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
