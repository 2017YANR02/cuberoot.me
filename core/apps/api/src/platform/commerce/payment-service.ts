import { platformQuery, platformDb, platformTransaction, enqueuePlatformEvent } from '../db.js';
import { PlatformApiError } from '../errors.js';
import {
  type PlatformPaymentProvider,
  PLATFORM_PAYMENT_PROVIDERS,
  queryProviderPayment,
  type VerifiedPaymentEvent,
} from '../payment.js';
import { safeMoney } from './amounts.js';
import { releaseOrder } from './reservations.js';
import { settlePaidOrder } from './settlement.js';
import { type OrderRow } from './types.js';
import { createHash } from 'node:crypto';

export function merchantAccount(provider: PlatformPaymentProvider): string {
  const value = provider === 'alipay' ? process.env.ALIPAY_APP_ID : process.env.WECHAT_MCHID;
  if (!value) throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503, `${provider} is not configured`);
  return value;
}

// Claim at most one provider query per order per ten seconds across API workers.
// No provider errors or browser return values can mark an order as paid.
export async function refreshOrderPayment(orderId: string): Promise<boolean> {
  const attempts = await platformQuery<{ provider: PlatformPaymentProvider; provider_order_id: string }>(platformDb(), `
    UPDATE platform_payment_attempts SET updated_at=NOW()
    WHERE id=(SELECT id FROM platform_payment_attempts WHERE order_id=$1::uuid
      AND status IN ('initiated','pending') ORDER BY attempt_number DESC LIMIT 1)
      AND updated_at<NOW()-INTERVAL '10 seconds'
    RETURNING provider, provider_order_id
  `, [orderId]);
  const attempt = attempts[0];
  if (!attempt || !PLATFORM_PAYMENT_PROVIDERS.includes(attempt.provider)) return false;
  try {
    const event = await queryProviderPayment(attempt.provider, attempt.provider_order_id);
    if (!event) return false;
    await applyVerifiedPayment(event);
    return true;
  } catch {
    // The confirmed database status remains authoritative while the next poll retries.
    console.warn('[platform-payment] provider verification unavailable', orderId);
    return false;
  }
}

export async function applyVerifiedPayment(event: VerifiedPaymentEvent): Promise<void> {
  const { provider } = event;
  await platformTransaction(async (db) => {
    const attempts = await platformQuery<{
      id: string; order_id: string; status: string; amount_minor: number | string; currency: string; merchant_account: string;
      provider_transaction_id: string | null;
    }>(db, `
      SELECT id::text, order_id::text, status, amount_minor, currency, merchant_account, provider_transaction_id
      FROM platform_payment_attempts
      WHERE provider = $1 AND merchant_account = $2 AND provider_order_id = $3
    `, [provider, event.merchantId, event.orderNo]);
    const locatedAttempt = attempts[0];
    if (!locatedAttempt || safeMoney(locatedAttempt.amount_minor) !== event.amountCents || locatedAttempt.currency !== event.currency) {
      throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Payment order, amount, or currency mismatch');
    }
    const orders = await platformQuery<OrderRow & { reservation_expired: boolean }>(db, `
      SELECT id::text, order_number, buyer_user_id, status, currency, total_amount_minor,
        created_at + INTERVAL '30 minutes' <= NOW() OR EXISTS (
          SELECT 1 FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id
          JOIN platform_competition_sessions s ON s.id=r.competition_session_id
          JOIN platform_events e ON e.id=r.event_id JOIN platform_competitions c ON c.event_id=e.id
          JOIN organizations o ON o.id=c.organization_id
          WHERE i.order_id=platform_orders.id AND (s.ends_at<=NOW() OR e.status<>'published' OR o.status<>'active')
        ) AS reservation_expired
      FROM platform_orders WHERE id = $1::uuid FOR UPDATE
    `, [locatedAttempt.order_id]);
    const order = orders[0];
    if (!order) throw new PlatformApiError('INVALID_STATE', 409, 'Payment order no longer exists');
    const lockedAttempts = await platformQuery<{
      id: string; order_id: string; status: string; amount_minor: number | string; currency: string; merchant_account: string;
      provider_transaction_id: string | null;
    }>(db, `
      SELECT id::text, order_id::text, status, amount_minor, currency, merchant_account, provider_transaction_id
      FROM platform_payment_attempts WHERE id = $1::uuid FOR UPDATE
    `, [locatedAttempt.id]);
    const attempt = lockedAttempts[0]!;
    const payloadHash = createHash('sha256').update(JSON.stringify(event.raw)).digest('hex');
    const providerEventId = `${event.eventId}:${event.paid ? 'succeeded' : 'not_succeeded'}`;
    const inserted = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_provider_events (
        payment_attempt_id, order_id, provider, merchant_account, provider_event_id, provider_transaction_id,
        event_type, status, amount_minor, currency, signature_verified, merchant_verified,
        order_verified, amount_currency_verified, payload_hash, payload_sanitized
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 'received', $8, $9, TRUE, TRUE, TRUE, TRUE, decode($10, 'hex'), $11::jsonb)
      ON CONFLICT (provider, merchant_account, provider_event_id) DO NOTHING RETURNING id::text
    `, [attempt.id, attempt.order_id, provider, event.merchantId, providerEventId, event.providerTransactionId,
      event.paid ? 'payment.succeeded' : 'payment.not_succeeded', event.amountCents, event.currency, payloadHash,
      { provider, providerEventId: event.eventId, paid: event.paid }]);
    if (!inserted[0]) return;
    if (!event.paid) {
      // Waiting for the buyer is not a failed payment and must not unlock a second charge.
      if (event.closed && ['initiated', 'pending'].includes(attempt.status)) {
        await platformQuery(db, `
          UPDATE platform_payment_attempts SET status = 'failed', failure_code = 'provider_not_succeeded'
          WHERE id = $1::uuid
        `, [attempt.id]);
      }
      await platformQuery(db, `UPDATE platform_provider_events SET status = 'rejected', rejection_code = 'payment_not_succeeded' WHERE id = $1::uuid`, [inserted[0].id]);
      return;
    }
    if (['succeeded', 'refunded', 'chargeback'].includes(attempt.status)) {
      if (attempt.provider_transaction_id === event.providerTransactionId) {
        await platformQuery(db, `UPDATE platform_provider_events SET status = 'processed', processed_at = NOW() WHERE id = $1::uuid`, [inserted[0].id]);
      } else {
        await platformQuery(db, `
          UPDATE platform_provider_events SET status = 'rejected', rejection_code = 'additional_provider_transaction'
          WHERE id = $1::uuid
        `, [inserted[0].id]);
        await enqueuePlatformEvent(db, 'platform.payment.reconciliation_required', 'platform_order', order.id,
          `payment:${attempt.id}:${createHash('sha256').update(providerEventId).digest('hex')}:additional-transaction`, {
            orderId: order.id, paymentAttemptId: attempt.id, reasonCode: 'additional_provider_transaction',
          });
      }
      return;
    }
    if (!['initiated', 'pending', 'failed', 'cancelled'].includes(attempt.status)) {
      await platformQuery(db, `
        UPDATE platform_provider_events SET status = 'rejected', rejection_code = 'attempt_status_not_payable'
        WHERE id = $1::uuid
      `, [inserted[0].id]);
      await enqueuePlatformEvent(db, 'platform.payment.reconciliation_required', 'platform_order', order.id,
        `payment:${attempt.id}:${createHash('sha256').update(providerEventId).digest('hex')}:invalid-state`, {
          orderId: order.id, paymentAttemptId: attempt.id, reasonCode: 'attempt_status_not_payable',
        });
      return;
    }
    const reusedTransactions = await platformQuery<{ id: string }>(db, `
      SELECT id::text FROM platform_payment_attempts
      WHERE provider = $1 AND merchant_account = $2 AND provider_transaction_id = $3 AND id <> $4::uuid
      FOR UPDATE
    `, [provider, event.merchantId, event.providerTransactionId, attempt.id]);
    if (reusedTransactions[0]) {
      await platformQuery(db, `
        UPDATE platform_provider_events SET status = 'rejected', rejection_code = 'provider_transaction_reused'
        WHERE id = $1::uuid
      `, [inserted[0].id]);
      await enqueuePlatformEvent(db, 'platform.payment.reconciliation_required', 'platform_order', order.id,
        `payment:${attempt.id}:${createHash('sha256').update(providerEventId).digest('hex')}:transaction-reused`, {
          orderId: order.id, paymentAttemptId: attempt.id, reasonCode: 'provider_transaction_reused',
        });
      return;
    }
    await platformQuery(db, `
      UPDATE platform_payment_attempts
      SET status = 'succeeded', failure_code = NULL, provider_transaction_id = $2, succeeded_at = NOW()
      WHERE id = $1::uuid
    `, [attempt.id, event.providerTransactionId]);
    await platformQuery(db, `
      UPDATE platform_payment_attempts
      SET status = 'cancelled', failure_code = 'order_cancelled'
      WHERE order_id = $1::uuid AND id <> $2::uuid AND status IN ('initiated', 'pending')
    `, [order.id, attempt.id]);
    // A delayed callback must not resurrect a seat even if the expiry job has not run.
    // Keep the real provider payment recorded, then queue reconciliation for the money.
    if (order.status === 'pending_payment' && order.reservation_expired) {
      await releaseOrder(db, order.id, null);
      await platformQuery(db, `UPDATE platform_orders SET status='cancelled',cancelled_at=NOW() WHERE id=$1::uuid`, [order.id]);
      order.status = 'cancelled';
    }
    if (order.status !== 'pending_payment') {
      const reasonCode = ['paid', 'partially_fulfilled', 'fulfilled', 'partially_refunded', 'refunded', 'chargeback'].includes(order.status)
        ? 'duplicate_payment_requires_reconciliation'
        : 'late_payment_after_order_closed';
      await platformQuery(db, `
        UPDATE platform_provider_events SET status = 'rejected', rejection_code = $2
        WHERE id = $1::uuid
      `, [inserted[0].id, reasonCode]);
      await enqueuePlatformEvent(db, 'platform.payment.reconciliation_required', 'platform_order', order.id,
        `payment:${attempt.id}:${createHash('sha256').update(providerEventId).digest('hex')}:order-closed`, {
          orderId: order.id, paymentAttemptId: attempt.id, reasonCode,
        });
      return;
    }
    await platformQuery(db, `UPDATE platform_orders SET status = 'paid', paid_at = NOW() WHERE id = $1::uuid`, [order.id]);
    await settlePaidOrder(db, order);
    await platformQuery(db, `UPDATE platform_provider_events SET status = 'processed', processed_at = NOW() WHERE id = $1::uuid`, [inserted[0].id]);
  });
}
