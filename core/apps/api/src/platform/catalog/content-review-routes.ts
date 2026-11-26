import type { Context, Hono } from 'hono';
import { platformTrialLessonIds } from '@cuberoot/shared/platform';
import { ownerKey } from '../../utils/account.js';
import { requirePlatformActor, requirePlatformAdmin, type PlatformActor } from '../auth.js';
import { enqueuePlatformEvent, platformQuery, sendMutation, withIdempotency, type PlatformDb } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { readJsonObject, enumField, stringField } from '../validation.js';
import { authorizeCourseWrite, requiredParam } from './course-access.js';
import { hashJson } from './course-fields.js';
import { nextContentRevision } from './content-review.js';
import { saveCourseTrialLessonSelection } from './course-routes.js';

interface ContentReview extends Record<string, unknown> {
  id: string; lessonId: string | null; quizId: string | null; baseRevision: number; candidateRevision: number;
  targetStatus: string; status: string; metadata: Record<string, unknown>; submittedBy: number | null;
}

type ReviewDecision = 'approved' | 'rejected' | 'withdrawn';

async function lockReviewCourse(db: PlatformDb, courseId: string) {
  const [course] = await platformQuery<{ revision: number; status: string; presentation: unknown }>(db, `
    SELECT c.current_revision AS revision, c.status, r.presentation
    FROM platform_courses c
    LEFT JOIN platform_course_revisions r ON r.course_id=c.id AND r.revision=c.current_revision
    WHERE c.id=$1::uuid FOR UPDATE OF c
  `, [courseId]);
  return course;
}

async function applyReviewDecision(db: PlatformDb, actor: PlatformActor, courseId: string,
  course: Awaited<ReturnType<typeof lockReviewCourse>>, review: ContentReview, decision: ReviewDecision, note: string) {
  if (decision === 'approved') {
    if (!course || course.status === 'archived') conflict('Archived courses cannot be published by a review');
    const owners = await platformQuery(db, `
      SELECT 1 FROM platform_course_owners o JOIN platform_instructors i ON i.id=o.instructor_id
      WHERE o.course_id=$1::uuid AND o.status='active' AND i.status='active' AND i.user_id=$2
    `, [courseId, review.submittedBy]);
    if (!owners.length) conflict('The submitting instructor no longer manages this course');
    const meta = review.metadata;
    if (review.quizId) {
      const [quiz] = await platformQuery<{ revision: number; status: string }>(db, `
        SELECT q.current_revision AS revision,q.status FROM platform_quizzes q
        JOIN platform_lessons l ON l.id=q.lesson_id
        WHERE q.id=$1::uuid AND l.id=$2::uuid AND l.course_id=$3::uuid AND l.status<>'archived'
        FOR UPDATE OF q
      `, [review.quizId, review.lessonId, courseId]);
      if (!quiz || quiz.status === 'archived' || Number(quiz.revision) !== review.baseRevision) conflict('The quiz changed after submission');
      const next = await nextContentRevision(db, courseId, review.lessonId!, review.quizId);
      const copied = await platformQuery(db, `
        INSERT INTO platform_quiz_revisions (quiz_id,revision,title_zh,title_en,passing_score_bps,max_attempts,
          status,content_hash,created_by_user_id,published_at)
        SELECT quiz_id,$3,title_zh,title_en,passing_score_bps,max_attempts,'published',content_hash,created_by_user_id,NOW()
        FROM platform_quiz_revisions WHERE quiz_id=$1::uuid AND revision=$2 AND status='draft' RETURNING revision
      `, [review.quizId, review.candidateRevision, next]);
      if (!copied.length) conflict('The submitted quiz revision is unavailable');
      await platformQuery(db, `
        INSERT INTO platform_quiz_questions (quiz_id,quiz_revision,ordinal,question_type,prompt_zh,prompt_en,
          choices,answer_key_encrypted,answer_key_version,points)
        SELECT quiz_id,$3,ordinal,question_type,prompt_zh,prompt_en,choices,answer_key_encrypted,answer_key_version,points
        FROM platform_quiz_questions WHERE quiz_id=$1::uuid AND quiz_revision=$2
      `, [review.quizId, review.candidateRevision, next]);
      await platformQuery(db, "UPDATE platform_quizzes SET slug=$2,status='published',current_revision=$3 WHERE id=$1::uuid",
        [review.quizId, meta.slug, next]);
      await enqueuePlatformEvent(db, 'platform.quiz.updated', 'quiz', review.quizId,
        `quiz:${review.quizId}:revision:${next}`, { courseId, lessonId: review.lessonId, quizId: review.quizId, revision: next, status: 'published' });
    } else if (review.lessonId) {
      const lessons = await platformQuery<{ revision: number; status: string; accessScope: string }>(db, `
        SELECT current_revision AS revision,status,access_scope AS "accessScope" FROM platform_lessons WHERE id=$1::uuid AND course_id=$2::uuid FOR UPDATE
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
        UPDATE platform_lessons SET slug=$2,ordinal=$3,access_scope=$4,status='published',current_revision=$5,lesson_type=COALESCE($6,lesson_type) WHERE id=$1::uuid
      `, [review.lessonId, meta.slug, meta.ordinal, meta.accessScopeChanged === false ? lessons[0].accessScope : meta.accessScope, next, meta.lessonType ?? null]);
      await enqueuePlatformEvent(db, 'platform.lesson.updated', 'lesson', review.lessonId,
        `lesson:${review.lessonId}:revision:${next}`, { courseId, lessonId: review.lessonId, revision: next, status: 'published' });
    } else {
      if (Number(course.revision) !== review.baseRevision) conflict('The course changed after submission');
      const next = await nextContentRevision(db, courseId);
      const [candidate] = await platformQuery<{ presentation: Record<string, unknown> } & Record<string, unknown>>(db, `
        SELECT title_zh AS "titleZh", title_en AS "titleEn", summary_zh AS "summaryZh", summary_en AS "summaryEn",
          description_zh AS "descriptionZh", description_en AS "descriptionEn", presentation
        FROM platform_course_revisions WHERE course_id=$1::uuid AND revision=$2 AND status='draft'
      `, [courseId, review.candidateRevision]);
      if (!candidate) conflict('The submitted course revision is unavailable');
      const selection = platformTrialLessonIds(candidate.presentation);
      const baseline = platformTrialLessonIds({ trialLessonIds: meta.trialSelectionBase });
      const historicalSelection = platformTrialLessonIds(course.presentation);
      if (selection !== undefined && (baseline !== undefined || JSON.stringify(selection) !== JSON.stringify(historicalSelection))) {
        await saveCourseTrialLessonSelection(db, courseId, selection, baseline);
      }
      const presentation = { ...candidate.presentation };
      delete presentation.trialLessonIds;
      const contentHash = hashJson({ ...candidate, presentation });
      const copied = await platformQuery(db, `
        INSERT INTO platform_course_revisions (course_id,revision,title_zh,title_en,summary_zh,summary_en,description_zh,description_en,
          cover_media_id,status,content_hash,created_by_user_id,published_by_user_id,published_at,presentation)
        SELECT course_id,$3,title_zh,title_en,summary_zh,summary_en,description_zh,description_en,cover_media_id,'published',
          decode($5, 'hex'),created_by_user_id,$4,NOW(),presentation - 'trialLessonIds' FROM platform_course_revisions
        WHERE course_id=$1::uuid AND revision=$2 AND status='draft' RETURNING revision
      `, [courseId, review.candidateRevision, next, actor.userId, contentHash]);
      if (!copied.length) conflict('The submitted course revision is unavailable');
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

  if (decision !== 'withdrawn' && review.submittedBy != null) {
    const [account] = await platformQuery<{ wcaId: string | null }>(db, 'SELECT wca_id AS "wcaId" FROM app_users WHERE id=$1', [review.submittedBy]);
    const [name] = await platformQuery<{ title: string }>(db, review.quizId
      ? "SELECT COALESCE(NULLIF(title_zh,''),title_en) AS title FROM platform_quiz_revisions WHERE quiz_id=$1::uuid AND revision=$2"
      : review.lessonId
      ? "SELECT COALESCE(NULLIF(title_zh,''),title_en) AS title FROM platform_lesson_revisions WHERE lesson_id=$1::uuid AND revision=$2"
      : "SELECT COALESCE(NULLIF(title_zh,''),title_en) AS title FROM platform_course_revisions WHERE course_id=$1::uuid AND revision=$2",
    [review.quizId ?? review.lessonId ?? courseId, review.candidateRevision]);
    if (account) {
      const subject = review.quizId ? '测验 / Quiz' : review.lessonId ? '课时 / Lesson' : '课程 / Course';
      const outcome = decision === 'approved' ? '审核通过 / Approved' : '审核驳回 / Rejected';
      await platformQuery(db, `
        INSERT INTO notifications (user_key, kind, actor_name, title, excerpt, link, dedupe_key)
        VALUES ($1, 'teaching_message', 'CubeRoot', LEFT($2, 200), $3, $4, $5) ON CONFLICT DO NOTHING
      `, [ownerKey(review.submittedBy, account.wcaId),
        `${subject} · ${outcome}`, [name?.title, note].filter(Boolean).join('\n'),
        `/platform/instructor/courses/${courseId}`, `content-review:${review.id}:${decision}`]);
    }
  }
}

const REVIEW_PROJECTION = `
  id::text, lesson_id::text AS "lessonId", quiz_id::text AS "quizId", base_revision AS "baseRevision", candidate_revision AS "candidateRevision",
  target_status AS "targetStatus", status, metadata, submitted_by_user_id AS "submittedBy"
`;

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
    const course = await lockReviewCourse(db, courseId);
    const reviews = await platformQuery<ContentReview>(db, `
      SELECT ${REVIEW_PROJECTION}
      FROM platform_content_reviews WHERE course_id=$1::uuid AND id::text=$2 FOR UPDATE
    `, [courseId, reviewId]);
    const review = reviews[0];
    if (!review) notFound('Content review');
    if (review.status !== 'pending') conflict('This submission has already been decided or withdrawn');
    await applyReviewDecision(db, actor, courseId, course, review, decision, note);
    return { status: 200, body: { review: { id: review.id, status: decision } }, resourceType: 'course', resourceId: courseId };
  });
  return sendMutation(c, result);
}

async function approveCourseReviews(c: Context) {
  const actor = await requirePlatformAdmin(c);
  const key = requiredParam(c, 'courseId');
  const body = await readJsonObject(c);
  const result = await withIdempotency(c, actor, `platform.content-review.approve-all:${key}`, body, async db => {
    const courseId = await authorizeCourseWrite(db, actor, key);
    const course = await lockReviewCourse(db, courseId);
    const reviews = await platformQuery<ContentReview>(db, `
      SELECT ${REVIEW_PROJECTION} FROM platform_content_reviews
      WHERE course_id=$1::uuid AND status='pending'
      ORDER BY CASE WHEN quiz_id IS NOT NULL THEN 2 WHEN lesson_id IS NOT NULL THEN 1 ELSE 0 END, submitted_at, id FOR UPDATE
    `, [courseId]);
    for (const review of reviews) await applyReviewDecision(db, actor, courseId, course, review, 'approved', '');
    return { status: 200, body: { approvedCount: reviews.length }, resourceType: 'course', resourceId: courseId };
  });
  return sendMutation(c, result);
}

export function registerContentReviewRoutes(platformCatalogRoutes: Hono) {
  platformCatalogRoutes.post('/platform/admin/courses/:courseId/content-reviews/approve-all', approveCourseReviews);
  platformCatalogRoutes.post('/platform/admin/courses/:courseId/content-reviews/:reviewId/decision', c => decideReview(c, true));
  platformCatalogRoutes.post('/platform/instructor/courses/:courseId/content-reviews/:reviewId/withdraw', c => decideReview(c, false));
}
