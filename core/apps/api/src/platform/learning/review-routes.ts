import { requirePlatformActor } from '../auth.js';
import { findCourseReviewEntitlement, withIdempotency, platformQuery, sendMutation } from '../db.js';
import { badRequest } from '../errors.js';
import { resourceId, readJsonObject, integerField, stringField } from '../validation.js';
import { type Hono } from 'hono';

export function registerReviewRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.post('/courses/:courseId/reviews', async (c) => {
    const actor = await requirePlatformActor(c);
    const courseId = resourceId(c.req.param('courseId'), 'courseId');
    const body = await readJsonObject(c);
    const rating = integerField(body, 'rating', { required: true, min: 1, max: 5 })!;
    const reviewTitle = stringField(body, 'title', { max: 160 }) ?? '';
    const reviewBody = stringField(body, 'body', { max: 20_000 }) ?? '';
    const result = await withIdempotency(c, actor, `learning.review:${courseId}`, body, async (db) => {
      const entitlementId = await findCourseReviewEntitlement(db, actor.userId, courseId);
      if (!entitlementId) badRequest('An active course entitlement is required to review');
      const rows = await platformQuery(db, `
        INSERT INTO platform_course_reviews (user_id, course_id, entitlement_id, rating, body, title)
        VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6)
        ON CONFLICT (user_id, course_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, title = EXCLUDED.title,
          entitlement_id = EXCLUDED.entitlement_id, status = 'published', moderation_note = NULL
        RETURNING id::text, course_id::text AS "courseId", rating, body, title, status,
                  created_at AS "createdAt", updated_at AS "updatedAt"
      `, [actor.userId, courseId, entitlementId, rating, reviewBody, reviewTitle]);
      return { status: 200, body: rows[0]!, resourceType: 'course_review', resourceId: String(rows[0]!.id) };
    });
    return sendMutation(c, result);
  });
}
