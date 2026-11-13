import { requirePlatformActor } from '../auth.js';
import { platformQuery, platformDb, withIdempotency, sendMutation } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { privateNoStore } from '../http.js';
import { pagination, resourceId, readJsonObject, stringField, integerField } from '../validation.js';
import { requireLessonAccess } from './lesson-access.js';
import { type Hono } from 'hono';

export function registerNoteRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.get('/me/notes', async (c) => {
    const actor = await requirePlatformActor(c);
    const {page,pageSize,offset}=pagination(c);
    const paged=c.req.query('page')!==undefined;
    const rows = await platformQuery(platformDb(), `
      SELECT COUNT(*) OVER()::int AS "resultTotal", n.id::text, n.lesson_id::text AS "lessonId", lesson.course_id::text AS "courseId",
             n.position_seconds AS "positionSeconds", n.body,
             n.created_at AS "createdAt", n.updated_at AS "updatedAt", cr.title_zh AS "courseTitleZh", cr.title_en AS "courseTitleEn",
             COALESCE(NULLIF(lr.title_zh, ''), lr.title_en) AS title
      FROM platform_lesson_notes n
      JOIN platform_lessons lesson ON lesson.id = n.lesson_id
      JOIN platform_courses course ON course.id=lesson.course_id
      JOIN platform_course_revisions cr ON cr.course_id=course.id AND cr.revision=course.current_revision
      LEFT JOIN platform_lesson_revisions lr
        ON lr.lesson_id = lesson.id AND lr.revision = lesson.current_revision
      WHERE n.user_id = $1
      ORDER BY n.updated_at DESC, n.id LIMIT $2 OFFSET $3
    `, [actor.userId,paged?pageSize:null,paged?offset:0]);
    privateNoStore(c);
    return c.json({items:rows,page,pageSize,total:Number(rows[0]?.resultTotal??0)});
  });

  platformLearningRoutes.put('/me/notes/:id', async (c) => {
    const actor = await requirePlatformActor(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const explicitNoteId = body.noteId == null ? undefined : resourceId(stringField(body, 'noteId', { max: 128 })!, 'noteId');
    const noteBody = stringField(body, 'contentMarkdown', { max: 20_000 })
      ?? stringField(body, 'content', { max: 20_000 })
      ?? stringField(body, 'body', { max: 20_000 });
    if (noteBody == null) badRequest('contentMarkdown is required');
    const positionSeconds = integerField(body, 'positionSeconds', { min: 0, max: 86_400 });
    const existing = await platformQuery<{ id: string; lesson_id: string }>(platformDb(), `
      SELECT id::text, lesson_id::text FROM platform_lesson_notes
      WHERE id = $1::uuid AND user_id = $2
    `, [explicitNoteId ?? id, actor.userId]);
    const noteId = explicitNoteId ?? existing[0]?.id;
    const lessonId = explicitNoteId ? id : (existing[0]?.lesson_id ?? id);
    await requireLessonAccess(actor, lessonId);
    const result = await withIdempotency(c, actor, `learning.note:${noteId ?? lessonId}`, body, async (db) => {
      const rows = noteId
        ? await platformQuery(db, `
            UPDATE platform_lesson_notes
            SET body = $4, position_seconds = $5
            WHERE id = $1::uuid AND user_id = $2 AND lesson_id = $3::uuid
            RETURNING id::text, lesson_id::text AS "lessonId", body,
                      position_seconds AS "positionSeconds", updated_at AS "updatedAt"
          `, [noteId, actor.userId, lessonId, noteBody, positionSeconds ?? null])
        : await platformQuery(db, `
            INSERT INTO platform_lesson_notes (user_id, lesson_id, body, position_seconds)
            VALUES ($1, $2::uuid, $3, $4)
            RETURNING id::text, lesson_id::text AS "lessonId", body,
                      position_seconds AS "positionSeconds", created_at AS "createdAt", updated_at AS "updatedAt"
          `, [actor.userId, lessonId, noteBody, positionSeconds ?? null]);
      if (!rows[0]) notFound('Note');
      return { status: noteId ? 200 : 201, body: rows[0]!, resourceType: 'lesson_note', resourceId: String(rows[0]!.id) };
    });
    return sendMutation(c, result);
  });

  platformLearningRoutes.delete('/me/notes/:id', async (c) => {
    const actor = await requirePlatformActor(c);
    const id = resourceId(c.req.param('id'));
    const result = await withIdempotency(c, actor, `learning.note.delete:${id}`, {}, async (db) => {
      const rows = await platformQuery<{ id: string }>(db, `
        DELETE FROM platform_lesson_notes WHERE id = $1::uuid AND user_id = $2 RETURNING id::text
      `, [id, actor.userId]);
      if (!rows[0]) notFound('Note');
      return { status: 200, body: { id, deleted: true }, resourceType: 'lesson_note', resourceId: id };
    });
    return sendMutation(c, result);
  });
}
