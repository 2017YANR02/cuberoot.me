'use client';

/**
 * Shared primitives for /math/group and its section components.
 *
 * Extracted verbatim from page.tsx so that the self-contained section files in
 * ./sections/*.tsx render inside the SAME slug-gated context. Every section
 * imports { GTSec, L, TeX, TeXBlock, useLang, TwistyMini, type Lang } from
 * '../primitives' and the cube-state helpers from '../cube_state'. Nothing here
 * may import from page.tsx (that would create an import cycle).
 */
import { useMemo, createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ── LaTeX rendering via KaTeX ───────────────────────────────────────────────
export function TeX({ src }: { src: string }) {
  const html = useMemo(() => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore' }), [src]);
  return <span className="gt-tex" dangerouslySetInnerHTML={{ __html: html }} />;
}
export function TeXBlock({ src }: { src: string }) {
  const html = useMemo(() => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore', displayMode: true }), [src]);
  // Use <span> with display:block so it can sit inside <p> without hydration errors.
  return <span className="gt-tex-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Slug context for per-section pages ─────────────────────────────────────
// Slug is undefined on the index page (just hero + TOC), or one of the TOC ids
// on a section sub-page. GTSec renders only when its id matches the slug — so
// a single big return body can serve both modes.
export const SlugContext = createContext<string | undefined>(undefined);

export function GTSec({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const slug = useContext(SlugContext);
  if (slug !== id) return null;
  return <section id={id} className={className}>{children}</section>;
}

// ── i18n helpers ────────────────────────────────────────────────────────────
export type Lang = 'zh' | 'en';
export function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  return <>{lang === 'zh' ? zh : en}</>;
}
export function useLang(): Lang {
  const { i18n } = useTranslation();
  return (i18n.language.startsWith('zh') ? 'zh' : 'en');
}

// ── Inline TwistyPlayer ─────────────────────────────────────────────────────
// TwistyMini intentionally lives locally in page.tsx (not exported here) so that
// its onPlayerReady function prop does not trip Next's RSC serializable-props
// check (TS71007) on this 'use client' entry module. No section file uses it.
