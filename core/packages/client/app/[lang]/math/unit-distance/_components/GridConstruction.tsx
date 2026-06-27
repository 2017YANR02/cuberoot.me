/**
 * GridConstruction — visualise Erdős 1946 grid lower bound.
 *
 * The classical lower bound takes the √n × √n integer grid and rescales so the
 * "unit distance" equals √k where k has the most r₂(k) representations as a
 * sum of two squares. Numbers like 5 = 1² + 2² = 2² + 1² (8 signed reps) give
 * many more unit-distance pairs than k = 1.
 *
 * UI: pick grid side s and squared-distance k; we draw every pair (P, Q) with
 * |P − Q|² = k. ν(grid_s, √k) and r₂(k) are shown live.
 */
'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useT } from "@/hooks/useT";
import { T } from '@/i18n/tr';

const VIEW = 420;
const PAD = 24;

const K_OPTIONS = [1, 2, 4, 5, 8, 9, 10, 13, 17, 25, 50, 65, 325];

// number of (a, b) ∈ ℤ² with a² + b² = k, brute force (k ≤ 1000)
function r2(k: number): number {
  let c = 0;
  const lim = Math.floor(Math.sqrt(k));
  for (let a = -lim; a <= lim; a++) {
    const b2 = k - a * a;
    if (b2 < 0) continue;
    const b = Math.sqrt(b2);
    if (b === Math.floor(b)) c += b === 0 ? 1 : 2;
  }
  return c;
}

interface Edge { i: number; j: number }
function countUnitPairs(s: number, k: number): Edge[] {
  const out: Edge[] = [];
  const idx = (r: number, c: number) => r * s + c;
  for (let r1 = 0; r1 < s; r1++) {
    for (let c1 = 0; c1 < s; c1++) {
      for (let r2_ = r1; r2_ < s; r2_++) {
        for (let c2 = 0; c2 < s; c2++) {
          if (r2_ === r1 && c2 <= c1) continue;
          const d2 = (r2_ - r1) ** 2 + (c2 - c1) ** 2;
          if (d2 === k) out.push({ i: idx(r1, c1), j: idx(r2_, c2) });
        }
      }
    }
  }
  return out;
}

export default function GridConstruction() {
  useTranslation();
  const t = useT();

  const [s, setS] = useState(7);
  const [k, setK] = useState(5);

  const n = s * s;
  const cellPx = (VIEW - 2 * PAD) / (s - 1);

  const points = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let r = 0; r < s; r++) {
      for (let c = 0; c < s; c++) {
        out.push({ x: PAD + c * cellPx, y: PAD + r * cellPx });
      }
    }
    return out;
  }, [s, cellPx]);

  const edges = useMemo(() => countUnitPairs(s, k), [s, k]);
  const r2k = useMemo(() => r2(k), [k]);

  // Closed-form for k = 1 (just nearest neighbours): 2 s (s − 1).
  // For general k, we use brute force.
  return (
    <div className="ud-grid-demo">
      <div className="ud-grid-controls">
        <div className="ud-sandbox-slider">
          <label>{t('网格边长', 'grid side')} s = {s} &nbsp;<span className="ud-mono">(n = {n})</span></label>
          <input
            type="range" min={3} max={12} step={1}
            value={s}
            onChange={e => setS(parseInt(e.target.value))}
          />
        </div>
        <div className="ud-grid-k-row">
          <span className="ud-grid-k-label">{t('单位长度² = ', 'unit length² = ')}<span className="ud-mono">k</span></span>
          <div className="ud-grid-k-buttons">
            {K_OPTIONS.map(kv => (
              <button key={kv}
                className={`ud-grid-k-btn ${k === kv ? 'is-on' : ''}`}
                onClick={() => setK(kv)}
              >
                {kv}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ud-grid-stage">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="ud-grid-svg">
          {/* faint background grid lines */}
          {Array.from({ length: s }, (_, i) => (
            <g key={i}>
              <line x1={PAD + i * cellPx} y1={PAD} x2={PAD + i * cellPx} y2={VIEW - PAD}
                stroke="var(--ud-grid)" strokeWidth="0.6" />
              <line x1={PAD} y1={PAD + i * cellPx} x2={VIEW - PAD} y2={PAD + i * cellPx}
                stroke="var(--ud-grid)" strokeWidth="0.6" />
            </g>
          ))}
          {/* unit-distance edges */}
          {edges.map((e, i) => {
            const a = points[e.i], b = points[e.j];
            return (
              <line key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="var(--ud-edge)" strokeWidth={k === 1 ? 2 : 1.4}
                strokeOpacity={k === 1 ? 0.9 : 0.55}
                strokeLinecap="round"
              />
            );
          })}
          {/* grid points */}
          {points.map((p, i) => (
            <circle key={i}
              cx={p.x} cy={p.y} r={Math.max(2.5, 5 - s * 0.15)}
              fill="var(--ud-pt)" stroke="var(--background)" strokeWidth="1.4"
            />
          ))}
          {/* legend: a vector at the top-right */}
          {edges.length > 0 && (() => {
            const a = points[edges[0].i], b = points[edges[0].j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const length = Math.hypot(dx, dy);
            const lx = VIEW - PAD - 6, ly = PAD + 6;
            const tag = `k = ${k} = √${k}² ≈ ${Math.sqrt(k).toFixed(2)}`;
            return (
              <g pointerEvents="none">
                <line x1={lx - length} y1={ly} x2={lx} y2={ly}
                  stroke="var(--ud-edge)" strokeWidth="2.5" />
                <text x={lx} y={ly - 6} textAnchor="end"
                  fontSize="11" fill="var(--ud-text-sub)"
                  fontFamily="var(--ud-mono)">{tag}</text>
              </g>
            );
          })()}
        </svg>

        <div className="ud-grid-readout">
          <div className="ud-stat">
            <span className="ud-stat-label">n</span>
            <span className="ud-stat-value">{n}</span>
          </div>
          <div className="ud-stat is-primary">
            <span className="ud-stat-label">{t('单位距离对', 'unit pairs')}</span>
            <span className="ud-stat-value">{edges.length}</span>
          </div>
          <div className="ud-stat">
            <span className="ud-stat-label">r₂(k)</span>
            <span className="ud-stat-value">{r2k}</span>
          </div>
          <div className="ud-stat">
            <span className="ud-stat-label">{t('ν / n', 'ν / n')}</span>
            <span className="ud-stat-value">{n ? (edges.length / n).toFixed(2) : '0'}</span>
          </div>
        </div>
      </div>

      <p className="ud-sandbox-hint">
        {<T zh={<>把"单位"重定义成 √k。k = 1 给出 <span className="ud-mono">2s(s−1)</span> ≈ 2n,只有 r₂(1) = 4 个方向能贡献。但 k = 5 有 <span className="ud-mono">r₂(5) = 8</span> 个方向 ((±1,±2),(±2,±1)),边数立刻变多。k = 25 还多了 (0, ±5)、(±3, ±4) 等。Erdős 1946 的下界正是来自:在 √n × √n 网格里挑使 r₂(k) 最大的 k,得到 ν(n) ≥ n · n<sup>c/log log n</sup>。</>} en={<>Rescale "unit" to √k. k = 1 yields only <span className="ud-mono">2s(s−1)</span> ≈ 2n pairs — just r₂(1) = 4 directions. But k = 5 with <span className="ud-mono">r₂(5) = 8</span> directions ((±1,±2), (±2,±1)) jumps higher; k = 25 adds (0, ±5) and (±3, ±4). Erdős 1946 picks the k with maximum r₂(k) ≤ n, giving the classical lower bound ν(n) ≥ n · n<sup>c/log log n</sup>.</>} />}
      </p>
    </div>
  );
}
