import { createHash, randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { requirePlatformActor, requirePlatformAdmin, type PlatformActor } from '../platform/auth.js';
import {
  enqueuePlatformEvent,
  platformDb,
  platformQuery,
  platformTransaction,
  requireInstructor,
  sendMutation,
  withIdempotency,
  type PlatformDb,
} from '../platform/db.js';
import { badRequest, conflict, notFound, PlatformApiError } from '../platform/errors.js';
import { platformRouter, privateNoStore, publicCache } from '../platform/http.js';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../platform/data_encryption.js';
import {
  PLATFORM_PAYMENT_PROVIDERS,
  createProviderPayment,
  verifyProviderNotification,
  type PlatformPaymentProvider,
} from '../platform/payment.js';
import {
  arrayField,
  enumField,
  integerField,
  isObject,
  isoTimestampField,
  objectField,
  pagination,
  readJsonObject,
  resourceId,
  stringField,
} from '../platform/validation.js';

export const platformCommerceRoutes = platformRouter();

type SellableType = 'course' | 'product_variant' | 'event_ticket' | 'platform_membership';
type FulfillmentType = 'course_entitlement' | 'download' | 'shipment' | 'event_registration' | 'platform_membership';

interface PricedItem {
  sellableType: SellableType;
  fulfillmentType: FulfillmentType;
  quantity: number;
  amountMinor: number;
  currency: string;
  courseId: string | null;
  productVariantId: string | null;
  eventTicketTypeId: string | null;
  membershipPlanId: string | null;
  snapshot: Record<string, unknown>;
  revenueShare: Array<{ instructorId: string; shareBps: number }>;
}

interface OrderRow extends Record<string, unknown> {
  id: string;
  order_number: string;
  buyer_user_id: number | null;
  status: string;
  currency: string;
  total_amount_minor: number | string;
}

function safeMoney(value: number | string, label = 'amount'): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) badRequest(`${label} is outside the supported range`);
  return amount;
}

function safeSignedMoney(value: number | string, label = 'amount'): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) badRequest(`${label} is outside the supported range`);
  return amount;
}

function merchantAccount(provider: PlatformPaymentProvider): string {
  const value = provider === 'alipay' ? process.env.ALIPAY_APP_ID : process.env.WECHAT_MCHID;
  if (!value) throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503, `${provider} is not configured`);
  return value;
}

function orderNumber(): string {
  return `PLT-${randomBytes(10).toString('hex').toUpperCase()}`;
}

function payoutNumber(): string {
  return `PLT-PO-${randomBytes(8).toString('hex').toUpperCase()}`;
}

function hashReference(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function hasMembership(db: PlatformDb, userId: number): Promise<boolean> {
  const rows = await platformQuery<{ active: boolean }>(db, `
    SELECT EXISTS (
      SELECT 1 FROM platform_memberships
      WHERE user_id = $1 AND status = 'active'
        AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
    ) AS active
  `, [userId]);
  return rows[0]?.active === true;
}

async function priceItem(db: PlatformDb, raw: unknown, member: boolean): Promise<PricedItem> {
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
      product_title_zh: string; product_title_en: string; title_zh: string; title_en: string;
      amount_minor: number | string; member_amount_minor: number | string | null; currency: string;
      inventory_on_hand: number; inventory_reserved: number;
    }>(db, `
      SELECT v.id::text, p.id::text AS product_id, p.product_type, v.sku,
             p.title_zh AS product_title_zh, p.title_en AS product_title_en,
             v.title_zh, v.title_en, v.amount_minor, v.member_amount_minor, v.currency,
             v.inventory_on_hand, v.inventory_reserved
      FROM platform_product_variants v JOIN platform_products p ON p.id = v.product_id
      WHERE ${predicate} AND p.status = 'active' AND v.status = 'active'
      ORDER BY v.created_at, v.id LIMIT 1 FOR UPDATE OF v
    `, parameters);
    const row = rows[0];
    if (!row) notFound('Product variant');
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
    return {
      sellableType: 'event_ticket', fulfillmentType: 'event_registration', quantity,
      amountMinor: safeMoney(row.amount_minor), currency: row.currency, courseId: null,
      productVariantId: null, eventTicketTypeId: row.id, membershipPlanId: null,
      snapshot: { id: row.id, eventId: row.event_id, code: row.code, titleZh: row.title_zh || row.event_title_zh, titleEn: row.title_en || row.event_title_en },
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

async function reserveOrderItem(db: PlatformDb, orderId: string, itemId: string, item: PricedItem, actor: PlatformActor): Promise<void> {
  await platformQuery(db, `
    INSERT INTO platform_fulfillment_ledger (order_id, order_item_id, entry_type, delta_quantity, actor_user_id)
    VALUES ($1::uuid, $2::uuid, 'reserve', $3, $4)
  `, [orderId, itemId, item.quantity, actor.userId]);
  if (item.productVariantId) {
    await platformQuery(db, `
      INSERT INTO platform_inventory_ledger (product_variant_id, entry_type, delta_reserved, order_item_id, actor_user_id)
      VALUES ($1::uuid, 'reserve', $2, $3::uuid, $4)
    `, [item.productVariantId, item.quantity, itemId, actor.userId]);
  }
  if (item.eventTicketTypeId) {
    const eventId = String(item.snapshot.eventId);
    await platformQuery(db, `
      UPDATE platform_event_ticket_types
      SET reserved_quantity = reserved_quantity + $2, capacity_revision = capacity_revision + 1
      WHERE id = $1::uuid
    `, [item.eventTicketTypeId, item.quantity]);
    await platformQuery(db, `
      INSERT INTO platform_event_registrations (
        event_id, ticket_type_id, user_id, order_item_id, status, quantity, reservation_expires_at
      ) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, 'reserved', $5, NOW() + INTERVAL '30 minutes')
    `, [eventId, item.eventTicketTypeId, actor.userId, itemId, item.quantity]);
  }
}

async function releaseOrder(db: PlatformDb, orderId: string, actorUserId: number | null): Promise<void> {
  const items = await platformQuery<{
    id: string; product_variant_id: string | null; event_ticket_type_id: string | null; quantity: number;
  }>(db, `SELECT id::text, product_variant_id::text, event_ticket_type_id::text, quantity
          FROM platform_order_items WHERE order_id = $1::uuid ORDER BY line_number FOR UPDATE`, [orderId]);
  for (const item of items) {
    await platformQuery(db, `
      INSERT INTO platform_fulfillment_ledger (order_id, order_item_id, entry_type, delta_quantity, actor_user_id)
      VALUES ($1::uuid, $2::uuid, 'release', -$3, $4)
    `, [orderId, item.id, item.quantity, actorUserId]);
    if (item.product_variant_id) {
      await platformQuery(db, `
        INSERT INTO platform_inventory_ledger (product_variant_id, entry_type, delta_reserved, order_item_id, actor_user_id)
        VALUES ($1::uuid, 'release', -$2, $3::uuid, $4)
      `, [item.product_variant_id, item.quantity, item.id, actorUserId]);
    }
    if (item.event_ticket_type_id) {
      await platformQuery(db, `
        UPDATE platform_event_ticket_types SET reserved_quantity = reserved_quantity - $2, capacity_revision = capacity_revision + 1
        WHERE id = $1::uuid
      `, [item.event_ticket_type_id, item.quantity]);
      await platformQuery(db, `
        UPDATE platform_event_registrations SET status = 'cancelled', cancelled_at = NOW()
        WHERE order_item_id = $1::uuid AND status = 'reserved'
      `, [item.id]);
    }
  }
  await platformQuery(db, `
    UPDATE platform_coupon_redemptions SET status = 'released', released_at = NOW()
    WHERE order_id = $1::uuid AND status = 'reserved'
  `, [orderId]);
}

function membershipUntil(snapshot: Record<string, unknown>, base = new Date()): string | null {
  if (snapshot.periodUnit === 'lifetime') return null;
  const count = Number(snapshot.periodCount);
  const date = new Date(base);
  if (snapshot.periodUnit === 'day') date.setUTCDate(date.getUTCDate() + count);
  else if (snapshot.periodUnit === 'month') date.setUTCMonth(date.getUTCMonth() + count);
  else date.setUTCFullYear(date.getUTCFullYear() + count);
  return date.toISOString();
}

async function refreshOrderFulfillmentStatus(
  db: PlatformDb,
  orderId: string,
): Promise<'paid' | 'partially_fulfilled' | 'fulfilled'> {
  const rows = await platformQuery<{ all_complete: boolean; any_progress: boolean }>(db, `
    WITH item_progress AS (
      SELECT item.quantity, item.fulfillment_type,
             COALESCE((
               SELECT SUM(ledger.delta_quantity)::integer
               FROM platform_fulfillment_ledger ledger
               WHERE ledger.order_item_id = item.id AND ledger.entry_type = 'grant'
                 AND NOT EXISTS (
                   SELECT 1 FROM platform_fulfillment_ledger reversal
                   WHERE reversal.reversal_of_ledger_id = ledger.id
                 )
             ), 0) AS granted_quantity,
             COALESCE((
               SELECT SUM(ledger.delta_quantity)::integer
               FROM platform_fulfillment_ledger ledger
               WHERE ledger.order_item_id = item.id AND ledger.entry_type = 'ship'
                 AND NOT EXISTS (
                   SELECT 1 FROM platform_fulfillment_ledger reversal
                   WHERE reversal.reversal_of_ledger_id = ledger.id
                 )
             ), 0) AS shipped_quantity,
             COALESCE((
               SELECT SUM(ledger.delta_quantity)::integer
               FROM platform_fulfillment_ledger ledger
               WHERE ledger.order_item_id = item.id AND ledger.entry_type = 'deliver'
                 AND NOT EXISTS (
                   SELECT 1 FROM platform_fulfillment_ledger reversal
                   WHERE reversal.reversal_of_ledger_id = ledger.id
                 )
             ), 0) AS delivered_quantity
      FROM platform_order_items item
      WHERE item.order_id = $1::uuid
    )
    SELECT COALESCE(BOOL_AND(
             CASE WHEN fulfillment_type = 'shipment'
                  THEN delivered_quantity >= quantity
                  ELSE granted_quantity >= quantity END
           ), FALSE) AS all_complete,
           COALESCE(BOOL_OR(
             CASE WHEN fulfillment_type = 'shipment'
                  THEN shipped_quantity > 0 OR delivered_quantity > 0
                  ELSE granted_quantity > 0 END
           ), FALSE) AS any_progress
    FROM item_progress
  `, [orderId]);
  const status = rows[0]?.all_complete
    ? 'fulfilled'
    : rows[0]?.any_progress
      ? 'partially_fulfilled'
      : 'paid';
  await platformQuery(db, `
    UPDATE platform_orders
    SET status = $2,
        fulfilled_at = CASE WHEN $2 = 'fulfilled' THEN COALESCE(fulfilled_at, NOW()) ELSE NULL END
    WHERE id = $1::uuid AND status IN ('paid', 'partially_fulfilled')
  `, [orderId, status]);
  return status;
}

async function settlePaidOrder(db: PlatformDb, order: OrderRow): Promise<void> {
  const items = await platformQuery<{
    id: string; sellable_type: SellableType; fulfillment_type: FulfillmentType; quantity: number;
    course_id: string | null; product_variant_id: string | null; event_ticket_type_id: string | null;
    membership_plan_id: string | null; line_total_amount_minor: number | string;
    currency: string; sellable_snapshot: Record<string, unknown>; revenue_share_snapshot: Array<{ instructorId: string; shareBps: number }>;
  }>(db, `
    SELECT id::text, sellable_type, fulfillment_type, quantity, course_id::text, product_variant_id::text,
           event_ticket_type_id::text, membership_plan_id::text, line_total_amount_minor, currency,
           sellable_snapshot, revenue_share_snapshot
    FROM platform_order_items WHERE order_id = $1::uuid ORDER BY line_number FOR UPDATE
  `, [order.id]);
  for (const item of items) {
    if (item.product_variant_id) {
      await platformQuery(db, `
        INSERT INTO platform_inventory_ledger (product_variant_id, entry_type, delta_on_hand, delta_reserved, order_item_id)
        VALUES ($1::uuid, 'sell', -$2, -$2, $3::uuid)
      `, [item.product_variant_id, item.quantity, item.id]);
    }
    if (item.event_ticket_type_id) {
      await platformQuery(db, `
        UPDATE platform_event_ticket_types
        SET reserved_quantity = reserved_quantity - $2, sold_quantity = sold_quantity + $2, capacity_revision = capacity_revision + 1
        WHERE id = $1::uuid
      `, [item.event_ticket_type_id, item.quantity]);
      await platformQuery(db, `
        UPDATE platform_event_registrations SET status = 'confirmed', confirmed_at = NOW(), reservation_expires_at = NULL
        WHERE order_item_id = $1::uuid AND status = 'reserved'
      `, [item.id]);
    }
    if (item.course_id) {
      const entitlement = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_course_entitlements (user_id, course_id, status, valid_from)
        VALUES ($1, $2::uuid, 'active', NOW())
        ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active', valid_from = LEAST(platform_course_entitlements.valid_from, NOW()), valid_until = NULL
        RETURNING id::text
      `, [order.buyer_user_id, item.course_id]);
      await platformQuery(db, `
        INSERT INTO platform_entitlement_ledger (entitlement_id, entry_type, delta_access, valid_from, order_item_id)
        VALUES ($1::uuid, 'purchase', 1, NOW(), $2::uuid)
      `, [entitlement[0].id, item.id]);
      for (const share of item.revenue_share_snapshot ?? []) {
        const amount = Math.floor(safeMoney(item.line_total_amount_minor) * Number(share.shareBps) / 10_000);
        if (amount > 0) {
          await platformQuery(db, `
            INSERT INTO platform_instructor_revenue_ledger (
              instructor_id, order_id, order_item_id, entry_type, delta_amount_minor, currency, share_bps_snapshot
            ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'sale', $4, $5, $6)
          `, [share.instructorId, order.id, item.id, amount, item.currency, share.shareBps]);
        }
      }
    }
    if (item.membership_plan_id) {
      const existingMembership = await platformQuery<{ id: string; valid_until: string | null }>(db, `
        SELECT id::text, valid_until FROM platform_memberships
        WHERE user_id = $1 AND plan_id = $2::uuid FOR UPDATE
      `, [order.buyer_user_id, item.membership_plan_id]);
      const now = new Date();
      const base = existingMembership[0]?.valid_until && new Date(existingMembership[0].valid_until) > now
        ? new Date(existingMembership[0].valid_until)
        : now;
      const validUntil = membershipUntil(item.sellable_snapshot, base);
      const membership = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_memberships (user_id, plan_id, status, valid_from, valid_until)
        VALUES ($1, $2::uuid, 'active', NOW(), $3::timestamptz)
        ON CONFLICT (user_id, plan_id) DO UPDATE SET status = 'active', valid_until = EXCLUDED.valid_until
        RETURNING id::text
      `, [order.buyer_user_id, item.membership_plan_id, validUntil]);
      await platformQuery(db, `
        INSERT INTO platform_membership_ledger (membership_id, entry_type, delta_access, valid_from, valid_until, order_item_id)
        VALUES ($1::uuid, $2, 1, $3::timestamptz, $4::timestamptz, $5::uuid)
      `, [membership[0].id, existingMembership[0] ? 'renewal' : 'purchase', base.toISOString(), validUntil, item.id]);
    }
    await platformQuery(db, `
      INSERT INTO platform_fulfillment_ledger (order_id, order_item_id, entry_type, delta_quantity)
      VALUES ($1::uuid, $2::uuid, 'release', -$3)
    `, [order.id, item.id, item.quantity]);
    if (item.fulfillment_type !== 'shipment') {
      await platformQuery(db, `
        INSERT INTO platform_fulfillment_ledger (order_id, order_item_id, entry_type, delta_quantity)
        VALUES ($1::uuid, $2::uuid, 'grant', $3)
      `, [order.id, item.id, item.quantity]);
    }
  }
  await platformQuery(db, `UPDATE platform_coupon_redemptions SET status = 'applied', applied_at = NOW() WHERE order_id = $1::uuid AND status = 'reserved'`, [order.id]);
  const status = await refreshOrderFulfillmentStatus(db, order.id);
  await enqueuePlatformEvent(db, `platform.order.${status}`, 'platform_order', order.id,
    `order:${order.id}:payment-settled:${status}`, { orderId: order.id, status });
}

async function orderDetails(db: PlatformDb, predicate: string, parameters: readonly unknown[]): Promise<Record<string, unknown> | undefined> {
  const rows = await platformQuery<Record<string, unknown>>(db, `
    SELECT o.id::text, o.order_number AS "orderNumber", o.buyer_user_id AS "buyerUserId", o.status,
           o.currency, o.subtotal_amount_minor AS "subtotalAmountMinor", o.discount_amount_minor AS "discountAmountMinor",
           o.shipping_amount_minor AS "shippingAmountMinor", o.total_amount_minor AS "totalAmountMinor",
           o.paid_at AS "paidAt", o.cancelled_at AS "cancelledAt", o.fulfilled_at AS "fulfilledAt", o.created_at AS "createdAt",
           COALESCE(jsonb_agg(jsonb_build_object(
             'id', i.id::text, 'sellableType', i.sellable_type, 'fulfillmentType', i.fulfillment_type,
             'quantity', i.quantity,
             'unitAmountMinor', i.unit_amount_minor, 'lineTotalAmountMinor', i.line_total_amount_minor,
             'currency', i.currency, 'snapshot', i.sellable_snapshot
           ) ORDER BY i.line_number) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
    FROM platform_orders o LEFT JOIN platform_order_items i ON i.order_id = o.id
    WHERE ${predicate}
    GROUP BY o.id
  `, parameters);
  const order = rows[0];
  if (!order) return undefined;
  const events = await platformQuery<{
    id: string; order_item_id: string; entry_type: ShipmentEventType; delta_quantity: number;
    external_reference: string | null; metadata: Record<string, unknown>; created_at: string;
  }>(db, `
    SELECT source.id::text, source.order_item_id::text, source.entry_type, source.delta_quantity,
           source.external_reference, source.metadata, source.created_at
    FROM platform_fulfillment_ledger source
    WHERE source.order_id = $1::uuid AND source.entry_type IN ('ship', 'deliver', 'return')
      AND NOT EXISTS (
        SELECT 1 FROM platform_fulfillment_ledger reversal
        WHERE reversal.reversal_of_ledger_id = source.id
      )
    ORDER BY source.created_at, source.id
  `, [order.id]);
  const eventsByItem = new Map<string, Array<Record<string, unknown>>>();
  for (const event of events) {
    const encryptedPayload = typeof event.metadata.encryptedPayload === 'string'
      ? event.metadata.encryptedPayload
      : null;
    const keyVersion = typeof event.metadata.keyVersion === 'number'
      ? event.metadata.keyVersion
      : null;
    const privateFields = encryptedPayload && keyVersion != null
      ? decryptPlatformPrivateData(Buffer.from(encryptedPayload, 'base64'), keyVersion)
      : {};
    const itemEvents = eventsByItem.get(event.order_item_id) ?? [];
    itemEvents.push({
      id: event.id,
      type: event.entry_type,
      quantity: event.delta_quantity,
      externalReference: event.external_reference,
      ...privateFields,
      createdAt: event.created_at,
    });
    eventsByItem.set(event.order_item_id, itemEvents);
  }
  const items = Array.isArray(order.items) ? order.items : [];
  order.items = items.map((value) => {
    if (!isObject(value) || typeof value.id !== 'string') return value;
    const itemEvents = eventsByItem.get(value.id) ?? [];
    const quantityFor = (type: ShipmentEventType) => itemEvents.reduce(
      (sum, event) => sum + (event.type === type && typeof event.quantity === 'number' ? event.quantity : 0),
      0,
    );
    return {
      ...value,
      fulfillment: {
        shippedQuantity: quantityFor('ship'),
        deliveredQuantity: quantityFor('deliver'),
        returnedQuantity: quantityFor('return'),
        events: itemEvents,
      },
    };
  });
  return order;
}

interface ShippingAddressPayload extends Record<string, unknown> {
  recipientName: string;
  phone: string;
  countryCode: string;
  region: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
}

function shippingAddressPayload(body: Record<string, unknown>, current?: Record<string, unknown>): ShippingAddressPayload {
  const input = objectField(body, 'address') ?? body;
  const merged = { ...(current ?? {}), ...input };
  const recipientName = stringField(merged, 'recipientName', { required: true, max: 160 })!;
  const phone = stringField(merged, 'phone', { required: true, max: 40 })!;
  const countryCode = stringField(merged, 'countryCode', { required: true, max: 2, pattern: /^[A-Za-z]{2}$/ })!.toUpperCase();
  const region = stringField(merged, 'region', { max: 160 }) ?? '';
  const city = stringField(merged, 'city', { required: true, max: 160 })!;
  const postalCode = stringField(merged, 'postalCode', { max: 40 }) ?? '';
  const addressLine1 = stringField(merged, 'addressLine1', { required: true, max: 500 })!;
  const addressLine2 = stringField(merged, 'addressLine2', { max: 500 }) ?? '';
  if (!/[0-9]{4}/.test(phone.replace(/\D/g, ''))) badRequest('phone must contain at least four digits');
  return { recipientName, phone, countryCode, region, city, postalCode, addressLine1, addressLine2 };
}

function publicShippingAddress(row: {
  id: string; label: string; is_default: boolean; encrypted_payload: Buffer | Uint8Array; key_version: number;
  created_at: string; updated_at: string;
}): Record<string, unknown> {
  return {
    id: row.id,
    label: row.label,
    isDefault: row.is_default,
    ...decryptPlatformPrivateData(Buffer.from(row.encrypted_payload), row.key_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
           (
             membership.status = 'active'
             AND membership.valid_from <= NOW()
             AND (membership.valid_until IS NULL OR membership.valid_until > NOW())
           ) AS "isActive",
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

platformCommerceRoutes.get('/me/shipping-addresses', async (c) => {
  const actor = await requirePlatformActor(c);
  const rows = await platformQuery<{
    id: string; label: string; is_default: boolean; encrypted_payload: Buffer; key_version: number;
    created_at: string; updated_at: string;
  }>(platformDb(), `
    SELECT id::text, label, is_default, encrypted_payload, key_version, created_at, updated_at
    FROM platform_shipping_addresses
    WHERE user_id = $1 AND archived_at IS NULL
    ORDER BY is_default DESC, updated_at DESC, id
  `, [actor.userId]);
  privateNoStore(c);
  return c.json({ items: rows.map(publicShippingAddress) });
});

platformCommerceRoutes.post('/me/shipping-addresses', async (c) => {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const label = stringField(body, 'label', { max: 80 }) ?? '';
  const isDefault = body.isDefault === undefined ? false : body.isDefault === true;
  if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') badRequest('isDefault must be a boolean');
  const address = shippingAddressPayload(body);
  const encrypted = encryptPlatformPrivateData(address);
  const digits = address.phone.replace(/\D/g, '');
  const result = await withIdempotency(c, actor, 'commerce.shipping-address.create', body, async (db) => {
    if (isDefault) await platformQuery(db, `UPDATE platform_shipping_addresses SET is_default = FALSE WHERE user_id = $1 AND archived_at IS NULL`, [actor.userId]);
    const rows = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_shipping_addresses (
        user_id, label, recipient_hint, phone_last4, country_code,
        encrypted_payload, key_version, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id::text
    `, [actor.userId, label, address.recipientName.slice(0, 1), digits.slice(-4), address.countryCode,
      encrypted.payload, encrypted.keyVersion, isDefault]);
    return { status: 201, body: { id: rows[0].id, label, isDefault, ...address }, resourceType: 'platform_shipping_address', resourceId: rows[0].id };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.patch('/me/shipping-addresses/:id', async (c) => {
  const actor = await requirePlatformActor(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const result = await withIdempotency(c, actor, `commerce.shipping-address.update:${id}`, body, async (db) => {
    const rows = await platformQuery<{
      id: string; label: string; is_default: boolean; encrypted_payload: Buffer; key_version: number;
    }>(db, `
      SELECT id::text, label, is_default, encrypted_payload, key_version
      FROM platform_shipping_addresses
      WHERE id = $1::uuid AND user_id = $2 AND archived_at IS NULL FOR UPDATE
    `, [id, actor.userId]);
    const current = rows[0];
    if (!current) notFound('Shipping address');
    const decrypted = decryptPlatformPrivateData(Buffer.from(current.encrypted_payload), current.key_version);
    const address = shippingAddressPayload(body, decrypted);
    const encrypted = encryptPlatformPrivateData(address);
    const label = stringField(body, 'label', { max: 80 }) ?? current.label;
    const isDefault = body.isDefault === undefined ? current.is_default : body.isDefault === true;
    if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') badRequest('isDefault must be a boolean');
    if (isDefault) await platformQuery(db, `UPDATE platform_shipping_addresses SET is_default = FALSE WHERE user_id = $1 AND id <> $2::uuid AND archived_at IS NULL`, [actor.userId, id]);
    const digits = address.phone.replace(/\D/g, '');
    await platformQuery(db, `
      UPDATE platform_shipping_addresses SET label = $3, recipient_hint = $4, phone_last4 = $5,
        country_code = $6, encrypted_payload = $7, key_version = $8, is_default = $9
      WHERE id = $1::uuid AND user_id = $2
    `, [id, actor.userId, label, address.recipientName.slice(0, 1), digits.slice(-4), address.countryCode,
      encrypted.payload, encrypted.keyVersion, isDefault]);
    return { status: 200, body: { id, label, isDefault, ...address }, resourceType: 'platform_shipping_address', resourceId: id };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.delete('/me/shipping-addresses/:id', async (c) => {
  const actor = await requirePlatformActor(c);
  const id = resourceId(c.req.param('id'));
  const result = await withIdempotency(c, actor, `commerce.shipping-address.archive:${id}`, {}, async (db) => {
    const rows = await platformQuery(db, `
      UPDATE platform_shipping_addresses SET archived_at = NOW(), is_default = FALSE
      WHERE id = $1::uuid AND user_id = $2 AND archived_at IS NULL RETURNING id::text
    `, [id, actor.userId]);
    if (!rows[0]) notFound('Shipping address');
    return { status: 200, body: { id, archived: true }, resourceType: 'platform_shipping_address', resourceId: id };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.get('/orders', async (c) => {
  const actor = await requirePlatformActor(c);
  const { page, pageSize, offset } = pagination(c);
  const rows = await platformQuery(platformDb(), `
    SELECT id::text, order_number AS "orderNumber", status, currency, total_amount_minor AS "totalAmountMinor",
           paid_at AS "paidAt", created_at AS "createdAt"
    FROM platform_orders WHERE buyer_user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3
  `, [actor.userId, pageSize, offset]);
  privateNoStore(c);
  return c.json({ items: rows, page, pageSize });
});

platformCommerceRoutes.get('/orders/:id', async (c) => {
  const actor = await requirePlatformActor(c);
  const id = resourceId(c.req.param('id'));
  const row = await orderDetails(platformDb(), 'o.buyer_user_id = $1 AND (o.id = $2::uuid OR o.order_number = $2)', [actor.userId, id]);
  if (!row) notFound('Order');
  privateNoStore(c);
  return c.json(row);
});

platformCommerceRoutes.post('/orders', async (c) => {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const supplied = arrayField(body, 'items', { maxItems: 100 });
  const rawItems = supplied?.length ? supplied : [body];
  if (!rawItems.length) badRequest('items is required');
  const clientOrderKey = stringField(body, 'clientOrderKey', { max: 120 }) ?? c.req.header('Idempotency-Key') ?? '';
  const couponCode = stringField(body, 'couponCode', { max: 64 })?.toUpperCase();
  const shippingAddressId = body.shippingAddressId == null
    ? undefined
    : resourceId(stringField(body, 'shippingAddressId', { max: 128 })!, 'shippingAddressId');
  const result = await withIdempotency(c, actor, 'commerce.order.create', body, async (db) => {
    const member = await hasMembership(db, actor.userId!);
    const items: PricedItem[] = [];
    for (const raw of rawItems) items.push(await priceItem(db, raw, member));
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
      `, [coupon.id, actor.userId]);
      if (coupon.max_redemptions != null && Number(counts[0].total) >= coupon.max_redemptions) conflict('Coupon redemption limit reached');
      if (Number(counts[0].own) >= coupon.per_user_limit) conflict('Coupon per-user limit reached');
      discount = coupon.discount_type === 'fixed'
        ? Math.min(eligibleSubtotal, safeMoney(coupon.discount_amount_minor!))
        : Math.floor(eligibleSubtotal * Number(coupon.discount_bps) / 10_000);
      couponId = coupon.id;
    }
    const total = subtotal - discount;
    let shippingSnapshotEncrypted: Buffer | null = null;
    let shippingKeyVersion: number | null = null;
    if (items.some((item) => item.fulfillmentType === 'shipment')) {
      if (!shippingAddressId) badRequest('shippingAddressId is required for physical products');
      const addresses = await platformQuery<{ encrypted_payload: Buffer; key_version: number }>(db, `
        SELECT encrypted_payload, key_version FROM platform_shipping_addresses
        WHERE id = $1::uuid AND user_id = $2 AND archived_at IS NULL FOR SHARE
      `, [shippingAddressId, actor.userId]);
      if (!addresses[0]) notFound('Shipping address');
      const snapshot = decryptPlatformPrivateData(Buffer.from(addresses[0].encrypted_payload), addresses[0].key_version);
      const encrypted = encryptPlatformPrivateData({ ...snapshot, sourceAddressId: shippingAddressId });
      shippingSnapshotEncrypted = encrypted.payload;
      shippingKeyVersion = encrypted.keyVersion;
    }
    const orderRows = await platformQuery<{ id: string; order_number: string }>(db, `
      INSERT INTO platform_orders (
        order_number, buyer_user_id, buyer_display_name_snapshot, client_order_key, status, currency,
        subtotal_amount_minor, discount_amount_minor, shipping_amount_minor, total_amount_minor, coupon_id, pricing_snapshot,
        shipping_snapshot_encrypted, shipping_key_version
      ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, 0, $8, $9::uuid, $10::jsonb, $11, $12)
      RETURNING id::text, order_number
    `, [orderNumber(), actor.userId, actor.displayName, clientOrderKey, currency, subtotal, discount, total, couponId,
      JSON.stringify({ member, couponCode: couponCode ?? null, couponEligibleSubtotalMinor }), shippingSnapshotEncrypted, shippingKeyVersion]);
    const order = orderRows[0];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const lineTotal = item.amountMinor * item.quantity;
      const inserted = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_order_items (
          order_id, line_number, course_id, product_variant_id, event_ticket_type_id, membership_plan_id,
          sellable_type, sellable_snapshot, quantity, unit_amount_minor, line_total_amount_minor, currency,
          fulfillment_type, revenue_share_snapshot
        ) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7, $8::jsonb, $9, $10, $11, $12, $13, $14::jsonb)
        RETURNING id::text
      `, [order.id, index + 1, item.courseId, item.productVariantId, item.eventTicketTypeId, item.membershipPlanId,
        item.sellableType, JSON.stringify(item.snapshot), item.quantity, item.amountMinor, lineTotal, item.currency,
        item.fulfillmentType, JSON.stringify(item.revenueShare)]);
      await reserveOrderItem(db, order.id, inserted[0].id, item, actor);
    }
    if (couponId) {
      await platformQuery(db, `
        INSERT INTO platform_coupon_redemptions (coupon_id, user_id, order_id, status, discount_amount_minor, currency, reservation_expires_at)
        VALUES ($1::uuid, $2, $3::uuid, 'reserved', $4, $5, NOW() + INTERVAL '30 minutes')
      `, [couponId, actor.userId, order.id, discount, currency]);
    }
    await platformQuery(db, `UPDATE platform_orders SET status = 'pending_payment' WHERE id = $1::uuid`, [order.id]);
    if (total === 0) {
      await platformQuery(db, `UPDATE platform_orders SET status = 'paid', paid_at = NOW() WHERE id = $1::uuid`, [order.id]);
      await settlePaidOrder(db, { id: order.id, order_number: order.order_number, buyer_user_id: actor.userId, status: 'paid', currency, total_amount_minor: 0 });
    }
    await enqueuePlatformEvent(db, 'platform.order.created', 'platform_order', order.id, `order:${order.id}:created`, { orderId: order.id });
    return { status: 201, body: { id: order.id, orderNumber: order.order_number, status: total === 0 ? 'fulfilled' : 'pending_payment', currency, totalAmountMinor: total }, resourceType: 'platform_order', resourceId: order.id };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.post('/orders/:id/cancel', async (c) => {
  const actor = await requirePlatformActor(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const result = await withIdempotency(c, actor, `commerce.order.cancel:${id}`, body, async (db) => {
    const rows = await platformQuery<OrderRow>(db, `SELECT id::text, order_number, buyer_user_id, status, currency, total_amount_minor FROM platform_orders WHERE id = $1::uuid AND buyer_user_id = $2 FOR UPDATE`, [id, actor.userId]);
    const order = rows[0];
    if (!order) notFound('Order');
    if (!['draft', 'pending_payment'].includes(order.status)) throw new PlatformApiError('INVALID_STATE', 409, 'Only unpaid orders can be cancelled');
    await releaseOrder(db, order.id, actor.userId);
    await platformQuery(db, `
      UPDATE platform_payment_attempts SET status = 'cancelled', failure_code = 'order_cancelled'
      WHERE order_id = $1::uuid AND status IN ('initiated','pending')
    `, [order.id]);
    await platformQuery(db, `UPDATE platform_orders SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1::uuid`, [order.id]);
    await enqueuePlatformEvent(db, 'platform.order.cancelled', 'platform_order', order.id, `order:${order.id}:cancelled`, { orderId: order.id });
    return { status: 200, body: { id: order.id, status: 'cancelled' }, resourceType: 'platform_order', resourceId: order.id };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.post('/admin/orders/expire-reservations', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const body = await readJsonObject(c);
  const limit = integerField(body, 'limit', { min: 1, max: 500 }) ?? 100;
  const result = await withIdempotency(c, actor, 'commerce.order.expire-reservations', body, async (db) => {
    const orders = await platformQuery<{ id: string }>(db, `
      SELECT id::text
      FROM platform_orders
      WHERE status = 'pending_payment' AND created_at + INTERVAL '30 minutes' <= NOW()
      ORDER BY created_at, id
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `, [limit]);
    for (const order of orders) {
      await releaseOrder(db, order.id, actor.userId);
      await platformQuery(db, `
        UPDATE platform_payment_attempts SET status = 'cancelled', failure_code = 'reservation_expired'
        WHERE order_id = $1::uuid AND status IN ('initiated','pending')
      `, [order.id]);
      await platformQuery(db, `
        UPDATE platform_orders SET status = 'cancelled', cancelled_at = NOW()
        WHERE id = $1::uuid AND status = 'pending_payment'
      `, [order.id]);
      await enqueuePlatformEvent(db, 'platform.order.reservation_expired', 'platform_order', order.id,
        `order:${order.id}:reservation-expired`, { orderId: order.id });
    }
    const staleAttempts = await platformQuery<{ id: string }>(db, `
      UPDATE platform_payment_attempts attempt
      SET status = 'failed', failure_code = 'attempt_expired'
      FROM platform_orders ordering
      WHERE ordering.id = attempt.order_id AND ordering.status <> 'pending_payment'
        AND attempt.status IN ('initiated','pending') AND attempt.expires_at <= NOW()
      RETURNING attempt.id::text
    `);
    await platformQuery(db, `
      INSERT INTO platform_audit_events (
        actor_user_id, actor_key, action, resource_type, outcome, metadata
      ) VALUES ($1, $2, 'commerce.order.expire_reservations',
        'platform_order_expiry_run', 'allowed', $3::jsonb)
    `, [actor.userId, actor.ownerKey, JSON.stringify({ expiredOrders: orders.length, expiredAttempts: staleAttempts.length, limit })]);
    return {
      status: 200,
      body: { expiredOrders: orders.length, expiredAttempts: staleAttempts.length },
    };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.post('/orders/:id/payment-attempts', async (c) => {
  const actor = await requirePlatformActor(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const provider = enumField(body, 'provider', PLATFORM_PAYMENT_PROVIDERS, { required: true })!;
  const clientType = enumField(body, 'clientType', ['pc', 'wap'] as const) ?? 'pc';
  const result = await withIdempotency(c, actor, `commerce.payment.create:${id}`, body, async (db) => {
    const rows = await platformQuery<OrderRow & { reservation_expires_at: string; reservation_expired: boolean }>(db, `
      SELECT id::text, order_number, buyer_user_id, status, currency, total_amount_minor,
             created_at + INTERVAL '30 minutes' AS reservation_expires_at,
             created_at + INTERVAL '30 minutes' <= NOW() AS reservation_expired
      FROM platform_orders WHERE id = $1::uuid AND buyer_user_id = $2 FOR UPDATE
    `, [id, actor.userId]);
    const order = rows[0];
    if (!order) notFound('Order');
    if (order.status !== 'pending_payment') throw new PlatformApiError('INVALID_STATE', 409, 'Order is not pending payment');
    if (order.reservation_expired) {
      await releaseOrder(db, order.id, actor.userId);
      await platformQuery(db, `
        UPDATE platform_payment_attempts SET status = 'cancelled', failure_code = 'reservation_expired'
        WHERE order_id = $1::uuid AND status IN ('initiated','pending')
      `, [order.id]);
      await platformQuery(db, `
        UPDATE platform_orders SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1::uuid
      `, [order.id]);
      await enqueuePlatformEvent(db, 'platform.order.reservation_expired', 'platform_order', order.id,
        `order:${order.id}:reservation-expired`, { orderId: order.id });
      return {
        status: 200,
        body: { id: order.id, status: 'cancelled', reasonCode: 'reservation_expired' },
        resourceType: 'platform_order',
        resourceId: order.id,
      };
    }
    const amount = safeMoney(order.total_amount_minor);
    if (amount === 0) throw new PlatformApiError('INVALID_STATE', 409, 'Zero-value orders do not require payment');
    const activeAttempts = await platformQuery<{ id: string; expired: boolean }>(db, `
      SELECT id::text, expires_at <= NOW() AS expired
      FROM platform_payment_attempts
      WHERE order_id = $1::uuid AND status IN ('initiated','pending')
      ORDER BY attempt_number
      FOR UPDATE
    `, [order.id]);
    const expiredAttemptIds = activeAttempts.filter((attempt) => attempt.expired).map((attempt) => attempt.id);
    if (expiredAttemptIds.length) {
      await platformQuery(db, `
        UPDATE platform_payment_attempts SET status = 'failed', failure_code = 'attempt_expired'
        WHERE id = ANY($1::uuid[]) AND status IN ('initiated','pending')
      `, [expiredAttemptIds]);
    }
    if (activeAttempts.some((attempt) => !attempt.expired)) {
      conflict('An active payment attempt already exists for this order');
    }
    const nextRows = await platformQuery<{ next: number }>(db, `SELECT COALESCE(MAX(attempt_number), 0)::integer + 1 AS next FROM platform_payment_attempts WHERE order_id = $1::uuid`, [order.id]);
    const attemptNumber = nextRows[0].next;
    const providerOrderId = `${order.order_number}-A${attemptNumber}`;
    const merchant = merchantAccount(provider);
    const attemptRows = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_payment_attempts (
        order_id, attempt_number, provider, merchant_account, provider_order_id, status,
        amount_minor, currency, request_hash, expires_at
      ) VALUES ($1::uuid, $2, $3, $4, $5, 'initiated', $6, $7, decode($8, 'hex'), $9::timestamptz)
      RETURNING id::text
    `, [order.id, attemptNumber, provider, merchant, providerOrderId, amount, order.currency,
      createHash('sha256').update(JSON.stringify(body)).digest('hex'), order.reservation_expires_at]);
    const payment = await createProviderPayment({ provider, clientType, orderNo: providerOrderId, returnOrderNo: order.order_number, amountCents: amount, currency: order.currency, subject: `CubeRoot ${order.order_number}`, payerIp: getIp(c) });
    await platformQuery(db, `UPDATE platform_payment_attempts SET status = 'pending' WHERE id = $1::uuid`, [attemptRows[0].id]);
    return { status: 201, body: { id: attemptRows[0].id, provider, status: 'pending', expiresAt: order.reservation_expires_at, ...payment }, resourceType: 'platform_payment_attempt', resourceId: attemptRows[0].id };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.post('/payments/:provider/notify', async (c) => {
  const provider = resourceId(c.req.param('provider')) as PlatformPaymentProvider;
  if (!PLATFORM_PAYMENT_PROVIDERS.includes(provider)) notFound('Payment provider');
  const event = await verifyProviderNotification(c, provider);
  await platformTransaction(async (db) => {
    const attempts = await platformQuery<{
      id: string; order_id: string; status: string; amount_minor: number | string; currency: string; merchant_account: string;
      provider_transaction_id: string | null;
    }>(db, `
      SELECT id::text, order_id::text, status, amount_minor, currency, merchant_account, provider_transaction_id
      FROM platform_payment_attempts
      WHERE provider = $1 AND merchant_account = $2 AND provider_order_id = $3
    `, [provider, event.merchantId, event.orderNo]);
    const locatedAttempt = attempts[0];
    if (!locatedAttempt || safeMoney(locatedAttempt.amount_minor) !== event.amountCents || locatedAttempt.currency !== event.currency) {
      throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Payment order, amount, or currency mismatch');
    }
    const orders = await platformQuery<OrderRow>(db, `
      SELECT id::text, order_number, buyer_user_id, status, currency, total_amount_minor
      FROM platform_orders WHERE id = $1::uuid FOR UPDATE
    `, [locatedAttempt.order_id]);
    const order = orders[0];
    if (!order) throw new PlatformApiError('INVALID_STATE', 409, 'Payment order no longer exists');
    const lockedAttempts = await platformQuery<{
      id: string; order_id: string; status: string; amount_minor: number | string; currency: string; merchant_account: string;
      provider_transaction_id: string | null;
    }>(db, `
      SELECT id::text, order_id::text, status, amount_minor, currency, merchant_account, provider_transaction_id
      FROM platform_payment_attempts WHERE id = $1::uuid FOR UPDATE
    `, [locatedAttempt.id]);
    const attempt = lockedAttempts[0]!;
    const payloadHash = createHash('sha256').update(JSON.stringify(event.raw)).digest('hex');
    const providerEventId = `${event.eventId}:${event.paid ? 'succeeded' : 'not_succeeded'}`;
    const inserted = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_provider_events (
        payment_attempt_id, order_id, provider, merchant_account, provider_event_id, provider_transaction_id,
        event_type, status, amount_minor, currency, signature_verified, merchant_verified,
        order_verified, amount_currency_verified, payload_hash, payload_sanitized
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 'received', $8, $9, TRUE, TRUE, TRUE, TRUE, decode($10, 'hex'), $11::jsonb)
      ON CONFLICT (provider, merchant_account, provider_event_id) DO NOTHING RETURNING id::text
    `, [attempt.id, attempt.order_id, provider, event.merchantId, providerEventId, event.providerTransactionId,
      event.paid ? 'payment.succeeded' : 'payment.not_succeeded', event.amountCents, event.currency, payloadHash,
      JSON.stringify({ provider, providerEventId: event.eventId, paid: event.paid })]);
    if (!inserted[0]) return;
    if (!event.paid) {
      if (['initiated', 'pending'].includes(attempt.status)) {
        await platformQuery(db, `
          UPDATE platform_payment_attempts SET status = 'failed', failure_code = 'provider_not_succeeded'
          WHERE id = $1::uuid
        `, [attempt.id]);
      }
      await platformQuery(db, `UPDATE platform_provider_events SET status = 'rejected', rejection_code = 'payment_not_succeeded' WHERE id = $1::uuid`, [inserted[0].id]);
      return;
    }
    if (['succeeded', 'refunded', 'chargeback'].includes(attempt.status)) {
      if (attempt.provider_transaction_id === event.providerTransactionId) {
        await platformQuery(db, `UPDATE platform_provider_events SET status = 'processed', processed_at = NOW() WHERE id = $1::uuid`, [inserted[0].id]);
      } else {
        await platformQuery(db, `
          UPDATE platform_provider_events SET status = 'rejected', rejection_code = 'additional_provider_transaction'
          WHERE id = $1::uuid
        `, [inserted[0].id]);
        await enqueuePlatformEvent(db, 'platform.payment.reconciliation_required', 'platform_order', order.id,
          `payment:${attempt.id}:${createHash('sha256').update(providerEventId).digest('hex')}:additional-transaction`, {
            orderId: order.id, paymentAttemptId: attempt.id, reasonCode: 'additional_provider_transaction',
          });
      }
      return;
    }
    if (!['initiated', 'pending', 'failed', 'cancelled'].includes(attempt.status)) {
      await platformQuery(db, `
        UPDATE platform_provider_events SET status = 'rejected', rejection_code = 'attempt_status_not_payable'
        WHERE id = $1::uuid
      `, [inserted[0].id]);
      await enqueuePlatformEvent(db, 'platform.payment.reconciliation_required', 'platform_order', order.id,
        `payment:${attempt.id}:${createHash('sha256').update(providerEventId).digest('hex')}:invalid-state`, {
          orderId: order.id, paymentAttemptId: attempt.id, reasonCode: 'attempt_status_not_payable',
        });
      return;
    }
    const reusedTransactions = await platformQuery<{ id: string }>(db, `
      SELECT id::text FROM platform_payment_attempts
      WHERE provider = $1 AND merchant_account = $2 AND provider_transaction_id = $3 AND id <> $4::uuid
      FOR UPDATE
    `, [provider, event.merchantId, event.providerTransactionId, attempt.id]);
    if (reusedTransactions[0]) {
      await platformQuery(db, `
        UPDATE platform_provider_events SET status = 'rejected', rejection_code = 'provider_transaction_reused'
        WHERE id = $1::uuid
      `, [inserted[0].id]);
      await enqueuePlatformEvent(db, 'platform.payment.reconciliation_required', 'platform_order', order.id,
        `payment:${attempt.id}:${createHash('sha256').update(providerEventId).digest('hex')}:transaction-reused`, {
          orderId: order.id, paymentAttemptId: attempt.id, reasonCode: 'provider_transaction_reused',
        });
      return;
    }
    await platformQuery(db, `
      UPDATE platform_payment_attempts
      SET status = 'succeeded', failure_code = NULL, provider_transaction_id = $2, succeeded_at = NOW()
      WHERE id = $1::uuid
    `, [attempt.id, event.providerTransactionId]);
    await platformQuery(db, `
      UPDATE platform_payment_attempts
      SET status = 'cancelled', failure_code = 'order_cancelled'
      WHERE order_id = $1::uuid AND id <> $2::uuid AND status IN ('initiated', 'pending')
    `, [order.id, attempt.id]);
    if (order.status !== 'pending_payment') {
      const reasonCode = ['paid', 'partially_fulfilled', 'fulfilled', 'partially_refunded', 'refunded', 'chargeback'].includes(order.status)
        ? 'duplicate_payment_requires_reconciliation'
        : 'late_payment_after_order_closed';
      await platformQuery(db, `
        UPDATE platform_provider_events SET status = 'rejected', rejection_code = $2
        WHERE id = $1::uuid
      `, [inserted[0].id, reasonCode]);
      await enqueuePlatformEvent(db, 'platform.payment.reconciliation_required', 'platform_order', order.id,
        `payment:${attempt.id}:${createHash('sha256').update(providerEventId).digest('hex')}:order-closed`, {
          orderId: order.id, paymentAttemptId: attempt.id, reasonCode,
        });
      return;
    }
    await platformQuery(db, `UPDATE platform_orders SET status = 'paid', paid_at = NOW() WHERE id = $1::uuid`, [order.id]);
    await settlePaidOrder(db, order);
    await platformQuery(db, `UPDATE platform_provider_events SET status = 'processed', processed_at = NOW() WHERE id = $1::uuid`, [inserted[0].id]);
  });
  return provider === 'alipay' ? c.text('success') : c.json({ code: 'SUCCESS', message: '成功' });
});

interface CouponDefinition {
  code: string;
  status: 'draft' | 'active' | 'paused' | 'expired' | 'archived';
  discountType: 'fixed' | 'percent';
  discountAmountMinor: number | null;
  discountBps: number | null;
  currency: string | null;
  minimumOrderAmountMinor: number;
  maxRedemptions: number | null;
  perUserLimit: number;
  startsAt: string | null;
  endsAt: string | null;
  eligibility: Record<string, unknown>;
}

const COUPON_ELIGIBILITY_LISTS = [
  'courseIds',
  'productIds',
  'productVariantIds',
  'eventIds',
  'eventTicketTypeIds',
  'membershipPlanIds',
] as const;

type CouponEligibilityList = typeof COUPON_ELIGIBILITY_LISTS[number];
type CouponEligibility = { memberOnly: boolean } & Record<CouponEligibilityList, string[]>;

function couponEligibility(raw: Record<string, unknown>): CouponEligibility {
  const allowed = new Set<string>(['memberOnly', ...COUPON_ELIGIBILITY_LISTS]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) badRequest(`eligibility.${key} is unsupported`);
  }
  if (raw.memberOnly != null && typeof raw.memberOnly !== 'boolean') {
    badRequest('eligibility.memberOnly must be a boolean');
  }
  const result = { memberOnly: raw.memberOnly === true } as CouponEligibility;
  for (const key of COUPON_ELIGIBILITY_LISTS) {
    const value = raw[key];
    if (value == null) {
      result[key] = [];
      continue;
    }
    if (!Array.isArray(value) || value.length === 0 || value.length > 500) {
      badRequest(`eligibility.${key} must be a non-empty array with at most 500 items`);
    }
    result[key] = [...new Set(value.map((entry, index) => {
      if (typeof entry !== 'string') badRequest(`eligibility.${key}[${index}] must be a string`);
      return resourceId(entry, `eligibility.${key}[${index}]`);
    }))];
  }
  return result;
}

function couponEligibleSubtotal(items: PricedItem[], eligibility: CouponEligibility, member: boolean): number {
  if (eligibility.memberOnly && !member) badRequest('Coupon is available to active members only');
  const hasResourceRules = COUPON_ELIGIBILITY_LISTS.some((key) => eligibility[key].length > 0);
  if (!hasResourceRules) return items.reduce((sum, item) => sum + item.amountMinor * item.quantity, 0);
  const eligible = items.reduce((sum, item) => {
    const snapshot = item.snapshot;
    const matches = (item.courseId != null && eligibility.courseIds.includes(item.courseId))
      || (item.productVariantId != null && eligibility.productVariantIds.includes(item.productVariantId))
      || (typeof snapshot.productId === 'string' && eligibility.productIds.includes(snapshot.productId))
      || (item.eventTicketTypeId != null && eligibility.eventTicketTypeIds.includes(item.eventTicketTypeId))
      || (typeof snapshot.eventId === 'string' && eligibility.eventIds.includes(snapshot.eventId))
      || (item.membershipPlanId != null && eligibility.membershipPlanIds.includes(item.membershipPlanId));
    return matches ? sum + item.amountMinor * item.quantity : sum;
  }, 0);
  if (eligible === 0) badRequest('Coupon does not apply to any order item');
  return eligible;
}

function couponDefinition(body: Record<string, unknown>, current?: CouponDefinition): CouponDefinition {
  const merged = { status: 'draft', ...(current ?? {}), ...body };
  const code = stringField(merged, 'code', { required: true, min: 3, max: 64, pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/ })!.toUpperCase();
  const status = enumField(merged, 'status', ['draft', 'active', 'paused', 'expired', 'archived'] as const, { required: true })!;
  const discountType = enumField(merged, 'discountType', ['fixed', 'percent'] as const, { required: true })!;
  const discountAmountMinor = discountType === 'fixed'
    ? integerField(merged, 'discountAmountMinor', { required: true, min: 1 })!
    : null;
  const discountBps = discountType === 'percent'
    ? integerField(merged, 'discountBps', { required: true, min: 1, max: 10_000 })!
    : null;
  const currency = discountType === 'fixed'
    ? stringField(merged, 'currency', { required: true, max: 3, pattern: /^[A-Za-z]{3}$/ })!.toUpperCase()
    : null;
  const minimumOrderAmountMinor = integerField(merged, 'minimumOrderAmountMinor', { min: 0 }) ?? 0;
  const maxRedemptions = integerField(merged, 'maxRedemptions', { min: 1, max: 1_000_000_000 }) ?? null;
  const perUserLimit = integerField(merged, 'perUserLimit', { min: 1, max: 1_000_000 }) ?? 1;
  const startsAt = isoTimestampField(merged, 'startsAt') ?? null;
  const endsAt = isoTimestampField(merged, 'endsAt') ?? null;
  if (startsAt && endsAt && endsAt <= startsAt) badRequest('endsAt must be after startsAt');
  const eligibility = couponEligibility(objectField(merged, 'eligibility') ?? {});
  return { code, status, discountType, discountAmountMinor, discountBps, currency, minimumOrderAmountMinor, maxRedemptions, perUserLimit, startsAt, endsAt, eligibility };
}

platformCommerceRoutes.get('/admin/coupons', async (c) => {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c);
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
    GROUP BY coupon.id ORDER BY coupon.created_at DESC, coupon.id DESC LIMIT $1 OFFSET $2
  `, [pageSize, offset]);
  privateNoStore(c);
  return c.json({ items: rows, page, pageSize });
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
      definition.perUserLimit, definition.startsAt, definition.endsAt, JSON.stringify(definition.eligibility), actor.userId]);
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
      definition.startsAt, definition.endsAt, JSON.stringify(definition.eligibility)]);
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

platformCommerceRoutes.get('/admin/orders', async (c) => {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c);
  const status = c.req.query('status');
  const rows = await platformQuery(platformDb(), `
    SELECT id::text, order_number AS "orderNumber", buyer_user_id AS "buyerUserId", status, currency,
           total_amount_minor AS "totalAmountMinor", paid_at AS "paidAt", created_at AS "createdAt"
    FROM platform_orders WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3
  `, [status || null, pageSize, offset]);
  privateNoStore(c);
  return c.json({ items: rows, page, pageSize });
});

platformCommerceRoutes.get('/admin/orders/:id', async (c) => {
  await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const row = await orderDetails(platformDb(), '(o.id = $1::uuid OR o.order_number = $1)', [id]);
  if (!row) notFound('Order');
  privateNoStore(c);
  return c.json(row);
});

type ShipmentEventType = 'ship' | 'deliver' | 'return';

async function recordShipmentEvent(c: Context, entryType: ShipmentEventType) {
  const actor = await requirePlatformAdmin(c);
  const orderId = resourceId(c.req.param('orderId')!, 'orderId');
  const itemId = resourceId(c.req.param('itemId')!, 'itemId');
  const body = await readJsonObject(c);
  const quantity = integerField(body, 'quantity', { required: true, min: 1, max: 1_000_000 })!;
  const externalReference = stringField(body, 'externalReference', { required: true, max: 240 })!;
  const carrier = stringField(body, 'carrier', { max: 120 }) ?? null;
  const trackingNumber = stringField(body, 'trackingNumber', { max: 200 }) ?? null;
  const note = stringField(body, 'note', { max: 1000 }) ?? null;
  const result = await withIdempotency(
    c,
    actor,
    `commerce.fulfillment.${entryType}:${orderId}:${itemId}`,
    body,
    async (db) => {
      const orders = await platformQuery<{ status: string }>(db, `
        SELECT status FROM platform_orders WHERE id = $1::uuid FOR UPDATE
      `, [orderId]);
      const order = orders[0];
      if (!order) notFound('Order');
      const allowedStatuses = entryType === 'return'
        ? ['partially_refunded', 'refunded']
        : ['paid', 'partially_fulfilled'];
      if (!allowedStatuses.includes(order.status)) {
        throw new PlatformApiError('INVALID_STATE', 409, entryType === 'return'
          ? 'Only refunded orders can receive returned inventory'
          : 'Only paid orders can be shipped or delivered');
      }
      const items = await platformQuery<{ quantity: number; fulfillment_type: FulfillmentType }>(db, `
        SELECT quantity, fulfillment_type
        FROM platform_order_items
        WHERE id = $1::uuid AND order_id = $2::uuid
        FOR UPDATE
      `, [itemId, orderId]);
      const item = items[0];
      if (!item) notFound('Order item');
      if (item.fulfillment_type !== 'shipment') conflict('Only shipment items support ship and deliver events');
      const duplicate = await platformQuery<{ exists: boolean }>(db, `
        SELECT EXISTS (
          SELECT 1 FROM platform_fulfillment_ledger source
          WHERE source.order_item_id = $1::uuid AND source.external_reference = $2
            AND source.entry_type IN ('ship', 'deliver', 'return')
            AND NOT EXISTS (
              SELECT 1 FROM platform_fulfillment_ledger reversal
              WHERE reversal.reversal_of_ledger_id = source.id
            )
        ) AS exists
      `, [itemId, externalReference]);
      if (duplicate[0]?.exists) conflict('externalReference was already recorded for this order item');
      const progress = await platformQuery<{
        shipped_quantity: number; delivered_quantity: number; returned_quantity: number;
      }>(db, `
        SELECT COALESCE(SUM(source.delta_quantity) FILTER (WHERE source.entry_type = 'ship'), 0)::integer AS shipped_quantity,
               COALESCE(SUM(source.delta_quantity) FILTER (WHERE source.entry_type = 'deliver'), 0)::integer AS delivered_quantity,
               COALESCE(SUM(source.delta_quantity) FILTER (WHERE source.entry_type = 'return'), 0)::integer AS returned_quantity
        FROM platform_fulfillment_ledger source
        WHERE source.order_item_id = $1::uuid AND source.entry_type IN ('ship', 'deliver', 'return')
          AND NOT EXISTS (
            SELECT 1 FROM platform_fulfillment_ledger reversal
            WHERE reversal.reversal_of_ledger_id = source.id
          )
      `, [itemId]);
      const shippedQuantity = progress[0]?.shipped_quantity ?? 0;
      const deliveredQuantity = progress[0]?.delivered_quantity ?? 0;
      const returnedQuantity = progress[0]?.returned_quantity ?? 0;
      const availableQuantity = entryType === 'ship'
        ? item.quantity - shippedQuantity
        : entryType === 'deliver'
          ? shippedQuantity - deliveredQuantity
          : shippedQuantity - returnedQuantity;
      if (quantity > availableQuantity) {
        const message = entryType === 'ship'
          ? 'Shipment quantity exceeds the unshipped quantity'
          : entryType === 'deliver'
            ? 'Delivery quantity exceeds the shipped and undelivered quantity'
            : 'Return quantity exceeds the shipped and unreturned quantity';
        conflict(message);
      }
      const referenceHash = hashReference(externalReference);
      let returnRefundId: string | null = null;
      if (entryType === 'return') {
        const refunds = await platformQuery<{ id: string }>(db, `
          SELECT id::text FROM platform_refunds
          WHERE order_id = $1::uuid AND status = 'succeeded'
          ORDER BY succeeded_at DESC, id DESC LIMIT 1 FOR SHARE
        `, [orderId]);
        returnRefundId = refunds[0]?.id ?? null;
        if (!returnRefundId) conflict('A succeeded refund is required before returned inventory can be received');
      }
      const encryptedMetadata = encryptPlatformPrivateData({ carrier, trackingNumber, note });
      const storedMetadata = {
        encryptedPayload: encryptedMetadata.payload.toString('base64'),
        keyVersion: encryptedMetadata.keyVersion,
      };
      const ledgerRows = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_fulfillment_ledger (
          order_id, order_item_id, entry_type, delta_quantity, external_reference, refund_id, metadata, actor_user_id
        ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7::jsonb, $8)
        RETURNING id::text
      `, [orderId, itemId, entryType, quantity, externalReference, returnRefundId,
        JSON.stringify(storedMetadata), actor.userId]);
      const ledgerId = ledgerRows[0].id;
      let orderStatus = order.status;
      if (entryType === 'return') {
        await platformQuery(db, `
          INSERT INTO platform_inventory_ledger (
            product_variant_id, entry_type, delta_on_hand, order_item_id, refund_id, reason,
            actor_user_id, actor_key
          ) SELECT product_variant_id, 'refund', $3, id, $4::uuid, $5, $6, $7
            FROM platform_order_items WHERE id = $1::uuid AND order_id = $2::uuid
        `, [itemId, orderId, quantity, returnRefundId,
          `return_reference_sha256:${referenceHash}`, actor.userId, actor.ownerKey]);
      } else {
        orderStatus = await refreshOrderFulfillmentStatus(db, orderId);
      }
      await platformQuery(db, `
        INSERT INTO platform_audit_events (
          actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
        ) VALUES ($1, $2, $3, 'platform_order_item', $4, 'allowed', $5::jsonb)
      `, [actor.userId, actor.ownerKey, `commerce.fulfillment.${entryType}`, itemId,
        JSON.stringify({ orderId, ledgerId, quantity, referenceHash })]);
      const eventPastTense = entryType === 'ship' ? 'shipped' : entryType === 'deliver' ? 'delivered' : 'returned';
      await enqueuePlatformEvent(db, `platform.order_item.${eventPastTense}`,
        'platform_order_item', itemId, `order-item:${itemId}:${entryType}:${ledgerId}`, {
          orderId, itemId, ledgerId, quantity, referenceHash, orderStatus,
        });
      return {
        status: 201,
        body: { id: ledgerId, orderId, itemId, type: entryType, quantity, externalReference, orderStatus },
        resourceType: 'platform_order_item',
        resourceId: itemId,
      };
    },
  );
  return sendMutation(c, result);
}

platformCommerceRoutes.post('/admin/orders/:orderId/items/:itemId/ship', (c) => recordShipmentEvent(c, 'ship'));

platformCommerceRoutes.post('/admin/orders/:orderId/items/:itemId/deliver', (c) => recordShipmentEvent(c, 'deliver'));

platformCommerceRoutes.post('/admin/orders/:orderId/items/:itemId/return', (c) => recordShipmentEvent(c, 'return'));

platformCommerceRoutes.post('/admin/orders/:id/refund', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const reasonCode = stringField(body, 'reasonCode', { required: true, max: 64 })!;
  const providerRefundId = stringField(body, 'providerRefundId', { required: true, max: 200 })!;
  const evidenceReference = stringField(body, 'evidenceReference', { required: true, max: 240 })!;
  const evidenceReferenceHash = hashReference(evidenceReference);
  const evidenceReason = `evidence_sha256:${evidenceReferenceHash}`;
  const result = await withIdempotency(c, actor, `commerce.refund.full:${id}`, body, async (db) => {
    const orders = await platformQuery<OrderRow>(db, `SELECT id::text, order_number, buyer_user_id, status, currency, total_amount_minor FROM platform_orders WHERE id = $1::uuid FOR UPDATE`, [id]);
    const order = orders[0];
    if (!order) notFound('Order');
    if (!['paid', 'partially_fulfilled', 'fulfilled'].includes(order.status)) throw new PlatformApiError('INVALID_STATE', 409, 'Only paid or fulfilled orders can be fully refunded');
    const attempts = await platformQuery<{ id: string; provider: string }>(db, `SELECT id::text, provider FROM platform_payment_attempts WHERE order_id = $1::uuid AND status = 'succeeded' ORDER BY succeeded_at DESC LIMIT 1 FOR UPDATE`, [id]);
    const attempt = attempts[0];
    if (!attempt) conflict('No succeeded payment attempt exists');
    const numberRows = await platformQuery<{ next: number }>(db, `SELECT COALESCE(MAX(refund_number),0)::integer + 1 AS next FROM platform_refunds WHERE order_id = $1::uuid`, [id]);
    const refunds = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_refunds (
        order_id, payment_attempt_id, refund_number, provider, provider_refund_id, status, reason_code,
        amount_minor, currency, requested_by_user_id, decided_by_user_id, decided_by_actor_key, succeeded_at
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'succeeded', $6, $7, $8, $9, $9, $10, NOW()) RETURNING id::text
    `, [id, attempt.id, numberRows[0].next, attempt.provider, providerRefundId, reasonCode,
      safeMoney(order.total_amount_minor), order.currency, actor.userId, actor.ownerKey]);
    const refundId = refunds[0].id;
    const productItems = await platformQuery<{
      id: string; product_variant_id: string; quantity: number; fulfillment_type: FulfillmentType; shipped_quantity: number;
    }>(db, `
      SELECT item.id::text, item.product_variant_id::text, item.quantity, item.fulfillment_type,
             COALESCE((
               SELECT SUM(source.delta_quantity)::integer
               FROM platform_fulfillment_ledger source
               WHERE source.order_item_id = item.id AND source.entry_type = 'ship'
                 AND NOT EXISTS (
                   SELECT 1 FROM platform_fulfillment_ledger reversal
                   WHERE reversal.reversal_of_ledger_id = source.id
                 )
             ), 0) AS shipped_quantity
      FROM platform_order_items item
      WHERE item.order_id = $1::uuid AND item.product_variant_id IS NOT NULL
      ORDER BY item.line_number FOR UPDATE OF item
    `, [id]);
    const shippedItems: Array<{ itemId: string; shippedQuantity: number }> = [];
    for (const item of productItems) {
      const shippedQuantity = Math.min(item.quantity, Math.max(0, item.shipped_quantity));
      if (item.fulfillment_type === 'shipment' && shippedQuantity > 0) {
        const unshippedQuantity = item.quantity - shippedQuantity;
        if (unshippedQuantity > 0) {
          await platformQuery(db, `
            INSERT INTO platform_inventory_ledger (
              product_variant_id, entry_type, delta_on_hand, order_item_id, refund_id, reason, actor_user_id
            ) VALUES ($1::uuid, 'refund', $2, $3::uuid, $4::uuid, $5, $6)
          `, [item.product_variant_id, unshippedQuantity, item.id, refundId, evidenceReason, actor.userId]);
        }
        shippedItems.push({ itemId: item.id, shippedQuantity });
        continue;
      }
      const inventory = await platformQuery<{
        id: string; delta_on_hand: number; delta_reserved: number;
      }>(db, `
        SELECT source.id::text, source.delta_on_hand, source.delta_reserved
        FROM platform_inventory_ledger source
        WHERE source.order_item_id = $1::uuid AND source.entry_type IN ('reserve', 'sell')
          AND NOT EXISTS (
            SELECT 1 FROM platform_inventory_ledger reversal
            WHERE reversal.reversal_of_ledger_id = source.id
          )
        ORDER BY source.created_at DESC, source.id DESC FOR UPDATE OF source
      `, [item.id]);
      for (const entry of inventory) {
        await platformQuery(db, `INSERT INTO platform_inventory_ledger (product_variant_id, entry_type, delta_on_hand, delta_reserved, refund_id, reversal_of_ledger_id, reason, actor_user_id) VALUES ($1::uuid, 'reversal', $2, $3, $4::uuid, $5::uuid, $6, $7)`, [item.product_variant_id, -entry.delta_on_hand, -entry.delta_reserved, refundId, entry.id, evidenceReason, actor.userId]);
      }
    }
    if (shippedItems.length > 0) {
      await platformQuery(db, `
        INSERT INTO platform_audit_events (
          actor_user_id, actor_key, action, resource_type, resource_id, outcome, reason_code, metadata
        ) VALUES ($1, $2, 'commerce.refund.physical_return_required', 'platform_order', $3, 'allowed',
          'shipped_inventory_not_restocked', $4::jsonb)
      `, [actor.userId, actor.ownerKey, id, JSON.stringify({ refundId, evidenceReferenceHash, items: shippedItems })]);
      await enqueuePlatformEvent(db, 'platform.order.physical_return_required', 'platform_order', id,
        `order:${id}:refund:${refundId}:physical-return`, { orderId: id, refundId, items: shippedItems });
    }
    const fulfillment = await platformQuery<{ id: string; order_item_id: string; delta_quantity: number }>(db, `
      SELECT source.id::text, source.order_item_id::text, source.delta_quantity
      FROM platform_fulfillment_ledger source
      WHERE source.order_id = $1::uuid AND source.entry_type = 'grant'
        AND NOT EXISTS (
          SELECT 1 FROM platform_fulfillment_ledger reversal
          WHERE reversal.reversal_of_ledger_id = source.id
        )
      ORDER BY source.created_at DESC, source.id DESC FOR UPDATE OF source
    `, [id]);
    for (const entry of fulfillment) {
      await platformQuery(db, `INSERT INTO platform_fulfillment_ledger (order_id, order_item_id, entry_type, delta_quantity, refund_id, reversal_of_ledger_id, metadata, actor_user_id) VALUES ($1::uuid, $2::uuid, 'reversal', $3, $4::uuid, $5::uuid, $6::jsonb, $7)`, [id, entry.order_item_id, -entry.delta_quantity, refundId, entry.id, JSON.stringify({ evidenceReferenceHash }), actor.userId]);
    }
    const entitlements = await platformQuery<{ id: string; entitlement_id: string; valid_from: string; valid_until: string | null }>(db, `SELECT l.id::text, l.entitlement_id::text, l.valid_from, l.valid_until FROM platform_entitlement_ledger l JOIN platform_order_items i ON i.id = l.order_item_id WHERE i.order_id = $1::uuid AND l.entry_type = 'purchase' FOR UPDATE OF l`, [id]);
    for (const entry of entitlements) {
      await platformQuery(db, `INSERT INTO platform_entitlement_ledger (entitlement_id, entry_type, delta_access, valid_from, valid_until, refund_id, reversal_of_ledger_id, reason, actor_user_id) VALUES ($1::uuid, 'reversal', -1, $2, $3, $4::uuid, $5::uuid, $6, $7)`, [entry.entitlement_id, entry.valid_from, entry.valid_until, refundId, entry.id, evidenceReason, actor.userId]);
      await platformQuery(db, `
        WITH remaining AS (
          SELECT MIN(grant_entry.valid_from) AS valid_from,
                 CASE WHEN BOOL_OR(grant_entry.valid_until IS NULL) THEN NULL
                      ELSE MAX(grant_entry.valid_until) END AS valid_until,
                 COUNT(*) > 0 AS active
          FROM platform_entitlement_ledger grant_entry
          WHERE grant_entry.entitlement_id = $1::uuid AND grant_entry.delta_access = 1
            AND NOT EXISTS (
              SELECT 1 FROM platform_entitlement_ledger reversal
              WHERE reversal.reversal_of_ledger_id = grant_entry.id
            )
        )
        UPDATE platform_course_entitlements entitlement
        SET status = CASE WHEN remaining.active THEN 'active' ELSE 'revoked' END,
            valid_from = COALESCE(remaining.valid_from, entitlement.valid_from),
            valid_until = CASE WHEN remaining.active THEN remaining.valid_until ELSE entitlement.valid_until END
        FROM remaining WHERE entitlement.id = $1::uuid
      `, [entry.entitlement_id]);
    }
    const memberships = await platformQuery<{ id: string; membership_id: string; valid_from: string; valid_until: string | null }>(db, `SELECT l.id::text, l.membership_id::text, l.valid_from, l.valid_until FROM platform_membership_ledger l JOIN platform_order_items i ON i.id = l.order_item_id WHERE i.order_id = $1::uuid AND l.entry_type IN ('purchase','renewal') ORDER BY l.created_at DESC, l.id DESC FOR UPDATE OF l`, [id]);
    for (const membershipId of new Set(memberships.map((entry) => entry.membership_id))) {
      const newer = await platformQuery<{ exists: boolean }>(db, `
        SELECT EXISTS (
          SELECT 1
          FROM platform_membership_ledger later
          JOIN platform_order_items later_item ON later_item.id = later.order_item_id
          WHERE later.membership_id = $1::uuid
            AND later.entry_type IN ('purchase', 'renewal')
            AND later_item.order_id <> $2::uuid
            AND NOT EXISTS (
              SELECT 1 FROM platform_membership_ledger reversal
              WHERE reversal.reversal_of_ledger_id = later.id
            )
            AND EXISTS (
              SELECT 1
              FROM platform_membership_ledger target
              JOIN platform_order_items target_item ON target_item.id = target.order_item_id
              WHERE target.membership_id = $1::uuid AND target_item.order_id = $2::uuid
                AND (later.created_at, later.id) > (target.created_at, target.id)
            )
        ) AS exists
      `, [membershipId, id]);
      if (newer[0]?.exists) {
        conflict('Membership renewals must be refunded newest first');
      }
    }
    for (const entry of memberships) {
      await platformQuery(db, `INSERT INTO platform_membership_ledger (membership_id, entry_type, delta_access, valid_from, valid_until, refund_id, reversal_of_ledger_id, reason, actor_user_id) VALUES ($1::uuid, 'reversal', -1, $2, $3, $4::uuid, $5::uuid, $6, $7)`, [entry.membership_id, entry.valid_from, entry.valid_until, refundId, entry.id, evidenceReason, actor.userId]);
      await platformQuery(db, `
        WITH remaining AS (
          SELECT MIN(grant_entry.valid_from) AS valid_from,
                 CASE WHEN BOOL_OR(grant_entry.valid_until IS NULL) THEN NULL
                      ELSE MAX(grant_entry.valid_until) END AS valid_until,
                 COUNT(*) > 0 AS active
          FROM platform_membership_ledger grant_entry
          WHERE grant_entry.membership_id = $1::uuid AND grant_entry.delta_access = 1
            AND NOT EXISTS (
              SELECT 1 FROM platform_membership_ledger reversal
              WHERE reversal.reversal_of_ledger_id = grant_entry.id
            )
        )
        UPDATE platform_memberships membership
        SET status = CASE
              WHEN NOT remaining.active THEN 'revoked'
              WHEN remaining.valid_from <= NOW() AND (remaining.valid_until IS NULL OR remaining.valid_until > NOW()) THEN 'active'
              ELSE 'expired'
            END,
            valid_from = COALESCE(remaining.valid_from, membership.valid_from),
            valid_until = CASE WHEN remaining.active THEN remaining.valid_until ELSE membership.valid_until END
        FROM remaining WHERE membership.id = $1::uuid
      `, [entry.membership_id]);
    }
    const revenue = await platformQuery<{ id: string; instructor_id: string; delta_amount_minor: number | string; currency: string }>(db, `SELECT id::text, instructor_id::text, delta_amount_minor, currency FROM platform_instructor_revenue_ledger WHERE order_id = $1::uuid AND entry_type = 'sale' FOR UPDATE`, [id]);
    for (const entry of revenue) {
      const allocated = await platformQuery<{ id: string; status: string }>(db, `
        SELECT payout.id::text, payout.status FROM platform_instructor_payout_items item
        JOIN platform_instructor_payouts payout ON payout.id = item.payout_id
        WHERE item.revenue_ledger_id = $1::uuid AND item.released_at IS NULL
        FOR UPDATE OF payout
      `, [entry.id]);
      const payout = allocated[0];
      if (payout && ['draft', 'approved'].includes(payout.status)) {
        await platformQuery(db, `
          UPDATE platform_instructor_payouts SET status = 'cancelled'
          WHERE id = $1::uuid
        `, [payout.id]);
        await platformQuery(db, `
          UPDATE platform_instructor_payout_items SET released_at = NOW()
          WHERE payout_id = $1::uuid AND released_at IS NULL
        `, [payout.id]);
        await platformQuery(db, `
          INSERT INTO platform_audit_events (
            actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
          ) VALUES ($1, $2, 'commerce.payout.cancel_for_refund', 'platform_instructor_payout', $3, 'allowed', $4::jsonb)
        `, [actor.userId, actor.ownerKey, payout.id, JSON.stringify({ refundId, orderId: id })]);
      } else if (payout?.status === 'processing') {
        await platformQuery(db, `
          UPDATE platform_instructor_payouts
          SET status = 'failed', failure_code = 'refund_after_processing'
          WHERE id = $1::uuid
        `, [payout.id]);
        await platformQuery(db, `
          INSERT INTO platform_audit_events (
            actor_user_id, actor_key, action, resource_type, resource_id, outcome, reason_code, metadata
          ) VALUES ($1, $2, 'commerce.payout.refund_requires_reconciliation',
            'platform_instructor_payout', $3, 'failed', 'refund_after_processing', $4::jsonb)
        `, [actor.userId, actor.ownerKey, payout.id, JSON.stringify({ refundId, orderId: id })]);
        await enqueuePlatformEvent(db, 'platform.instructor_payout.reconciliation_required',
          'platform_instructor_payout', payout.id, `payout:${payout.id}:refund:${refundId}`, {
            payoutId: payout.id, refundId, orderId: id,
          });
      }
      await platformQuery(db, `INSERT INTO platform_instructor_revenue_ledger (instructor_id, order_id, refund_id, entry_type, delta_amount_minor, currency, reversal_of_ledger_id, reason, actor_user_id) VALUES ($1::uuid, $2::uuid, $3::uuid, 'reversal', $4, $5, $6::uuid, $7, $8)`, [entry.instructor_id, id, refundId, -safeMoney(entry.delta_amount_minor), entry.currency, entry.id, evidenceReason, actor.userId]);
    }
    await platformQuery(db, `WITH changed AS (
      UPDATE platform_event_registrations registration SET status = 'refunded', cancelled_at = NOW()
      WHERE registration.order_item_id IN (SELECT item.id FROM platform_order_items item WHERE item.order_id = $1::uuid)
        AND registration.status IN ('confirmed','attended')
      RETURNING registration.ticket_type_id, registration.quantity
    ), totals AS (
      SELECT ticket_type_id, SUM(quantity)::integer AS quantity FROM changed GROUP BY ticket_type_id
    ) UPDATE platform_event_ticket_types ticket SET sold_quantity = ticket.sold_quantity - totals.quantity,
      capacity_revision = ticket.capacity_revision + 1 FROM totals WHERE ticket.id = totals.ticket_type_id`, [id]);
    await platformQuery(db, `UPDATE platform_payment_attempts SET status = 'refunded' WHERE id = $1::uuid`, [attempt.id]);
    await platformQuery(db, `UPDATE platform_orders SET status = 'refunded' WHERE id = $1::uuid`, [id]);
    await platformQuery(db, `INSERT INTO platform_audit_events (actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata) VALUES ($1, $2, 'commerce.refund.manual_settlement', 'platform_refund', $3, 'allowed', $4::jsonb)`, [actor.userId, actor.ownerKey, refundId, JSON.stringify({ evidenceReferenceHash })]);
    await enqueuePlatformEvent(db, 'platform.order.refunded', 'platform_order', id, `order:${id}:refund:${refundId}`, { orderId: id, refundId });
    return { status: 201, body: { id: refundId, orderId: id, status: 'succeeded' }, resourceType: 'platform_refund', resourceId: refundId };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.get('/instructor/payout-profile', async (c) => {
  const actor = await requirePlatformActor(c);
  const instructorId = await requireInstructor(platformDb(), actor);
  const rows = await platformQuery<{
    configured: boolean; payout_key_version: number | null; updated_at: string;
  }>(platformDb(), `
    SELECT payout_profile_encrypted IS NOT NULL AS configured,
           payout_key_version, updated_at
    FROM platform_instructors WHERE id = $1::uuid
  `, [instructorId]);
  privateNoStore(c);
  return c.json({
    instructorId,
    configured: rows[0]?.configured ?? false,
    keyVersion: rows[0]?.payout_key_version ?? null,
    updatedAt: rows[0]?.updated_at ?? null,
  });
});

platformCommerceRoutes.put('/instructor/payout-profile', async (c) => {
  const actor = await requirePlatformActor(c);
  const body = await readJsonObject(c);
  const method = enumField(body, 'method', ['bank_transfer', 'paypal', 'other'] as const, { required: true })!;
  const accountName = stringField(body, 'accountName', { required: true, max: 200 })!;
  const accountIdentifier = stringField(body, 'accountIdentifier', { required: true, max: 320 })!;
  const routingCode = stringField(body, 'routingCode', { max: 120 }) ?? null;
  const countryCode = stringField(body, 'countryCode', { max: 2, pattern: /^[A-Za-z]{2}$/ })?.toUpperCase() ?? null;
  const profile = { method, accountName, accountIdentifier, routingCode, countryCode };
  const result = await withIdempotency(c, actor, 'commerce.instructor.payout-profile', profile, async (db) => {
    const instructorId = await requireInstructor(db, actor);
    const encrypted = encryptPlatformPrivateData(profile);
    const rows = await platformQuery(db, `
      UPDATE platform_instructors
      SET payout_profile_encrypted = $2, payout_key_version = $3
      WHERE id = $1::uuid AND status = 'active'
      RETURNING id::text, updated_at AS "updatedAt"
    `, [instructorId, encrypted.payload, encrypted.keyVersion]);
    if (!rows[0]) notFound('Instructor');
    await platformQuery(db, `
      INSERT INTO platform_audit_events (
        actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
      ) VALUES ($1, $2, 'commerce.payout_profile.update', 'platform_instructor', $3, 'allowed', $4::jsonb)
    `, [actor.userId, actor.ownerKey, instructorId, JSON.stringify({ method, countryCode })]);
    return {
      status: 200,
      body: { instructorId, configured: true, keyVersion: encrypted.keyVersion, updatedAt: rows[0]!.updatedAt },
      resourceType: 'platform_instructor',
      resourceId: instructorId,
    };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.post('/admin/instructor-payouts/generate', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const body = await readJsonObject(c);
  const instructorId = resourceId(stringField(body, 'instructorId', { required: true, max: 128 })!, 'instructorId');
  const currency = stringField(body, 'currency', { required: true, max: 3, pattern: /^[A-Za-z]{3}$/ })!.toUpperCase();
  const result = await withIdempotency(c, actor, `commerce.payout.generate:${instructorId}:${currency}`, body, async (db) => {
    const instructors = await platformQuery<{
      id: string; payout_profile_encrypted: Buffer | null; payout_key_version: number | null;
    }>(db, `
      SELECT id::text, payout_profile_encrypted, payout_key_version
      FROM platform_instructors WHERE id = $1::uuid AND status = 'active' FOR UPDATE
    `, [instructorId]);
    const instructor = instructors[0];
    if (!instructor) notFound('Instructor');
    if (!instructor.payout_profile_encrypted || instructor.payout_key_version == null) {
      conflict('Instructor payout profile is not configured');
    }
    const ledger = await platformQuery<{ id: string; delta_amount_minor: number | string }>(db, `
      SELECT revenue.id::text, revenue.delta_amount_minor
      FROM platform_instructor_revenue_ledger revenue
      WHERE revenue.instructor_id = $1::uuid AND revenue.currency = $2
        AND NOT EXISTS (
          SELECT 1 FROM platform_instructor_payout_items item
          WHERE item.revenue_ledger_id = revenue.id AND item.released_at IS NULL
        )
      ORDER BY revenue.created_at, revenue.id
      FOR UPDATE OF revenue SKIP LOCKED
    `, [instructorId, currency]);
    if (!ledger.length) conflict('No unsettled instructor revenue is available');
    const amountMinor = ledger.reduce((sum, entry) => sum + safeSignedMoney(entry.delta_amount_minor, 'revenue amount'), 0);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) conflict('No positive payout balance is available');
    const payouts = await platformQuery<{ id: string; payout_number: string }>(db, `
      INSERT INTO platform_instructor_payouts (
        instructor_id, payout_number, status, amount_minor, currency,
        payout_profile_snapshot_encrypted, payout_key_version
      ) VALUES ($1::uuid, $2, 'draft', $3, $4, $5, $6)
      RETURNING id::text, payout_number
    `, [instructorId, payoutNumber(), amountMinor, currency,
      Buffer.from(instructor.payout_profile_encrypted), instructor.payout_key_version]);
    const payout = payouts[0]!;
    for (const entry of ledger) {
      await platformQuery(db, `
        INSERT INTO platform_instructor_payout_items (payout_id, revenue_ledger_id, amount_minor, currency)
        VALUES ($1::uuid, $2::uuid, $3, $4)
      `, [payout.id, entry.id, safeSignedMoney(entry.delta_amount_minor, 'revenue amount'), currency]);
    }
    await platformQuery(db, `
      INSERT INTO platform_audit_events (
        actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
      ) VALUES ($1, $2, 'commerce.payout.generate', 'platform_instructor_payout', $3, 'allowed', $4::jsonb)
    `, [actor.userId, actor.ownerKey, payout.id, JSON.stringify({ instructorId, currency, ledgerEntries: ledger.length })]);
    await enqueuePlatformEvent(db, 'platform.instructor_payout.generated', 'platform_instructor_payout', payout.id,
      `payout:${payout.id}:generated`, { payoutId: payout.id, instructorId, amountMinor, currency });
    return {
      status: 201,
      body: { id: payout.id, payoutNumber: payout.payout_number, instructorId, status: 'draft', amountMinor, currency, itemCount: ledger.length },
      resourceType: 'platform_instructor_payout',
      resourceId: payout.id,
    };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.get('/admin/instructor-payouts', async (c) => {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c);
  const rows = await platformQuery(platformDb(), `SELECT p.id::text, p.payout_number AS "payoutNumber", p.instructor_id::text AS "instructorId", p.status, p.amount_minor AS "amountMinor", p.currency, p.provider_reference AS "providerReference", p.failure_code AS "failureCode", p.created_at AS "createdAt" FROM platform_instructor_payouts p ORDER BY p.created_at DESC, p.id DESC LIMIT $1 OFFSET $2`, [pageSize, offset]);
  privateNoStore(c);
  return c.json({ items: rows, page, pageSize });
});

platformCommerceRoutes.post('/admin/instructor-payouts/:id/approve', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const result = await withIdempotency(c, actor, `commerce.payout.approve:${id}`, body, async (db) => {
    const rows = await platformQuery<{ id: string; status: string; currency: string }>(db, `
      SELECT id::text, status, currency FROM platform_instructor_payouts WHERE id = $1::uuid FOR UPDATE
    `, [id]);
    if (!rows[0]) notFound('Payout');
    if (rows[0].status !== 'draft') throw new PlatformApiError('INVALID_STATE', 409, 'Only draft payouts can be approved');
    await platformQuery(db, `
      SELECT revenue.id FROM platform_instructor_payout_items item
      JOIN platform_instructor_revenue_ledger revenue ON revenue.id = item.revenue_ledger_id
      WHERE item.payout_id = $1::uuid AND item.released_at IS NULL FOR UPDATE OF revenue
    `, [id]);
    const lateReversals = await platformQuery<{ id: string; delta_amount_minor: number | string }>(db, `
      SELECT reversal.id::text, reversal.delta_amount_minor
      FROM platform_instructor_payout_items source_item
      JOIN platform_instructor_revenue_ledger reversal
        ON reversal.reversal_of_ledger_id = source_item.revenue_ledger_id
      WHERE source_item.payout_id = $1::uuid AND source_item.released_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM platform_instructor_payout_items existing
          WHERE existing.revenue_ledger_id = reversal.id AND existing.released_at IS NULL
        )
      FOR UPDATE OF reversal
    `, [id]);
    for (const reversal of lateReversals) {
      await platformQuery(db, `
        INSERT INTO platform_instructor_payout_items (payout_id, revenue_ledger_id, amount_minor, currency)
        VALUES ($1::uuid, $2::uuid, $3, $4)
      `, [id, reversal.id, safeSignedMoney(reversal.delta_amount_minor, 'reversal amount'), rows[0].currency]);
    }
    const totals = await platformQuery<{ amount_minor: number | string }>(db, `
      SELECT COALESCE(SUM(item.amount_minor), 0) AS amount_minor
      FROM platform_instructor_payout_items item
      WHERE item.payout_id = $1::uuid AND item.released_at IS NULL
    `, [id]);
    const amountMinor = safeSignedMoney(totals[0]?.amount_minor ?? 0, 'payout amount');
    if (amountMinor <= 0) conflict('Payout balance is no longer positive after refunds');
    await platformQuery(db, `
      UPDATE platform_instructor_payouts
      SET status = 'approved', amount_minor = $2, approved_by_user_id = $3, approved_by_actor_key = $4, approved_at = NOW()
      WHERE id = $1::uuid
    `, [id, amountMinor, actor.userId, actor.ownerKey]);
    await platformQuery(db, `
      INSERT INTO platform_audit_events (
        actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
      ) VALUES ($1, $2, 'commerce.payout.approve', 'platform_instructor_payout', $3, 'allowed', '{}'::jsonb)
    `, [actor.userId, actor.ownerKey, id]);
    await enqueuePlatformEvent(db, 'platform.instructor_payout.approved', 'platform_instructor_payout', id,
      `payout:${id}:approved`, { payoutId: id });
    return { status: 200, body: { id, status: 'approved' }, resourceType: 'platform_instructor_payout', resourceId: id };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.post('/admin/instructor-payouts/:id/paid', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const providerReference = stringField(body, 'providerReference', { required: true, max: 240 })!;
  const result = await withIdempotency(c, actor, `commerce.payout.paid:${id}`, body, async (db) => {
    const rows = await platformQuery<{ id: string; status: string }>(db, `SELECT id::text, status FROM platform_instructor_payouts WHERE id = $1::uuid FOR UPDATE`, [id]);
    if (!rows[0]) notFound('Payout');
    if (!['approved', 'processing'].includes(rows[0].status)) throw new PlatformApiError('INVALID_STATE', 409, 'Payout must be approved or processing');
    await platformQuery(db, `UPDATE platform_instructor_payouts SET status = 'paid', provider_reference = $2, paid_by_user_id = $3, paid_by_actor_key = $4, paid_at = NOW() WHERE id = $1::uuid`, [id, providerReference, actor.userId, actor.ownerKey]);
    const providerReferenceHash = hashReference(providerReference);
    await platformQuery(db, `INSERT INTO platform_audit_events (actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata) VALUES ($1, $2, 'commerce.payout.mark_paid', 'platform_instructor_payout', $3, 'allowed', $4::jsonb)`, [actor.userId, actor.ownerKey, id, JSON.stringify({ providerReferenceHash })]);
    return { status: 200, body: { id, status: 'paid' }, resourceType: 'platform_instructor_payout', resourceId: id };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.post('/admin/instructor-payouts/:id/reconcile-processing-refund', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const outcome = enumField(body, 'outcome', ['sent', 'not_sent'] as const, { required: true })!;
  const evidenceReference = stringField(body, 'evidenceReference', { required: true, max: 1000 })!;
  const providerReference = stringField(body, 'providerReference', { max: 240 });
  if (outcome === 'sent' && !providerReference) badRequest('providerReference is required when the payout was sent');
  const evidenceReferenceHash = hashReference(evidenceReference);
  const providerReferenceHash = providerReference ? hashReference(providerReference) : null;
  const result = await withIdempotency(c, actor, `commerce.payout.reconcile-processing-refund:${id}`, body, async (db) => {
    const rows = await platformQuery<{ id: string; status: string; failure_code: string | null }>(db, `
      SELECT id::text, status, failure_code
      FROM platform_instructor_payouts WHERE id = $1::uuid FOR UPDATE
    `, [id]);
    if (!rows[0]) notFound('Payout');
    if (rows[0].status !== 'failed' || rows[0].failure_code !== 'refund_after_processing') {
      throw new PlatformApiError('INVALID_STATE', 409, 'Only an unresolved processing-refund payout can be reconciled');
    }
    if (outcome === 'not_sent') {
      await platformQuery(db, `
        UPDATE platform_instructor_payout_items SET released_at = NOW()
        WHERE payout_id = $1::uuid AND released_at IS NULL
      `, [id]);
    }
    const failureCode = outcome === 'sent' ? null : 'refund_after_processing_not_sent';
    if (outcome === 'sent') {
      await platformQuery(db, `
        UPDATE platform_instructor_payouts
        SET status = 'paid', failure_code = NULL, provider_reference = $2,
            paid_by_user_id = $3, paid_by_actor_key = $4, paid_at = NOW()
        WHERE id = $1::uuid
      `, [id, providerReference, actor.userId, actor.ownerKey]);
    } else {
      await platformQuery(db, `
        UPDATE platform_instructor_payouts SET failure_code = $2
        WHERE id = $1::uuid
      `, [id, failureCode]);
    }
    await platformQuery(db, `
      INSERT INTO platform_audit_events (
        actor_user_id, actor_key, action, resource_type, resource_id, outcome, reason_code, metadata
      ) VALUES ($1, $2, 'commerce.payout.reconcile_processing_refund',
        'platform_instructor_payout', $3, 'allowed', $4, $5::jsonb)
    `, [actor.userId, actor.ownerKey, id, `refund_after_processing_${outcome}`,
      JSON.stringify({ outcome, evidenceReferenceHash, providerReferenceHash })]);
    await enqueuePlatformEvent(db, 'platform.instructor_payout.processing_refund_reconciled',
      'platform_instructor_payout', id, `payout:${id}:processing-refund:${outcome}`, {
        payoutId: id, outcome,
      });
    return {
      status: 200,
      body: { id, status: outcome === 'sent' ? 'paid' : 'failed', reconciliationOutcome: outcome,
        itemsReleased: outcome === 'not_sent' },
      resourceType: 'platform_instructor_payout',
      resourceId: id,
    };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.post('/admin/reconciliation/runs', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const body = await readJsonObject(c);
  const provider = enumField(body, 'provider', PLATFORM_PAYMENT_PROVIDERS, { required: true })!;
  const suppliedMerchantAccount = stringField(body, 'merchantAccount', { required: true, max: 120 })!;
  if (suppliedMerchantAccount !== merchantAccount(provider)) badRequest('merchantAccount does not match the configured provider account');
  const statementDate = stringField(body, 'statementDate', { required: true, max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ })!;
  const parsedDate = new Date(`${statementDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== statementDate) {
    badRequest('statementDate must be a valid calendar date');
  }
  const records = arrayField(body, 'records', { required: true, maxItems: 500 })!;
  if (!records.length) badRequest('records must contain at least one statement record');
  const normalized = records.map((raw, index) => {
    if (!isObject(raw)) badRequest(`records[${index}] must be an object`);
    const providerTransactionId = stringField(raw, 'providerTransactionId', { required: true, max: 200 })!;
    const amountMinor = integerField(raw, 'amountMinor', { required: true })!;
    const currency = stringField(raw, 'currency', { required: true, max: 3, pattern: /^[A-Za-z]{3}$/ })!.toUpperCase();
    return { providerTransactionId, amountMinor, currency };
  });
  if (new Set(normalized.map((record) => record.providerTransactionId)).size !== normalized.length) {
    badRequest('records contains duplicate providerTransactionId values');
  }
  const result = await withIdempotency(c, actor, `commerce.reconciliation.run:${provider}:${statementDate}`, body, async (db) => {
    const items: Array<Record<string, unknown>> = [];
    const counts = { matched: 0, missing_local: 0, amount_mismatch: 0, currency_mismatch: 0 };
    for (const record of normalized) {
      let paymentAttemptId: string | null = null;
      let refundId: string | null = null;
      let expectedAmountMinor: number | null = null;
      let expectedCurrency: string | null = null;
      if (record.amountMinor >= 0) {
        const matches = await platformQuery<{
          id: string; amount_minor: number | string; currency: string;
        }>(db, `
          SELECT id::text, amount_minor, currency FROM platform_payment_attempts
          WHERE provider = $1 AND merchant_account = $2 AND provider_transaction_id = $3
        `, [provider, suppliedMerchantAccount, record.providerTransactionId]);
        if (matches[0]) {
          paymentAttemptId = matches[0].id;
          expectedAmountMinor = safeMoney(matches[0].amount_minor, 'payment amount');
          expectedCurrency = matches[0].currency;
        }
      } else {
        const matches = await platformQuery<{
          id: string; amount_minor: number | string; currency: string;
        }>(db, `
          SELECT refund.id::text, refund.amount_minor, refund.currency
          FROM platform_refunds refund
          JOIN platform_payment_attempts attempt ON attempt.id = refund.payment_attempt_id
          WHERE refund.provider = $1 AND attempt.merchant_account = $2 AND refund.provider_refund_id = $3
        `, [provider, suppliedMerchantAccount, record.providerTransactionId]);
        if (matches[0]) {
          refundId = matches[0].id;
          expectedAmountMinor = -safeMoney(matches[0].amount_minor, 'refund amount');
          expectedCurrency = matches[0].currency;
        }
      }
      const status = expectedAmountMinor == null
        ? 'missing_local'
        : expectedCurrency !== record.currency
          ? 'currency_mismatch'
          : expectedAmountMinor !== record.amountMinor
            ? 'amount_mismatch'
            : 'matched';
      counts[status] += 1;
      const evidenceHash = createHash('sha256').update(JSON.stringify({
        provider,
        merchantAccount: suppliedMerchantAccount,
        statementDate,
        providerTransactionId: record.providerTransactionId,
        amountMinor: record.amountMinor,
        currency: record.currency,
      }), 'utf8').digest('hex');
      const inserted = await platformQuery<{ id: string; status: string }>(db, `
        INSERT INTO platform_reconciliation_records (
          provider, merchant_account, statement_date, provider_transaction_id,
          payment_attempt_id, refund_id, amount_minor, currency, status, evidence_hash
        ) VALUES ($1, $2, $3::date, $4, $5::uuid, $6::uuid, $7, $8, $9, decode($10, 'hex'))
        ON CONFLICT (provider, merchant_account, statement_date, provider_transaction_id) DO NOTHING
        RETURNING id::text, status
      `, [provider, suppliedMerchantAccount, statementDate, record.providerTransactionId,
        paymentAttemptId, refundId, record.amountMinor, record.currency, status, evidenceHash]);
      let row = inserted[0];
      if (!row) {
        const existing = await platformQuery<{ id: string; status: string; evidence_hash: string }>(db, `
          SELECT id::text, status, encode(evidence_hash, 'hex') AS evidence_hash
          FROM platform_reconciliation_records
          WHERE provider = $1 AND merchant_account = $2 AND statement_date = $3::date AND provider_transaction_id = $4
        `, [provider, suppliedMerchantAccount, statementDate, record.providerTransactionId]);
        if (!existing[0] || existing[0].evidence_hash !== evidenceHash) {
          conflict('A statement record was already imported with different evidence');
        }
        row = existing[0];
      }
      items.push({ id: row.id, providerTransactionId: record.providerTransactionId, amountMinor: record.amountMinor,
        currency: record.currency, status: row.status, paymentAttemptId, refundId });
    }
    const batchId = createHash('sha256').update(`${provider}:${suppliedMerchantAccount}:${statementDate}`, 'utf8').digest('hex');
    await platformQuery(db, `
      INSERT INTO platform_audit_events (
        actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
      ) VALUES ($1, $2, 'commerce.reconciliation.import', 'platform_reconciliation_batch', $3, 'allowed', $4::jsonb)
    `, [actor.userId, actor.ownerKey, batchId, JSON.stringify({ provider, statementDate, recordCount: normalized.length, counts })]);
    await enqueuePlatformEvent(db, 'platform.reconciliation.imported', 'platform_reconciliation_batch', batchId,
      `reconciliation:${batchId}`, { provider, statementDate, recordCount: normalized.length, counts });
    return { status: 201, body: { provider, merchantAccount: suppliedMerchantAccount, statementDate, counts, items },
      resourceType: 'platform_reconciliation_batch', resourceId: batchId };
  });
  return sendMutation(c, result);
});

platformCommerceRoutes.get('/admin/reconciliation', async (c) => {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c);
  const rows = await platformQuery(platformDb(), `SELECT id::text, provider, merchant_account AS "merchantAccount", statement_date AS "statementDate", provider_transaction_id AS "providerTransactionId", payment_attempt_id::text AS "paymentAttemptId", refund_id::text AS "refundId", amount_minor AS "amountMinor", currency, status, resolution_note AS "resolutionNote", resolved_at AS "resolvedAt", created_at AS "createdAt" FROM platform_reconciliation_records ORDER BY statement_date DESC, id DESC LIMIT $1 OFFSET $2`, [pageSize, offset]);
  privateNoStore(c);
  return c.json({ items: rows, page, pageSize });
});

platformCommerceRoutes.post('/admin/reconciliation/:id/resolve', async (c) => {
  const actor = await requirePlatformAdmin(c);
  const id = resourceId(c.req.param('id'));
  const body = await readJsonObject(c);
  const note = stringField(body, 'resolutionNote', { required: true, max: 4000 })!;
  const result = await withIdempotency(c, actor, `commerce.reconciliation.resolve:${id}`, body, async (db) => {
    const rows = await platformQuery<{ id: string; resolved_at: string | null }>(db, `SELECT id::text, resolved_at FROM platform_reconciliation_records WHERE id = $1::uuid FOR UPDATE`, [id]);
    if (!rows[0]) notFound('Reconciliation record');
    if (rows[0].resolved_at) conflict('Reconciliation record is already resolved');
    await platformQuery(db, `UPDATE platform_reconciliation_records SET resolved_by_user_id = $2, resolved_by_actor_key = $3, resolution_note = $4, resolved_at = NOW() WHERE id = $1::uuid`, [id, actor.userId, actor.ownerKey, note]);
    return { status: 200, body: { id, resolved: true }, resourceType: 'platform_reconciliation_record', resourceId: id };
  });
  return sendMutation(c, result);
});
