import { apiUrl } from '@/lib/api-base';
import { PAGE_ACCESS_API_PATHS } from '@/lib/page-access-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';
export const maxDuration = 10;

/** Fixed, read-only upstreams. No cached permissions or caller-supplied targets. */
export async function GET(request: Request): Promise<Response> {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Type': 'application/json',
    'X-Page-Access-Region': process.env.VERCEL_REGION ?? 'self-hosted',
  });
  const check = new URL(request.url).searchParams.get('check');
  if (check !== 'locks' && check !== 'session') {
    return Response.json({ error: 'Unknown page access check' }, { status: 400, headers });
  }
  const upstreamHeaders = new Headers();
  const requestId = request.headers.get('X-Request-ID') ?? '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    upstreamHeaders.set('X-Request-ID', requestId);
    headers.set('X-Request-ID', requestId);
  }
  if (check === 'session') {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    upstreamHeaders.set('Authorization', authorization);
  }
  try {
    const response = await fetch(apiUrl(PAGE_ACCESS_API_PATHS[check]), {
      headers: upstreamHeaders, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    // Consume within the deadline, so a stalled response body also fails closed.
    const body = await response.arrayBuffer();
    return new Response(body, { status: response.status, headers });
  } catch {
    return Response.json({ error: 'Page access verification unavailable' }, { status: 503, headers });
  }
}
