import type { Context, Hono } from 'hono';
import { platformTrialLessonIds } from '@cuberoot/shared/platform';
import { requirePlatformActor, requirePlatformAdmin } from '../auth.js';
import { enqueuePlatformEvent, platformQuery, sendMutation, withIdempotency } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { readJsonObject, enumField, stringField } from '../validation.js';
import { authorizeCourseWrite, requiredParam } from './course-access.js';
import { nextContentRevision } from './content-review.js';
import { saveCourseTrialLessonSelection } from './course-routes.js';

interface ContentReview extends Record<string, unknown> {
  id: string; lessonId: string | null; baseRevision: number; candidateRevision: number;
  targetStatus: string; status: string; metadata: Record<string, unknown>; submittedBy: number | null;
}

async function decideReview(c: Context, admin: boolean) {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const key = requiredParam(c, 'courseId');
  const reviewId = requiredParam(c, 'reviewId');
  const body = await readJsonObject(c);
  const decision = admin ? enumField(body, 'decision', ['approved', 'rejected'] as const) : 'withdrawn';
  if (!decision) badRequest('Review decision is required');
  const note = stringField(body, 'note', { max: 4000 }) ?? '';
  if (decision === 'rejected' && !note) badRequest('A rejection reason is required');
  const result = await withIdempotency(c, actor, `platform.content-review.${decision}:${reviewId}`, body, async db => {
    const courseId = await authorizeCourseWrite(db, actor, key);
    const courses = await platformQuery<{ revision: number; status: string }>(db, `
      SELECT current_revision AS revision,status FROM platform_courses WHERE id=$1::uuid FOR UPDATE
    `, [courseId]);
    const course = courses[0];
    const reviews = await platformQuery<ContentReview>(db, `
      SELECT id::text, lesson_id::text AS "lessonId", base_revision AS "baseRevision", candidate_revision AS "candidateRevision",
        target_status AS "targetStatus", status, metadata, submitted_by_user_id AS "submittedBy"
      FROM platform_content_reviews WHERE course_id=$1::uuid AND id::text=$2 FOR UPDATE
    `, [courseId, reviewId]);
    const review = reviews[0];
    if (!review) notFound('Content review');
    if (review.status !== 'pending') conflict('This submission has already been decided or withdrawn');
    if (decision === 'approved') {
      if (!course || course.status === 'archived') conflict('Archived courses cannot be published by a review');
      const owners = await platformQuery(db, `
        SELECT 1 FROM platform_course_owners o JOIN platform_instructors i ON i.id=o.instructor_id
        WHERE o.course_id=$1::uuid AND o.status='active' AND i.status='active' AND i.user_id=$2
      `, [courseId, review.submittedBy]);
      if (!owners.length) conflict('The submitting instructor no longer manages this course');
      const meta = review.metadata;
      if (review.lessonId) {
        const lessons = await platformQuery<{ revision: number; status: string }>(db, `
          SELECT current_revision AS revision,status FROM platform_lessons WHERE id=$1::uuid AND course_id=$2::uuid FOR UPDATE
        `, [review.lessonId, courseId]);
        if (!lessons[0] || lessons[0].status === 'archived' || Number(lessons[0].revision) !== review.baseRevision) conflict('The lesson changed after submission');
        const next = await nextContentRevision(db, courseId, review.lessonId);
        const copied = await platformQuery(db, `
          INSERT INTO platform_lesson_revisions (lesson_id, revision, title_zh, title_en, body_zh, body_en, media_id, cover_media_id,
            duration_seconds, status, content_hash, created_by_user_id, published_by_user_id, published_at)
          SELECT lesson_id,$3,title_zh,title_en,body_zh,body_en,media_id,cover_media_id,duration_seconds,'published',content_hash,created_by_user_id,$4,NOW()
          FROM platform_lesson_revisions WHERE lesson_id=$1::uuid AND revision=$2 AND status='draft' RETURNING revision
        `, [review.lessonId, review.candidateRevision, next, actor.userId]);
        if (!copied.length) conflict('The submitted lesson revision is unavailable');
        await platformQuery(db, `
          UPDATE platform_lessons SET slug=$2,ordinal=$3,access_scope=$4,status='published',current_revision=$5 WHERE id=$1::uuid
        `, [review.lessonId, meta.slug, meta.ordinal, meta.accessScope, next]);
      } else {
        if (Number(course.revision) !== review.baseRevision) conflict('The course changed after submission');
        const next = await nextContentRevision(db, courseId);
        const copied = await platformQuery<{ presentation: unknown }>(db, `
          INSERT INTO platform_course_revisions (course_id,revision,title_zh,title_en,summary_zh,summary_en,description_zh,description_en,
            cover_media_id,status,content_hash,created_by_user_id,published_by_user_id,published_at,presentation)
          SELECT course_id,$3,title_zh,title_en,summary_zh,summary_en,description_zh,description_en,cover_media_id,'published',
            content_hash,created_by_user_id,$4,NOW(),presentation FROM platform_course_revisions
          WHERE course_id=$1::uuid AND revision=$2 AND status='draft' RETURNING presentation
        `, [courseId, review.candidateRevision, next, actor.userId]);
        if (!copied[0]) conflict('The submitted course revision is unavailable');
        const selection = platformTrialLessonIds(copied[0].presentation);
        if (selection !== undefined) await saveCourseTrialLessonSelection(db, courseId, selection);
        await platformQuery(db, `
          UPDATE platform_courses SET slug=$2,status=$3,current_revision=$4,base_amount_minor=$5,member_amount_minor=$6,
            currency=$7,enrollment_mode=$8,published_at=COALESCE(published_at,NOW()),archived_at=NULL WHERE id=$1::uuid
        `, [courseId, meta.slug, review.targetStatus, next, meta.baseAmountMinor, meta.memberAmountMinor, meta.currency, meta.enrollmentMode]);
        await enqueuePlatformEvent(db, 'platform.course.updated', 'course', courseId,
          `course:${courseId}:revision:${next}`, { courseId, revision: next, status: review.targetStatus });
      }
    }
    await platformQuery(db, `
      UPDATE platform_content_reviews SET status=$2, decision_note=$3, decided_by_user_id=$4, decided_at=NOW() WHERE id=$1::uuid
    `, [review.id, decision, note || null, actor.userId]);
    return { status: 200, body: { review: { id: review.id, status: decision } }, resourceType: 'course', resourceId: courseId };
  });
  return sendMutation(c, result);
}

export function registerContentReviewRoutes(platformCatalogRoutes: Hono) {
  platformCatalogRoutes.post('/platform/admin/courses/:courseId/content-reviews/:reviewId/decision', c => decideReview(c, true));
  platformCatalogRoutes.post('/platform/instructor/courses/:courseId/content-reviews/:reviewId/withdraw', c => decideReview(c, false));
}
