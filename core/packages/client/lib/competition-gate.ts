import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { competitionCookie, verifyCompetitionProof } from '@cuberoot/shared/competition-access';

export async function competitionGate(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!/^\/(?:(?:zh\/|en\/)?wca\/comp(?:\/|$)|api\/comp\/(?!access(?:\/|$)))/.test(path)) return null;
  if (process.env.NODE_ENV !== 'production' && !process.env.COMPETITION_ACCESS_SECRET) return null;
  const cn = process.env.VERCEL === '1'
    ? req.headers.get('x-vercel-ip-country') === 'CN'
    : req.headers.get('x-cuberoot-cn-exempt') === '1';
  if (cn) return null;
  const proof = competitionCookie(req.headers.get('cookie') ?? '');
  if (await verifyCompetitionProof(process.env.COMPETITION_ACCESS_SECRET ?? '', proof, 'browser', req.headers.get('user-agent') ?? '')) return null;
  const headers = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' };
  if (path.startsWith('/api/')) return NextResponse.json({ code: 'competition_verification_required' }, { status: 403, headers });
  const target = req.nextUrl.clone();
  target.pathname = path.startsWith('/zh/') ? '/zh/competition-verify' : '/competition-verify';
  target.search = '';
  target.searchParams.set('returnTo', path + req.nextUrl.search);
  return NextResponse.redirect(target, { status: 307, headers });
}
