import { apiUrl } from './api-base';
import { tr } from '@/i18n/tr';

let pending: Promise<void> | undefined;
let validUntil = 0;

export class CompetitionVerificationRequired extends Error {}

/** Ask the API whether this browser needs the manual image form. */
export function ensureCompetitionAccess(): Promise<void> {
  if (Date.now() < validUntil) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const check = await fetch(apiUrl('/v1/competition-access/check'), { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (check.ok) { validUntil = Date.now() + 60_000; return; }
    if (check.status !== 403) throw new Error(tr({ en: 'Verification is temporarily unavailable. Please retry.', zh: '验证暂时不可用，请重试。' }));
    if (typeof window !== 'undefined') {
      const returnTo = window.location.pathname + window.location.search + window.location.hash;
      const prefix = window.location.pathname.startsWith('/zh/') ? '/zh' : '';
      window.location.assign(prefix + '/competition-verify?returnTo=' + encodeURIComponent(returnTo));
    }
    throw new CompetitionVerificationRequired(tr({ en: 'Enter the image code to continue.', zh: '请输入图片验证码后继续。' }));
  })().finally(() => { pending = undefined; });
  return pending;
}

export async function competitionFetch(url: string, init?: RequestInit, snapshotUrl?: string): Promise<Response> {
  const options = { ...init, credentials: 'include' as const };
  const response = await fetch(url, options);
  const body = response.status === 403 ? await response.clone().json().catch(() => null) : null;
  if (snapshotUrl && (body?.scope === 'competition' || response.status === 429)) {
    const timeout = AbortSignal.timeout(4000);
    const signal = init?.signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([init.signal, timeout]) : init?.signal ?? timeout;
    const snapshot = await fetch(snapshotUrl, { cache: 'force-cache', signal }).catch(() => null);
    if (snapshot?.ok && snapshot.headers.get('content-type')?.includes('application/json')) return snapshot;
    if (init?.signal?.aborted) throw init.signal.reason;
  }
  if (body?.code !== 'competition_verification_required') return response;
  validUntil = 0;
  await ensureCompetitionAccess();
  if (init?.signal?.aborted) throw init.signal.reason;
  return fetch(url, options);
}
