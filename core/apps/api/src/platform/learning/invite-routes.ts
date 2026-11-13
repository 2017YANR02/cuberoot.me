import { addMembershipPeriod, membershipPeriodBase } from '../membership-period.js';
import { requirePlatformActor, requirePlatformAdmin } from '../auth.js';
import { platformQuery, platformDb, type PlatformDb, withIdempotency, sendMutation, lockUserMemberships } from '../db.js';
import { badRequest, notFound, conflict, PlatformApiError } from '../errors.js';
import { privateNoStore } from '../http.js';
import { physicalBundleCredentialHash, revokePhysicalBundleInvite } from '../physical_bundle.js';
import {
  objectField,
  stringField,
  resourceId,
  readJsonObject,
  pagination,
  enumField,
  integerField,
  isoTimestampField,
  nullableStringField,
} from '../validation.js';
import { type Hono } from 'hono';
import { randomBytes } from 'node:crypto';

function physicalBundleCode(): string {
  return `CR-${randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-')}`;
}

function inviteBenefit(body: Record<string, unknown>): { courseId?: string; membershipPlanId?: string; lessonIds?: string[] } {
  const raw = objectField(body, 'benefitSnapshot') ?? objectField(body, 'benefit', { required: true })!;
  const courseId = stringField(raw, 'courseId', { max: 128 });
  const membershipPlanId = stringField(raw, 'membershipPlanId', { max: 128 });
  if ((courseId == null) === (membershipPlanId == null)) {
    badRequest('benefit must identify exactly one courseId or membershipPlanId');
  }
  let lessonIds: string[] | undefined;
  if (Object.hasOwn(raw, 'lessonIds')) {
    if (!courseId || !Array.isArray(raw.lessonIds) || raw.lessonIds.length === 0 || raw.lessonIds.length > 1000) {
      badRequest('lessonIds must contain 1 to 1000 lesson IDs and requires courseId');
    }
    lessonIds = raw.lessonIds.map((id: unknown) => {
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) badRequest('lessonIds must contain UUID strings');
      return resourceId(id, 'lessonIds').toLowerCase();
    });
    if (new Set(lessonIds).size !== lessonIds.length) badRequest('lessonIds must not contain duplicates');
  }
  return {
    ...(lessonIds ? { lessonIds } : {}),
    ...(courseId ? { courseId: resourceId(courseId, 'courseId') } : {}),
    ...(membershipPlanId ? { membershipPlanId: resourceId(membershipPlanId, 'membershipPlanId') } : {}),
  };
}

async function validateInviteLessons(db: PlatformDb, benefit: ReturnType<typeof inviteBenefit>): Promise<void> {
  if (!benefit.lessonIds) return;
  const rows = await platformQuery(db, `
    SELECT id FROM platform_lessons WHERE course_id = $1::uuid AND id = ANY($2::uuid[]) FOR SHARE
  `, [benefit.courseId, benefit.lessonIds]);
  if (rows.length !== benefit.lessonIds.length) badRequest('Every lesson must belong to the selected course');
}


export function registerInviteRoutes(platformLearningRoutes: Hono): void {
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
      const benefit = inviteBenefit({ benefitSnapshot: invite.benefit_snapshot });
      await validateInviteLessons(db, benefit);
      let entitlementId: string | null = null;
      let entitlementGrantLedgerId: string | null = null;
      let membershipId: string | null = null;
      let redeemedCourseId: string | null = null;
      if (typeof benefit.courseId === 'string') {
        const courseId = resourceId(benefit.courseId, 'courseId');
        redeemedCourseId = courseId;
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
          INSERT INTO platform_entitlement_ledger (entitlement_id, entry_type, delta_access, valid_from, reason, actor_user_id, lesson_ids)
          VALUES ($1::uuid, 'grant', 1, NOW(), 'invitation redemption', $2, $3::uuid[])
          RETURNING id::text
        `, [entitlementId, actor.userId, benefit.lessonIds ?? null]);
        entitlementGrantLedgerId = grants[0].id;
      } else if (typeof benefit.membershipPlanId === 'string') {
        const planId = resourceId(benefit.membershipPlanId, 'membershipPlanId');
        const plans = await platformQuery<{ period_unit: string; period_count: number }>(db, `
          SELECT period_unit, period_count FROM platform_membership_plans
          WHERE id = $1::uuid AND status = 'active' FOR SHARE
        `, [planId]);
        if (!plans[0]) notFound('Membership plan');
        await lockUserMemberships(db, actor.userId!);
        const current = await platformQuery<{ id: string; status: string; valid_until: string | null }>(db, `
          SELECT id::text, status, valid_until FROM platform_memberships
          WHERE user_id = $1 AND plan_id = $2::uuid FOR UPDATE
        `, [actor.userId, planId]);
        const base = membershipPeriodBase(current[0]);
        const validUntil = addMembershipPeriod(base, plans[0].period_unit, plans[0].period_count);
        const memberships = await platformQuery<{ id: string }>(db, `
          INSERT INTO platform_memberships (user_id, plan_id, status, valid_from, valid_until)
          VALUES ($1, $2::uuid, 'active', NOW(), $3::timestamptz)
          ON CONFLICT (user_id, plan_id) DO UPDATE SET status = 'active', valid_until = EXCLUDED.valid_until,
            valid_from = CASE WHEN platform_memberships.status = 'revoked' THEN EXCLUDED.valid_from ELSE platform_memberships.valid_from END
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
        body: { id: redemptions[0].id, entitlementId, membershipId, courseId: redeemedCourseId },
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
      await validateInviteLessons(db, benefit);
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
      `, [physicalBundleCredentialHash(code), label, status, maxRedemptions ?? null, expiresAt ?? null, benefit, actor.userId]);
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
      `, [hashes, label, batchReference, expiresAt ?? null, { courseId }, actor.userId]);
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
      if (benefit) await validateInviteLessons(db, benefit);
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
        benefit != null, benefit ?? null]);
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
}
