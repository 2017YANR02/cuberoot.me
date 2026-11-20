import { requirePlatformActor, requirePlatformAdmin } from '../auth.js';
import { ownerKey } from '../../utils/account.js';
import {
  platformQuery,
  platformDb,
  withIdempotency,
  enqueuePlatformEvent,
  sendMutation,
  isPostgresConflict,
  requireInstructor,
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

const APPLICATION_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const;

async function listAdminApplications(c: Context): Promise<Response> {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c, 100);
  const id = c.req.param('id') ? requiredParam(c, 'id') : null;
  const category = c.req.query('category') || 'pending';
  const status = id || category === 'all' ? null : enumField({ category }, 'category', APPLICATION_STATUSES);
  const search = (c.req.query('q') ?? '').trim().slice(0, 200);
  const rows = await platformQuery(platformDb(), `
    SELECT a.id::text AS id, a.applicant_user_id AS "applicantUserId",
      a.applicant_display_name_snapshot AS "applicantDisplayName", a.revision, a.status,
      u.wca_id AS "wcaId", COUNT(*) OVER()::int AS "totalCount",
      a.application_snapshot AS application, a.decision_note AS "decisionNote",
      a.approved_instructor_id::text AS "approvedInstructorId", a.created_at AS "createdAt", a.decided_at AS "decidedAt"
    FROM platform_instructor_applications a LEFT JOIN app_users u ON u.id=a.applicant_user_id
    WHERE ($1::text IS NULL OR a.id::text = $1)
      AND ($4::text IS NULL OR a.status=$4)
      AND ($1::text IS NOT NULL OR $5='' OR position(lower($5) in lower(a.applicant_display_name_snapshot))>0 OR position(lower($5) in lower(COALESCE(u.wca_id,'')))>0)
    ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC
    LIMIT $2 OFFSET $3
  `, [id, pageSize, offset, status ?? null, search]);
  if (id && !rows[0]) notFound('Instructor application');
  privateNoStore(c);
  const applications = rows.map(({ totalCount: _total, ...row }) => row);
  if (id) {
    const application = applications[0];
    const uid = Number(application.applicantUserId);
    const applicantKey = uid > 0 ? ownerKey(uid, typeof application.wcaId === 'string' ? application.wcaId : null) : null;
    const [history, profiles] = await Promise.all([
      platformQuery(platformDb(), `SELECT status, created_at AS "createdAt", decided_at AS "decidedAt", decision_note AS "decisionNote" FROM platform_instructor_applications WHERE applicant_user_id=$1 AND id::text<>$2 ORDER BY created_at DESC LIMIT 20`, [uid || null, id]),
      platformQuery(platformDb(), `SELECT name_zh AS "nameZh", name_en AS "nameEn", is_visible AS "isVisible" FROM teacher_directory_entries t WHERE owner_key=$1 AND kind='teacher' AND NOT EXISTS (SELECT 1 FROM platform_instructors i WHERE i.teacher_entry_id=t.id AND i.user_id<>$2) ORDER BY t.id`, [applicantKey, uid || null]),
    ]);
    return c.json({ application: { ...application, history, profiles } });
  }
  return c.json({ applications, page, pageSize, total: Number(rows[0]?.totalCount ?? 0), categories: APPLICATION_STATUSES });
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
    const db = platformDb();
    const [rows, instructors, profiles] = await Promise.all([platformQuery(db, `
      SELECT id::text AS id, revision, status, application_snapshot AS application,
        decision_note AS "decisionNote", decided_at AS "decidedAt", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM platform_instructor_applications WHERE applicant_user_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [actor.userId]), platformQuery(db, `
      SELECT i.id::text AS id, i.status, i.display_name_snapshot AS "displayName", i.bio_zh AS "bioZh", i.bio_en AS "bioEn", i.teacher_entry_id AS "teacherEntryId", t.is_visible AS "profileVisible"
      FROM platform_instructors i LEFT JOIN teacher_directory_entries t ON t.id=i.teacher_entry_id
      WHERE i.user_id=$1
    `, [actor.userId]), platformQuery(db, `
      SELECT t.id, t.name_zh AS "nameZh", t.name_en AS "nameEn", t.is_visible AS "isVisible"
      FROM teacher_directory_entries t WHERE t.owner_key=$1 AND t.kind='teacher'
      AND NOT EXISTS (SELECT 1 FROM platform_instructors i WHERE i.teacher_entry_id=t.id AND i.user_id<>$2)
      ORDER BY t.updated_at DESC, t.id
    `, [actor.ownerKey, actor.userId])]);
    privateNoStore(c);
    return c.json({ application: rows[0] ?? null, instructor: instructors[0] ?? null, profiles });
  });

  platformCatalogRoutes.post('/platform/instructor/applications', async (c) => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const experience = stringField(body, 'experience', { required: true, max: 20_000 });
    const specialties = arrayField(body, 'specialties', { required: true, maxItems: 30 });
    const contact = stringField(body, 'contact', { required: true, max: 500 });
    const city = stringField(body, 'city', { max: 160 });
    const teachingMode = enumField(body, 'teachingMode', ['online', 'in_person', 'both'] as const);
    const achievements = stringField(body, 'achievements', { max: 5000 });
    if (!specialties?.length || !specialties.every((value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 120)) {
      badRequest('specialties must contain non-empty strings of at most 120 characters');
    }
    const result = await withIdempotency(c, actor, 'platform.instructor.apply', body, async (db) => {
      await platformQuery(db, 'SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [actor.userId]);
      const instructor = await platformQuery(db, 'SELECT id, status FROM platform_instructors WHERE user_id=$1 FOR UPDATE', [actor.userId]);
      // Archived instructors may apply again; active and suspended access must
      // never be changed by submitting another application.
      if (instructor[0] && instructor[0].status !== 'archived') conflict('This account already has an instructor record');
      const existing = await platformQuery<{ id: string }>(db, `
        SELECT id::text AS id FROM platform_instructor_applications
        WHERE applicant_user_id = $1 AND status = 'pending'
      `, [actor.userId]);
      if (existing[0]) conflict('A pending instructor application already exists');
      const rows = await platformQuery<{ id: string; status: string }>(db, `
        INSERT INTO platform_instructor_applications (
          applicant_user_id, applicant_display_name_snapshot, application_snapshot
        ) VALUES ($1, $2, $3::jsonb)
        RETURNING id::text AS id, status
      `, [actor.userId, actor.displayName, { experience, specialties, contact, ...(city ? { city } : {}), ...(teachingMode ? { teachingMode } : {}), ...(achievements ? { achievements } : {}) }]);
      await enqueuePlatformEvent(db, 'platform.instructor.application_submitted', 'instructor_application', rows[0].id,
        `instructor-application:${rows[0].id}:submitted`, { applicationId: rows[0].id });
      return { status: 201, body: { application: rows[0] }, resourceType: 'instructor_application', resourceId: rows[0].id };
    });
    return sendMutation(c, result);
  });

  platformCatalogRoutes.post('/platform/instructor/applications/:id/withdraw', async c => {
    const actor = await requirePlatformActor(c);
    const id = requiredParam(c, 'id');
    const result = await withIdempotency(c, actor, `platform.instructor.withdraw:${id}`, {}, async db => {
      const rows = await platformQuery(db, `SELECT status FROM platform_instructor_applications WHERE id::text=$1 AND applicant_user_id=$2 FOR UPDATE`, [id, actor.userId]);
      if (!rows[0]) notFound('Instructor application');
      if (rows[0].status !== 'pending') conflict('Only pending applications can be withdrawn');
      await platformQuery(db, `UPDATE platform_instructor_applications SET status='withdrawn', decided_at=NOW(), decided_by_user_id=$2, decided_by_actor_key=$3 WHERE id::text=$1`, [id, actor.userId, actor.ownerKey]);
      await enqueuePlatformEvent(db, 'platform.instructor.application_withdrawn', 'instructor_application', id, `instructor-application:${id}:withdrawn`, { applicationId: id });
      return { status: 200, body: { application: { id, status: 'withdrawn' } }, resourceType: 'instructor_application', resourceId: id };
    });
    return sendMutation(c, result);
  });

  platformCatalogRoutes.post('/platform/instructor/profile-link', async c => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const entryId = integerField(body, 'teacherEntryId', { required: true, min: 1 });
    const result = await withIdempotency(c, actor, 'platform.instructor.profile-link', body, async db => {
      const instructorId = await requireInstructor(db, actor);
      const locked = await platformQuery(db, `SELECT id FROM platform_instructors WHERE id::text=$1 AND status='active' FOR UPDATE`, [instructorId]);
      if (!locked[0]) conflict('Instructor access is no longer active');
      const profiles = await platformQuery(db, `SELECT id FROM teacher_directory_entries WHERE id=$1 AND owner_key=$2 AND kind='teacher' FOR UPDATE`, [entryId, actor.ownerKey]);
      if (!profiles[0]) notFound('Teacher profile');
      const linked = await platformQuery(db, `SELECT id FROM platform_instructors WHERE teacher_entry_id=$1 AND id::text<>$2`, [entryId, instructorId]);
      if (linked.length) conflict('This teacher profile is already linked');
      const updated = await platformQuery(db, `UPDATE platform_instructors SET teacher_entry_id=$1 WHERE id::text=$2 AND status='active' RETURNING id`, [entryId, instructorId]);
      if (!updated[0]) conflict('Instructor access is no longer active');
      return { status: 200, body: { ok: true }, resourceType: 'instructor', resourceId: instructorId };
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
    if (decision === 'rejected' && !note?.trim()) badRequest('A rejection reason is required');
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
      const applicant = application.applicant_user_id == null ? null : (await platformQuery<{ wca_id: string | null }>(db, 'SELECT wca_id FROM app_users WHERE id=$1 FOR UPDATE', [application.applicant_user_id]))[0];
      const applicantKey = applicant && application.applicant_user_id != null ? ownerKey(application.applicant_user_id, applicant.wca_id) : null;
      if (decision === 'approved') {
        if (!applicantKey) conflict('The applicant account no longer exists');
        const existing = await platformQuery(db, `SELECT id, status FROM platform_instructors WHERE user_id=$1 FOR UPDATE`, [application.applicant_user_id]);
        if (existing[0] && existing[0].status === 'suspended') conflict('Instructor access is suspended');
        const profiles = await platformQuery<{ id: number }>(db, `SELECT t.id FROM teacher_directory_entries t WHERE t.owner_key=$1 AND t.kind='teacher'
          AND ($2::bigint IS NULL OR t.id=$2) AND NOT EXISTS (SELECT 1 FROM platform_instructors i WHERE i.teacher_entry_id=t.id AND i.user_id<>$3) ORDER BY t.id LIMIT 2 FOR UPDATE`, [applicantKey, teacherEntryId ?? null, application.applicant_user_id]);
        if (teacherEntryId != null && !profiles.length) conflict('Teacher profile does not belong to the applicant or is already linked');
        const linkedEntry = profiles.length === 1 ? profiles[0].id : null;
        const instructors = await platformQuery<{ id: string }>(db, `
          INSERT INTO platform_instructors (user_id, teacher_entry_id, display_name_snapshot)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET
            teacher_entry_id = COALESCE(platform_instructors.teacher_entry_id, EXCLUDED.teacher_entry_id),
            status = 'active'
          RETURNING id::text AS id
        `, [application.applicant_user_id, linkedEntry, application.applicant_display_name]);
        instructorId = instructors[0].id;
      }
      await platformQuery(db, `
        UPDATE platform_instructor_applications SET status=$2, decision_note=$3,
          decided_by_user_id=$4, decided_by_actor_key=$5, decided_at=NOW(), approved_instructor_id=$6::uuid
        WHERE id::text=$1
      `, [id, decision, note ?? null, actor.userId, actor.ownerKey, instructorId]);
      await enqueuePlatformEvent(db, `platform.instructor.application_${decision}`, 'instructor_application', id,
        `instructor-application:${id}:${decision}`, { applicationId: id, instructorId });
      if (applicantKey) await platformQuery(db, `INSERT INTO notifications (user_key, kind, actor_key, actor_name, title, excerpt, link, dedupe_key)
        VALUES ($1,$2,'','CubeRoot',$3,$4,'/platform/teachers/apply',$5) ON CONFLICT DO NOTHING`,
        [applicantKey, decision === 'approved' ? 'instructor_approved' : 'instructor_rejected', '讲师申请 / Instructor application', note ?? '', `instructor-application:${id}:${decision}`]);
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
