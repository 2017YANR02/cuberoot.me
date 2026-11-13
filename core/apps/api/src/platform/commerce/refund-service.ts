import { type PlatformActor } from '../auth.js';
import { reconcileCompetitionSettlement } from '../competition_settlement.js';
import { type PlatformDb, platformQuery, enqueuePlatformEvent, lockUserMemberships } from '../db.js';
import { notFound, PlatformApiError, conflict } from '../errors.js';
import { safeMoney } from './amounts.js';
import { type OrderRow, type FulfillmentType } from './types.js';

/** Caller supplies an authenticated successful provider refund or external-payment evidence. */
export async function completePlatformFullRefund(db: PlatformDb, actor: PlatformActor, id: string, refundId: string, evidenceReferenceHash: string): Promise<void> {
  const evidenceReason = `evidence_sha256:${evidenceReferenceHash}`;
    const competitionEvents=await platformQuery<{event_id:string}>(db,`SELECT c.event_id::text FROM platform_competitions c WHERE EXISTS(SELECT 1 FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id WHERE r.event_id=c.event_id AND i.order_id=$1::uuid) ORDER BY c.event_id FOR UPDATE OF c`,[id]);
    const orders = await platformQuery<OrderRow>(db, `SELECT id::text, order_number, buyer_user_id, status, currency, total_amount_minor FROM platform_orders WHERE id = $1::uuid FOR UPDATE`, [id]);
    const order = orders[0];
    if (!order) notFound('Order');
    if (order.buyer_user_id != null) await lockUserMemberships(db, order.buyer_user_id);
    if (!['paid', 'partially_fulfilled', 'fulfilled'].includes(order.status)) throw new PlatformApiError('INVALID_STATE', 409, 'Only paid or fulfilled orders can be fully refunded');
    const attempts = await platformQuery<{ id: string; provider: string }>(db, `SELECT id::text, provider FROM platform_payment_attempts WHERE order_id = $1::uuid AND status = 'succeeded' ORDER BY succeeded_at DESC LIMIT 1 FOR UPDATE`, [id]);
    const attempt = attempts[0];
    if (!attempt) conflict('No succeeded payment attempt exists');
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
      `, [actor.userId, actor.ownerKey, id, { refundId, evidenceReferenceHash, items: shippedItems }]);
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
      await platformQuery(db, `INSERT INTO platform_fulfillment_ledger (order_id, order_item_id, entry_type, delta_quantity, refund_id, reversal_of_ledger_id, metadata, actor_user_id) VALUES ($1::uuid, $2::uuid, 'reversal', $3, $4::uuid, $5::uuid, $6::jsonb, $7)`, [id, entry.order_item_id, -entry.delta_quantity, refundId, entry.id, { evidenceReferenceHash }, actor.userId]);
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
        SET status = CASE WHEN remaining.active THEN 'active' ELSE 'revoked' END,
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
        `, [actor.userId, actor.ownerKey, payout.id, { refundId, orderId: id }]);
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
        `, [actor.userId, actor.ownerKey, payout.id, { refundId, orderId: id }]);
        await enqueuePlatformEvent(db, 'platform.instructor_payout.reconciliation_required',
          'platform_instructor_payout', payout.id, `payout:${payout.id}:refund:${refundId}`, {
            payoutId: payout.id, refundId, orderId: id,
          });
      }
      await platformQuery(db, `INSERT INTO platform_instructor_revenue_ledger (instructor_id, order_id, refund_id, entry_type, delta_amount_minor, currency, reversal_of_ledger_id, reason, actor_user_id) VALUES ($1::uuid, $2::uuid, $3::uuid, 'reversal', $4, $5, $6::uuid, $7, $8)`, [entry.instructor_id, id, refundId, -safeMoney(entry.delta_amount_minor), entry.currency, entry.id, evidenceReason, actor.userId]);
    }
    await platformQuery(db, `WITH changed AS (
      UPDATE platform_event_registrations registration SET status = 'refunded', cancelled_at = NOW(),competition_video_generation=gen_random_uuid()
      WHERE registration.order_item_id IN (SELECT item.id FROM platform_order_items item WHERE item.order_id = $1::uuid)
        AND registration.status IN ('confirmed','attended')
      RETURNING registration.ticket_type_id, registration.quantity
    ), totals AS (
      SELECT ticket_type_id, SUM(quantity)::integer AS quantity FROM changed GROUP BY ticket_type_id
    ) UPDATE platform_event_ticket_types ticket SET sold_quantity = ticket.sold_quantity - totals.quantity,
      capacity_revision = ticket.capacity_revision + 1 FROM totals WHERE ticket.id = totals.ticket_type_id`, [id]);
    await platformQuery(db, `UPDATE platform_payment_attempts SET status = 'refunded' WHERE id = $1::uuid`, [attempt.id]);
    await platformQuery(db, `UPDATE platform_orders SET status = 'refunded' WHERE id = $1::uuid`, [id]);
    for(const competition of competitionEvents)await reconcileCompetitionSettlement(db,competition.event_id,actor);
    await platformQuery(db, `INSERT INTO platform_audit_events (actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata) VALUES ($1, $2, 'commerce.refund.completed', 'platform_refund', $3, 'allowed', $4::jsonb)`, [actor.userId, actor.ownerKey, refundId, { evidenceReferenceHash }]);
    await enqueuePlatformEvent(db, 'platform.order.refunded', 'platform_order', id, `order:${id}:refund:${refundId}`, { orderId: id, refundId });
}
