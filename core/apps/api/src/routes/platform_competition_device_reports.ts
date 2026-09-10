import { requirePlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, sendMutation, withIdempotency } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { readJsonObject, stringField } from '../platform/validation.js';
import { validateCompetitionDeviceReport } from '../platform/competition_device_reports.js';
import { requireCompetitionRegistration } from '../platform/competitions.js';
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
    if(registration.competition_project!=='333')conflict('Connected cube reports currently support 3x3');
    const [attempt]=await platformQuery<{scramble:string;issued_at:string;recorded_at:string|null;elapsed_ms:number}>(db,`SELECT scramble,issued_at,recorded_at,EXTRACT(EPOCH FROM NOW()-issued_at)*1000 AS elapsed_ms
      FROM platform_competition_attempts WHERE registration_id=$1::uuid AND attempt_number=$2 FOR UPDATE`,[id,number]);
    if(!attempt)notFound('Issued attempt');
    if(attempt.recorded_at)conflict('The supervisor has already confirmed this attempt');
    if(attempt.scramble!==report.scramble||new Date(attempt.issued_at).toISOString()!==report.serverIssuedAt)conflict('The report does not match the server-issued attempt');
    if(report.durationMs>Number(attempt.elapsed_ms)+1000)badRequest('The reported duration exceeds the time since the attempt was issued');
    if(!registration.supervisor_user_id||!await competitionSupervisionReady(id,registration.competition_video_generation,Number(registration.user_id),Number(registration.supervisor_user_id)))conflict('Both cameras must remain connected for a supervised device report');
    const rows=await platformQuery(db,`UPDATE platform_competition_device_reports SET report=$3::jsonb,reported_at=NOW()
      WHERE registration_id=$1::uuid AND attempt_number=$2 AND run_id=$4::uuid AND report IS NULL
        AND $5<=EXTRACT(EPOCH FROM NOW()-started_at)*1000+1000 RETURNING reported_at AS "reportedAt"`,[id,number,report,report.runId,report.durationMs]);
    if(!rows.length)conflict('The device run is missing, mismatched, already reported, or shorter than the reported duration');
    return {status:201,body:{status:'device_reported',reportedAt:rows[0].reportedAt},resourceType:'competition_device_report',resourceId:id};
  }));
});
platformCompetitionDeviceReportRoutes.get('/platform/competitions/registrations/:id/attempts/:number/telemetry',async(c)=>{
  privateNoStore(c);
  const actor=await requirePlatformActor(c),{id,number}=params(c.req.param('id'),c.req.param('number'));
  const [row]=await platformQuery(platformDb(),`SELECT d.report,d.run_id AS "runId",d.started_at AS "startedAt",d.reported_at AS "reportedAt",r.user_id,s.supervisor_user_id
    FROM platform_competition_device_reports d JOIN platform_event_registrations r ON r.id=d.registration_id
    JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    WHERE d.registration_id=$1::uuid AND d.attempt_number=$2 AND r.status IN ('confirmed','attended')`,[id,number]);
  if(!row)notFound('Device report');
  if(!actor.isAdmin&&![Number(row.user_id),Number(row.supervisor_user_id)].includes(actor.userId!))forbidden('Only the entrant, supervisor and platform administrator can view device evidence');
  return c.json({status:row.report?'device_reported':'started',runId:row.runId,startedAt:row.startedAt,report:row.report,reportedAt:row.reportedAt});
});

platformCompetitionDeviceReportRoutes.post('/platform/competitions/registrations/:id/attempts/:number/telemetry/start',async(c)=>{
  const actor=await requirePlatformActor(c),{id,number}=params(c.req.param('id'),c.req.param('number'));
  const body=await readJsonObject(c),issuedAt=stringField(body,'serverIssuedAt',{required:true,max:64})!,scramble=stringField(body,'scramble',{required:true,max:2000})!;
  if(!Number.isFinite(Date.parse(issuedAt)))badRequest('Invalid serverIssuedAt');
  return sendMutation(c,await withIdempotency(c,actor,`competition.device-start:${id}:${number}`,body,async(db)=>{
    const registration=await requireCompetitionRegistration(db,id);
    if(Number(registration.user_id)!==actor.userId)forbidden('Only the entrant may start their device run');
    if(!['confirmed','attended'].includes(registration.status)||!registration.checked_in_at||!registration.in_window||registration.competition_project!=='333')conflict('An active checked-in 3x3 registration is required');
    const [attempt]=await platformQuery(db,`SELECT scramble,issued_at,recorded_at FROM platform_competition_attempts WHERE registration_id=$1::uuid AND attempt_number=$2 FOR UPDATE`,[id,number]);
    if(!attempt)notFound('Issued attempt');
    if(attempt.recorded_at||attempt.scramble!==scramble||new Date(String(attempt.issued_at)).toISOString()!==new Date(issuedAt).toISOString())conflict('The server-issued attempt is mismatched or already confirmed');
    if(!registration.supervisor_user_id||!await competitionSupervisionReady(id,registration.competition_video_generation,Number(registration.user_id),Number(registration.supervisor_user_id)))conflict('Both cameras must be connected before starting a device run');
    const rows=await platformQuery(db,`INSERT INTO platform_competition_device_reports(registration_id,attempt_number,reported_by)
      VALUES($1::uuid,$2,$3) ON CONFLICT DO NOTHING RETURNING run_id AS "runId",started_at AS "startedAt"`,[id,number,actor.userId]);
    if(!rows.length)conflict('This attempt already has a device run. Ask the supervisor to handle an interrupted run');
    return {status:201,body:{status:'started',...rows[0]},resourceType:'competition_device_report',resourceId:id};
  }));
});
