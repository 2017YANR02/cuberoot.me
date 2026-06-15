'use client';

// Ported from packages/client/src/utils/useDocumentTitle.ts.
// Same brand + em-dash separator. Resets on unmount so unsetting pages tab to "CubeRoot".

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const BRAND = 'CubeRoot';
const SEP = ' — ';

export function useDocumentTitle(zh: string, en: string): void {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useEffect(() => {
    const page = (isZh ? zh : en).trim();
    document.title = page ? `${page}${SEP}${BRAND}` : BRAND;
    return () => {
      document.title = BRAND;
    };
  }, [zh, en, isZh, i18n.language]);
}
