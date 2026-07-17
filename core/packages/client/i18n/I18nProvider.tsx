'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { detectLanguage, ensureLangInUrl, changeAppLanguage } from './i18n-client';
import { persistItem } from '@/lib/safe-storage';

// `initialLang`: when provided (e.g. from app/[lang]/layout reading URL param),
// skip the post-hydration detect → changeLanguage dance. No en→zh flash for
// /zh/* URLs because i18n is set to the locale synchronously in render below.
// When omitted (root layout, pre-Phase-3 backward-compat pages), fall back to
// URL ?lang= / cookie / navigator detection in useEffect.
//
// Both catalogs (en/zh) are static, so there's no runtime conversion and no
// hydration gating to do here.
export default function I18nProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang?: 'zh' | 'en';
}) {
  const [instance] = useState(() => i18n);

  // Synchronous lang switch when [lang]/layout passed an explicit locale.
  // i18n is a singleton — last-write-wins, fine for single-request SSR.
  if (initialLang && instance.language !== initialLang) {
    void instance.changeLanguage(initialLang);
  }

  useEffect(() => {
    if (initialLang) {
      // [lang]-prefixed route: just persist for cross-visit consistency.
      persistItem('trainer-lang', initialLang);
      return;
    }
    // Legacy bare-path route: detect from URL/localStorage/navigator.
    const lang = detectLanguage();
    ensureLangInUrl(lang);
    persistItem('trainer-lang', lang);
    if (instance.language !== lang) changeAppLanguage(lang);
  }, [instance, initialLang]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
