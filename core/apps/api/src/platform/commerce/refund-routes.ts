import { requirePlatformAdmin } from '../auth.js';
import { withIdempotency, platformQuery, sendMutation } from '../db.js';
import { notFound, PlatformApiError, conflict } from '../errors.js';
import { resourceId, readJsonObject, stringField } from '../validation.js';
import { safeMoney } from './amounts.js';
import { hashReference } from './references.js';
import { completePlatformFullRefund } from './refund-service.js';
import { type OrderRow } from './types.js';
import { type Hono } from 'hono';

export function registerRefundRoutes(platformCommerceRoutes: Hono): void {
  platformCommerceRoutes.post('/admin/orders/:id/refund', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const reasonCode = stringField(body, 'reasonCode', { required: true, max: 64 })!;
    const providerRefundId = stringField(body, 'providerRefundId', { required: true, max: 200 })!;
    const evidenceReference = stringField(body, 'evidenceReference', { required: true, max: 240 })!;
    const evidenceReferenceHash = hashReference(evidenceReference);
    const result = await withIdempotency(c, actor, `commerce.refund.full:${id}`, body, async (db) => {
      const competitionEvents=await platformQuery<{event_id:string}>(db,`SELECT c.event_id::text FROM platform_competitions c WHERE EXISTS(SELECT 1 FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id WHERE r.event_id=c.event_id AND i.order_id=$1::uuid) ORDER BY c.event_id FOR UPDATE OF c`,[id]);
      const orders = await platformQuery<OrderRow>(db, `SELECT id::text, order_number, buyer_user_id, status, currency, total_amount_minor FROM platform_orders WHERE id = $1::uuid FOR UPDATE`, [id]);
      const order = orders[0];
      if (!order) notFound('Order');
      if (!['paid', 'partially_fulfilled', 'fulfilled'].includes(order.status)) throw new PlatformApiError('INVALID_STATE', 409, 'Only paid or fulfilled orders can be fully refunded');
      const attempts = await platformQuery<{ id: string; provider: string }>(db, `SELECT id::text, provider FROM platform_payment_attempts WHERE order_id = $1::uuid AND status = 'succeeded' ORDER BY succeeded_at DESC LIMIT 1 FOR UPDATE`, [id]);
      const attempt = attempts[0];
      if (!attempt) conflict('No succeeded payment attempt exists');
      const existingRefunds = await platformQuery(db, `SELECT id FROM platform_refunds WHERE order_id=$1::uuid AND (status IN ('requested','pending','succeeded','chargeback') OR approved_at IS NOT NULL) LIMIT 1`, [id]);
      if (existingRefunds.length) conflict('Resolve the existing refund request before recording an external refund');
      const numberRows = await platformQuery<{ next: number }>(db, `SELECT COALESCE(MAX(refund_number),0)::integer + 1 AS next FROM platform_refunds WHERE order_id = $1::uuid`, [id]);
      const refunds = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_refunds (
          order_id, payment_attempt_id, refund_number, provider, provider_refund_id, status, reason_code,
          amount_minor, currency, requested_by_user_id, decided_by_user_id, decided_by_actor_key, succeeded_at
        ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'succeeded', $6, $7, $8, $9, $9, $10, NOW()) RETURNING id::text
      `, [id, attempt.id, numberRows[0].next, attempt.provider, providerRefundId, reasonCode,
        safeMoney(order.total_amount_minor), order.currency, actor.userId, actor.ownerKey]);
      const refundId = refunds[0].id;
      await completePlatformFullRefund(db, actor, id, refundId, evidenceReferenceHash);
      return { status: 201, body: { id: refundId, orderId: id, status: 'succeeded' }, resourceType: 'platform_refund', resourceId: refundId };
    });
    return sendMutation(c, result);
  });
}
