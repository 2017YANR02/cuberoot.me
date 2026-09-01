import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { requirePlatformActor, requirePlatformAdmin } from '../platform/auth.js';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../platform/data_encryption.js';
import {
  enqueuePlatformEvent,
  platformDb,
  platformQuery,
  requireCourseEntitlement,
  requireCourseOwner,
  requireInstructor,
  sendMutation,
  withIdempotency,
  type PlatformDb,
} from '../platform/db.js';
import { badRequest, conflict, notFound, PlatformApiError } from '../platform/errors.js';
import { physicalBundleCredentialHash, revokePhysicalBundleInvite } from '../platform/physical_bundle.js';
import { platformRouter, privateNoStore, publicCache } from '../platform/http.js';
import {
  createPlatformMediaToken,
  servePlatformMedia,
  verifyPlatformMediaToken,
} from '../platform/media_access.js';
import {
  normalizePlatformQuizAnswer,
  platformQuizAnswersEqual,
  type PlatformQuizAnswer,
  type PlatformQuizQuestionType,
} from '../platform/quiz_answers.js';
import {
  booleanField,
  enumField,
  integerField,
  isObject,
  isoTimestampField,
  nullableStringField,
  objectField,
  pagination,
  readJsonObject,
  resourceId,
  stringField,
} from '../platform/validation.js';

export const platformLearningRoutes = platformRouter();

async function requireLessonAccess(
  actor: Awaited<ReturnType<typeof requirePlatformActor>>,
  lessonId: string,
  db: PlatformDb = platformDb(),
): Promise<{ courseId: string; revision: number }> {
  const rows = await platformQuery<{ course_id: string; current_revision: number; access_scope: string }>(db, `
    SELECT course_id::text, current_revision, access_scope
    FROM platform_lessons
    WHERE id = $1::uuid AND status = 'published' AND current_revision IS NOT NULL
  `, [lessonId]);
  const lesson = rows[0];
  if (!lesson) notFound('Lesson');
  if (lesson.access_scope !== 'public') {
    await requireCourseEntitlement(db, actor, lesson.course_id);
  }
  return { courseId: lesson.course_id, revision: lesson.current_revision };
}

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

const ANALYTICS_DIMENSION_KEYS = new Set([
  'action',
  'contentType',
  'deviceClass',
  'entryPoint',
  'language',
  'resourceType',
  'result',
  'variant',
]);

function analyticsDimensions(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (!isObject(raw)) badRequest('dimensions must be an object');
  const entries = Object.entries(raw);
  if (entries.length > 8) badRequest('dimensions may contain at most 8 fields');
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (!ANALYTICS_DIMENSION_KEYS.has(key)) badRequest(`dimensions.${key} is not allowed`);
    const values = Array.isArray(value) ? value : [value];
    if (values.length === 0 || values.length > 10) badRequest(`dimensions.${key} has an invalid array length`);
    const safeValues = values.map((item) => {
      if (typeof item === 'boolean') return item;
      if (typeof item === 'number' && Number.isSafeInteger(item) && Math.abs(item) <= 1_000_000) return item;
      if (typeof item === 'string') {
        const text = item.trim();
        if (text && text.length <= 120 && !/[\u0000-\u001f\u007f]/.test(text)) return text;
      }
      badRequest(`dimensions.${key} contains an unsupported value`);
    });
    normalized[key] = Array.isArray(value) ? safeValues : safeValues[0];
  }
  return normalized;
}

platformLearningRoutes.get('/entitlements', async (c) => {
  const actor = await requirePlatformActor(c);
  const rows = await platformQuery(platformDb(), `
    SELECT e.id::text, e.course_id::text AS "courseId", e.status,
           e.valid_from AS "validFrom", e.valid_until AS "validUntil",
           COALESCE(NULLIF(cr.title_zh, ''), cr.title_en) AS title,
           cr.title_zh AS "titleZh", cr.title_en AS "titleEn"
    FROM platform_course_entitlements e
    JOIN platform_courses course ON course.id = e.course_id
    LEFT JOIN platform_course_revisions cr
      ON cr.course_id = course.id AND cr.revision = course.current_revision
    WHERE e.user_id = $1
    ORDER BY e.updated_at DESC, e.id
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows });
});

platformLearningRoutes.get('/me/courses', async (c) => {
  const actor = await requirePlatformActor(c);
  const rows = await platformQuery(platformDb(), `
    SELECT e.course_id::text AS id, course.slug, e.status,
           COALESCE(NULLIF(cr.title_zh, ''), cr.title_en) AS title,
           cr.title_zh AS "titleZh", cr.title_en AS "titleEn",
           COALESCE(ROUND(AVG(progress.progress_bps))::integer, 0) AS "progressBps"
    FROM platform_course_entitlements e
    JOIN platform_courses course ON course.id = e.course_id
    LEFT JOIN platform_course_revisions cr
      ON cr.course_id = course.id AND cr.revision = course.current_revision
    LEFT JOIN platform_lessons lesson ON lesson.course_id = course.id AND lesson.status = 'published'
    LEFT JOIN platform_lesson_progress progress
      ON progress.lesson_id = lesson.id AND progress.user_id = e.user_id
    WHERE e.user_id = $1
    GROUP BY e.course_id, course.slug, e.status, cr.title_zh, cr.title_en
    ORDER BY MAX(e.updated_at) DESC, e.course_id
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows });
});

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
  const positionSeconds = integerField(body, 'positionSeconds', { min: 0, max: 86_400 }) ?? 0;
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
        CASE WHEN $4 <> 'not_started' THEN NOW() END,
        CASE WHEN $4 = 'completed' THEN NOW() END
      )
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        lesson_revision = EXCLUDED.lesson_revision,
        status = EXCLUDED.status,
        progress_bps = EXCLUDED.progress_bps,
        position_seconds = EXCLUDED.position_seconds,
        started_at = COALESCE(platform_lesson_progress.started_at, EXCLUDED.started_at),
        completed_at = CASE WHEN EXCLUDED.status = 'completed'
          THEN COALESCE(platform_lesson_progress.completed_at, NOW()) ELSE NULL END
      RETURNING lesson_id::text AS id, lesson_revision AS "lessonRevision", status,
                progress_bps AS "progressBps", position_seconds AS "positionSeconds",
                started_at AS "startedAt", completed_at AS "completedAt", updated_at AS "updatedAt"
    `, [actor.userId, lessonId, lesson.revision, status, progressBps, positionSeconds]);
    await enqueuePlatformEvent(db, 'learning.progress_updated', 'lesson', lessonId,
      `learning.progress:${lessonId}:${lesson.revision}:${progressBps}:${positionSeconds}:${randomUUID()}`, {
        lessonId, courseId: lesson.courseId, progressBps, status,
      });
    return { status: 200, body: rows[0]!, resourceType: 'lesson_progress', resourceId: lessonId };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.get('/me/notes', async (c) => {
  const actor = await requirePlatformActor(c);
  const rows = await platformQuery(platformDb(), `
    SELECT n.id::text, n.lesson_id::text AS "lessonId", lesson.course_id::text AS "courseId",
           n.position_seconds AS "positionSeconds", n.body,
           n.created_at AS "createdAt", n.updated_at AS "updatedAt",
           COALESCE(NULLIF(lr.title_zh, ''), lr.title_en) AS title
    FROM platform_lesson_notes n
    JOIN platform_lessons lesson ON lesson.id = n.lesson_id
    LEFT JOIN platform_lesson_revisions lr
      ON lr.lesson_id = lesson.id AND lr.revision = lesson.current_revision
    WHERE n.user_id = $1
    ORDER BY n.updated_at DESC, n.id
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows });
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

platformLearningRoutes.get('/me/favorites', async (c) => {
  const actor = await requirePlatformActor(c);
  const rows = await platformQuery(platformDb(), `
    SELECT COALESCE(f.course_id, f.product_id, f.event_id)::text AS id, f.target_type AS "targetType",
           COALESCE(NULLIF(cr.title_zh, ''), cr.title_en,
                    NULLIF(product.title_zh, ''), product.title_en,
                    NULLIF(event.title_zh, ''), event.title_en) AS title,
           f.created_at AS "createdAt"
    FROM platform_favorites f
    LEFT JOIN platform_courses course ON course.id = f.course_id
    LEFT JOIN platform_course_revisions cr ON cr.course_id = course.id AND cr.revision = course.current_revision
    LEFT JOIN platform_products product ON product.id = f.product_id
    LEFT JOIN platform_events event ON event.id = f.event_id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows });
});

platformLearningRoutes.get('/me/wishlist', async (c) => {
  const actor = await requirePlatformActor(c);
  const rows = await platformQuery(platformDb(), `
    SELECT f.product_id::text AS id, 'product' AS "targetType",
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

async function mutateFavorite(c: Parameters<typeof requirePlatformActor>[0], forcedType?: 'product') {
  const actor = await requirePlatformActor(c);
  const targetId = resourceId(c.req.param('id') ?? '');
  const body = await readJsonObject(c);
  const targetType = forcedType ?? enumField(body, 'targetType', ['course', 'product', 'event'] as const, { required: true })!;
  const enabled = booleanField(body, 'active') ?? booleanField(body, 'enabled') ?? true;
  const column = targetType === 'course' ? 'course_id' : targetType === 'product' ? 'product_id' : 'event_id';
  const table = targetType === 'course' ? 'platform_courses' : targetType === 'product' ? 'platform_products' : 'platform_events';
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

platformLearningRoutes.put('/me/favorites/:id', (c) => mutateFavorite(c));
platformLearningRoutes.put('/me/wishlist/:id', (c) => mutateFavorite(c, 'product'));

platformLearningRoutes.get('/me/badges', async (c) => {
  const actor = await requirePlatformActor(c);
  const rows = await platformQuery(platformDb(), `
    SELECT ua.id::text, a.achievement_key AS "achievementKey",
           COALESCE(NULLIF(a.title_zh, ''), a.title_en) AS title,
           a.title_zh AS "titleZh", a.title_en AS "titleEn",
           a.description_zh AS "descriptionZh", a.description_en AS "descriptionEn",
           a.point_reward AS "pointReward", ua.evidence_snapshot AS evidence,
           ua.awarded_at AS "awardedAt"
    FROM platform_user_achievements ua
    JOIN platform_achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = $1 AND a.status <> 'archived'
    ORDER BY ua.awarded_at DESC, ua.id
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows });
});

platformLearningRoutes.get('/me/invites', async (c) => {
  const actor = await requirePlatformActor(c);
  const rows = await platformQuery(platformDb(), `
    SELECT r.id::text, r.redeemed_at AS "redeemedAt", i.label AS title,
           r.entitlement_id::text AS "entitlementId", r.membership_id::text AS "membershipId"
    FROM platform_invite_redemptions r
    JOIN platform_invite_codes i ON i.id = r.invite_code_id
    WHERE r.user_id = $1
    ORDER BY r.redeemed_at DESC, r.id
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows });
});

platformLearningRoutes.post('/courses/:courseId/enrollment', async (c) => {
  const actor = await requirePlatformActor(c);
  const courseId = resourceId(c.req.param('courseId'), 'courseId');
  const body = await readJsonObject(c);
  const result = await withIdempotency(c, actor, `learning.enrollment:${courseId}`, body, async (db) => {
    const courses = await platformQuery<{ enrollment_mode: string }>(db, `
      SELECT enrollment_mode FROM platform_courses
      WHERE id = $1::uuid AND status IN ('published', 'unlisted') FOR SHARE
    `, [courseId]);
    const course = courses[0];
    if (!course) notFound('Course');
    if (course.enrollment_mode === 'purchase') {
      conflict('This course requires an order');
    }
    if (course.enrollment_mode === 'invite') {
      conflict('This course requires an invitation code');
    }
    if (course.enrollment_mode !== 'free') {
      throw new PlatformApiError('FORBIDDEN', 403, 'This course requires an administrator grant');
    }
    const existing = await platformQuery<{ id: string; status: string }>(db, `
      SELECT id::text, status FROM platform_course_entitlements
      WHERE user_id = $1 AND course_id = $2::uuid FOR UPDATE
    `, [actor.userId, courseId]);
    if (existing[0]?.status === 'active') {
      return { status: 200, body: { id: existing[0].id, courseId, status: 'active' }, resourceType: 'course_entitlement', resourceId: existing[0].id };
    }
    const rows = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_course_entitlements (user_id, course_id, status, valid_from, valid_until)
      VALUES ($1, $2::uuid, 'active', NOW(), NULL)
      ON CONFLICT (user_id, course_id) DO UPDATE
        SET status = 'active', valid_from = NOW(), valid_until = NULL
      RETURNING id::text
    `, [actor.userId, courseId]);
    await platformQuery(db, `
      INSERT INTO platform_entitlement_ledger (
        entitlement_id, entry_type, delta_access, valid_from, reason, actor_user_id
      ) VALUES ($1::uuid, 'grant', 1, NOW(), 'free course self-enrollment', $2)
    `, [rows[0].id, actor.userId]);
    await enqueuePlatformEvent(db, 'learning.course_enrolled', 'course_entitlement', rows[0].id,
      `learning.enrollment:${rows[0].id}:${Date.now()}`, { courseId });
    return { status: 201, body: { id: rows[0].id, courseId, status: 'active' }, resourceType: 'course_entitlement', resourceId: rows[0].id };
  });
  return sendMutation(c, result);
});

function physicalBundleCode(): string {
  return `CR-${randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-')}`;
}

function inviteBenefit(body: Record<string, unknown>): { courseId?: string; membershipPlanId?: string } {
  const raw = objectField(body, 'benefitSnapshot') ?? objectField(body, 'benefit', { required: true })!;
  const courseId = stringField(raw, 'courseId', { max: 128 });
  const membershipPlanId = stringField(raw, 'membershipPlanId', { max: 128 });
  if ((courseId == null) === (membershipPlanId == null)) {
    badRequest('benefit must identify exactly one courseId or membershipPlanId');
  }
  return {
    ...(courseId ? { courseId: resourceId(courseId, 'courseId') } : {}),
    ...(membershipPlanId ? { membershipPlanId: resourceId(membershipPlanId, 'membershipPlanId') } : {}),
  };
}

function addMembershipPeriod(base: Date, unit: string, count: number): string | null {
  if (unit === 'lifetime') return null;
  const result = new Date(base);
  if (unit === 'day') result.setUTCDate(result.getUTCDate() + count);
  else if (unit === 'month') result.setUTCMonth(result.getUTCMonth() + count);
  else result.setUTCFullYear(result.getUTCFullYear() + count);
  return result.toISOString();
}

platformLearningRoutes.post('/invites/redeem', async (c) => {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const code = stringField(body, 'code', { required: true, min: 3, max: 128 })!;
  const result = await withIdempotency(c, actor, 'learning.invite.redeem', body, async (db) => {
    const invites = await platformQuery<{
      id: string; max_redemptions: number | null; benefit_snapshot: Record<string, unknown>;
    }>(db, `
      SELECT id::text, max_redemptions, benefit_snapshot
      FROM platform_invite_codes
      WHERE code_hash = decode($1, 'hex') AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      FOR UPDATE
    `, [physicalBundleCredentialHash(code)]);
    const invite = invites[0];
    if (!invite) notFound('Invitation');
    const prior = await platformQuery<{ id: string }>(db, `
      SELECT id::text FROM platform_invite_redemptions
      WHERE invite_code_id = $1::uuid AND user_id = $2
    `, [invite.id, actor.userId]);
    if (prior[0]) conflict('Invitation was already redeemed by this account');
    if (invite.max_redemptions != null) {
      const counts = await platformQuery<{ count: number }>(db, `
        SELECT COUNT(*)::integer AS count FROM platform_invite_redemptions WHERE invite_code_id = $1::uuid
      `, [invite.id]);
      if (counts[0].count >= invite.max_redemptions) conflict('Invitation redemption limit reached');
    }
    const benefit = invite.benefit_snapshot;
    let entitlementId: string | null = null;
    let entitlementGrantLedgerId: string | null = null;
    let membershipId: string | null = null;
    if (typeof benefit.courseId === 'string') {
      const courseId = resourceId(benefit.courseId, 'courseId');
      const courses = await platformQuery(db, `SELECT id::text FROM platform_courses WHERE id = $1::uuid AND status IN ('published','unlisted') FOR SHARE`, [courseId]);
      if (!courses[0]) notFound('Course');
      const entitlements = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_course_entitlements (user_id, course_id, status, valid_from, valid_until)
        VALUES ($1, $2::uuid, 'active', NOW(), NULL)
        ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active', valid_from = NOW(), valid_until = NULL
        RETURNING id::text
      `, [actor.userId, courseId]);
      entitlementId = entitlements[0].id;
      const grants = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_entitlement_ledger (entitlement_id, entry_type, delta_access, valid_from, reason, actor_user_id)
        VALUES ($1::uuid, 'grant', 1, NOW(), 'invitation redemption', $2)
        RETURNING id::text
      `, [entitlementId, actor.userId]);
      entitlementGrantLedgerId = grants[0].id;
    } else if (typeof benefit.membershipPlanId === 'string') {
      const planId = resourceId(benefit.membershipPlanId, 'membershipPlanId');
      const plans = await platformQuery<{ period_unit: string; period_count: number }>(db, `
        SELECT period_unit, period_count FROM platform_membership_plans
        WHERE id = $1::uuid AND status = 'active' FOR SHARE
      `, [planId]);
      if (!plans[0]) notFound('Membership plan');
      const current = await platformQuery<{ id: string; valid_until: string | null }>(db, `
        SELECT id::text, valid_until FROM platform_memberships
        WHERE user_id = $1 AND plan_id = $2::uuid FOR UPDATE
      `, [actor.userId, planId]);
      const now = new Date();
      const base = current[0]?.valid_until && new Date(current[0].valid_until) > now ? new Date(current[0].valid_until) : now;
      const validUntil = addMembershipPeriod(base, plans[0].period_unit, plans[0].period_count);
      const memberships = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_memberships (user_id, plan_id, status, valid_from, valid_until)
        VALUES ($1, $2::uuid, 'active', NOW(), $3::timestamptz)
        ON CONFLICT (user_id, plan_id) DO UPDATE SET status = 'active', valid_until = EXCLUDED.valid_until
        RETURNING id::text
      `, [actor.userId, planId, validUntil]);
      membershipId = memberships[0].id;
      await platformQuery(db, `
        INSERT INTO platform_membership_ledger (membership_id, entry_type, delta_access, valid_from, valid_until, reason, actor_user_id)
        VALUES ($1::uuid, 'grant', 1, $2::timestamptz, $3::timestamptz, 'invitation redemption', $4)
      `, [membershipId, base.toISOString(), validUntil, actor.userId]);
    } else {
      throw new PlatformApiError('INVALID_STATE', 409, 'Invitation benefit is not supported');
    }
    const redemptions = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_invite_redemptions (
        invite_code_id, user_id, entitlement_id, entitlement_grant_ledger_id, membership_id
      ) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid) RETURNING id::text
    `, [invite.id, actor.userId, entitlementId, entitlementGrantLedgerId, membershipId]);
    return {
      status: 201,
      body: { id: redemptions[0].id, entitlementId, membershipId },
      resourceType: 'platform_invite_redemption',
      resourceId: redemptions[0].id,
    };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.get('/admin/invites', async (c) => {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c);
  const rows = await platformQuery(platformDb(), `
    SELECT invite.id::text, invite.label, invite.status,
           invite.distribution_type AS "distributionType",
           invite.batch_reference AS "batchReference",
           invite.external_order_reference AS "externalOrderReference",
           invite.max_redemptions AS "maxRedemptions", invite.expires_at AS "expiresAt",
           invite.benefit_snapshot AS "benefitSnapshot", invite.created_at AS "createdAt",
           invite.revoked_at AS "revokedAt", invite.revoked_reason AS "revokedReason",
           MAX(redemption.redeemed_at) AS "redeemedAt",
           COUNT(redemption.id)::integer AS "redemptionCount"
    FROM platform_invite_codes invite
    LEFT JOIN platform_invite_redemptions redemption ON redemption.invite_code_id = invite.id
    GROUP BY invite.id ORDER BY invite.created_at DESC, invite.id DESC LIMIT $1 OFFSET $2
  `, [pageSize, offset]);
  privateNoStore(c);
  return c.json({ items: rows, page, pageSize });
});

platformLearningRoutes.post('/admin/invites', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const body = await readJsonObject(c);
  const suppliedCode = stringField(body, 'code', { min: 3, max: 128 });
  const code = (suppliedCode ?? `INV-${randomBytes(12).toString('hex')}`).toUpperCase();
  const label = stringField(body, 'label', { max: 160 }) ?? '';
  const status = enumField(body, 'status', ['active', 'paused', 'expired', 'archived'] as const) ?? 'active';
  const maxRedemptions = integerField(body, 'maxRedemptions', { min: 1, max: 1_000_000_000 });
  const expiresAt = isoTimestampField(body, 'expiresAt');
  const benefit = inviteBenefit(body);
  const result = await withIdempotency(c, actor, 'learning.admin.invite.create', body, async (db) => {
    if (benefit.courseId) {
      const rows = await platformQuery(db, `SELECT id::text FROM platform_courses WHERE id = $1::uuid`, [benefit.courseId]);
      if (!rows[0]) notFound('Course');
    } else {
      const rows = await platformQuery(db, `SELECT id::text FROM platform_membership_plans WHERE id = $1::uuid`, [benefit.membershipPlanId]);
      if (!rows[0]) notFound('Membership plan');
    }
    const rows = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_invite_codes (
        code_hash, label, status, max_redemptions, expires_at, benefit_snapshot, created_by_user_id
      ) VALUES (decode($1, 'hex'), $2, $3, $4, $5::timestamptz, $6::jsonb, $7)
      RETURNING id::text
    `, [physicalBundleCredentialHash(code), label, status, maxRedemptions ?? null, expiresAt ?? null, JSON.stringify(benefit), actor.userId]);
    return { status: 201, body: { id: rows[0].id, code, label, status, maxRedemptions: maxRedemptions ?? null, expiresAt: expiresAt ?? null, benefitSnapshot: benefit }, resourceType: 'platform_invite_code', resourceId: rows[0].id };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.post('/admin/invites/batch', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const body = await readJsonObject(c);
  const courseId = resourceId(stringField(body, 'courseId', { required: true, max: 128 })!, 'courseId');
  const count = integerField(body, 'count', { required: true, min: 1, max: 200 })!;
  const batchReference = stringField(body, 'batchReference', { required: true, max: 160 })!;
  const label = stringField(body, 'label', { max: 160 }) ?? '';
  const expiresAt = isoTimestampField(body, 'expiresAt');
  const codes = Array.from({ length: count }, () => physicalBundleCode());
  const hashes = codes.map(physicalBundleCredentialHash);
  const codeByHash = new Map(hashes.map((hash, index) => [hash, codes[index]!]));
  const result = await withIdempotency(c, actor, 'learning.admin.invite.batch', body, async (db) => {
    const courses = await platformQuery(db, `
      SELECT id::text FROM platform_courses
      WHERE id = $1::uuid AND status IN ('published', 'unlisted') FOR SHARE
    `, [courseId]);
    if (!courses[0]) notFound('Published course');
    const rows = await platformQuery<{ id: string; code_hash: string }>(db, `
      INSERT INTO platform_invite_codes (
        code_hash, label, status, distribution_type, batch_reference, max_redemptions,
        expires_at, benefit_snapshot, created_by_user_id
      )
      SELECT decode(code_hash, 'hex'), $2, 'active', 'physical_bundle', $3, 1,
             $4::timestamptz, $5::jsonb, $6
      FROM unnest($1::text[]) AS generated(code_hash)
      RETURNING id::text, encode(code_hash, 'hex') AS code_hash
    `, [hashes, label, batchReference, expiresAt ?? null, JSON.stringify({ courseId }), actor.userId]);
    const generated = rows.map((row) => ({ id: row.id, code: codeByHash.get(row.code_hash)! }));
    return {
      status: 201,
      body: { batchReference, count: generated.length, codes: generated },
      resourceType: 'platform_invite_code_batch',
      resourceId: batchReference,
    };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.patch('/admin/invites/:id/order-reference', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const externalOrderReference = nullableStringField(body, 'externalOrderReference', { max: 240 });
  if (externalOrderReference === undefined) badRequest('externalOrderReference is required');
  const result = await withIdempotency(c, actor, `learning.admin.invite.order-reference:${id}`, body, async (db) => {
    const rows = await platformQuery(db, `
      UPDATE platform_invite_codes
      SET external_order_reference = $2
      WHERE id = $1::uuid AND distribution_type = 'physical_bundle' AND status <> 'revoked'
      RETURNING id::text, external_order_reference AS "externalOrderReference"
    `, [id, externalOrderReference]);
    if (!rows[0]) notFound('Active physical bundle code');
    return { status: 200, body: rows[0], resourceType: 'platform_invite_code', resourceId: id };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.post('/admin/invites/:id/revoke', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const reason = stringField(body, 'reason', { required: true, max: 500 })!;
  const result = await withIdempotency(c, actor, `learning.admin.invite.revoke:${id}`, body, async (db) => {
    const revoked = await revokePhysicalBundleInvite(db, id, reason, actor);
    return {
      status: 200,
      body: revoked,
      resourceType: 'platform_invite_code', resourceId: id,
    };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.patch('/admin/invites/:id', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const label = stringField(body, 'label', { max: 160 });
  const status = enumField(body, 'status', ['active', 'paused', 'expired', 'archived'] as const);
  const maxRedemptions = integerField(body, 'maxRedemptions', { min: 1, max: 1_000_000_000 });
  const expiresAt = isoTimestampField(body, 'expiresAt');
  const benefit = body.benefit != null || body.benefitSnapshot != null ? inviteBenefit(body) : undefined;
  if (label == null && status == null && maxRedemptions == null && expiresAt === undefined && benefit == null) badRequest('No invitation fields were provided');
  const result = await withIdempotency(c, actor, `learning.admin.invite.update:${id}`, body, async (db) => {
    const current = await platformQuery<{ distribution_type: string }>(db, `
      SELECT distribution_type FROM platform_invite_codes WHERE id = $1::uuid FOR UPDATE
    `, [id]);
    if (!current[0]) notFound('Invitation');
    if (current[0].distribution_type === 'physical_bundle') {
      conflict('Physical bundle codes are managed through order-reference and revoke operations');
    }
    const rows = await platformQuery(db, `
      UPDATE platform_invite_codes SET
        label = CASE WHEN $2 THEN $3 ELSE label END,
        status = CASE WHEN $4 THEN $5 ELSE status END,
        max_redemptions = CASE WHEN $6 THEN $7 ELSE max_redemptions END,
        expires_at = CASE WHEN $8 THEN $9::timestamptz ELSE expires_at END,
        benefit_snapshot = CASE WHEN $10 THEN $11::jsonb ELSE benefit_snapshot END
      WHERE id = $1::uuid
      RETURNING id::text, label, status, max_redemptions AS "maxRedemptions",
                expires_at AS "expiresAt", benefit_snapshot AS "benefitSnapshot"
    `, [id, label != null, label ?? null, status != null, status ?? null,
      maxRedemptions != null, maxRedemptions ?? null, expiresAt !== undefined, expiresAt ?? null,
      benefit != null, benefit ? JSON.stringify(benefit) : null]);
    if (!rows[0]) notFound('Invitation');
    return { status: 200, body: rows[0], resourceType: 'platform_invite_code', resourceId: id };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.delete('/admin/invites/:id', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const result = await withIdempotency(c, actor, `learning.admin.invite.archive:${id}`, {}, async (db) => {
    const current = await platformQuery<{ distribution_type: string }>(db, `
      SELECT distribution_type FROM platform_invite_codes WHERE id = $1::uuid FOR UPDATE
    `, [id]);
    if (!current[0]) notFound('Invitation');
    if (current[0].distribution_type === 'physical_bundle') {
      conflict('Physical bundle codes must use the audited revocation flow');
    }
    const rows = await platformQuery(db, `UPDATE platform_invite_codes SET status = 'archived' WHERE id = $1::uuid RETURNING id::text`, [id]);
    if (!rows[0]) notFound('Invitation');
    return { status: 200, body: { id, status: 'archived' }, resourceType: 'platform_invite_code', resourceId: id };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.get('/lessons/:lessonId/media', async (c) => {
  const lessonId = resourceId(c.req.param('lessonId'), 'lessonId');
  const token = c.req.query('token');
  const db = platformDb();
  let revision: number;
  if (token == null) {
    const actor = await requirePlatformActor(c);
    revision = (await requireLessonAccess(actor, lessonId, db)).revision;
  } else {
    const lessons = await platformQuery<{ current_revision: number }>(db, `
      SELECT current_revision FROM platform_lessons
      WHERE id = $1::uuid AND status = 'published' AND current_revision IS NOT NULL
    `, [lessonId]);
    if (!lessons[0]) notFound('Lesson');
    revision = lessons[0].current_revision;
  }
  const assets = await platformQuery<{
    id: string; storage_key: string; mime_type: string; size_bytes: number | string;
  }>(db, `
    SELECT media.id::text, media.storage_key, media.mime_type, media.size_bytes
    FROM platform_lesson_revisions revision
    JOIN platform_media_assets media ON media.id = revision.media_id
    WHERE revision.lesson_id = $1::uuid AND revision.revision = $2
      AND media.status = 'ready' AND media.access_scope IN ('public', 'entitled')
  `, [lessonId, revision]);
  const asset = assets[0];
  if (!asset) notFound('Lesson media');
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
  privateNoStore(c);
  return c.json({
    mediaId: asset.id,
    mimeType: asset.mime_type,
    sizeBytes: Number(asset.size_bytes),
    accessUrl: accessUrl.toString(),
    expiresAt: signed.expiresAt,
  });
});

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
      if (platformQuizAnswersEqual(answer, expected)) {
        scorePoints += question.points;
      }
      maxPoints += question.points;
    }
    const scoreBps = Math.round((scorePoints * 10_000) / maxPoints);
    const passed = scoreBps >= quiz.passing_score_bps;
    const answersSnapshot = encryptPlatformPrivateData({ answers: typedAnswers });
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
    return { status: 201, body: rows[0]!, resourceType: 'quiz_attempt', resourceId: String(rows[0]!.id) };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.post('/courses/:courseId/reviews', async (c) => {
  const actor = await requirePlatformActor(c);
  const courseId = resourceId(c.req.param('courseId'), 'courseId');
  const body = await readJsonObject(c);
  const rating = integerField(body, 'rating', { required: true, min: 1, max: 5 })!;
  const reviewBody = stringField(body, 'body', { max: 20_000 }) ?? '';
  const result = await withIdempotency(c, actor, `learning.review:${courseId}`, body, async (db) => {
    const entitlements = await platformQuery<{ id: string }>(db, `
      SELECT id::text FROM platform_course_entitlements
      WHERE user_id = $1 AND course_id = $2::uuid AND status = 'active'
        AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
    `, [actor.userId, courseId]);
    if (!entitlements[0]) badRequest('An active course entitlement is required to review');
    const rows = await platformQuery(db, `
      INSERT INTO platform_course_reviews (user_id, course_id, entitlement_id, rating, body)
      VALUES ($1, $2::uuid, $3::uuid, $4, $5)
      ON CONFLICT (user_id, course_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body,
        entitlement_id = EXCLUDED.entitlement_id, status = 'published', moderation_note = NULL
      RETURNING id::text, course_id::text AS "courseId", rating, body, status,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [actor.userId, courseId, entitlements[0].id, rating, reviewBody]);
    return { status: 200, body: rows[0]!, resourceType: 'course_review', resourceId: String(rows[0]!.id) };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.get('/certificates/:code/image', async (c) => {
  const code = stringField({ code: c.req.param('code') }, 'code', { required: true, min: 12, max: 200 })!;
  const hash = createHash('sha256').update(code, 'utf8').digest('hex');
  const rows = await platformQuery<{
    storage_key: string; mime_type: string; size_bytes: number | string;
  }>(platformDb(), `
    SELECT media.storage_key, media.mime_type, media.size_bytes
    FROM platform_certificates certificate
    JOIN platform_media_assets media ON media.id = certificate.image_media_id
    WHERE certificate.verification_code_hash = decode($1, 'hex')
      AND certificate.status = 'issued' AND media.status = 'ready'
      AND media.mime_type LIKE 'image/%'
  `, [hash]);
  const asset = rows[0];
  if (!asset) notFound('Certificate image');
  return servePlatformMedia(c, {
    storageKey: asset.storage_key,
    mimeType: asset.mime_type,
    sizeBytes: asset.size_bytes,
  }, 'public, max-age=60, s-maxage=300');
});

platformLearningRoutes.get('/certificates/:code', async (c) => {
  const code = stringField({ code: c.req.param('code') }, 'code', { required: true, min: 12, max: 200 })!;
  const hash = createHash('sha256').update(code, 'utf8').digest('hex');
  const rows = await platformQuery(platformDb(), `
    SELECT certificate.id::text, certificate.status,
           certificate.recipient_name_snapshot AS "recipientName",
           certificate.course_title_snapshot AS title,
           certificate.issued_at AS "issuedAt", certificate.revoked_at AS "revokedAt",
           certificate.image_media_id::text AS "imageMediaId"
    FROM platform_certificates certificate
    WHERE certificate.verification_code_hash = decode($1, 'hex')
  `, [hash]);
  if (!rows[0]) notFound('Certificate');
  publicCache(c);
  return c.json(rows[0]);
});

platformLearningRoutes.post('/instructor/certificates', async (c) => {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const courseId = resourceId(stringField(body, 'courseId', { required: true, max: 128 })!, 'courseId');
  const userId = integerField(body, 'userId', { required: true, min: 1 })!;
  const recipientName = stringField(body, 'recipientName', { required: true, max: 200 })!;
  const imageMediaId = body.imageMediaId == null ? null : resourceId(stringField(body, 'imageMediaId', { max: 128 })!, 'imageMediaId');
  const result = await withIdempotency(c, actor, `learning.certificate:${courseId}:${userId}`, body, async (db) => {
    const instructorId = await requireCourseOwner(db, actor, courseId);
    const entitlements = await platformQuery<{ id: string; title: string }>(db, `
      SELECT e.id::text, COALESCE(NULLIF(cr.title_zh, ''), cr.title_en) AS title
      FROM platform_course_entitlements e
      JOIN platform_courses course ON course.id = e.course_id
      JOIN platform_course_revisions cr ON cr.course_id = course.id AND cr.revision = course.current_revision
      WHERE e.user_id = $1 AND e.course_id = $2::uuid AND e.status = 'active'
    `, [userId, courseId]);
    if (!entitlements[0]) badRequest('Recipient does not have an active entitlement');
    if (imageMediaId) {
      const media = await platformQuery<{ id: string }>(db, `
        SELECT id::text FROM platform_media_assets
        WHERE id = $1::uuid AND status = 'ready' AND mime_type LIKE 'image/%'
          AND (owner_user_id = $2 OR owner_instructor_id = $3::uuid)
      `, [imageMediaId, actor.userId, instructorId]);
      if (!media[0]) notFound('Owned ready certificate image');
    }
    const verificationCode = randomBytes(24).toString('base64url');
    const hash = createHash('sha256').update(verificationCode, 'utf8').digest('hex');
    const rows = await platformQuery(db, `
      INSERT INTO platform_certificates (
        verification_code_hash, user_id, course_id, entitlement_id, recipient_name_snapshot,
        course_title_snapshot, image_media_id, issued_by_user_id
      ) VALUES (decode($1, 'hex'), $2, $3::uuid, $4::uuid, $5, $6, $7::uuid, $8)
      RETURNING id::text, status, issued_at AS "issuedAt"
    `, [hash, userId, courseId, entitlements[0].id, recipientName, entitlements[0].title, imageMediaId, actor.userId]);
    await enqueuePlatformEvent(db, 'learning.certificate_issued', 'certificate', String(rows[0]!.id),
      `learning.certificate:${rows[0]!.id}`, { certificateId: rows[0]!.id, courseId });
    return {
      status: 201,
      body: { ...rows[0], verificationCode },
      resourceType: 'certificate', resourceId: String(rows[0]!.id),
    };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.get('/me/privacy/consents', async (c) => {
  const actor = await requirePlatformActor(c);
  const rows = await platformQuery(platformDb(), `
    SELECT DISTINCT ON (purpose) id::text, purpose, status,
           policy_version AS "policyVersion", source, decided_at AS "decidedAt",
           expires_at AS "expiresAt"
    FROM platform_privacy_consents
    WHERE user_id = $1
    ORDER BY purpose, decided_at DESC, id DESC
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows });
});

platformLearningRoutes.post('/me/privacy/consents', async (c) => {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const purpose = enumField(body, 'purpose', ['analytics', 'marketing'] as const, { required: true })!;
  const status = enumField(body, 'status', ['granted', 'denied', 'withdrawn'] as const, { required: true })!;
  const policyVersion = stringField(body, 'policyVersion', { required: true, max: 40, pattern: /^[A-Za-z0-9_.-]+$/ })!;
  const source = stringField(body, 'source', { max: 40, pattern: /^[A-Za-z0-9_.-]+$/ }) ?? 'account';
  const expiresAt = isoTimestampField(body, 'expiresAt');
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) badRequest('expiresAt must be in the future');
  if (status !== 'granted' && expiresAt != null) badRequest('Only granted consent may have expiresAt');
  const result = await withIdempotency(c, actor, `learning.privacy.consent:${purpose}`, body, async (db) => {
    const previous = await platformQuery<{ id: string; status: string }>(db, `
      SELECT id::text, status FROM platform_privacy_consents
      WHERE user_id = $1 AND purpose = $2
      ORDER BY decided_at DESC, id DESC LIMIT 1 FOR UPDATE
    `, [actor.userId, purpose]);
    if (status === 'withdrawn' && previous[0]?.status !== 'granted') {
      conflict('Only an active granted consent can be withdrawn');
    }
    const rows = await platformQuery(db, `
      INSERT INTO platform_privacy_consents (
        user_id, purpose, status, policy_version, source, expires_at, supersedes_consent_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::uuid)
      RETURNING id::text, purpose, status, policy_version AS "policyVersion",
                source, decided_at AS "decidedAt", expires_at AS "expiresAt"
    `, [actor.userId, purpose, status, policyVersion, source, status === 'granted' ? expiresAt ?? null : null,
      previous[0]?.id ?? null]);
    await platformQuery(db, `
      INSERT INTO platform_audit_events (
        actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
      ) VALUES ($1, $2, 'learning.privacy.consent', 'platform_privacy_consent', $3, 'allowed', $4::jsonb)
    `, [actor.userId, actor.ownerKey, rows[0]!.id, JSON.stringify({ purpose, status, policyVersion })]);
    return {
      status: 201,
      body: rows[0]!,
      resourceType: 'platform_privacy_consent',
      resourceId: String(rows[0]!.id),
    };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.post('/analytics', async (c) => {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const eventName = stringField(body, 'eventName', {
    required: true,
    max: 80,
    pattern: /^[a-z][a-z0-9_.-]{0,79}$/,
  })!;
  const surface = stringField(body, 'surface', {
    required: true,
    max: 80,
    pattern: /^[a-z0-9/_-]{1,80}$/,
  })!;
  const dimensions = analyticsDimensions(body.dimensions);
  const request = { eventName, surface, dimensions };
  const result = await withIdempotency(c, actor, `learning.analytics:${eventName}`, request, async (db) => {
    const consents = await platformQuery<{ id: string; status: string; active: boolean }>(db, `
      SELECT id::text, status, (expires_at IS NULL OR expires_at > NOW()) AS active
      FROM platform_privacy_consents
      WHERE user_id = $1 AND purpose = 'analytics'
      ORDER BY decided_at DESC, id DESC LIMIT 1
    `, [actor.userId]);
    if (consents[0]?.status !== 'granted' || !consents[0].active) {
      throw new PlatformApiError('FORBIDDEN', 403, 'Active analytics consent is required');
    }
    const rows = await platformQuery(db, `
      INSERT INTO platform_analytics_events (
        consent_id, user_id, event_name, surface, dimensions, expires_at
      ) VALUES ($1::uuid, $2, $3, $4, $5::jsonb, NOW() + INTERVAL '30 days')
      RETURNING id::text, occurred_at AS "occurredAt", expires_at AS "expiresAt"
    `, [consents[0].id, actor.userId, eventName, surface, JSON.stringify(dimensions)]);
    return {
      status: 202,
      body: rows[0]!,
      resourceType: 'platform_analytics_event',
      resourceId: String(rows[0]!.id),
    };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.get('/admin/retention-jobs', async (c) => {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c);
  const rows = await platformQuery(platformDb(), `
    SELECT id::text, data_class AS "dataClass", cutoff_at AS "cutoffAt", status,
           rows_affected AS "rowsAffected", failure_code AS "failureCode",
           created_at AS "createdAt", started_at AS "startedAt", finished_at AS "finishedAt"
    FROM platform_retention_jobs
    ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2
  `, [pageSize, offset]);
  privateNoStore(c);
  return c.json({ items: rows, page, pageSize });
});

platformLearningRoutes.post('/admin/retention-jobs', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const body = await readJsonObject(c);
  const dataClass = enumField(body, 'dataClass', [
    'analytics_events',
    'qr_scans',
    'idempotency',
    'outbox_payloads',
    'shipping_addresses',
  ] as const, { required: true })!;
  const cutoffAt = isoTimestampField(body, 'cutoffAt');
  if (!cutoffAt) badRequest('cutoffAt is required');
  if (Date.parse(cutoffAt) > Date.now()) badRequest('cutoffAt must not be in the future');
  const result = await withIdempotency(c, actor, `learning.retention:${dataClass}`, body, async (db) => {
    const jobs = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_retention_jobs (
        data_class, cutoff_at, status, requested_by_user_id, started_at
      ) VALUES ($1, $2, 'running', $3, NOW()) RETURNING id::text
    `, [dataClass, cutoffAt, actor.userId]);
    const jobId = jobs[0]!.id;
    const statements: Record<typeof dataClass, string> = {
      analytics_events: `DELETE FROM platform_analytics_events WHERE expires_at <= $1 AND expires_at <= NOW() RETURNING id`,
      qr_scans: `DELETE FROM platform_qr_scans WHERE last_scanned_at <= $1 RETURNING id`,
      idempotency: `DELETE FROM platform_idempotency_requests WHERE expires_at <= $1 AND state IN ('completed','failed') RETURNING id`,
      outbox_payloads: `DELETE FROM platform_outbox_events WHERE created_at <= $1 AND status IN ('delivered','dead_letter') RETURNING id`,
      shipping_addresses: `DELETE FROM platform_shipping_addresses WHERE archived_at IS NOT NULL AND archived_at <= $1 RETURNING id`,
    };
    const removed = await platformQuery(db, statements[dataClass], [cutoffAt]);
    await platformQuery(db, `
      UPDATE platform_retention_jobs
      SET status = 'succeeded', rows_affected = $2, finished_at = NOW()
      WHERE id = $1::uuid
    `, [jobId, removed.length]);
    await platformQuery(db, `
      INSERT INTO platform_audit_events (
        actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
      ) VALUES ($1, $2, 'learning.retention.run', 'platform_retention_job', $3, 'allowed', $4::jsonb)
    `, [actor.userId, actor.ownerKey, jobId, JSON.stringify({ dataClass, rowsAffected: removed.length })]);
    return {
      status: 200,
      body: { id: jobId, dataClass, cutoffAt, status: 'succeeded', rowsAffected: removed.length },
      resourceType: 'platform_retention_job',
      resourceId: jobId,
    };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.post('/me/checkins', async (c) => {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const timezone = stringField(body, 'timezone', { required: true, max: 80 })!;
  const localDate = stringField(body, 'localDate', { required: true, max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ })!;
  const result = await withIdempotency(c, actor, `learning.checkin:${localDate}`, body, async (db) => {
    await platformQuery(db, 'SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [actor.userId]);
    const rows = await platformQuery(db, `
      INSERT INTO platform_checkins (user_id, local_date, timezone, points_awarded)
      VALUES ($1, $2::date, $3, 1)
      ON CONFLICT (user_id, local_date) DO NOTHING
      RETURNING id::text, local_date AS "localDate", timezone, points_awarded AS "pointsAwarded", created_at AS "createdAt"
    `, [actor.userId, localDate, timezone]);
    const balances = await platformQuery<{ balance: string }>(db, `
      SELECT COALESCE((SELECT balance_after FROM platform_point_ledger
        WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1), 0)::text AS balance
    `, [actor.userId]);
    const previousBalance = Number(balances[0]!.balance);
    if (!rows[0]) {
      const existing = await platformQuery(db, `SELECT id::text, local_date AS "localDate", timezone,
        points_awarded AS "pointsAwarded", created_at AS "createdAt"
        FROM platform_checkins WHERE user_id = $1 AND local_date = $2::date`, [actor.userId, localDate]);
      return { status: 200, body: { ...existing[0], balance: previousBalance }, resourceType: 'checkin', resourceId: String(existing[0]!.id) };
    }
    const checkinId = String(rows[0].id);
    const balance = previousBalance + 1;
    await platformQuery(db, `
      INSERT INTO platform_point_ledger (user_id, entry_type, delta_points, balance_after, checkin_id)
      VALUES ($1, 'checkin', 1, $2, $3::uuid) ON CONFLICT DO NOTHING
    `, [actor.userId, balance, checkinId]);
    return { status: 200, body: { ...rows[0], balance }, resourceType: 'checkin', resourceId: checkinId };
  });
  return sendMutation(c, result);
});

platformLearningRoutes.get('/leaderboard', async (c) => {
  const { page, pageSize, offset } = pagination(c);
  const rows = await platformQuery(platformDb(), `
    SELECT user_id::text AS id, user_id::text AS title, MAX(balance_after)::text AS points
    FROM platform_point_ledger WHERE user_id IS NOT NULL
    GROUP BY user_id ORDER BY MAX(balance_after) DESC, user_id LIMIT $1 OFFSET $2
  `, [pageSize, offset]);
  publicCache(c, rows.length > 0);
  return c.json({ items: rows, page, pageSize });
});

platformLearningRoutes.get('/instructor/students', async (c) => {
  const actor = await requirePlatformActor(c);
  await requireInstructor(platformDb(), actor);
  const rows = await platformQuery(platformDb(), `
    SELECT DISTINCT e.user_id::text AS id, e.user_id::text AS title,
           e.course_id::text AS "courseId", COALESCE(NULLIF(cr.title_zh, ''), cr.title_en) AS "courseTitle",
           e.status, e.valid_from AS "validFrom", e.valid_until AS "validUntil"
    FROM platform_course_owners owner
    JOIN platform_instructors instructor ON instructor.id = owner.instructor_id
    JOIN platform_course_entitlements e ON e.course_id = owner.course_id
    JOIN platform_courses course ON course.id = e.course_id
    LEFT JOIN platform_course_revisions cr ON cr.course_id = course.id AND cr.revision = course.current_revision
    WHERE instructor.user_id = $1 AND instructor.status = 'active' AND owner.status = 'active'
      AND e.user_id IS NOT NULL
    ORDER BY e.valid_from DESC, e.user_id
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows });
});

platformLearningRoutes.get('/instructor/earnings', async (c) => {
  const actor = await requirePlatformActor(c);
  await requireInstructor(platformDb(), actor);
  const rows = await platformQuery(platformDb(), `
    SELECT ledger.id::text, ledger.entry_type AS "entryType", ledger.delta_amount_minor::text AS "amountMinor",
           ledger.currency, ledger.order_id::text AS "orderId", ledger.refund_id::text AS "refundId",
           ledger.created_at AS "createdAt", COALESCE(NULLIF(instructor.display_name_snapshot, ''), instructor.id::text) AS title
    FROM platform_instructor_revenue_ledger ledger
    JOIN platform_instructors instructor ON instructor.id = ledger.instructor_id
    WHERE instructor.user_id = $1 AND instructor.status = 'active'
    ORDER BY ledger.created_at DESC, ledger.id
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows });
});
