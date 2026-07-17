// i18next initialization for the Next.js App Router.
// Singleton — guarded so HMR / strict-mode double-mount doesn't double-init.
//
// IMPORTANT: i18n is initialized synchronously with lng='en' on BOTH server and
// client first render. Locale detection (URL ?lang= > localStorage > navigator)
// runs only inside I18nProvider's useEffect AFTER hydration, then calls
// i18n.changeLanguage to switch. This makes SSR HTML and the client's first
// paint identical, avoiding hydration mismatches; Chinese-preference users see
// a single en→zh flash on first page load (acceptable).
//
// TWO locales: 'en' and 'zh' (Simplified). Both catalogs are static JSON; there
// is no runtime conversion, so SSR and client render identical text — no
// hydration mismatch, no flash.

import i18n from 'i18next';
import { persistItem } from '@/lib/safe-storage';
import { initReactI18next } from 'react-i18next';
import zh from './zh.json';
import en from './en.json';

export const LANGS = ['en', 'zh'] as const;
export type AppLang = (typeof LANGS)[number];
const isAppLang = (s: string | null | undefined): s is AppLang =>
  !!s && (LANGS as readonly string[]).includes(s);

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    // Resources are bundled inline, so init synchronously: with the default
    // (async) init + useSuspense, useTranslation suspends during SSG prerender
    // and the [lang]/layout <Suspense> swallows it → empty static HTML. Sync
    // init makes i18n ready at first render so pages prerender WITH content.
    initImmediate: false,
    react: { useSuspense: false },
  });
}

// Switch language. Both Chinese catalogs are static, so this is just a plain
// i18next language change (kept as a named helper for call-site clarity).
export function changeAppLanguage(lang: string): void {
  void i18n.changeLanguage(lang);
}

export function normalizeAppLang(l: string | null | undefined): AppLang {
  if (l && l.startsWith('zh')) return 'zh';
  return 'en';
}

export function detectLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (isAppLang(urlLang)) return urlLang;
  const stored = localStorage.getItem('trainer-lang');
  if (isAppLang(stored)) return stored;
  const nav = navigator.language;
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function ensureLangInUrl(lang: string): void {
  if (typeof window === 'undefined') return;
  // Persist to cookie so proxy.ts can SSR with the right language on next
  // navigation (no en→zh flash for returning users).
  document.cookie = `lang=${lang}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  const params = new URLSearchParams(window.location.search);
  if (params.get('lang') === lang) return;
  params.set('lang', lang);
  const safePath = window.location.pathname.replace(/^\/+/, '/');
  const newUrl = `${safePath}?${params.toString()}${window.location.hash}`;
  // global i18n infra (non-React, no hooks) — exempt from the nuqs rule.
  // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
  history.replaceState(null, '', newUrl);
}

export function syncLangToUrl(lang: string): void {
  if (typeof window === 'undefined') return;
  persistItem('trainer-lang', lang);
  document.documentElement.lang = lang;
  // Mirror to cookie so proxy.ts can read it on the next SSR request and
  // render in the right language from the first paint (no en→zh flash).
  document.cookie = `lang=${lang}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  // global i18n infra (non-React, no hooks) — exempt from the nuqs rule.
  // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
  history.replaceState(null, '', url.toString());
}

export default i18n;
