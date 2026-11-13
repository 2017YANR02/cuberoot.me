import { requirePlatformActor } from '../auth.js';
import { platformQuery, platformDb } from '../db.js';
import { notFound } from '../errors.js';
import { publicCache, privateNoStore } from '../http.js';
import { pagination, resourceId, integerField } from '../validation.js';
import { courseKey } from './course-access.js';
import { COURSE_PROJECTION } from './course-fields.js';
import { type Hono } from 'hono';

export function registerPublicRoutes(platformCatalogRoutes: Hono): void {
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
      ORDER BY CASE WHEN $4='title' THEN COALESCE(NULLIF(r.title_zh,''),r.title_en) END ASC, c.updated_at DESC, c.id
      LIMIT $2 OFFSET $3
    `, [q, pageSize, offset,c.req.query('sort')??'updated']);
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
    const [summary, reviews] = await Promise.all([
      platformQuery(platformDb(), `
        SELECT COUNT(*)::int AS count, AVG(rating)::float8 AS average
        FROM platform_course_reviews WHERE course_id = $1::uuid AND status = 'published'
      `, [rows[0].id]),
      platformQuery(platformDb(), `
        SELECT review.id::text, review.rating, review.title, review.body,
          review.created_at AS "createdAt", NULLIF(author.display_name, '') AS "authorName"
        FROM platform_course_reviews review LEFT JOIN app_users author ON author.id = review.user_id
        WHERE review.course_id = $1::uuid AND review.status = 'published'
          AND (review.title <> '' OR review.body <> '')
        ORDER BY review.created_at DESC, review.id DESC LIMIT 10
      `, [rows[0].id]),
    ]);
    rows[0].reviewSummary = summary[0];
    rows[0].reviews = reviews;
    // A successful review write is immediately followed by a fresh course read.
    c.header('Cache-Control', 'no-store');
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
      const { requireCourseEntitlement } = await import('../db.js');
      await requireCourseEntitlement(db, actor, row.course_id, String(row.id));
      privateNoStore(c);
    } else {
      publicCache(c);
    }
    return c.json({ lesson: row });
  });

  platformCatalogRoutes.get('/platform/teachers/:id/courses', async c => {
    const id = integerField({id:c.req.param('id')},'id',{required:true,min:1})!;
    const rows=await platformQuery(platformDb(),`SELECT ${COURSE_PROJECTION}
      FROM platform_courses c JOIN platform_course_revisions r ON r.course_id=c.id AND r.revision=c.current_revision
      WHERE c.status='published' AND EXISTS(SELECT 1 FROM platform_course_owners o JOIN platform_instructors i ON i.id=o.instructor_id WHERE o.course_id=c.id AND o.status='active' AND i.status='active' AND i.teacher_entry_id=$1)
      ORDER BY c.published_at DESC`,[id]);
    publicCache(c,rows.length>0);return c.json({items:rows});
  });
}
