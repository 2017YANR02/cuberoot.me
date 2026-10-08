import { apiUrl, directApiUrl } from './api-base';
import { getWebAccessToken } from './web-session';

const WEB_SESSION_PREFIX = 'web-session:';
const PRIVATE_PAGE_ENDPOINTS = new Set(['/api/admin/interview', '/api/identity-choice']);

function trustedSessionTarget(input: RequestInfo | URL): { url: URL; authSuffix?: string } | null {
  const base = typeof window === 'undefined' ? directApiUrl('/') : window.location.href;
  const target = new URL(input instanceof Request ? input.url : String(input), base);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return null;
  const apiTargets = [new URL(apiUrl('/v1/'), base), new URL(directApiUrl('/v1/'), base)];
  const api = apiTargets.find(api => target.origin === api.origin && target.pathname.startsWith(api.pathname));
  if (api) {
    const path = target.pathname.slice(api.pathname.length);
    return { url: target, ...(path.startsWith('auth/') ? { authSuffix: path.slice('auth/'.length) } : {}) };
  }
  return typeof window !== 'undefined'
    && target.origin === window.location.origin
    && PRIVATE_PAGE_ENDPOINTS.has(target.pathname) ? { url: target } : null;
}

export async function getWebAccessTokenBeforeAbort(marker: string, signal?: AbortSignal | null): Promise<string> {
  signal?.throwIfAborted();
  if (!signal) return getWebAccessToken(marker);
  return new Promise<string>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    void getWebAccessToken(marker).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Resolve the web-only session marker without changing public or native Bearer requests. */
export async function sessionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : null;
  const headers = new Headers(request?.headers);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  const authorization = headers.get('Authorization');
  if (!authorization) return fetch(input, init);
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token?.startsWith(WEB_SESSION_PREFIX)) return fetch(input, init);
  // URL objects are mutable: bind validation and sending to the same URL before awaiting.
  const target = input instanceof URL ? input.href : input;
  const destination = trustedSessionTarget(target);
  if (!destination) throw new Error('Refusing to send session credentials outside the configured API.');
  const signal = init?.signal ?? request?.signal;
  const accessToken = await getWebAccessTokenBeforeAbort(token, signal);
  signal?.throwIfAborted();
  if (!accessToken || accessToken.startsWith(WEB_SESSION_PREFIX)) throw new Error('Web session did not provide an access token.');
  const identityChoice = typeof window !== 'undefined'
    && destination.url.origin === window.location.origin && destination.url.pathname === '/api/identity-choice';
  if (destination.authSuffix !== undefined || identityChoice) {
    if (typeof window === 'undefined') throw new Error('Web session account requests require a browser origin.');
    headers.set('X-Web-Session', token.slice(WEB_SESSION_PREFIX.length));
    if (window.parent !== window) headers.set('X-Web-Session-Embedded', '1');
    else headers.delete('X-Web-Session-Embedded');
    const bridgedInit: RequestInit = { ...init, headers, credentials: 'same-origin', redirect: 'error' };
    if (destination.authSuffix !== undefined) {
      headers.delete('Authorization');
      const bridgeUrl = new URL(`/api/web-session/account/${destination.authSuffix}`, window.location.origin);
      bridgeUrl.search = destination.url.search;
      // A Request carries its method/body/signal; preserve them when changing only its URL.
      return request
        ? fetch(new Request(bridgeUrl, new Request(request, bridgedInit)))
        : fetch(bridgeUrl.href, bridgedInit);
    }
    return fetch(target, bridgedInit);
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  // Do not retry mutations or follow redirects carrying credentials.
  return fetch(target, { ...init, headers, redirect: 'error' });
}
