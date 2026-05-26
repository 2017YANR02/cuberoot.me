/**
 * LatticeProjection — schematic of the high-dim lattice → polydisc cut → ℝ²
 * projection. Drawn for the visually tractable f = 2 case (Λ ⊂ ℂ²) but
 * presented as a stand-in for the high-dim picture. A slider for the polydisc
 * radius R drives the live counts |X| and the projected ν(P).
 *
 * Concretely we use Λ = ℤ[i] (Gaussian integers, square lattice in ℂ ≈ ℝ²),
 * which is just an illustration of the structure: how many lattice points fit
 * in a disc, and how their projection to the first complex coordinate gives a
 * planar set with many unit-distance pairs.
 */
'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const PANEL_W = 220;
const PANEL_H = 220;
const SCALE = 24; // pixels per unit in the lattice

interface Pt { re: number; im: number }

function latticePoints(R: number, margin = 4): Pt[] {
  const lim = Math.ceil(R + margin);
  const out: Pt[] = [];
  for (let r = -lim; r <= lim; r++) {
    for (let i = -lim; i <= lim; i++) {
      out.push({ re: r, im: i });
    }
  }
  return out;
}

function insideDisc(p: Pt, R: number): boolean {
  return p.re * p.re + p.im * p.im <= R * R + 1e-6;
}

// Count unit-distance pairs in the projected set (collapsed to integer x-axis).
// Project: π₁(x + iy) = x. Distance between two projected reals is just |Δx|.
function projectAndCount(pts: Pt[]): { proj: number[]; pairs: [number, number][] } {
  // Group by .re (collapsed projection); keep one representative per distinct x
  const byRe = new Map<number, true>();
  for (const p of pts) byRe.set(p.re, true);
  const proj = Array.from(byRe.keys()).sort((a, b) => a - b);
  const pairs: [number, number][] = [];
  for (let i = 0; i < proj.length; i++) {
    for (let j = i + 1; j < proj.length; j++) {
      if (Math.abs(proj[j] - proj[i] - 1) < 1e-6) pairs.push([proj[i], proj[j]]);
    }
  }
  return { proj, pairs };
}

export default function LatticeProjection() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [R, setR] = useState(3.5);

  const allPts = useMemo(() => latticePoints(R + 1), [R]);
  const insidePts = useMemo(() => allPts.filter(p => insideDisc(p, R)), [allPts, R]);
  const { proj, pairs } = useMemo(() => projectAndCount(insidePts), [insidePts]);

  const px = (z: number) => PANEL_W / 2 + z * SCALE;
  const py = (z: number) => PANEL_H / 2 - z * SCALE;

  return (
    <div className="ud-proj">
      <div className="ud-proj-controls">
        <div className="ud-sandbox-slider">
          <label>{t('多圆盘半径 R = ', 'polydisc radius R = ')}{R.toFixed(1)}</label>
          <input type="range" min={1.0} max={4.5} step={0.1}
            value={R} onChange={e => setR(parseFloat(e.target.value))} />
        </div>
        <div className="ud-proj-readout">
          <span><span className="ud-stat-label">|Λ ∩ W|</span> <span className="ud-stat-value">{insidePts.length}</span></span>
          <span><span className="ud-stat-label">{t('投影点数', 'projected pts')}</span> <span className="ud-stat-value">{proj.length}</span></span>
          <span className="is-primary">
            <span className="ud-stat-label">{t('单位距离对', 'unit pairs')}</span>
            <span className="ud-stat-value">{pairs.length}</span>
          </span>
        </div>
      </div>

      <div className="ud-proj-panels">
        {/* Panel 1: lattice */}
        <div className="ud-proj-panel">
          <div className="ud-proj-panel-label">
            <span className="ud-proj-tag">①</span>
            {t('格 Λⱼ ⊂ ℂ^f', 'lattice Λⱼ ⊂ ℂ^f')}
          </div>
          <svg viewBox={`0 0 ${PANEL_W} ${PANEL_H}`} className="ud-proj-svg">
            {/* axes */}
            <line x1={0} y1={PANEL_H / 2} x2={PANEL_W} y2={PANEL_H / 2} stroke="var(--ud-grid)" strokeWidth="0.6" />
            <line x1={PANEL_W / 2} y1={0} x2={PANEL_W / 2} y2={PANEL_H} stroke="var(--ud-grid)" strokeWidth="0.6" />
            {allPts.map((p, i) => (
              <circle key={i} cx={px(p.re)} cy={py(p.im)} r={2}
                fill="var(--ud-text-mute)" opacity="0.55" />
            ))}
            <text x={PANEL_W - 6} y={PANEL_H / 2 - 4} fontSize="9"
              textAnchor="end" fill="var(--ud-text-sub)">Re</text>
            <text x={PANEL_W / 2 + 4} y={10} fontSize="9" fill="var(--ud-text-sub)">Im</text>
          </svg>
        </div>

        <div className="ud-proj-arrow">→</div>

        {/* Panel 2: polydisc cut */}
        <div className="ud-proj-panel">
          <div className="ud-proj-panel-label">
            <span className="ud-proj-tag">②</span>
            {t('切多圆盘 W', 'restrict to polydisc W')}
          </div>
          <svg viewBox={`0 0 ${PANEL_W} ${PANEL_H}`} className="ud-proj-svg">
            <line x1={0} y1={PANEL_H / 2} x2={PANEL_W} y2={PANEL_H / 2} stroke="var(--ud-grid)" strokeWidth="0.6" />
            <line x1={PANEL_W / 2} y1={0} x2={PANEL_W / 2} y2={PANEL_H} stroke="var(--ud-grid)" strokeWidth="0.6" />
            {/* disc fill */}
            <circle cx={PANEL_W / 2} cy={PANEL_H / 2} r={R * SCALE}
              fill="var(--ud-disc)" stroke="var(--ud-disc-stroke)" strokeWidth="1.4"
              strokeDasharray="3 3" />
            {/* outside (faint) */}
            {allPts.filter(p => !insideDisc(p, R)).map((p, i) => (
              <circle key={i} cx={px(p.re)} cy={py(p.im)} r={2}
                fill="var(--ud-text-mute)" opacity="0.25" />
            ))}
            {/* inside (highlight) */}
            {insidePts.map((p, i) => (
              <circle key={i} cx={px(p.re)} cy={py(p.im)} r={3}
                fill="var(--ud-pt)" />
            ))}
            <text x={PANEL_W - 6} y={PANEL_H - 6} fontSize="10"
              textAnchor="end" fill="var(--ud-text-sub)"
              fontFamily="var(--ud-mono)">X = Λ ∩ W</text>
          </svg>
        </div>

        <div className="ud-proj-arrow">→</div>

        {/* Panel 3: projection */}
        <div className="ud-proj-panel">
          <div className="ud-proj-panel-label">
            <span className="ud-proj-tag">③</span>
            {t('投影 π₁ → ℝ²', 'project π₁ → ℝ²')}
          </div>
          <svg viewBox={`0 0 ${PANEL_W} ${PANEL_H}`} className="ud-proj-svg">
            <line x1={0} y1={PANEL_H / 2} x2={PANEL_W} y2={PANEL_H / 2}
              stroke="var(--ud-text-mute)" strokeWidth="1" />
            {/* unit-distance edges */}
            {pairs.map(([x1, x2], i) => (
              <line key={i}
                x1={px(x1)} y1={PANEL_H / 2}
                x2={px(x2)} y2={PANEL_H / 2}
                stroke="var(--ud-edge)" strokeWidth="3"
                strokeLinecap="round" opacity="0.75" />
            ))}
            {/* projected points */}
            {proj.map((x, i) => (
              <circle key={i} cx={px(x)} cy={PANEL_H / 2} r={4}
                fill="var(--ud-pt-hover)" stroke="var(--background)" strokeWidth="1.4" />
            ))}
            {/* tick labels */}
            {proj.map((x, i) => (
              <text key={i} x={px(x)} y={PANEL_H / 2 + 18}
                fontSize="9" textAnchor="middle"
                fill="var(--ud-text-sub)" fontFamily="var(--ud-mono)">{x}</text>
            ))}
            <text x={PANEL_W - 6} y={PANEL_H - 6} fontSize="10"
              textAnchor="end" fill="var(--ud-text-sub)"
              fontFamily="var(--ud-mono)">P = π₁(X)</text>
          </svg>
        </div>
      </div>

      <p className="ud-sandbox-hint">
        {isZh ? (
          <>这是 f = 2 的简化示意:格 <span className="ud-mono">Λ = ℤ[i]</span> 在 ℂ ≈ ℝ²。增加 R,有限子集 X 指数增长 (|X| ≤ e^Bf);投影后单位距离对数也指数增长 (≥ e^(γf/2) · |P|)。两者指数比就是新指数 1+δ。<strong>关键</strong>:论文里 f 可以任意大,Λⱼ 是<em>真正</em>的高维格,所以塞得下指数多的 norm-1 平移 — 而这些平移投影到 ℝ² 后,每对都是<em>精确</em>距离 1。</>
        ) : (
          <>This is the f = 2 cartoon: <span className="ud-mono">Λ = ℤ[i]</span> in ℂ ≈ ℝ². As R grows, |X| grows exponentially (|X| ≤ e^Bf); the unit-distance count also grows exponentially (≥ e^(γf/2) · |P|). The ratio of those exponents is the new exponent 1 + δ. <strong>The catch</strong>: in the paper f goes to infinity, Λⱼ is a <em>genuinely</em> high-dimensional lattice — that's why it fits exponentially many norm-1 translations, each of which projects to an <em>exact</em> distance-1 pair in ℝ².</>
        )}
      </p>
    </div>
  );
}
