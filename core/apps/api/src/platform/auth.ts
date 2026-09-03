import type { Context } from 'hono';
import { requireAuth, requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { findUserByWcaId } from '../utils/account.js';
import { PlatformApiError } from './errors.js';

export interface PlatformActor {
  userId: number | null;
  ownerKey: string;
  wcaId: string | null;
  displayName: string;
  isAdmin: boolean;
  viaApiKey: boolean;
}

export async function requirePlatformActor(c: Context): Promise<PlatformActor> {
  let user;
  try {
    user = await requireAuth(c);
  } catch (error) {
    if (error instanceof Error && error.message.includes('suspended')) {
      throw new PlatformApiError('FORBIDDEN', 403, error.message);
    }
    throw new PlatformApiError('UNAUTHENTICATED', 401, 'Authentication required');
  }
  const realWcaId = user.realWcaId
    ?? (/^\d{4}[A-Z]{4}\d{2}$/.test(user.wcaId) ? user.wcaId : undefined);
  const userId = user.uid ?? (realWcaId ? (await findUserByWcaId(realWcaId))?.id : undefined);
  if (userId == null) {
    throw new PlatformApiError(
      'UNAUTHENTICATED',
      401,
      'A CubeRoot account is required for Platform features',
    );
  }
  return {
    userId,
    ownerKey: user.wcaId,
    wcaId: realWcaId ?? null,
    displayName: user.name,
    isAdmin: user.isAdmin,
    viaApiKey: false,
  };
}

export async function requirePlatformAdmin(c: Context): Promise<PlatformActor> {
  if (c.req.header('X-Admin-Key')) {
    try {
      await requireAdminOrApiKey(c);
    } catch {
      throw new PlatformApiError('FORBIDDEN', 403, 'Admin access required');
    }
    return {
      userId: null,
      ownerKey: '__api_key__',
      wcaId: null,
      displayName: 'API Key',
      isAdmin: true,
      viaApiKey: true,
    };
  }
  const actor = await requirePlatformActor(c);
  if (!actor.isAdmin) throw new PlatformApiError('FORBIDDEN', 403, 'Admin access required');
  return actor;
}
