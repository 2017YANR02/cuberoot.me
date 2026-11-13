import { requirePlatformAdmin } from '../auth.js';
import { platformQuery, platformDb, withIdempotency, sendMutation } from '../db.js';
import { notFound, badRequest } from '../errors.js';
import { publicCache, privateNoStore } from '../http.js';
import {
  pagination,
  resourceId,
  type JsonObject,
  arrayField,
  isObject,
  nullableStringField,
  stringField,
  enumField,
  readJsonObject,
} from '../validation.js';
import { requiredParam } from './course-access.js';
import { SLUG, requireBilingualTitle } from './course-fields.js';
import { type Context, type Hono } from 'hono';

const PATH_STATUSES = ['draft', 'published', 'archived'] as const;

function pathFields(body: JsonObject, required: boolean) {
  const items = arrayField(body, 'items', { maxItems: 500 });
  const parsedItems = items?.map((value, index) => {
    if (!isObject(value)) badRequest(`items[${index}] must be an object`);
    const course = nullableStringField(value, 'courseId', { max: 128 });
    const lesson = nullableStringField(value, 'lessonId', { max: 128 });
    if ((course ? 1 : 0) + (lesson ? 1 : 0) !== 1) badRequest(`items[${index}] must select exactly one courseId or lessonId`);
    return { courseId: course, lessonId: lesson };
  });
  return {
    slug: stringField(body, 'slug', { required, max: 120, pattern: SLUG }),
    titleZh: stringField(body, 'titleZh', { max: 240 }), titleEn: stringField(body, 'titleEn', { max: 240 }),
    descriptionZh: stringField(body, 'descriptionZh', { max: 50_000, trim: false }),
    descriptionEn: stringField(body, 'descriptionEn', { max: 50_000, trim: false }),
    status: enumField(body, 'status', PATH_STATUSES), items: parsedItems,
  };
}

async function listAdminPaths(c: Context): Promise<Response> {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c, 100);
  const id = c.req.param('id') ? requiredParam(c, 'id') : null;
  const rows = await platformQuery(platformDb(), `
    SELECT COUNT(*) OVER()::int AS "resultTotal",p.id::text AS id, p.slug, p.title_zh AS "titleZh", p.title_en AS "titleEn",
      p.description_zh AS "descriptionZh", p.description_en AS "descriptionEn", p.status,
      COALESCE(jsonb_agg(jsonb_build_object('ordinal', i.ordinal, 'courseId', i.course_id::text, 'lessonId', i.lesson_id::text)
        ORDER BY i.ordinal) FILTER (WHERE i.ordinal IS NOT NULL), '[]'::jsonb) AS items
    FROM platform_learning_paths p LEFT JOIN platform_learning_path_items i ON i.path_id=p.id
    WHERE ($1::text IS NULL OR p.id::text=$1 OR p.slug=$1) AND ($4='' OR p.title_zh ILIKE '%'||$4||'%' OR p.title_en ILIKE '%'||$4||'%') GROUP BY p.id
    ORDER BY CASE WHEN $5='title' THEN COALESCE(NULLIF(p.title_zh,''),p.title_en) END ASC,p.updated_at DESC,p.id LIMIT $2 OFFSET $3
  `, [id, pageSize, offset,c.req.query('q')?.trim().slice(0,200)??'',c.req.query('sort')??'updated']);
  if (id && !rows[0]) notFound('Learning path');
  privateNoStore(c);
  return c.json(id ? { path: rows[0] } : { paths: rows, page, pageSize,total:Number(rows[0]?.resultTotal??0) });
}

async function savePath(c: Context, creating: boolean): Promise<Response> {
  const actor = await requirePlatformAdmin(c);
  const key = creating ? null : requiredParam(c, 'id');
  const body = await readJsonObject(c);
  const input = pathFields(body, creating);
  if (creating) requireBilingualTitle(input.titleZh, input.titleEn);
  const result = await withIdempotency(c, actor, `platform.admin.path.${creating ? 'create' : 'update'}:${key ?? 'new'}`, body, async (db) => {
    let id: string;
    if (creating) {
      const status = input.status ?? 'draft';
      const rows = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_learning_paths (slug,title_zh,title_en,description_zh,description_en,status,created_by_user_id,published_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,CASE WHEN $6::varchar='published' THEN NOW() ELSE NULL END)
        RETURNING id::text AS id
      `, [input.slug, input.titleZh ?? '', input.titleEn ?? '', input.descriptionZh ?? '', input.descriptionEn ?? '', status, actor.userId]);
      id = rows[0].id;
    } else {
      const rows = await platformQuery<{ id: string }>(db, `
        UPDATE platform_learning_paths SET slug=COALESCE($2,slug), title_zh=COALESCE($3,title_zh),
          title_en=COALESCE($4,title_en), description_zh=COALESCE($5,description_zh),
          description_en=COALESCE($6,description_en), status=COALESCE($7,status),
          published_at=CASE WHEN COALESCE($7,status)='published' THEN COALESCE(published_at,NOW()) ELSE published_at END
        WHERE id::text=$1 OR slug=$1 RETURNING id::text AS id
      `, [key, input.slug ?? null, input.titleZh ?? null, input.titleEn ?? null, input.descriptionZh ?? null, input.descriptionEn ?? null, input.status ?? null]);
      if (!rows[0]) notFound('Learning path');
      id = rows[0].id;
    }
    if (input.items) {
      await platformQuery(db, 'DELETE FROM platform_learning_path_items WHERE path_id=$1::uuid', [id]);
      for (let index = 0; index < input.items.length; index += 1) {
        const item = input.items[index];
        await platformQuery(db, `
          INSERT INTO platform_learning_path_items (path_id,ordinal,course_id,lesson_id)
          VALUES ($1::uuid,$2,$3::uuid,$4::uuid)
        `, [id, index, item.courseId, item.lessonId]);
      }
    }
    return { status: creating ? 201 : 200, body: { path: { id } }, resourceType: 'learning_path', resourceId: id };
  });
  return sendMutation(c, result);
}

export function registerPathRoutes(platformCatalogRoutes: Hono): void {
  platformCatalogRoutes.get('/platform/paths', async (c) => {
    const { page, pageSize, offset } = pagination(c, 60);
    const q=c.req.query('q')?.trim().slice(0,200)??'';
    const rows = await platformQuery(platformDb(), `
      SELECT COUNT(*) OVER()::int AS "resultTotal", p.id::text AS id, p.slug, p.title_zh AS "titleZh", p.title_en AS "titleEn",
        p.description_zh AS "descriptionZh", p.description_en AS "descriptionEn",
        p.status, p.published_at AS "publishedAt", COUNT(i.ordinal)::int AS "itemCount"
      FROM platform_learning_paths p
      LEFT JOIN platform_learning_path_items i ON i.path_id = p.id
      WHERE p.status = 'published' AND ($3='' OR p.title_zh ILIKE '%'||$3||'%' OR p.title_en ILIKE '%'||$3||'%')
      GROUP BY p.id ORDER BY CASE WHEN $4='title' THEN COALESCE(NULLIF(p.title_zh,''),p.title_en) END ASC, p.updated_at DESC, p.id LIMIT $1 OFFSET $2
    `, [pageSize, offset,q,c.req.query('sort')??'updated']);
    publicCache(c, rows.length > 0);
    return c.json({ paths: rows, page, pageSize, total:Number(rows[0]?.resultTotal??0) });
  });

  platformCatalogRoutes.get('/platform/paths/:id', async (c) => {
    const key = resourceId(c.req.param('id'));
    const rows = await platformQuery(platformDb(), `
      SELECT p.id::text AS id, p.slug, p.title_zh AS "titleZh", p.title_en AS "titleEn",
        p.description_zh AS "descriptionZh", p.description_en AS "descriptionEn", p.status,
        COALESCE(jsonb_agg(jsonb_build_object(
          'ordinal', i.ordinal, 'courseId', i.course_id::text, 'lessonId', i.lesson_id::text,
          'courseSlug', c.slug, 'lessonSlug', l.slug, 'lessonCourseId', l.course_id::text,
          'totalLessons', CASE WHEN i.lesson_id IS NOT NULL THEN 1 ELSE (SELECT COUNT(*) FROM platform_lessons pl WHERE pl.course_id=i.course_id AND pl.status='published') END,
          'titleZh', COALESCE(cr.title_zh, lr.title_zh), 'titleEn', COALESCE(cr.title_en, lr.title_en)
        ) ORDER BY i.ordinal) FILTER (WHERE i.ordinal IS NOT NULL), '[]'::jsonb) AS items
      FROM platform_learning_paths p
      LEFT JOIN platform_learning_path_items i ON i.path_id = p.id
      LEFT JOIN platform_courses c ON c.id = i.course_id
      LEFT JOIN platform_course_revisions cr ON cr.course_id = c.id AND cr.revision = c.current_revision
      LEFT JOIN platform_lessons l ON l.id = i.lesson_id
      LEFT JOIN platform_lesson_revisions lr ON lr.lesson_id = l.id AND lr.revision = l.current_revision
      WHERE (p.id::text = $1 OR p.slug = $1) AND p.status = 'published'
      GROUP BY p.id
    `, [key]);
    if (!rows[0]) notFound('Learning path');
    publicCache(c);
    return c.json({ path: rows[0] });
  });

  platformCatalogRoutes.get('/platform/admin/paths', listAdminPaths);

  platformCatalogRoutes.get('/platform/admin/paths/:id', listAdminPaths);

  platformCatalogRoutes.post('/platform/admin/paths', (c) => savePath(c, true));

  platformCatalogRoutes.patch('/platform/admin/paths/:id', (c) => savePath(c, false));

  platformCatalogRoutes.delete('/platform/admin/paths/:id', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const body = {};
    const result = await withIdempotency(c, actor, `platform.admin.path.archive:${id}`, body, async (db) => {
      const rows = await platformQuery<{ id: string }>(db, `
        UPDATE platform_learning_paths SET status='archived' WHERE id::text=$1 OR slug=$1 RETURNING id::text AS id
      `, [id]);
      if (!rows[0]) notFound('Learning path');
      return { status: 200, body: { path: rows[0] }, resourceType: 'learning_path', resourceId: rows[0].id };
    });
    return sendMutation(c, result);
  });
}
