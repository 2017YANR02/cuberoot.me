// Forward competition reads to the origin, where browser access is checked
// before its shared results cache. Visitor responses must stay private.
import dns from 'node:dns';
import { competitionOnlyVerificationEnabled, trafficDefenseEnabled } from '@/lib/traffic-defense';
import { COMPETITION_ACCESS_COOKIE, COMPETITION_SERVICE_HEADER, competitionCookie, createCompetitionProof, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
import { isVerifiedGooglebot } from '@cuberoot/shared/googlebot';

// Node fetch 默认 IPv6-first,api.cuberoot.me 的 AAAA 查询会挂起到超时 (next.config
// 在主进程设过,但 route handler 运行时 / Vercel serverless function 不一定继承,
// 这里在本模块运行时再设一次).
dns.setDefaultResultOrder('ipv4first');

const UPSTREAM = 'https://api.cuberoot.me';

export const maxDuration = 30;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(slug)) {
    return Response.json({ error: 'invalid slug' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  // Only these two parameters affect the client cache key. Reject arbitrary
  // variants before they trigger an upstream request (and one cache entry each).
  const query = new URL(req.url).searchParams;
  const only = query.get('only');
  const version = query.get('v');
  if ([...query.keys()].some((key) => key !== 'only' && key !== 'v')
    || query.getAll('only').length > 1 || query.getAll('v').length > 1
    || (version !== null && !/^\d{1,2}$/.test(version))
    || (only !== null && !/^(auto|[A-Za-z0-9]{1,32}(:[A-Za-z0-9]{1,32})?)$/.test(only))) {
    return Response.json({ error: 'invalid query' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  const onlyQs = only ? `?v=4&only=${encodeURIComponent(only)}` : '?v=4';

  const upstreamPath = `/v1/cubing-live/${encodeURIComponent(slug)}${onlyQs}`;
  const secret = process.env.COMPETITION_ACCESS_SECRET ?? '';
  const userAgent = req.headers.get('user-agent') ?? '';
  const fullProtection = await trafficDefenseEnabled();
  const scopedProtection = await competitionOnlyVerificationEnabled();
  const vercel = process.env.VERCEL === '1';
  const trustedIngress = vercel || process.env.NODE_ENV === 'production';
  const caller = new URL(req.url);
  const internal = await verifyCompetitionProof(secret, req.headers.get(COMPETITION_SERVICE_HEADER) ?? '',
    'service', caller.pathname + caller.search);
  const countryExempt = fullProtection && !scopedProtection && trustedIngress && (vercel
    ? req.headers.get('x-vercel-ip-country') === 'CN'
    : req.headers.get('x-cuberoot-cn-exempt') === '1');
  const verifiedGoogle = trustedIngress && await isVerifiedGooglebot(
    userAgent, req.headers.get(vercel ? 'x-vercel-forwarded-for' : 'x-real-ip'),
  );
  const headers = new Headers({ accept: 'application/json', 'x-cuberoot-relay-visitor': '1' });
  if (secret && (internal || countryExempt || verifiedGoogle)) {
    headers.set(COMPETITION_SERVICE_HEADER, await createCompetitionProof(secret, 'service', upstreamPath));
  } else {
    const proof = competitionCookie(req.headers.get('cookie') ?? '');
    if ((fullProtection || scopedProtection) && (!proof || (secret && !await verifyCompetitionProof(secret, proof, 'browser', userAgent)))) {
      return Response.json({ code: 'competition_verification_required', scope: scopedProtection ? 'competition' : 'site' }, {
        status: 403, headers: { 'cache-control': 'private, no-store' },
      });
    }
    // Preserve the visitor identity for the origin's per-session competition budget.
    if (proof) headers.set('cookie', `${COMPETITION_ACCESS_COOKIE}=${proof}`);
    headers.set('user-agent', userAgent);
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM}/v1/cubing-live/${encodeURIComponent(slug)}${onlyQs}`, {
      cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(28_000),
      headers,
    });
  } catch {
    return Response.json({ error: 'upstream error' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }

  if (!upstream.ok) {
    let body = '';
    try { body = await upstream.text(); } catch { /* ignore */ }
    return new Response(body || JSON.stringify({ error: `HTTP ${upstream.status}` }), {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(upstream.headers.has('retry-after') ? { 'retry-after': upstream.headers.get('retry-after')! } : {}) },
    });
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return Response.json({ error: 'bad upstream json' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }

  return Response.json(data, { headers: { 'cache-control': 'private, no-store' } });
}
