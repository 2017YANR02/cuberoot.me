import { requirePlatformActor, requirePlatformAdmin } from '../auth.js';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../data_encryption.js';
import {
  platformQuery,
  platformDb,
  platformTransaction,
  withIdempotency,
  enqueuePlatformEvent,
  sendMutation,
} from '../db.js';
import { notFound, badRequest, PlatformApiError } from '../errors.js';
import { privateNoStore } from '../http.js';
import {
  pagination,
  resourceId,
  readJsonObject,
  arrayField,
  stringField,
  isObject,
  integerField,
} from '../validation.js';
import { orderDetails, orderIdentityPredicate } from './order-details.js';
import { refreshOrderPayment } from './payment-service.js';
import { quoteOrder } from './pricing.js';
import { releaseOrder, reserveOrderItem } from './reservations.js';
import { settlePaidOrder } from './settlement.js';
import { type OrderRow } from './types.js';
import { type Hono } from 'hono';
import { randomBytes } from 'node:crypto';

function orderNumber(): string {
  return `PLT-${randomBytes(10).toString('hex').toUpperCase()}`;
}

export function registerOrderRoutes(platformCommerceRoutes: Hono): void {
  platformCommerceRoutes.get('/orders', async (c) => {
    const actor = await requirePlatformActor(c);
    const { page, pageSize, offset } = pagination(c);
    const q=c.req.query('q')?.trim().slice(0,200)??'';
    const rows = await platformQuery(platformDb(), `
      SELECT id::text, order_number AS "orderNumber", status, currency, total_amount_minor AS "totalAmountMinor",
             paid_at AS "paidAt", created_at AS "createdAt"
      FROM platform_orders WHERE buyer_user_id = $1 AND ($4='' OR order_number ILIKE '%'||$4||'%') ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3
    `, [actor.userId, pageSize, offset,q]);
    privateNoStore(c);
    const counts=await platformQuery<{total:number}>(platformDb(),`SELECT COUNT(*)::int AS total FROM platform_orders WHERE buyer_user_id = $1 AND ($2='' OR order_number ILIKE '%'||$2||'%')`,[actor.userId,q]);
    return c.json({ items: rows, page, pageSize,total:counts[0]?.total??0 });
  });

  platformCommerceRoutes.get('/orders/:id', async (c) => {
    const actor = await requirePlatformActor(c);
    const id = resourceId(c.req.param('id'));
    let row = await orderDetails(platformDb(), `o.buyer_user_id = $1 AND ${orderIdentityPredicate(id, 2)}`, [actor.userId, id]);
    if (!row) notFound('Order');
    if (row.status === 'pending_payment' && await refreshOrderPayment(String(row.id))) {
      row = await orderDetails(platformDb(), 'o.id=$1::uuid AND o.buyer_user_id=$2', [row.id, actor.userId]);
    }
    privateNoStore(c);
    return c.json(row);
  });

  platformCommerceRoutes.post('/orders/quote', async (c) => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const supplied = arrayField(body, 'items', { maxItems: 100 });
    const rawItems = supplied?.length ? supplied : [body];
    const couponCode = stringField(body, 'couponCode', { max: 64 })?.toUpperCase();
    const quote = await platformTransaction(db => quoteOrder(db, rawItems, couponCode, actor.userId!));
    privateNoStore(c);
    return c.json({ currency:quote.currency, member:quote.member, subtotalAmountMinor:quote.subtotal,
      discountAmountMinor:quote.discount,totalAmountMinor:quote.total,
      items:quote.items.map(item=>({titleZh:item.snapshot.titleZh??item.snapshot.nameZh,titleEn:item.snapshot.titleEn??item.snapshot.nameEn,
        quantity:item.quantity,unitAmountMinor:item.amountMinor,lineAmountMinor:item.amountMinor*item.quantity})) });
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
      `, [actor.userId, actor.ownerKey, { expiredOrders: orders.length, expiredAttempts: staleAttempts.length, limit }]);
      return {
        status: 200,
        body: { expiredOrders: orders.length, expiredAttempts: staleAttempts.length },
      };
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.get('/admin/orders', async (c) => {
    await requirePlatformAdmin(c);
    const { page, pageSize, offset } = pagination(c);
    const status = c.req.query('status');
    const q=c.req.query('q')?.trim().slice(0,200)??'';
    const rows = await platformQuery(platformDb(), `
      SELECT id::text, order_number AS "orderNumber", buyer_user_id AS "buyerUserId", status, currency,
             total_amount_minor AS "totalAmountMinor", paid_at AS "paidAt", created_at AS "createdAt"
      FROM platform_orders WHERE ($1::text IS NULL OR status = $1) AND ($4='' OR order_number ILIKE '%'||$4||'%') ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3
    `, [status || null, pageSize, offset,q]);
    privateNoStore(c);
    const counts=await platformQuery<{total:number}>(platformDb(),`SELECT COUNT(*)::int AS total FROM platform_orders WHERE ($1::text IS NULL OR status=$1) AND ($2='' OR order_number ILIKE '%'||$2||'%')`,[status || null,q]);
    return c.json({ items: rows, page, pageSize,total:counts[0]?.total??0 });
  });

  platformCommerceRoutes.get('/admin/orders/:id', async (c) => {
    await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const row = await orderDetails(platformDb(), orderIdentityPredicate(id, 1), [id]);
    if (!row) notFound('Order');
    privateNoStore(c);
    return c.json(row);
  });
}
