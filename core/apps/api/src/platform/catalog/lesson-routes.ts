import { requirePlatformAdmin, requirePlatformActor } from '../auth.js';
import { withIdempotency, platformQuery, isPostgresConflict, sendMutation } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { type JsonObject, isObject, stringField, integerField, enumField, readJsonObject } from '../validation.js';
import { courseKey, requiredParam, authorizeCourseWrite } from './course-access.js';
import { SLUG, requireBilingualTitle, hashJson } from './course-fields.js';
import { driveVideoNodeId, driveVideoMediaId } from './drive-media.js';
import { type Context, type Hono } from 'hono';

const LESSON_STATUSES = ['draft', 'published', 'archived'] as const;

const ACCESS_SCOPES = ['public', 'entitled'] as const;

function lessonFields(body: JsonObject, required: boolean) {
  const bodyZh = body.bodyZh === undefined ? undefined : body.bodyZh;
  const bodyEn = body.bodyEn === undefined ? undefined : body.bodyEn;
  if (bodyZh !== undefined && !isObject(bodyZh)) badRequest('bodyZh must be an object');
  if (bodyEn !== undefined && !isObject(bodyEn)) badRequest('bodyEn must be an object');
  return {
    slug: stringField(body, 'slug', { required, max: 120, pattern: SLUG }),
    ordinal: integerField(body, 'ordinal', { required, min: 0, max: 1_000_000 }),
    titleZh: stringField(body, 'titleZh', { max: 240 }),
    titleEn: stringField(body, 'titleEn', { max: 240 }),
    bodyZh, bodyEn,
    durationSeconds: body.durationSeconds === null ? null : integerField(body, 'durationSeconds', { min: 0, max: 86_400 }),
    driveVideo: driveVideoNodeId(body.driveVideo),
    status: enumField(body, 'status', LESSON_STATUSES),
    accessScope: enumField(body, 'accessScope', ACCESS_SCOPES),
  };
}

async function saveLesson(c: Context, admin: boolean, creating: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const courseKeyValue = courseKey(c);
  const lessonKey = creating ? null : requiredParam(c, 'lessonId');
  const body = await readJsonObject(c);
  const input = lessonFields(body, creating);
  if (creating) requireBilingualTitle(input.titleZh, input.titleEn);
  const scope = `platform.${admin ? 'admin' : 'instructor'}.lesson.${creating ? 'create' : 'update'}:${courseKeyValue}${lessonKey ? `:${lessonKey}` : ''}`;
  const result = await withIdempotency(c, actor, scope, body, async (db) => {
    const id = await authorizeCourseWrite(db, actor, courseKeyValue);
    if (creating) {
      const status = input.status ?? 'draft';
      const revisionStatus = status === 'published' ? 'published' : 'draft';
      const mediaId = input.driveVideo ? await driveVideoMediaId(db, actor, input.driveVideo) : null;
      try {
        const rows = await platformQuery<{ id: string }>(db, `
          INSERT INTO platform_lessons (course_id, slug, ordinal, status, access_scope, current_revision)
          VALUES ($1::uuid, $2, $3, $4, $5, 1) RETURNING id::text AS id
        `, [id, input.slug, input.ordinal, status, input.accessScope ?? 'entitled']);
        const revision = { titleZh: input.titleZh ?? '', titleEn: input.titleEn ?? '', bodyZh: input.bodyZh ?? {}, bodyEn: input.bodyEn ?? {}, mediaId };
        await platformQuery(db, `
          INSERT INTO platform_lesson_revisions (
            lesson_id, revision, title_zh, title_en, body_zh, body_en, media_id, duration_seconds,
            status, content_hash, created_by_user_id, published_by_user_id, published_at
          ) VALUES ($1::uuid, 1, $2, $3, $4::jsonb, $5::jsonb, $6::uuid, $7, $8, decode($9, 'hex'), $10,
            CASE WHEN $8::varchar = 'published' THEN $10::bigint ELSE NULL END, CASE WHEN $8::varchar = 'published' THEN NOW() ELSE NULL END)
        `, [rows[0].id, revision.titleZh, revision.titleEn, revision.bodyZh, revision.bodyEn,
          mediaId, input.durationSeconds ?? null, revisionStatus, hashJson(revision), actor.userId]);
        return { status: 201, body: { lesson: rows[0] }, resourceType: 'lesson', resourceId: rows[0].id };
      } catch (error) {
        if (isPostgresConflict(error)) conflict('Lesson slug or order conflicts with an existing lesson');
        throw error;
      }
    }
    const found = await platformQuery<Record<string, unknown>>(db, `
      SELECT l.id::text AS id, l.slug, l.ordinal, l.status, l.access_scope AS "accessScope", l.current_revision AS "currentRevision",
        r.title_zh AS "titleZh", r.title_en AS "titleEn", r.body_zh AS "bodyZh", r.body_en AS "bodyEn",
        r.media_id::text AS "mediaId", r.cover_media_id::text AS "coverMediaId",
        r.duration_seconds AS "durationSeconds"
      FROM platform_lessons l JOIN platform_lesson_revisions r ON r.lesson_id = l.id AND r.revision = l.current_revision
      WHERE l.course_id = $1::uuid AND (l.id::text = $2 OR l.slug = $2) FOR UPDATE
    `, [id, lessonKey]);
    const old = found[0];
    if (!old) notFound('Lesson');
    const revision = {
      titleZh: input.titleZh ?? String(old.titleZh), titleEn: input.titleEn ?? String(old.titleEn),
      bodyZh: input.bodyZh ?? old.bodyZh, bodyEn: input.bodyEn ?? old.bodyEn,
    };
    requireBilingualTitle(revision.titleZh, revision.titleEn);
    const status = input.status ?? String(old.status);
    const revisionStatus = status === 'published' ? 'published' : 'draft';
    const nextRevision = Number(old.currentRevision) + 1;
    const mediaId = input.driveVideo ? await driveVideoMediaId(db, actor, input.driveVideo) : old.mediaId ?? null;
    const coverMediaId = old.coverMediaId ?? null;
    const revisionWithMedia = { ...revision, mediaId, coverMediaId };
    await platformQuery(db, `
      INSERT INTO platform_lesson_revisions (
        lesson_id, revision, title_zh, title_en, body_zh, body_en, media_id, cover_media_id, duration_seconds,
        status, content_hash, created_by_user_id, published_by_user_id, published_at
      ) VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::uuid, $8::uuid, $9, $10, decode($11, 'hex'), $12,
        CASE WHEN $10::varchar = 'published' THEN $12::bigint ELSE NULL END, CASE WHEN $10::varchar = 'published' THEN NOW() ELSE NULL END)
    `, [old.id, nextRevision, revision.titleZh, revision.titleEn, revision.bodyZh, revision.bodyEn,
      mediaId, coverMediaId, input.durationSeconds === undefined ? old.durationSeconds : input.durationSeconds,
      revisionStatus, hashJson(revisionWithMedia), actor.userId]);
    await platformQuery(db, `
      UPDATE platform_lessons SET slug=$2, ordinal=$3, status=$4, access_scope=$5, current_revision=$6
      WHERE id=$1::uuid
    `, [old.id, input.slug ?? old.slug, input.ordinal ?? old.ordinal, status, input.accessScope ?? old.accessScope, nextRevision]);
    return { status: 200, body: { lesson: { id: old.id, revision: nextRevision, status } }, resourceType: 'lesson', resourceId: String(old.id) };
  });
  return sendMutation(c, result);
}

async function archiveLesson(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const courseKeyValue = courseKey(c);
  const lessonKey = requiredParam(c, 'lessonId');
  const scope = `platform.${admin ? 'admin' : 'instructor'}.lesson.archive:${courseKeyValue}:${lessonKey}`;
  const result = await withIdempotency(c, actor, scope, {}, async (db) => {
    const id = await authorizeCourseWrite(db, actor, courseKeyValue);
    const rows = await platformQuery<{ id: string }>(db, `
      UPDATE platform_lessons SET status='archived'
      WHERE course_id=$1::uuid AND (id::text=$2 OR slug=$2) RETURNING id::text AS id
    `, [id, lessonKey]);
    if (!rows[0]) notFound('Lesson');
    return { status: 200, body: { lesson: { ...rows[0], status: 'archived' } }, resourceType: 'lesson', resourceId: rows[0].id };
  });
  return sendMutation(c, result);
}

export function registerLessonRoutes(platformCatalogRoutes: Hono): void {
  platformCatalogRoutes.post('/platform/instructor/courses/:courseId/lessons', (c) => saveLesson(c, false, true));

  platformCatalogRoutes.patch('/platform/instructor/courses/:courseId/lessons/:lessonId', (c) => saveLesson(c, false, false));

  platformCatalogRoutes.post('/platform/admin/courses/:courseId/lessons', (c) => saveLesson(c, true, true));

  platformCatalogRoutes.patch('/platform/admin/courses/:courseId/lessons/:lessonId', (c) => saveLesson(c, true, false));

  platformCatalogRoutes.delete('/platform/instructor/courses/:courseId/lessons/:lessonId', (c) => archiveLesson(c, false));

  platformCatalogRoutes.delete('/platform/admin/courses/:courseId/lessons/:lessonId', (c) => archiveLesson(c, true));
}
