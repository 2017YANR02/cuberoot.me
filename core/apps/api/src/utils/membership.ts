import { isAdminWcaId } from '@cuberoot/shared/admin';
import { query } from '../db/connection.js';

/** Canonical member entitlement gate: administrators inherit every member permission. */
export async function hasActiveMembership(wcaId: string): Promise<boolean> {
  if (isAdminWcaId(wcaId)) return true;
  const rows = await query<{ ok: number }>(
    `SELECT 1 AS ok FROM memberships
      WHERE wca_id = ? AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [wcaId],
  );
  return rows.length > 0;
}
