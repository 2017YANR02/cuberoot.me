// Next 16 proxy (formerly middleware). Runs before every page render and owns
// the site's language-prefix routing (/en/ /zh/). The [lang] migration is
// COMPLETE — every owned page lives under app/[lang]/* — so this is now the
// permanent lang-routing layer, NOT a migration shim. What it does:
//
//   1. ?lang=zh|en on ANY path → set `lang` cookie + 308 redirect to the same
//      path with the lang prefix prepended. Keeps old ?lang= links (Vite era)
//      working.
//   2. Bare path /foo (no /en or /zh prefix) that is a known top-level route →
//      308 redirect to /<cookie-lang>/foo (cookie, else Accept-Language).
//      "Known" = the MIGRATED_PATHS whitelist below.
//   3. /<lang>/foo (already prefixed) → pass through; refresh the `lang` cookie
//      and inject the x-lang request header so the root layout SSRs in the
//      URL's locale.
//
// IMPORTANT: MIGRATED_PATHS is a HAND-MAINTAINED whitelist. EVERY new top-level
// app/[lang]/<route> MUST be added here, or its bare /<route> form won't get a
// lang prefix and will 404 (only /en/<route> + /zh/<route> would work — this is
// exactly what bit /article). A bare path NOT in the list falls through to
// [lang]/page.tsx with lang=<that-segment>, which notFound()s; there are no
// un-migrated pages left to fall back to.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'zh'] as const;
type Locale = typeof SUPPORTED_LOCALES[number];

// Top-level routes (without /en or /zh prefix) under app/[lang]/*. This IS the
// lang-routing whitelist — ADD EVERY NEW TOP-LEVEL ROUTE HERE. Match is exact
// or by path prefix (e.g. '/math' matches '/math' and '/math/god' but NOT
// '/mathx'). The "batch N" comments below are just migration history.
const MIGRATED_PATHS: readonly string[] = [
  '/', // app/[lang]/page.tsx
  '/about',
  '/math',       // /math, /math/god, /math/demigod, /math/group/[slug], /math/unit-distance
  '/visualcube', // /visualcube, /visualcube/stages
  '/2x2x2',
  '/ffmpeg-poc',
  '/jsonEditor',
  // batch 2 — simple iframe / single-file pages
  '/alg-trainers',
  '/algTrainer',
  '/cstimer',
  '/documentation',
  '/solver',
  // batch 3 — feature -about pages
  '/calc-about',
  '/frame-count-about',
  '/mosaic-about',
  '/nemesizer-about',
  '/recon-about',
  // batch 4 — simple feature pages
  '/battle',
  '/frame-count',
  '/mosaic',
  '/sim',
  '/site',
  '/wb',
  // batch 5 — 8 trainer variants (each is a single page.tsx)
  '/cross_trainer',
  '/eocross_trainer',
  '/pairing_trainer',
  '/pseudo_pairing_trainer',
  '/pseudo_xcross_trainer',
  '/xcross_pairing_trainer',
  '/xcross_trainer',
  '/xxcross_trainer',
  // batch 6 — alg library + calc
  '/alg',
  '/calc',
  // batch 7 — code subtree
  '/code',
  // batch 8 — memo / nemesizer / recognize
  '/memo',
  '/nemesizer',
  '/recognize',
  // batch 9 — recon / scramble
  '/recon',
  '/scramble',
  // batch 10 — timer
  '/timer',
  // batch 11 — trainer (41-set CFOP/method trainer)
  '/trainer',
  // batch 12 — tutorial / wca / wiki (final batch — all pages migrated)
  '/tutorial',
  '/wca',
  '/wiki',
  // batch 13 — community long-form articles (/article, /article/:slug, /article/new,
  // /article/:slug/edit, /article/author/:wcaId, /article/admin/reports)
  '/article',
];

function isMigrated(pathname: string): boolean {
  for (const p of MIGRATED_PATHS) {
    if (p === '/' && pathname === '/') return true;
    if (p !== '/' && (pathname === p || pathname.startsWith(p + '/'))) return true;
  }
  return false;
}

function stripLocalePrefix(pathname: string): { locale: Locale | null; rest: string } {
  for (const loc of SUPPORTED_LOCALES) {
    if (pathname === `/${loc}`) return { locale: loc, rest: '/' };
    if (pathname.startsWith(`/${loc}/`)) return { locale: loc, rest: pathname.slice(loc.length + 1) };
  }
  return { locale: null, rest: pathname };
}

function getCookieLocale(req: NextRequest): Locale {
  const v = req.cookies.get('lang')?.value;
  if (v === 'zh' || v === 'en') return v;
  // Accept-Language fallback
  const al = req.headers.get('accept-language') ?? '';
  return al.toLowerCase().includes('zh') ? 'zh' : 'en';
}

// SEO canonical + hreflang, emitted as HTTP Link headers (Google & Bing both
// honor these). Done HERE, in the proxy, on purpose: it's one central place that
// covers all ~128 routes without touching a single page component, and it's
// SSG-safe — middleware runs on every request, including prerendered/CDN-cached
// pages, so adding a response header doesn't opt anything into dynamic rendering.
// Host is hard-pinned to www so apex / next.cuberoot.me / *.vercel.app previews
// all self-consolidate onto the one canonical host. Path-only (query dropped) so
// ?lang= / ?tab= and other view-state variants collapse to the page's canonical.
const CANONICAL_HOST = 'https://www.cuberoot.me';

function setSeoLinkHeaders(res: NextResponse, rest: string, locale: Locale) {
  const sub = rest === '/' ? '' : rest;
  const en = `${CANONICAL_HOST}/en${sub}`;
  const zh = `${CANONICAL_HOST}/zh${sub}`;
  const self = locale === 'zh' ? zh : en;
  // append (not set) so we never clobber Next's own preload Link headers.
  res.headers.append(
    'Link',
    [
      `<${self}>; rel="canonical"`,
      `<${en}>; rel="alternate"; hreflang="en"`,
      `<${zh}>; rel="alternate"; hreflang="zh"`,
      `<${en}>; rel="alternate"; hreflang="x-default"`,
    ].join(', '),
  );
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname, searchParams } = url;

  // 1. ?lang=zh|en handling — strip query, set cookie, ensure /zh/ /en/ prefix.
  const queryLang = searchParams.get('lang');
  if (queryLang === 'zh' || queryLang === 'en') {
    const target = url.clone();
    target.searchParams.delete('lang');
    const { locale: existingPrefix, rest } = stripLocalePrefix(pathname);
    // If already prefixed but with a different lang, the query wins (rare).
    if (existingPrefix && existingPrefix !== queryLang) {
      target.pathname = `/${queryLang}${rest === '/' ? '' : rest}`;
    } else if (!existingPrefix && isMigrated(pathname)) {
      target.pathname = `/${queryLang}${pathname === '/' ? '' : pathname}`;
    } else if (existingPrefix === queryLang) {
      // Already correctly prefixed — just drop the query.
      // target.pathname stays.
    }
    // else: bare path on not-yet-migrated page → just drop query, stay put.
    const res = NextResponse.redirect(target, 308);
    res.cookies.set('lang', queryLang, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    });
    return res;
  }

  // 2. Bare migrated path → redirect to /<cookie-lang>/path.
  const { locale, rest } = stripLocalePrefix(pathname);
  if (!locale && isMigrated(pathname)) {
    const lang = getCookieLocale(req);
    const target = url.clone();
    target.pathname = `/${lang}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(target, 308);
  }

  // 3. If user is on a /<lang>/ path, refresh the cookie AND inject x-lang
  //    request header so root layout SSR uses the URL locale (not cookie/AL).
  //    Letting root own the i18n means we don't need a nested I18nProvider in
  //    [lang]/layout — and that nested provider was the Turbopack dev death:
  //    RSC serializer hits an internal loop with provider-nested-under-async-
  //    root-layout on pages of any nontrivial size (audited 2026-05-26).
  if (locale) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-lang', locale);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (req.cookies.get('lang')?.value !== locale) {
      res.cookies.set('lang', locale, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      });
    }
    setSeoLinkHeaders(res, rest, locale);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals, API rewrites, worker chunks, and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|fonts/|cubing-chunks/|v1/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|css|js|map|wasm|json|xml|txt|geojson|tsv|csv|bin|gz)$).*)',
  ],
};
