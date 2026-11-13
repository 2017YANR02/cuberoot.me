import { competitionOrderContext } from '../competitions.js';
import { type PlatformDb, platformQuery, lockUserMemberships } from '../db.js';
import { badRequest, notFound, conflict } from '../errors.js';
import { isObject, integerField, resourceId } from '../validation.js';
import { safeMoney } from './amounts.js';
import { couponEligibleSubtotal, couponEligibility } from './coupon-rules.js';
import { type PricedItem } from './types.js';
import { hasMembership } from './membership-access.js';

async function priceItem(db: PlatformDb, raw: unknown, member: boolean, userId: number): Promise<PricedItem> {
  if (!isObject(raw)) badRequest('Each item must be an object');
  const quantity = integerField(raw, 'quantity', { min: 1, max: 1000 }) ?? 1;
  const courseId = typeof raw.courseId === 'string' ? resourceId(raw.courseId, 'courseId') : null;
  const variantId = typeof raw.productVariantId === 'string' ? resourceId(raw.productVariantId, 'productVariantId') : null;
  const productId = typeof raw.productId === 'string' ? resourceId(raw.productId, 'productId') : null;
  const ticketId = typeof raw.eventTicketTypeId === 'string' ? resourceId(raw.eventTicketTypeId, 'eventTicketTypeId') : null;
  const planId = typeof raw.membershipPlanId === 'string' ? resourceId(raw.membershipPlanId, 'membershipPlanId') : null;
  if ([courseId, variantId ?? productId, ticketId, planId].filter(Boolean).length !== 1) {
    badRequest('Each item must identify exactly one sellable');
  }
  if (courseId) {
    if (quantity !== 1) badRequest('Course quantity must be 1');
    const rows = await platformQuery<{
      id: string; slug: string; title_zh: string; title_en: string;
      base_amount_minor: number | string; member_amount_minor: number | string | null; currency: string;
    }>(db, `
      SELECT c.id::text, c.slug, r.title_zh, r.title_en,
             c.base_amount_minor, c.member_amount_minor, c.currency
      FROM platform_courses c
      JOIN platform_course_revisions r ON r.course_id = c.id AND r.revision = c.current_revision
      WHERE c.id = $1::uuid AND c.status IN ('published', 'unlisted')
        AND c.enrollment_mode = 'purchase'
      FOR SHARE OF c, r
    `, [courseId]);
    const row = rows[0];
    if (!row) notFound('Course');
    const base = safeMoney(row.base_amount_minor);
    const amount = member && row.member_amount_minor != null ? safeMoney(row.member_amount_minor) : base;
    const shares = await platformQuery<{ instructor_id: string; revenue_share_bps: number }>(db, `
      SELECT instructor_id::text, revenue_share_bps FROM platform_course_owners
      WHERE course_id = $1::uuid AND status = 'active' AND revenue_share_bps > 0
      ORDER BY instructor_id
    `, [courseId]);
    return {
      sellableType: 'course', fulfillmentType: 'course_entitlement', quantity: 1,
      amountMinor: amount, currency: row.currency, courseId: row.id, productVariantId: null,
      eventTicketTypeId: null, membershipPlanId: null,
      snapshot: { id: row.id, slug: row.slug, titleZh: row.title_zh, titleEn: row.title_en, baseAmountMinor: base },
      revenueShare: shares.map((share) => ({ instructorId: share.instructor_id, shareBps: share.revenue_share_bps })),
    };
  }
  if (variantId || productId) {
    const parameters = variantId ? [variantId] : [productId];
    const predicate = variantId ? 'v.id = $1::uuid' : 'p.id = $1::uuid';
    const rows = await platformQuery<{
      id: string; product_id: string; product_type: 'physical' | 'digital'; sku: string;
      product_title_zh: string; product_title_en: string; title_zh: string; title_en: string; member_only: boolean;
      amount_minor: number | string; member_amount_minor: number | string | null; currency: string;
      inventory_on_hand: number; inventory_reserved: number;
    }>(db, `
      SELECT v.id::text, p.id::text AS product_id, p.product_type, p.member_only, v.sku,
             p.title_zh AS product_title_zh, p.title_en AS product_title_en,
             v.title_zh, v.title_en, v.amount_minor, v.member_amount_minor, v.currency,
             v.inventory_on_hand, v.inventory_reserved
      FROM platform_product_variants v JOIN platform_products p ON p.id = v.product_id
      WHERE ${predicate} AND p.status = 'active' AND v.status = 'active'
      ORDER BY v.created_at, v.id LIMIT 1 FOR UPDATE OF v
    `, parameters);
    const row = rows[0];
    if (!row) notFound('Product variant');
    if (row.member_only && !member) badRequest('This product requires an active membership');
    if (row.inventory_on_hand - row.inventory_reserved < quantity) conflict('Insufficient inventory');
    const base = safeMoney(row.amount_minor);
    const amount = member && row.member_amount_minor != null ? safeMoney(row.member_amount_minor) : base;
    return {
      sellableType: 'product_variant', fulfillmentType: row.product_type === 'physical' ? 'shipment' : 'download', quantity,
      amountMinor: amount, currency: row.currency, courseId: null, productVariantId: row.id,
      eventTicketTypeId: null, membershipPlanId: null,
      snapshot: { id: row.id, productId: row.product_id, productType: row.product_type, sku: row.sku, titleZh: row.title_zh || row.product_title_zh, titleEn: row.title_en || row.product_title_en, baseAmountMinor: base },
      revenueShare: [],
    };
  }
  if (ticketId) {
    const rows = await platformQuery<{
      id: string; event_id: string; code: string; title_zh: string; title_en: string;
      event_title_zh: string; event_title_en: string; amount_minor: number | string; currency: string;
      capacity: number; reserved_quantity: number; sold_quantity: number;
    }>(db, `
      SELECT t.id::text, t.event_id::text, t.code, t.title_zh, t.title_en,
             e.title_zh AS event_title_zh, e.title_en AS event_title_en,
             t.amount_minor, t.currency, t.capacity, t.reserved_quantity, t.sold_quantity
      FROM platform_event_ticket_types t JOIN platform_events e ON e.id = t.event_id
      WHERE t.id = $1::uuid AND t.status = 'active' AND e.status = 'published'
        AND (t.sales_start_at IS NULL OR t.sales_start_at <= NOW())
        AND (t.sales_end_at IS NULL OR t.sales_end_at > NOW())
      FOR UPDATE OF t
    `, [ticketId]);
    const row = rows[0];
    if (!row) notFound('Event ticket');
    if (row.reserved_quantity + row.sold_quantity + quantity > row.capacity) conflict('Event ticket is sold out');
    const competition = await competitionOrderContext(db, { eventId: row.event_id, ticketId: row.id, quantity, userId,
      sessionId: typeof raw.competitionSessionId === 'string' ? resourceId(raw.competitionSessionId) : undefined,
      device: typeof raw.device === 'string' ? raw.device : undefined });
    return {
      sellableType: 'event_ticket', fulfillmentType: 'event_registration', quantity,
      amountMinor: safeMoney(row.amount_minor), currency: row.currency, courseId: null,
      productVariantId: null, eventTicketTypeId: row.id, membershipPlanId: null,
      snapshot: { id: row.id, eventId: row.event_id, code: row.code, titleZh: row.title_zh || row.event_title_zh, titleEn: row.title_en || row.event_title_en, ...(competition ? { competition } : {}) },
      revenueShare: [],
    };
  }
  const rows = await platformQuery<{
    id: string; slug: string; name_zh: string; name_en: string; amount_minor: number | string;
    currency: string; period_unit: string; period_count: number;
  }>(db, `
    SELECT id::text, slug, name_zh, name_en, amount_minor, currency, period_unit, period_count
    FROM platform_membership_plans WHERE id = $1::uuid AND status = 'active' FOR SHARE
  `, [planId]);
  const row = rows[0];
  if (!row) notFound('Membership plan');
  if (quantity !== 1) badRequest('Membership quantity must be 1');
  return {
    sellableType: 'platform_membership', fulfillmentType: 'platform_membership', quantity: 1,
    amountMinor: safeMoney(row.amount_minor), currency: row.currency, courseId: null,
    productVariantId: null, eventTicketTypeId: null, membershipPlanId: row.id,
    snapshot: { id: row.id, slug: row.slug, nameZh: row.name_zh, nameEn: row.name_en, periodUnit: row.period_unit, periodCount: row.period_count },
    revenueShare: [],
  };
}

// Both preview and creation use the same authoritative pricing and eligibility rules.
// Preview never reserves inventory, consumes a coupon, or creates an order.
export async function quoteOrder(db: PlatformDb, rawItems: unknown[], couponCode: string | undefined, userId: number) {
    // Zero-total orders settle in this transaction, so lock before inventory pricing.
    await lockUserMemberships(db, userId);
    const member = await hasMembership(db, userId);
    const items: PricedItem[] = [];
    for (const raw of rawItems) items.push(await priceItem(db, raw, member, userId));
    const competitionItems = items.filter(item => item.snapshot.competition);
    if (competitionItems.length && (items.length !== 1 || couponCode)) badRequest('Competition registration requires one project per order without a coupon');
    const currency = items[0].currency;
    if (items.some((item) => item.currency !== currency)) badRequest('All order items must use one currency');
    const subtotal = items.reduce((sum, item) => sum + item.amountMinor * item.quantity, 0);
    if (!Number.isSafeInteger(subtotal)) badRequest('Order amount is outside the supported range');
    let discount = 0;
    let couponId: string | null = null;
    let couponEligibleSubtotalMinor: number | null = null;
    if (couponCode) {
      const coupons = await platformQuery<{
        id: string; discount_type: 'fixed' | 'percent'; discount_amount_minor: number | string | null;
        discount_bps: number | null; currency: string | null; minimum_order_amount_minor: number | string;
        max_redemptions: number | null; per_user_limit: number; eligibility: Record<string, unknown>;
      }>(db, `
        SELECT id::text, discount_type, discount_amount_minor, discount_bps, currency,
               minimum_order_amount_minor, max_redemptions, per_user_limit, eligibility
        FROM platform_coupons WHERE code = $1 AND status = 'active'
          AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW()) FOR UPDATE
      `, [couponCode]);
      const coupon = coupons[0];
      if (!coupon) badRequest('Coupon is invalid or inactive');
      const eligibleSubtotal = couponEligibleSubtotal(items, couponEligibility(coupon.eligibility ?? {}), member);
      couponEligibleSubtotalMinor = eligibleSubtotal;
      if (subtotal < safeMoney(coupon.minimum_order_amount_minor)) badRequest('Order does not meet the coupon minimum');
      if (coupon.currency && coupon.currency !== currency) badRequest('Coupon currency does not match the order');
      const counts = await platformQuery<{ total: number | string; own: number | string }>(db, `
        SELECT COUNT(*) FILTER (WHERE status IN ('reserved','applied')) AS total,
               COUNT(*) FILTER (WHERE user_id = $2 AND status IN ('reserved','applied')) AS own
        FROM platform_coupon_redemptions WHERE coupon_id = $1::uuid
      `, [coupon.id, userId]);
      if (coupon.max_redemptions != null && Number(counts[0].total) >= coupon.max_redemptions) conflict('Coupon redemption limit reached');
      if (Number(counts[0].own) >= coupon.per_user_limit) conflict('Coupon per-user limit reached');
      discount = coupon.discount_type === 'fixed'
        ? Math.min(eligibleSubtotal, safeMoney(coupon.discount_amount_minor!))
        : Math.floor(eligibleSubtotal * Number(coupon.discount_bps) / 10_000);
      couponId = coupon.id;
    }
    const total = subtotal - discount;
    return { items, member, currency, subtotal, discount, total, couponId, couponEligibleSubtotalMinor };
}
