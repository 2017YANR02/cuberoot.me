import { apiUrl } from '@/lib/api-base';
import { isDevelopmentLoopback } from '@/lib/competition-gate';
import { COMPETITION_ACCESS_COOKIE, COMPETITION_ACCESS_TTL, createCompetitionProof } from '@cuberoot/shared/competition-access';

/** Local development traffic exemption; account authorization remains separate. */
export async function GET(request: Request) {
  const secret = process.env.COMPETITION_ACCESS_SECRET ?? '';
  if (isDevelopmentLoopback(request)) {
    if (secret.length < 32) return Response.json({ code: 'verification_unavailable' }, {
      status: 503, headers: { 'cache-control': 'private, no-store' },
    });
    const proof = await createCompetitionProof(secret, 'browser', request.headers.get('user-agent') ?? '');
    return new Response(null, { status: 204, headers: {
      'cache-control': 'private, no-store',
      'set-cookie': `${COMPETITION_ACCESS_COOKIE}=${proof}; Path=/; Max-Age=${COMPETITION_ACCESS_TTL}; HttpOnly; Secure; SameSite=Lax`,
    } });
  }
  const headers = new Headers();
  for (const name of ['cookie', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await fetch(apiUrl('/v1/competition-access/check'), {
    headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  return new Response(response.body, { status: response.status, headers: {
    'cache-control': 'private, no-store',
    ...(response.headers.has('content-type') ? { 'content-type': response.headers.get('content-type')! } : {}),
  } });
}
