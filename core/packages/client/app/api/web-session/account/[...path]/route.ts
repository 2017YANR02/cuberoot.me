import { apiUrl } from '@/lib/api-base';
import { readSessionJson, SessionRequestBodyError } from '@/lib/session-request-body';
import {
  exchangeBrowserAccess, isSameOriginSessionRequest, PRIVATE_SESSION_HEADERS,
  readSessionCookie, writePageSessionCookie, writeSessionCookies,
} from '@/lib/web-session-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GET_PATHS = new Set(['onboarding', 'face', 'me', 'profile', 'providers', 'identities', 'admin/users', 'social/authorize', 'apple/authorize']);
const POST_PATHS = new Set([
  'face', 'refresh', 'profile', 'password/set', 'password/remove', 'account/delete', 'account/merge', 'account/merge/code',
  'identity/link-code', 'link/apple', 'link/google', 'link/wca', 'link/email/send', 'link/email/verify',
  'link/phone/send', 'link/phone/verify', 'email/replace', 'phone/replace', 'unlink',
  'wechat/wca-link/start', 'web-session/ticket', 'mobile-session/ticket', 'role-preview',
]);
function allowed(method: string, path: string): boolean {
  if (method === 'GET') return GET_PATHS.has(path) || /^admin\/users\/[1-9]\d*$/.test(path);
  if (method === 'POST') return POST_PATHS.has(path) || /^admin\/users\/[1-9]\d*\/(profile|impersonation)$/.test(path)
    || /^link\/social\/(wechat|qq|alipay|douyin)$/.test(path);
  if (method === 'PUT') return path === 'onboarding';
  if (method === 'PATCH') return /^admin\/users\/[1-9]\d*\/admin$/.test(path);
  return method === 'DELETE' && /^role-preview\/[0-9a-f-]{36}$/i.test(path);
}
const result = (body: unknown, status = 200, headers = new Headers(PRIVATE_SESSION_HEADERS)) => Response.json(body, { status, headers });

async function account(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  if (!isSameOriginSessionRequest(request)) return result({ error: 'forbidden' }, 403);
  const stored = readSessionCookie(request);
  if (!stored || request.headers.get('X-Web-Session') !== stored.generation) return result({ error: 'session changed' }, 401);
  const path = (await context.params).path.join('/');
  if (!allowed(request.method, path)) return result({ error: 'unsupported account operation' }, 404);
  try {
    let body: string | undefined;
    if (request.method !== 'GET' && request.method !== 'DELETE' && request.body !== null) {
      if (!request.headers.get('content-type')?.startsWith('application/json')) return result({ error: 'invalid body' }, 415);
      body = JSON.stringify(await readSessionJson(request, 256 * 1024));
    }
    const upstream = await fetch(apiUrl(`/v1/auth/${path}${new URL(request.url).search}`), {
      method: request.method, headers: { Authorization: `Bearer ${stored.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body, redirect: 'error', cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    const output = await upstream.json();
    const headers = new Headers(PRIVATE_SESSION_HEADERS);
    if (upstream.ok) {
      if (path === 'account/delete') writeSessionCookies(request, headers, null);
      const preview = path === 'role-preview' || /^admin\/users\/[1-9]\d*\/impersonation$/.test(path);
      if (preview) {
        // Preview credentials are intentionally temporary and tab-scoped. The API
        // minted them using the authenticated administrator, never a submitted token.
        if (path === 'role-preview' && typeof output.token === 'string') {
          writePageSessionCookie(request, headers, output.token, Date.now() + 30 * 60_000);
        }
      } else if (typeof output.token === 'string') {
        const session = await exchangeBrowserAccess(output.token, request.signal);
        writeSessionCookies(request, headers, { token: output.token, generation: stored.generation }, session.sessionExpiresAt);
        output.token = session.token;
        output.user = session.user;
        output.generation = stored.generation;
      } else if (request.method === 'DELETE' && path.startsWith('role-preview/')) {
        const primary = await exchangeBrowserAccess(stored.token, request.signal);
        writePageSessionCookie(request, headers, stored.token, primary.sessionExpiresAt);
      }
    }
    return result(output, upstream.status, headers);
  } catch (cause) {
    return result({ error: 'account operation unavailable' }, cause instanceof SessionRequestBodyError ? cause.status : 503);
  }
}
export { account as GET, account as PUT, account as POST, account as PATCH, account as DELETE };
