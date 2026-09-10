import { requirePlatformActor, requirePlatformAdmin } from '../platform/auth.js';
import { platformDb, platformQuery, sendMutation, withIdempotency, type PlatformDb } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { enumField, readJsonObject, stringField } from '../platform/validation.js';
import { competitionInteger } from '../platform/competitions.js';

export const platformOrganizerApplicationRoutes=platformRouter();
const uuid=(value:string)=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))badRequest('Invalid organization or application id');return value;};
const projection=`SELECT a.id::text,a.applicant_user_id AS "applicantUserId",a.organization_id::text AS "organizationId",
  o.slug AS "organizationSlug",a.name,a.slug,a.contact,a.description,a.status,a.review_note AS "reviewNote",a.reviewed_at AS "reviewedAt",a.created_at AS "createdAt"
  FROM platform_organizer_applications a LEFT JOIN organizations o ON o.id=a.organization_id`;
const serialize=(row:Record<string,unknown>)=>({...row,applicantUserId:competitionInteger(row.applicantUserId)});
async function one(db:PlatformDb,id:string){return serialize((await platformQuery(db,`${projection} WHERE a.id=$1::uuid`,[id]))[0]);}

platformOrganizerApplicationRoutes.get('/platform/organizer-applications/me',async c=>{
  const actor=await requirePlatformActor(c);privateNoStore(c);
  const applications=await platformQuery(platformDb(),`${projection} WHERE a.applicant_user_id=$1 ORDER BY a.created_at DESC LIMIT 100`,[actor.userId]);
  const eligible=await platformQuery<{id:string}>(platformDb(),`SELECT o.id::text FROM organizations o WHERE o.status='active' AND o.competition_organizer_approved_at IS NOT NULL
    AND ($2 OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=$1 AND m.status='active' AND m.role IN ('owner','admin')))`,[actor.userId,actor.isAdmin]);
  return c.json({applications:applications.map(serialize),eligibleOrganizationIds:eligible.map(o=>o.id)});
});
platformOrganizerApplicationRoutes.get('/platform/organizer-applications/review-queue',async c=>{
  await requirePlatformAdmin(c);privateNoStore(c);
  const applications=await platformQuery(platformDb(),`${projection} WHERE a.status='pending' ORDER BY a.created_at LIMIT 200`);
  return c.json({applications:applications.map(serialize)});
});
platformOrganizerApplicationRoutes.post('/platform/organizer-applications',async c=>{
  const actor=await requirePlatformActor(c);const body=await readJsonObject(c);
  const organizationId=stringField(body,'organizationId')??null;if(organizationId)uuid(organizationId);
  const name=stringField(body,'name',{required:!organizationId,max:160});
  const slug=stringField(body,'slug',{required:!organizationId,max:64,pattern:/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/});
  const contact=stringField(body,'contact',{required:true,max:500})!;
  const description=stringField(body,'description',{required:true,max:4000})!;
  return sendMutation(c,await withIdempotency(c,actor,'organizer.application',body,async db=>{
    await platformQuery(db,`SELECT id FROM app_users WHERE id=$1 FOR UPDATE`,[actor.userId]);
    let orgName=name,orgSlug=slug;
    if(organizationId){
      const rows=await platformQuery<{name:string;slug:string;competition_organizer_approved_at:unknown}>(db,`SELECT o.name,o.slug,o.competition_organizer_approved_at FROM organizations o WHERE o.id=$1::uuid AND o.status='active'
        AND EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')) FOR UPDATE OF o`,[organizationId,actor.userId]);
      if(!rows[0])forbidden('An active owner or administrator of this organization is required');
      if(rows[0].competition_organizer_approved_at)conflict('This organization is already approved to organize competitions');
      orgName=rows[0].name;orgSlug=rows[0].slug;
    }else if((await platformQuery(db,`SELECT id FROM organizations WHERE slug=$1`,[slug])).length)conflict('Organization slug already exists; apply for the existing organization');
    const pending=await platformQuery(db,`SELECT id FROM platform_organizer_applications WHERE status='pending' AND (applicant_user_id=$1 OR organization_id=$2::uuid) LIMIT 1`,[actor.userId,organizationId]);
    if(pending.length)conflict('An organizer application is already awaiting review');
    const rows=await platformQuery<{id:string}>(db,`INSERT INTO platform_organizer_applications(applicant_user_id,organization_id,name,slug,contact,description) VALUES($1,$2::uuid,$3,$4,$5,$6) RETURNING id::text`,[actor.userId,organizationId,orgName,orgSlug,contact,description]);
    return {status:201,body:{application:await one(db,rows[0].id)}};
  }));
});
platformOrganizerApplicationRoutes.post('/platform/organizer-applications/:id/review',async c=>{
  const actor=await requirePlatformAdmin(c);const key=uuid(c.req.param('id'));const body=await readJsonObject(c);
  const decision=enumField(body,'decision',['approve','reject'],{required:true})!;
  const note=stringField(body,'note',{required:decision==='reject',max:4000})??'';
  return sendMutation(c,await withIdempotency(c,actor,`organizer.review:${key}`,body,async db=>{
    const rows=await platformQuery<{status:string;organization_id:string|null;applicant_user_id:string;name:string;slug:string}>(db,`SELECT * FROM platform_organizer_applications WHERE id=$1::uuid FOR UPDATE`,[key]);
    const application=rows[0];if(!application)notFound('Organizer application');
    if(application.status!=='pending')conflict('This application was already reviewed');
    let organizationId=application.organization_id;
    if(decision==='approve'){
      if(organizationId){
        const eligible=await platformQuery(db,`SELECT o.id FROM organizations o WHERE o.id=$1::uuid AND o.status='active' AND EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status='active' AND m.role IN ('owner','admin')) FOR UPDATE OF o`,[organizationId,application.applicant_user_id]);
        if(!eligible.length)conflict('Applicant no longer manages an active organization');
        await platformQuery(db,`UPDATE organizations SET competition_organizer_approved_at=NOW() WHERE id=$1::uuid`,[organizationId]);
      }else{
        const created=await platformQuery<{id:string}>(db,`INSERT INTO organizations(slug,name,created_by_user_id,competition_organizer_approved_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(slug) DO NOTHING RETURNING id::text`,[application.slug,application.name,application.applicant_user_id]);
        if(!created.length)conflict('Requested organization slug is no longer available; reject and request a new application');
        organizationId=created[0].id;
        await platformQuery(db,`INSERT INTO organization_members(organization_id,user_id,role,status,joined_at) VALUES($1::uuid,$2,'owner','active',NOW())`,[organizationId,application.applicant_user_id]);
      }
    }
    await platformQuery(db,`UPDATE platform_organizer_applications SET status=$2,organization_id=$3::uuid,review_note=$4,reviewed_by=$5,reviewed_at=NOW() WHERE id=$1::uuid`,[key,decision==='approve'?'approved':'rejected',organizationId,note,actor.userId]);
    return {status:200,body:{application:await one(db,key)}};
  }));
});
