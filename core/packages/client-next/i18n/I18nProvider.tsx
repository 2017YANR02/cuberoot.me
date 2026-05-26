'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { detectLanguage, ensureLangInUrl } from './i18n-client';

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [instance] = useState(() => i18n);

  // i18n boots with 'en' so SSR HTML and the client's first paint match;
  // we switch to the user's preferred lang here, AFTER hydration. zh users
  // see a single en→zh flash on first paint (acceptable — see layout.tsx
  // suppressHydrationWarning + Phase 3 [lang] migration plan for a full fix).
  useEffect(() => {
    const lang = detectLanguage();
    ensureLangInUrl(lang);
    localStorage.setItem('trainer-lang', lang);
    if (instance.language !== lang) void instance.changeLanguage(lang);
  }, [instance]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
