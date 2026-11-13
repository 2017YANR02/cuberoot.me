import { requirePlatformAdmin } from '../auth.js';
import { platformQuery, platformDb, withIdempotency, sendMutation } from '../db.js';
import { conflict, badRequest, notFound } from '../errors.js';
import { privateNoStore } from '../http.js';
import { pagination, readJsonObject, resourceId } from '../validation.js';
import { safeMoney } from './amounts.js';
import { couponDefinition, type CouponDefinition } from './coupon-rules.js';
import { type Hono } from 'hono';

export function registerCouponRoutes(platformCommerceRoutes: Hono): void {
  platformCommerceRoutes.get('/admin/coupons', async (c) => {
    await requirePlatformAdmin(c);
    const { page, pageSize, offset } = pagination(c);
    const q=c.req.query('q')?.trim().slice(0,200)??'';
    const rows = await platformQuery(platformDb(), `
      SELECT coupon.id::text, coupon.code, coupon.status, coupon.discount_type AS "discountType",
             coupon.discount_amount_minor AS "discountAmountMinor", coupon.discount_bps AS "discountBps",
             coupon.currency, coupon.minimum_order_amount_minor AS "minimumOrderAmountMinor",
             coupon.max_redemptions AS "maxRedemptions", coupon.per_user_limit AS "perUserLimit",
             coupon.starts_at AS "startsAt", coupon.ends_at AS "endsAt", coupon.eligibility,
             COUNT(redemption.id) FILTER (WHERE redemption.status IN ('reserved','applied'))::integer AS "redemptionCount",
             coupon.created_at AS "createdAt", coupon.updated_at AS "updatedAt"
      FROM platform_coupons coupon
      LEFT JOIN platform_coupon_redemptions redemption ON redemption.coupon_id = coupon.id
      WHERE ($3='' OR coupon.code ILIKE '%'||$3||'%') GROUP BY coupon.id ORDER BY coupon.created_at DESC, coupon.id DESC LIMIT $1 OFFSET $2
    `, [pageSize, offset,q]);
    privateNoStore(c);
    const counts=await platformQuery<{total:number}>(platformDb(),`SELECT COUNT(*)::int AS total FROM platform_coupons WHERE TRUE AND ($1='' OR code ILIKE '%'||$1||'%')`,[q]);
    return c.json({ items: rows, page, pageSize,total:counts[0]?.total??0 });
  });

  platformCommerceRoutes.post('/admin/coupons', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const body = await readJsonObject(c);
    const definition = couponDefinition(body);
    const result = await withIdempotency(c, actor, 'commerce.admin.coupon.create', body, async (db) => {
      const duplicate = await platformQuery<{ id: string }>(db, `SELECT id::text FROM platform_coupons WHERE code = $1`, [definition.code]);
      if (duplicate[0]) conflict('Coupon code already exists');
      const rows = await platformQuery(db, `
        INSERT INTO platform_coupons (
          code, status, discount_type, discount_amount_minor, discount_bps, currency,
          minimum_order_amount_minor, max_redemptions, per_user_limit, starts_at, ends_at,
          eligibility, created_by_user_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz,$12::jsonb,$13)
        RETURNING id::text, code, status
      `, [definition.code, definition.status, definition.discountType, definition.discountAmountMinor,
        definition.discountBps, definition.currency, definition.minimumOrderAmountMinor, definition.maxRedemptions,
        definition.perUserLimit, definition.startsAt, definition.endsAt, definition.eligibility, actor.userId]);
      return { status: 201, body: { ...definition, ...rows[0] }, resourceType: 'platform_coupon', resourceId: String(rows[0]!.id) };
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.patch('/admin/coupons/:id', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    if (!Object.keys(body).length) badRequest('At least one coupon field is required');
    const result = await withIdempotency(c, actor, `commerce.admin.coupon.update:${id}`, body, async (db) => {
      const rows = await platformQuery<{
        code: string; status: CouponDefinition['status']; discount_type: CouponDefinition['discountType'];
        discount_amount_minor: number | string | null; discount_bps: number | null; currency: string | null;
        minimum_order_amount_minor: number | string; max_redemptions: number | null; per_user_limit: number;
        starts_at: string | null; ends_at: string | null; eligibility: Record<string, unknown>;
      }>(db, `SELECT code, status, discount_type, discount_amount_minor, discount_bps, currency,
        minimum_order_amount_minor, max_redemptions, per_user_limit, starts_at, ends_at, eligibility
        FROM platform_coupons WHERE id = $1::uuid FOR UPDATE`, [id]);
      const current = rows[0];
      if (!current) notFound('Coupon');
      const definition = couponDefinition(body, {
        code: current.code, status: current.status, discountType: current.discount_type,
        discountAmountMinor: current.discount_amount_minor == null ? null : safeMoney(current.discount_amount_minor, 'discountAmountMinor'),
        discountBps: current.discount_bps,
        currency: current.currency, minimumOrderAmountMinor: safeMoney(current.minimum_order_amount_minor, 'minimumOrderAmountMinor'),
        maxRedemptions: current.max_redemptions, perUserLimit: current.per_user_limit,
        startsAt: current.starts_at, endsAt: current.ends_at, eligibility: current.eligibility,
      });
      const duplicate = await platformQuery<{ id: string }>(db, `SELECT id::text FROM platform_coupons WHERE code = $1 AND id <> $2::uuid`, [definition.code, id]);
      if (duplicate[0]) conflict('Coupon code already exists');
      await platformQuery(db, `UPDATE platform_coupons SET code=$2,status=$3,discount_type=$4,
        discount_amount_minor=$5,discount_bps=$6,currency=$7,minimum_order_amount_minor=$8,
        max_redemptions=$9,per_user_limit=$10,starts_at=$11::timestamptz,ends_at=$12::timestamptz,
        eligibility=$13::jsonb WHERE id=$1::uuid`, [id, definition.code, definition.status,
        definition.discountType, definition.discountAmountMinor, definition.discountBps, definition.currency,
        definition.minimumOrderAmountMinor, definition.maxRedemptions, definition.perUserLimit,
        definition.startsAt, definition.endsAt, definition.eligibility]);
      return { status: 200, body: { id, ...definition }, resourceType: 'platform_coupon', resourceId: id };
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.delete('/admin/coupons/:id', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const result = await withIdempotency(c, actor, `commerce.admin.coupon.archive:${id}`, {}, async (db) => {
      const rows = await platformQuery(db, `UPDATE platform_coupons SET status='archived' WHERE id=$1::uuid RETURNING id::text`, [id]);
      if (!rows[0]) notFound('Coupon');
      return { status: 200, body: { id, status: 'archived' }, resourceType: 'platform_coupon', resourceId: id };
    });
    return sendMutation(c, result);
  });
}
