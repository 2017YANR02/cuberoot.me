'use client';

// Shared visual building blocks for the WCA Regulations chapters. Every chapter
// page reuses these so the look stays consistent. Text is passed in as ReactNode
// (wrap bilingual content with <T> or the useT() helper at the call site).
//
// CSS lives in ../regulation.css (imported by RegArticleLayout, so it's present
// on every chapter page).

import type { ReactNode } from 'react';
import { Info, TriangleAlert, Ban, CircleCheckBig } from 'lucide-react';

/* ── Section wrapper ──────────────────────────────────────────────
 * Standard chapter section: small eyebrow, big title, optional lede,
 * then children. Pass already-localized ReactNode (use <T>/useT()). */
export function RegSection({
  id, eyebrow, title, lede, children,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="reg-sec" id={id}>
      {eyebrow != null && <div className="reg-sec-eyebrow">{eyebrow}</div>}
      <h2 className="reg-sec-title">{title}</h2>
      {lede != null && <p className="reg-sec-lede">{lede}</p>}
      {children}
    </section>
  );
}

/* ── Callout / key-principle box ──────────────────────────────────
 * tone drives the accent colour. Default icon per tone, override via `icon`. */
type Tone = 'info' | 'warn' | 'danger' | 'success';
const TONE_ICON: Record<Tone, ReactNode> = {
  info: <Info size={17} />,
  warn: <TriangleAlert size={17} />,
  danger: <Ban size={17} />,
  success: <CircleCheckBig size={17} />,
};

export function Callout({
  tone = 'info', label, icon, children, style,
}: {
  tone?: Tone;
  label?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`reg-key reg-key-${tone}`} style={style}>
      {label != null && (
        <div className="reg-key-label">
          {icon ?? TONE_ICON[tone]}
          {label}
        </div>
      )}
      <div className="reg-key-text">{children}</div>
    </div>
  );
}

/* ── Regulation quote ─────────────────────────────────────────────
 * Blockquote with the regulation number tag (e.g. "5b5f"). Use for the
 * occasional close paraphrase of the actual regulation wording. */
export function RegQuote({ num, children }: { num?: ReactNode; children: ReactNode }) {
  return (
    <div className="reg-quote">
      {num != null && <span className="reg-quote-num">{num}</span>}
      <p className="reg-quote-text">{children}</p>
    </div>
  );
}

/* ── Bulleted list ────────────────────────────────────────────────
 * Each item is a ReactNode. Matches .reg-list styling (accent dots). */
export function RegList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="reg-list">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

/* ── Verdict badge (used by the defects guide and penalty examples) ── */
export type Verdict = 'solved' | 'dnf' | 'plus2' | 'delegate';
const VERDICT_CLS: Record<Verdict, string> = {
  solved: 'v-solved', dnf: 'v-dnf', plus2: 'v-plus2', delegate: 'v-delegate',
};
export function VerdictBadge({ verdict, children }: { verdict: Verdict; children: ReactNode }) {
  return <span className={`reg-ex-verdict ${VERDICT_CLS[verdict]}`}>{children}</span>;
}

/* ── Inspection timeline (0–17 s) ─────────────────────────────────
 * Used by Appendix A (Speed Solving). `legend` items are pre-localized. */
export function InspectionTimeline({ legend }: { legend: { tone: 'ok' | 'tick' | 'warn' | 'bad'; label: ReactNode }[] }) {
  const scale = 19; // 0..19s, 17 lands at ~89%
  const pct = (s: number) => `${((s / scale) * 100).toFixed(1)}%`;
  const ticks = [8, 12, 15, 17];
  return (
    <figure className="reg-timeline">
      <div className="reg-timeline-track">
        {ticks.map((s) => <span key={s} className="reg-timeline-tick" style={{ left: pct(s) }} />)}
      </div>
      <div className="reg-timeline-axis">
        {ticks.map((s) => <span key={s} className="reg-timeline-num" style={{ left: pct(s) }}>{s}s</span>)}
      </div>
      <ul className="reg-timeline-legend">
        {legend.map((l, i) => <li key={i} className={l.tone}>{l.label}</li>)}
      </ul>
    </figure>
  );
}

/* ── Misalignment angle figure ────────────────────────────────────
 * A target square + a rotated overlay + an arc showing `deg` of rotation.
 * Used by Article 10 (Solved State). tone: ok (within limit) / warn (over). */
export function AngleFigure({ deg, tone, cap }: { deg: number; tone: 'ok' | 'warn'; cap: ReactNode }) {
  const cx = 50, cy = 50, r = 23;
  const rad = (deg - 90) * Math.PI / 180;
  const ex = (cx + r * Math.cos(rad)).toFixed(2);
  const ey = (cy + r * Math.sin(rad)).toFixed(2);
  const large = deg > 180 ? 1 : 0;
  return (
    <figure className={`reg-angle reg-angle-${tone}`}>
      <svg viewBox="0 0 100 100" className="reg-angle-svg" aria-hidden="true">
        <rect x="22" y="22" width="56" height="56" rx="8" className="reg-angle-target" />
        <g transform={`rotate(${deg} 50 50)`}>
          <rect x="22" y="22" width="56" height="56" rx="8" className="reg-angle-cur" />
        </g>
        <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`} className="reg-angle-arc" />
        <text x="50" y="55" className="reg-angle-deg">{deg}°</text>
      </svg>
      <figcaption className="reg-angle-cap">{cap}</figcaption>
    </figure>
  );
}
