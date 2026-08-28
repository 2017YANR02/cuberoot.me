import type { Context } from 'hono';
import { findUserByWcaId } from './account.js';
import { requireAuth } from './recon_helpers.js';

function canonicalUserId(value: unknown): number | null {
  const id = typeof value === 'bigint'
    ? Number(value)
    : typeof value === 'string' && /^[1-9]\d*$/.test(value)
      ? Number(value)
      : value;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Resolve every supported login token to the canonical app_users.id. */
export async function requireAppUserId(c: Context): Promise<number> {
  const user = await requireAuth(c);
  const sessionUserId = canonicalUserId(user.uid);
  if (sessionUserId != null) return sessionUserId;
  if (user.realWcaId) {
    const row = await findUserByWcaId(user.realWcaId);
    const wcaUserId = canonicalUserId(row?.id);
    if (wcaUserId != null) return wcaUserId;
  }
  throw new Error('Authentication required');
}
