import {
  exchangeBrowserAccess, prepareDurableSession, isSameOriginSessionRequest, PRIVATE_SESSION_HEADERS,
  readSessionCookie, WEB_SESSION_GENERATION, writeSessionCookies, verifyBrowserAccessUser,
} from '@/lib/web-session-server';
import { readSessionJson, SessionRequestBodyError } from '@/lib/session-request-body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function error(status: number) { return Response.json({ error: status === 401 ? 'unauthorized' : 'session unavailable' }, { status, headers: PRIVATE_SESSION_HEADERS }); }

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginSessionRequest(request)) return error(403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return error(415);
  try {
    const value = await readSessionJson(request, 12000) as { token?: unknown; generation?: unknown } | null;
    if (!value || typeof value.token !== 'string' || value.token.length > 8192 || typeof value.generation !== 'string' || !WEB_SESSION_GENERATION.test(value.generation)) return error(400);
    const session = await prepareDurableSession(value.token, request.signal);
    const headers = new Headers(PRIVATE_SESSION_HEADERS);
    writeSessionCookies(request, headers, { token: session.durableToken, generation: value.generation }, session.sessionExpiresAt);
    return Response.json({ token: session.token, user: session.user, generation: value.generation }, { headers });
  } catch (cause) { return error(cause instanceof SessionRequestBodyError ? cause.status : cause instanceof Error && cause.message === 'unauthorized' ? 401 : 503); }
}

export async function GET(request: Request): Promise<Response> {
  if (!isSameOriginSessionRequest(request)) return error(403);
  const stored = readSessionCookie(request);
  if (!stored || request.headers.get('X-Web-Session') !== stored.generation) return error(401);
  try {
    const session = await prepareDurableSession(stored.token, request.signal);
    const headers = new Headers(PRIVATE_SESSION_HEADERS);
    if (session.durableToken !== stored.token) writeSessionCookies(request, headers, { token: session.durableToken, generation: stored.generation }, session.sessionExpiresAt);
    return Response.json({ token: session.token, user: session.user, generation: stored.generation }, { headers });
  } catch (cause) { return error(cause instanceof Error && cause.message === 'unauthorized' ? 401 : 503); }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isSameOriginSessionRequest(request)) return error(403);
  const stored = readSessionCookie(request);
  if (stored && request.headers.get('X-Web-Session') !== stored.generation) return error(409);
  const headers = new Headers(PRIVATE_SESSION_HEADERS);
  writeSessionCookies(request, headers, null);
  return Response.json({ ok: true }, { headers });
}

/** A short response can rotate an existing cookie, but can never create a durable session. */
export async function PATCH(request: Request): Promise<Response> {
  if (!isSameOriginSessionRequest(request)) return error(403);
  const stored = readSessionCookie(request);
  if (!stored || request.headers.get('X-Web-Session') !== stored.generation) return error(401);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return error(415);
  try {
    const value = await readSessionJson(request, 12000) as { token?: unknown; generation?: unknown } | null;
    if (!value || typeof value.token !== 'string' || value.token.length > 8192 || typeof value.generation !== 'string' || !WEB_SESSION_GENERATION.test(value.generation)) return error(400);
    const [session, uid] = await Promise.all([
      exchangeBrowserAccess(stored.token, request.signal), verifyBrowserAccessUser(value.token, request.signal),
    ]);
    if (session.user.uid !== uid) return error(409);
    const headers = new Headers(PRIVATE_SESSION_HEADERS);
    writeSessionCookies(request, headers, { token: stored.token, generation: value.generation }, session.sessionExpiresAt);
    return Response.json({ token: session.token, user: session.user, generation: value.generation }, { headers });
  } catch (cause) { return error(cause instanceof SessionRequestBodyError ? cause.status : cause instanceof Error && cause.message === 'unauthorized' ? 401 : 503); }
}
