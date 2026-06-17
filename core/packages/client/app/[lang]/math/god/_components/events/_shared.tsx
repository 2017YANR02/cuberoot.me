'use client';

/**
 * Shared presentational primitives for /math/god?event=X detail bodies.
 *
 * Every per-event detail component (events/<Name>.tsx) is self-contained and
 * imports from here for consistent look + from '../Tex' for math. All visual
 * styling lives in ../../god.css (.god-* classes) — do NOT add new .css.
 *
 * Contract for an event body component:
 *   'use client';
 *   export default function <Name>({ isZh }: { isZh: boolean }) { … }
 *   - render <EvHighlights> once near the top (the headline number row)
 *   - render a sequence of <EvSection> blocks (prose + ≥1 interactive/visual)
 *   - end with <EvRefs> (cited primary sources)
 *
 * i18n: user-facing text goes through tr({zh,en}) (re-exported here) or a local
 * `const t = (zh, en) => (isZh ? zh : en)` helper inside the component (isZh as a
 * util-function parameter is exempt). Never write a bare literal-text ternary in JSX.
 */
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

export { TeX, TeXBlock, MathText } from '../Tex';
export { tr, T } from '@/i18n/tr';

import { tr } from '@/i18n/tr';

/** A localized bilingual string pair. */
export interface ZhEn { zh: string; en: string }

/* ── headline number cards ─────────────────────────────────────────── */

export interface HighlightCard {
  /** big value — number, string, or KaTeX node */
  num: ReactNode;
  /** caption under the number */
  cap: string;
  /** small sub-line (attribution / status) */
  sub?: ReactNode;
  /** colour tone of the top bar + number */
  tone?: 'accent' | 'warn' | 'wca';
}

export function EvHighlights({ cards }: { cards: HighlightCard[] }) {
  return (
    <div className="god-highlights" style={{ marginBottom: '2rem' }}>
      {cards.map((c, i) => (
        <div key={i} className="god-hl-card"
             style={c.tone === 'warn'
               ? { ['--god-accent' as string]: 'var(--god-warn)' }
               : c.tone === 'wca'
               ? { ['--god-accent' as string]: 'var(--god-wca)' }
               : undefined}>
          <div className="god-hl-num">{c.num}</div>
          <div className="god-hl-cap">{c.cap}</div>
          {c.sub != null && <div className="god-hl-sub">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── section ───────────────────────────────────────────────────────── */

export function EvSection({ title, lead, children }: {
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="god-section god-ev-body">
      <h2>{title}</h2>
      {lead != null && <p className="god-sec-lead">{lead}</p>}
      {children}
    </section>
  );
}

/* ── callout / definition box ──────────────────────────────────────── */

export function EvCallout({ tone, heading, children }: {
  tone?: 'accent' | 'warn' | 'info';
  heading?: ReactNode;
  children: ReactNode;
}) {
  const cls = tone === 'warn' ? 'is-warn' : tone === 'info' ? 'is-info' : '';
  return (
    <div className={`god-ev-callout ${cls}`}>
      {heading != null && <div className="god-ev-callout-h">{heading}</div>}
      {children}
    </div>
  );
}

/* ── references ────────────────────────────────────────────────────── */

export interface RefItem { url: string; zh: string; en: string }

export function EvRefs({ refs, title }: { refs: RefItem[]; title?: ZhEn }) {
  return (
    <section className="god-section">
      <h2>{title ? tr(title) : tr({ zh: '参考资料', en: 'References' })}</h2>
      <ul className="god-refs">
        {refs.map((r) => (
          <li key={r.url}>
            <a href={r.url} target="_blank" rel="noopener noreferrer">
              {tr({ zh: r.zh, en: r.en })}{' '}
              <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── small stat strip (reuses distance-distribution summary styling) ─ */

export interface StatItem { label: string; value: ReactNode }

export function EvStatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="god-dist-summary" style={{ marginTop: 0 }}>
      {items.map((s, i) => (
        <div key={i}>
          <div className="god-dist-stat-label">{s.label}</div>
          <div className="god-dist-stat-num">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
