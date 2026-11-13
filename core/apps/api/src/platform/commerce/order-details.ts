import { decryptPlatformPrivateData } from '../data_encryption.js';
import { type PlatformDb, platformQuery } from '../db.js';
import { orderPaymentChannels } from '../payment.js';
import { isObject } from '../validation.js';
import { type ShipmentEventType } from './types.js';

export function orderIdentityPredicate(id: string, parameter: 1 | 2): string {
  const byUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  return byUuid ? `o.id = $${parameter}::uuid` : `o.order_number = $${parameter}::varchar`;
}

export async function orderDetails(db: PlatformDb, predicate: string, parameters: readonly unknown[]): Promise<Record<string, unknown> | undefined> {
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
  order.paymentChannels = orderPaymentChannels(String(order.currency));
  const active = await platformQuery(db, `
    SELECT id::text, provider, status, expires_at AS "expiresAt", checkout_payload
    FROM platform_payment_attempts WHERE order_id=$1::uuid AND status='pending' AND expires_at>NOW()
    ORDER BY attempt_number DESC LIMIT 1
  `, [order.id]);
  order.activePayment = active[0] ? { id: active[0].id, provider: active[0].provider, status: 'pending',
    expiresAt: active[0].expiresAt, ...(active[0].checkout_payload as Record<string, unknown> ?? {}) } : null;
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
