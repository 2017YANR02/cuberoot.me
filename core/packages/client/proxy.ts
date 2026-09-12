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
import { fillPlatformParams, matchPlatformRoute } from './lib/platform-routes';
import { homeCardsRequireAdmin, matchingHomeCards, PAGE_SESSION_COOKIE } from './lib/home-card-access';
import { isCompSimPage, verifyPageAdmin, verifyPageRole } from './lib/page-admin-session';
import { apiUrl } from './lib/api-base';
import { PageAccessTrace } from './lib/page-access-trace';

const SUPPORTED_LOCALES = ['en', 'zh'] as const;
type Locale = typeof SUPPORTED_LOCALES[number];

// A self-hosted Next server behind a TLS-terminating proxy cannot transparently
// serve a middleware *rewrite*: it does not consume the x-middleware-rewrite
// header internally and self-proxies the rewrite using x-forwarded-proto=https
// against its own HTTP-only port → `write EPROTO ... packet length too long` →
// 500 (vercel/next.js#91844 + #54450). Only Vercel's edge serves it correctly.
//
// The build-time gate mirrors next.config's standalone gate (isProd &&
// !isVercel) — that's the systemd :3002 target behind nginx.
const IS_STANDALONE = process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1';

// …but the same EPROTO 500 hits `next dev` whenever it is ALSO reached through
// a TLS-terminating proxy — dev.cuberoot.me → frp → local :3000, where nginx
// sends X-Forwarded-Proto: https. NODE_ENV is 'development' there, so the
// build-time gate misses it and every bare (English) URL 500s while /zh works.
// Decide per request instead: forwarded https + not Vercel ⇒ can't rewrite.
function cannotRewrite(req: NextRequest): boolean {
  if (IS_STANDALONE) return true;
  return process.env.VERCEL !== '1' && req.headers.get('x-forwarded-proto') === 'https';
}

// App-root routes that are NOT under app/[lang]/* — route handlers, OAuth, the
// worker-asset trees, the kill-switch service worker. These pass through
// untouched: rewriting bare /tools/… to /en/tools/… would 404 (no such page in
// the [lang] tree). Static assets + /v1 are already dropped by config.matcher.
const NON_LANG = /^\/(api|auth|callback\.html|cubing-chunks|stats|tools|music\/library|cubeopt|analyze-worker|sw\.js|v1)(\/|$)/;

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
// /zh/…; x-default points at the bare (English) URL. Host hard-pinned to the
// bare domain so www / next.cuberoot.me / *.vercel.app previews self-consolidate.
// `rest` is the locale-stripped path, so en/zh share one sub-path.
const CANONICAL_HOST = 'https://cuberoot.me';

// Routes that compute their OWN canonical in generateMetadata and therefore must
// NOT also get one from this header. Two sources naming different URLs is a
// conflict Google resolves by ignoring BOTH and picking its own — which would
// silently undo the very consolidation the page is doing.
//
// Only recon DETAIL pages qualify: `/recon/2523` and `/recon/2523-<slug>` both
// canonicalise to the slugged form (recon/[id]/page.tsx → reconCanonical), so on
// the bare-id URL the header said `/recon/2523` while the HTML said
// `/recon/2523-zhen-chen-oh-2026wca-f`. Verified live before the fix.
//
// Deliberately narrow — `\d[^/]*$` means one segment starting with a digit, so
// it matches the detail page and nothing else. /recon (list), /recon/submit,
// /recon/submit-sketch, /recon/person/<wcaId> and /recon/<id>/alt/<n> have no
// generateMetadata of their own and still need the header's canonical.
const OWNS_ITS_CANONICAL = /^\/recon\/\d[^/]*$/;

function platformSeoRoute(rest: string): { rest: string; ownsCanonical: boolean; noindex: boolean } | null {
  if (rest !== '/platform' && !rest.startsWith('/platform/')) return null;
  const rawSegments = rest === '/platform'
    ? []
    : rest.slice('/platform/'.length).split('/').filter(Boolean);
  const segments = rawSegments.map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  const match = matchPlatformRoute(segments);
  if (!match) return { rest, ownsCanonical: true, noindex: true };
  const noindex = match.definition.access !== 'public'
    || ['search', 'offline', 'login', 'notifications'].includes(match.definition.id);
  const canonicalRest = match.definition.canonicalHref
    ? fillPlatformParams(match.definition.canonicalHref, match.params)
    : rest;
  return {
    rest: canonicalRest,
    ownsCanonical: match.definition.kind !== 'canonical',
    noindex,
  };
}

function setSeoLinkHeaders(res: NextResponse, rest: string, locale: Locale) {
  const platformRoute = platformSeoRoute(rest);
  if (platformRoute?.noindex) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return;
  }
  const seoRest = platformRoute?.rest ?? rest;
  const sub = seoRest === '/' ? '' : seoRest;
  const en = `${CANONICAL_HOST}${sub || '/'}`; // bare
  const zh = `${CANONICAL_HOST}/zh${sub}`;
  const self = locale === 'zh' ? zh : en;
  // hreflang is always safe to emit: on a non-canonical URL Google reads it from
  // the canonical target instead, and recon's own sitemap declares it too.
  const links = [
    `<${en}>; rel="alternate"; hreflang="en"`,
    `<${zh}>; rel="alternate"; hreflang="zh-Hans"`,
    `<${en}>; rel="alternate"; hreflang="x-default"`,
  ];
  const ownsCanonical = platformRoute?.ownsCanonical ?? OWNS_ITS_CANONICAL.test(sub);
  if (!ownsCanonical) links.unshift(`<${self}>; rel="canonical"`);
  // append (not set) so we never clobber Next's own preload Link headers.
  res.headers.append('Link', links.join(', '));
}

export async function proxy(req: NextRequest) {
  let trace: PageAccessTrace | undefined;
  try {
    const cards = matchingHomeCards(req.nextUrl);
    const compSim = isCompSimPage(req.nextUrl.pathname);
    if (!cards.length && !compSim) return routeLanguage(req);
    const currentTrace = trace = new PageAccessTrace();
    const token = req.cookies.get(PAGE_SESSION_COOKIE)?.value ?? '';
    const compRole = compSim ? await currentTrace.step('auth-me', () => verifyPageRole(token, currentTrace.requestId)) : null;
    if (compRole === 'user' || compRole === 'login') {
      const target = req.nextUrl.clone();
      target.searchParams.delete('_rsc');
      const next = `${target.pathname}${target.search}`;
      const prefix = (stripLocalePrefix(target.pathname).locale ?? preferredLocale(req)) === 'zh' ? '/zh' : '';
      target.pathname = compRole === 'login' ? `${prefix}/account` : prefix || '/';
      target.search = '';
      if (compRole === 'login') target.searchParams.set('next', next);
      const response = NextResponse.redirect(target, 307);
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('X-Request-ID', currentTrace.requestId);
      currentTrace.finish();
      return response;
    }
    const data = await currentTrace.step('home-locks', async () => {
      const upstream = await fetch(apiUrl('/v1/nav/home-locks'), {
        cache: 'no-store', signal: AbortSignal.timeout(5000), headers: { 'X-Request-ID': currentTrace.requestId },
      });
      currentTrace.homeLocksStatus = upstream.status;
      if (!upstream.ok) throw new Error('Lock status unavailable');
      const data = await upstream.json();
      if (!data?.locks || typeof data.locks !== 'object' || Array.isArray(data.locks)
        || Object.values(data.locks).some((value) => typeof value !== 'boolean')) throw new Error('Invalid lock status');
      return data;
    });
    const locked = homeCardsRequireAdmin(cards, data.locks);
    const adminDenied = locked && !(compRole === 'admin' || await currentTrace.step('auth-me', () => verifyPageAdmin(token, currentTrace.requestId)));
    let response: NextResponse;
    if (adminDenied) {
      const target = req.nextUrl.clone();
      target.searchParams.delete('_rsc');
      const next = `${target.pathname}${target.search}`;
      target.pathname = '/auth/page-access';
      target.search = '';
      target.searchParams.set('next', next);
      response = NextResponse.redirect(target, 307);
    } else {
      response = routeLanguage(req);
    }
    response.headers.set('Cache-Control', 'private, no-store');
    if (locked) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('X-Request-ID', currentTrace.requestId);
    currentTrace.finish();
    return response;
  } catch (error) {
    (trace ??= new PageAccessTrace()).finish(true, error);
    return new NextResponse('Page access verification unavailable. Please retry.', {
      status: 503, headers: {
        'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Retry-After': '5',
        ...(trace ? { 'X-Request-ID': trace.requestId } : {}),
      },
    });
  }
}

function routeLanguage(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname, searchParams } = url;

  // App-root, non-[lang] routes: leave entirely alone.
  if (NON_LANG.test(pathname) || /\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();

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

  // Can't transparently rewrite (see cannotRewrite): fall back to a 307 → /en.
  // English then lives at /en there (canonical stays bare via the Link header on
  // the /en serve in branch 2). 307 not 308: the en-vs-zh choice is per-user
  // (cookie / Accept-Language) and must never be cached permanently.
  if (cannotRewrite(req)) {
    const res = NextResponse.redirect(target, 307);
    if (req.cookies.get('lang')?.value !== 'en') setLangCookie(res, 'en');
    return res;
  }

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
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|fonts/|cubing-chunks/|v1/).*)',
  ],
};
