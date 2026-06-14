'use client';

// B2 — 上帝之数步数分布直方图 / God's Number distance distribution.
// A self-made log-scale histogram: how many of the 43,252,003,274,489,856,000
// solvable 3×3 positions sit at each OPTIMAL solving distance 0–20 in the
// half-turn metric. Counts span 1 → ~10^19 so bar height is on a log scale;
// linear would hide everything but 17–19. d=0–15 are exact (Rokicki et al.),
// d=16–20 are estimates. Data: https://www.cube20.org/
//
// No section heading here — the page wraps this in its own <section>.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInView, useReducedMotion } from './_hooks';
import { useT } from '../../../hooks/useT';
import './_GodsNumberDist.css';

type Bin = { d: number; count: bigint; exact: boolean };

// Exact integers (d 0–15) and estimates (d 16–20) from cube20.org. Counts use
// BigInt — d 14/15 already exceed Number.MAX_SAFE_INTEGER, so plain numbers
// would corrupt the trailing digits of the EXACT values.
const BINS: Bin[] = [
  { d: 0, count: 1n, exact: true },
  { d: 1, count: 18n, exact: true },
  { d: 2, count: 243n, exact: true },
  { d: 3, count: 3240n, exact: true },
  { d: 4, count: 43239n, exact: true },
  { d: 5, count: 574908n, exact: true },
  { d: 6, count: 7618438n, exact: true },
  { d: 7, count: 100803036n, exact: true },
  { d: 8, count: 1332343288n, exact: true },
  { d: 9, count: 17596479795n, exact: true },
  { d: 10, count: 232248063316n, exact: true },
  { d: 11, count: 3063288809012n, exact: true },
  { d: 12, count: 40374425656248n, exact: true },
  { d: 13, count: 531653418284628n, exact: true },
  { d: 14, count: 6989320578825358n, exact: true },
  { d: 15, count: 91365146187124313n, exact: true },
  { d: 16, count: 1100000000000000000n, exact: false },
  { d: 17, count: 12000000000000000000n, exact: false },
  { d: 18, count: 29000000000000000000n, exact: false },
  { d: 19, count: 1500000000000000000n, exact: false },
  { d: 20, count: 490000000n, exact: false },
];

const TOTAL = 43252003274489856000n;

// log10 of a BigInt via digit-length + leading mantissa (Number can't hold
// these magnitudes). Plenty of significant figures for a bar height.
function log10Big(n: bigint): number {
  if (n <= 0n) return 0;
  const s = n.toString();
  const digits = s.length;
  const leadDigits = Math.min(15, digits);
  const lead = Number(s.slice(0, leadDigits));
  return (digits - 1) + Math.log10(lead / Math.pow(10, leadDigits - 1));
}

// Log-scale height: log10(count) mapped to [0,1] against the tallest bar.
const MAX_LOG = Math.max(...BINS.map((b) => log10Big(b.count)));
function heightPct(count: bigint): number {
  return (log10Big(count) / MAX_LOG) * 100;
}

// Full-digit grouping with thin separators.
function groupDigits(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Short magnitude for the footnote ("≈ 4.33×10^19").
function scientific(n: bigint): string {
  const s = n.toString();
  const exp = s.length - 1;
  const mant = Number(s.slice(0, 3)) / 100;
  const m = (Math.round(mant * 100) / 100).toString();
  return `${m}×10^${exp}`;
}

export default function GodsNumberDist() {
  useTranslation();
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>({ once: true, rootMargin: '120px' });
  const reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const animate = inView && !reduced;

  const sel = active != null ? BINS[active] : null;

  return (
    <div className="gnd" ref={ref}>
      <p className="gnd-lede">
        {t(
          '把全部约 4322 亿亿种状态按「最优还原步数」摊开:绝大多数打乱只需 17–18 步就能解,真正逼到上帝之数 20 步的状态只有约 4.9 亿个,在 43,252,003,274,489,856,000 这个天文数字面前几近于零。',
          'Spread all ~43 quintillion states by their optimal solving distance: the vast majority need only 17–18 moves, and only about 490 million states truly require the full God’s Number of 20 — essentially nothing next to the 43,252,003,274,489,856,000 total.'
        )}
      </p>

      <div className="gnd-readout" role="status" aria-live="polite">
        {sel ? (
          <>
            <span className="gnd-readout-d">
              {t('距离', 'Distance')}&nbsp;<span className="gnd-num">{sel.d}</span>
            </span>
            <span className="gnd-readout-count">
              {!sel.exact && <span className="gnd-approx" aria-hidden>≈</span>}
              <span className="gnd-num">{groupDigits(sel.count)}</span>
              <span className="gnd-readout-unit">{t('种状态', 'states')}</span>
            </span>
            <span className={`gnd-readout-tag${sel.exact ? '' : ' is-est'}`}>
              {sel.exact ? t('精确值', 'exact count') : t('估计值', 'estimate')}
            </span>
          </>
        ) : (
          <span className="gnd-readout-hint">
            {t('悬停或点选某根柱子,查看该步数下的状态数。', 'Hover or tap a bar to see how many states sit at that distance.')}
          </span>
        )}
      </div>

      <div
        className="gnd-chart"
        role="img"
        onMouseLeave={() => setActive(null)}
        aria-label={t(
          '3x3 魔方各最优还原步数(0 到 20,半转计步)对应的状态数对数刻度直方图',
          'Log-scale histogram of how many 3×3 cube states sit at each optimal solving distance from 0 to 20 in the half-turn metric'
        )}
      >
        {BINS.map((b, i) => {
          const isGod = b.d === 20;
          const isActive = active === i;
          const h = heightPct(b.count);
          return (
            <button
              key={b.d}
              type="button"
              className={[
                'gnd-bar-cell',
                b.exact ? '' : 'is-est',
                isGod ? 'is-god' : '',
                isActive ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive((cur) => (cur === i ? null : cur))}
              onClick={() => setActive((cur) => (cur === i ? null : i))}
              aria-pressed={isActive}
              aria-label={`${t('距离', 'distance')} ${b.d}: ${b.exact ? '' : '≈'}${groupDigits(b.count)} ${t('种状态', 'states')}${b.exact ? '' : ` (${t('估计值', 'estimate')})`}`}
            >
              <span className="gnd-bar-track">
                <span
                  className="gnd-bar-fill"
                  style={{
                    height: inView || reduced ? `${h}%` : '0%',
                    transitionDelay: animate ? `${i * 36}ms` : '0ms',
                  }}
                />
              </span>
              <span className="gnd-bar-x gnd-num">{b.d}</span>
            </button>
          );
        })}
      </div>

      <div className="gnd-axis-label">
        {t('最优还原步数（半转计步 HTM）', 'Optimal solving distance (half-turn metric, HTM)')}
      </div>

      <div className="gnd-godline">
        <span className="gnd-godline-dot" aria-hidden />
        <span>
          {t('上帝之数 = 20', 'God’s Number = 20')}
          <span className="gnd-godline-sub">
            {t(
              ',任何打乱都能在 20 步内还原。2010 年由 Rokicki、Kociemba、Davidson、Dethridge 借约 35 CPU-年算力证明。',
              ' — every scramble is solvable in 20 moves or fewer, proved in 2010 by Rokicki, Kociemba, Davidson & Dethridge using ~35 CPU-years of donated compute.'
            )}
          </span>
        </span>
      </div>

      <div className="gnd-legend">
        <span className="gnd-legend-item">
          <span className="gnd-legend-swatch" aria-hidden />
          {t('精确值（距离 0–15）', 'Exact counts (distance 0–15)')}
        </span>
        <span className="gnd-legend-item">
          <span className="gnd-legend-swatch is-est" aria-hidden />
          {t('估计值（距离 16–20，带 ≈）', 'Estimates (distance 16–20, marked ≈)')}
        </span>
      </div>

      <p className="gnd-foot">
        <span>{t('数据来源', 'Data')}: cube20.org</span>
        <span>{t('对数刻度', 'log scale')}</span>
        <span>{t(
          `状态总数 ${groupDigits(TOTAL)}（约 ${scientific(TOTAL)}）`,
          `${groupDigits(TOTAL)} total states (≈ ${scientific(TOTAL)})`
        )}</span>
      </p>
    </div>
  );
}
