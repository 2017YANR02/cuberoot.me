// Next 16 proxy (formerly middleware). Owns the site's language routing.
//
// PATTERN B — English lives at the BARE address (no /en prefix):
//   - English is served at /foo. A bare path is internally REWRITTEN to /en/foo
//     (the [lang] tree still renders), so the URL stays clean AND there is no
//     redirect hop for the majority (English) audience — which also trims
//     Vercel edge requests.
//   - Chinese lives under /zh/foo (served as-is).
//   - Explicit /en/foo still serves (old links keep working) but its
//     rel=canonical points at the bare /foo, so English keeps ONE canonical URL.
//     (We can't 308 /en→bare: the bare→/en rewrite re-enters middleware on its
//     /en target, and a redirect there would loop.)
//   - A bare path is shown in Chinese (308 → /zh/foo) only when the visitor's
//     environment says so: lang cookie = zh, else Accept-Language contains zh.
//     Anyone who has chosen English (cookie = en) always stays bare.
//
// Because bare → /en is a blanket rewrite, there is no MIGRATED_PATHS whitelist
// anymore: a new top-level route just works (the old whitelist is what bit
// /article). Only app-root, non-[lang] routes are excluded (see NON_LANG).
//
// Ordering (Next): next.config redirects → THIS proxy → beforeFiles rewrites →
// filesystem. So the bare-target renames in next.config resolve BEFORE us (we
// then route their bare result), and the persons-sentinel beforeFiles rewrite
// (/:lang(en|zh)/wca/persons/:id → …/_) resolves AFTER us, matching the /en/…
// path we rewrite to — neither needs Pattern-B-specific changes.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'zh'] as const;
type Locale = typeof SUPPORTED_LOCALES[number];

// App-root routes that are NOT under app/[lang]/* — route handlers, OAuth, the
// worker-asset trees, the kill-switch service worker. These pass through
// untouched: rewriting bare /tools/… to /en/tools/… would 404 (no such page in
// the [lang] tree). Static assets + /v1 are already dropped by config.matcher.
const NON_LANG = /^\/(api|auth|callback\.html|cubing-chunks|stats|tools|cubeopt|analyze-worker|sw\.js|v1)(\/|$)/;

function stripLocalePrefix(pathname: string): { locale: Locale | null; rest: string } {
  for (const loc of SUPPORTED_LOCALES) {
    if (pathname === `/${loc}`) return { locale: loc, rest: '/' };
    if (pathname.startsWith(`/${loc}/`)) return { locale: loc, rest: pathname.slice(loc.length + 1) };
  }
  return { locale: null, rest: pathname };
}

// Environment language for a BARE request. Explicit cookie wins; else
// Accept-Language. 'en' stays bare; 'zh' diverts to its prefix.
function preferredLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get('lang')?.value;
  if (cookie === 'en' || cookie === 'zh') return cookie;
  const al = (req.headers.get('accept-language') ?? '').toLowerCase();
  if (al.includes('zh')) return 'zh';
  return 'en';
}

function setLangCookie(res: NextResponse, lang: Locale) {
  res.cookies.set('lang', lang, { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax' });
}

// SEO canonical + hreflang as HTTP Link headers (Google & Bing both honor
// these). Central — covers every route without touching a page component, and
// SSG-safe (middleware runs on prerendered/CDN responses too, so it never opts
// a page into dynamic rendering). English canonical is the BARE URL; Chinese is
// /zh/…; x-default points at the bare (English) URL. Host hard-pinned to www so
// apex / next.cuberoot.me / *.vercel.app previews self-consolidate. `rest` is
// the locale-stripped path, so en/zh share one sub-path.
const CANONICAL_HOST = 'https://www.cuberoot.me';

function setSeoLinkHeaders(res: NextResponse, rest: string, locale: Locale) {
  const sub = rest === '/' ? '' : rest;
  const en = `${CANONICAL_HOST}${sub || '/'}`; // bare
  const zh = `${CANONICAL_HOST}/zh${sub}`;
  const self = locale === 'zh' ? zh : en;
  // append (not set) so we never clobber Next's own preload Link headers.
  res.headers.append(
    'Link',
    [
      `<${self}>; rel="canonical"`,
      `<${en}>; rel="alternate"; hreflang="en"`,
      `<${zh}>; rel="alternate"; hreflang="zh-Hans"`,
      `<${en}>; rel="alternate"; hreflang="x-default"`,
    ].join(', '),
  );
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname, searchParams } = url;

  // App-root, non-[lang] routes: leave entirely alone.
  if (NON_LANG.test(pathname)) return NextResponse.next();

  const { locale, rest } = stripLocalePrefix(pathname);

  // 1. ?lang=zh|en on any path → set cookie + redirect to that language's
  //    canonical shape (en = bare, zh = /zh/…), dropping the query. Keeps old
  //    ?lang= links (Vite era) working.
  const queryLang = searchParams.get('lang');
  if (queryLang === 'zh' || queryLang === 'en') {
    const target = url.clone();
    target.searchParams.delete('lang');
    const sub = rest === '/' ? '' : rest;
    target.pathname = queryLang === 'en' ? sub || '/' : `/${queryLang}${sub}`;
    const res = NextResponse.redirect(target, 307);
    setLangCookie(res, queryLang);
    return res;
  }

  // 2. Already-prefixed /en or /zh → SERVE as-is (do NOT redirect /en→bare:
  //    the bare→/en rewrite below re-enters middleware on its /en target, and a
  //    redirect here would fight that rewrite into a /foo↔/en/foo loop). English
  //    keeps a single canonical URL via the BARE rel=canonical instead — old
  //    /en links still resolve, Google consolidates them to the bare URL.
  //    Refresh cookie, inject x-lang for SSR, emit SEO links. The bare→/en
  //    rewrite below re-enters middleware here on its /en target; on that
  //    runtime (dev) THIS serve pass produces the final response, so the
  //    canonical must be set here. On runtimes that don't re-enter (Vercel) the
  //    rewrite branch's canonical survives instead — each keeps exactly one.
  if (locale) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-lang', locale);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (req.cookies.get('lang')?.value !== locale) setLangCookie(res, locale);
    setSeoLinkHeaders(res, rest, locale);
    return res;
  }

  // 3. Bare path → English by default. Chinese-preferring visitors get
  //    307 → /zh/…; everyone else is served English in place by
  //    rewriting to the /en tree (the URL bar stays bare).
  const pref = preferredLocale(req);
  if (pref !== 'en') {
    const target = url.clone();
    target.pathname = `/${pref}${pathname === '/' ? '' : pathname}`;
    // 307 (temporary), NOT 308: this depends on the per-user cookie /
    // Accept-Language, so it must never be cached as a permanent redirect — a
    // 308 would pin a visitor to /zh even after they switch to English.
    const res = NextResponse.redirect(target, 307);
    setLangCookie(res, pref);
    return res;
  }

  const target = url.clone();
  target.pathname = `/en${pathname === '/' ? '' : pathname}`;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-lang', 'en');
  const res = NextResponse.rewrite(target, { request: { headers: requestHeaders } });
  if (req.cookies.get('lang')?.value !== 'en') setLangCookie(res, 'en');
  setSeoLinkHeaders(res, pathname, 'en'); // bare → rest === pathname
  return res;
}

export const config = {
  // Skip Next internals, API rewrites, worker chunks, and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|fonts/|cubing-chunks/|v1/|.*\\.(?:png|apng|jpg|jpeg|gif|svg|webp|avif|ico|woff2?|ttf|otf|css|js|mjs|map|wasm|json|xml|txt|html|geojson|tsv|csv|bin|gz|mp3|mp4|webm)$).*)',
  ],
};
