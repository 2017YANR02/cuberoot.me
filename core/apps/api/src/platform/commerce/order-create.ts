import { randomBytes } from 'node:crypto';
import type { PlatformActor } from '../auth.js';
import { enqueuePlatformEvent, platformQuery, type PlatformDb, type PlatformMutationResult } from '../db.js';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../data_encryption.js';
import { badRequest, notFound } from '../errors.js';
import { isObject, resourceId } from '../validation.js';
import { quoteOrder } from './pricing.js';
import { releaseOrder, reserveOrderItem } from './reservations.js';
import { settlePaidOrder } from './settlement.js';

function orderNumber(): string {
  return `PLT-${randomBytes(10).toString('hex').toUpperCase()}`;
}

export async function placePlatformOrder(db: PlatformDb, actor: PlatformActor, rawItems: unknown[], clientOrderKey: string,
  couponCode?: string, shippingAddressId?: string): Promise<PlatformMutationResult> {
  const competitionTicketIds=rawItems.flatMap(raw=>isObject(raw)&&typeof raw.eventTicketTypeId==='string'?[resourceId(raw.eventTicketTypeId,'eventTicketTypeId')]:[]);
  if(competitionTicketIds.length){
    // Take order locks before ticket locks, matching cancellation/callback lock order.
    const expired=await platformQuery<{id:string}>(db,`SELECT o.id::text FROM platform_orders o WHERE o.status='pending_payment'
      AND o.created_at+INTERVAL '30 minutes'<=NOW() AND EXISTS(SELECT 1 FROM platform_order_items i JOIN platform_event_registrations r ON r.order_item_id=i.id
        WHERE i.order_id=o.id AND r.competition_session_id IS NOT NULL AND r.event_id IN (SELECT event_id FROM platform_event_ticket_types WHERE id=ANY($1::uuid[])))
      ORDER BY o.id FOR UPDATE OF o SKIP LOCKED`,[competitionTicketIds]);
    for(const stale of expired){
      await releaseOrder(db,stale.id,null);
      await platformQuery(db,`UPDATE platform_payment_attempts SET status='cancelled',failure_code='reservation_expired' WHERE order_id=$1::uuid AND status IN ('initiated','pending')`,[stale.id]);
      await platformQuery(db,`UPDATE platform_orders SET status='cancelled',cancelled_at=NOW() WHERE id=$1::uuid`,[stale.id]);
      await enqueuePlatformEvent(db,'platform.order.reservation_expired','platform_order',stale.id,`order:${stale.id}:reservation-expired`,{orderId:stale.id});
    }
  }
  const { items, member, currency, subtotal, discount, total, couponId, couponEligibleSubtotalMinor } = await quoteOrder(db, rawItems, couponCode, actor.userId!);
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
    { member, couponCode: couponCode ?? null, couponEligibleSubtotalMinor }, shippingSnapshotEncrypted, shippingKeyVersion]);
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
      item.sellableType, item.snapshot, item.quantity, item.amountMinor, lineTotal, item.currency,
      item.fulfillmentType, item.revenueShare]);
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
}
