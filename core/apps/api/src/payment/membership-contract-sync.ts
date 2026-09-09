import { sql, withTransaction } from '../db/connection.js';
import { synchronizeMembershipContract } from './membership-contracts.js';

const BATCH_SIZE = 10;
const INTERVAL_MS = 60_000;
// Success and failure both wait five minutes. Recording attempts before network work
// keeps a failing provider record from repeatedly displacing untouched contracts.
const RETRY_MINUTES = 5;
const ADVISORY_LOCK = 2220910;
let running = false;

type Candidate = { id: string; wca_id: string };

/** Reconcile provider state or retry an existing cancellation intent; never charge. */
export async function runMembershipContractSyncOnce(): Promise<void> {
  if (process.env.WECHAT_PAPAY_SYNC_ENABLED !== 'true' || running) return;
  running = true;
  let connection: Awaited<ReturnType<typeof sql.reserve>> | undefined;
  let locked = false;
  try {
    connection = await sql.reserve();
    const [lock] = await connection<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${ADVISORY_LOCK}) AS locked`;
    locked = Boolean(lock?.locked);
    if (!locked) return;
    for (let index = 0; index < BATCH_SIZE; index++) {
      if (process.env.WECHAT_PAPAY_SYNC_ENABLED !== 'true') break;
      try {
        const attempt = await withTransaction(async tx => {
          await tx("SET LOCAL lock_timeout = '1000ms'");
          // Lock account first. Busy accounts are skipped, so a stuck foreground
          // transaction cannot keep otherwise eligible accounts behind the queue.
          const [candidate] = await tx<Candidate>(`
            SELECT contract.id, contract.wca_id FROM membership_contracts contract
            JOIN app_users account ON (account.wca_id = contract.wca_id OR 'u' || account.id::text = contract.wca_id)
            WHERE account.merged_into_user_id IS NULL AND contract.state IN ('pending', 'active')
              AND (contract.last_sync_attempt_at IS NULL OR contract.last_sync_attempt_at <= now() - make_interval(mins => ?))
            ORDER BY contract.last_sync_attempt_at ASC NULLS FIRST, contract.id ASC
            LIMIT 1 FOR UPDATE OF account SKIP LOCKED`, [RETRY_MINUTES]);
          if (!candidate) return null;
          const [row] = await tx<{ cancellation_requested_at: Date | string | null }>(`
            UPDATE membership_contracts SET last_sync_attempt_at = now()
            WHERE id = ? AND wca_id = ? AND state IN ('pending', 'active')
              AND (last_sync_attempt_at IS NULL OR last_sync_attempt_at <= now() - make_interval(mins => ?))
            RETURNING cancellation_requested_at`, [candidate.id, candidate.wca_id, RETRY_MINUTES]);
          return row ? { ...candidate, cancellationRequested: Boolean(row.cancellation_requested_at) } : null;
        });
        if (!attempt) break;
        await synchronizeMembershipContract(attempt.id, attempt.wca_id, attempt.cancellationRequested);
      } catch {
        // No provider payload, identity, or credential values in background logs.
        console.warn('[membership-contract-sync] contract reconciliation deferred');
      }
    }
  } catch {
    console.warn('[membership-contract-sync] reconciliation unavailable');
  } finally {
    try {
      if (locked && connection) await connection`SELECT pg_advisory_unlock(${ADVISORY_LOCK})`;
    } catch {
      console.warn('[membership-contract-sync] advisory lock connection unavailable');
    } finally {
      connection?.release();
      running = false;
    }
  }
}

export function startMembershipContractSync(): () => void {
  if (process.env.WECHAT_PAPAY_SYNC_ENABLED !== 'true') return () => {};
  void runMembershipContractSyncOnce();
  const timer = setInterval(() => void runMembershipContractSyncOnce(), INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
