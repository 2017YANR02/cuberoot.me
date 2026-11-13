import { type PlatformDb, platformQuery } from '../db.js';

// Both consumers bind the membership row as "membership". Legacy rows without
// a ledger retain their date range; ledger-backed access follows actual grants.
export const ACTIVE_MEMBERSHIP_PREDICATE = `
  membership.status = 'active'
  AND membership.valid_from <= NOW()
  AND (membership.valid_until IS NULL OR membership.valid_until > NOW())
  AND (
    NOT EXISTS (
      SELECT 1 FROM platform_membership_ledger WHERE membership_id = membership.id
    )
    OR EXISTS (
      SELECT 1 FROM platform_membership_ledger grant_entry
      WHERE grant_entry.membership_id = membership.id AND grant_entry.delta_access = 1
        AND grant_entry.valid_from <= NOW()
        AND (grant_entry.valid_until IS NULL OR grant_entry.valid_until > NOW())
        AND NOT EXISTS (
          SELECT 1 FROM platform_membership_ledger reversal
          WHERE reversal.reversal_of_ledger_id = grant_entry.id
        )
    )
  )
`;

export async function hasMembership(db: PlatformDb, userId: number): Promise<boolean> {
  const rows = await platformQuery<{ active: boolean }>(db, `
    SELECT EXISTS (
      SELECT 1 FROM platform_memberships membership
      WHERE membership.user_id = $1 AND ${ACTIVE_MEMBERSHIP_PREDICATE}
    ) AS active
  `, [userId]);
  return rows[0]?.active === true;
}
