import { query, type QueryRunner } from '../db/connection.js';

/** Enterprise purchasing follows the same owner/admin boundary as verification management. */
export async function canPurchaseEnterpriseMembership(owner: string, run: QueryRunner = query): Promise<boolean> {
  const [row] = await run<{ eligible: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM app_users u
    JOIN organization_members m ON m.user_id = u.id
    JOIN organizations o ON o.id = m.organization_id
    JOIN enterprise_verification_applications a ON a.organization_id = o.id
    WHERE (u.wca_id = ? OR 'u' || u.id::text = ?) AND u.merged_into_user_id IS NULL
      AND m.status = 'active' AND m.role IN ('owner', 'admin')
      AND o.status = 'active' AND a.status = 'verified'
  ) AS eligible`, [owner, owner]);
  return row?.eligible === true;
}
