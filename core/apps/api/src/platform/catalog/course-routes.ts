import { requirePlatformAdmin, requirePlatformActor } from '../auth.js';
import {
  platformDb,
  requireInstructor,
  platformQuery,
  withIdempotency,
  enqueuePlatformEvent,
  isPostgresConflict,
  sendMutation,
} from '../db.js';
import { notFound, badRequest, conflict } from '../errors.js';
import { privateNoStore } from '../http.js';
import { pagination, readJsonObject } from '../validation.js';
import { requiredParam, authorizeCourseWrite } from './course-access.js';
import { COURSE_PROJECTION, courseFields, requireBilingualTitle, hashJson } from './course-fields.js';
import { type Context, type Hono } from 'hono';

async function listManagedCourses(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const { page, pageSize, offset } = pagination(c, 100);
  const db = platformDb();
  const q=c.req.query('q')?.trim().slice(0,200)??'';
  let instructorId: string | null = null;
  if (!admin) instructorId = await requireInstructor(db, actor);
  const id = c.req.param('id') ? requiredParam(c, 'id') : null;
  const rows = await platformQuery(db, `
    SELECT ${COURSE_PROJECTION}, COUNT(*) OVER()::int AS "resultTotal",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l.id::text, 'slug', l.slug,
        'ordinal', l.ordinal, 'status', l.status, 'accessScope', l.access_scope,
        'titleZh', lr.title_zh, 'titleEn', lr.title_en,
        'coverMediaId', lr.cover_media_id::text,
        'driveVideo', (SELECT media.metadata->>'driveNodeId' FROM platform_media_assets media WHERE media.id = lr.media_id)) ORDER BY l.ordinal)
      FROM platform_lessons l LEFT JOIN platform_lesson_revisions lr
        ON lr.lesson_id = l.id AND lr.revision = l.current_revision WHERE l.course_id = c.id), '[]'::jsonb) AS lessons
    FROM platform_courses c
    LEFT JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision = c.current_revision
    WHERE ($1::uuid IS NULL OR EXISTS (
      SELECT 1 FROM platform_course_owners co WHERE co.course_id = c.id AND co.instructor_id = $1::uuid AND co.status = 'active'
    )) AND ($2::text IS NULL OR c.id::text = $2 OR c.slug = $2)
    AND ($5='' OR r.title_zh ILIKE '%'||$5||'%' OR r.title_en ILIKE '%'||$5||'%')
    ORDER BY CASE WHEN $6='title' THEN COALESCE(NULLIF(r.title_zh,''),r.title_en) END ASC, c.updated_at DESC, c.id LIMIT $3 OFFSET $4
  `, [instructorId, id, pageSize, offset,q,c.req.query('sort')??'updated']);
  if (id && !rows[0]) notFound('Course');
  privateNoStore(c);
  return c.json(id ? { course: rows[0] } : { courses: rows, page, pageSize, total:Number(rows[0]?.resultTotal??0) });
}

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
          CASE WHEN $2::varchar IN ('published', 'unlisted') THEN NOW() ELSE NULL END,
          CASE WHEN $2::varchar = 'archived' THEN NOW() ELSE NULL END)
        RETURNING id::text AS id, slug
      `, [input.slug, status, input.baseAmountMinor ?? 0, input.memberAmountMinor ?? null,
        input.currency ?? 'CNY', input.enrollmentMode ?? 'purchase', actor.userId]);
      const row = rows[0];
      const revision = {
        titleZh: input.titleZh ?? '', titleEn: input.titleEn ?? '', summaryZh: input.summaryZh ?? '',
        summaryEn: input.summaryEn ?? '', descriptionZh: input.descriptionZh ?? '', descriptionEn: input.descriptionEn ?? '', presentation: input.presentation ?? {},
      };
      await platformQuery(db, `
        INSERT INTO platform_course_revisions (
          course_id, revision, title_zh, title_en, summary_zh, summary_en,
          description_zh, description_en, status, content_hash,
          created_by_user_id, published_by_user_id, published_at, presentation
        ) VALUES ($1::uuid, 1, $2, $3, $4, $5, $6, $7, $8, decode($9, 'hex'), $10,
          CASE WHEN $8::varchar = 'published' THEN $10::bigint ELSE NULL END,
          CASE WHEN $8::varchar = 'published' THEN NOW() ELSE NULL END, $11::jsonb)
      `, [row.id, revision.titleZh, revision.titleEn, revision.summaryZh, revision.summaryEn,
        revision.descriptionZh, revision.descriptionEn, revisionStatus, hashJson(revision), actor.userId, revision.presentation]);
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
        r.description_zh AS "descriptionZh", r.description_en AS "descriptionEn", r.presentation
      FROM platform_courses c JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision = c.current_revision
      WHERE c.id = $1::uuid FOR UPDATE
    `, [id]);
    const old = existing[0];
    if (!old) notFound('Course');
    const revision = {
      titleZh: input.titleZh ?? String(old.titleZh), titleEn: input.titleEn ?? String(old.titleEn),
      summaryZh: input.summaryZh ?? String(old.summaryZh), summaryEn: input.summaryEn ?? String(old.summaryEn),
      descriptionZh: input.descriptionZh ?? String(old.descriptionZh), descriptionEn: input.descriptionEn ?? String(old.descriptionEn), presentation: input.presentation ?? old.presentation ?? {},
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
        status, content_hash, created_by_user_id, published_by_user_id, published_at, presentation
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, decode($10, 'hex'), $11,
        CASE WHEN $9::varchar = 'published' THEN $11::bigint ELSE NULL END, CASE WHEN $9::varchar = 'published' THEN NOW() ELSE NULL END, $12::jsonb)
    `, [id, nextRevision, revision.titleZh, revision.titleEn, revision.summaryZh, revision.summaryEn,
      revision.descriptionZh, revision.descriptionEn, revisionStatus, hashJson(revision), actor.userId, revision.presentation]);
    await platformQuery(db, `
      UPDATE platform_courses SET slug = $2, status = $3, current_revision = $4,
        base_amount_minor = $5, member_amount_minor = $6, currency = $7, enrollment_mode = $8,
        published_at = CASE WHEN $3::varchar IN ('published', 'unlisted') THEN COALESCE(published_at, NOW()) ELSE published_at END,
        archived_at = CASE WHEN $3::varchar = 'archived' THEN COALESCE(archived_at, NOW()) ELSE NULL END
      WHERE id = $1::uuid
    `, [id, input.slug ?? old.slug, status, nextRevision, baseAmountMinor, memberAmountMinor,
      input.currency ?? old.currency, input.enrollmentMode ?? old.enrollmentMode]);
    await enqueuePlatformEvent(db, 'platform.course.updated', 'course', id,
      `course:${id}:revision:${nextRevision}`, { courseId: id, revision: nextRevision, status });
    return { status: 200, body: { course: { id, revision: nextRevision, status } }, resourceType: 'course', resourceId: id };
  });
  return sendMutation(c, result);
}

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

export function registerCourseRoutes(platformCatalogRoutes: Hono): void {
  platformCatalogRoutes.get('/platform/instructor/courses', (c) => listManagedCourses(c, false));

  platformCatalogRoutes.get('/platform/instructor/courses/:id', (c) => listManagedCourses(c, false));

  platformCatalogRoutes.get('/platform/admin/courses', (c) => listManagedCourses(c, true));

  platformCatalogRoutes.get('/platform/admin/courses/:id', (c) => listManagedCourses(c, true));

  platformCatalogRoutes.post('/platform/instructor/courses', (c) => createCourse(c, false));

  platformCatalogRoutes.patch('/platform/instructor/courses/:id', (c) => updateCourse(c, false));

  platformCatalogRoutes.post('/platform/admin/courses', (c) => createCourse(c, true));

  platformCatalogRoutes.patch('/platform/admin/courses/:id', (c) => updateCourse(c, true));

  platformCatalogRoutes.delete('/platform/instructor/courses/:id', (c) => archiveCourse(c, false));

  platformCatalogRoutes.delete('/platform/admin/courses/:id', (c) => archiveCourse(c, true));
}
