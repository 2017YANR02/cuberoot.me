'use client';

// Centralised localized strings for the chapter registry, so every render site
// (hub cards, chapter hero, prev/next nav) stays consistent:
//   - badge uses template-literal t()
//   - title / tagline go through tr() on the registry's { zh, en } objects

import { useT } from '../../../../hooks/useT';
import { tr } from '@/i18n/tr';
import type { RegArticle } from '../_data/articles';

export function useRegText() {
  const t = useT();
  return {
    badge: (a: RegArticle) =>
      a.group === 'core'
        ? t(`第 ${a.num} 章`, `Article ${a.num}`)
        : t(`附则 ${a.num}`, `Article ${a.num}`),
    title: (a: RegArticle) => tr(a.title),
    tagline: (a: RegArticle) => tr(a.tagline),
  };
}
