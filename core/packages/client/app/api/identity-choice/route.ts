import { randomBytes } from 'node:crypto';
import { apiUrl } from '@/lib/api-base';
import { isSameOriginSessionRequest, PRIVATE_SESSION_HEADERS, sessionCookieName, readSessionCookie } from '@/lib/web-session-server';
import { readSessionJson, SessionRequestBodyError } from '@/lib/session-request-body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HANDLE = /^[A-Za-z0-9_-]{43}$/;
function cookieName(request: Request, handle: string) { return `${sessionCookieName(request)}-identity-${handle}`; }
function attributes(request: Request, age: number) {
  const name = sessionCookieName(request);
  const secure = name.startsWith('__Host-');
  const embedded = name.endsWith('-embedded') && secure;
  return `; Path=/; HttpOnly; Max-Age=${age}; SameSite=${embedded ? 'None' : 'Lax'}${secure ? '; Secure' : ''}${embedded ? '; Partitioned' : ''}`;
}
function result(body: unknown, status = 200, headers = new Headers(PRIVATE_SESSION_HEADERS)) { return Response.json(body, { status, headers }); }

/** The public handle alone cannot complete a login; the actual ticket stays HttpOnly. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginSessionRequest(request)) return result({ error: 'forbidden' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return result({ error: 'invalid body' }, 415);
  try {
    const body = await readSessionJson(request, 8192) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return result({ error: 'invalid body' }, 400);
    if (body.operation === 'store') {
      if (typeof body.ticket !== 'string' || !HANDLE.test(body.ticket) || typeof body.expiresInSeconds !== 'number'
        || !Number.isInteger(body.expiresInSeconds) || body.expiresInSeconds <= 0 || body.expiresInSeconds > 900) return result({ error: 'invalid ticket' }, 400);
      const handle = randomBytes(32).toString('base64url');
      const headers = new Headers(PRIVATE_SESSION_HEADERS);
      headers.append('Set-Cookie', `${cookieName(request, handle)}=${body.ticket}${attributes(request, body.expiresInSeconds)}`);
      return result({ handle }, 200, headers);
    }
    if (typeof body.ticket !== 'string' || !HANDLE.test(body.ticket)) return result({ error: 'invalid handle' }, 400);
    const name = cookieName(request, body.ticket);
    const ticket = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
    const headers = new Headers(PRIVATE_SESSION_HEADERS);
    if (body.operation === 'clear') {
      headers.append('Set-Cookie', `${name}=${attributes(request, 0)}`);
      return result({ ok: true }, 200, headers);
    }
    if (!ticket || !HANDLE.test(ticket)) return result({ error: 'identity choice expired' }, 401);
    const path = body.operation === 'complete' ? '/v1/auth/identity/complete'
      : body.operation === 'preview' ? '/v1/auth/identity/link-code/preview' : null;
    if (!path) return result({ error: 'invalid operation' }, 400);
    const upstreamHeaders = new Headers({ 'Content-Type': 'application/json' });
    const authorization = request.headers.get('authorization');
    if (authorization?.startsWith('Bearer web-session:')) {
      const generation = authorization.slice('Bearer web-session:'.length);
      const session = readSessionCookie(request);
      if (!session || session.generation !== generation || request.headers.get('X-Web-Session') !== generation) return result({ error: 'session changed' }, 401);
      upstreamHeaders.set('Authorization', `Bearer ${session.token}`);
    } else if (authorization) upstreamHeaders.set('Authorization', authorization);
    const response = await fetch(apiUrl(path), { method: 'POST', headers: upstreamHeaders,
      body: JSON.stringify({ ticket, action: body.action, expectedUid: body.expectedUid, linkCode: body.linkCode }),
      redirect: 'error', cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]) });
    const output = await response.json();
    if (response.ok && body.operation === 'complete') headers.append('Set-Cookie', `${name}=${attributes(request, 0)}`);
    return result(output, response.status, headers);
  } catch (cause) { return result({ error: cause instanceof SessionRequestBodyError ? cause.message : 'identity choice unavailable' }, cause instanceof SessionRequestBodyError ? cause.status : 503); }
}
