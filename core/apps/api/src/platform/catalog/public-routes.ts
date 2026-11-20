import { requirePlatformActor } from '../auth.js';
import { platformQuery, platformDb, courseEntitlementPredicate, findCourseReviewEntitlement, type PlatformDb } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { publicCache, privateNoStore } from '../http.js';
import { pagination, resourceId, integerField, positiveIntegerParam } from '../validation.js';
import { courseKey } from './course-access.js';
import { COURSE_PROJECTION } from './course-fields.js';
import { type Hono } from 'hono';

const REVIEW_PAGE_SIZE = 10;
const MAX_REVIEW_PAGE = 10000;
const PUBLIC_COURSE_BY_KEY = `
  FROM platform_courses c
  JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision = c.current_revision
  WHERE (c.id::text = $1 OR c.slug = $1) AND c.status IN ('published', 'unlisted')
`;

async function readCourseReviewPage(db: PlatformDb, courseId: string, page: number) {
  const reviews = await platformQuery(db, `
    SELECT review.id::text, review.rating, review.title, review.body,
      review.created_at AS "createdAt", NULLIF(author.display_name, '') AS "authorName"
    FROM platform_course_reviews review LEFT JOIN app_users author ON author.id = review.user_id
    WHERE review.course_id = $1::uuid AND review.status = 'published'
      AND (review.title <> '' OR review.body <> '')
    ORDER BY review.created_at DESC, review.id DESC LIMIT $2 OFFSET $3
  `, [courseId, REVIEW_PAGE_SIZE + 1, (page - 1) * REVIEW_PAGE_SIZE]);
  return {
    reviews: reviews.slice(0, REVIEW_PAGE_SIZE),
    reviewsHasMore: page < MAX_REVIEW_PAGE && reviews.length > REVIEW_PAGE_SIZE,
  };
}

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
    const reviewPage = positiveIntegerParam(c.req.query('reviewPage') ?? '1', 'reviewPage');
    if (reviewPage > MAX_REVIEW_PAGE) badRequest('reviewPage is out of range');
    const db = platformDb();
    if (c.req.query('reviewsOnly') === '1') {
      const [course] = await platformQuery<{ id: string }>(db, `
        SELECT c.id::text AS id ${PUBLIC_COURSE_BY_KEY}
      `, [key]);
      if (!course) notFound('Course');
      const page = await readCourseReviewPage(db, course.id, reviewPage);
      privateNoStore(c);
      return c.json({ course: { id: course.id, ...page } });
    }
    const actor = c.req.query('includeAccess') === '1' ? await requirePlatformActor(c) : null;
    const rows = await platformQuery<{ id: string } & Record<string, unknown>>(db, `
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
      ${PUBLIC_COURSE_BY_KEY}
    `, [key]);
    if (!rows[0]) notFound('Course');
    const course = rows[0];
    const [summary, reviews, lessonAccess, reviewEntitlement, personalReview] = await Promise.all([
      platformQuery(db, `
        SELECT COUNT(*)::int AS count, AVG(rating)::float8 AS average,
          ARRAY[
            COUNT(*) FILTER (WHERE rating = 1)::int,
            COUNT(*) FILTER (WHERE rating = 2)::int,
            COUNT(*) FILTER (WHERE rating = 3)::int,
            COUNT(*) FILTER (WHERE rating = 4)::int,
            COUNT(*) FILTER (WHERE rating = 5)::int
          ] AS distribution
        FROM platform_course_reviews WHERE course_id = $1::uuid AND status = 'published'
      `, [course.id]),
      readCourseReviewPage(db, course.id, reviewPage),
      actor ? platformQuery(db, `
        SELECT lesson.id::text AS id, progress.status AS status
        FROM platform_lessons lesson
        LEFT JOIN platform_lesson_progress progress ON progress.lesson_id = lesson.id AND progress.user_id = $1
        WHERE lesson.course_id = $2::uuid AND lesson.status = 'published' AND lesson.current_revision IS NOT NULL
          AND (lesson.access_scope = 'public' OR $3::boolean OR ${courseEntitlementPredicate('lesson.course_id', 'lesson.id')})
        ORDER BY (progress.status = 'in_progress') DESC NULLS LAST, progress.updated_at DESC NULLS LAST, lesson.ordinal
      `, [actor.userId, course.id, actor.isAdmin]) : Promise.resolve(null),
      actor ? findCourseReviewEntitlement(db, actor.userId, course.id) : undefined,
      actor ? platformQuery(db, `
        SELECT id::text, rating, title, body
        FROM platform_course_reviews WHERE user_id = $1 AND course_id = $2::uuid
      `, [actor.userId, course.id]) : null,
    ]);
    const result: Record<string, unknown> = { ...course, ...reviews, reviewSummary: summary[0] };
    if (lessonAccess) result.lessonAccess = lessonAccess;
    if (actor) {
      result.canReview = Boolean(reviewEntitlement);
      result.myReview = personalReview?.[0] ?? null;
    }
    // A successful review write is immediately followed by a fresh course read.
    c.header('Cache-Control', 'no-store');
    return c.json({ course: result });
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
    }
    // Trial access can be revoked by the instructor at any time.
    privateNoStore(c);
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
