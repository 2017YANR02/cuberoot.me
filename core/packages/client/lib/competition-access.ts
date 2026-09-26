import { apiUrl } from './api-base';
import { tr } from '@/i18n/tr';

let pending: Promise<void> | undefined;
let validUntil = 0;

/** CN visitors, including the Aliyun delivery line, need no Vercel issuer. */
export function ensureCompetitionAccess(): Promise<void> {
  if (Date.now() < validUntil) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const check = await fetch(apiUrl('/v1/competition-access/check'), { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    // The old API has no check route during the staged rollout.
    if (check.ok || check.status === 404) { validUntil = Date.now() + 60_000; return; }
    if (check.status !== 403) throw new Error(tr({ en: 'Verification is temporarily unavailable. Please retry.', zh: '验证暂时不可用，请重试。' }));
    const grant = await fetch('/api/comp/access', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (grant.ok) { validUntil = Date.now() + 60_000; return; }
    if (grant.headers.get('x-vercel-mitigated') === 'challenge' && typeof window !== 'undefined') {
      // A fetch cannot display the checkpoint. Verify as a document, then return.
      const returnTo = window.location.pathname + window.location.search + window.location.hash;
      window.location.assign('/api/comp/access?returnTo=' + encodeURIComponent(returnTo));
    }
    throw new Error(tr({ en: 'Browser verification is required. Open the main website to continue.', zh: '需要浏览器验证，请从主站进入后继续。' }));
  })().finally(() => { pending = undefined; });
  return pending;
}

export async function competitionFetch(url: string, init?: RequestInit): Promise<Response> {
  const options = { ...init, credentials: 'include' as const };
  const response = await fetch(url, options);
  if (response.status !== 403) return response;
  const body = await response.clone().json().catch(() => null);
  if (body?.code !== 'competition_verification_required') return response;
  validUntil = 0;
  await ensureCompetitionAccess();
  if (init?.signal?.aborted) throw init.signal.reason;
  return fetch(url, options);
}
