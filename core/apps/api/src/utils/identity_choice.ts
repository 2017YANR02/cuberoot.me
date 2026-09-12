import crypto from 'node:crypto';
import { sql, transactionQuery } from '../db/connection.js';
import {
  addIdentity, getUserById, IdentityNotFoundError, loginWithIdentity,
  type AppleIdentityCredential,
} from './account.js';

export const IDENTITY_CHOICE_TTL_SECONDS = 15 * 60;
export type ChoiceProvider = 'apple' | 'google' | 'wechat' | 'qq' | 'alipay' | 'wca';
type IdentityProfile = Parameters<typeof loginWithIdentity>[2];
type VerifiedIdentity = {
  provider: ChoiceProvider;
  providerUid: string;
  profile: IdentityProfile;
  appleCredential?: AppleIdentityCredential;
};
type PendingRow = {
  provider: ChoiceProvider;
  provider_uid: string;
  profile: IdentityProfile;
  apple_refresh_token_encrypted: Buffer | null;
  apple_token_key_version: number | null;
};

export class IdentityChoiceError extends Error {
  constructor(public readonly code: 'INVALID_IDENTITY_TICKET' | 'IDENTITY_CONFLICT' | 'ACCOUNT_CHANGED') {
    super(code === 'INVALID_IDENTITY_TICKET' ? 'identity ticket expired or already used'
      : code === 'IDENTITY_CONFLICT' ? 'identity already linked to another account'
        : 'account changed; sign in again');
  }
}

function ticketHash(ticket: string): string {
  return crypto.createHash('sha256').update(ticket).digest('hex');
}

/** An abandoned attempt expires, not an existing account or the provider's grant. */
export async function cleanupIdentityChoices(): Promise<void> {
  await sql`DELETE FROM auth_identity_pending WHERE ticket_hash IN (
    SELECT ticket_hash FROM auth_identity_pending WHERE expires_at <= NOW()
    ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED
  )`;
}

export function startIdentityChoiceCleanup(): void {
  const tick = () => { void cleanupIdentityChoices().catch(() => {
    // Never log pending tickets, subjects or encrypted provider credentials.
    console.error('[auth] pending identity cleanup failed');
  }); };
  tick();
  setInterval(tick, 60_000).unref();
}

/** Every website provider uses this gate after verifying its own credential. */
export async function beginIdentityLogin(identity: VerifiedIdentity) {
  try {
    return await loginWithIdentity(identity.provider, identity.providerUid, identity.profile,
      identity.appleCredential, { createIfMissing: false });
  } catch (error) {
    if (!(error instanceof IdentityNotFoundError)) throw new Error('account service unavailable; please retry');
  }
  const ticket = crypto.randomBytes(32).toString('base64url');
  await sql`INSERT INTO auth_identity_pending (
    ticket_hash, provider, provider_uid, profile, apple_refresh_token_encrypted,
    apple_token_key_version, expires_at
  ) VALUES (
    ${ticketHash(ticket)}, ${identity.provider}, ${identity.providerUid},
    ${sql.json(identity.profile)}, ${identity.appleCredential?.encryptedToken ?? null},
    ${identity.appleCredential?.keyVersion ?? null},
    NOW() + make_interval(secs => ${IDENTITY_CHOICE_TTL_SECONDS})
  )`.catch(() => { throw new Error('account service unavailable; please retry'); });
  return {
    code: 'ACCOUNT_CHOICE_REQUIRED' as const,
    error: 'Choose whether to create an account or link an existing account',
    pending: { ticket, provider: identity.provider, expiresInSeconds: IDENTITY_CHOICE_TTL_SECONDS },
  };
}

/** Consumption and all identity/account/Apple credential writes commit together. */
export async function completeIdentityChoice(ticket: string, action: 'create' | 'link', expectedUid?: number) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
  return await sql.begin(async (tx) => {
    // Both actions lock the attempt first, then the account (including raced create → existing login).
    const rows = await tx`SELECT provider, provider_uid, profile, apple_refresh_token_encrypted,
      apple_token_key_version FROM auth_identity_pending
      WHERE ticket_hash = ${ticketHash(ticket)} AND expires_at > NOW() FOR UPDATE`;
    const pending = rows[0] as PendingRow | undefined;
    if (!pending) throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
    if (action === 'link') {
      if (!Number.isSafeInteger(expectedUid) || (expectedUid ?? 0) <= 0) throw new IdentityChoiceError('ACCOUNT_CHANGED');
      const accounts = await tx`SELECT id FROM app_users
        WHERE id = ${expectedUid!} AND merged_into_user_id IS NULL FOR UPDATE`;
      if (!accounts.length) throw new IdentityChoiceError('ACCOUNT_CHANGED');
    }
    const credential = pending.provider === 'apple' ? {
      encryptedToken: pending.apple_refresh_token_encrypted!,
      keyVersion: pending.apple_token_key_version!,
    } : undefined;
    let result;
    if (action === 'create') {
      result = await loginWithIdentity(pending.provider, pending.provider_uid, pending.profile,
        credential, { transaction: tx });
    } else {
      const status = await addIdentity(expectedUid!, pending.provider, pending.provider_uid,
        pending.profile.wcaId, pending.profile.name, pending.profile.avatar,
        pending.profile.countryIso2, credential, tx);
      if (status !== 'ok') throw new IdentityChoiceError('IDENTITY_CONFLICT');
      const user = await getUserById(expectedUid!, transactionQuery(tx));
      if (!user || user.id !== expectedUid) throw new IdentityChoiceError('ACCOUNT_CHANGED');
      result = { user, isNew: false };
    }
    await tx`DELETE FROM auth_identity_pending WHERE ticket_hash = ${ticketHash(ticket)}`;
    return result;
  });
}
