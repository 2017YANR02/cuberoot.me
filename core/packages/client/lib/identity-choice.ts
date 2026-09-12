'use client';

import { useSyncExternalStore } from 'react';
import { decodeIdentityChoicePending, IDENTITY_CHOICE_PROVIDERS, type PendingIdentity } from '@cuberoot/shared/auth/web-session';

export type { PendingIdentity } from '@cuberoot/shared/auth/web-session';

const KEY = 'cuberoot_pending_identity';
export interface IdentityChoice extends Omit<PendingIdentity, 'expiresInSeconds'> {
  expiresAt: number;
  returnPath: string;
  stage: 'choose' | 'authenticate' | 'confirm';
  expectedUid?: number;
  otherIdentityRejected?: boolean;
}

export class AccountChoiceRequired extends Error {
  constructor(readonly pending: PendingIdentity) { super('ACCOUNT_CHOICE_REQUIRED'); }
}

/** Only the server's explicit, validated 409 envelope can start this workflow. */
export function accountChoiceError(status: number, data: unknown): AccountChoiceRequired | null {
  const pending = status === 409 ? decodeIdentityChoicePending(data) : null;
  return pending ? new AccountChoiceRequired(pending) : null;
}

export function identityReturnPath(value: string, currentHref = window.location.href): string {
  try {
    const current = new URL(currentHref);
    const target = new URL(value, current);
    if (target.origin !== current.origin || target.pathname.startsWith('//')
      || /^\/auth\/(?:callback|social\/callback)/.test(target.pathname)) return '/account';
    return target.pathname + target.search + target.hash;
  } catch { return '/account'; }
}

let cachedRaw: string | null = null;
let cached: IdentityChoice | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function getIdentityChoice(): IdentityChoice | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null;
  try { raw = sessionStorage.getItem(KEY); } catch { return null; }
  if (raw !== cachedRaw) {
    cachedRaw = raw; cached = null;
    try {
      const value = JSON.parse(raw ?? 'null') as IdentityChoice | null;
      if (value && typeof value.ticket === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.ticket) && IDENTITY_CHOICE_PROVIDERS.includes(value.provider)
        && Number.isFinite(value.expiresAt) && value.expiresAt <= Date.now() + 900_000
        && typeof value.returnPath === 'string' && value.returnPath === identityReturnPath(value.returnPath)
        && ['choose', 'authenticate', 'confirm'].includes(value.stage)
        && (value.stage !== 'confirm' || value.expectedUid !== undefined)
        && (value.expectedUid === undefined || (Number.isSafeInteger(value.expectedUid) && value.expectedUid > 0))) cached = value;
    } catch { /* malformed browser state is not an authorization */ }
  }
  return cached && cached.expiresAt > Date.now() ? cached : null;
}

function write(value: IdentityChoice): void {
  const raw = JSON.stringify(value);
  sessionStorage.setItem(KEY, raw);
  if (sessionStorage.getItem(KEY) !== raw) throw new Error('account choice requires browser storage');
  cachedRaw = raw; cached = value; emit();
}

export function rememberIdentityChoice(error: AccountChoiceRequired, returnPath: string): void {
  const existing = getIdentityChoice();
  if (existing) {
    // A second unknown provider is not a request to abandon the first identity
    // or create another account while authenticating an existing one.
    write({ ...existing, otherIdentityRejected: true });
    return;
  }
  write({ ticket: error.pending.ticket, provider: error.pending.provider, expiresAt: Date.now() + error.pending.expiresInSeconds * 1000,
    returnPath: identityReturnPath(returnPath), stage: 'choose' });
}

export function updateIdentityChoice(ticket: string, update: Partial<Pick<IdentityChoice, 'stage' | 'expectedUid' | 'otherIdentityRejected'>>): void {
  const current = getIdentityChoice();
  if (current?.ticket === ticket) write({ ...current, ...update });
}

export function clearIdentityChoice(ticket?: string): void {
  if (ticket && cached?.ticket !== ticket) return;
  try { sessionStorage.removeItem(KEY); } catch { /* unavailable storage cannot authorize a pending operation */ }
  cached = null; cachedRaw = null; emit();
}

export function useIdentityChoice(): IdentityChoice | null {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getIdentityChoice, () => null);
}

export function identityChoiceEntryPath(): string {
  // OAuth callbacks themselves are language-neutral. Keep the initiating page's
  // language across the choice and second-provider authentication screens.
  const original = new URL(getIdentityChoice()?.returnPath ?? window.location.href, window.location.href);
  return original.pathname === '/zh' || original.pathname.startsWith('/zh/') || original.searchParams.get('lang') === 'zh'
    ? '/zh/account' : '/account';
}
export const existingAccountRequired = () => getIdentityChoice()?.stage === 'authenticate';
