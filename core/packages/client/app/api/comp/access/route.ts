import { COMPETITION_ACCESS_COOKIE, COMPETITION_ACCESS_TTL, createCompetitionProof } from '@cuberoot/shared/competition-access';

export const dynamic = 'force-dynamic';

/** Covered by the production Vercel competition-entry Challenge rule.
 * Self-hosted and preview deployments must NEVER mint bypass credentials.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.COMPETITION_ACCESS_SECRET ?? '';
  if (process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== 'production'
    || !['cuberoot.me', 'www.cuberoot.me'].includes(url.hostname) || secret.length < 32) {
    return Response.json({ error: 'verification_unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
  const proof = await createCompetitionProof(secret, 'browser', request.headers.get('user-agent') ?? '');
  const headers = new Headers({
    'cache-control': 'private, no-store',
    'set-cookie': `${COMPETITION_ACCESS_COOKIE}=${proof}; Domain=cuberoot.me; Path=/; Max-Age=${COMPETITION_ACCESS_TTL}; HttpOnly; Secure; SameSite=Lax`,
  });
  const returnTo = url.searchParams.get('returnTo');
  if (returnTo) {
    const target = new URL(returnTo, url.origin);
    if (!returnTo.startsWith('/') || target.origin !== url.origin || target.pathname.startsWith('/api/')) {
      return Response.json({ error: 'invalid_return_path' }, { status: 400, headers: { 'cache-control': 'no-store' } });
    }
    headers.set('location', target.href);
    return new Response(null, { status: 303, headers });
  }
  return Response.json({ expiresIn: COMPETITION_ACCESS_TTL }, { headers });
}
