'use client';

// Ported from packages/client-vite/src/utils/useDocumentTitle.ts.
// Subpages use only their page name so narrow browser tabs stay distinguishable.
// The empty title is reserved for the landing page and falls back to "CubeRoot".

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const BRAND = 'CubeRoot';

// All mounted consumers share one writer. Independent observers would keep
// replacing each other's titles in an endless MutationObserver microtask loop.
const titleOwners = new Map<symbol, string>();
let titleObserver: MutationObserver | null = null;

function applyTitle() {
  const title = [...titleOwners.values()].at(-1) ?? BRAND;
  if (document.title !== title) document.title = title;
}

export function useDocumentTitle(zh: string, en: string, enabled = true): void {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useEffect(() => {
    if (!enabled) return;
    const page = (isZh ? zh : en).trim();
    const title = page || BRAND;
    const owner = Symbol();
    titleOwners.set(owner, title);
    applyTitle();
    if (!titleObserver) {
      titleObserver = new MutationObserver(applyTitle);
      titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    }
    return () => {
      titleOwners.delete(owner);
      if (titleOwners.size === 0) {
        titleObserver?.disconnect();
        titleObserver = null;
      }
      applyTitle();
    };
  }, [zh, en, isZh, i18n.language, enabled]);
}
