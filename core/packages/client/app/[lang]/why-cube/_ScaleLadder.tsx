'use client';

// B1 — 数量阶梯 / Scale ladder.
// Puts the 43-quintillion Rubik's-cube states on a base-10 LOG scale next to a
// few relatable (but only approximate) quantities, so the gap between them
// reads as "each rung ≈ ×10" rather than a flat, meaningless number. Bars grow
// and the leading digits count up when the widget scrolls into view; the final
// cube row is the only exact figure and is highlighted in accent.

import { useTranslation } from 'react-i18next';
import { useT } from '../../../hooks/useT';
import { useInView, useCountUp, useReducedMotion } from './_hooks';
import './_ScaleLadder.css';

// Map "1.17 × 10¹¹" → real unicode superscript exponent.
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
function sup(n: number): string {
  return String(n).split('').map((d) => SUP[d] ?? d).join('');
}

type Rung = {
  key: string;
  label: string;       // bilingual short label
  source: string;      // bilingual muted source note
  mantissa: number;    // leading digits, e.g. 1.17
  mantDecimals: number; // how many decimals to show while counting
  exp: number;         // power of ten
  value: number;       // full numeric value (for log10)
  exact?: string;      // exact comma-grouped digits (cube only)
  accent?: boolean;
};

export default function ScaleLadder() {
  useTranslation(); // subscribe to the language toggle
  const t = useT();
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: '120px' });

  const rungs: Rung[] = [
    {
      key: 'humans',
      label: t('人类历史上活过的总人数', 'Humans who have ever lived'),
      source: t('据 PRB 估算', 'PRB estimate'),
      mantissa: 1.17, mantDecimals: 2, exp: 11, value: 1.17e11,
    },
    {
      key: 'bigbang',
      label: t('宇宙诞生至今的秒数', 'Seconds since the Big Bang'),
      source: t('约 138 亿年', '≈ 13.8 billion years'),
      mantissa: 4.35, mantDecimals: 2, exp: 17, value: 4.35e17,
    },
    {
      key: 'sand',
      label: t('地球所有沙滩的沙粒数', "Grains of sand on all Earth's beaches"),
      source: t('常见估算', 'common estimate'),
      mantissa: 7.5, mantDecimals: 1, exp: 18, value: 7.5e18,
    },
    {
      key: 'cube',
      label: t('三阶魔方的状态数', "Rubik's-Cube states"),
      source: t('精确值', 'exact value'),
      mantissa: 4.33, mantDecimals: 2, exp: 19, value: 4.3252003274489856e19,
      exact: '43,252,003,274,489,856,000',
      accent: true,
    },
  ];

  // Log scale: bar length ∝ log10(value), zoomed so the *differences* between
  // rungs are visible. Floor a touch below the smallest exponent so the first
  // bar still has presence; cap at the cube exponent (→ full width).
  const lo = 10; // log10 floor
  const hi = Math.log10(rungs[rungs.length - 1].value);
  const pct = (v: number) => {
    const f = (Math.log10(v) - lo) / (hi - lo);
    return Math.max(6, Math.min(100, f * 100));
  };

  return (
    <div className="wc-ladder" ref={ref} data-inview={inView ? '1' : '0'}>
      <ul className="wc-ladder-list">
        {rungs.map((r) => (
          <LadderRow key={r.key} r={r} width={pct(r.value)} active={inView} reduced={reduced} sup={sup} />
        ))}
      </ul>

      <p className="wc-ladder-caption">
        {t(
          '这是对数刻度 — 每往上一格,数量大约 ×10。所以最后一格不是「大一点」,而是又乘了一次又一次又一次的 10。',
          "This is a log scale — each rung up is roughly ×10. So the last rung isn't 'a bit bigger': it's ten, times ten, times ten, again and again."
        )}
      </p>
    </div>
  );
}

function LadderRow({
  r, width, active, reduced, sup,
}: {
  r: Rung; width: number; active: boolean; reduced: boolean; sup: (n: number) => string;
}) {
  // Grow the bar from 0 → its log-scale width once in view.
  const grown = useCountUp(width, active, { duration: 1100 });
  // Count the leading mantissa digits up.
  const liveMant = useCountUp(r.mantissa, active, { duration: 1300 });
  const barW = active ? (reduced ? width : grown) : 0;
  const mant = active ? (reduced ? r.mantissa : liveMant) : 0;

  return (
    <li className={`wc-ladder-row${r.accent ? ' is-cube' : ''}`}>
      <div className="wc-ladder-head">
        <span className="wc-ladder-label">{r.label}</span>
        <span className="wc-ladder-value">
          <span className="wc-ladder-approx">{r.accent ? '=' : '≈'}</span>
          <span className="wc-ladder-num">
            {mant.toFixed(r.mantDecimals)} × 10<sup>{sup(r.exp)}</sup>
          </span>
        </span>
      </div>

      <div className="wc-ladder-track" aria-hidden>
        <div
          className="wc-ladder-bar"
          style={{ width: `${barW}%` }}
        />
      </div>

      <div className="wc-ladder-foot">
        {r.exact && <span className="wc-ladder-exact">{r.exact}</span>}
        <span className="wc-ladder-source">{r.source}</span>
      </div>
    </li>
  );
}
