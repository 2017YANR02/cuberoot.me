import { requirePlatformAdmin, requirePlatformActor } from '../auth.js';
import {
  platformDb,
  requireInstructor,
  platformQuery,
  withIdempotency,
  enqueuePlatformEvent,
  isPostgresConflict,
  sendMutation,
  type PlatformDb,
} from '../db.js';
import { isPlatformIntroductionLesson, platformTrialLessonIds } from '@cuberoot/shared/platform';
import { notFound, badRequest, conflict } from '../errors.js';
import { privateNoStore } from '../http.js';
import { booleanField, pagination, positiveIntegerParam, readJsonObject } from '../validation.js';
import { requiredParam, authorizeCourseWrite } from './course-access.js';
import { COURSE_PRESENTATION, courseProjection, courseFields, requireBilingualTitle, hashJson } from './course-fields.js';
import { requiresContentReview, contentReviewIntent, nextContentRevision, submitContentReview, withdrawPendingContentReview, assertNoPendingContentReview } from './content-review.js';
import { type Context, type Hono } from 'hono';

async function listManagedCourses(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const { page, pageSize, offset } = pagination(c, 100);
  const db = platformDb();
  const q=c.req.query('q')?.trim().slice(0,200)??'';
  let instructorId: string | null = null;
  if (!admin) instructorId = await requireInstructor(db, actor);
  const pendingOnly = admin && c.req.query('pending') === '1';
  const id = c.req.param('id') ? requiredParam(c, 'id') : null;
  const rows = await platformQuery(db, `
    SELECT ${courseProjection(`CASE WHEN review.status IN ('pending','rejected','withdrawn') THEN ${COURSE_PRESENTATION}
      ELSE ${COURSE_PRESENTATION} - 'trialLessonIds' END`)}, COUNT(*) OVER()::int AS "resultTotal",
      (SELECT COUNT(*)::int FROM platform_content_reviews qr
        WHERE qr.course_id=c.id AND qr.status='pending' AND qr.quiz_id IS NOT NULL) AS "pendingQuizCount",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', q.id::text, 'lessonId', q.lesson_id::text,
        'titleZh', qv.title_zh, 'titleEn', qv.title_en) ORDER BY qr.submitted_at, qr.id)
        FROM platform_content_reviews qr JOIN platform_quizzes q ON q.id=qr.quiz_id
        JOIN platform_quiz_revisions qv ON qv.quiz_id=q.id AND qv.revision=qr.candidate_revision
        WHERE qr.course_id=c.id AND qr.status='pending' AND $2::text IS NOT NULL), '[]'::jsonb) AS "pendingQuizzes",
      review.id::text AS "reviewId", review.status AS "reviewStatus", review.decision_note AS "reviewNote",
      CASE WHEN $2::text IS NOT NULL AND live.status='published' AND review.id IS NOT NULL THEN jsonb_build_object(
        'titleZh', live.title_zh, 'titleEn', live.title_en, 'summaryZh', live.summary_zh, 'summaryEn', live.summary_en,
        'descriptionZh', live.description_zh, 'descriptionEn', live.description_en, 'presentation', live.presentation,
        'status', c.status, 'baseAmountMinor', c.base_amount_minor, 'memberAmountMinor', c.member_amount_minor,
        'currency', c.currency, 'enrollmentMode', c.enrollment_mode
      ) END AS "reviewBase",
      review.target_status AS "reviewTargetStatus", review.metadata AS "reviewMetadata", review.submitted_at AS "reviewSubmittedAt",
      (SELECT display_name_snapshot FROM platform_instructors WHERE user_id=review.submitted_by_user_id) AS "reviewSubmittedBy",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l.id::text, 'slug', l.slug,
        'ordinal', l.ordinal, 'status', l.status, 'liveAccessScope', l.access_scope,
        'accessScope', CASE WHEN lreview.status IN ('pending','rejected','withdrawn') THEN COALESCE(lreview.metadata->>'accessScope', l.access_scope) ELSE l.access_scope END,
        'lessonType', CASE WHEN lreview.status IN ('pending','rejected','withdrawn') THEN COALESCE(lreview.metadata->>'lessonType', l.lesson_type) ELSE l.lesson_type END,
        'liveSection', jsonb_build_object('lessonType', l.lesson_type, 'slug', l.slug, 'titleZh', llive.title_zh, 'titleEn', llive.title_en),
        'mediaId', lr.media_id::text, 'durationSeconds', lr.duration_seconds,
        'titleZh', lr.title_zh, 'titleEn', lr.title_en,
        'coverMediaId', lr.cover_media_id::text, 'bodyZh', CASE WHEN $2::text IS NOT NULL THEN lr.body_zh END,
        'bodyEn', CASE WHEN $2::text IS NOT NULL THEN lr.body_en END,
        'reviewId', lreview.id::text, 'reviewStatus', lreview.status, 'reviewNote', lreview.decision_note,
        'reviewBase', CASE WHEN $2::text IS NOT NULL AND llive.status='published' AND lreview.id IS NOT NULL THEN jsonb_build_object(
          'titleZh', llive.title_zh, 'titleEn', llive.title_en, 'bodyZh', llive.body_zh, 'bodyEn', llive.body_en,
          'mediaId', llive.media_id::text, 'coverMediaId', llive.cover_media_id::text,
          'status', l.status, 'accessScope', l.access_scope, 'lessonType', l.lesson_type
        ) END, 'reviewMetadata', lreview.metadata, 'reviewTargetStatus', lreview.target_status, 'reviewSubmittedAt', lreview.submitted_at,
        'reviewSubmittedBy', (SELECT display_name_snapshot FROM platform_instructors WHERE user_id=lreview.submitted_by_user_id),
        'driveVideo', (SELECT media.metadata->>'driveNodeId' FROM platform_media_assets media WHERE media.id = lr.media_id)) ORDER BY l.ordinal)
      FROM platform_lessons l LEFT JOIN LATERAL (
        SELECT * FROM platform_content_reviews WHERE lesson_id=l.id AND quiz_id IS NULL AND base_revision=l.current_revision AND l.status<>'archived' ORDER BY submitted_at DESC, id DESC LIMIT 1
      ) lreview ON true
      LEFT JOIN platform_lesson_revisions lr ON lr.lesson_id = l.id AND lr.revision =
        CASE WHEN lreview.status IN ('pending','rejected','withdrawn') THEN lreview.candidate_revision ELSE l.current_revision END
      LEFT JOIN platform_lesson_revisions llive ON llive.lesson_id=l.id AND llive.revision=l.current_revision
      WHERE l.course_id = c.id), '[]'::jsonb) AS lessons
    FROM platform_courses c
    LEFT JOIN LATERAL (
      SELECT * FROM platform_content_reviews WHERE course_id=c.id AND lesson_id IS NULL AND base_revision=c.current_revision AND c.status<>'archived' ORDER BY submitted_at DESC, id DESC LIMIT 1
    ) review ON true
    LEFT JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision =
      CASE WHEN review.status IN ('pending','rejected','withdrawn') THEN review.candidate_revision ELSE c.current_revision END
    LEFT JOIN platform_course_revisions live ON live.course_id=c.id AND live.revision=c.current_revision
    WHERE ($1::uuid IS NULL OR EXISTS (
      SELECT 1 FROM platform_course_owners co WHERE co.course_id = c.id AND co.instructor_id = $1::uuid AND co.status = 'active'
    )) AND ($2::text IS NULL OR c.id::text = $2 OR c.slug = $2)
    AND ($5='' OR r.title_zh ILIKE '%'||$5||'%' OR r.title_en ILIKE '%'||$5||'%')
    AND (NOT $7::boolean OR EXISTS (
      SELECT 1 FROM platform_content_reviews pending WHERE pending.course_id=c.id AND pending.status='pending'
    ))
    ORDER BY CASE WHEN $1::uuid IS NULL AND (review.status='pending' OR EXISTS (SELECT 1 FROM platform_content_reviews pending WHERE pending.course_id=c.id AND pending.status='pending')) THEN 0 ELSE 1 END,
      CASE WHEN $6='title' THEN COALESCE(NULLIF(r.title_zh,''),r.title_en) END ASC, c.updated_at DESC, c.id LIMIT $3 OFFSET $4
  `, [instructorId, id, pageSize, offset,q,c.req.query('sort')??'updated', pendingOnly]);
  if (id && !rows[0]) notFound('Course');
  if (admin && id && rows[0]) {
    const moderationPage = positiveIntegerParam(c.req.query('moderationPage') ?? '1', 'moderationPage');
    if (moderationPage > 10000) badRequest('moderationPage is out of range');
    const reviews = await platformQuery(db, `
      SELECT review.id::text, review.rating, review.title, review.body, review.status,
        review.moderation_note AS "moderationNote", author.display_name AS "authorName"
      FROM platform_course_reviews review JOIN app_users author ON author.id=review.user_id
      WHERE review.course_id=$1::uuid AND review.status IN ('published', 'hidden')
      ORDER BY review.created_at DESC, review.id DESC LIMIT 21 OFFSET $2
    `, [rows[0].id, (moderationPage - 1) * 20]);
    rows[0].reviewsForModeration = reviews.slice(0, 20);
    rows[0].reviewModerationHasMore = reviews.length > 20;
  }
  privateNoStore(c);
  return c.json(id ? { course: rows[0] } : { courses: rows, page, pageSize, total:Number(rows[0]?.resultTotal??0) });
}

async function createCourse(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const input = courseFields(contentReviewIntent(body, admin), true);
  if (platformTrialLessonIds(input.presentation)?.length) badRequest('Select trial lessons after creating the course');
  const title = requireBilingualTitle(input.titleZh, input.titleEn);
  if (input.presentation) delete input.presentation.trialLessonIds;
  const requestedStatus = input.status ?? 'draft';
  const reviewRequired = requiresContentReview(admin, requestedStatus);
  const status = reviewRequired ? 'draft' : requestedStatus;
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
        ...title, summaryZh: input.summaryZh ?? '',
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
      if (reviewRequired) await submitContentReview(db, {
        courseId: row.id, baseRevision: 1, candidateRevision: 1, targetStatus: requestedStatus, userId: actor.userId,
        metadata: { slug: row.slug, baseAmountMinor: input.baseAmountMinor ?? 0, memberAmountMinor: input.memberAmountMinor ?? null,
          currency: input.currency ?? 'CNY', enrollmentMode: input.enrollmentMode ?? 'purchase' },
      });
      await enqueuePlatformEvent(db, 'platform.course.created', 'course', row.id,
        `course:${row.id}:created`, { courseId: row.id, status });
      return { status: 201, body: { course: { ...row, status, reviewStatus: reviewRequired ? 'pending' : null } }, resourceType: 'course', resourceId: row.id };
    } catch (error) {
      if (isPostgresConflict(error)) conflict('Course data conflicts with an existing record');
      throw error;
    }
  });
  return sendMutation(c, result);
}

async function courseTrialLessons(db: PlatformDb, courseId: string) {
  const lessons = await platformQuery<{ id: string; accessScope: string } & Record<string, unknown>>(db, `
    SELECT l.id::text AS id, l.slug, l.lesson_type AS "lessonType", l.access_scope AS "accessScope",
      r.title_zh AS "titleZh", r.title_en AS "titleEn"
    FROM platform_lessons l JOIN platform_lesson_revisions r ON r.lesson_id = l.id AND r.revision = l.current_revision
    WHERE l.course_id = $1::uuid AND l.status <> 'archived' FOR UPDATE OF l
  `, [courseId]);
  return lessons.filter(lesson => !isPlatformIntroductionLesson(lesson));
}

/** Apply deliberate selection changes under the course write lock. */
export async function saveCourseTrialLessonSelection(db: PlatformDb, courseId: string, selectedIds: readonly string[],
  baseline?: readonly string[]): Promise<void> {
  const eligible = await courseTrialLessons(db, courseId);
  const selected = new Set(selectedIds);
  const eligibleIds = new Set(eligible.map(lesson => lesson.id));
  if (!baseline && selectedIds.some(id => !eligibleIds.has(id))) badRequest('Select available lessons in this course');
  const before = baseline && new Set(baseline);
  const affected = eligible.filter(lesson => !before || before.has(lesson.id) !== selected.has(lesson.id)).map(lesson => lesson.id);
  if (!affected.length) return;
  await platformQuery(db, `
    UPDATE platform_lessons SET access_scope = CASE WHEN id::text = ANY($2::text[]) THEN 'public' ELSE 'entitled' END
    WHERE course_id = $1::uuid AND id::text = ANY($3::text[])
      AND access_scope IS DISTINCT FROM CASE WHEN id::text = ANY($2::text[]) THEN 'public' ELSE 'entitled' END
  `, [courseId, selectedIds, affected]);
}

async function updateCourse(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const key = requiredParam(c, 'id');
  const body = await readJsonObject(c);
  const input = courseFields(contentReviewIntent(body, admin), false);
  const result = await withIdempotency(c, actor, `platform.${admin ? 'admin' : 'instructor'}.course.update:${key}`, body, async (db) => {
    const id = await authorizeCourseWrite(db, actor, key);
    const existing = await platformQuery<Record<string, unknown>>(db, `
      SELECT c.slug, c.status, c.base_amount_minor AS "baseAmountMinor", c.member_amount_minor AS "memberAmountMinor",
        c.currency, c.enrollment_mode AS "enrollmentMode", c.current_revision AS "currentRevision",
        r.title_zh AS "titleZh", r.title_en AS "titleEn", r.summary_zh AS "summaryZh", r.summary_en AS "summaryEn",
        r.description_zh AS "descriptionZh", r.description_en AS "descriptionEn", r.presentation,
        live.presentation AS "livePresentation", review.status AS "editingReviewStatus",
        CASE WHEN review.status IN ('rejected','withdrawn') THEN review.metadata END AS "candidateMetadata"
      FROM platform_courses c
      JOIN platform_course_revisions live ON live.course_id=c.id AND live.revision=c.current_revision
      LEFT JOIN LATERAL (SELECT candidate_revision,status,metadata FROM platform_content_reviews WHERE course_id=c.id AND lesson_id IS NULL AND base_revision=c.current_revision ORDER BY submitted_at DESC,id DESC LIMIT 1) review ON true
      JOIN platform_course_revisions r ON r.course_id=c.id AND r.revision=CASE WHEN review.status IN ('rejected','withdrawn') AND c.status<>'archived' THEN review.candidate_revision ELSE c.current_revision END
      WHERE c.id = $1::uuid FOR UPDATE OF c
    `, [id]);
    const current = existing[0];
    if (!current) notFound('Course');
    const old = { ...current, ...(current.status !== 'archived' && current.candidateMetadata && typeof current.candidateMetadata === 'object' ? current.candidateMetadata : {}) };
    await assertNoPendingContentReview(db, id, null);
    const status = input.status ?? String(old.status);
    const reviewRequired = requiresContentReview(admin, status);
    const historicalSelection = platformTrialLessonIds(old.livePresentation);
    const editingCandidate = old.status !== 'archived' && ['rejected','withdrawn'].includes(String(old.editingReviewStatus));
    const candidateSelection = editingCandidate ? platformTrialLessonIds(old.presentation) : undefined;
    const requestedSelection = platformTrialLessonIds(input.presentation);
    const explicitSelection = booleanField(body, 'trialSelectionChanged') === true;
    // Older clients may submit an unchanged selection from a sealed live revision.
    const staleSnapshot = !editingCandidate && !explicitSelection && historicalSelection !== undefined
      && JSON.stringify(requestedSelection) === JSON.stringify([...historicalSelection].sort());
    const selection = staleSnapshot ? undefined : requestedSelection ?? candidateSelection;
    const presentation = { ...(input.presentation ?? old.presentation as Record<string, unknown> ?? {}) };
    delete presentation.trialLessonIds;
    let trialSelectionBase: string[] | undefined;
    if (selection !== undefined) {
      const eligible = await courseTrialLessons(db, id);
      const eligibleIds = new Set(eligible.map(lesson => lesson.id));
      if (requestedSelection && selection.some(lessonId => !eligibleIds.has(lessonId))) badRequest('Select available lessons in this course');
      const savedBase = platformTrialLessonIds({ trialLessonIds: old.trialSelectionBase });
      const effective = eligible.filter(lesson => lesson.accessScope === 'public').map(lesson => lesson.id);
      trialSelectionBase = editingCandidate && !explicitSelection && savedBase ? savedBase : effective;
      if (reviewRequired) presentation.trialLessonIds = selection;
      else await saveCourseTrialLessonSelection(db, id, selection, trialSelectionBase);
    }
    const revision = {
      ...requireBilingualTitle(input.titleZh ?? String(old.titleZh), input.titleEn ?? String(old.titleEn)),
      summaryZh: input.summaryZh ?? String(old.summaryZh), summaryEn: input.summaryEn ?? String(old.summaryEn),
      descriptionZh: input.descriptionZh ?? String(old.descriptionZh), descriptionEn: input.descriptionEn ?? String(old.descriptionEn), presentation,
    };
    const baseAmountMinor = input.baseAmountMinor ?? Number(old.baseAmountMinor);
    const memberAmountMinor = input.memberAmountMinor === undefined ? old.memberAmountMinor : input.memberAmountMinor;
    if (memberAmountMinor != null && Number(memberAmountMinor) > baseAmountMinor) badRequest('memberAmountMinor cannot exceed baseAmountMinor');
    const nextRevision = await nextContentRevision(db, id);
    const revisionStatus = !reviewRequired && (status === 'published' || status === 'unlisted') ? 'published' : 'draft';
    await platformQuery(db, `
      INSERT INTO platform_course_revisions (
        course_id, revision, title_zh, title_en, summary_zh, summary_en, description_zh, description_en,
        status, content_hash, created_by_user_id, published_by_user_id, published_at, presentation
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, decode($10, 'hex'), $11,
        CASE WHEN $9::varchar = 'published' THEN $11::bigint ELSE NULL END, CASE WHEN $9::varchar = 'published' THEN NOW() ELSE NULL END, $12::jsonb)
    `, [id, nextRevision, revision.titleZh, revision.titleEn, revision.summaryZh, revision.summaryEn,
      revision.descriptionZh, revision.descriptionEn, revisionStatus, hashJson(revision), actor.userId, revision.presentation]);
    if (reviewRequired) {
      const reviewId = await submitContentReview(db, { courseId: id, baseRevision: Number(old.currentRevision), candidateRevision: nextRevision,
        targetStatus: status, userId: actor.userId, metadata: { slug: input.slug ?? old.slug, baseAmountMinor, memberAmountMinor,
          currency: input.currency ?? old.currency, enrollmentMode: input.enrollmentMode ?? old.enrollmentMode,
          ...(trialSelectionBase && { trialSelectionBase }) } });
      return { status: 200, body: { course: { id, status: old.status, reviewId, reviewStatus: 'pending' } }, resourceType: 'course', resourceId: id };
    }
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
    await platformQuery(db, 'SELECT id FROM platform_courses WHERE id=$1::uuid FOR UPDATE', [id]);
    await withdrawPendingContentReview(db, id, null, true);
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
