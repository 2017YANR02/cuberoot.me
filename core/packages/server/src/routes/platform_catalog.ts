import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import { requirePlatformActor, requirePlatformAdmin, type PlatformActor } from '../platform/auth.js';
import {
  enqueuePlatformEvent,
  isPostgresConflict,
  platformDb,
  platformQuery,
  requireCourseOwner,
  requireInstructor,
  sendMutation,
  withIdempotency,
  type PlatformDb,
} from '../platform/db.js';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../platform/data_encryption.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore, publicCache } from '../platform/http.js';
import {
  normalizePlatformQuizAnswer,
  normalizePlatformQuizChoices,
  type PlatformQuizAnswer,
  type PlatformQuizQuestionType,
} from '../platform/quiz_answers.js';
import {
  arrayField,
  enumField,
  integerField,
  isObject,
  nullableStringField,
  pagination,
  readJsonObject,
  resourceId,
  stringField,
  type JsonObject,
} from '../platform/validation.js';

export const platformCatalogRoutes = platformRouter();

const SLUG = /^[a-z0-9][a-z0-9_-]{0,119}$/;
const CURRENCY = /^[A-Z]{3}$/;
const COURSE_STATUSES = ['draft', 'published', 'unlisted', 'archived'] as const;
const ENROLLMENT_MODES = ['free', 'purchase', 'invite', 'admin_grant'] as const;
const LESSON_STATUSES = ['draft', 'published', 'archived'] as const;
const ACCESS_SCOPES = ['public', 'entitled'] as const;
const PATH_STATUSES = ['draft', 'published', 'archived'] as const;

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function requiredParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value) badRequest(`${name} is required`);
  return resourceId(value, name);
}

function courseKey(c: Context): string {
  const value = c.req.param('courseId') ?? c.req.param('id');
  if (!value) badRequest('courseId is required');
  return resourceId(value, 'courseId');
}

async function courseId(db: PlatformDb, key: string): Promise<string> {
  const rows = await platformQuery<{ id: string }>(db, `
    SELECT id::text AS id FROM platform_courses
    WHERE id::text = $1 OR slug = $1
  `, [key]);
  if (!rows[0]) notFound('Course');
  return rows[0].id;
}

async function authorizeCourseWrite(db: PlatformDb, actor: PlatformActor, key: string): Promise<string> {
  const id = await courseId(db, key);
  if (!actor.isAdmin) await requireCourseOwner(db, actor, id);
  return id;
}

function courseFields(body: JsonObject, required: boolean) {
  return {
    slug: stringField(body, 'slug', { required, max: 120, pattern: SLUG }),
    titleZh: stringField(body, 'titleZh', { required: false, max: 240 }),
    titleEn: stringField(body, 'titleEn', { required: false, max: 240 }),
    summaryZh: stringField(body, 'summaryZh', { max: 4_000 }),
    summaryEn: stringField(body, 'summaryEn', { max: 4_000 }),
    descriptionZh: stringField(body, 'descriptionZh', { max: 100_000, trim: false }),
    descriptionEn: stringField(body, 'descriptionEn', { max: 100_000, trim: false }),
    status: enumField(body, 'status', COURSE_STATUSES),
    enrollmentMode: enumField(body, 'enrollmentMode', ENROLLMENT_MODES),
    baseAmountMinor: integerField(body, 'baseAmountMinor', { min: 0, max: Number.MAX_SAFE_INTEGER }),
    memberAmountMinor: body.memberAmountMinor === null
      ? null
      : integerField(body, 'memberAmountMinor', { min: 0, max: Number.MAX_SAFE_INTEGER }),
    currency: stringField(body, 'currency', { max: 3, pattern: CURRENCY }),
  };
}

function requireBilingualTitle(titleZh: string | undefined, titleEn: string | undefined): void {
  if (!titleZh && !titleEn) badRequest('At least one of titleZh and titleEn is required');
}

const COURSE_PROJECTION = `
  c.id::text AS id, c.slug, c.status, c.base_amount_minor AS "baseAmountMinor",
  c.member_amount_minor AS "memberAmountMinor", c.currency,
  c.enrollment_mode AS "enrollmentMode", c.current_revision AS "currentRevision",
  r.title_zh AS "titleZh", r.title_en AS "titleEn", r.summary_zh AS "summaryZh",
  r.summary_en AS "summaryEn", r.description_zh AS "descriptionZh",
  r.description_en AS "descriptionEn", c.published_at AS "publishedAt",
  c.created_at AS "createdAt", c.updated_at AS "updatedAt"`;

platformCatalogRoutes.get('/platform/courses', async (c) => {
  const { page, pageSize, offset } = pagination(c, 60);
  const q = c.req.query('q')?.trim().slice(0, 200) ?? '';
  const rows = await platformQuery(platformDb(), `
    SELECT ${COURSE_PROJECTION}
    FROM platform_courses c
    JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision = c.current_revision
    WHERE c.status = 'published'
      AND ($1 = '' OR r.title_zh ILIKE '%' || $1 || '%' OR r.title_en ILIKE '%' || $1 || '%'
        OR r.summary_zh ILIKE '%' || $1 || '%' OR r.summary_en ILIKE '%' || $1 || '%')
    ORDER BY c.published_at DESC, c.id
    LIMIT $2 OFFSET $3
  `, [q, pageSize, offset]);
  const totals = await platformQuery<{ total: number }>(platformDb(), `
    SELECT COUNT(*)::int AS total
    FROM platform_courses c
    JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision = c.current_revision
    WHERE c.status = 'published'
      AND ($1 = '' OR r.title_zh ILIKE '%' || $1 || '%' OR r.title_en ILIKE '%' || $1 || '%'
        OR r.summary_zh ILIKE '%' || $1 || '%' OR r.summary_en ILIKE '%' || $1 || '%')
  `, [q]);
  publicCache(c, rows.length > 0);
  return c.json({ courses: rows, total: totals[0]?.total ?? 0, page, pageSize });
});

platformCatalogRoutes.get('/platform/courses/:id', async (c) => {
  const key = resourceId(c.req.param('id'));
  const rows = await platformQuery(platformDb(), `
    SELECT ${COURSE_PROJECTION},
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', l.id::text, 'slug', l.slug, 'ordinal', l.ordinal,
        'titleZh', lr.title_zh, 'titleEn', lr.title_en,
        'durationSeconds', lr.duration_seconds, 'accessScope', l.access_scope
      ) ORDER BY l.ordinal)
      FROM platform_lessons l
      JOIN platform_lesson_revisions lr ON lr.lesson_id = l.id AND lr.revision = l.current_revision
      WHERE l.course_id = c.id AND l.status = 'published'), '[]'::jsonb) AS lessons,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', i.id::text, 'displayName', i.display_name_snapshot,
        'teacherEntryId', i.teacher_entry_id, 'role', co.role
      ) ORDER BY CASE co.role WHEN 'owner' THEN 0 ELSE 1 END, i.display_name_snapshot)
      FROM platform_course_owners co JOIN platform_instructors i ON i.id = co.instructor_id
      WHERE co.course_id = c.id AND co.status = 'active' AND i.status = 'active'), '[]'::jsonb) AS instructors
    FROM platform_courses c
    JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision = c.current_revision
    WHERE (c.id::text = $1 OR c.slug = $1) AND c.status IN ('published', 'unlisted')
  `, [key]);
  if (!rows[0]) notFound('Course');
  publicCache(c);
  return c.json({ course: rows[0] });
});

platformCatalogRoutes.get('/platform/courses/:courseId/lessons/:lessonId', async (c) => {
  const course = courseKey(c);
  const lesson = resourceId(c.req.param('lessonId'), 'lessonId');
  const db = platformDb();
  const rows = await platformQuery<{ course_id: string; access_scope: string } & Record<string, unknown>>(db, `
    SELECT l.course_id::text, l.access_scope,
      l.id::text AS id, l.slug, l.ordinal, l.status, l.access_scope AS "accessScope",
      lr.revision, lr.title_zh AS "titleZh", lr.title_en AS "titleEn",
      lr.body_zh AS "bodyZh", lr.body_en AS "bodyEn",
      lr.media_id::text AS "mediaId", lr.duration_seconds AS "durationSeconds",
      q.id::text AS "quizId", qr.title_zh AS "quizTitleZh", qr.title_en AS "quizTitleEn",
      qr.passing_score_bps AS "passingScoreBps", qr.max_attempts AS "maxAttempts",
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', qq.id::text, 'ordinal', qq.ordinal, 'type', qq.question_type,
        'promptZh', qq.prompt_zh, 'promptEn', qq.prompt_en, 'choices', qq.choices,
        'points', qq.points
      ) ORDER BY qq.ordinal) FROM platform_quiz_questions qq
      WHERE qq.quiz_id = q.id AND qq.quiz_revision = q.current_revision), '[]'::jsonb) AS questions
    FROM platform_courses c
    JOIN platform_lessons l ON l.course_id = c.id
    JOIN platform_lesson_revisions lr ON lr.lesson_id = l.id AND lr.revision = l.current_revision
    LEFT JOIN platform_quizzes q ON q.lesson_id = l.id AND q.status = 'published'
    LEFT JOIN platform_quiz_revisions qr ON qr.quiz_id = q.id AND qr.revision = q.current_revision
    WHERE (c.id::text = $1 OR c.slug = $1) AND (l.id::text = $2 OR l.slug = $2)
      AND c.status IN ('published', 'unlisted') AND l.status = 'published'
  `, [course, lesson]);
  const row = rows[0];
  if (!row) notFound('Lesson');
  if (row.access_scope !== 'public') {
    const actor = await requirePlatformActor(c);
    const { requireCourseEntitlement } = await import('../platform/db.js');
    await requireCourseEntitlement(db, actor, row.course_id);
    privateNoStore(c);
  } else {
    publicCache(c);
  }
  return c.json({ lesson: row });
});

platformCatalogRoutes.get('/platform/paths', async (c) => {
  const { page, pageSize, offset } = pagination(c, 60);
  const rows = await platformQuery(platformDb(), `
    SELECT p.id::text AS id, p.slug, p.title_zh AS "titleZh", p.title_en AS "titleEn",
      p.description_zh AS "descriptionZh", p.description_en AS "descriptionEn",
      p.status, p.published_at AS "publishedAt", COUNT(i.ordinal)::int AS "itemCount"
    FROM platform_learning_paths p
    LEFT JOIN platform_learning_path_items i ON i.path_id = p.id
    WHERE p.status = 'published'
    GROUP BY p.id ORDER BY p.published_at DESC, p.id LIMIT $1 OFFSET $2
  `, [pageSize, offset]);
  publicCache(c, rows.length > 0);
  return c.json({ paths: rows, page, pageSize });
});

platformCatalogRoutes.get('/platform/paths/:id', async (c) => {
  const key = resourceId(c.req.param('id'));
  const rows = await platformQuery(platformDb(), `
    SELECT p.id::text AS id, p.slug, p.title_zh AS "titleZh", p.title_en AS "titleEn",
      p.description_zh AS "descriptionZh", p.description_en AS "descriptionEn", p.status,
      COALESCE(jsonb_agg(jsonb_build_object(
        'ordinal', i.ordinal, 'courseId', i.course_id::text, 'lessonId', i.lesson_id::text,
        'courseSlug', c.slug, 'lessonSlug', l.slug,
        'titleZh', COALESCE(cr.title_zh, lr.title_zh), 'titleEn', COALESCE(cr.title_en, lr.title_en)
      ) ORDER BY i.ordinal) FILTER (WHERE i.ordinal IS NOT NULL), '[]'::jsonb) AS items
    FROM platform_learning_paths p
    LEFT JOIN platform_learning_path_items i ON i.path_id = p.id
    LEFT JOIN platform_courses c ON c.id = i.course_id
    LEFT JOIN platform_course_revisions cr ON cr.course_id = c.id AND cr.revision = c.current_revision
    LEFT JOIN platform_lessons l ON l.id = i.lesson_id
    LEFT JOIN platform_lesson_revisions lr ON lr.lesson_id = l.id AND lr.revision = l.current_revision
    WHERE (p.id::text = $1 OR p.slug = $1) AND p.status = 'published'
    GROUP BY p.id
  `, [key]);
  if (!rows[0]) notFound('Learning path');
  publicCache(c);
  return c.json({ path: rows[0] });
});

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
    `, [actor.userId, actor.displayName, JSON.stringify({ experience, specialties, contact })]);
    await enqueuePlatformEvent(db, 'platform.instructor.application_submitted', 'instructor_application', rows[0].id,
      `instructor-application:${rows[0].id}:submitted`, { applicationId: rows[0].id });
    return { status: 201, body: { application: rows[0] }, resourceType: 'instructor_application', resourceId: rows[0].id };
  });
  return sendMutation(c, result);
});

async function listManagedCourses(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const { page, pageSize, offset } = pagination(c, 100);
  const db = platformDb();
  let instructorId: string | null = null;
  if (!admin) instructorId = await requireInstructor(db, actor);
  const id = c.req.param('id') ? requiredParam(c, 'id') : null;
  const rows = await platformQuery(db, `
    SELECT ${COURSE_PROJECTION},
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l.id::text, 'slug', l.slug,
        'ordinal', l.ordinal, 'status', l.status, 'accessScope', l.access_scope,
        'titleZh', lr.title_zh, 'titleEn', lr.title_en) ORDER BY l.ordinal)
      FROM platform_lessons l LEFT JOIN platform_lesson_revisions lr
        ON lr.lesson_id = l.id AND lr.revision = l.current_revision WHERE l.course_id = c.id), '[]'::jsonb) AS lessons
    FROM platform_courses c
    LEFT JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision = c.current_revision
    WHERE ($1::uuid IS NULL OR EXISTS (
      SELECT 1 FROM platform_course_owners co WHERE co.course_id = c.id AND co.instructor_id = $1::uuid AND co.status = 'active'
    )) AND ($2::text IS NULL OR c.id::text = $2 OR c.slug = $2)
    ORDER BY c.updated_at DESC, c.id LIMIT $3 OFFSET $4
  `, [instructorId, id, pageSize, offset]);
  if (id && !rows[0]) notFound('Course');
  privateNoStore(c);
  return c.json(id ? { course: rows[0] } : { courses: rows, page, pageSize });
}

platformCatalogRoutes.get('/platform/instructor/courses', (c) => listManagedCourses(c, false));
platformCatalogRoutes.get('/platform/instructor/courses/:id', (c) => listManagedCourses(c, false));
platformCatalogRoutes.get('/platform/admin/courses', (c) => listManagedCourses(c, true));
platformCatalogRoutes.get('/platform/admin/courses/:id', (c) => listManagedCourses(c, true));

async function createCourse(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const input = courseFields(body, true);
  requireBilingualTitle(input.titleZh, input.titleEn);
  const status = input.status ?? 'draft';
  const revisionStatus = status === 'published' || status === 'unlisted' ? 'published' : 'draft';
  if (input.memberAmountMinor != null && input.baseAmountMinor != null && input.memberAmountMinor > input.baseAmountMinor) {
    badRequest('memberAmountMinor cannot exceed baseAmountMinor');
  }
  const result = await withIdempotency(c, actor, `platform.${admin ? 'admin' : 'instructor'}.course.create`, body, async (db) => {
    const instructorId = admin ? null : await requireInstructor(db, actor);
    try {
      const rows = await platformQuery<{ id: string; slug: string }>(db, `
        INSERT INTO platform_courses (
          slug, status, current_revision, base_amount_minor, member_amount_minor, currency,
          enrollment_mode, created_by_user_id, published_at, archived_at
        ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7,
          CASE WHEN $2 IN ('published', 'unlisted') THEN NOW() ELSE NULL END,
          CASE WHEN $2 = 'archived' THEN NOW() ELSE NULL END)
        RETURNING id::text AS id, slug
      `, [input.slug, status, input.baseAmountMinor ?? 0, input.memberAmountMinor ?? null,
        input.currency ?? 'CNY', input.enrollmentMode ?? 'purchase', actor.userId]);
      const row = rows[0];
      const revision = {
        titleZh: input.titleZh ?? '', titleEn: input.titleEn ?? '', summaryZh: input.summaryZh ?? '',
        summaryEn: input.summaryEn ?? '', descriptionZh: input.descriptionZh ?? '', descriptionEn: input.descriptionEn ?? '',
      };
      await platformQuery(db, `
        INSERT INTO platform_course_revisions (
          course_id, revision, title_zh, title_en, summary_zh, summary_en,
          description_zh, description_en, status, content_hash,
          created_by_user_id, published_by_user_id, published_at
        ) VALUES ($1::uuid, 1, $2, $3, $4, $5, $6, $7, $8, decode($9, 'hex'), $10,
          CASE WHEN $8 = 'published' THEN $10 ELSE NULL END,
          CASE WHEN $8 = 'published' THEN NOW() ELSE NULL END)
      `, [row.id, revision.titleZh, revision.titleEn, revision.summaryZh, revision.summaryEn,
        revision.descriptionZh, revision.descriptionEn, revisionStatus, hashJson(revision), actor.userId]);
      if (instructorId) {
        await platformQuery(db, `
          INSERT INTO platform_course_owners (course_id, instructor_id, role, revenue_share_bps, created_by_user_id)
          VALUES ($1::uuid, $2::uuid, 'owner', 10000, $3)
        `, [row.id, instructorId, actor.userId]);
      }
      await enqueuePlatformEvent(db, 'platform.course.created', 'course', row.id,
        `course:${row.id}:created`, { courseId: row.id, status });
      return { status: 201, body: { course: row }, resourceType: 'course', resourceId: row.id };
    } catch (error) {
      if (isPostgresConflict(error)) conflict('Course data conflicts with an existing record');
      throw error;
    }
  });
  return sendMutation(c, result);
}

async function updateCourse(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const key = requiredParam(c, 'id');
  const body = await readJsonObject(c);
  const input = courseFields(body, false);
  const result = await withIdempotency(c, actor, `platform.${admin ? 'admin' : 'instructor'}.course.update:${key}`, body, async (db) => {
    const id = await authorizeCourseWrite(db, actor, key);
    const existing = await platformQuery<Record<string, unknown>>(db, `
      SELECT c.slug, c.status, c.base_amount_minor AS "baseAmountMinor", c.member_amount_minor AS "memberAmountMinor",
        c.currency, c.enrollment_mode AS "enrollmentMode", c.current_revision AS "currentRevision",
        r.title_zh AS "titleZh", r.title_en AS "titleEn", r.summary_zh AS "summaryZh", r.summary_en AS "summaryEn",
        r.description_zh AS "descriptionZh", r.description_en AS "descriptionEn"
      FROM platform_courses c JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision = c.current_revision
      WHERE c.id = $1::uuid FOR UPDATE
    `, [id]);
    const old = existing[0];
    if (!old) notFound('Course');
    const revision = {
      titleZh: input.titleZh ?? String(old.titleZh), titleEn: input.titleEn ?? String(old.titleEn),
      summaryZh: input.summaryZh ?? String(old.summaryZh), summaryEn: input.summaryEn ?? String(old.summaryEn),
      descriptionZh: input.descriptionZh ?? String(old.descriptionZh), descriptionEn: input.descriptionEn ?? String(old.descriptionEn),
    };
    requireBilingualTitle(revision.titleZh, revision.titleEn);
    const status = input.status ?? String(old.status);
    const baseAmountMinor = input.baseAmountMinor ?? Number(old.baseAmountMinor);
    const memberAmountMinor = input.memberAmountMinor === undefined ? old.memberAmountMinor : input.memberAmountMinor;
    if (memberAmountMinor != null && Number(memberAmountMinor) > baseAmountMinor) badRequest('memberAmountMinor cannot exceed baseAmountMinor');
    const nextRevision = Number(old.currentRevision) + 1;
    const revisionStatus = status === 'published' || status === 'unlisted' ? 'published' : 'draft';
    await platformQuery(db, `
      INSERT INTO platform_course_revisions (
        course_id, revision, title_zh, title_en, summary_zh, summary_en, description_zh, description_en,
        status, content_hash, created_by_user_id, published_by_user_id, published_at
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, decode($10, 'hex'), $11,
        CASE WHEN $9 = 'published' THEN $11 ELSE NULL END, CASE WHEN $9 = 'published' THEN NOW() ELSE NULL END)
    `, [id, nextRevision, revision.titleZh, revision.titleEn, revision.summaryZh, revision.summaryEn,
      revision.descriptionZh, revision.descriptionEn, revisionStatus, hashJson(revision), actor.userId]);
    await platformQuery(db, `
      UPDATE platform_courses SET slug = $2, status = $3, current_revision = $4,
        base_amount_minor = $5, member_amount_minor = $6, currency = $7, enrollment_mode = $8,
        published_at = CASE WHEN $3 IN ('published', 'unlisted') THEN COALESCE(published_at, NOW()) ELSE published_at END,
        archived_at = CASE WHEN $3 = 'archived' THEN COALESCE(archived_at, NOW()) ELSE NULL END
      WHERE id = $1::uuid
    `, [id, input.slug ?? old.slug, status, nextRevision, baseAmountMinor, memberAmountMinor,
      input.currency ?? old.currency, input.enrollmentMode ?? old.enrollmentMode]);
    await enqueuePlatformEvent(db, 'platform.course.updated', 'course', id,
      `course:${id}:revision:${nextRevision}`, { courseId: id, revision: nextRevision, status });
    return { status: 200, body: { course: { id, revision: nextRevision, status } }, resourceType: 'course', resourceId: id };
  });
  return sendMutation(c, result);
}

platformCatalogRoutes.post('/platform/instructor/courses', (c) => createCourse(c, false));
platformCatalogRoutes.patch('/platform/instructor/courses/:id', (c) => updateCourse(c, false));
platformCatalogRoutes.post('/platform/admin/courses', (c) => createCourse(c, true));
platformCatalogRoutes.patch('/platform/admin/courses/:id', (c) => updateCourse(c, true));

async function archiveCourse(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const key = requiredParam(c, 'id');
  const result = await withIdempotency(c, actor, `platform.${admin ? 'admin' : 'instructor'}.course.archive:${key}`, {}, async (db) => {
    const id = await authorizeCourseWrite(db, actor, key);
    await platformQuery(db, `
      UPDATE platform_courses SET status='archived', archived_at=COALESCE(archived_at,NOW()) WHERE id=$1::uuid
    `, [id]);
    await enqueuePlatformEvent(db, 'platform.course.archived', 'course', id,
      `course:${id}:archived`, { courseId: id });
    return { status: 200, body: { course: { id, status: 'archived' } }, resourceType: 'course', resourceId: id };
  });
  return sendMutation(c, result);
}

platformCatalogRoutes.delete('/platform/instructor/courses/:id', (c) => archiveCourse(c, false));
platformCatalogRoutes.delete('/platform/admin/courses/:id', (c) => archiveCourse(c, true));

function lessonFields(body: JsonObject, required: boolean) {
  const bodyZh = body.bodyZh === undefined ? undefined : body.bodyZh;
  const bodyEn = body.bodyEn === undefined ? undefined : body.bodyEn;
  if (bodyZh !== undefined && !isObject(bodyZh)) badRequest('bodyZh must be an object');
  if (bodyEn !== undefined && !isObject(bodyEn)) badRequest('bodyEn must be an object');
  return {
    slug: stringField(body, 'slug', { required, max: 120, pattern: SLUG }),
    ordinal: integerField(body, 'ordinal', { required, min: 0, max: 1_000_000 }),
    titleZh: stringField(body, 'titleZh', { max: 240 }),
    titleEn: stringField(body, 'titleEn', { max: 240 }),
    bodyZh, bodyEn,
    durationSeconds: body.durationSeconds === null ? null : integerField(body, 'durationSeconds', { min: 0, max: 86_400 }),
    status: enumField(body, 'status', LESSON_STATUSES),
    accessScope: enumField(body, 'accessScope', ACCESS_SCOPES),
  };
}

async function saveLesson(c: Context, admin: boolean, creating: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const courseKeyValue = courseKey(c);
  const lessonKey = creating ? null : requiredParam(c, 'lessonId');
  const body = await readJsonObject(c);
  const input = lessonFields(body, creating);
  if (creating) requireBilingualTitle(input.titleZh, input.titleEn);
  const scope = `platform.${admin ? 'admin' : 'instructor'}.lesson.${creating ? 'create' : 'update'}:${courseKeyValue}${lessonKey ? `:${lessonKey}` : ''}`;
  const result = await withIdempotency(c, actor, scope, body, async (db) => {
    const id = await authorizeCourseWrite(db, actor, courseKeyValue);
    if (creating) {
      const status = input.status ?? 'draft';
      const revisionStatus = status === 'published' ? 'published' : 'draft';
      try {
        const rows = await platformQuery<{ id: string }>(db, `
          INSERT INTO platform_lessons (course_id, slug, ordinal, status, access_scope, current_revision)
          VALUES ($1::uuid, $2, $3, $4, $5, 1) RETURNING id::text AS id
        `, [id, input.slug, input.ordinal, status, input.accessScope ?? 'entitled']);
        const revision = { titleZh: input.titleZh ?? '', titleEn: input.titleEn ?? '', bodyZh: input.bodyZh ?? {}, bodyEn: input.bodyEn ?? {} };
        await platformQuery(db, `
          INSERT INTO platform_lesson_revisions (
            lesson_id, revision, title_zh, title_en, body_zh, body_en, duration_seconds,
            status, content_hash, created_by_user_id, published_by_user_id, published_at
          ) VALUES ($1::uuid, 1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, decode($8, 'hex'), $9,
            CASE WHEN $7 = 'published' THEN $9 ELSE NULL END, CASE WHEN $7 = 'published' THEN NOW() ELSE NULL END)
        `, [rows[0].id, revision.titleZh, revision.titleEn, JSON.stringify(revision.bodyZh), JSON.stringify(revision.bodyEn),
          input.durationSeconds ?? null, revisionStatus, hashJson(revision), actor.userId]);
        return { status: 201, body: { lesson: rows[0] }, resourceType: 'lesson', resourceId: rows[0].id };
      } catch (error) {
        if (isPostgresConflict(error)) conflict('Lesson slug or order conflicts with an existing lesson');
        throw error;
      }
    }
    const found = await platformQuery<Record<string, unknown>>(db, `
      SELECT l.id::text AS id, l.slug, l.ordinal, l.status, l.access_scope AS "accessScope", l.current_revision AS "currentRevision",
        r.title_zh AS "titleZh", r.title_en AS "titleEn", r.body_zh AS "bodyZh", r.body_en AS "bodyEn",
        r.duration_seconds AS "durationSeconds"
      FROM platform_lessons l JOIN platform_lesson_revisions r ON r.lesson_id = l.id AND r.revision = l.current_revision
      WHERE l.course_id = $1::uuid AND (l.id::text = $2 OR l.slug = $2) FOR UPDATE
    `, [id, lessonKey]);
    const old = found[0];
    if (!old) notFound('Lesson');
    const revision = {
      titleZh: input.titleZh ?? String(old.titleZh), titleEn: input.titleEn ?? String(old.titleEn),
      bodyZh: input.bodyZh ?? old.bodyZh, bodyEn: input.bodyEn ?? old.bodyEn,
    };
    requireBilingualTitle(revision.titleZh, revision.titleEn);
    const status = input.status ?? String(old.status);
    const revisionStatus = status === 'published' ? 'published' : 'draft';
    const nextRevision = Number(old.currentRevision) + 1;
    await platformQuery(db, `
      INSERT INTO platform_lesson_revisions (
        lesson_id, revision, title_zh, title_en, body_zh, body_en, duration_seconds,
        status, content_hash, created_by_user_id, published_by_user_id, published_at
      ) VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, decode($9, 'hex'), $10,
        CASE WHEN $8 = 'published' THEN $10 ELSE NULL END, CASE WHEN $8 = 'published' THEN NOW() ELSE NULL END)
    `, [old.id, nextRevision, revision.titleZh, revision.titleEn, JSON.stringify(revision.bodyZh), JSON.stringify(revision.bodyEn),
      input.durationSeconds === undefined ? old.durationSeconds : input.durationSeconds, revisionStatus, hashJson(revision), actor.userId]);
    await platformQuery(db, `
      UPDATE platform_lessons SET slug=$2, ordinal=$3, status=$4, access_scope=$5, current_revision=$6
      WHERE id=$1::uuid
    `, [old.id, input.slug ?? old.slug, input.ordinal ?? old.ordinal, status, input.accessScope ?? old.accessScope, nextRevision]);
    return { status: 200, body: { lesson: { id: old.id, revision: nextRevision, status } }, resourceType: 'lesson', resourceId: String(old.id) };
  });
  return sendMutation(c, result);
}

platformCatalogRoutes.post('/platform/instructor/courses/:courseId/lessons', (c) => saveLesson(c, false, true));
platformCatalogRoutes.patch('/platform/instructor/courses/:courseId/lessons/:lessonId', (c) => saveLesson(c, false, false));
platformCatalogRoutes.post('/platform/admin/courses/:courseId/lessons', (c) => saveLesson(c, true, true));
platformCatalogRoutes.patch('/platform/admin/courses/:courseId/lessons/:lessonId', (c) => saveLesson(c, true, false));

async function archiveLesson(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const courseKeyValue = courseKey(c);
  const lessonKey = requiredParam(c, 'lessonId');
  const scope = `platform.${admin ? 'admin' : 'instructor'}.lesson.archive:${courseKeyValue}:${lessonKey}`;
  const result = await withIdempotency(c, actor, scope, {}, async (db) => {
    const id = await authorizeCourseWrite(db, actor, courseKeyValue);
    const rows = await platformQuery<{ id: string }>(db, `
      UPDATE platform_lessons SET status='archived'
      WHERE course_id=$1::uuid AND (id::text=$2 OR slug=$2) RETURNING id::text AS id
    `, [id, lessonKey]);
    if (!rows[0]) notFound('Lesson');
    return { status: 200, body: { lesson: { ...rows[0], status: 'archived' } }, resourceType: 'lesson', resourceId: rows[0].id };
  });
  return sendMutation(c, result);
}

platformCatalogRoutes.delete('/platform/instructor/courses/:courseId/lessons/:lessonId', (c) => archiveLesson(c, false));
platformCatalogRoutes.delete('/platform/admin/courses/:courseId/lessons/:lessonId', (c) => archiveLesson(c, true));

interface QuizQuestionInput {
  type: PlatformQuizQuestionType;
  promptZh: string;
  promptEn: string;
  choices: string[];
  answerKey: PlatformQuizAnswer;
  points: number;
}

function quizFields(body: JsonObject, required: boolean) {
  const rawQuestions = arrayField(body, 'questions', { required, maxItems: 500 });
  const questions = rawQuestions?.map((value, index): QuizQuestionInput => {
    if (!isObject(value)) badRequest(`questions[${index}] must be an object`);
    const type = enumField(value, 'type', ['single_choice', 'multiple_choice', 'boolean', 'text'] as const, { required: true })!;
    const promptZh = stringField(value, 'promptZh', { max: 20_000 }) ?? '';
    const promptEn = stringField(value, 'promptEn', { max: 20_000 }) ?? '';
    if (!promptZh && !promptEn) badRequest(`questions[${index}] requires promptZh or promptEn`);
    const choices = normalizePlatformQuizChoices(
      type,
      arrayField(value, 'choices', { maxItems: 100 }) ?? [],
      `questions[${index}].choices`,
    );
    if (!Object.prototype.hasOwnProperty.call(value, 'answerKey') || value.answerKey === undefined) {
      badRequest(`questions[${index}].answerKey is required`);
    }
    const answerKey = normalizePlatformQuizAnswer({
      questionType: type,
      raw: value.answerKey,
      choiceCount: choices.length,
      source: 'authoring',
      label: `questions[${index}].answerKey`,
    });
    return {
      type,
      promptZh,
      promptEn,
      choices,
      answerKey,
      points: integerField(value, 'points', { min: 1, max: 1_000_000 }) ?? 1,
    };
  });
  return {
    slug: stringField(body, 'slug', { required, max: 120, pattern: SLUG }),
    titleZh: stringField(body, 'titleZh', { max: 240 }),
    titleEn: stringField(body, 'titleEn', { max: 240 }),
    passingScoreBps: integerField(body, 'passingScoreBps', { required, min: 0, max: 10_000 }),
    maxAttempts: body.maxAttempts === null ? null : integerField(body, 'maxAttempts', { min: 1, max: 1_000_000 }),
    status: enumField(body, 'status', ['draft', 'published', 'archived'] as const),
    questions,
  };
}

async function writableLessonId(db: PlatformDb, actor: PlatformActor, courseKeyValue: string, lessonKey: string): Promise<string> {
  const id = await authorizeCourseWrite(db, actor, courseKeyValue);
  const rows = await platformQuery<{ id: string }>(db, `
    SELECT id::text AS id FROM platform_lessons
    WHERE course_id=$1::uuid AND (id::text=$2 OR slug=$2)
  `, [id, lessonKey]);
  if (!rows[0]) notFound('Lesson');
  return rows[0].id;
}

async function quizQuestions(db: PlatformDb, quizId: string, revision: number): Promise<QuizQuestionInput[]> {
  const rows = await platformQuery<{
    type: QuizQuestionInput['type']; promptZh: string; promptEn: string; choices: unknown[];
    encryptedAnswer: Buffer | Uint8Array; answerVersion: number; points: number;
  }>(db, `
    SELECT question_type AS type,prompt_zh AS "promptZh",prompt_en AS "promptEn",choices,
      answer_key_encrypted AS "encryptedAnswer",answer_key_version AS "answerVersion",points
    FROM platform_quiz_questions WHERE quiz_id=$1::uuid AND quiz_revision=$2 ORDER BY ordinal
  `, [quizId, revision]);
  return rows.map((row) => {
    const choices = normalizePlatformQuizChoices(row.type, row.choices, 'stored choices');
    return {
      type: row.type,
      promptZh: row.promptZh,
      promptEn: row.promptEn,
      choices,
      answerKey: normalizePlatformQuizAnswer({
        questionType: row.type,
        raw: decryptPlatformPrivateData(Buffer.from(row.encryptedAnswer), row.answerVersion).answer,
        choiceCount: choices.length,
        source: 'stored',
        label: 'stored answer key',
      }),
      points: row.points,
    };
  });
}

async function listManagedQuizzes(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const courseKeyValue = courseKey(c);
  const lessonKey = requiredParam(c, 'lessonId');
  const quizKey = c.req.param('quizId') ? requiredParam(c, 'quizId') : null;
  const db = platformDb();
  const lessonId = await writableLessonId(db, actor, courseKeyValue, lessonKey);
  const rows = await platformQuery<{
    id: string; slug: string; status: string; revision: number; titleZh: string; titleEn: string;
    passingScoreBps: number; maxAttempts: number | null;
  }>(db, `
    SELECT q.id::text AS id,q.slug,q.status,q.current_revision AS revision,
      qr.title_zh AS "titleZh",qr.title_en AS "titleEn",qr.passing_score_bps AS "passingScoreBps",qr.max_attempts AS "maxAttempts"
    FROM platform_quizzes q
    JOIN platform_quiz_revisions qr ON qr.quiz_id=q.id AND qr.revision=q.current_revision
    WHERE q.lesson_id=$1::uuid AND ($2::text IS NULL OR q.id::text=$2 OR q.slug=$2)
    ORDER BY q.updated_at DESC,q.id
  `, [lessonId, quizKey]);
  if (quizKey && !rows[0]) notFound('Quiz');
  const quizzes = await Promise.all(rows.map(async (row) => ({
    ...row,
    questions: await quizQuestions(db, row.id, row.revision),
  })));
  privateNoStore(c);
  return c.json(quizKey ? { quiz: quizzes[0] } : { quizzes });
}

async function saveQuiz(c: Context, admin: boolean, creating: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const courseKeyValue = courseKey(c);
  const lessonKey = requiredParam(c, 'lessonId');
  const quizKey = creating ? null : requiredParam(c, 'quizId');
  const body = await readJsonObject(c);
  const input = quizFields(body, creating);
  if (creating) requireBilingualTitle(input.titleZh, input.titleEn);
  const scope = `platform.${admin ? 'admin' : 'instructor'}.quiz.${creating ? 'create' : 'update'}:${courseKeyValue}:${lessonKey}:${quizKey ?? 'new'}`;
  const result = await withIdempotency(c, actor, scope, body, async (db) => {
    const lessonId = await writableLessonId(db, actor, courseKeyValue, lessonKey);
    let id: string;
    let revision: number;
    let titleZh: string;
    let titleEn: string;
    let passingScoreBps: number;
    let maxAttempts: number | null;
    let status: 'draft' | 'published' | 'archived';
    let questions: QuizQuestionInput[];
    if (creating) {
      status = input.status ?? 'draft';
      revision = 1;
      titleZh = input.titleZh ?? '';
      titleEn = input.titleEn ?? '';
      passingScoreBps = input.passingScoreBps!;
      maxAttempts = input.maxAttempts ?? null;
      questions = input.questions!;
      try {
        const rows = await platformQuery<{ id: string }>(db, `
          INSERT INTO platform_quizzes(lesson_id,slug,status,current_revision)
          VALUES($1::uuid,$2,$3,1) RETURNING id::text AS id
        `, [lessonId, input.slug, status]);
        id = rows[0].id;
      } catch (error) {
        if (isPostgresConflict(error)) conflict('Quiz slug conflicts with an existing quiz');
        throw error;
      }
    } else {
      const rows = await platformQuery<{
        id: string; slug: string; status: 'draft' | 'published' | 'archived'; revision: number;
        titleZh: string; titleEn: string; passingScoreBps: number; maxAttempts: number | null;
      }>(db, `
        SELECT q.id::text AS id,q.slug,q.status,q.current_revision AS revision,
          qr.title_zh AS "titleZh",qr.title_en AS "titleEn",qr.passing_score_bps AS "passingScoreBps",qr.max_attempts AS "maxAttempts"
        FROM platform_quizzes q JOIN platform_quiz_revisions qr ON qr.quiz_id=q.id AND qr.revision=q.current_revision
        WHERE q.lesson_id=$1::uuid AND (q.id::text=$2 OR q.slug=$2) FOR UPDATE OF q
      `, [lessonId, quizKey]);
      const old = rows[0];
      if (!old) notFound('Quiz');
      id = old.id;
      revision = old.revision + 1;
      titleZh = input.titleZh ?? old.titleZh;
      titleEn = input.titleEn ?? old.titleEn;
      passingScoreBps = input.passingScoreBps ?? old.passingScoreBps;
      maxAttempts = input.maxAttempts === undefined ? old.maxAttempts : input.maxAttempts;
      status = input.status ?? old.status;
      questions = input.questions ?? await quizQuestions(db, id, old.revision);
      requireBilingualTitle(titleZh, titleEn);
      await platformQuery(db, `UPDATE platform_quizzes SET slug=COALESCE($2,slug),status=$3,current_revision=$4 WHERE id=$1::uuid`,
        [id, input.slug ?? null, status, revision]);
    }
    const revisionStatus = status === 'published' ? 'published' : 'draft';
    const normalized = { titleZh, titleEn, passingScoreBps, maxAttempts, questions };
    await platformQuery(db, `
      INSERT INTO platform_quiz_revisions(quiz_id,revision,title_zh,title_en,passing_score_bps,max_attempts,status,content_hash,created_by_user_id,published_at)
      VALUES($1::uuid,$2,$3,$4,$5,$6,$7,decode($8,'hex'),$9,CASE WHEN $7='published' THEN NOW() ELSE NULL END)
    `, [id, revision, titleZh, titleEn, passingScoreBps, maxAttempts, revisionStatus, hashJson(normalized), actor.userId]);
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const encrypted = encryptPlatformPrivateData({ answer: question.answerKey });
      await platformQuery(db, `
        INSERT INTO platform_quiz_questions(quiz_id,quiz_revision,ordinal,question_type,prompt_zh,prompt_en,choices,answer_key_encrypted,answer_key_version,points)
        VALUES($1::uuid,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
      `, [id, revision, index, question.type, question.promptZh, question.promptEn, JSON.stringify(question.choices), encrypted.payload, encrypted.keyVersion, question.points]);
    }
    if (creating) {
      await platformQuery(db, `UPDATE platform_quizzes SET current_revision=$2 WHERE id=$1::uuid`, [id, revision]);
    }
    return { status: creating ? 201 : 200, body: { quiz: { id, revision, status } }, resourceType: 'quiz', resourceId: id };
  });
  return sendMutation(c, result);
}

async function archiveQuiz(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const courseKeyValue = courseKey(c);
  const lessonKey = requiredParam(c, 'lessonId');
  const quizKey = requiredParam(c, 'quizId');
  const result = await withIdempotency(c, actor,
    `platform.${admin ? 'admin' : 'instructor'}.quiz.archive:${courseKeyValue}:${lessonKey}:${quizKey}`, {}, async (db) => {
      const lessonId = await writableLessonId(db, actor, courseKeyValue, lessonKey);
      const rows = await platformQuery<{ id: string }>(db, `
        UPDATE platform_quizzes SET status='archived'
        WHERE lesson_id=$1::uuid AND (id::text=$2 OR slug=$2) RETURNING id::text AS id
      `, [lessonId, quizKey]);
      if (!rows[0]) notFound('Quiz');
      return { status: 200, body: { quiz: { ...rows[0], status: 'archived' } }, resourceType: 'quiz', resourceId: rows[0].id };
    });
  return sendMutation(c, result);
}

platformCatalogRoutes.get('/platform/instructor/courses/:courseId/lessons/:lessonId/quizzes', (c) => listManagedQuizzes(c, false));
platformCatalogRoutes.get('/platform/instructor/courses/:courseId/lessons/:lessonId/quizzes/:quizId', (c) => listManagedQuizzes(c, false));
platformCatalogRoutes.post('/platform/instructor/courses/:courseId/lessons/:lessonId/quizzes', (c) => saveQuiz(c, false, true));
platformCatalogRoutes.patch('/platform/instructor/courses/:courseId/lessons/:lessonId/quizzes/:quizId', (c) => saveQuiz(c, false, false));
platformCatalogRoutes.delete('/platform/instructor/courses/:courseId/lessons/:lessonId/quizzes/:quizId', (c) => archiveQuiz(c, false));
platformCatalogRoutes.get('/platform/admin/courses/:courseId/lessons/:lessonId/quizzes', (c) => listManagedQuizzes(c, true));
platformCatalogRoutes.get('/platform/admin/courses/:courseId/lessons/:lessonId/quizzes/:quizId', (c) => listManagedQuizzes(c, true));
platformCatalogRoutes.post('/platform/admin/courses/:courseId/lessons/:lessonId/quizzes', (c) => saveQuiz(c, true, true));
platformCatalogRoutes.patch('/platform/admin/courses/:courseId/lessons/:lessonId/quizzes/:quizId', (c) => saveQuiz(c, true, false));
platformCatalogRoutes.delete('/platform/admin/courses/:courseId/lessons/:lessonId/quizzes/:quizId', (c) => archiveQuiz(c, true));

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

function pathFields(body: JsonObject, required: boolean) {
  const items = arrayField(body, 'items', { maxItems: 500 });
  const parsedItems = items?.map((value, index) => {
    if (!isObject(value)) badRequest(`items[${index}] must be an object`);
    const course = nullableStringField(value, 'courseId', { max: 128 });
    const lesson = nullableStringField(value, 'lessonId', { max: 128 });
    if ((course ? 1 : 0) + (lesson ? 1 : 0) !== 1) badRequest(`items[${index}] must select exactly one courseId or lessonId`);
    return { courseId: course, lessonId: lesson };
  });
  return {
    slug: stringField(body, 'slug', { required, max: 120, pattern: SLUG }),
    titleZh: stringField(body, 'titleZh', { max: 240 }), titleEn: stringField(body, 'titleEn', { max: 240 }),
    descriptionZh: stringField(body, 'descriptionZh', { max: 50_000, trim: false }),
    descriptionEn: stringField(body, 'descriptionEn', { max: 50_000, trim: false }),
    status: enumField(body, 'status', PATH_STATUSES), items: parsedItems,
  };
}

async function listAdminPaths(c: Context): Promise<Response> {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c, 100);
  const id = c.req.param('id') ? requiredParam(c, 'id') : null;
  const rows = await platformQuery(platformDb(), `
    SELECT p.id::text AS id, p.slug, p.title_zh AS "titleZh", p.title_en AS "titleEn",
      p.description_zh AS "descriptionZh", p.description_en AS "descriptionEn", p.status,
      COALESCE(jsonb_agg(jsonb_build_object('ordinal', i.ordinal, 'courseId', i.course_id::text, 'lessonId', i.lesson_id::text)
        ORDER BY i.ordinal) FILTER (WHERE i.ordinal IS NOT NULL), '[]'::jsonb) AS items
    FROM platform_learning_paths p LEFT JOIN platform_learning_path_items i ON i.path_id=p.id
    WHERE ($1::text IS NULL OR p.id::text=$1 OR p.slug=$1) GROUP BY p.id
    ORDER BY p.updated_at DESC LIMIT $2 OFFSET $3
  `, [id, pageSize, offset]);
  if (id && !rows[0]) notFound('Learning path');
  privateNoStore(c);
  return c.json(id ? { path: rows[0] } : { paths: rows, page, pageSize });
}

platformCatalogRoutes.get('/platform/admin/paths', listAdminPaths);
platformCatalogRoutes.get('/platform/admin/paths/:id', listAdminPaths);

async function savePath(c: Context, creating: boolean): Promise<Response> {
  const actor = await requirePlatformAdmin(c);
  const key = creating ? null : requiredParam(c, 'id');
  const body = await readJsonObject(c);
  const input = pathFields(body, creating);
  if (creating) requireBilingualTitle(input.titleZh, input.titleEn);
  const result = await withIdempotency(c, actor, `platform.admin.path.${creating ? 'create' : 'update'}:${key ?? 'new'}`, body, async (db) => {
    let id: string;
    if (creating) {
      const status = input.status ?? 'draft';
      const rows = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_learning_paths (slug,title_zh,title_en,description_zh,description_en,status,created_by_user_id,published_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,CASE WHEN $6='published' THEN NOW() ELSE NULL END)
        RETURNING id::text AS id
      `, [input.slug, input.titleZh ?? '', input.titleEn ?? '', input.descriptionZh ?? '', input.descriptionEn ?? '', status, actor.userId]);
      id = rows[0].id;
    } else {
      const rows = await platformQuery<{ id: string }>(db, `
        UPDATE platform_learning_paths SET slug=COALESCE($2,slug), title_zh=COALESCE($3,title_zh),
          title_en=COALESCE($4,title_en), description_zh=COALESCE($5,description_zh),
          description_en=COALESCE($6,description_en), status=COALESCE($7,status),
          published_at=CASE WHEN COALESCE($7,status)='published' THEN COALESCE(published_at,NOW()) ELSE published_at END
        WHERE id::text=$1 OR slug=$1 RETURNING id::text AS id
      `, [key, input.slug ?? null, input.titleZh ?? null, input.titleEn ?? null, input.descriptionZh ?? null, input.descriptionEn ?? null, input.status ?? null]);
      if (!rows[0]) notFound('Learning path');
      id = rows[0].id;
    }
    if (input.items) {
      await platformQuery(db, 'DELETE FROM platform_learning_path_items WHERE path_id=$1::uuid', [id]);
      for (let index = 0; index < input.items.length; index += 1) {
        const item = input.items[index];
        await platformQuery(db, `
          INSERT INTO platform_learning_path_items (path_id,ordinal,course_id,lesson_id)
          VALUES ($1::uuid,$2,$3::uuid,$4::uuid)
        `, [id, index, item.courseId, item.lessonId]);
      }
    }
    return { status: creating ? 201 : 200, body: { path: { id } }, resourceType: 'learning_path', resourceId: id };
  });
  return sendMutation(c, result);
}

platformCatalogRoutes.post('/platform/admin/paths', (c) => savePath(c, true));
platformCatalogRoutes.patch('/platform/admin/paths/:id', (c) => savePath(c, false));

platformCatalogRoutes.delete('/platform/admin/paths/:id', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const body = {};
  const result = await withIdempotency(c, actor, `platform.admin.path.archive:${id}`, body, async (db) => {
    const rows = await platformQuery<{ id: string }>(db, `
      UPDATE platform_learning_paths SET status='archived' WHERE id::text=$1 OR slug=$1 RETURNING id::text AS id
    `, [id]);
    if (!rows[0]) notFound('Learning path');
    return { status: 200, body: { path: rows[0] }, resourceType: 'learning_path', resourceId: rows[0].id };
  });
  return sendMutation(c, result);
});
