'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── DFT helpers (all O(n²), no external library) ─────────────────────────────

/** Compute the Fourier transform of f: C_n → R.
 *  Convention: f̂(k) = Σ_j f(j) exp(-2πi k j / n)
 *  Returns arrays re[k], im[k] of length n. */
function dft(f: number[]): { re: number[]; im: number[] } {
  const n = f.length;
  const re = new Array<number>(n).fill(0);
  const im = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      const angle = (2 * Math.PI * k * j) / n;
      re[k] += f[j] * Math.cos(angle);
      im[k] -= f[j] * Math.sin(angle);
    }
  }
  return { re, im };
}

/** Inverse DFT: f(j) = (1/n) Σ_k f̂(k) exp(2πi k j / n) */
function idft(re: number[], im: number[]): number[] {
  const n = re.length;
  const out = new Array<number>(n).fill(0);
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k * j) / n;
      out[j] += re[k] * Math.cos(angle) - im[k] * Math.sin(angle);
    }
    out[j] /= n;
  }
  return out;
}

/** Partial reconstruction using only the m largest-magnitude frequency bins
 *  (keeping conjugate pairs: if k is kept, n-k is also kept; k=0 always). */
function partialReconstruct(re: number[], im: number[], m: number): number[] {
  const n = re.length;
  const mag = re.map((r, k) => ({ k, mag: Math.hypot(r, im[k]) }));
  // Sort by magnitude descending
  mag.sort((a, b) => b.mag - a.mag);
  const kept = new Set<number>();
  for (const { k } of mag) {
    if (kept.size >= m) break;
    kept.add(k);
    // always include conjugate partner to keep result real
    const conj = (n - k) % n;
    kept.add(conj);
  }
  const reK = re.map((r, k) => (kept.has(k) ? r : 0));
  const imK = im.map((v, k) => (kept.has(k) ? v : 0));
  return idft(reK, imK);
}

/** Cyclic convolution: (f * g)(x) = Σ_j f(j) g((x-j) mod n) */
function cyclicConv(f: number[], g: number[]): number[] {
  const n = f.length;
  const out = new Array<number>(n).fill(0);
  for (let x = 0; x < n; x++) {
    for (let j = 0; j < n; j++) {
      out[x] += f[j] * g[((x - j) % n + n) % n];
    }
  }
  return out;
}

/** Spectral convolution via DFT: inverse(DFT(f) · DFT(g)) */
function spectralConv(f: number[], g: number[]): number[] {
  const F = dft(f);
  const G = dft(g);
  const n = f.length;
  const Hre = new Array<number>(n).fill(0);
  const Him = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    Hre[k] = F.re[k] * G.re[k] - F.im[k] * G.im[k];
    Him[k] = F.re[k] * G.im[k] + F.im[k] * G.re[k];
  }
  return idft(Hre, Him);
}

/** Advance a step distribution q by t steps: compute q^{*t} via DFT.
 *  Uses complex power (r e^{iθ})^t = r^t e^{i t θ}. */
function advanceWalk(q: number[], t: number): number[] {
  const n = q.length;
  const Q = dft(q);
  const Tre = new Array<number>(n).fill(0);
  const Tim = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    const r = Math.hypot(Q.re[k], Q.im[k]);
    const theta = Math.atan2(Q.im[k], Q.re[k]);
    const rt = Math.pow(r, t);
    Tre[k] = rt * Math.cos(t * theta);
    Tim[k] = rt * Math.sin(t * theta);
  }
  return idft(Tre, Tim);
}

/** Total variation distance from uniform. */
function tvFromUniform(dist: number[]): number {
  const n = dist.length;
  const unif = 1 / n;
  let sum = 0;
  for (let j = 0; j < n; j++) sum += Math.abs(dist[j] - unif);
  return sum / 2;
}

/** Plancherel upper bound on TV. */
function plancherelBound(q: number[], t: number): number {
  const n = q.length;
  const Q = dft(q);
  let sum = 0;
  for (let k = 1; k < n; k++) {
    const mag = Math.hypot(Q.re[k], Q.im[k]);
    sum += Math.pow(mag, 2 * t);
  }
  return 0.5 * Math.sqrt(sum);
}

/** Second-largest eigenvalue magnitude: max_{k≠0} |q̂(k)|. */
function beta(q: number[]): number {
  const Q = dft(q);
  let best = 0;
  for (let k = 1; k < q.length; k++) {
    const m = Math.hypot(Q.re[k], Q.im[k]);
    if (m > best) best = m;
  }
  return best;
}

// ── SVG bar chart helper ──────────────────────────────────────────────────────

const BAR_COLORS = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];

interface BarSvgProps {
  values: number[];
  highlight?: number[];
  refLine?: number;
  yMin?: number;
  yMax?: number;
  colorIdx?: number;
  height?: number;
  label?: string;
}

function BarSvg({ values, highlight, refLine, yMin, yMax, colorIdx = 0, height = 140, label }: BarSvgProps) {
  const n = values.length;
  const lo = yMin ?? Math.min(0, ...values);
  const hi = yMax ?? Math.max(...values, 0.01);
  const range = hi - lo || 1;
  const W = 320, H = height;
  const padL = 8, padR = 6, padT = 14, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const barW = Math.max(2, innerW / n - 1);
  const zeroY = padT + innerH * (1 - (0 - lo) / range);
  const color = BAR_COLORS[colorIdx % BAR_COLORS.length];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: W }}>
      {/* axis */}
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="var(--rule)" strokeWidth={1} />
      {/* ref line (uniform) */}
      {refLine !== undefined && (() => {
        const ry = padT + innerH * (1 - (refLine - lo) / range);
        return <line x1={padL} x2={W - padR} y1={ry} y2={ry} stroke="var(--green)" strokeWidth={1} strokeDasharray="4 3" />;
      })()}
      {values.map((v, k) => {
        const x = padL + (k + 0.15) * (innerW / n);
        const barH = Math.abs((v - 0) / range * innerH);
        const y = v >= 0 ? zeroY - barH : zeroY;
        const isHl = highlight?.includes(k);
        return (
          <g key={k}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={isHl ? 'var(--accent)' : color}
              fillOpacity={isHl ? 1 : 0.72} />
            {n <= 20 && (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={9}
                fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>{k}</text>
            )}
          </g>
        );
      })}
      {label && (
        <text x={W / 2} y={padT - 2} textAnchor="middle" fontSize={10}
          fill="var(--ink-dim)" style={{ fontFamily: 'var(--mono)' }}>{label}</text>
      )}
    </svg>
  );
}

// ── Draggable bar SVG (for f input) ──────────────────────────────────────────

interface DraggableBarProps {
  values: number[];
  onChange: (idx: number, val: number) => void;
  height?: number;
  label?: string;
}

function DraggableBars({ values, onChange, height = 140, label }: DraggableBarProps) {
  const n = values.length;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  const W = 320, H = height;
  const padL = 8, padR = 6, padT = 14, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const barW = Math.max(2, innerW / n - 1);
  const yMax = 1, yMin = 0;
  const range = yMax - yMin;
  const zeroY = padT + innerH;

  function barX(k: number) { return padL + (k + 0.15) * (innerW / n); }
  function valFromY(svgY: number) {
    const v = 1 - (svgY - padT) / innerH;
    return Math.max(0, Math.min(1, v));
  }
  function svgPoint(e: React.PointerEvent | PointerEvent): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    return pt.matrixTransform(m.inverse());
  }
  function barIndex(svgX: number) {
    const idx = Math.floor((svgX - padL) / (innerW / n));
    return Math.max(0, Math.min(n - 1, idx));
  }
  function handleDown(e: React.PointerEvent) {
    const pt = svgPoint(e);
    if (!pt) return;
    const k = barIndex(pt.x);
    dragging.current = k;
    onChange(k, valFromY(pt.y));
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  }
  function handleMove(e: React.PointerEvent) {
    if (dragging.current === null) return;
    const pt = svgPoint(e);
    if (!pt) return;
    const k = barIndex(pt.x);
    dragging.current = k;
    onChange(k, valFromY(pt.y));
  }
  function handleUp() { dragging.current = null; }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ display: 'block', cursor: 'ns-resize', touchAction: 'none', maxWidth: W }}
      onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp}>
      {/* axis */}
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="var(--rule)" strokeWidth={1} />
      {/* interactive handle hint */}
      {values.map((v, k) => {
        const x = barX(k);
        const barH = (v - yMin) / range * innerH;
        const y = zeroY - barH;
        return (
          <g key={k}>
            <rect x={x} y={y} width={barW} height={barH}
              fill="var(--accent-2)" fillOpacity={0.75} />
            {/* drag handle dot */}
            <circle cx={x + barW / 2} cy={y} r={4}
              fill="var(--accent-2)" stroke="var(--bg)" strokeWidth={1.5} />
            {n <= 20 && (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={9}
                fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>{k}</text>
            )}
          </g>
        );
      })}
      {label && (
        <text x={W / 2} y={padT - 2} textAnchor="middle" fontSize={10}
          fill="var(--ink-dim)" style={{ fontFamily: 'var(--mono)' }}>{label}</text>
      )}
    </svg>
  );
}

// ── Widget 1: DFT bars + reconstruction ──────────────────────────────────────

function DftExplorer() {
  const lang = useLang();
  const [n, setN] = useState(12);
  const [f, setF] = useState<number[]>(() => Array.from({ length: 12 }, (_, k) =>
    k === 0 ? 0.8 : k === 3 ? 0.6 : k === 7 ? 0.4 : 0.15
  ));
  const [partialM, setPartialM] = useState(12);
  const [showPhase, setShowPhase] = useState(false);

  // keep f length in sync with n
  const fN = useMemo(() => {
    if (f.length === n) return f;
    const arr = Array.from({ length: n }, (_, k) => f[k] ?? 0.2);
    return arr;
  }, [f, n]);

  const { re, im } = useMemo(() => dft(fN), [fN]);
  const mag = useMemo(() => re.map((r, k) => Math.hypot(r, im[k])), [re, im]);
  const phase = useMemo(() => re.map((r, k) => Math.atan2(im[k], r)), [re, im]);
  const maxMag = useMemo(() => Math.max(...mag, 0.01), [mag]);

  const mClamped = Math.min(partialM, n);
  const fRec = useMemo(() => partialReconstruct(re, im, mClamped), [re, im, mClamped]);
  const maxFRec = Math.max(...fN, ...fRec, 0.01);

  function handleFChange(k: number, v: number) {
    setF(prev => {
      const arr = prev.length === n ? [...prev] : Array.from({ length: n }, (_, i) => prev[i] ?? 0.2);
      arr[k] = v;
      return arr;
    });
  }

  function handleNChange(newN: number) {
    setN(newN);
    setPartialM(newN);
    setF(prev => Array.from({ length: newN }, (_, k) => prev[k] ?? 0.2));
  }

  // Normalized mag for display
  const magNorm = mag.map(m => m / (maxMag || 1));

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="Widget 1 — 函数的 DFT 分解与重建" en="Widget 1 — DFT decomposition & reconstruction" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>拖动上方蓝色条形修改 <TeX src={String.raw`f(0),\ldots,f(n-1)`} />; 下方红色条形实时显示 <TeX src={String.raw`|\hat{f}(k)|`} />; 调整重建频率数 m 观察偏和近似。</>}
          en={<>Drag the blue bars to set <TeX src={String.raw`f(0),\ldots,f(n-1)`} />; the red bars update in real time showing <TeX src={String.raw`|\hat{f}(k)|`} />; adjust m to see partial-sum approximation.</>}
        />
      </div>
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 16 }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
          <L zh={`n = ${n}`} en={`n = ${n}`} />
        </label>
        <input type="range" min={4} max={32} value={n}
          onChange={e => handleNChange(Number(e.target.value))}
          className="gt-input" style={{ flex: 1, minWidth: 100 }} />
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
          <L zh={`重建 m = ${mClamped}`} en={`recon m = ${mClamped}`} />
        </label>
        <input type="range" min={1} max={n} value={mClamped}
          onChange={e => setPartialM(Number(e.target.value))}
          className="gt-input" style={{ flex: 1, minWidth: 100 }} />
      </div>
      <div className="gt-panel-input-row">
        <button className={`gt-chip${showPhase ? ' gt-chip-active' : ''}`}
          onClick={() => setShowPhase(p => !p)}>
          <L zh="显示相位" en="Show phase" />
        </button>
        <button className="gt-btn gt-btn-ghost" onClick={() => {
          setF(Array.from({ length: n }, (_, k) => k === 0 ? 1 : 0));
        }}>
          <L zh="delta 函数" en="Delta spike" />
        </button>
        <button className="gt-btn gt-btn-ghost" onClick={() => {
          setF(Array.from({ length: n }, () => 1 / n));
        }}>
          <L zh="均匀分布" en="Uniform" />
        </button>
        <button className="gt-btn gt-btn-ghost" onClick={() => {
          setF(Array.from({ length: n }, (_, k) => 0.5 + 0.4 * Math.cos(2 * Math.PI * k / n)));
        }}>
          <L zh="余弦波" en="Cosine wave" />
        </button>
      </div>

      {/* Input function f */}
      <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', margin: '8px 0 2px' }}>
        <L zh={`输入函数 f : C_${n} → [0,1]  (拖动条形)`} en={`Input f : C_${n} → [0,1]  (drag bars)`} />
      </p>
      <DraggableBars values={fN} onChange={handleFChange} height={130}
        label={lang === 'zh' ? 'f(j)' : 'f(j)'} />

      {/* Reconstruction overlay */}
      <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', margin: '8px 0 2px' }}>
        <L zh={`|f̂(k)| (频谱)  ·  橙点 = 取前 m=${mClamped} 个频率重建`} en={`|f̂(k)| (spectrum)  ·  orange dots = reconstruct from top m=${mClamped} freqs`} />
      </p>
      <svg viewBox="0 0 320 140" width="100%" style={{ display: 'block', maxWidth: 320 }}>
        {/* mag bars */}
        {magNorm.map((m, k) => {
          const x = 8 + (k + 0.15) * (304 / n);
          const bw = Math.max(2, 304 / n - 1);
          const h = m * 104;
          return (
            <rect key={k} x={x} y={116 - h} width={bw} height={h}
              fill={BAR_COLORS[0]} fillOpacity={0.72} />
          );
        })}
        {/* reconstruction as dots */}
        {fRec.map((v, j) => {
          const x = 8 + (j + 0.15 + 0.35) * (304 / n);
          const yv = 116 - Math.max(0, Math.min(1, v / (maxFRec || 1))) * 104;
          return <circle key={j} cx={x} cy={yv} r={3} fill="var(--gold)" stroke="var(--bg)" strokeWidth={1} />;
        })}
        {/* axis */}
        <line x1={8} y1={116} x2={314} y2={116} stroke="var(--rule)" strokeWidth={1} />
        {/* labels */}
        <text x={160} y={10} textAnchor="middle" fontSize={10} fill="var(--ink-dim)" style={{ fontFamily: 'var(--mono)' }}>|f̂(k)|</text>
      </svg>

      {/* Phase display */}
      {showPhase && (
        <>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', margin: '8px 0 2px' }}>
            <L zh="相位 arg(f̂(k))  ∈ [-π, π]" en="Phase arg(f̂(k)) ∈ [-π, π]" />
          </p>
          <BarSvg values={phase} yMin={-Math.PI} yMax={Math.PI} colorIdx={4} height={90}
            label="arg(f̂(k))" />
        </>
      )}

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="重建误差 max|f-f_rec|" en="recon error max|f-f_rec|" /></span>
          <span className="gt-result-val" style={{ color: mClamped === n ? 'var(--green)' : 'var(--ink)' }}>
            {Math.max(...fN.map((v, j) => Math.abs(v - fRec[j]))).toExponential(2)}
            {mClamped === n ? <span style={{ color: 'var(--green)', marginLeft: 8 }}>≈ 0 ✓</span> : null}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="f̂(0) (直流分量)" en="f̂(0) (DC component)" /></span>
          <span className="gt-result-val gt-mono">{re[0].toFixed(4)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="主频 k*" en="dominant freq k*" /></span>
          <span className="gt-result-val gt-mono">
            {mag.slice(1).reduce((bk, m, i) => m > mag[bk] ? i + 1 : bk, 1)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Widget 2: Convolution theorem demo ───────────────────────────────────────

function ConvolutionDemo() {
  const [n, setN] = useState(8);
  const [f, setF] = useState<number[]>(() => [0.5, 0.3, 0.1, 0.05, 0, 0.05, 0.1, 0.3]);
  const [g, setG] = useState<number[]>(() => [0.4, 0.4, 0.1, 0.05, 0, 0.05, 0, 0]);
  const [showBoth, setShowBoth] = useState(false);

  function ensureLen(arr: number[], newN: number) {
    return Array.from({ length: newN }, (_, k) => arr[k] ?? 0.1);
  }

  function handleN(newN: number) {
    setN(newN);
    setF(p => ensureLen(p, newN));
    setG(p => ensureLen(p, newN));
  }

  const fN = useMemo(() => ensureLen(f, n), [f, n]);
  const gN = useMemo(() => ensureLen(g, n), [g, n]);

  const conv = useMemo(() => cyclicConv(fN, gN), [fN, gN]);
  const convSpec = useMemo(() => spectralConv(fN, gN), [fN, gN]);
  const maxDiff = useMemo(() => Math.max(...conv.map((v, i) => Math.abs(v - convSpec[i]))), [conv, convSpec]);

  const Fhat = useMemo(() => dft(fN), [fN]);
  const Ghat = useMemo(() => dft(gN), [gN]);
  const Fmag = useMemo(() => Fhat.re.map((r, k) => Math.hypot(r, Fhat.im[k])), [Fhat]);
  const Gmag = useMemo(() => Ghat.re.map((r, k) => Math.hypot(r, Ghat.im[k])), [Ghat]);
  const Hmag = useMemo(() => Fmag.map((m, k) => m * Gmag[k]), [Fmag, Gmag]);
  const maxConv = Math.max(...conv, 0.01);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="Widget 2 — 卷积定理:时域卷积 = 频域逐点相乘" en="Widget 2 — Convolution theorem: time-domain * = frequency-domain ×" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>拖动 f 和 g 的条形; 卷积 <TeX src={String.raw`(f*g)(x) = \sum_j f(j)\,g(x-j\bmod n)`} /> 有两条路径:直接求和或通过 DFT 频域相乘再逆变换, 结果必须完全相同。</>}
          en={<>Drag f and g; convolution <TeX src={String.raw`(f*g)(x)=\sum_j f(j)\,g(x-j\bmod n)`} /> can be computed two ways: direct cyclic sum, or multiply in the frequency domain then inverse-DFT. Both must agree exactly.</>}
        />
      </div>
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap' }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
          <L zh={`n = ${n}`} en={`n = ${n}`} />
        </label>
        <input type="range" min={4} max={16} value={n}
          onChange={e => handleN(Number(e.target.value))}
          className="gt-input" style={{ flex: 1, minWidth: 100 }} />
        <button className={`gt-chip${showBoth ? ' gt-chip-active' : ''}`}
          onClick={() => setShowBoth(b => !b)}>
          <L zh="叠加两条路径" en="Overlay both paths" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <div>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', margin: '0 0 2px' }}>f(j)</p>
          <DraggableBars values={fN} onChange={(k, v) => setF(p => { const a = ensureLen(p, n); a[k] = v; return a; })} height={100} />
        </div>
        <div>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', margin: '0 0 2px' }}>g(j)</p>
          <DraggableBars values={gN} onChange={(k, v) => setG(p => { const a = ensureLen(p, n); a[k] = v; return a; })} height={100} />
        </div>
      </div>

      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', margin: '10px 0 2px' }}>
        <L zh="(f*g)(x)  直接法 (蓝) vs 频域法 (橙点)" en="(f*g)(x)  direct (blue) vs spectral (orange dots)" />
      </p>
      <svg viewBox="0 0 320 110" width="100%" style={{ display: 'block', maxWidth: 320 }}>
        <line x1={8} y1={90} x2={314} y2={90} stroke="var(--rule)" strokeWidth={1} />
        {conv.map((v, x) => {
          const bx = 8 + (x + 0.15) * (304 / n);
          const bw = Math.max(2, 304 / n - 1);
          const h = (v / maxConv) * 74;
          return <rect key={x} x={bx} y={90 - h} width={bw} height={h}
            fill={BAR_COLORS[1]} fillOpacity={0.72} />;
        })}
        {showBoth && convSpec.map((v, x) => {
          const bx = 8 + (x + 0.15 + 0.35) * (304 / n);
          const yv = 90 - (v / maxConv) * 74;
          return <circle key={x} cx={bx} cy={yv} r={3} fill="var(--gold)" stroke="var(--bg)" strokeWidth={1} />;
        })}
      </svg>

      {/* Frequency domain visualization */}
      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', margin: '8px 0 2px' }}>
        <L zh="|F̂(k)|, |Ĝ(k)|, |F̂(k)·Ĝ(k)|" en="|F̂(k)|, |Ĝ(k)|, |F̂(k)·Ĝ(k)|" />
      </p>
      <svg viewBox="0 0 320 80" width="100%" style={{ display: 'block', maxWidth: 320 }}>
        <line x1={8} y1={66} x2={314} y2={66} stroke="var(--rule)" strokeWidth={1} />
        {Fmag.map((m, k) => {
          const maxM = Math.max(...Fmag, 0.01);
          const bx = 8 + k * (304 / n);
          const bw = Math.max(1, 304 / n * 0.28);
          return <rect key={k} x={bx} y={66 - m / maxM * 50} width={bw} height={m / maxM * 50}
            fill={BAR_COLORS[1]} fillOpacity={0.8} />;
        })}
        {Gmag.map((m, k) => {
          const maxM = Math.max(...Gmag, 0.01);
          const bx = 8 + k * (304 / n) + 304 / n * 0.32;
          const bw = Math.max(1, 304 / n * 0.28);
          return <rect key={k} x={bx} y={66 - m / maxM * 50} width={bw} height={m / maxM * 50}
            fill={BAR_COLORS[2]} fillOpacity={0.8} />;
        })}
        {Hmag.map((m, k) => {
          const maxM = Math.max(...Hmag, 0.01);
          const bx = 8 + k * (304 / n) + 304 / n * 0.64;
          const bw = Math.max(1, 304 / n * 0.28);
          return <rect key={k} x={bx} y={66 - m / maxM * 50} width={bw} height={m / maxM * 50}
            fill={BAR_COLORS[0]} fillOpacity={0.8} />;
        })}
        <text x={30} y={72} fontSize={8} fill={BAR_COLORS[1]} style={{ fontFamily: 'var(--mono)' }}>|F̂|</text>
        <text x={70} y={72} fontSize={8} fill={BAR_COLORS[2]} style={{ fontFamily: 'var(--mono)' }}>|Ĝ|</text>
        <text x={110} y={72} fontSize={8} fill={BAR_COLORS[0]} style={{ fontFamily: 'var(--mono)' }}>|F̂·Ĝ|</text>
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="两路径最大偏差" en="max diff between paths" /></span>
          <span className="gt-result-val" style={{ color: maxDiff < 1e-9 ? 'var(--green)' : 'var(--warn)' }}>
            {maxDiff.toExponential(2)} {maxDiff < 1e-9 ? '✓' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Widget 3: Random walk flattening ─────────────────────────────────────────

type WalkPreset = 'nearest' | 'lazy' | 'bigjump';

const WALK_PRESETS: { id: WalkPreset; zh: string; en: string }[] = [
  { id: 'nearest', zh: '±1 游走', en: '±1 walk'
},
  { id: 'lazy', zh: '懒惰游走', en: 'Lazy walk'
},
  { id: 'bigjump', zh: '大跳跃', en: 'Big jump'
},
];

function makeStepDist(n: number, preset: WalkPreset): number[] {
  const q = new Array<number>(n).fill(0);
  if (preset === 'nearest') {
    q[1] = 0.5; q[n - 1] = 0.5;
  } else if (preset === 'lazy') {
    q[0] = 0.5; q[1] = 0.25; q[n - 1] = 0.25;
  } else {
    // big jump: uniform on {1, 2, n/3}
    const j1 = 1, j2 = Math.max(2, Math.floor(n / 3));
    q[j1] = 1 / 3; q[(n - j1) % n] += 1 / 3;
    if (j2 !== j1 && j2 !== (n - j1) % n) {
      q[j2] = 1 / 3;
    } else {
      q[j2] += 1 / 3;
    }
    // normalize
    const s = q.reduce((a, b) => a + b, 0);
    for (let k = 0; k < n; k++) q[k] /= s;
  }
  return q;
}

function RandomWalkPanel() {
  const [n, setN] = useState(16);
  const [preset, setPreset] = useState<WalkPreset>('nearest');
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = useMemo(() => makeStepDist(n, preset), [n, preset]);
  const dist = useMemo(() => advanceWalk(q, t), [q, t]);
  const tv = useMemo(() => tvFromUniform(dist), [dist]);
  const betaStar = useMemo(() => beta(q), [q]);
  const gap = 1 - betaStar;

  // Eigenvalue spectrum
  const Qhat = useMemo(() => dft(q), [q]);
  const eigenvals = useMemo(() => Qhat.re.map((r, k) => Math.hypot(r, Qhat.im[k])), [Qhat]);

  // TV curve for last tMax steps
  const tMax = 60;
  const tvCurve = useMemo(() => {
    return Array.from({ length: tMax + 1 }, (_, step) => {
      const d = advanceWalk(q, step);
      return tvFromUniform(d);
    });
  }, [q]);

  const plBound = useMemo(() => Array.from({ length: tMax + 1 }, (_, step) => plancherelBound(q, step)), [q]);

  function startPlay() {
    if (timerRef.current) clearInterval(timerRef.current);
    setPlaying(true);
  }
  function stopPlay() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setT(prev => {
        if (prev >= tMax) { stopPlay(); return prev; }
        return prev + 1;
      });
    }, 120);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => { setT(0); setPlaying(false); }, [n, preset]);

  const unif = 1 / n;
  const maxDist = Math.max(...dist, unif * 1.1, 0.01);

  // For eigenvalue number line
  const eqNormalized = Qhat.re.map((r, k) => {
    const m = eigenvals[k];
    const sign = r < 0 ? -1 : 1;
    return sign * m; // signed real part for number line
  });
  // TV curve in SVG
  const tvW = 320, tvH = 80;
  const tvMaxShow = Math.max(...tvCurve, 0.01);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="Widget 3 — C_n 上的随机游走收敛" en="Widget 3 — Random walk on C_n converging to uniform" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>步进分布 <TeX src={String.raw`q`} /> 卷积 <TeX src={String.raw`t`} /> 次得到 <TeX src={String.raw`q^{*t}`} />; 分布条形向均匀分布 <TeX src={String.raw`1/n`} /> (绿虚线) 收敛, 速度由谱隙 <TeX src={String.raw`1-\beta_*`} /> 决定。</>}
          en={<>Convolving step distribution <TeX src={String.raw`q`} /> with itself <TeX src={String.raw`t`} /> times gives <TeX src={String.raw`q^{*t}`} />; bars approach the uniform <TeX src={String.raw`1/n`} /> (green dashed), and the rate is controlled by the spectral gap <TeX src={String.raw`1-\beta_*`} />.</>}
        />
      </div>
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>n = {n}</label>
        <input type="range" min={4} max={32} value={n}
          onChange={e => setN(Number(e.target.value))}
          className="gt-input" style={{ flex: 1, minWidth: 80 }} />
        {WALK_PRESETS.map(p => (
          <button key={p.id}
            className={`gt-chip${preset === p.id ? ' gt-chip-active' : ''}`}
            onClick={() => setPreset(p.id)}>
            <L zh={p.zh} en={p.en} />
          </button>
        ))}
      </div>
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>t = {t}</label>
        <input type="range" min={0} max={tMax} value={t}
          onChange={e => setT(Number(e.target.value))}
          className="gt-input" style={{ flex: 1, minWidth: 100 }} />
        <button className="gt-btn" onClick={() => { setT(0); startPlay(); }} disabled={playing}>
          <L zh="播放" en="Play" />
        </button>
        <button className="gt-btn gt-btn-ghost" onClick={stopPlay} disabled={!playing}>
          <L zh="暂停" en="Pause" />
        </button>
      </div>

      {/* Distribution bars */}
      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', margin: '8px 0 2px' }}>
        <L zh={`q^{*${t}}(j)  (绿虚线 = 均匀分布 1/${n})`} en={`q^{*${t}}(j)  (green dashed = uniform 1/${n})`} />
      </p>
      <svg viewBox="0 0 320 120" width="100%" style={{ display: 'block', maxWidth: 320 }}>
        {/* uniform ref line */}
        {(() => {
          const ry = 104 - (unif / maxDist) * 88;
          return <line x1={8} x2={314} y1={ry} y2={ry} stroke="var(--green)" strokeWidth={1} strokeDasharray="4 3" />;
        })()}
        <line x1={8} y1={104} x2={314} y2={104} stroke="var(--rule)" strokeWidth={1} />
        {dist.map((v, j) => {
          const bx = 8 + (j + 0.1) * (304 / n);
          const bw = Math.max(2, 304 / n * 0.8);
          const h = Math.max(0, (v / maxDist) * 88);
          return <rect key={j} x={bx} y={104 - h} width={bw} height={h}
            fill={BAR_COLORS[1]} fillOpacity={0.8} />;
        })}
      </svg>

      {/* Eigenvalue number line */}
      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', margin: '8px 0 2px' }}>
        <L zh="特征值 q̂(k) ∈ [-1,1]  (红点 = 次大|q̂|)" en="Eigenvalues q̂(k) ∈ [-1,1]  (red = second-largest |q̂|)" />
      </p>
      <svg viewBox="0 0 320 48" width="100%" style={{ display: 'block', maxWidth: 320 }}>
        <line x1={20} y1={24} x2={300} y2={24} stroke="var(--rule)" strokeWidth={1.5} />
        <text x={20} y={38} textAnchor="middle" fontSize={9} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>-1</text>
        <text x={160} y={38} textAnchor="middle" fontSize={9} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>0</text>
        <text x={300} y={38} textAnchor="middle" fontSize={9} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>1</text>
        {eqNormalized.map((ev, k) => {
          const cx = 20 + ((ev - (-1)) / 2) * 280;
          const isTrivial = k === 0;
          const isBeta = !isTrivial && eigenvals[k] >= betaStar - 1e-9;
          return (
            <circle key={k} cx={cx} cy={24} r={isBeta ? 5 : isTrivial ? 6 : 3.5}
              fill={isTrivial ? 'var(--green)' : isBeta ? 'var(--accent)' : BAR_COLORS[1]}
              fillOpacity={isBeta || isTrivial ? 1 : 0.7}
              stroke={isTrivial ? 'var(--green)' : 'none'} />
          );
        })}
      </svg>

      {/* TV curve */}
      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', margin: '8px 0 2px' }}>
        <L zh="TV 距离 vs t  (红 = 实际, 橙虚 = Plancherel 上界)" en="TV distance vs t  (red = actual, orange dashed = Plancherel bound)" />
      </p>
      <svg viewBox={`0 0 ${tvW} ${tvH}`} width="100%" style={{ display: 'block', maxWidth: tvW }}>
        <line x1={20} y1={tvH - 14} x2={tvW - 8} y2={tvH - 14} stroke="var(--rule)" strokeWidth={1} />
        <line x1={20} y1={8} x2={20} y2={tvH - 14} stroke="var(--rule)" strokeWidth={1} />
        {/* actual TV */}
        <polyline
          points={tvCurve.map((v, step) => {
            const x = 20 + (step / tMax) * (tvW - 28);
            const y = (tvH - 14) - (v / tvMaxShow) * (tvH - 22);
            return `${x},${y}`;
          }).join(' ')}
          fill="none" stroke={BAR_COLORS[0]} strokeWidth={1.8} />
        {/* Plancherel bound */}
        <polyline
          points={plBound.map((v, step) => {
            const x = 20 + (step / tMax) * (tvW - 28);
            const y = (tvH - 14) - (Math.min(v, tvMaxShow) / tvMaxShow) * (tvH - 22);
            return `${x},${y}`;
          }).join(' ')}
          fill="none" stroke="var(--gold)" strokeWidth={1.2} strokeDasharray="4 3" />
        {/* current t marker */}
        {(() => {
          const tx = 20 + (t / tMax) * (tvW - 28);
          return <line x1={tx} x2={tx} y1={8} y2={tvH - 14} stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="3 2" />;
        })()}
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\|q^{*t} - U\|_{\mathrm{TV}}`} /></span>
          <span className="gt-result-val-strong" style={{ color: tv < 0.1 ? 'var(--green)' : tv < 0.5 ? 'var(--gold)' : 'var(--accent)' }}>
            {tv.toFixed(4)}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\beta_* = \max_{k\neq 0}|\hat{q}(k)|`} /></span>
          <span className="gt-result-val gt-mono">{betaStar.toFixed(5)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="谱隙" en="Spectral gap" /></span>
          <span className="gt-result-val-strong" style={{ color: gap > 0.1 ? 'var(--green)' : 'var(--warn)' }}>
            {gap.toFixed(5)}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="混合步数估计 1/gap" en="Mixing est. 1/gap" /></span>
          <span className="gt-result-val gt-mono">{gap > 0 ? (1 / gap).toFixed(1) : '∞'}</span>
        </div>
        {preset === 'nearest' && n % 2 === 0 && (
          <div style={{ padding: '8px 0', color: 'var(--warn)', fontSize: 13 }}>
            <L
              zh={<>警告: n 为偶数时 ±1 游走的 k=n/2 特征值 = cos(π) = -1, 分布不收敛 (周期性 2)! 请选"懒惰游走"修复。</>}
              en={<>Warning: for even n the k=n/2 eigenvalue cos(π)=-1 causes the ±1 walk to oscillate and never converge (period 2). Use the Lazy walk to fix this.</>}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main section component ────────────────────────────────────────────────────

export default function FourierOnGroups() {
  const lang = useLang();

  return (
    <GTSec id="fourier-on-groups" className="gt-sec">
      <div className="gt-sec-num">§54</div>
      <h2 className="gt-sec-title">
        <L zh="群上的傅里叶分析" en="Fourier analysis on groups" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>傅里叶分析通常被视作连续函数的领域, 但它的真正家园是群论:对任意有限群 <TeX src={String.raw`G`} />, 都存在一套正交的"频率基底"(不可约表示), 把函数的卷积变成逐频相乘, 把随机游走的收敛速度锁定在一个谱隙里。Diaconis 用这一机器估计洗牌次数、并将其推广到魔方群。</>}
          en={<>Fourier analysis is usually thought of as the realm of continuous functions, but its true home is group theory: for any finite group <TeX src={String.raw`G`} /> there is an orthogonal set of "frequency modes" (irreducible representations) that converts convolution into pointwise multiplication and pins the convergence rate of a random walk to a single spectral gap. Diaconis used this machinery to count card shuffles and to frame the Rubik's cube as a random walk on a non-abelian group.</>}
        />
      </p>

      {/* ── Characters and the dual group ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="特征标与对偶群" en="Characters and the dual group" />
      </h3>

      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义 — 特征标与对偶群" en="Definition — Character and dual group" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>有限 Abel 群 <TeX src={String.raw`G`} /> 的<strong>特征标</strong>是群同态 <TeX src={String.raw`\chi: G \to \mathbb{C}^\times`} />。由于 <TeX src={String.raw`G`} /> 有限, 每个元素的像必须是单位根, 故 <TeX src={String.raw`|\chi(g)|=1`} />。平凡特征标 <TeX src={String.raw`\chi_0 \equiv 1`} />。对 Abel 群, 特征标恰好是全部 1 维不可约表示。</>}
              en={<>A <strong>character</strong> of a finite abelian group <TeX src={String.raw`G`} /> is a group homomorphism <TeX src={String.raw`\chi: G \to \mathbb{C}^\times`} />. Since <TeX src={String.raw`G`} /> is finite every image is a root of unity, so <TeX src={String.raw`|\chi(g)|=1`} />. The trivial character <TeX src={String.raw`\chi_0 \equiv 1`} />. For abelian <TeX src={String.raw`G`} /> the characters are exactly all 1-dimensional irreducible representations.</>}
            />
          </p>
          <p>
            <L
              zh={<><strong>对偶群</strong> <TeX src={String.raw`\hat{G} = \mathrm{Hom}(G,\mathbb{C}^\times)`} /> 在逐点相乘 <TeX src={String.raw`(\chi\psi)(g)=\chi(g)\psi(g)`} /> 下构成群, 满足 <TeX src={String.raw`\hat{G} \cong G`} /> (非典范同构) 以及 <TeX src={String.raw`|\hat{G}|=|G|`} />。双对偶 <TeX src={String.raw`\hat{\hat{G}} \cong G`} /> 是典范同构 (Pontryagin 对偶)。</>}
              en={<>The <strong>dual group</strong> <TeX src={String.raw`\hat{G}=\mathrm{Hom}(G,\mathbb{C}^\times)`} /> under pointwise multiplication <TeX src={String.raw`(\chi\psi)(g)=\chi(g)\psi(g)`} /> satisfies <TeX src={String.raw`\hat{G}\cong G`} /> (non-canonically) and <TeX src={String.raw`|\hat{G}|=|G|`} />. The double dual <TeX src={String.raw`\hat{\hat{G}}\cong G`} /> is a canonical isomorphism (Pontryagin duality).</>}
            />
          </p>
          <p>
            <L
              zh={<>对 <TeX src={String.raw`C_n = \mathbb{Z}/n\mathbb{Z}`} />, 其 <TeX src={String.raw`n`} /> 个特征标为</>}
              en={<>For <TeX src={String.raw`C_n=\mathbb{Z}/n\mathbb{Z}`} /> the <TeX src={String.raw`n`} /> characters are</>}
            />
          </p>
          <TeXBlock src={String.raw`\chi_k(j) = e^{2\pi i k j / n}, \quad k = 0,1,\ldots,n-1,`} />
          <p>
            <L
              zh={<>由生成元的像 <TeX src={String.raw`\chi_k(1)=e^{2\pi ik/n}`} /> (第 <TeX src={String.raw`n`} /> 个单位根) 唯一确定。映射 <TeX src={String.raw`k \mapsto \chi_k`} /> 是同构 <TeX src={String.raw`\hat{C}_n \cong C_n`} />。</>}
              en={<>each determined by <TeX src={String.raw`\chi_k(1)=e^{2\pi ik/n}`} /> (an <TeX src={String.raw`n`} />-th root of unity). The map <TeX src={String.raw`k\mapsto\chi_k`} /> is an isomorphism <TeX src={String.raw`\hat{C}_n\cong C_n`} />.</>}
            />
          </p>
        </div>
      </div>

      {/* ── DFT on C_n ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="离散傅里叶变换" en="The discrete Fourier transform" />
      </h3>

      <p>
        <L
          zh={<>对函数 <TeX src={String.raw`f: C_n \to \mathbb{C}`} />, <strong>离散傅里叶变换 (DFT)</strong> 定义为</>}
          en={<>For <TeX src={String.raw`f: C_n\to\mathbb{C}`} />, the <strong>discrete Fourier transform (DFT)</strong> is defined as</>}
        />
      </p>
      <TeXBlock src={String.raw`\hat{f}(k) = \sum_{j=0}^{n-1} f(j)\,\overline{\chi_k(j)} = \sum_{j=0}^{n-1} f(j)\,e^{-2\pi i k j/n}, \quad k = 0,\ldots,n-1.`} />
      <p>
        <L
          zh={<>这里用共轭特征标 <TeX src={String.raw`\overline{\chi_k}`} /> 是标准约定 (使逆变换指数为正)。逆变换为</>}
          en={<>Using the conjugate character <TeX src={String.raw`\overline{\chi_k}`} /> is the standard convention (so the inversion exponent is positive). The inverse transform is</>}
        />
      </p>
      <TeXBlock src={String.raw`f(j) = \frac{1}{n}\sum_{k=0}^{n-1}\hat{f}(k)\,e^{2\pi ikj/n}.`} />

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 — 特征标正交性" en="Theorem — Orthogonality of characters" />
        </div>
        <div className="gt-thm-body">
          <TeXBlock src={String.raw`\frac{1}{n}\sum_{j=0}^{n-1}\chi_k(j)\,\overline{\chi_l(j)} = \begin{cases}1 & k\equiv l\pmod{n}\\0 & \text{otherwise.}\end{cases}`} />
          <L
            zh={<>等价地: <TeX src={String.raw`\sum_{j=0}^{n-1} e^{2\pi i(k-l)j/n}=n\cdot[k\equiv l]`} />。特征标构成 <TeX src={String.raw`L^2(C_n)`} /> 的正交基, 这是 DFT 逆变换和下面卷积定理的根本动力。</>}
            en={<>Equivalently: <TeX src={String.raw`\sum_{j=0}^{n-1}e^{2\pi i(k-l)j/n}=n\cdot[k\equiv l]`} />. Characters form an orthogonal basis of <TeX src={String.raw`L^2(C_n)`} />; this is the engine behind DFT inversion and the convolution theorem below.</>}
          />
        </div>
      </div>

      {/* ── Convolution theorem ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="卷积定理与随机游走" en="Convolution theorem and random walks" />
      </h3>

      <p>
        <L
          zh={<><TeX src={String.raw`C_n`} /> 上的<strong>循环卷积</strong>定义为 <TeX src={String.raw`(f*g)(x)=\sum_{j=0}^{n-1}f(j)\,g(x-j\bmod n)`} />。卷积定理断言 Fourier 变换把卷积化为逐频相乘:</>}
          en={<>The <strong>cyclic convolution</strong> on <TeX src={String.raw`C_n`} /> is <TeX src={String.raw`(f*g)(x)=\sum_{j=0}^{n-1}f(j)\,g(x-j\bmod n)`} />. The convolution theorem states that the Fourier transform converts convolution to pointwise multiplication:</>}
        />
      </p>
      <TeXBlock src={String.raw`\widehat{f*g}(k) = \hat{f}(k)\cdot\hat{g}(k), \quad \forall\,k.`} />
      <p>
        <L
          zh={<>等价表述: <TeX src={String.raw`n`} /> 个特征标是所有卷积算子的公共本征基。对每个 <TeX src={String.raw`\chi_k`} />, 卷积算子 <TeX src={String.raw`C_q: f\mapsto q*f`} /> 满足 <TeX src={String.raw`C_q\chi_k = \hat{q}(k)\cdot\chi_k`} />; 其特征值恰好是 <TeX src={String.raw`\hat{q}(k)`} />。</>}
          en={<>Equivalently: the <TeX src={String.raw`n`} /> characters are a common eigenbasis for all convolution operators. For each <TeX src={String.raw`\chi_k`} />, the operator <TeX src={String.raw`C_q: f\mapsto q*f`} /> satisfies <TeX src={String.raw`C_q\chi_k=\hat{q}(k)\cdot\chi_k`} />; its eigenvalues are exactly the <TeX src={String.raw`\hat{q}(k)`} />.</>}
        />
      </p>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 — Plancherel 混合界 (Abel 情形)" en="Theorem — Plancherel mixing bound (abelian case)" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>设 <TeX src={String.raw`q`} /> 是有限 Abel 群 <TeX src={String.raw`G`} /> 上的对称概率分布 (<TeX src={String.raw`q(g)=q(g^{-1})`} />), <TeX src={String.raw`U`} /> 为均匀分布。令 <TeX src={String.raw`\beta_* = \max_{\chi \neq \chi_0}|\hat{q}(\chi)|`} /> (次大特征值模)。则</>}
              en={<>Let <TeX src={String.raw`q`} /> be a symmetric probability on a finite abelian <TeX src={String.raw`G`} /> (<TeX src={String.raw`q(g)=q(g^{-1})`} />), <TeX src={String.raw`U`} /> the uniform distribution, and <TeX src={String.raw`\beta_*=\max_{\chi\neq\chi_0}|\hat{q}(\chi)|`} /> (second-largest eigenvalue magnitude). Then</>}
            />
          </p>
          <TeXBlock src={String.raw`\|q^{*t} - U\|_{\mathrm{TV}} \;\le\; \tfrac{1}{2}\sqrt{\sum_{\chi\neq\chi_0}|\hat{q}(\chi)|^{2t}}.`} />
          <p>
            <L
              zh={<>右侧按 <TeX src={String.raw`\beta_*^t`} /> 的速率衰减。<strong>谱隙</strong> <TeX src={String.raw`1-\beta_*`} /> 越大, 混合越快; 弛豫时间约为 <TeX src={String.raw`1/(1-\beta_*)`} />。平凡特征标给出特征值 1 (对应平稳分布), 它必须从求和中排除。</>}
              en={<>The right side decays at rate <TeX src={String.raw`\beta_*^t`} />. A larger <strong>spectral gap</strong> <TeX src={String.raw`1-\beta_*`} /> means faster mixing; relaxation time is approximately <TeX src={String.raw`1/(1-\beta_*)`} />. The trivial character gives eigenvalue 1 (the stationary distribution) and must be excluded from the sum.</>}
            />
          </p>
        </div>
      </div>

      <div className="gt-aside">
        <L
          zh={<><strong>C_n 上 ±1 游走的特征值:</strong> 步进分布 <TeX src={String.raw`q = \tfrac{1}{2}\delta_{+1}+\tfrac{1}{2}\delta_{-1}`} /> 的 Fourier 系数为 <TeX src={String.raw`\hat{q}(k) = \cos(2\pi k/n)`} />。谱隙 <TeX src={String.raw`= 1-\cos(2\pi/n)\approx 2\pi^2/n^2`} />; 混合时间 <TeX src={String.raw`\Theta(n^2)`} /> (扩散时标)。<strong>警告:</strong> 若 <TeX src={String.raw`n`} /> 为偶数, <TeX src={String.raw`k=n/2`} /> 的特征值 <TeX src={String.raw`\cos(\pi)=-1`} />, 奇偶步的分布在两个格上振荡, 永不收敛。须用懒惰游走 (混入 <TeX src={String.raw`\delta_0`} />) 消除周期性。</>}
          en={<><strong>Eigenvalues of the ±1 walk on C_n:</strong> step distribution <TeX src={String.raw`q=\tfrac{1}{2}\delta_{+1}+\tfrac{1}{2}\delta_{-1}`} /> has Fourier coefficients <TeX src={String.raw`\hat{q}(k)=\cos(2\pi k/n)`} />. Spectral gap <TeX src={String.raw`=1-\cos(2\pi/n)\approx 2\pi^2/n^2`} />; mixing time <TeX src={String.raw`\Theta(n^2)`} /> (diffusive). <strong>Caution:</strong> for even <TeX src={String.raw`n`} />, eigenvalue <TeX src={String.raw`\cos(\pi)=-1`} /> at <TeX src={String.raw`k=n/2`} /> causes the odd/even distribution to oscillate — it never converges. A lazy walk (mix in <TeX src={String.raw`\delta_0`} />) removes the period-2 obstruction.</>}
          />
      </div>

      {/* ── Widget 1: DFT Explorer ── */}
      <DftExplorer />

      {/* ── Widget 2: Convolution demo ── */}
      <ConvolutionDemo />

      {/* ── Widget 3: Random Walk ── */}
      <RandomWalkPanel />

      {/* ── Non-abelian generalization ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="非 Abel 推广:矩阵值变换与 Peter-Weyl 定理" en="Non-abelian generalization: matrix-valued transforms & Peter-Weyl" />
      </h3>

      <p>
        <L
          zh={<>对非 Abel 群 <TeX src={String.raw`G`} />, 不可约表示 <TeX src={String.raw`\rho: G \to GL(V_\rho)`} /> 一般是多维的 (维度 <TeX src={String.raw`d_\rho \geq 1`} />)。<strong>矩阵值 Fourier 变换</strong>定义为</>}
          en={<>For non-abelian <TeX src={String.raw`G`} />, irreducible representations <TeX src={String.raw`\rho:G\to GL(V_\rho)`} /> can be multi-dimensional (<TeX src={String.raw`d_\rho\ge 1`} />). The <strong>matrix-valued Fourier transform</strong> is</>}
        />
      </p>
      <TeXBlock src={String.raw`\hat{f}(\rho) = \sum_{g \in G} f(g)\,\rho(g), \quad \text{a } d_\rho \times d_\rho \text{ matrix.}`} />
      <p>
        <L
          zh={<>卷积定理变为矩阵乘法: <TeX src={String.raw`\widehat{f*g}(\rho) = \hat{f}(\rho)\,\hat{g}(\rho)`} />。"对角化"在非 Abel 情形变成"分块对角化": 对每个不可约表示各有一个 <TeX src={String.raw`d_\rho \times d_\rho`} /> 的块。</>}
          en={<>The convolution theorem becomes matrix multiplication: <TeX src={String.raw`\widehat{f*g}(\rho)=\hat{f}(\rho)\hat{g}(\rho)`} />. "Diagonalization" in the non-abelian case becomes "block diagonalization": one <TeX src={String.raw`d_\rho\times d_\rho`} /> block per irreducible representation.</>}
        />
      </p>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 — Diaconis-Shahshahani 上界引理" en="Theorem — Diaconis-Shahshahani Upper Bound Lemma" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>设 <TeX src={String.raw`q`} /> 为有限群 <TeX src={String.raw`G`} /> 上的概率分布, <TeX src={String.raw`\mathrm{Irr}(G)`} /> 为不可约酉表示的完整集合。则</>}
              en={<>Let <TeX src={String.raw`q`} /> be a probability on a finite group <TeX src={String.raw`G`} /> and <TeX src={String.raw`\mathrm{Irr}(G)`} /> the complete set of unitary irreducible representations. Then</>}
            />
          </p>
          <TeXBlock src={String.raw`4\|q^{*t} - U\|_{\mathrm{TV}}^2 \;\le\; \sum_{\substack{\rho\,\in\,\mathrm{Irr}(G)\\\rho\neq\mathrm{trivial}}} d_\rho \cdot \mathrm{Tr}\!\bigl((\hat{q}(\rho)^*)^t \hat{q}(\rho)^t\bigr).`} />
          <p>
            <L
              zh={<>Abel 情形 <TeX src={String.raw`d_\rho=1`} />, 迹退化为 <TeX src={String.raw`|\hat{q}(\chi)|^{2t}`} />, 回到上面的 Plancherel 界。该引理由 Diaconis-Shahshahani (1981) 用于随机换位问题, 书论处理见 Diaconis (1988) 第 3 章。</>}
              en={<>For abelian <TeX src={String.raw`G`} /> all <TeX src={String.raw`d_\rho=1`} /> and the trace reduces to <TeX src={String.raw`|\hat{q}(\chi)|^{2t}`} />, recovering the Plancherel bound above. This lemma was established by Diaconis-Shahshahani (1981) for random transpositions; see Diaconis (1988) Ch. 3 for the book treatment.</>}
            />
          </p>
        </div>
      </div>

      {/* ── Card shuffling ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh={`应用：洗牌与"七次足够"`} en="Application: card shuffling and the seven-shuffle theorem" />
      </h3>

      <p>
        <L
          zh={<>Bayer 和 Diaconis (1992) 分析了 <strong>Gilbert-Shannon-Reeds (GSR)</strong> 鸽式洗牌: 把 <TeX src={String.raw`n`} /> 张牌分成两叠, 按几何分布切割, 然后交错落牌。他们证明, 对 <TeX src={String.raw`n`} /> 张牌的混合时间约为 <TeX src={String.raw`\frac{3}{2}\log_2 n`} /> 次, 精确到<strong>截断现象</strong>(TV 距离在一个窗口内从接近 1 骤降到接近 0)。对标准 52 张牌 (<TeX src={String.raw`\frac{3}{2}\log_2 52 \approx 8.5`} />):</>}
          en={<>Bayer and Diaconis (1992) analyzed the <strong>Gilbert-Shannon-Reeds (GSR)</strong> riffle shuffle: split <TeX src={String.raw`n`} /> cards by a geometric cut, then interleave. They proved the mixing time is approximately <TeX src={String.raw`\frac{3}{2}\log_2 n`} /> shuffles, with a sharp <strong>cutoff phenomenon</strong> (TV distance drops abruptly from near 1 to near 0 within a narrow window). For a standard 52-card deck (<TeX src={String.raw`\frac{3}{2}\log_2 52 \approx 8.5`} />):</>}
        />
      </p>

      <table className="gt-compare" style={{ margin: '12px 0 20px' }}>
        <thead>
          <tr>
            <th><L zh="洗牌次数 t" en="Shuffles t" /></th>
            <th><L zh="TV 距离" en="TV distance" /></th>
            <th><L zh="说明" en="Note" /></th>
          </tr>
        </thead>
        <tbody>
          {[
            { t: 5, tv: '≈ 0.924', note: tr({ zh: '几乎未混合', en: 'Almost unmixed',
                zhHant: "幾乎未混合"
            }) },
            { t: 6, tv: '≈ 0.614', note: tr({ zh: '明显有序', en: 'Visibly ordered',
                zhHant: "明顯有序"
            }) },
            { t: 7, tv: '≈ 0.334', note: tr({ zh: '首次 < 0.5 ("七次足够")', en: 'First < 0.5 ("seven shuffles")',
                zhHant: "首次 < 0.5 (\"七次足夠\")"
            }) },
            { t: 8, tv: '≈ 0.167', note: tr({ zh: '基本混合', en: 'Mostly mixed' }) },
            { t: 9, tv: '≈ 0.085', note: tr({ zh: '充分随机', en: 'Sufficiently random',
                zhHant: "充分隨機"
            }) },
          ].map(({ t, tv, note }) => (
            <tr key={t}>
              <td className="gt-mono">{t}</td>
              <td className="gt-mono">{tv}</td>
              <td style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: 14, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
        <L
          zh={<>表中数值来自 Bayer-Diaconis 封闭公式 (用上升序列数); t=7 的 TV≈0.334 已被多来源证实。"七次洗牌足够" 是该结果的流行表述 (首次使 TV&lt;0.5)。</>}
          en={<>Values from the Bayer-Diaconis closed form (rising-sequence count); t=7 TV≈0.334 is confirmed by multiple sources. "Seven shuffles suffice" is the popular form of this result (first t with TV&lt;0.5).</>}
        />
      </p>

      {/* ── Cube connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="魔方的联系:非 Abel 随机游走" en="The cube connection: non-abelian random walk" />
      </h3>

      <p>
        <L
          zh={<>所有合法魔方状态 (由 6 面转动可达) 构成一个有限<strong>非 Abel 群</strong> <TeX src={String.raw`G`} />, 阶为</>}
          en={<>All positions reachable by the 6 face moves of a Rubik's cube form a finite <strong>non-abelian group</strong> <TeX src={String.raw`G`} /> of order</>}
        />
      </p>
      <TeXBlock src={String.raw`|G| = 43{,}252{,}003{,}274{,}489{,}856{,}000 \approx 4.3 \times 10^{19}.`} />
      <p>
        <L
          zh={<>从一个 <strong>已还原</strong> 的魔方出发, 每步均匀随机选取 12 个面转动之一 (6 面各 ±90°), 位置分布为步进分布 <TeX src={String.raw`q`} /> 的 <TeX src={String.raw`t`} /> 折卷积 <TeX src={String.raw`q^{*t}`} />; 它收敛到 <TeX src={String.raw`G`} /> 上的均匀分布。这与洗牌是完全相同的数学机器:非 Abel Fourier 分析 (Peter-Weyl / Diaconis-Shahshahani)。</>}
          en={<>Starting from a <strong>solved</strong> cube, choosing each face quarter-turn uniformly at random, the position distribution is the <TeX src={String.raw`t`} />-fold convolution <TeX src={String.raw`q^{*t}`} /> of the step distribution <TeX src={String.raw`q`} />; it converges to the uniform distribution on <TeX src={String.raw`G`} />. This is the same mathematical machine as card shuffling: non-abelian Fourier analysis (Peter-Weyl / Diaconis-Shahshahani).</>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<><strong>Abel 玩具模型:</strong> 魔方的部分子结构确实是 Abel 群。例如, 角块方向变量 (8 个角各有 3 个方向, 且总扭转量 <TeX src={String.raw`\equiv 0 \pmod 3`} />) 活在 <TeX src={String.raw`C_3^7`} /> 里; 棱块翻转 (12 个棱各 2 个方向, 总翻转量 <TeX src={String.raw`\equiv 0 \pmod 2`} />) 活在 <TeX src={String.raw`C_2^{11}`} /> 里。这些正是本节 DFT 直接适用的对象。整个魔方群则需要非 Abel 表示论。<br /><strong>混合下界 (2024):</strong> Qu、Rokicki 和 Yang 在 arXiv:2410.20630 中证明, 随机游走达到近均匀分布至少需要约 26 步 (混合时间的下界); 精确混合时间仍是开放问题。</>}
          en={<><strong>Abelian toy models:</strong> parts of the cube's structure are abelian. For instance, corner orientation variables (8 corners, each with 3 orientations, total twist <TeX src={String.raw`\equiv 0\pmod 3`} />) live in <TeX src={String.raw`C_3^7`} />; edge flip variables (12 edges, 2 orientations each, total <TeX src={String.raw`\equiv 0\pmod 2`} />) live in <TeX src={String.raw`C_2^{11}`} />. These are exactly where the DFT of this section applies directly. The full cube group requires non-abelian representation theory.<br /><strong>Mixing lower bound (2024):</strong> Qu, Rokicki, and Yang (arXiv:2410.20630) prove that the random walk requires at least about 26 moves to reach near-uniform (a lower bound on mixing time); the exact mixing time remains open.</>}
          />
      </div>

      {/* ── References ── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <ol>
          <li>P. Diaconis, <em>Group Representations in Probability and Statistics</em>, IMS Lecture Notes 11 (1988). Ch. 2 (Fourier on groups), Ch. 3 (Upper Bound Lemma). <a href="https://projecteuclid.org/ebook/Download?urlId=10.1214/lnms/1215467407" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-2)' }}>Project Euclid (free PDF)</a>.</li>
          <li>D. Bayer &amp; P. Diaconis, "Trailing the Dovetail Shuffle to its Lair", <em>Ann. Appl. Probab.</em> 2(2):294–313 (1992) — the <TeX src={String.raw`\tfrac{3}{2}\log_2 n`} /> riffle-mixing / seven-shuffle result.</li>
          <li>D. Levin &amp; Y. Peres, <em>Markov Chains and Mixing Times</em>, 2nd ed. (AMS 2017), Ch. 12 (eigenvalues, cycle <TeX src={String.raw`C_n`} /> example, <TeX src={String.raw`\Theta(n^2)`} /> mixing).</li>
          <li>Y. Qu, T. Rokicki &amp; H. Yang, "Rubik's Cube Scrambling Requires at Least 26 Random Moves," arXiv:2410.20630 (2024) — lower bound on cube random-walk mixing.</li>
          <li>A. Terras, <em>Fourier Analysis on Finite Groups and Applications</em>, Cambridge UP (1999), Ch. 1–2 (DFT on <TeX src={String.raw`C_n`} />, Plancherel) and non-abelian chapters for Peter-Weyl.</li>
        </ol>
      </div>
    </GTSec>
  );
}
