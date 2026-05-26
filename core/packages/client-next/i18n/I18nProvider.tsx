'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { detectLanguage, ensureLangInUrl } from './i18n-client';

export default function I18nProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang: 'zh' | 'en';
}) {
  // Sync init: flip i18n to initialLang BEFORE any child reads t(). This runs
  // on both the server render (sets the per-request server-side singleton) and
  // the client first paint (matches the server HTML) — so React's hydration
  // diff is empty even when the user comes in with ?lang=zh.
  if (i18n.language !== initialLang) {
    void i18n.changeLanguage(initialLang);
  }

  const [instance] = useState(() => i18n);

  // Post-hydration: reconcile URL ?lang= vs localStorage vs navigator, in case
  // the URL had no ?lang= and the user had a stored preference.
  useEffect(() => {
    const lang = detectLanguage();
    ensureLangInUrl(lang);
    localStorage.setItem('trainer-lang', lang);
    if (instance.language !== lang) void instance.changeLanguage(lang);
  }, [instance]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
