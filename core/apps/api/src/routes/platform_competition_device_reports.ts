import { requirePlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, sendMutation, withIdempotency } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { readJsonObject, stringField } from '../platform/validation.js';
import { competitionDeviceResult, competitionReplay, validateCompetitionDeviceReport, verifyCompletedCompetitionDeviceReport } from '../platform/competition_device_reports.js';
import { finishCompetitionSelfAttempt, requireCompetitionRegistration } from '../platform/competitions.js';
import { arenaDnfReason, arenaSolveAt, recordArenaDnf } from '../platform/competition_arena.js';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { competitionSupervisionReady } from './video_rooms.js';

export const platformCompetitionDeviceReportRoutes=platformRouter();
function params(id:string,number:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!/^[1-5]$/.test(number))badRequest('Invalid attempt');
  return {id,number:Number(number)};
}
platformCompetitionDeviceReportRoutes.post('/platform/competitions/registrations/:id/attempts/:number/telemetry',async(c)=>{
  const actor=await requirePlatformActor(c),{id,number}=params(c.req.param('id'),c.req.param('number'));
  const body=await readJsonObject(c),report=validateCompetitionDeviceReport(body);
  return sendMutation(c,await withIdempotency(c,actor,`competition.device-report:${id}:${number}`,body,async(db)=>{
    const registration=await requireCompetitionRegistration(db,id);
    if(Number(registration.user_id)!==actor.userId)forbidden('Only the entrant may submit their device report');
    if(!['confirmed','attended'].includes(registration.status)||!registration.checked_in_at||!registration.in_window)conflict('An active checked-in registration is required');
    if (registration.device !== 'smart') conflict('Only smart cube seats can upload device data');
    if(registration.competition_project!=='333')conflict('Connected cube reports currently support 3x3');
    const [attempt]=await platformQuery<{scramble:string;issued_at:string;recorded_at:string|null;elapsed_ms:number; arena_round_id:string|null; inspect_at:Date|null; solve_at:Date|null; now:Date}>(db,`SELECT scramble,issued_at,recorded_at,arena_round_id,inspect_at,solve_at,clock_timestamp() AS now,EXTRACT(EPOCH FROM NOW()-issued_at)*1000 AS elapsed_ms
      FROM platform_competition_attempts WHERE registration_id=$1::uuid AND attempt_number=$2 FOR UPDATE`,[id,number]);
    if(!attempt)notFound('Issued attempt');
    if(attempt.recorded_at)conflict('The supervisor has already confirmed this attempt');
    if(attempt.scramble!==report.scramble||new Date(attempt.issued_at).toISOString()!==report.serverIssuedAt)conflict('The report does not match the server-issued attempt');
    if (new Date(attempt.issued_at) > attempt.now) conflict('The round has not started');
    if (attempt.arena_round_id) {
      const inspect = attempt.inspect_at;
      const solve = inspect ? arenaSolveAt(inspect, attempt.now, report.inspectionMs) : null;
      const reason = arenaDnfReason(new Date(attempt.issued_at), inspect, attempt.solve_at ?? solve, attempt.now)
        ?? (report.disconnected ? 'disconnected' : null);
      if (reason) {
        await recordArenaDnf(db, id, number, reason);
        return { status: 200, body: { status: 'DNF', dnfReason: reason } };
      }
      if (!inspect || report.inspectionMs === undefined) conflict('Start observation before recording a solve');
      if (attempt.solve_at && solve && Math.abs(+attempt.solve_at - +solve) > 2) badRequest('The reported inspection does not match the recorded start');
    }
    if(report.durationMs>Number(attempt.elapsed_ms)+1000)badRequest('The reported duration exceeds the time since the attempt was issued');
    const selfService = registration.session_kind === 'self_service' && registration.device === 'smart';
    if (registration.competition_format === 'advancement' || (!selfService
      && (!registration.supervisor_user_id || !await competitionSupervisionReady(id, registration.competition_video_generation, Number(registration.user_id), Number(registration.supervisor_user_id))))) {
      conflict('Both cameras must remain connected for a supervised device report');
    }
    if (!report.disconnected) verifyCompletedCompetitionDeviceReport(report);
    const rows=await platformQuery(db,`UPDATE platform_competition_device_reports SET report=$3::jsonb,reported_at=NOW()
      WHERE registration_id=$1::uuid AND attempt_number=$2 AND run_id=$4::uuid AND report IS NULL
        AND $5<=EXTRACT(EPOCH FROM clock_timestamp()-started_at)*1000+1000 RETURNING reported_at AS "reportedAt"`,[id,number,report,report.runId,report.durationMs + (report.inspectionMs ?? 0)]);
    if(!rows.length)conflict('The device run is missing, mismatched, already reported, or shorter than the reported duration');
    const suspicious = selfService && !report.disconnected && (report.durationMs < 250 || report.moves.length * 1000 > report.durationMs * 25);
    await finishCompetitionSelfAttempt(db, id, number, actor.userId, competitionDeviceResult(report), suspicious);
    return {status:201,body:{status:'device_reported',reportedAt:rows[0].reportedAt},resourceType:'competition_device_report',resourceId:id};
  }));
});
platformCompetitionDeviceReportRoutes.get('/platform/competitions/registrations/:id/attempts/:number/telemetry',async(c)=>{
  privateNoStore(c);
  const {id,number}=params(c.req.param('id'),c.req.param('number'));
  const [row]=await platformQuery<{
    report: ReturnType<typeof validateCompetitionDeviceReport> | null; runId: string; startedAt: Date; reportedAt: Date | null;
    user_id: string; supervisor_user_id: string | null; public_replay: boolean; arena_round_id: string | null; penalty: string | null;
  }>(platformDb(),`SELECT d.report,d.run_id AS "runId",d.started_at AS "startedAt",d.reported_at AS "reportedAt",r.user_id,s.supervisor_user_id,a.arena_round_id,a.penalty,
    (r.status='attended' AND c.finalized_at IS NOT NULL AND NOT c.is_test AND t.competition_device='smart') AS public_replay
    FROM platform_competition_device_reports d JOIN platform_event_registrations r ON r.id=d.registration_id
    JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_competitions c ON c.event_id=r.event_id JOIN platform_event_ticket_types t ON t.id=r.ticket_type_id
    JOIN platform_competition_attempts a ON a.registration_id=d.registration_id AND a.attempt_number=d.attempt_number
    WHERE d.registration_id=$1::uuid AND d.attempt_number=$2 AND r.status IN ('confirmed','attended')`,[id,number]);
  if(!row)notFound('Device report');
  if (row.public_replay) {
    const report = competitionReplay(row.report, row.reportedAt, row.penalty);
    if (!report) notFound('Device replay');
    return c.json({ report });
  }
  const actor = await requirePlatformActor(c);
  if (!actor.isAdmin && ![Number(row.user_id), Number(row.supervisor_user_id)].includes(actor.userId!)) {
    const [peer] = row.arena_round_id && row.penalty ? await platformQuery(platformDb(), `SELECT 1
      FROM platform_competition_attempts a JOIN platform_event_registrations r ON r.id=a.registration_id
      WHERE a.arena_round_id=$1::uuid AND r.user_id=$2 AND r.checked_in_at IS NOT NULL
        AND r.status IN ('confirmed','attended') LIMIT 1`, [row.arena_round_id, actor.userId]) : [];
    if (!peer) forbidden('Only registered entrants and competition officials can view device evidence');
    const report = competitionReplay(row.report, row.reportedAt, row.penalty);
    if (!report) notFound('Device replay');
    return c.json({ report });
  }
  return c.json({ status: row.report ? 'device_reported' : 'started', runId: row.runId, startedAt: row.startedAt,
    report: row.report ? { ...row.report, timestamp: row.reportedAt, penalty: row.penalty } : null, reportedAt: row.reportedAt });
});

platformCompetitionDeviceReportRoutes.post('/platform/competitions/registrations/:id/attempts/:number/telemetry/start',async(c)=>{
  const actor=await requirePlatformActor(c),{id,number}=params(c.req.param('id'),c.req.param('number'));
  const body=await readJsonObject(c),issuedAt=stringField(body,'serverIssuedAt',{required:true,max:64})!,scramble=stringField(body,'scramble',{required:true,max:2000})!;
  const startFacelets = stringField(body, 'startFacelets', { min: 54, max: 54 });
  if(!Number.isFinite(Date.parse(issuedAt)))badRequest('Invalid serverIssuedAt');
  return sendMutation(c,await withIdempotency(c,actor,`competition.device-start:${id}:${number}`,body,async(db)=>{
    const registration=await requireCompetitionRegistration(db,id);
    if(Number(registration.user_id)!==actor.userId)forbidden('Only the entrant may start their device run');
    if(!['confirmed','attended'].includes(registration.status)||!registration.checked_in_at||!registration.in_window||registration.competition_project!=='333')conflict('An active checked-in 3x3 registration is required');
    const [attempt]=await platformQuery<{scramble:string;issued_at:Date|string;recorded_at:Date|null;arena_round_id:string|null;now:Date;inspect_at:Date|null}>(db,`SELECT scramble,issued_at,recorded_at,arena_round_id,inspect_at,clock_timestamp() AS now FROM platform_competition_attempts WHERE registration_id=$1::uuid AND attempt_number=$2 FOR UPDATE`,[id,number]);
    if(!attempt)notFound('Issued attempt');
    if(attempt.recorded_at||attempt.scramble!==scramble||new Date(attempt.issued_at).toISOString()!==new Date(issuedAt).toISOString())conflict('The server-issued attempt is mismatched or already confirmed');
    const selfService = registration.session_kind === 'self_service' && registration.device === 'smart';
    if (registration.device !== 'smart') conflict('Only smart cube seats can upload device data');
    if (registration.competition_format === 'advancement' || (!selfService
      && (!registration.supervisor_user_id || !await competitionSupervisionReady(id, registration.competition_video_generation, Number(registration.user_id), Number(registration.supervisor_user_id))))) {
      conflict('Both cameras must be connected before starting a device run');
    }
    if (attempt.arena_round_id) {
      if (new Date(attempt.issued_at) > attempt.now) conflict('The round has not started');
      if (!startFacelets || startFacelets !== smartCubeTargetFacelets(scramble)) badRequest('The cube must match the issued scramble');
      if (arenaDnfReason(new Date(attempt.issued_at), attempt.inspect_at, null, attempt.now)) {
        await recordArenaDnf(db, id, number, 'scramble_timeout');
        return { status: 200, body: { status: 'DNF', dnfReason: 'scramble_timeout' } };
      }
    }
    const rows=await platformQuery(db,`INSERT INTO platform_competition_device_reports(registration_id,attempt_number,reported_by,started_at)
      VALUES($1::uuid,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING run_id AS "runId",started_at AS "startedAt"`,[id,number,actor.userId,attempt.now]);
    if(!rows.length)conflict('This attempt already has a device run. Ask the supervisor to handle an interrupted run');
    // The smart-cube clock starts at alignment and includes scramble confirmation.
    if (attempt.arena_round_id) await platformQuery(db, 'UPDATE platform_competition_attempts SET inspect_at=$3 WHERE registration_id=$1::uuid AND attempt_number=$2', [id, number, attempt.now]);
    return {status:201,body:{status:'started',...rows[0]},resourceType:'competition_device_report',resourceId:id};
  }));
});
