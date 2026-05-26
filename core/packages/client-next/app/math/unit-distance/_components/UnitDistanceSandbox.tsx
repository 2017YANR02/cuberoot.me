/**
 * UnitDistanceSandbox — interactive playground for §2 of /math/unit-distance.
 *
 * The user sees N points on an SVG canvas. They can drag any point with
 * mouse/touch; every pair within ±tol of the chosen unit length gets a live
 * edge, ν(P) is recomputed each frame. Presets seed the canvas with classical
 * configurations: random / square-grid / triangular / hexagonal.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shuffle, Grid3x3, Hexagon, Triangle } from 'lucide-react';

type Preset = 'random' | 'square' | 'triangular' | 'hexagonal';
interface Pt { x: number; y: number }

const VIEW_W = 640;
const VIEW_H = 420;
const UNIT_PX = 70;            // 1 distance unit = 70 svg units
const TOL = 1.5;               // ±1.5 px tolerance on unit length

// ─── preset generators (all return points already in svg coords) ────────────
function seedPoints(preset: Preset, n: number): Pt[] {
  const cx = VIEW_W / 2, cy = VIEW_H / 2;
  const out: Pt[] = [];
  switch (preset) {
    case 'random': {
      // Poisson-ish dart throw, keep distance ≥ 0.4·UNIT_PX
      let attempts = 0;
      while (out.length < n && attempts < 5000) {
        attempts++;
        const p = { x: 40 + Math.random() * (VIEW_W - 80), y: 30 + Math.random() * (VIEW_H - 60) };
        if (out.every(q => Math.hypot(p.x - q.x, p.y - q.y) > 0.35 * UNIT_PX)) out.push(p);
      }
      return out;
    }
    case 'square': {
      const s = Math.ceil(Math.sqrt(n));
      const start = cx - ((s - 1) * UNIT_PX) / 2;
      const top = cy - ((s - 1) * UNIT_PX) / 2;
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / s), c = i % s;
        out.push({ x: start + c * UNIT_PX, y: top + r * UNIT_PX });
      }
      return out;
    }
    case 'triangular': {
      // equilateral-triangle lattice; row offset by UNIT_PX/2
      const s = Math.ceil(Math.sqrt(n * 2 / Math.sqrt(3)));
      const rowH = UNIT_PX * Math.sqrt(3) / 2;
      const startY = cy - ((s - 1) * rowH) / 2;
      let k = 0;
      for (let r = 0; r < s && k < n; r++) {
        const xOff = (r % 2) * (UNIT_PX / 2);
        const startX = cx - ((s - 1) * UNIT_PX) / 2 + xOff;
        for (let c = 0; c < s && k < n; c++) {
          out.push({ x: startX + c * UNIT_PX, y: startY + r * rowH });
          k++;
        }
      }
      return out;
    }
    case 'hexagonal': {
      // concentric rings of 6: 1, 6, 12, 18...
      out.push({ x: cx, y: cy });
      let ring = 1;
      while (out.length < n) {
        // 6·ring points on the ring, but use hex geometry
        for (let side = 0; side < 6 && out.length < n; side++) {
          const a0 = (side * Math.PI) / 3;
          const a1 = ((side + 1) * Math.PI) / 3;
          const x0 = cx + ring * UNIT_PX * Math.cos(a0);
          const y0 = cy + ring * UNIT_PX * Math.sin(a0);
          const x1 = cx + ring * UNIT_PX * Math.cos(a1);
          const y1 = cy + ring * UNIT_PX * Math.sin(a1);
          for (let k = 0; k < ring && out.length < n; k++) {
            const t = k / ring;
            out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
          }
        }
        ring++;
      }
      return out;
    }
  }
}

interface Pair { i: number; j: number }
function findUnitPairs(pts: Pt[]): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (Math.abs(d - UNIT_PX) <= TOL) out.push({ i, j });
    }
  }
  return out;
}

export default function UnitDistanceSandbox() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [n, setN] = useState(13);
  const [preset, setPreset] = useState<Preset>('triangular');
  const [pts, setPts] = useState<Pt[]>(() => seedPoints('triangular', 13));
  const [showCircles, setShowCircles] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dragRef = useRef<{ idx: number; dx: number; dy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // re-seed on preset / n change
  useEffect(() => {
    setPts(seedPoints(preset, n));
  }, [preset, n]);

  const pairs = useMemo(() => findUnitPairs(pts), [pts]);

  // ─── drag handling ────────────────────────────────────────────────────
  const ptFromEvent = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    return { x, y };
  }, []);

  const onPointerDown = (idx: number) => (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = ptFromEvent(e);
    dragRef.current = { idx, dx: pts[idx].x - p.x, dy: pts[idx].y - p.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = ptFromEvent(e);
    setPts(prev => {
      const next = prev.slice();
      next[drag.idx] = {
        x: Math.max(8, Math.min(VIEW_W - 8, p.x + drag.dx)),
        y: Math.max(8, Math.min(VIEW_H - 8, p.y + drag.dy)),
      };
      return next;
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* */ }
    dragRef.current = null;
  };

  return (
    <div className="ud-sandbox">
      <div className="ud-sandbox-controls">
        <div className="ud-sandbox-presets">
          <button className={preset === 'random' ? 'is-on' : ''} onClick={() => setPreset('random')}>
            <Shuffle size={14} /> {t('随机', 'Random')}
          </button>
          <button className={preset === 'square' ? 'is-on' : ''} onClick={() => setPreset('square')}>
            <Grid3x3 size={14} /> {t('方格', 'Square')}
          </button>
          <button className={preset === 'triangular' ? 'is-on' : ''} onClick={() => setPreset('triangular')}>
            <Triangle size={14} /> {t('三角', 'Triangular')}
          </button>
          <button className={preset === 'hexagonal' ? 'is-on' : ''} onClick={() => setPreset('hexagonal')}>
            <Hexagon size={14} /> {t('六角', 'Hexagonal')}
          </button>
        </div>
        <div className="ud-sandbox-slider">
          <label>n = {n}</label>
          <input
            type="range" min={3} max={37} step={1}
            value={n}
            onChange={e => setN(parseInt(e.target.value))}
          />
        </div>
        <label className="ud-sandbox-toggle">
          <input
            type="checkbox" checked={showCircles}
            onChange={e => setShowCircles(e.target.checked)}
          />
          <span>{t('单位圆提示', 'Unit-circle hints')}</span>
        </label>
      </div>

      <div className="ud-sandbox-stage">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="ud-sandbox-svg"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* background grid for spatial sense */}
          <defs>
            <pattern id="ud-bg" width={UNIT_PX} height={UNIT_PX} patternUnits="userSpaceOnUse">
              <path d={`M ${UNIT_PX} 0 L 0 0 0 ${UNIT_PX}`} fill="none" stroke="var(--ud-grid)" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect width={VIEW_W} height={VIEW_H} fill="url(#ud-bg)" />

          {/* unit-distance edges */}
          {pairs.map(({ i, j }, k) => {
            const a = pts[i], b = pts[j];
            return (
              <line key={k}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="var(--ud-edge)" strokeWidth="2.4"
                strokeLinecap="round"
              />
            );
          })}

          {/* unit-circle hint around hovered point */}
          {showCircles && hoverIdx !== null && (
            <circle
              cx={pts[hoverIdx].x} cy={pts[hoverIdx].y}
              r={UNIT_PX}
              fill="none" stroke="var(--ud-hint)" strokeWidth="1.4"
              strokeDasharray="4 4" pointerEvents="none"
            />
          )}

          {/* points */}
          {pts.map((p, i) => {
            const isHover = hoverIdx === i;
            const deg = pairs.reduce((acc, pr) => acc + (pr.i === i || pr.j === i ? 1 : 0), 0);
            return (
              <g key={i}>
                <circle
                  cx={p.x} cy={p.y} r={9}
                  fill={isHover ? 'var(--ud-pt-hover)' : 'var(--ud-pt)'}
                  stroke="var(--background)" strokeWidth="2"
                  onPointerDown={onPointerDown(i)}
                  onPointerEnter={() => setHoverIdx(i)}
                  onPointerLeave={() => setHoverIdx(null)}
                  style={{ cursor: 'grab', touchAction: 'none' }}
                />
                {isHover && (
                  <text x={p.x + 14} y={p.y - 10}
                    fontSize="11" fill="var(--ud-text-sub)"
                    pointerEvents="none">
                    {t(`度 ${deg}`, `deg ${deg}`)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="ud-sandbox-readout">
          <div className="ud-stat">
            <span className="ud-stat-label">n</span>
            <span className="ud-stat-value">{pts.length}</span>
          </div>
          <div className="ud-stat is-primary">
            <span className="ud-stat-label">ν(P)</span>
            <span className="ud-stat-value">{pairs.length}</span>
          </div>
          <div className="ud-stat">
            <span className="ud-stat-label">{t('平均度', 'avg deg')}</span>
            <span className="ud-stat-value">{pts.length ? (2 * pairs.length / pts.length).toFixed(2) : '0'}</span>
          </div>
        </div>
      </div>

      <p className="ud-sandbox-hint">
        {isZh ? (
          <>拖动任意点 — 距离恰好为 1(单位 = {UNIT_PX} px,容差 ±{TOL} px)的对子会立刻画上一条线。<strong>等边三角形</strong> 给出最高的局部 ν/n;切到方格立刻能看出"水平+垂直"两族,但少了 √2 那一族。</>
        ) : (
          <>Drag any point. Pairs at distance exactly 1 (unit = {UNIT_PX} px, tol ±{TOL} px) light up. The <strong>triangular</strong> lattice maximises local ν/n; switching to the square lattice loses the diagonal family and drops the count.</>
        )}
      </p>
    </div>
  );
}
