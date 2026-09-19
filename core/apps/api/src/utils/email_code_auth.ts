import { issueCode, markCodeDelivery, withVerifiedCode, loginWithIdentity, addIdentity, replaceCredentialIdentity } from './account.js';
import { beginIdentityLogin } from './identity_choice.js';
import { sendEmailCode } from './email.js';

export class EmailCodeActionError extends Error {
  constructor(public readonly code: 'send_failed' | 'conflict' | 'has-email' | 'none') {
    super(code);
  }
}

/** Provider I/O is outside the transaction; only a successful exact reservation becomes usable. */
export async function issueEmailCode(target: string, purpose: 'login' | 'link', language: 'zh' | 'en') {
  const issued = await issueCode('email', target, purpose, undefined, { deliveryStatus: 'pending' });
  if ('error' in issued) return issued;
  try {
    await sendEmailCode(target, issued.code, language);
    if (!await markCodeDelivery(issued.id, 'sent')) throw new Error('reservation superseded');
  } catch {
    // A storage outage may prevent marking failure; pending remains unusable until expiry.
    try { await markCodeDelivery(issued.id, 'failed'); } catch { /* Do not expose storage details. */ }
    throw new EmailCodeActionError('send_failed');
  }
  return { ok: true as const };
}

/** A new account-choice ticket is part of the same commit as the proof consumption. */
export function loginWithEmailCode(target: string, code: string, existingOnly: boolean) {
  const profile = { name: target.split('@')[0] };
  return withVerifiedCode('email', target, 'login', code, transaction => existingOnly
    ? loginWithIdentity('email', target, profile, undefined, { createIfMissing: false, transaction })
    : beginIdentityLogin({ provider: 'email', providerUid: target, profile }, { transaction }));
}

export function bindEmailWithCode(userId: number, target: string, code: string, replace = false) {
  return withVerifiedCode('email', target, 'link', code, async transaction => {
    const result = replace
      ? await replaceCredentialIdentity(userId, 'email', target, transaction)
      : await addIdentity(userId, 'email', target, undefined, undefined, undefined, undefined, undefined, transaction);
    if (result !== 'ok') throw new EmailCodeActionError(result === 'has-phone' ? 'conflict' : result);
    return result;
  });
}
