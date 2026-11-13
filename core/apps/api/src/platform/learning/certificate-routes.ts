import { requirePlatformActor } from '../auth.js';
import { encryptPlatformPrivateData, decryptPlatformPrivateData } from '../data_encryption.js';
import {
  platformQuery,
  platformDb,
  withIdempotency,
  requireCourseOwner,
  enqueuePlatformEvent,
  sendMutation,
  requireCourseEntitlement,
} from '../db.js';
import { notFound, badRequest, conflict } from '../errors.js';
import { publicCache, privateNoStore } from '../http.js';
import { servePlatformMedia } from '../media_access.js';
import { stringField, readJsonObject, resourceId, integerField } from '../validation.js';
import { type Hono } from 'hono';
import { createHash, randomBytes } from 'node:crypto';

export function registerCertificateRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.get('/certificates/:code/image', async (c) => {
    const code = stringField({ code: c.req.param('code') }, 'code', { required: true, min: 12, max: 200 })!;
    const hash = createHash('sha256').update(code, 'utf8').digest('hex');
    const rows = await platformQuery<{
      storage_key: string; mime_type: string; size_bytes: number | string;
    }>(platformDb(), `
      SELECT media.storage_key, media.mime_type, media.size_bytes
      FROM platform_certificates certificate
      JOIN platform_media_assets media ON media.id = certificate.image_media_id
      WHERE certificate.verification_code_hash = decode($1, 'hex')
        AND certificate.status = 'issued' AND media.status = 'ready'
        AND media.mime_type LIKE 'image/%'
    `, [hash]);
    const asset = rows[0];
    if (!asset) {
      const certs=await platformQuery(platformDb(),`SELECT recipient_name_snapshot AS name,course_title_snapshot AS course,issued_at::date::text AS date FROM platform_certificates WHERE verification_code_hash=decode($1,'hex') AND status='issued'`,[hash]);
      if(!certs[0]) notFound('Certificate image');
      const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
      const cert=certs[0];
      c.header('Content-Type','image/svg+xml; charset=utf-8'); c.header('Cache-Control','public, max-age=60, s-maxage=300');
      c.header('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'");
      return c.body(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#faf8f2"/><rect x="30" y="30" width="1140" height="740" fill="none" stroke="#89734b" stroke-width="3"/><g text-anchor="middle" fill="#302b20" font-family="sans-serif"><text x="600" y="160" font-size="36">CubeRoot · 结课证书</text><text x="600" y="230" font-size="22">Certificate of completion</text><text x="600" y="345" font-size="42">${escape(cert.name)}</text><text x="600" y="425" font-size="26">${escape(cert.course)}</text><text x="600" y="560" font-size="22">${escape(cert.date)}</text><text x="600" y="665" font-size="15">${escape(code)}</text></g></svg>`);
    }
    return servePlatformMedia(c, {
      storageKey: asset.storage_key,
      mimeType: asset.mime_type,
      sizeBytes: asset.size_bytes,
    }, 'public, max-age=60, s-maxage=300');
  });

  platformLearningRoutes.get('/certificates/:code', async (c) => {
    const code = stringField({ code: c.req.param('code') }, 'code', { required: true, min: 12, max: 200 })!;
    const hash = createHash('sha256').update(code, 'utf8').digest('hex');
    const rows = await platformQuery(platformDb(), `
      SELECT certificate.id::text, certificate.status,
             certificate.recipient_name_snapshot AS "recipientName",
             certificate.course_title_snapshot AS title,
             certificate.issued_at AS "issuedAt", certificate.revoked_at AS "revokedAt",
             certificate.image_media_id::text AS "imageMediaId"
      FROM platform_certificates certificate
      WHERE certificate.verification_code_hash = decode($1, 'hex')
    `, [hash]);
    if (!rows[0]) notFound('Certificate');
    publicCache(c);
    return c.json(rows[0]);
  });

  platformLearningRoutes.post('/instructor/certificates', async (c) => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const courseId = resourceId(stringField(body, 'courseId', { required: true, max: 128 })!, 'courseId');
    const userId = integerField(body, 'userId', { required: true, min: 1 })!;
    const recipientName = stringField(body, 'recipientName', { required: true, max: 200 })!;
    const imageMediaId = body.imageMediaId == null ? null : resourceId(stringField(body, 'imageMediaId', { max: 128 })!, 'imageMediaId');
    const result = await withIdempotency(c, actor, `learning.certificate:${courseId}:${userId}`, body, async (db) => {
      const instructorId = await requireCourseOwner(db, actor, courseId);
      const entitlements = await platformQuery<{ id: string; title: string }>(db, `
        SELECT e.id::text, COALESCE(NULLIF(cr.title_zh, ''), cr.title_en) AS title
        FROM platform_course_entitlements e
        JOIN platform_courses course ON course.id = e.course_id
        JOIN platform_course_revisions cr ON cr.course_id = course.id AND cr.revision = course.current_revision
        WHERE e.user_id = $1 AND e.course_id = $2::uuid AND e.status = 'active'
      `, [userId, courseId]);
      if (!entitlements[0]) badRequest('Recipient does not have an active entitlement');
      if (imageMediaId) {
        const media = await platformQuery<{ id: string }>(db, `
          SELECT id::text FROM platform_media_assets
          WHERE id = $1::uuid AND status = 'ready' AND mime_type LIKE 'image/%'
            AND (owner_user_id = $2 OR owner_instructor_id = $3::uuid)
        `, [imageMediaId, actor.userId, instructorId]);
        if (!media[0]) notFound('Owned ready certificate image');
      }
      const verificationCode = randomBytes(24).toString('base64url');
      const hash = createHash('sha256').update(verificationCode, 'utf8').digest('hex');
      const encryptedCode = encryptPlatformPrivateData({ verificationCode });
      const rows = await platformQuery(db, `
        INSERT INTO platform_certificates (
          verification_code_hash, user_id, course_id, entitlement_id, recipient_name_snapshot,
          course_title_snapshot, image_media_id, issued_by_user_id, verification_code_encrypted, verification_key_version
        ) VALUES (decode($1, 'hex'), $2, $3::uuid, $4::uuid, $5, $6, $7::uuid, $8, $9, $10)
        RETURNING id::text, status, issued_at AS "issuedAt"
      `, [hash, userId, courseId, entitlements[0].id, recipientName, entitlements[0].title, imageMediaId, actor.userId, encryptedCode.payload, encryptedCode.keyVersion]);
      await enqueuePlatformEvent(db, 'learning.certificate_issued', 'certificate', String(rows[0]!.id),
        `learning.certificate:${rows[0]!.id}`, { certificateId: rows[0]!.id, courseId });
      return {
        status: 201,
        body: { ...rows[0], verificationCode },
        resourceType: 'certificate', resourceId: String(rows[0]!.id),
      };
    });
    return sendMutation(c, result);
  });

  platformLearningRoutes.get('/me/certificates', async c => {
    const actor = await requirePlatformActor(c);
    const rows = await platformQuery(platformDb(),`SELECT id::text,course_id::text AS "courseId",course_title_snapshot AS title,recipient_name_snapshot AS "recipientName",status,issued_at AS "issuedAt",verification_code_encrypted,verification_key_version FROM platform_certificates WHERE user_id=$1 ORDER BY issued_at DESC`,[actor.userId]);
    privateNoStore(c);
    return c.json({items:rows.map(({verification_code_encrypted,verification_key_version,...row})=>({...row,...(verification_code_encrypted?decryptPlatformPrivateData(Buffer.from(verification_code_encrypted as Uint8Array),Number(verification_key_version)):{})}))});
  });

  platformLearningRoutes.post('/me/certificates', async c => {
    const actor = await requirePlatformActor(c); const body=await readJsonObject(c);
    const courseId=resourceId(stringField(body,'courseId',{required:true,max:128})!);
    const result=await withIdempotency(c,actor,`learning.certificate.claim:${courseId}`,body,async db=>{
      await platformQuery(db,'SELECT id FROM app_users WHERE id=$1 FOR UPDATE',[actor.userId]);
      await requireCourseEntitlement(db,actor,courseId);
      const counts=await platformQuery<{total:number;complete:number}>(db,`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE p.status='completed')::int AS complete FROM platform_lessons l LEFT JOIN platform_lesson_progress p ON p.lesson_id=l.id AND p.user_id=$1 WHERE l.course_id=$2::uuid AND l.status='published'`,[actor.userId,courseId]);
      if(!counts[0]?.total||counts[0].complete!==counts[0].total) conflict('Complete every published lesson before claiming the certificate');
      const existing=await platformQuery(db,`SELECT id::text,verification_code_encrypted,verification_key_version FROM platform_certificates WHERE user_id=$1 AND course_id=$2::uuid AND status='issued' ORDER BY issued_at DESC LIMIT 1`,[actor.userId,courseId]);
      if(existing[0]?.verification_code_encrypted){const row=existing[0];return {status:200,body:{id:row.id,...decryptPlatformPrivateData(Buffer.from(row.verification_code_encrypted as Uint8Array),Number(row.verification_key_version))},resourceType:'certificate',resourceId:String(row.id)};}
      // Legacy hashes cannot be reversed. Issue a new credential without invalidating the old certificate.
      const code=randomBytes(24).toString('base64url');const hash=createHash('sha256').update(code).digest('hex');const encrypted=encryptPlatformPrivateData({verificationCode:code});
      const rows=await platformQuery(db,`INSERT INTO platform_certificates(verification_code_hash,user_id,course_id,entitlement_id,recipient_name_snapshot,course_title_snapshot,issued_by_user_id,verification_code_encrypted,verification_key_version)
        SELECT decode($1,'hex'),$2,c.id,e.id,$3,COALESCE(NULLIF(r.title_zh,''),r.title_en),$2,$5,$6
        FROM platform_courses c JOIN platform_course_revisions r ON r.course_id=c.id AND r.revision=c.current_revision JOIN platform_course_entitlements e ON e.course_id=c.id AND e.user_id=$2 AND e.status='active'
        WHERE c.id=$4::uuid AND e.valid_from<=NOW() AND (e.valid_until IS NULL OR e.valid_until>NOW()) LIMIT 1 RETURNING id::text`,[hash,actor.userId,actor.displayName,courseId,encrypted.payload,encrypted.keyVersion]);
      if(!rows[0]) conflict('An active course entitlement is required');
      return {status:201,body:{...rows[0],verificationCode:code},resourceType:'certificate',resourceId:String(rows[0].id)};
    });return sendMutation(c,result);
  });
}
