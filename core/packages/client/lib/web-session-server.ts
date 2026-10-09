import { decodeWebSession, decodeWebSessionUserEnvelope } from '@cuberoot/shared/auth/web-session';
import { apiUrl } from './api-base';
import { PAGE_SESSION_COOKIE } from './home-card-access';

export const WEB_SESSION_GENERATION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PRIVATE_SESSION_HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export interface StoredWebSession { token: string; generation: string }

/** Origin, not CORS, protects state changes and credential-returning reads. */
export function isSameOriginSessionRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  // GET fetch may omit Origin; a same-origin custom header still excludes cross-site forms.
  if (!origin) return request.method === 'GET' && site === 'same-origin';
  try {
    const parsed = new URL(origin);
    const host = request.headers.get('host') ?? new URL(request.url).host;
    return parsed.origin === origin && parsed.host === host
      && (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)));
  } catch { return false; }
}

export function sessionCookieName(request: Request): string {
  const embedded = request.headers.get('X-Web-Session-Embedded') === '1';
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('origin')?.startsWith('https:') || request.headers.get('x-forwarded-proto') === 'https';
  return `${secure ? '__Host-' : ''}cuberoot-web-session${embedded ? '-embedded' : ''}`;
}

export function readSessionCookie(request: Request, name = sessionCookieName(request)): StoredWebSession | null {
  const raw = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  try {
    const value = JSON.parse(decodeURIComponent(raw ?? '')) as StoredWebSession;
    return typeof value.token === 'string' && value.token.length <= 8192 && WEB_SESSION_GENERATION.test(value.generation) ? value : null;
  } catch { return null; }
}

export function writeSessionCookies(request: Request, headers: Headers, value: StoredWebSession | null, expiresAt = 0): void {
  const name = sessionCookieName(request);
  const secure = name.startsWith('__Host-');
  const embedded = name.endsWith('-embedded');
  const maxAge = value ? Math.max(0, Math.min(365 * 86400, Math.floor((expiresAt - Date.now()) / 1000))) : 0;
  const attributes = `; Path=/; HttpOnly; SameSite=${embedded && secure ? 'None' : 'Lax'}; Max-Age=${maxAge}${secure ? '; Secure' : ''}${embedded && secure ? '; Partitioned' : ''}`;
  headers.append('Set-Cookie', `${name}=${value ? encodeURIComponent(JSON.stringify(value)) : ''}${attributes}`);
  writePageSessionCookie(request, headers, value?.token ?? '', expiresAt);
}

export async function exchangeBrowserAccess(token: string, signal?: AbortSignal) {
  const response = await fetch(apiUrl('/v1/auth/browser-access'), {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, redirect: 'error', cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'unauthorized' : 'unavailable');
  const body: unknown = await response.json();
  const session = decodeWebSession(body);
  const sessionExpiresAt = (body as { sessionExpiresAt?: unknown })?.sessionExpiresAt;
  if (!session || typeof sessionExpiresAt !== 'number' || !Number.isFinite(sessionExpiresAt) || sessionExpiresAt <= Date.now()) throw new Error('unavailable');
  return { ...session, sessionExpiresAt };
}

/** Page gate credential is always server-written; preview never overwrites the durable login. */
export function writePageSessionCookie(request: Request, headers: Headers, token: string, expiresAt: number): void {
  const name = sessionCookieName(request);
  const secure = name.startsWith('__Host-');
  const embedded = secure && name.endsWith('-embedded');
  const maxAge = token ? Math.max(0, Math.min(365 * 86400, Math.floor((expiresAt - Date.now()) / 1000))) : 0;
  headers.append('Set-Cookie', `${PAGE_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${embedded ? 'None' : 'Lax'}; Max-Age=${maxAge}${secure ? '; Secure' : ''}${embedded ? '; Partitioned' : ''}`);
}

/** Only route selection uses this claim; API verification must precede trusting identity. */
export function browserAccessClaim(token: string): boolean {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).browserAccess === true; }
  catch { return false; }
}

export async function verifyBrowserAccessUser(token: string, signal: AbortSignal): Promise<number> {
  if (!browserAccessClaim(token)) throw new Error('unauthorized');
  const response = await fetch(apiUrl('/v1/auth/me'), {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
  });
  if (!response.ok) throw new Error('unauthorized');
  const session = decodeWebSessionUserEnvelope(await response.json());
  if (!session) throw new Error('unauthorized');
  return session.user.uid;
}

/** Preserve the existing 30-day renewal threshold without extending a fresh reset grant. */
export async function prepareDurableSession(token: string, signal: AbortSignal) {
  let needsRefresh = false;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    const now = Date.now() / 1000;
    const grantSeconds = payload.amr === 'email_code' ? 900 : payload.amr === 'phone_password_reset' ? 600 : 0;
    const grantExpired = !grantSeconds || (Number.isFinite(payload.iat) && now - payload.iat >= grantSeconds);
    needsRefresh = payload.browserAccess !== true && !payload.previewId && grantExpired
      && (!Number.isSafeInteger(payload.uid) || (Number.isFinite(payload.exp) && payload.exp > now && payload.exp - now <= 30 * 86400));
  } catch { /* Verification below remains authoritative. */ }
  let durableToken = token;
  if (needsRefresh) {
    try {
      const response = await fetch(apiUrl('/v1/auth/refresh'), {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, redirect: 'error', cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
      const renewed = response.ok ? decodeWebSession(await response.json()) : null;
      // /auth/refresh signs only uid/name/wcaId; it deliberately drops amr.
      if (renewed) durableToken = renewed.token;
    } catch { /* Best effort: an otherwise-valid existing session still works. */ }
  }
  return { ...await exchangeBrowserAccess(durableToken, signal), durableToken };
}
