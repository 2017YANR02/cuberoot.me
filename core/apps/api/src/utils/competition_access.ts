import type { Context, MiddlewareHandler } from 'hono';
import { readFileSync } from 'node:fs';
import { getConnInfo } from '@hono/node-server/conninfo';
import { COMPETITION_SERVICE_HEADER, competitionCookie, readCompetitionProof, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
import { admitCompetitionRead, competitionSessionRevoked, resultCompetitionId } from './competition_result_quota.js';
import { isVerifiedGooglebot } from '@cuberoot/shared/googlebot';

export function competitionAccessEnforced(): boolean {
  if (process.env.COMPETITION_ACCESS_ENFORCE !== '1') return false;
  try {
    return readFileSync('/etc/nginx/cuberoot-comp-verification-state.conf', 'utf8').trim() !== 'default 0;';
  } catch { return true; }
}

function resultProtection(resultRequest: boolean): 'site' | 'competition' | 'open' | 'unavailable' {
  if (process.env.COMPETITION_ACCESS_ENFORCE !== '1') return 'open';
  const general = competitionAccessEnforced() ? 'site' : 'open';
  if (!resultRequest) return general;
  try {
    const state = readFileSync('/etc/nginx/cuberoot-comp-only-until.conf', 'utf8').trim();
    const deadline = /^default (\d{1,10});$/.exec(state)?.[1];
    if (!deadline) return 'unavailable';
    return Number(deadline) > Date.now() / 1000 ? 'competition' : general;
  } catch { return 'unavailable'; }
}

function fromLocalNginx(c: Context) {
  try {
    const address = getConnInfo(c).remote.address;
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  } catch { return false; }
}
export function competitionAccessDenied(c: Context, scope: 'site' | 'competition') {
  c.header('Cache-Control', 'private, no-store');
  return c.json({ code: 'competition_verification_required', error: 'Browser verification required', scope }, 403);
}

function verifiedCrawler(c: Context) {
  return fromLocalNginx(c) && isVerifiedGooglebot(c.req.header('user-agent'), c.req.header('x-real-ip'));
}

function verificationUnavailable(c: Context) {
  c.header('Cache-Control', 'private, no-store');
  c.header('Retry-After', '5');
  return c.json({ code: 'verification_unavailable' }, 503);
}

async function deniedResponse(c: Context, scope: ReturnType<typeof resultProtection>, internalCheck: boolean) {
  if (scope === 'unavailable') return verificationUnavailable(c);
  if (scope === 'open') return;
  const fullProtection = scope === 'site';
  const trustedNginx = fromLocalNginx(c);
  if (fullProtection && trustedNginx && c.req.header('x-cuberoot-cn-exempt') === '1') return;
  if (await verifiedCrawler(c)) return;

  const url = new URL(c.req.url);
  const original = internalCheck ? c.req.header('x-cuberoot-original-uri') : undefined;
  const secret = process.env.COMPETITION_ACCESS_SECRET ?? '';
  const service = c.req.header(COMPETITION_SERVICE_HEADER) ?? '';
  if (await verifyCompetitionProof(secret, service, 'service', original ?? url.pathname + url.search)) return;
  const proof = await readCompetitionProof(secret, competitionCookie(c.req.header('cookie') ?? ''), 'browser', c.req.header('user-agent') ?? '');
  if (!proof) return competitionAccessDenied(c, fullProtection ? 'site' : 'competition');
  // Legacy proofs can coincide for two browsers with the same UA and issue
  // second. Honor their signed expiry without assigning a shared read budget.
  if (!proof.sessionId) return;
  const path = internalCheck ? c.req.header('x-cuberoot-competition-path') ?? original : c.req.path;
  const competition = path && resultCompetitionId(path);
  let retryAfter: number;
  try {
    if (!competition) {
      if (await competitionSessionRevoked(proof.sessionId)) return competitionAccessDenied(c, scope);
      return;
    }
    const admission = await admitCompetitionRead(proof.sessionId, proof.expires, competition);
    if (admission === 'revoked') return competitionAccessDenied(c, scope);
    retryAfter = admission;
  } catch (error) {
    console.error('[competition-access] Session admission unavailable:', error instanceof Error ? error.name : 'error');
    return verificationUnavailable(c);
  }
  if (retryAfter) {
    c.header('Cache-Control', 'private, no-store');
    c.header('Retry-After', String(retryAfter));
    if (internalCheck) c.header('X-CubeRoot-Competition-Limit', '1');
    return c.json({ code: 'competition_session_limited' }, internalCheck ? 403 : 429);
  }
}

export const requireCompetitionAccess: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  const scope = resultProtection(true);
  if (scope === 'open') return next();
  const denied = await deniedResponse(c, scope, false);
  if (denied) return denied;
  await next();
  // An authenticated cache hit must still go through nginx auth_request. Only
  // the main shared JSON representation may populate that private origin cache.
  const cache = c.res.headers.get('Cache-Control') ?? '';
  const ttl = /^public, max-age=(30|86400)(?:, immutable)?$/.exec(cache)?.[1];
  if (ttl && fromLocalNginx(c) && c.res.status === 200 && !c.res.headers.has('Set-Cookie')
    && c.res.headers.get('Content-Type')?.startsWith('application/json')
    && /^\/v1\/cubing-live\/[A-Za-z0-9_-]+\/?$/.test(c.req.path)) {
    c.header('X-Accel-Expires', ttl);
  }
  c.header('Cache-Control', 'private, no-store');
};

/** Used by browsers and nginx auth_request, before a cached response is served. */
export async function checkCompetitionAccess(c: Context) {
  c.header('Cache-Control', 'private, no-store');
  const internalCheck = fromLocalNginx(c) && c.req.header('x-cuberoot-auth-subrequest') === '1';
  // The public check powers the CAPTCHA page for results. Only a trusted
  // subrequest may identify itself as a non-results page for site-wide rules.
  const path = c.req.header('x-cuberoot-competition-path') ?? c.req.header('x-cuberoot-original-uri');
  const resultRequest = !internalCheck || !!(path && resultCompetitionId(path));
  return await deniedResponse(c, resultProtection(resultRequest), internalCheck) ?? c.body(null, 204);
}
