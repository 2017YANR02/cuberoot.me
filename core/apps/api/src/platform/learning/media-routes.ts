import { requirePlatformActor } from '../auth.js';
import { platformDb, platformQuery, requireCourseEntitlement } from '../db.js';
import { badRequest, notFound, PlatformApiError } from '../errors.js';
import { privateNoStore } from '../http.js';
import { verifyPlatformMediaToken, servePlatformMedia, createPlatformMediaToken } from '../media_access.js';
import { resourceId } from '../validation.js';
import { type Context, type Hono } from 'hono';

async function lessonMediaContext(c: Context) {
  const lessonKey = c.req.param('lessonId');
  if (!lessonKey) badRequest('lessonId is required');
  const lessonId = resourceId(lessonKey, 'lessonId');
  const token = c.req.query('token');
  const db = platformDb();
  const lessons = await platformQuery<{
    current_revision: number; course_id: string; access_scope: string;
    media_id: string | null; media_storage_key: string | null; media_mime_type: string | null; media_size_bytes: number | string | null;
    cover_id: string | null; cover_storage_key: string | null; cover_mime_type: string | null; cover_size_bytes: number | string | null;
  }>(db, `
    SELECT lesson.current_revision, lesson.course_id::text, lesson.access_scope,
      media.id::text AS media_id, media.storage_key AS media_storage_key,
      media.mime_type AS media_mime_type, media.size_bytes AS media_size_bytes,
      cover.id::text AS cover_id, cover.storage_key AS cover_storage_key,
      cover.mime_type AS cover_mime_type, cover.size_bytes AS cover_size_bytes
    FROM platform_lessons lesson JOIN platform_courses course ON course.id = lesson.course_id
    JOIN platform_lesson_revisions revision
      ON revision.lesson_id = lesson.id AND revision.revision = lesson.current_revision
    LEFT JOIN platform_media_assets media
      ON media.id = revision.media_id AND media.status = 'ready' AND media.access_scope IN ('public', 'entitled')
    LEFT JOIN platform_media_assets cover
      ON cover.id = revision.cover_media_id AND cover.status = 'ready' AND cover.access_scope IN ('public', 'entitled')
    WHERE lesson.id = $1::uuid AND lesson.current_revision IS NOT NULL
      AND ($2::boolean OR (lesson.status = 'published' AND course.status IN ('published', 'unlisted')))
  `, [lessonId, token != null]);
  const lesson = lessons[0];
  if (!lesson) notFound('Lesson');
  if (token == null && lesson.access_scope !== 'public') {
    await requireCourseEntitlement(db, await requirePlatformActor(c), lesson.course_id, lessonId);
  }
  return { lessonId, token, lesson };
}

export function registerMediaRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.get('/lessons/:lessonId/media', async (c) => {
    const { lessonId, token, lesson } = await lessonMediaContext(c);
    const revision = lesson.current_revision;
    if (!lesson.media_id || !lesson.media_storage_key || !lesson.media_mime_type || lesson.media_size_bytes == null) notFound('Lesson media');
    const asset = {
      id: lesson.media_id,
      storage_key: lesson.media_storage_key,
      mime_type: lesson.media_mime_type,
      size_bytes: lesson.media_size_bytes,
    };
    const binding = `lesson:${lessonId}:${revision}`;
    if (token != null) {
      if (!verifyPlatformMediaToken({ token, mediaId: asset.id, binding })) {
        throw new PlatformApiError('FORBIDDEN', 403, 'Media access token is invalid or expired');
      }
      return servePlatformMedia(c, {
        storageKey: asset.storage_key,
        mimeType: asset.mime_type,
        sizeBytes: asset.size_bytes,
      }, 'private, no-store');
    }
    const signed = createPlatformMediaToken({ mediaId: asset.id, binding });
    const accessUrl = new URL(c.req.url);
    accessUrl.search = '';
    accessUrl.searchParams.set('token', signed.token);
    let posterUrl: string | null = null;
    if (lesson.cover_id) {
      const poster = createPlatformMediaToken({
        mediaId: lesson.cover_id,
        binding: `lesson-cover:${lessonId}:${revision}`,
      });
      const url = new URL(c.req.url);
      url.pathname = url.pathname.replace(/\/media$/, '/cover');
      url.search = '';
      url.searchParams.set('token', poster.token);
      posterUrl = url.toString();
    }
    privateNoStore(c);
    return c.json({
      mediaId: asset.id,
      mimeType: asset.mime_type,
      sizeBytes: Number(asset.size_bytes),
      accessUrl: accessUrl.toString(),
      expiresAt: signed.expiresAt,
      posterUrl,
    });
  });

  platformLearningRoutes.get('/lessons/:lessonId/cover', async (c) => {
    const { lessonId, token, lesson } = await lessonMediaContext(c);
    if (!lesson.cover_id || !lesson.cover_storage_key || !lesson.cover_mime_type || lesson.cover_size_bytes == null) {
      notFound('Lesson cover');
    }
    const binding = `lesson-cover:${lessonId}:${lesson.current_revision}`;
    if (token != null && !verifyPlatformMediaToken({ token, mediaId: lesson.cover_id, binding })) {
      throw new PlatformApiError('FORBIDDEN', 403, 'Media access token is invalid or expired');
    }
    return servePlatformMedia(c, {
      storageKey: lesson.cover_storage_key,
      mimeType: lesson.cover_mime_type,
      sizeBytes: lesson.cover_size_bytes,
    }, 'private, no-store');
  });
}
