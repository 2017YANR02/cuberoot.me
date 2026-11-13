import { requirePlatformActor, requirePlatformAdmin } from '../auth.js';
import {
  platformQuery,
  platformDb,
  withIdempotency,
  enqueuePlatformEvent,
  sendMutation,
  isPostgresConflict,
} from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { privateNoStore } from '../http.js';
import {
  readJsonObject,
  stringField,
  arrayField,
  pagination,
  resourceId,
  enumField,
  nullableStringField,
  integerField,
} from '../validation.js';
import { requiredParam } from './course-access.js';
import { type Context, type Hono } from 'hono';

async function listAdminApplications(c: Context): Promise<Response> {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c, 100);
  const id = c.req.param('id') ? requiredParam(c, 'id') : null;
  const rows = await platformQuery(platformDb(), `
    SELECT a.id::text AS id, a.applicant_user_id AS "applicantUserId",
      a.applicant_display_name_snapshot AS "applicantDisplayName", a.revision, a.status,
      a.application_snapshot AS application, a.decision_note AS "decisionNote",
      a.approved_instructor_id::text AS "approvedInstructorId", a.created_at AS "createdAt", a.decided_at AS "decidedAt"
    FROM platform_instructor_applications a
    WHERE ($1::text IS NULL OR a.id::text = $1)
    ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC
    LIMIT $2 OFFSET $3
  `, [id, pageSize, offset]);
  if (id && !rows[0]) notFound('Instructor application');
  privateNoStore(c);
  return c.json(id ? { application: rows[0] } : { applications: rows, page, pageSize });
}

async function listAdminInstructors(c: Context): Promise<Response> {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c, 100);
  const id = c.req.param('id') ? requiredParam(c, 'id') : null;
  const rows = await platformQuery(platformDb(), `
    SELECT i.id::text AS id, i.user_id AS "userId", i.teacher_entry_id AS "teacherEntryId",
      i.status, i.display_name_snapshot AS "displayName", i.bio_zh AS "bioZh", i.bio_en AS "bioEn",
      i.created_at AS "createdAt", i.updated_at AS "updatedAt",
      COUNT(co.course_id)::int AS "courseCount"
    FROM platform_instructors i LEFT JOIN platform_course_owners co ON co.instructor_id=i.id AND co.status='active'
    WHERE ($1::text IS NULL OR i.id::text=$1) GROUP BY i.id ORDER BY i.updated_at DESC LIMIT $2 OFFSET $3
  `, [id, pageSize, offset]);
  if (id && !rows[0]) notFound('Instructor');
  privateNoStore(c);
  return c.json(id ? { instructor: rows[0] } : { instructors: rows, page, pageSize });
}

export function registerInstructorRoutes(platformCatalogRoutes: Hono): void {
  platformCatalogRoutes.get('/platform/instructor/applications/current', async (c) => {
    const actor = await requirePlatformActor(c);
    const rows = await platformQuery(platformDb(), `
      SELECT id::text AS id, revision, status, application_snapshot AS application,
        decision_note AS "decisionNote", decided_at AS "decidedAt", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM platform_instructor_applications WHERE applicant_user_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [actor.userId]);
    privateNoStore(c);
    return c.json({ application: rows[0] ?? null });
  });

  platformCatalogRoutes.post('/platform/instructor/applications', async (c) => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const experience = stringField(body, 'experience', { required: true, max: 20_000 });
    const specialties = arrayField(body, 'specialties', { required: true, maxItems: 30 });
    const contact = stringField(body, 'contact', { required: true, max: 500 });
    if (!specialties?.every((value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 120)) {
      badRequest('specialties must contain non-empty strings of at most 120 characters');
    }
    const result = await withIdempotency(c, actor, 'platform.instructor.apply', body, async (db) => {
      const existing = await platformQuery<{ id: string }>(db, `
        SELECT id::text AS id FROM platform_instructor_applications
        WHERE applicant_user_id = $1 AND status = 'pending' FOR UPDATE
      `, [actor.userId]);
      if (existing[0]) conflict('A pending instructor application already exists');
      const rows = await platformQuery<{ id: string; status: string }>(db, `
        INSERT INTO platform_instructor_applications (
          applicant_user_id, applicant_display_name_snapshot, application_snapshot
        ) VALUES ($1, $2, $3::jsonb)
        RETURNING id::text AS id, status
      `, [actor.userId, actor.displayName, { experience, specialties, contact }]);
      await enqueuePlatformEvent(db, 'platform.instructor.application_submitted', 'instructor_application', rows[0].id,
        `instructor-application:${rows[0].id}:submitted`, { applicationId: rows[0].id });
      return { status: 201, body: { application: rows[0] }, resourceType: 'instructor_application', resourceId: rows[0].id };
    });
    return sendMutation(c, result);
  });

  platformCatalogRoutes.get('/platform/admin/instructor-applications', listAdminApplications);

  platformCatalogRoutes.get('/platform/admin/instructor-applications/:id', listAdminApplications);

  platformCatalogRoutes.post('/platform/admin/instructor-applications/:id/decision', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const decision = enumField(body, 'decision', ['approved', 'rejected'] as const, { required: true });
    const note = nullableStringField(body, 'note', { max: 10_000 });
    const teacherEntryId = body.teacherEntryId === null ? null : integerField(body, 'teacherEntryId', { min: 1 });
    const result = await withIdempotency(c, actor, `platform.admin.instructor-application.decision:${id}`, body, async (db) => {
      const applications = await platformQuery<{ applicant_user_id: number | null; applicant_display_name: string; status: string }>(db, `
        SELECT applicant_user_id, applicant_display_name_snapshot AS applicant_display_name, status
        FROM platform_instructor_applications WHERE id::text = $1 FOR UPDATE
      `, [id]);
      const application = applications[0];
      if (!application) notFound('Instructor application');
      if (application.status !== 'pending') conflict('Instructor application has already been decided');
      if (decision === 'approved' && application.applicant_user_id == null) conflict('The applicant account no longer exists');
      let instructorId: string | null = null;
      if (decision === 'approved') {
        const instructors = await platformQuery<{ id: string }>(db, `
          INSERT INTO platform_instructors (user_id, teacher_entry_id, display_name_snapshot)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET
            teacher_entry_id = COALESCE(EXCLUDED.teacher_entry_id, platform_instructors.teacher_entry_id),
            display_name_snapshot = EXCLUDED.display_name_snapshot, status = 'active'
          RETURNING id::text AS id
        `, [application.applicant_user_id, teacherEntryId ?? null, application.applicant_display_name]);
        instructorId = instructors[0].id;
      }
      await platformQuery(db, `
        UPDATE platform_instructor_applications SET status=$2, decision_note=$3,
          decided_by_user_id=$4, decided_by_actor_key=$5, decided_at=NOW(), approved_instructor_id=$6::uuid
        WHERE id::text=$1
      `, [id, decision, note ?? null, actor.userId, actor.ownerKey, instructorId]);
      await enqueuePlatformEvent(db, `platform.instructor.application_${decision}`, 'instructor_application', id,
        `instructor-application:${id}:${decision}`, { applicationId: id, instructorId });
      return { status: 200, body: { application: { id, status: decision, instructorId } }, resourceType: 'instructor_application', resourceId: id };
    });
    return sendMutation(c, result);
  });

  platformCatalogRoutes.get('/platform/admin/instructors', listAdminInstructors);

  platformCatalogRoutes.get('/platform/admin/instructors/:id', listAdminInstructors);

  platformCatalogRoutes.post('/platform/admin/instructors', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const body = await readJsonObject(c);
    const userId = integerField(body, 'userId', { required: true, min: 1, max: Number.MAX_SAFE_INTEGER });
    const displayName = stringField(body, 'displayName', { required: true, max: 200 });
    const bioZh = stringField(body, 'bioZh', { max: 50_000, trim: false });
    const bioEn = stringField(body, 'bioEn', { max: 50_000, trim: false });
    const teacherEntryId = body.teacherEntryId === null ? null : integerField(body, 'teacherEntryId', { min: 1 });
    const result = await withIdempotency(c, actor, 'platform.admin.instructor.create', body, async (db) => {
      try {
        const rows = await platformQuery<{ id: string }>(db, `
          INSERT INTO platform_instructors(user_id,teacher_entry_id,status,display_name_snapshot,bio_zh,bio_en)
          VALUES($1,$2,'active',$3,$4,$5) RETURNING id::text AS id
        `, [userId, teacherEntryId ?? null, displayName, bioZh ?? '', bioEn ?? '']);
        return { status: 201, body: { instructor: rows[0] }, resourceType: 'instructor', resourceId: rows[0].id };
      } catch (error) {
        if (isPostgresConflict(error)) conflict('Instructor account or teacher profile is already assigned');
        throw error;
      }
    });
    return sendMutation(c, result);
  });

  platformCatalogRoutes.patch('/platform/admin/instructors/:id', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const status = enumField(body, 'status', ['active', 'suspended', 'archived'] as const);
    const displayName = stringField(body, 'displayName', { max: 200 });
    const bioZh = stringField(body, 'bioZh', { max: 50_000, trim: false });
    const bioEn = stringField(body, 'bioEn', { max: 50_000, trim: false });
    const teacherEntryId = body.teacherEntryId === null ? null : integerField(body, 'teacherEntryId', { min: 1 });
    const result = await withIdempotency(c, actor, `platform.admin.instructor.update:${id}`, body, async (db) => {
      const rows = await platformQuery<{ id: string }>(db, `
        UPDATE platform_instructors SET status=COALESCE($2,status), display_name_snapshot=COALESCE($3,display_name_snapshot),
          bio_zh=COALESCE($4,bio_zh), bio_en=COALESCE($5,bio_en),
          teacher_entry_id=CASE WHEN $6 THEN $7 ELSE teacher_entry_id END
        WHERE id::text=$1 RETURNING id::text AS id
      `, [id, status ?? null, displayName ?? null, bioZh ?? null, bioEn ?? null,
        Object.prototype.hasOwnProperty.call(body, 'teacherEntryId'), teacherEntryId ?? null]);
      if (!rows[0]) notFound('Instructor');
      return { status: 200, body: { instructor: rows[0] }, resourceType: 'instructor', resourceId: id };
    });
    return sendMutation(c, result);
  });

  platformCatalogRoutes.delete('/platform/admin/instructors/:id', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const result = await withIdempotency(c, actor, `platform.admin.instructor.archive:${id}`, {}, async (db) => {
      const rows = await platformQuery<{ id: string }>(db, `
        UPDATE platform_instructors SET status='archived' WHERE id::text=$1 RETURNING id::text AS id
      `, [id]);
      if (!rows[0]) notFound('Instructor');
      await platformQuery(db, `UPDATE platform_course_owners SET status='inactive' WHERE instructor_id=$1::uuid`, [id]);
      return { status: 200, body: { instructor: { ...rows[0], status: 'archived' } }, resourceType: 'instructor', resourceId: id };
    });
    return sendMutation(c, result);
  });
}
