import { requirePlatformActor } from '../auth.js';
import { platformQuery, platformDb, withIdempotency, sendMutation } from '../db.js';
import { notFound } from '../errors.js';
import { privateNoStore } from '../http.js';
import { resourceId, readJsonObject, enumField, booleanField } from '../validation.js';
import { type Hono } from 'hono';

async function mutateFavorite(c: Parameters<typeof requirePlatformActor>[0], forcedType?: 'product') {
  const actor = await requirePlatformActor(c);
  const targetId = resourceId(c.req.param('id') ?? '');
  const body = await readJsonObject(c);
  const targetType = forcedType ?? enumField(body, 'targetType', ['course', 'product', 'event', 'news'] as const, { required: true })!;
  const enabled = booleanField(body, 'active') ?? booleanField(body, 'enabled') ?? true;
  const column = targetType === 'course' ? 'course_id' : targetType === 'product' ? 'product_id' : targetType === 'news' ? 'news_article_id' : 'event_id';
  const table = targetType === 'course' ? 'platform_courses' : targetType === 'product' ? 'platform_products' : targetType === 'news' ? 'platform_news_articles' : 'platform_events';
  const result = await withIdempotency(c, actor, `learning.favorite:${targetType}:${targetId}`, body, async (db) => {
    const exists = await platformQuery(db, `SELECT id::text FROM ${table} WHERE id = $1::uuid`, [targetId]);
    if (!exists[0]) notFound(targetType);
    if (enabled) {
      await platformQuery(db, `
        INSERT INTO platform_favorites (user_id, target_type, ${column}) VALUES ($1, $2, $3::uuid)
        ON CONFLICT DO NOTHING
      `, [actor.userId, targetType, targetId]);
    } else {
      await platformQuery(db, `DELETE FROM platform_favorites WHERE user_id = $1 AND ${column} = $2::uuid`, [actor.userId, targetId]);
    }
    return { status: 200, body: { id: targetId, targetType, enabled }, resourceType: 'favorite', resourceId: targetId };
  });
  return sendMutation(c, result);
}

export function registerFavoriteRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.get('/me/favorites', async (c) => {
    const actor = await requirePlatformActor(c);
    const rows = await platformQuery(platformDb(), `
      SELECT COALESCE(f.course_id, f.product_id, f.event_id, f.news_article_id)::text AS id, f.target_type AS "targetType",
             COALESCE(cr.title_zh,product.title_zh,event.title_zh,news.title_zh) AS "titleZh",
             COALESCE(cr.title_en,product.title_en,event.title_en,news.title_en) AS "titleEn",
             COALESCE(NULLIF(cr.title_zh, ''), cr.title_en,
                      NULLIF(product.title_zh, ''), product.title_en,
                      NULLIF(event.title_zh, ''), event.title_en, NULLIF(news.title_zh,''),news.title_en) AS title,
             f.created_at AS "createdAt"
      FROM platform_favorites f
      LEFT JOIN platform_courses course ON course.id = f.course_id
      LEFT JOIN platform_course_revisions cr ON cr.course_id = course.id AND cr.revision = course.current_revision
      LEFT JOIN platform_products product ON product.id = f.product_id
      LEFT JOIN platform_events event ON event.id = f.event_id
      LEFT JOIN platform_news_articles news ON news.id=f.news_article_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `, [actor.userId]);
    privateNoStore(c);
    return c.json({ items: rows });
  });

  platformLearningRoutes.get('/me/wishlist', async (c) => {
    const actor = await requirePlatformActor(c);
    const rows = await platformQuery(platformDb(), `
      SELECT f.product_id::text AS id, 'product' AS "targetType", product.title_zh AS "titleZh", product.title_en AS "titleEn",
             COALESCE(NULLIF(product.title_zh, ''), product.title_en) AS title,
             f.created_at AS "createdAt"
      FROM platform_favorites f
      JOIN platform_products product ON product.id = f.product_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `, [actor.userId]);
    privateNoStore(c);
    return c.json({ items: rows });
  });

  platformLearningRoutes.put('/me/favorites/:id', (c) => mutateFavorite(c));

  platformLearningRoutes.put('/me/wishlist/:id', (c) => mutateFavorite(c, 'product'));
}
