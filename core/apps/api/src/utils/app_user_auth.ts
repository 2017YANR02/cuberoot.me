import type { Context } from 'hono';
import { findUserByWcaId } from './account.js';
import { requireAuth } from './recon_helpers.js';

/** Resolve every supported login token to the canonical app_users.id. */
export async function requireAppUserId(c: Context): Promise<number> {
  const user = await requireAuth(c);
  if (user.uid != null) return user.uid;
  if (user.realWcaId) {
    const row = await findUserByWcaId(user.realWcaId);
    if (row) return row.id;
  }
  throw new Error('Authentication required');
}
