import { requirePlatformActor } from '../auth.js';
import { platformQuery, platformDb, withIdempotency, enqueuePlatformEvent, sendMutation } from '../db.js';
import { badRequest } from '../errors.js';
import { privateNoStore } from '../http.js';
import { awardLearningPoints } from '../learning_completion.js';
import { resourceId, readJsonObject, integerField, booleanField, enumField } from '../validation.js';
import { requireLessonAccess } from './lesson-access.js';
import { type Hono } from 'hono';
import { randomUUID } from 'node:crypto';

export function registerProgressRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.get('/me/progress', async (c) => {
    const actor = await requirePlatformActor(c);
    const rows = await platformQuery(platformDb(), `
      SELECT p.lesson_id::text AS id, p.lesson_id::text AS "lessonId",
             lesson.course_id::text AS "courseId", p.lesson_revision AS "lessonRevision",
             p.status, p.progress_bps AS "progressBps", p.position_seconds AS "positionSeconds",
             p.started_at AS "startedAt", p.completed_at AS "completedAt", p.updated_at AS "updatedAt",
             COALESCE(NULLIF(lr.title_zh, ''), lr.title_en) AS title
      FROM platform_lesson_progress p
      JOIN platform_lessons lesson ON lesson.id = p.lesson_id
      LEFT JOIN platform_lesson_revisions lr
        ON lr.lesson_id = p.lesson_id AND lr.revision = p.lesson_revision
      WHERE p.user_id = $1
      ORDER BY p.updated_at DESC, p.lesson_id
    `, [actor.userId]);
    privateNoStore(c);
    return c.json({ items: rows });
  });

  platformLearningRoutes.put('/me/progress/:lessonId', async (c) => {
    const actor = await requirePlatformActor(c);
    const lessonId = resourceId(c.req.param('lessonId'), 'lessonId');
    const body = await readJsonObject(c);
    const explicitBps = integerField(body, 'progressBps', { min: 0, max: 10_000 });
    const progressPercent = integerField(body, 'progressPercent', { min: 0, max: 100 })
      ?? integerField(body, 'percent', { min: 0, max: 100 });
    const completed = booleanField(body, 'completed');
    const progressBps = explicitBps ?? (progressPercent == null ? (completed ? 10_000 : undefined) : progressPercent * 100);
    if (progressBps == null) badRequest('progressBps or progressPercent is required');
    const positionSeconds = integerField(body, 'positionSeconds', { min: 0, max: 86_400 }) ?? integerField(body, 'lastPositionSeconds', { min: 0, max: 86_400 }) ?? 0;
    const requestedStatus = enumField(body, 'status', ['not_started', 'in_progress', 'completed'] as const);
    const status = requestedStatus ?? (progressBps === 10_000 ? 'completed' : progressBps > 0 ? 'in_progress' : 'not_started');
    if (status === 'completed' && progressBps !== 10_000) badRequest('Completed progress must be 10000 bps');
    const lesson = await requireLessonAccess(actor, lessonId);
    const result = await withIdempotency(c, actor, `learning.progress:${lessonId}`, body, async (db) => {
      const rows = await platformQuery(db, `
        INSERT INTO platform_lesson_progress (
          user_id, lesson_id, lesson_revision, status, progress_bps, position_seconds,
          started_at, completed_at
        ) VALUES (
          $1, $2::uuid, $3, $4, $5, $6,
          CASE WHEN $4::varchar <> 'not_started' THEN NOW() END,
          CASE WHEN $4::varchar = 'completed' THEN NOW() END
        )
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET
          lesson_revision = EXCLUDED.lesson_revision,
          status = CASE WHEN platform_lesson_progress.status = 'completed' THEN 'completed' ELSE EXCLUDED.status END,
          progress_bps = GREATEST(platform_lesson_progress.progress_bps, EXCLUDED.progress_bps),
          position_seconds = EXCLUDED.position_seconds,
          started_at = COALESCE(platform_lesson_progress.started_at, EXCLUDED.started_at),
          completed_at = CASE WHEN EXCLUDED.status = 'completed'
            THEN COALESCE(platform_lesson_progress.completed_at, NOW()) ELSE platform_lesson_progress.completed_at END
        RETURNING lesson_id::text AS id, lesson_revision AS "lessonRevision", status,
                  progress_bps AS "progressBps", position_seconds AS "positionSeconds",
                  started_at AS "startedAt", completed_at AS "completedAt", updated_at AS "updatedAt"
      `, [actor.userId, lessonId, lesson.revision, status, progressBps, positionSeconds]);
      await enqueuePlatformEvent(db, 'learning.progress_updated', 'lesson', lessonId,
        `learning.progress:${lessonId}:${lesson.revision}:${progressBps}:${positionSeconds}:${randomUUID()}`, {
          lessonId, courseId: lesson.courseId, progressBps, status,
        });
      if (rows[0]?.status === 'completed') await awardLearningPoints(db, actor.userId!, `learning:lesson:${lessonId}`, 8);
      return { status: 200, body: rows[0]!, resourceType: 'lesson_progress', resourceId: lessonId };
    });
    return sendMutation(c, result);
  });
}
