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
    // No cleanup — title is reset by the next page's hook or by Next's RSC
    // route transition. Cleanup raced with our own re-set on lang flip.
  }, [zh, en, isZh]);
}
