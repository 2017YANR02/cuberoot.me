// i18next initialization for the Next.js App Router.
// Singleton — guarded so HMR / strict-mode double-mount doesn't double-init.
// Detection priority (parity with packages/client/src/i18n/index.ts):
//   URL ?lang= > localStorage('trainer-lang') > navigator.language
//
// Importing this file has the side effect of init. Always import from a
// 'use client' boundary — never from server components.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh.json';
import en from './en.json';

function detectLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (urlLang && ['zh', 'en'].includes(urlLang)) return urlLang;
  const stored = localStorage.getItem('trainer-lang');
  if (stored && ['zh', 'en'].includes(stored)) return stored;
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

if (!i18n.isInitialized) {
  const detected = detectLanguage();

  // Mirror packages/client behaviour: ensure ?lang= is in the URL on first land.
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('lang')) {
      params.set('lang', detected);
      const safePath = window.location.pathname.replace(/^\/+/, '/');
      const newUrl = `${safePath}?${params.toString()}${window.location.hash}`;
      history.replaceState(null, '', newUrl);
    }
    localStorage.setItem('trainer-lang', detected);
  }

  void i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: detected,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export function syncLangToUrl(lang: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('trainer-lang', lang);
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
