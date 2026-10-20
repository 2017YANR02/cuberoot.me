import { randomBytes } from 'node:crypto';
import { query, withTransaction } from '../db/connection.js';
import { applyPapayDebit, papayConfig, papayConfigured, queryPapayDebit } from './wechat-papay.js';
import { synchronizeMembershipContract, type MembershipContractRow } from './membership-contracts.js';
import { grantMembershipInTransaction } from './membership-settlement.js';
import { renewalReleased, renewalPilotAllowed, renewalDebitAllowed, renewalPlanConfigured, RENEWAL_TEMPLATES, type RenewalSlug } from './membership-renewal-policy.js';

type Contract = MembershipContractRow & { consented_at: Date | null; debit_cycle: number; next_debit_at: Date | null };
type Debit = { out_trade_no: string; contract_id: string; cycle: number; status: string };

/** Provider callbacks only wake reconciliation. The signed query, saved order and merchant must all agree. */
export async function reconcileRenewalDebit(orderNo: string): Promise<boolean> {
  const [candidate] = await query<Debit>('SELECT * FROM membership_renewal_debits WHERE out_trade_no = ?', [orderNo]);
  if (!candidate) return false;
  const remote = await queryPapayDebit(orderNo);
  if (remote.trade_state !== 'SUCCESS') {
    if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(remote.trade_state)) {
      await withTransaction(async tx => {
        const changed = await tx("UPDATE membership_renewal_debits SET status = 'failed' WHERE out_trade_no = ? AND status = 'submitted' RETURNING out_trade_no", [orderNo]);
        if (changed.length) await tx("UPDATE membership_orders SET status = 'failed' WHERE out_trade_no = ? AND status = 'pending'", [orderNo]);
      });
    }
    // ACCEPT/NOTPAY/USERPAYING remain pending, including the 24-hour notification window.
    return false;
  }
  const { appid, mchId } = papayConfig();
  return withTransaction(async tx => {
    const [binding] = await tx<{ wca_id: string }>('SELECT wca_id FROM membership_contracts WHERE id = ?', [candidate.contract_id]);
    if (!binding) return false;
    await tx("SELECT id FROM app_users WHERE wca_id = ? OR 'u' || id::text = ? FOR UPDATE", [binding.wca_id, binding.wca_id]);
    const [contract] = await tx<Contract>('SELECT * FROM membership_contracts WHERE id = ? FOR UPDATE', [candidate.contract_id]);
    const [debit] = await tx<Debit>('SELECT * FROM membership_renewal_debits WHERE out_trade_no = ? FOR UPDATE', [orderNo]);
    if (!contract || !debit || !['submitted', 'paid'].includes(debit.status)) return false;
    if (contract.appid !== appid || contract.mch_id !== mchId || remote.trade_type !== 'PAP'
      || remote.fee_type && remote.fee_type !== 'CNY'
      || !/^\d+$/.test(remote.total_fee) || Number(remote.total_fee) !== contract.price_cents
      || !remote.transaction_id) throw new Error('renewal payment mismatch');
    await tx('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [`membership:payment:wechat:${remote.transaction_id}`]);
    const [order] = await tx<{ status: string; provider_txn: string | null; amount_cents: number; currency: string; pay_channel: string; wca_id: string; name: string }>(
      'SELECT * FROM membership_orders WHERE out_trade_no = ? FOR UPDATE', [orderNo]);
    if (!order || order.amount_cents !== contract.price_cents || order.currency !== 'CNY'
      || order.pay_channel !== 'wechat_papay' || order.wca_id !== contract.wca_id) throw new Error('renewal order mismatch');
    const reused = await tx('SELECT out_trade_no FROM membership_orders WHERE provider = ? AND provider_txn = ? AND out_trade_no <> ?',
      ['wechat', remote.transaction_id, orderNo]);
    if (reused.length) throw new Error('renewal transaction reused');
    if (debit.status === 'paid') return order.status === 'paid' && order.provider_txn === remote.transaction_id;
    if (order.status !== 'pending' || contract.debit_cycle !== debit.cycle) throw new Error('renewal cycle mismatch');
    // Honor already-paid service even when cancellation happened while the debit was pending.
    const membership = await grantMembershipInTransaction<{ expires_at: Date | null }>(tx, {
      wcaId: contract.wca_id, name: order.name,
      plan: { slug: contract.plan_slug, period: contract.period, period_count: contract.period_count },
      source: 'wechat', orderNo,
    });
    await tx("UPDATE membership_orders SET status = 'paid', paid_at = now(), provider_txn = ? WHERE out_trade_no = ?", [remote.transaction_id, orderNo]);
    await tx("UPDATE membership_renewal_debits SET status = 'paid' WHERE out_trade_no = ?", [orderNo]);
    // Notify one day before expiry. Calendar periods and lifetime behavior come from the existing grant function.
    await tx(`UPDATE membership_contracts SET debit_cycle = debit_cycle + 1,
      next_debit_at = ?::timestamptz - interval '24 hours' WHERE id = ?`, [membership.expires_at, contract.id]);
    return true;
  });
}

async function prepareDebit(id: string, owner: string): Promise<string | null> {
  if (!renewalDebitAllowed(owner, 0)) return null;
  const verified = await synchronizeMembershipContract(id, owner, false);
  if (verified?.state !== 'active' || verified.syncStatus !== 'verified') return null;
  return withTransaction(async tx => {
    await tx("SET LOCAL lock_timeout = '1000ms'");
    const [account] = await tx<{ name: string }>(`SELECT display_name AS name FROM app_users WHERE (wca_id = ? OR 'u' || id::text = ?)
      AND merged_into_user_id IS NULL FOR UPDATE`, [owner, owner]);
    if (!account) return null;
    const [contract] = await tx<Contract>(`SELECT * FROM membership_contracts WHERE id = ? AND wca_id = ?
      AND state = 'active' AND cancellation_requested_at IS NULL AND consented_at IS NOT NULL
      AND (debit_cycle = 0 OR next_debit_at <= now()) FOR UPDATE`, [id, owner]);
    if (!contract || !renewalPlanConfigured(contract.plan_slug)
      || RENEWAL_TEMPLATES[contract.plan_slug as RenewalSlug]?.id !== contract.plan_id
      || !renewalDebitAllowed(owner, contract.debit_cycle)) return null;
    const [existing] = await tx<Debit>('SELECT * FROM membership_renewal_debits WHERE contract_id = ? AND cycle = ?', [id, contract.debit_cycle]);
    if (existing) return existing.status === 'prepared' ? existing.out_trade_no : null;
    const [membership] = await tx<{ expires_at: Date | null }>('SELECT expires_at FROM memberships WHERE wca_id = ?', [owner]);
    if (membership && membership.expires_at === null) return null;
    if (contract.debit_cycle > 0 && membership?.expires_at && new Date(membership.expires_at).getTime() > Date.now() + 86400000) {
      await tx("UPDATE membership_contracts SET next_debit_at = ?::timestamptz - interval '24 hours' WHERE id = ?", [membership.expires_at, id]);
      return null;
    }
    const no = `R${randomBytes(15).toString('hex')}`;
    await tx(`INSERT INTO membership_orders (out_trade_no, wca_id, name, plan_slug, amount_cents, currency, provider, pay_channel, status)
      VALUES (?, ?, ?, ?, ?, 'CNY', 'wechat', 'wechat_papay', 'pending')`, [no, owner, account.name || '', contract.plan_slug, contract.price_cents]);
    await tx('INSERT INTO membership_renewal_debits (out_trade_no, contract_id, cycle) VALUES (?, ?, ?)', [no, id, contract.debit_cycle]);
    return no;
  });
}

async function submitDebit(no: string): Promise<void> {
  // Persist the attempt BEFORE network I/O. A crash cannot produce a second automatic debit request.
  const [attempt] = await query<Debit>(`UPDATE membership_renewal_debits SET status = 'submitted', submitted_at = now()
    WHERE out_trade_no = ? AND status = 'prepared' RETURNING *`, [no]);
  if (!attempt) return;
  await withTransaction(async tx => {
    const [binding] = await tx<{ wca_id: string }>('SELECT wca_id FROM membership_contracts WHERE id = ?', [attempt.contract_id]);
    if (!binding) return;
    await tx("SELECT id FROM app_users WHERE wca_id = ? OR 'u' || id::text = ? FOR UPDATE", [binding.wca_id, binding.wca_id]);
    const [contract] = await tx<Contract>('SELECT * FROM membership_contracts WHERE id = ? FOR UPDATE', [attempt.contract_id]);
    if (!contract || !renewalPlanConfigured(contract.plan_slug)
      || RENEWAL_TEMPLATES[contract.plan_slug as RenewalSlug]?.id !== contract.plan_id
      || contract.state !== 'active' || contract.cancellation_requested_at
      || !renewalDebitAllowed(contract.wca_id, attempt.cycle)) {
      await tx("UPDATE membership_renewal_debits SET status = 'cancelled' WHERE out_trade_no = ?", [no]);
      return;
    }
    // Serialize with cancellation. Once the user's cancellation intent is committed, no new request is sent.
    await applyPapayDebit(contract, no, contract.price_cents);
  });
}

let running = false;
export async function runMembershipRenewalsOnce(): Promise<void> {
  if (running || !papayConfigured() || process.env.WECHAT_PAPAY_SYNC_ENABLED !== 'true') return;
  running = true;
  try {
    // Reconciliation continues after the launch/debit switch is turned off.
    const pending = await query<Debit>(`UPDATE membership_renewal_debits SET last_query_at = now() WHERE out_trade_no IN (
      SELECT out_trade_no FROM membership_renewal_debits WHERE status = 'submitted'
      AND (last_query_at IS NULL OR last_query_at < now() - interval '5 minutes')
      ORDER BY last_query_at NULLS FIRST LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *`);
    for (const row of pending) {
      try { await reconcileRenewalDebit(row.out_trade_no); } catch { /* retain uncertain attempt for reconciliation */ }
    }
    if (!(renewalReleased() && process.env.WECHAT_PAPAY_DEBIT_ENABLED === 'true')
      && !(renewalPilotAllowed(process.env.WECHAT_PAPAY_PILOT_OWNER) && process.env.WECHAT_PAPAY_PILOT_DEBIT_ENABLED === 'true')) return;
    const due = await query<Contract>(`SELECT * FROM membership_contracts c WHERE state = 'active'
      AND (?::boolean OR (wca_id = ? AND debit_cycle = 0))
      AND cancellation_requested_at IS NULL AND consented_at IS NOT NULL
      AND (debit_cycle = 0 OR next_debit_at <= now())
      AND NOT EXISTS (SELECT 1 FROM membership_renewal_debits d WHERE d.contract_id = c.id AND d.cycle = c.debit_cycle AND d.status <> 'prepared')
      ORDER BY next_debit_at NULLS FIRST, created_at LIMIT 10`, [renewalReleased(), process.env.WECHAT_PAPAY_PILOT_OWNER ?? '']);
    for (const contract of due) {
      try {
        const no = await prepareDebit(contract.id, contract.wca_id);
        if (no) await submitDebit(no);
      } catch { console.warn('[membership-renewal] reconciliation required'); }
    }
  } finally { running = false; }
}

export function startMembershipRenewals(): void {
  if (process.env.WECHAT_PAPAY_SYNC_ENABLED !== 'true') return;
  const tick = () => void runMembershipRenewalsOnce().catch(() => console.warn('[membership-renewal] worker unavailable'));
  tick();
  setInterval(tick, 60_000).unref();
}
