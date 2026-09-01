import { createHash } from 'node:crypto';
import { conflict, notFound } from './errors.js';
import { platformQuery, type PlatformDb } from './db.js';

export function physicalBundleCredentialHash(credential: string): string {
  return createHash('sha256').update(credential.trim().toUpperCase(), 'utf8').digest('hex');
}

export async function revokePhysicalBundleInvite(
  db: PlatformDb,
  id: string,
  reason: string,
  actor: { userId: number | null; ownerKey: string },
): Promise<Record<string, unknown>> {
  const invites = await platformQuery<{
    id: string; status: string; distribution_type: string; revoked_at: string | null; revoked_reason: string;
  }>(db, `
    SELECT id::text, status, distribution_type, revoked_at, revoked_reason
    FROM platform_invite_codes WHERE id = $1::uuid FOR UPDATE
  `, [id]);
  const invite = invites[0];
  if (!invite) notFound('Physical bundle code');
  if (invite.distribution_type !== 'physical_bundle') conflict('Only physical bundle codes can use this revocation flow');
  if (invite.status === 'revoked') {
    return { id, status: invite.status, revokedAt: invite.revoked_at, revokedReason: invite.revoked_reason };
  }

  const redemptions = await platformQuery<{
    entitlement_id: string | null; entitlement_grant_ledger_id: string | null;
  }>(db, `
    SELECT entitlement_id::text, entitlement_grant_ledger_id::text
    FROM platform_invite_redemptions WHERE invite_code_id = $1::uuid FOR UPDATE
  `, [id]);
  const redemption = redemptions[0];
  if (redemption?.entitlement_id) {
    if (!redemption.entitlement_grant_ledger_id) {
      conflict('Redeemed physical bundle code is missing its entitlement ledger reference');
    }
    await platformQuery(db, `
      INSERT INTO platform_entitlement_ledger (
        entitlement_id, entry_type, delta_access, valid_from, valid_until,
        reversal_of_ledger_id, reason, actor_user_id, actor_key
      )
      SELECT entitlement_id, 'reversal', -delta_access, valid_from, valid_until,
             id, $2, $3, $4
      FROM platform_entitlement_ledger WHERE id = $1::uuid
    `, [redemption.entitlement_grant_ledger_id, reason, actor.userId, actor.ownerKey]);
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
    `, [redemption.entitlement_id]);
  }

  const rows = await platformQuery(db, `
    UPDATE platform_invite_codes
    SET status = 'revoked', revoked_at = NOW(), revoked_reason = $2,
        revoked_by_user_id = $3, revoked_by_actor_key = $4
    WHERE id = $1::uuid
    RETURNING id::text, status, revoked_at AS "revokedAt", revoked_reason AS "revokedReason"
  `, [id, reason, actor.userId, actor.ownerKey]);
  return { ...rows[0], entitlementReversed: Boolean(redemption?.entitlement_id) };
}
