import { requirePlatformActor } from '../auth.js';
import { platformQuery, platformDb } from '../db.js';
import { publicCache, privateNoStore } from '../http.js';
import { safeMoney } from './amounts.js';
import { ACTIVE_MEMBERSHIP_PREDICATE } from './membership-access.js';
import { type Hono } from 'hono';

export function registerMembershipRoutes(platformCommerceRoutes: Hono): void {
  platformCommerceRoutes.get('/membership-plans', async (c) => {
    const rows = await platformQuery<{
      id: string;
      slug: string;
      nameZh: string;
      nameEn: string;
      descriptionZh: string;
      descriptionEn: string;
      periodUnit: string;
      periodCount: number;
      amountMinor: number | string;
      currency: string;
      status: string;
    }>(platformDb(), `
      SELECT id::text, slug, name_zh AS "nameZh", name_en AS "nameEn",
             COALESCE(benefits_snapshot->>'descriptionZh', benefits_snapshot->>'description_zh', '') AS "descriptionZh",
             COALESCE(benefits_snapshot->>'descriptionEn', benefits_snapshot->>'description_en', '') AS "descriptionEn",
             period_unit AS "periodUnit", period_count AS "periodCount",
             amount_minor AS "amountMinor", currency, status
      FROM platform_membership_plans
      WHERE status = 'active'
      ORDER BY amount_minor, period_unit, period_count, id
    `);
    const items = rows.map((row) => ({ ...row, amountMinor: safeMoney(row.amountMinor) }));
    publicCache(c, items.length > 0);
    return c.json({ items });
  });

  platformCommerceRoutes.get('/me/memberships', async (c) => {
    const actor = await requirePlatformActor(c);
    const rows = await platformQuery<{
      id: string;
      planId: string;
      planSlug: string;
      planNameZh: string;
      planNameEn: string;
      status: 'active' | 'expired' | 'cancelled' | 'revoked';
      isActive: boolean;
      validFrom: string;
      validUntil: string | null;
    }>(platformDb(), `
      SELECT membership.id::text,
             membership.plan_id::text AS "planId",
             plan.slug AS "planSlug",
             plan.name_zh AS "planNameZh",
             plan.name_en AS "planNameEn",
             membership.status,
             (${ACTIVE_MEMBERSHIP_PREDICATE}) AS "isActive",
             membership.valid_from AS "validFrom",
             membership.valid_until AS "validUntil"
      FROM platform_memberships membership
      JOIN platform_membership_plans plan ON plan.id = membership.plan_id
      WHERE membership.user_id = $1
      ORDER BY "isActive" DESC, membership.updated_at DESC, membership.id DESC
    `, [actor.userId]);
    privateNoStore(c);
    return c.json({ items: rows });
  });
}
