import { type PlatformDb, platformQuery } from '../db.js';

export async function refreshOrderFulfillmentStatus(
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
    SET status = $2::varchar,
        fulfilled_at = CASE WHEN $2::varchar = 'fulfilled' THEN COALESCE(fulfilled_at, NOW()) ELSE NULL END
    WHERE id = $1::uuid AND status IN ('paid', 'partially_fulfilled')
  `, [orderId, status]);
  return status;
}
