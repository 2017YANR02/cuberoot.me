import { requirePlatformActor } from '../auth.js';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../data_encryption.js';
import { withIdempotency, platformQuery, enqueuePlatformEvent, sendMutation, platformDb } from '../db.js';
import { badRequest, notFound, conflict, PlatformApiError } from '../errors.js';
import { privateNoStore } from '../http.js';
import { awardLearningPoints } from '../learning_completion.js';
import {
  type PlatformQuizQuestionType,
  type PlatformQuizAnswer,
  normalizePlatformQuizAnswer,
  platformQuizAnswersEqual,
} from '../quiz_answers.js';
import { resourceId, readJsonObject, stringField } from '../validation.js';
import { requireLessonAccess } from './lesson-access.js';
import { type Hono } from 'hono';

function submittedQuizAnswer(
  answers: unknown[] | Record<string, unknown>,
  questionId: string,
  ordinal: number,
  index: number,
): unknown {
  if (Array.isArray(answers)) return answers[index];
  if (Object.hasOwn(answers, questionId)) return answers[questionId];
  if (Object.hasOwn(answers, String(ordinal))) return answers[String(ordinal)];
  if (Object.hasOwn(answers, String(index))) return answers[String(index)];
  return undefined;
}

export function registerQuizRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.post('/learning/lessons/:lessonId/quiz', async (c) => {
    const actor = await requirePlatformActor(c);
    const lessonId = resourceId(c.req.param('lessonId'), 'lessonId');
    const body = await readJsonObject(c);
    const quizId = body.quizId == null ? undefined : resourceId(stringField(body, 'quizId', { max: 128 })!, 'quizId');
    const rawAnswers = body.answers ?? (body.answerIdx == null ? undefined : [body.answerIdx]);
    if (!Array.isArray(rawAnswers) && (rawAnswers == null || typeof rawAnswers !== 'object')) {
      badRequest('answers must be an array or object');
    }
    const result = await withIdempotency(c, actor, `learning.quiz:${lessonId}`, body, async (db) => {
      await requireLessonAccess(actor, lessonId, db);
      const quizzes = await platformQuery<{
        id: string; revision: number; max_attempts: number | null; passing_score_bps: number;
      }>(db, `
        SELECT q.id::text, q.current_revision AS revision, qr.max_attempts, qr.passing_score_bps
        FROM platform_quizzes q
        JOIN platform_quiz_revisions qr ON qr.quiz_id = q.id AND qr.revision = q.current_revision
        WHERE q.lesson_id = $1::uuid AND q.status = 'published' AND qr.status = 'published'
          AND ($2::uuid IS NULL OR q.id = $2::uuid)
        ORDER BY q.id LIMIT 1 FOR UPDATE OF q
      `, [lessonId, quizId ?? null]);
      const quiz = quizzes[0];
      if (!quiz) notFound('Quiz');
      const questions = await platformQuery<{
        id: string; ordinal: number; question_type: PlatformQuizQuestionType; choices: unknown; answer_key_encrypted: Buffer;
        answer_key_version: number; points: number;
      }>(db, `
        SELECT id::text, ordinal, question_type, choices, answer_key_encrypted, answer_key_version, points
        FROM platform_quiz_questions
        WHERE quiz_id = $1::uuid AND quiz_revision = $2
        ORDER BY ordinal, id
      `, [quiz.id, quiz.revision]);
      if (questions.length === 0) conflict('Published quiz has no questions');
      const attemptRows = await platformQuery<{ attempt_number: number }>(db, `
        SELECT COALESCE(MAX(attempt_number), 0)::integer + 1 AS attempt_number
        FROM platform_quiz_attempts WHERE user_id = $1 AND quiz_id = $2::uuid
      `, [actor.userId, quiz.id]);
      const attemptNumber = attemptRows[0]!.attempt_number;
      if (quiz.max_attempts != null && attemptNumber > quiz.max_attempts) conflict('Quiz attempt limit reached');
      let scorePoints = 0;
      let maxPoints = 0;
      const submittedAnswers = rawAnswers as unknown[] | Record<string, unknown>;
      const typedAnswers: PlatformQuizAnswer[] = [];
      const feedback: Record<string, unknown>[] = [];
      for (const [index, question] of questions.entries()) {
        const choices = question.choices;
        const choiceCount = Array.isArray(choices) ? choices.length : -1;
        const choiceQuestion = question.question_type === 'single_choice' || question.question_type === 'multiple_choice';
        if (!Array.isArray(choices)
          || (choiceQuestion && (choiceCount < 2 || choiceCount > 100
            || choices.some((choice) => typeof choice !== 'string' || !choice.trim() || choice.trim().length > 500)
            || new Set(choices.map((choice) => String(choice).trim())).size !== choices.length))
          || (!choiceQuestion && choiceCount !== 0)) {
          throw new PlatformApiError('INVALID_STATE', 409, 'Published quiz has invalid choices');
        }
        const answerKey = decryptPlatformPrivateData(
          Buffer.from(question.answer_key_encrypted),
          question.answer_key_version,
        );
        if (!Object.hasOwn(answerKey, 'answer')) {
          throw new PlatformApiError('INVALID_STATE', 409, 'Published quiz has an invalid answer key');
        }
        const answer = normalizePlatformQuizAnswer({
          questionType: question.question_type,
          raw: submittedQuizAnswer(submittedAnswers, question.id, question.ordinal, index),
          choiceCount,
          source: 'submission',
          label: `answers[${index}]`,
        });
        const expected = normalizePlatformQuizAnswer({
          questionType: question.question_type,
          raw: answerKey.answer,
          choiceCount,
          source: 'stored',
          label: `answerKey[${index}]`,
        });
        typedAnswers.push(answer);
        feedback.push({ questionId: question.id, selected: answer, expected, correct: platformQuizAnswersEqual(answer, expected), explanation: answerKey.explanation ?? answerKey.explain ?? '' });
        if (platformQuizAnswersEqual(answer, expected)) {
          scorePoints += question.points;
        }
        maxPoints += question.points;
      }
      const scoreBps = Math.round((scorePoints * 10_000) / maxPoints);
      const passed = scoreBps >= quiz.passing_score_bps;
      const answersSnapshot = encryptPlatformPrivateData({ answers: typedAnswers, feedback });
      const rows = await platformQuery(db, `
        INSERT INTO platform_quiz_attempts (
          user_id, quiz_id, quiz_revision, attempt_number, status,
          answers_snapshot_encrypted, answers_key_version,
          score_points, max_points, score_bps, passed, submitted_at, graded_at
        ) VALUES ($1, $2::uuid, $3, $4, 'graded', $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING id::text, quiz_id::text AS "quizId", quiz_revision AS "quizRevision",
                  attempt_number AS "attemptNumber", status, score_points AS "scorePoints",
                  max_points AS "maxPoints", score_bps AS "scoreBps", passed,
                  submitted_at AS "submittedAt", graded_at AS "gradedAt"
      `, [actor.userId, quiz.id, quiz.revision, attemptNumber, answersSnapshot.payload,
        answersSnapshot.keyVersion, scorePoints, maxPoints, scoreBps, passed]);
      await enqueuePlatformEvent(db, 'learning.quiz_graded', 'quiz_attempt', String(rows[0]!.id),
        `learning.quiz:${rows[0]!.id}`, {
          attemptId: rows[0]!.id, quizId: quiz.id, scoreBps, passed,
        });
      const awardedPoints = scoreBps === 10_000 ? await awardLearningPoints(db, actor.userId!, `learning:quiz:${quiz.id}`, 5) : false;
      return { status: 201, body: { ...rows[0]!, feedback, awardedPoints }, resourceType: 'quiz_attempt', resourceId: String(rows[0]!.id) };
    });
    return sendMutation(c, result);
  });

  platformLearningRoutes.get('/learning/lessons/:lessonId/state', async c => {
    const actor = await requirePlatformActor(c);
    const lessonId = resourceId(c.req.param('lessonId'));
    const lesson = await requireLessonAccess(actor, lessonId);
    const db = platformDb();
    const [progress, notes, attempts, lessons] = await Promise.all([
      platformQuery(db, `SELECT status,progress_bps AS "progressBps",position_seconds AS "positionSeconds" FROM platform_lesson_progress WHERE user_id=$1 AND lesson_id=$2::uuid`,[actor.userId,lessonId]),
      platformQuery(db, `SELECT id::text,body,position_seconds AS "positionSeconds",updated_at AS "updatedAt" FROM platform_lesson_notes WHERE user_id=$1 AND lesson_id=$2::uuid ORDER BY position_seconds,created_at`,[actor.userId,lessonId]),
      platformQuery(db, `SELECT a.id::text,a.quiz_id::text AS "quizId",a.quiz_revision AS "quizRevision",a.attempt_number AS "attemptNumber",a.score_bps AS "scoreBps",a.passed,a.graded_at AS "gradedAt",a.answers_snapshot_encrypted,a.answers_key_version FROM platform_quiz_attempts a JOIN platform_quizzes q ON q.id=a.quiz_id WHERE a.user_id=$1 AND q.lesson_id=$2::uuid AND a.status='graded' ORDER BY a.attempt_number DESC LIMIT 30`,[actor.userId,lessonId]),
      platformQuery(db, `SELECT l.id::text,l.ordinal,r.title_zh AS "titleZh",r.title_en AS "titleEn",l.access_scope AS "accessScope",r.duration_seconds AS "durationSeconds",COALESCE(p.status,'not_started') AS status,COALESCE(p.progress_bps,0) AS "progressBps" FROM platform_lessons l JOIN platform_lesson_revisions r ON r.lesson_id=l.id AND r.revision=l.current_revision LEFT JOIN platform_lesson_progress p ON p.lesson_id=l.id AND p.user_id=$1 WHERE l.course_id=$2::uuid AND l.status='published' ORDER BY l.ordinal`,[actor.userId,lesson.courseId]),
    ]);
    privateNoStore(c);
    return c.json({progress:progress[0]??null,notes,lessons,attempts:attempts.map(({answers_snapshot_encrypted,answers_key_version,...attempt})=>({...attempt,...decryptPlatformPrivateData(Buffer.from(answers_snapshot_encrypted as Uint8Array),Number(answers_key_version))}))});
  });
}
