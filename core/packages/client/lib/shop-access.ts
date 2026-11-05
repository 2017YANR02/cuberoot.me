import { NextResponse, type NextRequest } from 'next/server';
import { decodeWebSessionUserEnvelope } from '@cuberoot/shared/auth/web-session';
import { PAGE_SESSION_COOKIE } from './home-card-access';
import { pageAccessApiUrl } from './page-access-api';

export const SHOP_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

/** Shop previews are private until launch, independently of homepage card locks. */
export function isShopPreviewPath(pathname: string): boolean {
  try { pathname = decodeURIComponent(pathname); } catch { return false; }
  return /^\/(?:en\/|zh\/)?shop(?:\/|$)/.test(pathname);
}

export async function shopAccessDenied(request: NextRequest): Promise<NextResponse | null> {
  const token = request.cookies.get(PAGE_SESSION_COOKIE)?.value;
  if (token && token.length <= 8192 && !/[\r\n]/.test(token)) {
    try {
      const response = await fetch(pageAccessApiUrl('session'), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (response.ok && decodeWebSessionUserEnvelope(await response.json())?.user.isAdmin === true) return null;
    } catch { /* Unavailable verification never exposes the unfinished storefront. */ }
  }
  return new NextResponse('Not Found', { status: 404, headers: SHOP_PRIVATE_HEADERS });
}
