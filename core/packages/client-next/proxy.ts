// Reads ?lang= from URL and forwards it to the downstream request as `x-lang`
// header so the root layout can SSR with the correct locale on the very first
// paint. Without this, layout defaults to 'en' and the client switches to 'zh'
// in a useEffect, producing a hydration mismatch (server text != client text).
//
// Why not cookies: proxy-set cookies are visible only on subsequent requests,
// so they don't fix the first hit. Header injection via NextResponse.next({
// request: { headers } }) is read in the SAME request by `headers()` in layout.

import { NextResponse, type NextRequest } from 'next/server';

const SUPPORTED = new Set(['zh', 'en']);

export function proxy(req: NextRequest): NextResponse {
  // ?lang= wins over the cookie so a shared URL like /wca?lang=zh always
  // renders zh, even if the recipient last visited in en. Cookie covers the
  // returning-user case where the URL has no query.
  const urlLang = req.nextUrl.searchParams.get('lang') ?? undefined;
  const cookieLang = req.cookies.get('lang')?.value;
  const lang = urlLang && SUPPORTED.has(urlLang)
    ? urlLang
    : cookieLang && SUPPORTED.has(cookieLang)
      ? cookieLang
      : undefined;
  const headers = new Headers(req.headers);
  if (lang) headers.set('x-lang', lang);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Skip static assets — they don't need lang context and we want zero overhead.
  matcher: ['/((?!_next/static|_next/image|fonts|textures|icons|favicon).*)'],
};
