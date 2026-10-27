import { randomBytes } from 'node:crypto';
import { platformQuery, enqueuePlatformEvent, type PlatformDb, type PlatformMutationResult } from './db.js';
import type { PlatformActor } from './auth.js';
import { badRequest, conflict, notFound } from './errors.js';
import { decryptPlatformPrivateData } from './data_encryption.js';
import { validateWechatPayout } from './wechat_payout.js';

function safeSignedMoney(value: number | string, label = 'amount') {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) badRequest(`${label} is outside the supported range`);
  return amount;
}
function payoutNumber() { return `PLT-PO-${randomBytes(8).toString('hex').toUpperCase()}`; }

/** Admin and instructor requests reserve the same signed ledger entries atomically. */
export async function createInstructorPayout(db: PlatformDb, actor: PlatformActor, instructorId: string, currency: string, expected?: { amountMinor: number; method: string }): Promise<PlatformMutationResult> {
  const instructors = await platformQuery<{
    id: string; user_id: number; payout_profile_encrypted: Buffer | null; payout_key_version: number | null;
  }>(db, `
    SELECT id::text, user_id, payout_profile_encrypted, payout_key_version
    FROM platform_instructors WHERE id = $1::uuid AND status = 'active' FOR UPDATE
  `, [instructorId]);
  const instructor = instructors[0];
  if (!instructor) notFound('Instructor');
  if (!instructor.payout_profile_encrypted || instructor.payout_key_version == null) {
    conflict('Instructor payout profile is not configured');
  }
  const ledger = await platformQuery<{ id: string; delta_amount_minor: number | string }>(db, `
    SELECT revenue.id::text, revenue.delta_amount_minor
    FROM platform_instructor_revenue_ledger revenue
    WHERE revenue.instructor_id = $1::uuid AND revenue.currency = $2
      AND NOT EXISTS (
        SELECT 1 FROM platform_instructor_payout_items item
        WHERE item.revenue_ledger_id = revenue.id AND item.released_at IS NULL
      )
    ORDER BY revenue.created_at, revenue.id
    FOR UPDATE OF revenue
  `, [instructorId, currency]);
  if (!ledger.length) conflict('No unsettled instructor revenue is available');
  const amountMinor = ledger.reduce((sum, entry) => sum + safeSignedMoney(entry.delta_amount_minor, 'revenue amount'), 0);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) conflict('No positive payout balance is available');
  const profile = decryptPlatformPrivateData(Buffer.from(instructor.payout_profile_encrypted), instructor.payout_key_version);
  if (expected && (amountMinor !== expected.amountMinor || profile.method !== expected.method)) conflict('收益或收款方式已变化，请刷新后重新申请');
  if (profile.method === 'wechat') await validateWechatPayout(db, {
    id: instructorId, status: 'draft', currency, amount_minor: amountMinor, user_id: instructor.user_id,
    payout_profile_snapshot_encrypted: Buffer.from(instructor.payout_profile_encrypted), payout_key_version: instructor.payout_key_version,
  }, amountMinor);
  const payouts = await platformQuery<{ id: string; payout_number: string }>(db, `
    INSERT INTO platform_instructor_payouts (
      instructor_id, payout_number, status, amount_minor, currency,
      payout_profile_snapshot_encrypted, payout_key_version
    ) VALUES ($1::uuid, $2, 'draft', $3, $4, $5, $6)
    RETURNING id::text, payout_number
  `, [instructorId, payoutNumber(), amountMinor, currency,
    Buffer.from(instructor.payout_profile_encrypted), instructor.payout_key_version]);
  const payout = payouts[0]!;
  for (const entry of ledger) {
    await platformQuery(db, `
      INSERT INTO platform_instructor_payout_items (payout_id, revenue_ledger_id, amount_minor, currency)
      VALUES ($1::uuid, $2::uuid, $3, $4)
    `, [payout.id, entry.id, safeSignedMoney(entry.delta_amount_minor, 'revenue amount'), currency]);
  }
  await platformQuery(db, `
    INSERT INTO platform_audit_events (
      actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
    ) VALUES ($1, $2, 'commerce.payout.generate', 'platform_instructor_payout', $3, 'allowed', $4::jsonb)
  `, [actor.userId, actor.ownerKey, payout.id, { instructorId, currency, ledgerEntries: ledger.length }]);
  await enqueuePlatformEvent(db, 'platform.instructor_payout.generated', 'platform_instructor_payout', payout.id,
    `payout:${payout.id}:generated`, { payoutId: payout.id, instructorId, amountMinor, currency });
  return {
    status: 201,
    body: { id: payout.id, payoutNumber: payout.payout_number, instructorId, status: 'draft', amountMinor, currency, itemCount: ledger.length },
    resourceType: 'platform_instructor_payout',
    resourceId: payout.id,
  };
}
