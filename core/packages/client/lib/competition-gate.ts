import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { competitionCookie, verifyCompetitionProof, COMPETITION_SERVICE_HEADER } from '@cuberoot/shared/competition-access';

// Explicit delivery endpoints and known asset trees stay reachable. A file-like
// person/competition slug, RSC request, or forged cookie never bypasses the gate.
export const SITE_VERIFICATION_PATH = "^/(?:api/comp/(?!access(?:/|$)).*|(?!(?:(?:zh/|en/)?(?:competition-verify|privacy|account|contact)/?$|_next/|_vercel/|api(?:/|$)|v1(?:/|$)|auth/(?:social/)?callback/?$|callback\\.html$|\\.well-known/|(?:robots\\.txt|sitemap[^/]*\\.xml)$|(?:_assets|account-locations|analyze-worker|assets|card|cases|contact|cubeopt|cubing-chunks|data|deskpet|donate|ffmpeg|fonts|icons|images|oll_pic|scramble-card-art|sim/hands|textures|vendor|why-cube|tools|stats|music/library)/.*\\.(?:js|mjs|css|map|json|geojson|xml|txt|ico|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|otf|wasm|bin|dat|mp4|webm|mp3|ogg|wav|pdf|glb|gltf|ktx2|basis|zip|gz|br|pbf|csv|tsv|webmanifest)$|[^/]+\\.(?:js|mjs|css|map|json|geojson|xml|txt|ico|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|otf|wasm|bin|dat|mp4|webm|mp3|ogg|wav|pdf|glb|gltf|ktx2|basis|zip|gz|br|pbf|csv|tsv|webmanifest)$)).*)$";
const protectedPath = new RegExp(SITE_VERIFICATION_PATH);

export function isDevelopmentLoopback(req: Request): boolean {
  // Loading the production signing secret locally must not enable the public
  // traffic challenge for the maintainer's own development browser.
  const publicHost = req.headers.get('host') ?? new URL(req.url).host;
  const forwardedHost = req.headers.get('x-forwarded-host');
  const loopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;
  return process.env.NODE_ENV === 'development'
    && loopbackHost.test(publicHost)
    && (!forwardedHost || loopbackHost.test(forwardedHost));
}

export async function competitionGate(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!protectedPath.test(path)) return null;
  if (isDevelopmentLoopback(req)) return null;
  if (process.env.NODE_ENV !== 'production' && !process.env.COMPETITION_ACCESS_SECRET) return null;
  const cn = process.env.VERCEL === '1'
    ? req.headers.get('x-vercel-ip-country') === 'CN'
    : req.headers.get('x-cuberoot-cn-exempt') === '1';
  if (cn) return null;
  // A server-only proof is valid for one exact path/query and at most 60 seconds.
  // It clears the traffic challenge only; it grants no account/private-data access.
  if (await verifyCompetitionProof(process.env.COMPETITION_ACCESS_SECRET ?? '', req.headers.get(COMPETITION_SERVICE_HEADER) ?? '', 'service', path + req.nextUrl.search)) return null;
  const proof = competitionCookie(req.headers.get('cookie') ?? '');
  if (await verifyCompetitionProof(process.env.COMPETITION_ACCESS_SECRET ?? '', proof, 'browser', req.headers.get('user-agent') ?? '')) return null;
  const headers = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow', 'x-cuberoot-verification-required': '1' };
  if (path.startsWith('/api/')) return NextResponse.json({ code: 'competition_verification_required' }, { status: 403, headers });
  const target = new URL(req.nextUrl.origin);
  target.pathname = path.startsWith('/zh/') ? '/zh/competition-verify' : '/competition-verify';
  target.search = '';
  target.searchParams.set('returnTo', path + req.nextUrl.search);
  return NextResponse.redirect(target, { status: 307, headers });
}
