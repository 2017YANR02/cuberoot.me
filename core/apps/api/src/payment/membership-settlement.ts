import { decimalToMinor, isRecord, requireText } from '@app-foundation/payments/core';
import { withTransaction, type QueryRunner } from '../db/connection.js';

export type MembershipProvider = 'alipay' | 'wechat' | 'xunhupay' | 'airwallex';
export interface MembershipPayment {
  provider: MembershipProvider;
  orderNo: string;
  transactionId: string;
  merchantId: string;
  amountMinor: number;
  currency: string;
  raw: unknown;
}
interface Order {
  out_trade_no: string; wca_id: string; name: string; plan_slug: string;
  amount_cents: number; currency: string; provider: string; provider_txn: string | null;
  pay_channel: string | null; status: string;
}
export interface MembershipGrant {
  wcaId: string; name: string; avatarUrl?: string | null;
  plan: { slug: string; period: string; period_count: number };
  source: string; orderNo: string | null;
}
export const MEMBERSHIP_PERIOD_UNITS: Record<string, string> = { month: 'months', year: 'years', week: 'weeks', day: 'days' };

function invalid(): never { throw new Error('Membership payment does not match its order'); }
function amount(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') return invalid();
  return decimalToMinor(String(value));
}

/** Only call after the provider transport/signature has authenticated this record. */
export function membershipPaymentEvidence(provider: MembershipProvider, raw: unknown, merchantId: string): MembershipPayment {
  if (!isRecord(raw)) return invalid();
  let row = raw;
  let orderNo: unknown, transactionId: unknown, amountMinor: number, currency: unknown;
  if (provider === 'alipay') {
    const queried = isRecord(raw.alipay_trade_query_response);
    if (queried) row = raw.alipay_trade_query_response as Record<string, unknown>;
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(String(row.trade_status))) return invalid();
    if ((!queried || row.app_id !== undefined) && row.app_id !== merchantId) return invalid();
    orderNo = row.out_trade_no; transactionId = row.trade_no; amountMinor = amount(row.total_amount); currency = 'CNY';
  } else if (provider === 'wechat') {
    if (row.trade_state !== 'SUCCESS' || row.mchid !== merchantId || !isRecord(row.amount)) return invalid();
    orderNo = row.out_trade_no; transactionId = row.transaction_id;
    amountMinor = row.amount.total as number; currency = row.amount.currency;
  } else if (provider === 'xunhupay') {
    if (row.status !== 'OD' || row.appid !== merchantId) return invalid();
    orderNo = row.trade_order_id; transactionId = row.transaction_id || row.open_order_id;
    amountMinor = amount(row.total_fee); currency = 'CNY';
  } else {
    if (!isRecord(row.data) || !isRecord(row.data.object) || row.account_id !== merchantId) return invalid();
    row = row.data.object;
    if (row.status !== 'SUCCEEDED') return invalid();
    orderNo = row.merchant_order_id; transactionId = row.id; amountMinor = amount(row.amount); currency = row.currency;
  }
  requireText(merchantId, 'merchantId', 128);
  const confirmedOrder = requireText(orderNo, 'orderNo', 64);
  const confirmedTransaction = requireText(transactionId, 'transactionId', 128);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return invalid();
  return { provider, orderNo: confirmedOrder, transactionId: confirmedTransaction, merchantId, amountMinor, currency, raw };
}

/** Transaction-scoped key also locks the absent membership row on first purchase. */
export async function grantMembershipInTransaction<Row>(run: QueryRunner, input: MembershipGrant): Promise<Row> {
  const { plan } = input;
  const unit = MEMBERSHIP_PERIOD_UNITS[plan.period];
  if (plan.period !== 'lifetime' && (typeof unit !== 'string' || !Number.isSafeInteger(plan.period_count) || plan.period_count <= 0)) {
    throw new Error('Invalid membership period');
  }
  await run('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [`membership:member:${input.wcaId}`]);
  // One atomic upsert computes extensions from the locked current row. A lifetime membership never downgrades.
  const expiry = plan.period === 'lifetime' ? 'NULL' : `NOW() + make_interval(${unit} => ?)`;
  const renewed = plan.period === 'lifetime' ? 'NULL'
    : `CASE WHEN memberships.expires_at IS NULL THEN NULL ELSE GREATEST(NOW(), memberships.expires_at) + make_interval(${unit} => ?) END`;
  const params: unknown[] = [input.wcaId, input.name, input.avatarUrl ?? null, plan.slug];
  if (plan.period !== 'lifetime') params.push(plan.period_count);
  params.push(input.source, input.orderNo);
  if (plan.period !== 'lifetime') params.push(plan.period_count);
  const rows = await run<Row>(`INSERT INTO memberships (wca_id, name, avatar_url, plan_slug, started_at, expires_at, source, last_order_no)
    VALUES (?, ?, ?, ?, NOW(), ${expiry}, ?, ?)
    ON CONFLICT (wca_id) DO UPDATE SET name = EXCLUDED.name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, memberships.avatar_url), plan_slug = EXCLUDED.plan_slug,
      expires_at = ${renewed}, source = EXCLUDED.source, last_order_no = EXCLUDED.last_order_no
    RETURNING *`, params);
  if (!rows[0]) throw new Error('Membership grant was not persisted');
  return rows[0];
}

export type MembershipTransaction = <T>(run: (query: QueryRunner) => Promise<T>) => Promise<T>;

/** Authentication occurs upstream; expected local amount/provider and all writes are checked under locks. */
export async function settleMembershipPayment(
  payment: MembershipPayment,
  merchantForOrder: (provider: string, channel: string | null) => string,
  transact: MembershipTransaction = withTransaction,
): Promise<'settled' | 'duplicate'> {
  if (!Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0) return invalid();
  requireText(payment.orderNo, 'orderNo', 64); requireText(payment.transactionId, 'transactionId', 128);
  return transact(async (run) => {
    // Serialize transaction-ID reuse even when malicious events name different local orders.
    await run('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [`membership:payment:${payment.provider}:${payment.transactionId}`]);
    const [order] = await run<Order>('SELECT * FROM membership_orders WHERE out_trade_no = ? FOR UPDATE', [payment.orderNo]);
    if (!order || order.provider !== payment.provider || order.amount_cents !== payment.amountMinor
      || order.currency !== payment.currency || !payment.merchantId
      || merchantForOrder(order.provider, order.pay_channel) !== payment.merchantId
      || (order.provider_txn && order.provider_txn !== payment.transactionId)) return invalid();
    const reused = await run('SELECT out_trade_no FROM membership_orders WHERE provider = ? AND provider_txn = ? AND out_trade_no <> ? LIMIT 1',
      [payment.provider, payment.transactionId, payment.orderNo]);
    if (reused.length) return invalid();
    if (order.status === 'paid') {
      if (order.provider_txn !== payment.transactionId) return invalid();
      return 'duplicate';
    }
    if (order.status !== 'pending') return invalid();
    const [plan] = await run<MembershipGrant['plan']>('SELECT slug, period, period_count FROM membership_plans WHERE slug = ? FOR SHARE', [order.plan_slug]);
    if (!plan) throw new Error('Membership plan is missing');
    await run(`UPDATE membership_orders SET status = 'paid', paid_at = NOW(), provider_txn = ?, raw_notify = ?::jsonb
      WHERE out_trade_no = ?`, [payment.transactionId, JSON.stringify(payment.raw), payment.orderNo]);
    await grantMembershipInTransaction(run, { wcaId: order.wca_id, name: order.name, plan, source: order.provider, orderNo: order.out_trade_no });
    return 'settled';
  });
}
