import { safeNext } from './safe-next';

const KEY = 'cuberoot.membership-return';
const MAX_AGE = 2 * 60 * 60 * 1000;

/** Only product pages may be return destinations; never loop through auth/checkout. */
export function membershipReturnPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const path = safeNext(raw);
  if (!path || /^\/(?:zh\/|en\/)?(?:account|membership)(?:[/?#]|$)/.test(path)) return null;
  return path;
}

export function membershipEntryHref(path: string): string {
  const next = membershipReturnPath(path);
  const prefix = path.startsWith('/zh/') ? '/zh' : '';
  return `${prefix}/membership${next ? `?next=${encodeURIComponent(next)}` : ''}`;
}

/** Tab-local, account-bound continuation survives the payment provider's fixed return URL. */
export function rememberMembershipReturn(path: string, uid: number): void {
  const next = membershipReturnPath(path);
  if (!next) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ next, uid, at: Date.now() })); } catch { /* URL remains the fallback. */ }
}

export function readMembershipReturn(uid: number): string | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!value || value.uid !== uid || typeof value.at !== 'number' || Date.now() - value.at > MAX_AGE || value.at > Date.now()) {
      clearMembershipReturn();
      return null;
    }
    return membershipReturnPath(value.next);
  } catch { return null; }
}

export function clearMembershipReturn(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* unavailable storage */ }
}
