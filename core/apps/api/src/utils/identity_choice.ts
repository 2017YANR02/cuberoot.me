import crypto from 'node:crypto';
import type { PendingIdentity } from '@cuberoot/shared/auth/web-session';
import { sql, transactionQuery } from '../db/connection.js';
import {
  addIdentity, findUserByIdentity, getUserById, IdentityNotFoundError, loginWithIdentity, issueCode, verifyCode, isValidPhone,
  type AppleIdentityCredential,
} from './account.js';

export const IDENTITY_CHOICE_TTL_SECONDS = 15 * 60;
export type ChoiceProvider = PendingIdentity['provider'];
type IdentityProfile = Parameters<typeof loginWithIdentity>[2] & {
  /** Server-only paired proof; never serialized into the public pending envelope. */
  wechatPhone?: { phone: string; accountUid: number | null };
};
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
  constructor(public readonly code: 'INVALID_IDENTITY_TICKET' | 'INVALID_IDENTITY_LINK_CODE' | 'IDENTITY_CONFLICT' | 'ACCOUNT_CHANGED' | 'ACCOUNT_HAS_EMAIL' | 'ACCOUNT_HAS_PHONE') {
    super(code === 'INVALID_IDENTITY_TICKET' ? 'identity ticket expired or already used'
      : code === 'INVALID_IDENTITY_LINK_CODE' ? 'wrong or expired account linking code'
      : code === 'ACCOUNT_HAS_EMAIL' ? 'account already has an email; change it in account settings'
      : code === 'ACCOUNT_HAS_PHONE' ? 'account already has a phone; change it in account settings'
      : code === 'IDENTITY_CONFLICT' ? 'identity already linked to another account'
        : 'account changed; sign in again');
  }
}

/** A separately scoped capability: never accepts account-merge codes. */
function parseIdentityLinkCode(raw: string) {
  const match = /^L([1-9]\d*)-([0-9]{6})$/.exec(raw.trim());
  if (!match || !Number.isSafeInteger(Number(match[1]))) throw new IdentityChoiceError('INVALID_IDENTITY_LINK_CODE');
  return { uid: Number(match[1]), code: match[2] };
}

export async function issueIdentityLinkCode(uid: number) {
  return sql.begin(async (tx) => {
    // Serialize issuance per account across instances without reversing completion's code/account lock order.
    await tx`SELECT pg_advisory_xact_lock(hashtext('identity-link-code'), hashtext(${String(uid)}))`;
    const accounts = await tx`SELECT id FROM app_users WHERE id = ${uid} AND merged_into_user_id IS NULL`;
    if (!accounts.length) throw new IdentityChoiceError('ACCOUNT_CHANGED');
    const issued = await issueCode('id_link', String(uid), 'identity_link', transactionQuery(tx));
    return 'error' in issued ? issued : { linkCode: `L${uid}-${issued.code}`, expiresInSeconds: 600 };
  });
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

/** Every login provider uses this gate after verifying its own credential. */
export async function beginIdentityLogin(identity: VerifiedIdentity) {
  try {
    return await loginWithIdentity(identity.provider, identity.providerUid, identity.profile,
      identity.appleCredential, { createIfMissing: false });
  } catch (error) {
    if (!(error instanceof IdentityNotFoundError)) throw new Error('account service unavailable; please retry');
  }
  return queueIdentityChoice(identity);
}

/** Both proofs are already checked against WeChat before reaching the account boundary. */
export async function beginWechatPhoneIdentityLogin(unionid: string, phone: string) {
  if (!isValidPhone(phone)) throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
  const [wechatUser, phoneUser] = await Promise.all([
    findUserByIdentity('wechat', unionid), findUserByIdentity('phone', phone),
  ]);
  if (wechatUser) {
    if (phoneUser && phoneUser.id !== wechatUser.id) throw new IdentityChoiceError('IDENTITY_CONFLICT');
    // Already-linked identities need no new grant; do not silently add/change their phone.
    return { user: wechatUser, isNew: false };
  }
  const result = await queueIdentityChoice({ provider: 'wechat', providerUid: unionid,
    profile: { name: '', wechatPhone: { phone, accountUid: phoneUser?.id ?? null } } });
  return { ...result, pending: { ...result.pending,
    ...(phoneUser ? { phoneAccount: { id: phoneUser.id, displayName: phoneUser.display_name } } : {}),
  } };
}

async function queueIdentityChoice(identity: VerifiedIdentity) {
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
export async function completeIdentityChoice(ticket: string, action: 'create' | 'link' | 'link_with_code' | 'link_verified_phone', expectedUid?: number, linkCode?: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
  const parsed = action === 'link_with_code' ? parseIdentityLinkCode(linkCode ?? '') : undefined;
  if (parsed && parsed.uid !== expectedUid) throw new IdentityChoiceError('ACCOUNT_CHANGED');
  const result = await sql.begin(async (tx) => {
    // Both actions lock the attempt first, then the account (including raced create → existing login).
    const rows = await tx`SELECT provider, provider_uid, profile, apple_refresh_token_encrypted,
      apple_token_key_version FROM auth_identity_pending
      WHERE ticket_hash = ${ticketHash(ticket)} AND expires_at > NOW() FOR UPDATE`;
    const pending = rows[0] as PendingRow | undefined;
    if (!pending) throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
    const phoneProof = pending.provider === 'wechat' ? pending.profile.wechatPhone : undefined;
    if (phoneProof) {
      if (!isValidPhone(phoneProof.phone)) throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
      // Different tickets for the same pair serialize before account locks; SQL unique indexes
      // still defend writes by other identity entry points that do not take these advisory locks.
      for (const identity of [`phone:${phoneProof.phone}`, `wechat:${pending.provider_uid}`].sort()) {
        await tx`SELECT pg_advisory_xact_lock(hashtext('wechat-phone-choice'), hashtext(${identity}))`;
      }
      const phoneOwner = await findUserByIdentity('phone', phoneProof.phone, transactionQuery(tx));
      if (action === 'create' && (phoneOwner || phoneProof.accountUid !== null)) throw new IdentityChoiceError('IDENTITY_CONFLICT');
      if (action === 'link_verified_phone' && (!phoneOwner || phoneOwner.id !== expectedUid
        || phoneProof.accountUid !== expectedUid)) throw new IdentityChoiceError('ACCOUNT_CHANGED');
      if (action !== 'create' && phoneOwner && phoneOwner.id !== expectedUid) throw new IdentityChoiceError('IDENTITY_CONFLICT');
    } else if (action === 'link_verified_phone') throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
    if (action !== 'create') {
      if (!Number.isSafeInteger(expectedUid) || (expectedUid ?? 0) <= 0) throw new IdentityChoiceError('ACCOUNT_CHANGED');
      if (parsed) {
        if (pending.provider !== 'douyin' && !phoneProof) throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
        // A wrong guess must commit its attempt count; do not throw inside this transaction.
        if (!await verifyCode('id_link', String(parsed.uid), 'identity_link', parsed.code, { transaction: tx })) return null;
      }
      const accounts = await tx`SELECT id FROM app_users
        WHERE id = ${expectedUid!} AND merged_into_user_id IS NULL FOR UPDATE`;
      if (!accounts.length) throw new IdentityChoiceError('ACCOUNT_CHANGED');
      // A concurrent unlink/merge uses the same account lock. Recheck after acquiring it.
      if (action === 'link_verified_phone') {
        const owner = await findUserByIdentity('phone', phoneProof!.phone, transactionQuery(tx));
        if (owner?.id !== expectedUid) throw new IdentityChoiceError('ACCOUNT_CHANGED');
      }
    }
    const credential = pending.provider === 'apple' ? {
      encryptedToken: pending.apple_refresh_token_encrypted!,
      keyVersion: pending.apple_token_key_version!,
    } : undefined;
    let result;
    if (action === 'create') {
      result = await loginWithIdentity(pending.provider, pending.provider_uid, pending.profile,
        credential, { transaction: tx });
      // The confirmed action was creation, not adding a phone to an account linked by a race.
      if (phoneProof && !result.isNew) throw new IdentityChoiceError('ACCOUNT_CHANGED');
    } else {
      const status = await addIdentity(expectedUid!, pending.provider, pending.provider_uid,
        pending.profile.wcaId, pending.profile.name, pending.profile.avatar,
        pending.profile.countryIso2, credential, tx);
      if (status !== 'ok') throw new IdentityChoiceError(status === 'has-email' ? 'ACCOUNT_HAS_EMAIL'
        : status === 'has-phone' ? 'ACCOUNT_HAS_PHONE' : 'IDENTITY_CONFLICT');
      const user = await getUserById(expectedUid!, transactionQuery(tx));
      if (!user || user.id !== expectedUid) throw new IdentityChoiceError('ACCOUNT_CHANGED');
      result = { user, isNew: false };
    }
    if (phoneProof) {
      const status = await addIdentity(result.user.id, 'phone', phoneProof.phone,
        undefined, undefined, undefined, undefined, undefined, tx);
      if (status !== 'ok') throw new IdentityChoiceError(status === 'has-phone' ? 'ACCOUNT_HAS_PHONE' : 'IDENTITY_CONFLICT');
    }
    await tx`DELETE FROM auth_identity_pending WHERE ticket_hash = ${ticketHash(ticket)}`;
    // Linking must not turn an existing session into a password-reset grant.
    // Only the explicitly created email account retains the verified-email setup grant.
    return { ...result, ...(action === 'create' && result.isNew && pending.provider === 'email'
      ? { amr: 'email_code' as const } : {}) };
  });
  if (!result) throw new IdentityChoiceError('INVALID_IDENTITY_LINK_CODE');
  return result;
}

/** Reveal only the proved target; preview neither creates accounts nor consumes a valid code. */
export async function previewIdentityLinkCode(ticket: string, linkCode: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
  const parsed = parseIdentityLinkCode(linkCode);
  const result = await sql.begin(async (tx) => {
    const pending = await tx`SELECT provider, profile FROM auth_identity_pending
      WHERE ticket_hash = ${ticketHash(ticket)} AND expires_at > NOW() FOR UPDATE`;
    if (pending[0]?.provider !== 'douyin' && !(pending[0]?.provider === 'wechat' && pending[0]?.profile?.wechatPhone)) throw new IdentityChoiceError('INVALID_IDENTITY_TICKET');
    if (!await verifyCode('id_link', String(parsed.uid), 'identity_link', parsed.code, { transaction: tx, consume: false })) return null;
    const accounts = await tx`SELECT id, display_name FROM app_users
      WHERE id = ${parsed.uid} AND merged_into_user_id IS NULL FOR UPDATE`;
    if (!accounts.length) throw new IdentityChoiceError('ACCOUNT_CHANGED');
    return { user: { id: Number(accounts[0].id), displayName: String(accounts[0].display_name) } };
  });
  if (!result) throw new IdentityChoiceError('INVALID_IDENTITY_LINK_CODE');
  return result;
}
