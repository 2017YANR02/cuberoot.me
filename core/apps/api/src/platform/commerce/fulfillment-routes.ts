import { requirePlatformAdmin } from '../auth.js';
import { encryptPlatformPrivateData } from '../data_encryption.js';
import { withIdempotency, platformQuery, enqueuePlatformEvent, sendMutation } from '../db.js';
import { notFound, PlatformApiError, conflict } from '../errors.js';
import { resourceId, readJsonObject, integerField, stringField } from '../validation.js';
import { refreshOrderFulfillmentStatus } from './fulfillment-service.js';
import { hashReference } from './references.js';
import { type ShipmentEventType, type FulfillmentType } from './types.js';
import { type Context, type Hono } from 'hono';

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
        storedMetadata, actor.userId]);
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
        { orderId, ledgerId, quantity, referenceHash }]);
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

export function registerFulfillmentRoutes(platformCommerceRoutes: Hono): void {
  platformCommerceRoutes.post('/admin/orders/:orderId/items/:itemId/ship', (c) => recordShipmentEvent(c, 'ship'));

  platformCommerceRoutes.post('/admin/orders/:orderId/items/:itemId/deliver', (c) => recordShipmentEvent(c, 'deliver'));

  platformCommerceRoutes.post('/admin/orders/:orderId/items/:itemId/return', (c) => recordShipmentEvent(c, 'return'));
}
