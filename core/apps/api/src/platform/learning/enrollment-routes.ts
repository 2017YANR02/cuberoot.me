import { requirePlatformActor } from '../auth.js';
import {
  platformQuery,
  platformDb,
  withIdempotency,
  requireCourseEntitlement,
  enqueuePlatformEvent,
  sendMutation,
} from '../db.js';
import { notFound, conflict, PlatformApiError } from '../errors.js';
import { privateNoStore } from '../http.js';
import { pagination, resourceId, readJsonObject } from '../validation.js';
import { type Hono } from 'hono';

export function registerEnrollmentRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.get('/entitlements', async (c) => {
    const actor = await requirePlatformActor(c);
    const rows = await platformQuery(platformDb(), `
      SELECT e.id::text, e.course_id::text AS "courseId", e.status,
             e.valid_from AS "validFrom", e.valid_until AS "validUntil",
             COALESCE(NULLIF(cr.title_zh, ''), cr.title_en) AS title,
             cr.title_zh AS "titleZh", cr.title_en AS "titleEn"
      FROM platform_course_entitlements e
      JOIN platform_courses course ON course.id = e.course_id
      LEFT JOIN platform_course_revisions cr
        ON cr.course_id = course.id AND cr.revision = course.current_revision
      WHERE e.user_id = $1
      ORDER BY e.updated_at DESC, e.id
    `, [actor.userId]);
    privateNoStore(c);
    return c.json({ items: rows });
  });

  platformLearningRoutes.get('/me/courses', async (c) => {
    const actor = await requirePlatformActor(c);
    const {page,pageSize,offset}=pagination(c);
    const paged=c.req.query('page')!==undefined;
    const rows = await platformQuery(platformDb(), `
      SELECT COUNT(*) OVER()::int AS "resultTotal", e.course_id::text AS id, course.slug, e.status,
             COALESCE(NULLIF(cr.title_zh, ''), cr.title_en) AS title,
             cr.title_zh AS "titleZh", cr.title_en AS "titleEn", cr.presentation,
             COUNT(lesson.id)::int AS "totalLessons", COUNT(lesson.id) FILTER (WHERE progress.status = 'completed')::int AS "completedLessons",
             (SELECT l.id::text FROM platform_lessons l LEFT JOIN platform_lesson_progress p ON p.lesson_id=l.id AND p.user_id=e.user_id
               WHERE l.course_id=e.course_id AND l.status='published'
               ORDER BY (p.status='in_progress') DESC NULLS LAST, p.updated_at DESC NULLS LAST, l.ordinal LIMIT 1) AS "continueLessonId",
             COALESCE(ROUND(AVG(COALESCE(progress.progress_bps, 0)))::integer, 0) AS "progressBps"
      FROM platform_course_entitlements e
      JOIN platform_courses course ON course.id = e.course_id
      LEFT JOIN platform_course_revisions cr
        ON cr.course_id = course.id AND cr.revision = course.current_revision
      LEFT JOIN platform_lessons lesson ON lesson.course_id = course.id AND lesson.status = 'published'
      LEFT JOIN platform_lesson_progress progress
        ON progress.lesson_id = lesson.id AND progress.user_id = e.user_id
      WHERE e.user_id = $1 AND ($4::text IS NULL OR ((e.course_id::text=$4 OR course.slug=$4) AND e.status='active' AND e.valid_from<=NOW() AND (e.valid_until IS NULL OR e.valid_until>NOW())))
      GROUP BY e.course_id, e.user_id, course.slug, e.status, cr.title_zh, cr.title_en, cr.presentation
      ORDER BY MAX(e.updated_at) DESC, e.course_id LIMIT $2 OFFSET $3
    `, [actor.userId,paged?pageSize:null,paged?offset:0,c.req.query('courseId')??null]);
    privateNoStore(c);
    return c.json({items:rows,page,pageSize,total:Number(rows[0]?.resultTotal??0)});
  });

  platformLearningRoutes.post('/courses/:courseId/enrollment', async (c) => {
    const actor = await requirePlatformActor(c);
    const courseId = resourceId(c.req.param('courseId'), 'courseId');
    const body = await readJsonObject(c);
    const result = await withIdempotency(c, actor, `learning.enrollment:${courseId}`, body, async (db) => {
      const courses = await platformQuery<{ enrollment_mode: string }>(db, `
        SELECT enrollment_mode FROM platform_courses
        WHERE id = $1::uuid AND status IN ('published', 'unlisted') FOR SHARE
      `, [courseId]);
      const course = courses[0];
      if (!course) notFound('Course');
      if (course.enrollment_mode === 'purchase') {
        conflict('This course requires an order');
      }
      if (course.enrollment_mode === 'invite') {
        conflict('This course requires an invitation code');
      }
      if (course.enrollment_mode !== 'free') {
        throw new PlatformApiError('FORBIDDEN', 403, 'This course requires an administrator grant');
      }
      const existing = await platformQuery<{ id: string; status: string }>(db, `
        SELECT id::text, status FROM platform_course_entitlements
        WHERE user_id = $1 AND course_id = $2::uuid FOR UPDATE
      `, [actor.userId, courseId]);
      if (existing[0]?.status === 'active') {
        try {
          await requireCourseEntitlement(db, actor, courseId);
          return { status: 200, body: { id: existing[0].id, courseId, status: 'active' }, resourceType: 'course_entitlement', resourceId: existing[0].id };
        } catch (error) {
          if (!(error instanceof PlatformApiError) || error.code !== 'FORBIDDEN') throw error;
        }
      }
      const rows = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_course_entitlements (user_id, course_id, status, valid_from, valid_until)
        VALUES ($1, $2::uuid, 'active', NOW(), NULL)
        ON CONFLICT (user_id, course_id) DO UPDATE
          SET status = 'active', valid_from = NOW(), valid_until = NULL
        RETURNING id::text
      `, [actor.userId, courseId]);
      await platformQuery(db, `
        INSERT INTO platform_entitlement_ledger (
          entitlement_id, entry_type, delta_access, valid_from, reason, actor_user_id
        ) VALUES ($1::uuid, 'grant', 1, NOW(), 'free course self-enrollment', $2)
      `, [rows[0].id, actor.userId]);
      await enqueuePlatformEvent(db, 'learning.course_enrolled', 'course_entitlement', rows[0].id,
        `learning.enrollment:${rows[0].id}:${Date.now()}`, { courseId });
      return { status: 201, body: { id: rows[0].id, courseId, status: 'active' }, resourceType: 'course_entitlement', resourceId: rows[0].id };
    });
    return sendMutation(c, result);
  });
}
