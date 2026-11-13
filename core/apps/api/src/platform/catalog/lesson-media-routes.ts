import {
  type ReceivedMusicFile,
  receiveMusicFile,
  COVER_MAX_BYTES,
  sniffMusicCover,
  MusicUploadError,
  COVER_EXT,
} from '../../utils/music_upload.js';
import { requirePlatformAdmin, requirePlatformActor } from '../auth.js';
import { platformDb, platformQuery, withIdempotency, sendMutation } from '../db.js';
import { notFound, badRequest } from '../errors.js';
import { privateNoStore } from '../http.js';
import { createPlatformMediaToken, platformMediaPath } from '../media_access.js';
import { authorizeCourseWrite, courseKey, requiredParam } from './course-access.js';
import { hashJson } from './course-fields.js';
import { type Context, type Hono } from 'hono';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';

function managedLessonAssetUrl(c: Context, lessonId: string, revision: number, asset: { id: string }, kind: 'media' | 'cover') {
  const binding = `${kind === 'media' ? 'lesson' : 'lesson-cover'}:${lessonId}:${revision}`;
  const signed = createPlatformMediaToken({ mediaId: asset.id, binding });
  const url = new URL(`/v1/platform/lessons/${encodeURIComponent(lessonId)}/${kind}`, c.req.url);
  url.searchParams.set('token', signed.token);
  return { url: url.toString(), expiresAt: signed.expiresAt };
}

async function managedLessonMedia(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  const db = platformDb();
  const id = await authorizeCourseWrite(db, actor, courseKey(c));
  const lessonKey = requiredParam(c, 'lessonId');
  const rows = await platformQuery<{
    lessonId: string; revision: number;
    mediaId: string | null; mediaMimeType: string | null; mediaSizeBytes: number | string | null;
    coverMediaId: string | null; coverMimeType: string | null; coverSizeBytes: number | string | null;
  }>(db, `
    SELECT lesson.id::text AS "lessonId", lesson.current_revision AS revision,
      media.id::text AS "mediaId", media.mime_type AS "mediaMimeType", media.size_bytes AS "mediaSizeBytes",
      cover.id::text AS "coverMediaId", cover.mime_type AS "coverMimeType", cover.size_bytes AS "coverSizeBytes"
    FROM platform_lessons lesson
    JOIN platform_lesson_revisions revision
      ON revision.lesson_id = lesson.id AND revision.revision = lesson.current_revision
    LEFT JOIN platform_media_assets media ON media.id = revision.media_id AND media.status = 'ready'
    LEFT JOIN platform_media_assets cover ON cover.id = revision.cover_media_id AND cover.status = 'ready'
    WHERE lesson.course_id = $1::uuid AND (lesson.id::text = $2 OR lesson.slug = $2)
  `, [id, lessonKey]);
  const row = rows[0];
  if (!row) notFound('Lesson');
  const media = row.mediaId ? managedLessonAssetUrl(c, row.lessonId, row.revision, { id: row.mediaId }, 'media') : null;
  const cover = row.coverMediaId ? managedLessonAssetUrl(c, row.lessonId, row.revision, { id: row.coverMediaId }, 'cover') : null;
  privateNoStore(c);
  return c.json({
    mediaId: row.mediaId,
    mimeType: row.mediaMimeType,
    sizeBytes: row.mediaSizeBytes == null ? null : Number(row.mediaSizeBytes),
    accessUrl: media?.url ?? null,
    expiresAt: media?.expiresAt ?? null,
    posterUrl: cover?.url ?? null,
    posterMediaId: row.coverMediaId,
    posterMimeType: row.coverMimeType,
    posterSizeBytes: row.coverSizeBytes == null ? null : Number(row.coverSizeBytes),
  });
}

async function uploadLessonCover(c: Context, admin: boolean): Promise<Response> {
  const actor = admin ? await requirePlatformAdmin(c) : await requirePlatformActor(c);
  if (actor.userId == null) badRequest('A signed-in account is required to upload a lesson cover');
  let received: ReceivedMusicFile;
  try {
    received = await receiveMusicFile(c.req.raw.body, platformMediaPath('.tmp'), COVER_MAX_BYTES, sniffMusicCover, 'cover');
  } catch (error) {
    if (error instanceof MusicUploadError) badRequest(error.message);
    throw error;
  }
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(received.tempPath)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  const storageKey = `lesson-covers/${randomUUID()}.${COVER_EXT[received.mime]}`;
  const finalPath = platformMediaPath(storageKey);
  let stored = false;
  try {
    const courseKeyValue = courseKey(c);
    const lessonKey = requiredParam(c, 'lessonId');
    const result = await withIdempotency(c, actor,
      `platform.${admin ? 'admin' : 'instructor'}.lesson.cover:${courseKeyValue}:${lessonKey}`,
      { sha256, sizeBytes: received.sizeBytes, mimeType: received.mime }, async (db) => {
        const id = await authorizeCourseWrite(db, actor, courseKeyValue);
        const rows = await platformQuery<Record<string, unknown>>(db, `
          SELECT lesson.id::text AS id, lesson.current_revision AS "currentRevision",
            revision.title_zh AS "titleZh", revision.title_en AS "titleEn",
            revision.body_zh AS "bodyZh", revision.body_en AS "bodyEn",
            revision.media_id::text AS "mediaId", revision.duration_seconds AS "durationSeconds",
            revision.status
          FROM platform_lessons lesson
          JOIN platform_lesson_revisions revision
            ON revision.lesson_id = lesson.id AND revision.revision = lesson.current_revision
          WHERE lesson.course_id = $1::uuid AND (lesson.id::text = $2 OR lesson.slug = $2)
          FOR UPDATE
        `, [id, lessonKey]);
        const old = rows[0];
        if (!old) notFound('Lesson');
        await fs.mkdir(path.dirname(finalPath), { recursive: true });
        await fs.rename(received.tempPath, finalPath);
        stored = true;
        const assets = await platformQuery<{ id: string }>(db, `
          INSERT INTO platform_media_assets (
            owner_user_id, storage_key, mime_type, size_bytes, sha256, access_scope, status, metadata
          ) VALUES ($1, $2, $3, $4, decode($5, 'hex'), 'entitled', 'ready', $6::jsonb)
          RETURNING id::text AS id
        `, [actor.userId, storageKey, received.mime, received.sizeBytes, sha256, { source: 'lesson_cover' }]);
        const coverMediaId = assets[0]!.id;
        const nextRevision = Number(old.currentRevision) + 1;
        const revision = {
          titleZh: old.titleZh, titleEn: old.titleEn, bodyZh: old.bodyZh, bodyEn: old.bodyEn,
          mediaId: old.mediaId ?? null, coverMediaId,
        };
        await platformQuery(db, `
          INSERT INTO platform_lesson_revisions (
            lesson_id, revision, title_zh, title_en, body_zh, body_en, media_id, cover_media_id,
            duration_seconds, status, content_hash, created_by_user_id, published_by_user_id, published_at
          ) VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::uuid, $8::uuid,
            $9, $10, decode($11, 'hex'), $12,
            CASE WHEN $10::varchar = 'published' THEN $12::bigint ELSE NULL END,
            CASE WHEN $10::varchar = 'published' THEN NOW() ELSE NULL END)
        `, [old.id, nextRevision, old.titleZh, old.titleEn, old.bodyZh, old.bodyEn, old.mediaId ?? null,
          coverMediaId, old.durationSeconds, old.status, hashJson(revision), actor.userId]);
        await platformQuery(db, `UPDATE platform_lessons SET current_revision = $2 WHERE id = $1::uuid`, [old.id, nextRevision]);
        return {
          status: 200,
          body: { lesson: { id: old.id, revision: nextRevision, coverMediaId } },
          resourceType: 'lesson', resourceId: String(old.id),
        };
      });
    stored = false;
    return sendMutation(c, result);
  } catch (error) {
    if (stored) await fs.unlink(finalPath).catch(() => {});
    throw error;
  } finally {
    await fs.unlink(received.tempPath).catch(() => {});
  }
}

export function registerLessonMediaRoutes(platformCatalogRoutes: Hono): void {
  platformCatalogRoutes.get('/platform/instructor/courses/:courseId/lessons/:lessonId/media', (c) => managedLessonMedia(c, false));

  platformCatalogRoutes.get('/platform/admin/courses/:courseId/lessons/:lessonId/media', (c) => managedLessonMedia(c, true));

  platformCatalogRoutes.put('/platform/instructor/courses/:courseId/lessons/:lessonId/cover', (c) => uploadLessonCover(c, false));

  platformCatalogRoutes.put('/platform/admin/courses/:courseId/lessons/:lessonId/cover', (c) => uploadLessonCover(c, true));
}
