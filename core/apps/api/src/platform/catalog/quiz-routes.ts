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
      explanation: String(decryptPlatformPrivateData(Buffer.from(row.encryptedAnswer), row.answerVersion).explanation??''),
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
