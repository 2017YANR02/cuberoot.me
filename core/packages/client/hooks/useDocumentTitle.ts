'use client';

// Ported from packages/client-vite/src/utils/useDocumentTitle.ts.
// Subpages use only their page name so narrow browser tabs stay distinguishable.
// The empty title is reserved for the landing page and falls back to "CubeRoot".

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const BRAND = 'CubeRoot';

export function useDocumentTitle(zh: string, en: string, enabled = true): void {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useEffect(() => {
    if (!enabled) return;
    const page = (isZh ? zh : en).trim();
    const title = page || BRAND;
    const applyTitle = () => {
      if (document.title !== title) document.title = title;
    };
    applyTitle();
    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = BRAND;
    };
  }, [zh, en, isZh, i18n.language, enabled]);
}
