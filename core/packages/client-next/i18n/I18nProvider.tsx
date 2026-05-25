'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { detectLanguage, ensureLangInUrl } from './i18n-client';

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [instance] = useState(() => i18n);

  // Post-hydration locale switch. i18n boots with 'en' so SSR HTML and the
  // client's first paint match; the actual user pref takes over here.
  useEffect(() => {
    const lang = detectLanguage();
    ensureLangInUrl(lang);
    localStorage.setItem('trainer-lang', lang);
    if (instance.language !== lang) void instance.changeLanguage(lang);
  }, [instance]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
