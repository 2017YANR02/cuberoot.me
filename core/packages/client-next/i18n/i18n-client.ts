// i18next initialization for the Next.js App Router.
// Singleton — guarded so HMR / strict-mode double-mount doesn't double-init.
//
// IMPORTANT: i18n is initialized synchronously with lng='en' on BOTH server and
// client first render. Locale detection (URL ?lang= > localStorage > navigator)
// runs only inside I18nProvider's useEffect AFTER hydration, then calls
// i18n.changeLanguage to switch. This makes SSR HTML and the client's first
// paint identical, avoiding hydration mismatches; Chinese-preference users see
// a single en→zh flash on first page load (acceptable).

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh.json';
import en from './en.json';

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

export function detectLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (urlLang && ['zh', 'en'].includes(urlLang)) return urlLang;
  const stored = localStorage.getItem('trainer-lang');
  if (stored && ['zh', 'en'].includes(stored)) return stored;
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
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
  history.replaceState(null, '', newUrl);
}

export function syncLangToUrl(lang: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('trainer-lang', lang);
  document.documentElement.lang = lang;
  // Mirror to cookie so proxy.ts can read it on the next SSR request and
  // render in the right language from the first paint (no en→zh flash).
  document.cookie = `lang=${lang}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url.toString());
}

export function getLangQuery(): string {
  if (typeof window === 'undefined') return '?lang=en';
  const params = new URLSearchParams(window.location.search);
  return `?lang=${params.get('lang') || i18n.language || 'en'}`;
}

export default i18n;
