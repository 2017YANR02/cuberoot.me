import { apiUrl } from '@/lib/api-base';

/** The dev rewrite cannot adapt production Origin checks or cookie domains. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  // Next may expose its internal localhost URL behind the HTTPS preview tunnel.
  // Only actual loopback visitors need Origin/cookie adaptation; keep the
  // public Host and Origin for phones visiting dev.cuberoot.me.
  const publicHost = request.headers.get('host') ?? url.host;
  const loopback = process.env.NODE_ENV === 'development'
    && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(publicHost);
  const headers = new Headers();
  for (const name of ['origin', 'user-agent', 'content-type', 'cookie']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (loopback) {
    // Validate before translating: cross-origin callers must never inherit the
    // trusted preview origin. The API still validates the one-use image answer.
    if (headers.get('origin') !== url.origin) {
      return Response.json({ code: 'invalid_origin' }, { status: 403 });
    }
    headers.set('origin', 'https://dev.cuberoot.me');
  }
  const body = await request.text();
  if (body.length > 512) return Response.json({ code: 'invalid_challenge' }, { status: 400 });
  const upstream = await fetch(apiUrl('/v1/competition-access/verify'), {
    method: 'POST', headers, body, cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  const responseHeaders = new Headers({ 'cache-control': 'private, no-store' });
  for (const name of ['content-type', 'retry-after']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  for (let cookie of upstream.headers.getSetCookie()) {
    if (loopback) {
      cookie = cookie.replace(/;\s*Domain=[^;]+/gi, '');
      // __Secure- cookies require Secure even on localhost. Browsers treat
      // loopback as trustworthy; stripping it makes them reject the cookie.
    }
    responseHeaders.append('set-cookie', cookie);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
