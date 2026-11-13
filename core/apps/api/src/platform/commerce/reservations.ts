import { type PlatformActor } from '../auth.js';
import { type PlatformDb, platformQuery } from '../db.js';
import { type PricedItem } from './types.js';

export async function reserveOrderItem(db: PlatformDb, orderId: string, itemId: string, item: PricedItem, actor: PlatformActor): Promise<void> {
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
        event_id, ticket_type_id, user_id, order_item_id, status, quantity, reservation_expires_at,competition_session_id,competition_project
      ) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, 'reserved', $5, NOW() + INTERVAL '30 minutes',$6::uuid,$7)
    `, [eventId, item.eventTicketTypeId, actor.userId, itemId, item.quantity,
      (item.snapshot.competition as Record<string, unknown> | undefined)?.sessionId ?? null,
      (item.snapshot.competition as Record<string, unknown> | undefined)?.project ?? null]);
  }
}

export async function releaseOrder(db: PlatformDb, orderId: string, actorUserId: number | null): Promise<void> {
  const items = await platformQuery<{
    id: string; product_variant_id: string | null; event_ticket_type_id: string | null; quantity: number;
  }>(db, `SELECT id::text, product_variant_id::text, event_ticket_type_id::text, quantity
          FROM platform_order_items WHERE order_id = $1::uuid ORDER BY line_number FOR UPDATE`, [orderId]);
  for (const item of items) {
    await platformQuery(db, `
      INSERT INTO platform_fulfillment_ledger (order_id, order_item_id, entry_type, delta_quantity, actor_user_id)
      VALUES ($1::uuid, $2::uuid, 'release', -$3::integer, $4)
    `, [orderId, item.id, item.quantity, actorUserId]);
    if (item.product_variant_id) {
      await platformQuery(db, `
        INSERT INTO platform_inventory_ledger (product_variant_id, entry_type, delta_reserved, order_item_id, actor_user_id)
        VALUES ($1::uuid, 'release', -$2::integer, $3::uuid, $4)
      `, [item.product_variant_id, item.quantity, item.id, actorUserId]);
    }
    if (item.event_ticket_type_id) {
      await platformQuery(db, `
        UPDATE platform_event_ticket_types SET reserved_quantity = reserved_quantity - $2, capacity_revision = capacity_revision + 1
        WHERE id = $1::uuid
      `, [item.event_ticket_type_id, item.quantity]);
      await platformQuery(db, `
        UPDATE platform_event_registrations SET status = 'cancelled', cancelled_at = NOW(),competition_video_generation=gen_random_uuid()
        WHERE order_item_id = $1::uuid AND status = 'reserved'
      `, [item.id]);
    }
  }
  await platformQuery(db, `
    UPDATE platform_coupon_redemptions SET status = 'released', released_at = NOW()
    WHERE order_id = $1::uuid AND status = 'reserved'
  `, [orderId]);
}
