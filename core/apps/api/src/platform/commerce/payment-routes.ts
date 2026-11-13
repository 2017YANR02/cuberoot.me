import { getIp } from '../../utils/analytics_helpers.js';
import { requirePlatformActor } from '../auth.js';
import { withIdempotency, platformQuery, enqueuePlatformEvent, sendMutation } from '../db.js';
import { PlatformApiError, badRequest, notFound, conflict } from '../errors.js';
import {
  PLATFORM_PAYMENT_PROVIDERS,
  createProviderPayment,
  type PlatformPaymentProvider,
  verifyProviderNotification,
} from '../payment.js';
import { resourceId, readJsonObject, enumField, stringField } from '../validation.js';
import { safeMoney } from './amounts.js';
import { merchantAccount, applyVerifiedPayment } from './payment-service.js';
import { releaseOrder } from './reservations.js';
import { type OrderRow } from './types.js';
import { type Hono } from 'hono';
import { createHash } from 'node:crypto';

export function registerPaymentRoutes(platformCommerceRoutes: Hono): void {
  platformCommerceRoutes.post('/orders/:id/payment-attempts', async (c) => {
    const actor = await requirePlatformActor(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const provider = enumField(body, 'provider', PLATFORM_PAYMENT_PROVIDERS, { required: true })!;
    const clientType = enumField(body, 'clientType', ['pc', 'wap', 'miniprogram'] as const) ?? 'pc';
    const lang = enumField(body, 'lang', ['en', 'zh'] as const) ?? 'en';
    if (clientType === 'wap' && /MicroMessenger/i.test(c.req.header('user-agent') ?? '')) {
      throw new PlatformApiError('EXTERNAL_BROWSER_REQUIRED', 400, 'Open this order in your browser to pay');
    }
    const miniProgramCode = clientType === 'miniprogram' ? stringField(body, 'code', { required: true, max: 512 }) : undefined;
    if (clientType === 'miniprogram' && provider !== 'wechat') badRequest('Mini Program checkout requires WeChat Pay');
    const result = await withIdempotency(c, actor, `commerce.payment.create:${id}`, body, async (db) => {
      const rows = await platformQuery<OrderRow & { reservation_expires_at: string; reservation_expired: boolean }>(db, `
        SELECT id::text, order_number, buyer_user_id, status, currency, total_amount_minor,
               created_at + INTERVAL '30 minutes' AS reservation_expires_at,
               created_at + INTERVAL '30 minutes' <= NOW() OR EXISTS (
                 SELECT 1 FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id
                 JOIN platform_competition_sessions s ON s.id=r.competition_session_id
                 JOIN platform_events e ON e.id=r.event_id JOIN platform_competitions competition ON competition.event_id=e.id
                 JOIN organizations organization ON organization.id=competition.organization_id
                 WHERE i.order_id=platform_orders.id AND (s.ends_at<=NOW() OR e.status<>'published' OR organization.status<>'active')
               ) AS reservation_expired
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
      if (clientType === 'miniprogram') {
        const unsupported = await platformQuery(db, `SELECT id FROM platform_order_items WHERE order_id=$1::uuid
          AND (sellable_type<>'event_ticket' OR NOT jsonb_exists(sellable_snapshot,'competition')) LIMIT 1`, [id]);
        if (unsupported.length) badRequest('Mini Program checkout currently supports competition registrations only');
      }
      if (amount === 0) throw new PlatformApiError('INVALID_STATE', 409, 'Zero-value orders do not require payment');
      const activeAttempts = await platformQuery<{ id: string; expired: boolean; provider: string; provider_order_id: string; checkout_payload: Record<string, unknown> | null }>(db, `
        SELECT id::text, expires_at <= NOW() AS expired,provider,provider_order_id,checkout_payload
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
        const reusable = activeAttempts.find(attempt => !attempt.expired && attempt.provider === provider
          && (attempt.checkout_payload?.clientType === clientType
            || (clientType === 'miniprogram' && attempt.checkout_payload?.requestPayment)));
        if (reusable?.checkout_payload) {
          // Refresh expiring H5 URLs using the SAME provider order, never another charge.
          const payment = clientType === 'miniprogram' ? reusable.checkout_payload : {
            ...await createProviderPayment({ provider, clientType, orderNo: reusable.provider_order_id,
              returnOrderNo: order.order_number, amountCents: amount, currency: order.currency,
              subject: `CubeRoot ${order.order_number}`, payerIp: getIp(c), lang }), clientType,
          };
          await platformQuery(db, `UPDATE platform_payment_attempts SET checkout_payload=$2::jsonb WHERE id=$1::uuid`, [reusable.id, payment]);
          return { status: 200, body: { id: reusable.id, provider, status: 'pending', expiresAt: order.reservation_expires_at, ...payment } };
        }
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
      const payment = await createProviderPayment({ provider, clientType, orderNo: providerOrderId, returnOrderNo: order.order_number, amountCents: amount, currency: order.currency, subject: `CubeRoot ${order.order_number}`, payerIp: getIp(c), miniProgramCode, payerUserId: actor.userId!, lang });
      await platformQuery(db, `UPDATE platform_payment_attempts SET status = 'pending',checkout_payload=$2::jsonb WHERE id = $1::uuid`, [attemptRows[0].id,{ ...payment, clientType }]);
      return { status: 201, body: { id: attemptRows[0].id, provider, status: 'pending', expiresAt: order.reservation_expires_at, clientType, ...payment }, resourceType: 'platform_payment_attempt', resourceId: attemptRows[0].id };
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.post('/payments/:provider/notify', async (c) => {
    const provider = resourceId(c.req.param('provider')) as PlatformPaymentProvider;
    if (!PLATFORM_PAYMENT_PROVIDERS.includes(provider)) notFound('Payment provider');
    const event = await verifyProviderNotification(c, provider);
    await applyVerifiedPayment(event);
    return provider === 'alipay' ? c.text('success') : c.json({ code: 'SUCCESS', message: '成功' });
  });
}
