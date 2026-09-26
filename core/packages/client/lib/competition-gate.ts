import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { competitionCookie, verifyCompetitionProof } from '@cuberoot/shared/competition-access';

// Explicit delivery endpoints and known asset trees stay reachable. A file-like
// person/competition slug, RSC request, or forged cookie never bypasses the gate.
export const SITE_VERIFICATION_PATH = "^/(?:api/comp/(?!access(?:/|$)).*|(?!(?:(?:zh/|en/)?competition-verify/?$|_next/|_vercel/|api(?:/|$)|v1(?:/|$)|auth/(?:social/)?callback/?$|callback\\.html$|\\.well-known/|(?:robots\\.txt|sitemap[^/]*\\.xml)$|(?:_assets|account-locations|analyze-worker|assets|card|cases|contact|cubeopt|cubing-chunks|data|deskpet|donate|ffmpeg|fonts|icons|images|oll_pic|scramble-card-art|sim/hands|textures|vendor|why-cube|tools|stats|music/library)/.*\\.(?:js|mjs|css|map|json|geojson|xml|txt|ico|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|otf|wasm|bin|dat|mp4|webm|mp3|ogg|wav|pdf|glb|gltf|ktx2|basis|zip|gz|br|pbf|csv|tsv|webmanifest)$|[^/]+\\.(?:js|mjs|css|map|json|geojson|xml|txt|ico|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|otf|wasm|bin|dat|mp4|webm|mp3|ogg|wav|pdf|glb|gltf|ktx2|basis|zip|gz|br|pbf|csv|tsv|webmanifest)$)).*)$";
const protectedPath = new RegExp(SITE_VERIFICATION_PATH);

export async function competitionGate(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!protectedPath.test(path)) return null;
  if (process.env.NODE_ENV !== 'production' && !process.env.COMPETITION_ACCESS_SECRET) return null;
  const cn = process.env.VERCEL === '1'
    ? req.headers.get('x-vercel-ip-country') === 'CN'
    : req.headers.get('x-cuberoot-cn-exempt') === '1';
  if (cn) return null;
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
