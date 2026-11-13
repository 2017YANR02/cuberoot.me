import { type PlatformDb, platformQuery, enqueuePlatformEvent, lockUserMemberships } from '../db.js';
import { safeMoney } from './amounts.js';
import { refreshOrderFulfillmentStatus } from './fulfillment-service.js';
import { addMembershipPeriod, membershipPeriodBase } from '../membership-period.js';
import { type OrderRow, type SellableType, type FulfillmentType } from './types.js';

export async function settlePaidOrder(db: PlatformDb, order: OrderRow): Promise<void> {
  // Mixed carts must take the user lock before any inventory-ledger row locks.
  if (order.buyer_user_id != null) await lockUserMemberships(db, order.buyer_user_id);
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
        VALUES ($1::uuid, 'sell', -$2::integer, -$2::integer, $3::uuid)
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
      const existingMembership = await platformQuery<{ id: string; status: string; valid_until: string | null }>(db, `
        SELECT id::text, status, valid_until FROM platform_memberships
        WHERE user_id = $1 AND plan_id = $2::uuid FOR UPDATE
      `, [order.buyer_user_id, item.membership_plan_id]);
      const base = membershipPeriodBase(existingMembership[0]);
      const validUntil = addMembershipPeriod(base, String(item.sellable_snapshot.periodUnit), Number(item.sellable_snapshot.periodCount));
      const membership = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_memberships (user_id, plan_id, status, valid_from, valid_until)
        VALUES ($1, $2::uuid, 'active', NOW(), $3::timestamptz)
        ON CONFLICT (user_id, plan_id) DO UPDATE SET status = 'active', valid_until = EXCLUDED.valid_until,
          valid_from = CASE WHEN platform_memberships.status = 'revoked' THEN EXCLUDED.valid_from ELSE platform_memberships.valid_from END
        RETURNING id::text
      `, [order.buyer_user_id, item.membership_plan_id, validUntil]);
      await platformQuery(db, `
        INSERT INTO platform_membership_ledger (membership_id, entry_type, delta_access, valid_from, valid_until, order_item_id)
        VALUES ($1::uuid, $2, 1, $3::timestamptz, $4::timestamptz, $5::uuid)
      `, [membership[0].id, existingMembership[0] ? 'renewal' : 'purchase', base.toISOString(), validUntil, item.id]);
    }
    await platformQuery(db, `
      INSERT INTO platform_fulfillment_ledger (order_id, order_item_id, entry_type, delta_quantity)
      VALUES ($1::uuid, $2::uuid, 'release', -$3::integer)
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
