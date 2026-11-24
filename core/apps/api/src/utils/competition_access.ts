import type { Context, MiddlewareHandler } from 'hono';
import { readFileSync } from 'node:fs';
import { getConnInfo } from '@hono/node-server/conninfo';
import { COMPETITION_SERVICE_HEADER, competitionCookie, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
import { isVerifiedGooglebot } from '@cuberoot/shared/googlebot';

export function competitionAccessEnforced(): boolean {
  if (process.env.COMPETITION_ACCESS_ENFORCE !== '1') return false;
  try {
    return readFileSync('/etc/nginx/cuberoot-comp-verification-state.conf', 'utf8').trim() !== 'default 0;';
  } catch { return true; }
}

function competitionOnlyActive(): boolean {
  if (process.env.COMPETITION_ACCESS_ENFORCE !== '1') return false;
  try {
    const state = readFileSync('/etc/nginx/cuberoot-comp-only-until.conf', 'utf8').trim();
    const deadline = /^default (\d{1,10});$/.exec(state)?.[1];
    return Number(deadline) > Date.now() / 1000;
  } catch { return false; }
}

function fromLocalNginx(c: Context) {
  try {
    const address = getConnInfo(c).remote.address;
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  } catch { return false; }
}
export async function hasCompetitionAccess(c: Context, path?: string, allowCountryExemption = true): Promise<boolean> {
  // The public client cannot grant itself a country exemption. nginx overwrites
  // this header; direct connections to the Node listener must not trust it.
  if (allowCountryExemption && fromLocalNginx(c) && c.req.header('x-cuberoot-cn-exempt') === '1') return true;
  const secret = process.env.COMPETITION_ACCESS_SECRET ?? '';
  const url = new URL(c.req.url);
  const service = c.req.header(COMPETITION_SERVICE_HEADER) ?? '';
  if (path && await verifyCompetitionProof(secret, service, 'service', path)) return true;
  if (!path && await verifyCompetitionProof(secret, service, 'service', url.pathname + url.search)) return true;
  return verifyCompetitionProof(secret, competitionCookie(c.req.header('cookie') ?? ''), 'browser', c.req.header('user-agent') ?? '');
}
export function competitionAccessDenied(c: Context, scope: 'site' | 'competition') {
  c.header('Cache-Control', 'private, no-store');
  return c.json({ code: 'competition_verification_required', error: 'Browser verification required', scope }, 403);
}

function verifiedCrawler(c: Context) {
  return fromLocalNginx(c) && isVerifiedGooglebot(c.req.header('user-agent'), c.req.header('x-real-ip'));
}

export const requireCompetitionAccess: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  const fullProtection = competitionAccessEnforced();
  if (!fullProtection && !competitionOnlyActive()) return next();
  if (await hasCompetitionAccess(c, undefined, fullProtection) || (!fullProtection && await verifiedCrawler(c))) return next();
  return competitionAccessDenied(c, fullProtection ? 'site' : 'competition');
};

/** Used by browsers and nginx auth_request, before a cached response is served. */
export async function checkCompetitionAccess(c: Context) {
  c.header('Cache-Control', 'private, no-store');
  const fullProtection = competitionAccessEnforced();
  if (!fullProtection && !competitionOnlyActive()) return c.body(null, 204);
  // Only the internal nginx auth subrequest can nominate an original path.
  const original = fromLocalNginx(c) ? c.req.header('x-cuberoot-original-uri') : undefined;
  if (await hasCompetitionAccess(c, original, fullProtection) || (!fullProtection && await verifiedCrawler(c))) return c.body(null, 204);
  return competitionAccessDenied(c, fullProtection ? 'site' : 'competition');
}
