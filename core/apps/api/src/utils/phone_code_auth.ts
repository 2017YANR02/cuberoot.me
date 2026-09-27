import { transactionQuery } from '../db/connection.js';
import { addIdentity, findUserByIdentity, IdentityNotFoundError, issueCode, loginWithIdentity,
  markCodeDelivery, replaceCredentialIdentity, withVerifiedCode } from './account.js';
import { beginIdentityLogin } from './identity_choice.js';
import { sendSmsCode } from './sms.js';

export class PhoneCodeActionError extends Error {
  constructor(public readonly code: 'send_failed' | 'conflict' | 'has-phone' | 'none') {
    super(code);
  }
}

/** Provider I/O stays outside the transaction; only an accepted reservation can be verified. */
export async function issuePhoneCode(target: string, purpose: 'login' | 'link' | 'password_reset') {
  const issued = await issueCode('phone', target, purpose, undefined, { deliveryStatus: 'pending' });
  if ('error' in issued) return issued;
  try {
    await sendSmsCode(target, issued.code);
    if (!await markCodeDelivery(issued.id, 'sent')) throw new Error('reservation superseded');
  } catch (error) {
    console.error('[auth] sms send failed:', error instanceof Error ? error.message : error);
    try { await markCodeDelivery(issued.id, 'failed'); } catch { /* Pending stays unusable. */ }
    throw new PhoneCodeActionError('send_failed');
  }
  return { ok: true as const };
}

export function loginWithPhoneCode(target: string, code: string, existingOnly: boolean) {
  const profile = { name: `尾号${target.slice(-4)}` };
  return withVerifiedCode('phone', target, 'login', code, transaction => existingOnly
    ? loginWithIdentity('phone', target, profile, undefined, { createIfMissing: false, transaction })
    : beginIdentityLogin({ provider: 'phone', providerUid: target, profile }, { transaction }));
}

export function resetPasswordWithPhoneCode(target: string, code: string) {
  return withVerifiedCode('phone', target, 'password_reset', code, async transaction => {
    const user = await findUserByIdentity('phone', target, transactionQuery(transaction));
    if (!user) throw new IdentityNotFoundError();
    return user;
  });
}

export function bindPhoneWithCode(userId: number, target: string, code: string, replace = false) {
  return withVerifiedCode('phone', target, 'link', code, async transaction => {
    const result = replace
      ? await replaceCredentialIdentity(userId, 'phone', target, transaction)
      : await addIdentity(userId, 'phone', target, undefined, undefined, undefined, undefined, undefined, transaction);
    if (result !== 'ok') throw new PhoneCodeActionError(result === 'has-email' ? 'conflict' : result);
    return result;
  });
}
