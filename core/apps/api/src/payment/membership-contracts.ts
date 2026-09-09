import { query, withTransaction, type QueryRunner } from '../db/connection.js';
import { cancelPapayContract, queryPapayContract, papayConfigured, type PapayContract,
  type ContractState, type PapayNotification } from './wechat-papay.js';

export interface MembershipContractRow extends PapayContract {
  id: string;
  wca_id: string;
  plan_slug: string;
  price_cents: number;
  currency: 'CNY';
  period: 'month' | 'year';
  period_count: number;
  state: ContractState;
  cancellation_requested_at: Date | string | null;
  verified_at: Date | string | null;
  created_at: Date | string;
}
export function publicContract(row: MembershipContractRow, syncStatus: 'verified' | 'unavailable') {
  return { id: row.id, planSlug: row.plan_slug, priceCents: row.price_cents, currency: row.currency,
    period: row.period, periodCount: row.period_count, state: row.state,
    cancellationRequested: Boolean(row.cancellation_requested_at), verifiedAt: row.verified_at,
    createdAt: row.created_at, syncStatus };
}

async function lockOwner(tx: QueryRunner, owner: string): Promise<boolean> {
  // A slow provider must not turn concurrent refreshes into an unbounded DB pool queue.
  await tx("SET LOCAL lock_timeout = '1000ms'");
  const rows = await tx(`SELECT id FROM app_users WHERE (wca_id = ? OR 'u' || id::text = ?)
    AND merged_into_user_id IS NULL FOR UPDATE`, [owner, owner]);
  return rows.length > 0;
}

/** Row locks serialize refresh/cancel; a terminal state can never be overwritten by an old reply. */
export async function synchronizeMembershipContract(id: string, owner: string, cancel: boolean, notification?: PapayNotification) {
  return withTransaction(async (tx) => {
    // Account first, then contract: same lock order as account merge/deletion.
    if (!await lockOwner(tx, owner)) return null;
    const [row] = await tx<MembershipContractRow>(
      'SELECT * FROM membership_contracts WHERE id = ? AND wca_id = ? FOR UPDATE', [id, owner]);
    if (!row) return null;
    if (notification && (row.appid !== notification.appid || row.mch_id !== notification.mch_id
      || row.plan_id !== notification.plan_id || row.contract_code !== notification.contract_code
      || (row.contract_id && row.contract_id !== notification.contract_id))) return null;
    if (row.state === 'terminated') return publicContract(row, 'verified');
    let remote;
    try {
      // Cancel directly: query errors must not prevent a user from requesting termination.
      remote = cancel ? await cancelPapayContract(row)
        : await queryPapayContract(notification ? { ...row, contract_id: notification.contract_id } : row, notification?.openid);
    } catch {
      // A timeout may mean WeChat acted but the reply was lost. Preserve the intent and
      // show a pending result; the next refresh queries the provider instead of inventing success.
      if (!cancel) return publicContract(row, 'unavailable');
      try { remote = await queryPapayContract(row); }
      catch { return publicContract(row, 'unavailable'); }
    }
    const [updated] = await tx<MembershipContractRow>(
      `UPDATE membership_contracts SET state = ?, contract_id = ?, verified_at = now(), updated_at = now()
       WHERE id = ? AND wca_id = ? RETURNING *`, [remote.state, remote.contractId, id, owner]);
    return publicContract(updated, 'verified');
  });
}

export async function synchronizeMembershipNotification(notification: PapayNotification): Promise<boolean> {
  const [row] = await query<MembershipContractRow>(
    `SELECT * FROM membership_contracts WHERE appid = ? AND mch_id = ? AND plan_id = ? AND contract_code = ?`,
    [notification.appid, notification.mch_id, notification.plan_id, notification.contract_code]);
  if (!row) return false; // Never invent account ownership from a callback or openid.
  const result = await synchronizeMembershipContract(row.id, row.wca_id, false, notification);
  return result?.syncStatus === 'verified';
}

export async function listMembershipContracts(owner: string) {
  const rows = await query<MembershipContractRow>(
    'SELECT * FROM membership_contracts WHERE wca_id = ? ORDER BY created_at DESC', [owner]);
  const subscriptions = [];
  // Sequential requests avoid unbounded outbound work and connection fan-out per account.
  // Historical terminal contracts are returned locally and never require another provider call.
  for (const row of rows) {
    const result = row.state === 'terminated' ? publicContract(row, 'verified')
      : !papayConfigured() ? publicContract(row, 'unavailable') : await synchronizeMembershipContract(row.id, owner, false);
    if (result) subscriptions.push(result);
  }
  return { subscriptions, managementAvailable: papayConfigured() };
}

export async function cancelMembershipContract(id: string, owner: string) {
  // This separate commit is deliberate: even if the provider is offline or the process
  // dies, a future debit worker must reject cancellation_requested_at IS NOT NULL.
  const row = await withTransaction(async (tx) => {
    if (!await lockOwner(tx, owner)) return null;
    const [saved] = await tx<MembershipContractRow>(
      `UPDATE membership_contracts SET cancellation_requested_at = COALESCE(cancellation_requested_at, now()),
         updated_at = now() WHERE id = ? AND wca_id = ? RETURNING *`, [id, owner]);
    return saved;
  });
  if (!row) return { kind: 'missing' as const };
  if (row.state === 'terminated') return { kind: 'complete' as const, subscription: publicContract(row, 'verified') };
  if (!papayConfigured()) return { kind: 'unavailable' as const };
  const subscription = await synchronizeMembershipContract(id, owner, true);
  if (!subscription) return { kind: 'missing' as const };
  return { kind: subscription.state === 'terminated' ? 'complete' as const : 'pending' as const, subscription };
}
