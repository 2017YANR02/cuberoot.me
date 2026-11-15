import { randomBytes } from 'node:crypto';
import { query, withTransaction } from '../db/connection.js';
import { reserveMembershipContract, validateMembershipConsent } from './membership-enrollment.js';
import { synchronizeMembershipContract, type MembershipContractRow } from './membership-contracts.js';
import { reconcileRenewalDebit } from './membership-renewals.js';
import { createPapayCheckout, PapayUnavailable, validatePapayCheckoutUrl, type PapayCheckoutTrade } from './wechat-papay.js';
import { renewalChannel, renewalPaymentChannels, renewalReleased } from './membership-renewal-policy.js';

type Checkout = { out_trade_no: string; contract_id: string; trade_type: PapayCheckoutTrade; status: string;
  checkout_url: string | null; checkout_expires_at: Date | string };

export function membershipCheckoutAvailable(): boolean {
  return renewalChannel() === 'payment' && renewalReleased()
    && process.env.WECHAT_PAPAY_SYNC_ENABLED === 'true' && process.env.WECHAT_PAPAY_DEBIT_ENABLED === 'true';
}

/** The saved cycle-zero order blocks the debit worker, even if signing arrives before payment. */
export async function createMembershipCheckout(owner: string, input: unknown, ip: string) {
  if (!membershipCheckoutAvailable()) throw new PapayUnavailable();
  const body = input as Record<string, unknown> | null;
  if (!body || !['pc', 'wap'].includes(String(body.clientType))) throw new Error('invalid checkout client');
  validateMembershipConsent(body);
  const tradeType = body.clientType === 'wap' ? 'MWEB' : 'NATIVE';
  const channels = renewalPaymentChannels();
  if (!(tradeType === 'NATIVE' ? channels.wechatNative : channels.wechatH5)) throw new PapayUnavailable();
  // Reconcile an abandoned checkout before considering a new reservation. Only a verified
  // CLOSED payment can retire an unsigned payment-only reservation; time alone cannot.
  const [previous] = await query<Checkout>(`SELECT d.* FROM membership_renewal_debits d
    JOIN membership_contracts c ON c.id = d.contract_id WHERE c.wca_id = ?
    AND c.state = 'pending' AND c.signing_method = 'payment' AND d.cycle = 0`, [owner]);
  if (previous) await refreshCheckoutPayment(previous);

  const saved = await withTransaction(async tx => {
    const contract = await reserveMembershipContract(tx, owner, body, 'payment');
    const [existing] = await tx<Checkout>('SELECT * FROM membership_renewal_debits WHERE contract_id = ? AND cycle = 0 FOR UPDATE', [contract.id]);
    if (existing) {
      if (existing.trade_type !== tradeType || existing.status !== 'submitted') throw new Error('check existing payment');
      return existing;
    }
    const [account] = await tx<{ name: string }>("SELECT display_name AS name FROM app_users WHERE wca_id = ? OR 'u' || id::text = ?", [owner, owner]);
    const orderNo = `C${randomBytes(15).toString('hex')}`;
    await tx(`INSERT INTO membership_orders (out_trade_no, wca_id, name, plan_slug, amount_cents, currency, provider, pay_channel, status)
      VALUES (?, ?, ?, ?, ?, 'CNY', 'wechat', 'wechat_papay', 'pending')`, [orderNo, owner, account.name || '', contract.plan_slug, contract.price_cents]);
    const [checkout] = await tx<Checkout>(`INSERT INTO membership_renewal_debits
      (out_trade_no, contract_id, cycle, status, submitted_at, trade_type, checkout_expires_at)
      VALUES (?, ?, 0, 'submitted', now(), ?, now() + interval '30 minutes') RETURNING *`, [orderNo, contract.id, tradeType]);
    return checkout;
  });

  // The reservation above is committed before any provider call. Retries reuse its order,
  // contract code and serial. Provider errors never create another first payment.
  return withTransaction(async tx => {
    await tx("SET LOCAL lock_timeout = '1000ms'");
    await tx("SELECT id FROM app_users WHERE wca_id = ? OR 'u' || id::text = ? FOR UPDATE", [owner, owner]);
    const [contract] = await tx<MembershipContractRow & { enrollment_serial: string }>('SELECT * FROM membership_contracts WHERE id = ? AND wca_id = ? FOR UPDATE', [saved.contract_id, owner]);
    const [checkout] = await tx<Checkout>('SELECT * FROM membership_renewal_debits WHERE out_trade_no = ? FOR UPDATE', [saved.out_trade_no]);
    if (!contract || contract.state !== 'pending' || contract.cancellation_requested_at || checkout.status !== 'submitted'
      || !membershipCheckoutAvailable()) throw new Error('check existing subscription');
    const expiresAt = new Date(checkout.checkout_expires_at);
    if (expiresAt.getTime() <= Date.now() + 60_000) throw new Error('checkout expired; check payment status');
    // MWEB URLs expire after five minutes. Re-enter the same unpaid order to refresh its URL.
    const reuseUrl = checkout.trade_type === 'NATIVE' && checkout.checkout_url;
    const url = reuseUrl ? validatePapayCheckoutUrl(checkout.trade_type, reuseUrl)
      : await createPapayCheckout(contract, { orderNo: checkout.out_trade_no, serial: String(contract.enrollment_serial),
        cents: contract.price_cents, tradeType: checkout.trade_type, ip, displayAccount: `CubeRoot ${owner}`, expiresAt });
    await tx('UPDATE membership_renewal_debits SET checkout_url = ? WHERE out_trade_no = ?', [url, checkout.out_trade_no]);
    return { subscriptionId: contract.id, outTradeNo: checkout.out_trade_no, tradeType: checkout.trade_type,
      priceCents: contract.price_cents, currency: 'CNY' as const, checkoutUrl: url, expiresAt: expiresAt.toISOString() };
  });
}

async function refreshCheckoutPayment(checkout: Checkout) {
  if (checkout.status !== 'submitted') return;
  await reconcileRenewalDebit(checkout.out_trade_no);
}

export async function getMembershipCheckout(owner: string, orderNo: string) {
  const [checkout] = await query<Checkout>(`SELECT d.* FROM membership_renewal_debits d
    JOIN membership_contracts c ON c.id = d.contract_id
    WHERE d.out_trade_no = ? AND c.wca_id = ? AND c.signing_method = 'payment' AND d.cycle = 0`, [orderNo, owner]);
  if (!checkout) return null;
  let paymentVerified = false;
  try { await refreshCheckoutPayment(checkout); paymentVerified = true; } catch { /* Preserve paid facts; report uncertainty. */ }
  const subscription = await synchronizeMembershipContract(checkout.contract_id, owner, false);
  if (!subscription) return null;
  const [payment] = await query<{ status: string }>(`SELECT o.status FROM membership_orders o
    JOIN membership_contracts c ON c.wca_id = o.wca_id WHERE o.out_trade_no = ? AND c.id = ? AND c.wca_id = ?`,
    [orderNo, checkout.contract_id, owner]);
  if (!payment) return null; // Account ownership may have changed while WeChat was queried.
  return { status: payment.status, paymentVerified, subscription };
}

export async function refreshMembershipCheckouts(owner: string) {
  const rows = await query<Checkout>(`SELECT d.* FROM membership_renewal_debits d
    JOIN membership_contracts c ON c.id = d.contract_id WHERE c.wca_id = ?
    AND c.signing_method = 'payment' AND d.cycle = 0 AND d.status = 'submitted'
    ORDER BY d.created_at DESC LIMIT 3`, [owner]);
  for (const row of rows) {
    try { await refreshCheckoutPayment(row); } catch { /* Management remains available during payment outages. */ }
  }
}
