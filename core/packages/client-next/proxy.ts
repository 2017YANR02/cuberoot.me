// Next 16 proxy (formerly middleware). Runs before route render.
// Job during Phase 3 [lang] migration:
//
//   1. ?lang=zh|en on ANY path → set `lang` cookie + 308 redirect to the
//      same path with the lang prefix prepended (if not already prefixed).
//   2. Bare path /foo (no /en or /zh prefix) on a path that IS migrated →
//      308 redirect to /<cookie-lang>/foo. List of migrated paths kept in
//      MIGRATED_PATHS below; each Phase-3 batch appends to it.
//   3. Bare path on a path NOT yet migrated → pass through unchanged.
//
// This split keeps backward-compatible URLs working for not-yet-migrated
// pages while immediately giving migrated pages clean /zh/ /en/ form.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'zh'] as const;
type Locale = typeof SUPPORTED_LOCALES[number];

// Routes (without /en or /zh prefix) that have been migrated to app/[lang]/*.
// Updated per Phase-3 batch. Match against pathname *exactly* or as a prefix
// (e.g. '/math/god' matches '/math/god' but NOT '/math/godfather').
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
  const { locale } = stripLocalePrefix(pathname);
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
