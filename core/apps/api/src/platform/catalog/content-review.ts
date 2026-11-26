import { platformQuery, type PlatformDb } from '../db.js';
import { badRequest, conflict } from '../errors.js';
import { enumField, type JsonObject } from '../validation.js';

export function requiresContentReview(admin: boolean, status: string): boolean {
  return !admin && (status === 'published' || status === 'unlisted');
}

// Explicit submission intent fails closed against older API versions, which
// do not accept 'pending_review' as a publication status.
export function contentReviewIntent(body: JsonObject, admin: boolean, lesson = false): JsonObject {
  if (body.status !== 'pending_review') return body;
  if (admin) badRequest('Use the administrator publication status directly');
  const target = enumField(body, 'targetStatus', ['published', 'unlisted'] as const);
  if (!target || (lesson && target !== 'published')) badRequest('Invalid publication review target');
  return { ...body, status: target };
}

// Writers serialize on the parent course row. Candidates never replace the live pointer.
export async function nextContentRevision(db: PlatformDb, courseId: string, lessonId?: string, quizId?: string): Promise<number> {
  const rows = await platformQuery<{ revision: number }>(db, quizId
    ? 'SELECT COALESCE(MAX(revision),0)+1 AS revision FROM platform_quiz_revisions WHERE quiz_id=$1::uuid'
    : lessonId
    ? 'SELECT COALESCE(MAX(revision),0)+1 AS revision FROM platform_lesson_revisions WHERE lesson_id=$1::uuid'
    : 'SELECT COALESCE(MAX(revision),0)+1 AS revision FROM platform_course_revisions WHERE course_id=$1::uuid', [quizId ?? lessonId ?? courseId]);
  return Number(rows[0]?.revision);
}

export async function withdrawPendingContentReview(db: PlatformDb, courseId: string, lessonId: string | null, all = false, quizId: string | null = null) {
  await platformQuery(db, `
    UPDATE platform_content_reviews SET status='withdrawn', decided_at=NOW()
    WHERE course_id=$1::uuid AND status='pending' AND ($3::boolean OR (lesson_id IS NOT DISTINCT FROM $2::uuid AND quiz_id IS NOT DISTINCT FROM $4::uuid))
  `, [courseId, lessonId, all, quizId]);
}

export async function submitContentReview(db: PlatformDb, input: {
  courseId: string; lessonId?: string; quizId?: string; baseRevision: number; candidateRevision: number;
  targetStatus: string; metadata: Record<string, unknown>; userId: number | null;
}) {
  await withdrawPendingContentReview(db, input.courseId, input.lessonId ?? null, false, input.quizId ?? null);
  const rows = await platformQuery<{ id: string }>(db, `
    INSERT INTO platform_content_reviews
      (course_id, lesson_id, base_revision, candidate_revision, target_status, metadata, submitted_by_user_id, quiz_id)
    VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7,$8::uuid) RETURNING id::text AS id
  `, [input.courseId, input.lessonId ?? null, input.baseRevision, input.candidateRevision, input.targetStatus, input.metadata, input.userId, input.quizId ?? null]);
  return rows[0]!.id;
}

export async function assertNoPendingContentReview(db: PlatformDb, courseId: string, lessonId: string | null, quizId: string | null = null) {
  const rows = await platformQuery(db, `
    SELECT id FROM platform_content_reviews WHERE course_id=$1::uuid AND lesson_id IS NOT DISTINCT FROM $2::uuid AND quiz_id IS NOT DISTINCT FROM $3::uuid AND status='pending'
  `, [courseId, lessonId, quizId]);
  if (rows.length) conflict('Content is awaiting review; withdraw or decide the submission first');
}
