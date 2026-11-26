import { randomUUID } from 'node:crypto';
import { assertNoPendingContentReview, contentReviewIntent, nextContentRevision, requiresContentReview, submitContentReview } from './content-review.js';
import { type PlatformActor, requirePlatformAdmin, requirePlatformActor } from '../auth.js';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../data_encryption.js';
import {
  type PlatformDb,
  platformQuery,
  platformDb,
  withIdempotency,
  isPostgresConflict,
  sendMutation,
} from '../db.js';
import { badRequest, notFound, conflict } from '../errors.js';
import { privateNoStore } from '../http.js';
import {
  type PlatformQuizQuestionType,
  type PlatformQuizAnswer,
  normalizePlatformQuizChoices,
  normalizePlatformQuizAnswer,
} from '../quiz_answers.js';
import {
  type JsonObject,
  arrayField,
  isObject,
  enumField,
  stringField,
  integerField,
  readJsonObject,
} from '../validation.js';
import { authorizeCourseWrite, courseKey, requiredParam } from './course-access.js';
import { SLUG, requireBilingualTitle, hashJson } from './course-fields.js';
import { type Context, type Hono } from 'hono';

interface QuizQuestionInput {
  explanation?: string;
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
      explanation: stringField(value,'explanation',{max:20000})??'',
      points: integerField(value, 'points', { min: 1, max: 1_000_000 }) ?? 1,
    };
  });
  return {
    slug: stringField(body, 'slug', { max: 120, pattern: SLUG }),
    titleZh: stringField(body, 'titleZh', { max: 240 }),
    titleEn: stringField(body, 'titleEn', { max: 240 }),
    passingScoreBps: integerField(body, 'passingScoreBps', { required, min: 0, max: 10_000 }),
    maxAttempts: body.maxAttempts === null ? null : integerField(body, 'maxAttempts', { min: 1, max: 1_000_000 }),
    status: enumField(body, 'status', ['draft', 'published', 'archived'] as const),
    questions,
  };
}

async function writableLessonId(db: PlatformDb, actor: PlatformActor, courseKeyValue: string, lessonKey: string, write = false): Promise<{ courseId: string; lessonId: string }> {
  const id = await authorizeCourseWrite(db, actor, courseKeyValue);
  if (write) await platformQuery(db, 'SELECT id FROM platform_courses WHERE id=$1::uuid FOR UPDATE', [id]);
  const rows = await platformQuery<{ id: string }>(db, `
    SELECT id::text AS id FROM platform_lessons
    WHERE course_id=$1::uuid AND (id::text=$2 OR slug=$2)
  `, [id, lessonKey]);
  if (!rows[0]) notFound('Lesson');
  if (write && !actor.isAdmin) {
    await assertNoPendingContentReview(db, id, null);
    await assertNoPendingContentReview(db, id, rows[0].id);
  }
  return { courseId: id, lessonId: rows[0].id };
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
    const payload = decryptPlatformPrivateData(Buffer.from(row.encryptedAnswer), row.answerVersion);
    return {
      type: row.type,
      promptZh: row.promptZh,
      promptEn: row.promptEn,
      choices,
      answerKey: normalizePlatformQuizAnswer({
        questionType: row.type,
        raw: payload.answer,
        choiceCount: choices.length,
        source: 'stored',
        label: 'stored answer key',
      }),
      explanation: String(payload.explanation ?? ''),
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
  const { lessonId } = await writableLessonId(db, actor, courseKeyValue, lessonKey);
  const rows = await platformQuery<{
    id: string; slug: string; status: string; revision: number; currentRevision: number;
    reviewId: string | null; reviewStatus: string | null; reviewTargetStatus: string | null; reviewBase: Record<string, unknown> | null;
  }>(db, `
    SELECT q.id::text AS id, q.slug, q.status, qr.revision, q.current_revision AS "currentRevision",
      qr.title_zh AS "titleZh", qr.title_en AS "titleEn", qr.passing_score_bps AS "passingScoreBps", qr.max_attempts AS "maxAttempts",
      review.id::text AS "reviewId", review.status AS "reviewStatus", review.decision_note AS "reviewNote",
      review.target_status AS "reviewTargetStatus", review.submitted_at AS "reviewSubmittedAt",
      CASE WHEN live.status='published' AND qr.revision<>live.revision THEN jsonb_build_object(
        'titleZh', live.title_zh, 'titleEn', live.title_en, 'passingScoreBps', live.passing_score_bps,
        'maxAttempts', live.max_attempts, 'status', 'published'
      ) END AS "reviewBase"
    FROM platform_quizzes q
    JOIN platform_quiz_revisions live ON live.quiz_id=q.id AND live.revision=q.current_revision
    JOIN LATERAL (
      SELECT * FROM platform_quiz_revisions candidate WHERE candidate.quiz_id=q.id
        AND (candidate.revision=q.current_revision OR (candidate.revision>q.current_revision AND candidate.status='draft' AND q.status<>'archived'))
      ORDER BY candidate.revision DESC LIMIT 1
    ) qr ON true
    LEFT JOIN LATERAL (
      SELECT * FROM platform_content_reviews r WHERE r.quiz_id=q.id
        AND r.base_revision=q.current_revision AND r.candidate_revision=qr.revision
        AND r.status IN ('pending','rejected','withdrawn')
      ORDER BY r.submitted_at DESC, r.id DESC LIMIT 1
    ) review ON true
    WHERE q.lesson_id=$1::uuid AND ($2::text IS NULL OR q.id::text=$2 OR q.slug=$2)
    ORDER BY q.updated_at DESC,q.id
  `, [lessonId, quizKey]);
  if (quizKey && !rows[0]) notFound('Quiz');
  const quizzes = await Promise.all(rows.map(async (row) => {
    const [questions, previous] = await Promise.all([
      quizQuestions(db, row.id, row.revision),
      admin && row.reviewBase && row.reviewStatus ? quizQuestions(db, row.id, row.currentRevision) : null,
    ]);
    return {
      ...row, questions, editStatus: row.reviewTargetStatus ?? (row.revision !== row.currentRevision ? 'draft' : row.status),
      reviewBase: previous ? { ...row.reviewBase, questions: previous } : null,
    };
  }));
  privateNoStore(c);
  return c.json(quizKey ? { quiz: quizzes[0] } : { quizzes });
}

function quizWriteScope(admin: boolean, action: string, course: string, lesson: string, quiz: string) {
  const prefix = `platform.${admin ? 'admin' : 'instructor'}.quiz.${action}:`;
  const identity = `${course}:${lesson}:${quiz}`;
  return prefix + (prefix.length + identity.length <= 120 ? identity : hashJson(identity));
}

async function saveQuiz(c: Context, admin: boolean, creating: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const courseKeyValue = courseKey(c);
  const lessonKey = requiredParam(c, 'lessonId');
  const quizKey = creating ? null : requiredParam(c, 'quizId');
  const body = await readJsonObject(c);
  const input = quizFields(contentReviewIntent(body, admin, true), creating);
  const scope = quizWriteScope(admin, creating ? 'create' : 'update', courseKeyValue, lessonKey, quizKey ?? 'new');
  const result = await withIdempotency(c, actor, scope, body, async (db) => {
    const { courseId, lessonId } = await writableLessonId(db, actor, courseKeyValue, lessonKey, true);
    const old = quizKey ? (await platformQuery<{
      id: string; slug: string; status: 'draft' | 'published' | 'archived'; currentRevision: number; revision: number;
      titleZh: string; titleEn: string; passingScoreBps: number; maxAttempts: number | null;
    }>(db, `
      SELECT q.id::text AS id,q.slug,q.status,q.current_revision AS "currentRevision",
        qr.revision, qr.title_zh AS "titleZh",qr.title_en AS "titleEn",qr.passing_score_bps AS "passingScoreBps",qr.max_attempts AS "maxAttempts"
      FROM platform_quizzes q JOIN LATERAL (
        SELECT * FROM platform_quiz_revisions r WHERE r.quiz_id=q.id
          AND (r.revision=q.current_revision OR (r.revision>q.current_revision AND r.status='draft' AND q.status<>'archived'))
        ORDER BY r.revision DESC LIMIT 1
      ) qr ON true
      WHERE q.lesson_id=$1::uuid AND (q.id::text=$2 OR q.slug=$2) FOR UPDATE OF q
    `, [lessonId, quizKey]))[0] : undefined;
    if (!creating && !old) notFound('Quiz');
    if (old) await assertNoPendingContentReview(db, courseId, lessonId, old.id);
    const requestedStatus = input.status ?? (old && old.revision !== old.currentRevision ? 'draft' : old?.status) ?? 'draft';
    if (!admin && old?.status === 'published' && requestedStatus === 'archived') conflict('Only an administrator can archive a published quiz');
    const reviewRequired = requiresContentReview(admin, requestedStatus);
    const keepLive = old?.status === 'published' && !admin && requestedStatus === 'draft';
    const status = reviewRequired || keepLive ? old?.status ?? 'draft' : requestedStatus;
    const revisionStatus = !reviewRequired && !keepLive && status === 'published' ? 'published' : 'draft';
    const { titleZh, titleEn } = requireBilingualTitle(input.titleZh ?? old?.titleZh, input.titleEn ?? old?.titleEn);
    const passingScoreBps = input.passingScoreBps ?? old!.passingScoreBps;
    const maxAttempts = input.maxAttempts === undefined ? old?.maxAttempts ?? null : input.maxAttempts;
    const questions = input.questions ?? await quizQuestions(db, old!.id, old!.revision);
    const slug = input.slug ?? old?.slug ?? `quiz-${randomUUID()}`;
    let id = old?.id;
    if (!id) {
      try {
        const [row] = await platformQuery<{ id: string }>(db, `
          INSERT INTO platform_quizzes(lesson_id,slug,status,current_revision)
          VALUES($1::uuid,$2,$3,1) RETURNING id::text AS id
        `, [lessonId, slug, status]);
        id = row.id;
      } catch (error) {
        if (isPostgresConflict(error)) conflict('Quiz slug conflicts with an existing quiz');
        throw error;
      }
    }
    const revision = old ? await nextContentRevision(db, courseId, lessonId, id) : 1;
    const normalized = { titleZh, titleEn, passingScoreBps, maxAttempts, questions };
    await platformQuery(db, `
      INSERT INTO platform_quiz_revisions(quiz_id,revision,title_zh,title_en,passing_score_bps,max_attempts,status,content_hash,created_by_user_id,published_at)
      VALUES($1::uuid,$2,$3,$4,$5,$6,$7,decode($8,'hex'),$9,CASE WHEN $7::varchar='published' THEN NOW() ELSE NULL END)
    `, [id, revision, titleZh, titleEn, passingScoreBps, maxAttempts, revisionStatus, hashJson(normalized), actor.userId]);
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const encrypted = encryptPlatformPrivateData({ answer: question.answerKey, explanation: question.explanation??'' });
      await platformQuery(db, `
        INSERT INTO platform_quiz_questions(quiz_id,quiz_revision,ordinal,question_type,prompt_zh,prompt_en,choices,answer_key_encrypted,answer_key_version,points)
        VALUES($1::uuid,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
      `, [id, revision, index, question.type, question.promptZh, question.promptEn, question.choices, encrypted.payload, encrypted.keyVersion, question.points]);
    }
    if (reviewRequired) {
      const reviewId = await submitContentReview(db, {
        courseId, lessonId, quizId: id, baseRevision: old?.currentRevision ?? revision,
        candidateRevision: revision, targetStatus: 'published', userId: actor.userId, metadata: { slug },
      });
      return { status: creating ? 201 : 200, body: { quiz: { id, revision, status, reviewId, reviewStatus: 'pending' } },
        resourceType: 'quiz', resourceId: id };
    }
    if (!keepLive && old) await platformQuery(db,
      'UPDATE platform_quizzes SET slug=$2,status=$3,current_revision=$4 WHERE id=$1::uuid', [id, slug, status, revision]);
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
    quizWriteScope(admin, 'archive', courseKeyValue, lessonKey, quizKey), {}, async (db) => {
      const { courseId, lessonId } = await writableLessonId(db, actor, courseKeyValue, lessonKey, true);
      const [quiz] = await platformQuery<{ id: string; status: string }>(db, `
        SELECT id::text, status FROM platform_quizzes WHERE lesson_id=$1::uuid AND (id::text=$2 OR slug=$2) FOR UPDATE
      `, [lessonId, quizKey]);
      if (!quiz) notFound('Quiz');
      await assertNoPendingContentReview(db, courseId, lessonId, quiz.id);
      if (!admin && quiz.status === 'published') conflict('Only an administrator can archive a published quiz');
      await platformQuery(db, "UPDATE platform_quizzes SET status='archived' WHERE id=$1::uuid", [quiz.id]);
      return { status: 200, body: { quiz: { id: quiz.id, status: 'archived' } }, resourceType: 'quiz', resourceId: quiz.id };
    });
  return sendMutation(c, result);
}

export function registerQuizRoutes(platformCatalogRoutes: Hono): void {
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
}
