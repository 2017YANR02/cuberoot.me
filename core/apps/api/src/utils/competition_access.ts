import type { Context, MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { COMPETITION_SERVICE_HEADER, competitionCookie, verifyCompetitionProof } from '@cuberoot/shared/competition-access';

function fromLocalNginx(c: Context) {
  try {
    const address = getConnInfo(c).remote.address;
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  } catch { return false; }
}
export async function hasCompetitionAccess(c: Context, path?: string): Promise<boolean> {
  // The public client cannot grant itself a country exemption. nginx overwrites
  // this header; direct connections to the Node listener must not trust it.
  if (fromLocalNginx(c) && c.req.header('x-cuberoot-cn-exempt') === '1') return true;
  const secret = process.env.COMPETITION_ACCESS_SECRET ?? '';
  const url = new URL(c.req.url);
  const service = c.req.header(COMPETITION_SERVICE_HEADER) ?? '';
  if (path && await verifyCompetitionProof(secret, service, 'service', path)) return true;
  if (!path && await verifyCompetitionProof(secret, service, 'service', url.pathname + url.search)) return true;
  return verifyCompetitionProof(secret, competitionCookie(c.req.header('cookie') ?? ''), 'browser', c.req.header('user-agent') ?? '');
}
export function competitionAccessDenied(c: Context) {
  c.header('Cache-Control', 'private, no-store');
  return c.json({ code: 'competition_verification_required', error: 'Browser verification required' }, 403);
}
export const requireCompetitionAccess: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'OPTIONS' || process.env.COMPETITION_ACCESS_ENFORCE !== '1') return next();
  if (!await hasCompetitionAccess(c)) return competitionAccessDenied(c);
  return next();
};

/** Used by browsers and nginx auth_request, before a cached response is served. */
export async function checkCompetitionAccess(c: Context) {
  c.header('Cache-Control', 'private, no-store');
  if (process.env.COMPETITION_ACCESS_ENFORCE !== '1') return c.body(null, 204);
  // Only the internal nginx auth subrequest can nominate an original path.
  const original = fromLocalNginx(c) ? c.req.header('x-cuberoot-original-uri') : undefined;
  if (!await hasCompetitionAccess(c, original)) return competitionAccessDenied(c);
  return c.body(null, 204);
}
