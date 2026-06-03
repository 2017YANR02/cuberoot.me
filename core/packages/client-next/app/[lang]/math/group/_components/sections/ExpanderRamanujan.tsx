'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';

// ── Math helpers (all closed-form, no numeric eigensolver) ────────────────────

/** Exact adjacency eigenvalues of C_n = Cay(Z/nZ, {±1}):
 *  λ_k = 2 cos(2π k / n), k = 0..n−1, sorted descending. */
function cycleEigenvalues(n: number): number[] {
  const evs: number[] = [];
  for (let k = 0; k < n; k++) {
    evs.push(2 * Math.cos((2 * Math.PI * k) / n));
  }
  return evs.sort((a, b) => b - a);
}

/** Spectral gap of C_n: 2 − 2cos(2π/n) = 4 sin²(π/n). */
function cycleGap(n: number): number {
  const s = Math.sin(Math.PI / n);
  return 4 * s * s;
}

/** Ramanujan bound for degree d: 2√(d−1). */
function ramanBound(d: number): number {
  return 2 * Math.sqrt(Math.max(0, d - 1));
}

// ── Extended: abelian Cayley spectrum via characters ──────────────────────────
// Group: Z/n with generator set S ⊆ Z/n, |S| = d, symmetric (s ∈ S → n-s ∈ S).
// Character χ_a(x) = exp(2πi a x / n).
// For symmetric S: λ_a = Σ_{s∈S} cos(2π a s / n).
// All values exact via cosine sums. O(n·|S|) arithmetic.

type GeneratorConfig = '±1' | '±1,±2' | '±1,±floor(n/3)';

function buildGeneratorSet(n: number, cfg: GeneratorConfig): number[] {
  const S: number[] = [];
  const add = (s: number) => {
    const v = ((s % n) + n) % n;
    if (v !== 0 && !S.includes(v)) S.push(v);
    const vi = ((n - s) % n + n) % n;
    if (vi !== 0 && vi !== v && !S.includes(vi)) S.push(vi);
  };
  if (cfg === '±1') {
    add(1);
  } else if (cfg === '±1,±2') {
    add(1); add(2);
  } else {
    add(1); add(Math.max(2, Math.floor(n / 3)));
  }
  return S;
}

function abelianSpectrum(n: number, S: number[]): number[] {
  const evs: number[] = [];
  for (let a = 0; a < n; a++) {
    let lam = 0;
    for (const s of S) {
      lam += Math.cos((2 * Math.PI * a * s) / n);
    }
    evs.push(lam);
  }
  return evs.sort((a, b) => b - a);
}

// ── Panel 1: Cycle spectrum visualizer ───────────────────────────────────────

function CycleSpectrumPanel() {
  const lang = useLang();
  const [n, setN] = useState(12);
  const [showCayley, setShowCayley] = useState(true);

  const evs = useMemo(() => cycleEigenvalues(n), [n]);
  const gap = useMemo(() => cycleGap(n), [n]);
  const lambda2 = evs[1] ?? 0;
  const lambdaMin = evs[evs.length - 1] ?? 0;
  const bound = ramanBound(2); // d=2 → 2√1 = 2

  // SVG layout for eigenvalue number line
  const W = 320, H = 100;
  const padL = 28, padR = 28, padT = 20;
  const innerW = W - padL - padR;
  const lo = -2.3, hi = 2.3;
  const toX = (v: number) => padL + ((v - lo) / (hi - lo)) * innerW;

  // For multiplicity: count how many evs land close to each unique value
  const grouped: Map<string, { val: number; count: number }> = new Map();
  for (const v of evs) {
    const key = v.toFixed(8);
    const ex = grouped.get(key);
    if (ex) ex.count++;
    else grouped.set(key, { val: v, count: 1 });
  }
  const uniq = Array.from(grouped.values());

  // Cayley graph polygon
  const cx = W / 2, cy = (H + padT) / 2 + 6;
  const R = Math.min(34, W / 7);
  const nodePositions = Array.from({ length: n }, (_, i) => ({
    x: cx + R * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
    y: cy + R * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
  }));

  const cayleyH = 110;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="面板 1 — C_n 的邻接谱与谱隙" en="Panel 1 — Adjacency spectrum of C_n and its spectral gap" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>
            循环群 <TeX src={String.raw`C_n`} /> 的 Cayley 图（生成元 <TeX src={String.raw`\{\pm1\}`} />）
            的精确特征值为 <TeX src={String.raw`\lambda_k = 2\cos\!\tfrac{2\pi k}{n}`} />，均在 <TeX src={String.raw`[-2,2]`} /> 内。
            Ramanujan 阈值（度 <TeX src={String.raw`d=2`} />）恰好是 <TeX src={String.raw`2\sqrt{d-1}=2`} />——
            循环族谱隙趋于 0，<strong>不是扩张族</strong>。
          </>}
          en={<>
            The cycle graph <TeX src={String.raw`C_n`} /> (generators <TeX src={String.raw`\{\pm1\}`} />) has
            exact adjacency eigenvalues <TeX src={String.raw`\lambda_k = 2\cos\!\tfrac{2\pi k}{n}`} />, all
            in <TeX src={String.raw`[-2,2]`} />. The Ramanujan bound at degree <TeX src={String.raw`d=2`} /> is
            exactly <TeX src={String.raw`2\sqrt{d-1}=2`} />, so cycles trivially
            satisfy <TeX src={String.raw`|\lambda_i|\le2`} /> but the spectral gap
            shrinks to 0 — cycles are <strong>not an expander family</strong>.
          </>}
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
          n = {n}
        </label>
        <input
          type="range" min={3} max={60} value={n}
          onChange={e => setN(Number(e.target.value))}
          className="gt-input" style={{ flex: 1, minWidth: 100 }}
        />
        <button
          className={`gt-chip${showCayley ? ' gt-chip-active' : ''}`}
          onClick={() => setShowCayley(v => !v)}
        >
          <L zh="显示 Cayley 图" en="Show Cayley graph" />
        </button>
      </div>

      {/* Eigenvalue number line */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', marginTop: 8, maxWidth: W }}>
        {/* Axis */}
        <line x1={padL} y1={padT + 32} x2={W - padR} y2={padT + 32} stroke="var(--rule)" strokeWidth={1.5} />
        {/* Tick marks at ±2, 0 */}
        {[-2, -1, 0, 1, 2].map(v => {
          const x = toX(v);
          return (
            <g key={v}>
              <line x1={x} y1={padT + 29} x2={x} y2={padT + 35} stroke="var(--ink-faint)" strokeWidth={1} />
              <text x={x} y={padT + 46} textAnchor="middle" fontSize={9}
                fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>{v}</text>
            </g>
          );
        })}
        {/* Ramanujan bound lines at ±2 (for d=2, bound = 2) */}
        <line x1={toX(bound)} y1={padT + 5} x2={toX(bound)} y2={padT + 55}
          stroke="var(--green)" strokeWidth={1.5} strokeDasharray="4 3" />
        <line x1={toX(-bound)} y1={padT + 5} x2={toX(-bound)} y2={padT + 55}
          stroke="var(--green)" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={toX(bound) + 2} y={padT + 10} fontSize={8} fill="var(--green)"
          style={{ fontFamily: 'var(--mono)' }}>2√(d-1)={bound.toFixed(0)}</text>

        {/* Eigenvalue dots with multiplicity shown as vertical stacking */}
        {uniq.map(({ val, count }) => {
          const x = toX(val);
          const isTrivial = Math.abs(val - 2) < 1e-8;
          const isNegTrivial = Math.abs(val + 2) < 1e-8;
          const color = isTrivial
            ? 'var(--accent)'
            : isNegTrivial
            ? 'var(--accent-2)'
            : 'var(--ink-dim)';
          return Array.from({ length: count }, (_, i) => (
            <circle key={`${val.toFixed(5)}-${i}`}
              cx={x} cy={padT + 32 - 7 * (i + 1)}
              r={4} fill={color} fillOpacity={0.85}
              stroke="var(--bg)" strokeWidth={1} />
          ));
        })}

        {/* Gap bracket: λ₁ to λ₂ */}
        {n > 1 && (() => {
          const x1 = toX(lambda2);
          const x2 = toX(2);
          const by = padT + 62;
          return (
            <g>
              <line x1={x1} y1={by} x2={x2} y2={by} stroke="var(--gold)" strokeWidth={2} />
              <line x1={x1} y1={by - 4} x2={x1} y2={by + 4} stroke="var(--gold)" strokeWidth={1.5} />
              <line x1={x2} y1={by - 4} x2={x2} y2={by + 4} stroke="var(--gold)" strokeWidth={1.5} />
              <text x={(x1 + x2) / 2} y={by + 12} textAnchor="middle" fontSize={9}
                fill="var(--gold)" style={{ fontFamily: 'var(--mono)' }}>
                gap={gap.toFixed(4)}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Cayley graph (n-gon) */}
      {showCayley && (
        <svg viewBox={`0 0 ${W} ${cayleyH}`} width="100%" style={{ display: 'block', marginTop: 4, maxWidth: W }}>
          {/* Edges */}
          {nodePositions.map((pos, i) => {
            const j = (i + 1) % n;
            return (
              <line key={i} x1={pos.x} y1={pos.y}
                x2={nodePositions[j].x} y2={nodePositions[j].y}
                stroke="var(--ink-faint)" strokeWidth={1.2} />
            );
          })}
          {/* Nodes */}
          {nodePositions.map((pos, i) => (
            <circle key={i} cx={pos.x} cy={pos.y} r={n <= 20 ? 5 : 3}
              fill="var(--accent-2)" fillOpacity={0.85}
              stroke="var(--bg)" strokeWidth={1} />
          ))}
          {n <= 16 && nodePositions.map((pos, i) => (
            <text key={i} x={pos.x} y={pos.y - 7} textAnchor="middle" fontSize={8}
              fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>{i}</text>
          ))}
          <text x={W / 2} y={cayleyH - 4} textAnchor="middle" fontSize={10}
            fill="var(--ink-dim)" style={{ fontFamily: 'var(--mono)' }}>
            {lang === 'zh' ? `C_${n} Cayley 图` : `Cayley graph C_${n}`}
          </text>
        </svg>
      )}

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="度 d" en="Degree d" /></span>
          <span className="gt-result-val gt-mono">2</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\lambda_1`} /></span>
          <span className="gt-result-val gt-mono">2</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\lambda_2 = 2\cos(2\pi/n)`} /></span>
          <span className="gt-result-val gt-mono">{lambda2.toFixed(6)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\lambda_n = \min_k 2\cos(2\pi k/n)`} /></span>
          <span className="gt-result-val gt-mono">{lambdaMin.toFixed(6)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="谱隙 d−λ₂" en="Spectral gap d−λ₂" /></span>
          <span className="gt-result-val-strong" style={{ color: 'var(--warn)' }}>{gap.toFixed(6)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="Ramanujan 阈值 2√(d−1)" en="Ramanujan bound 2√(d−1)" /></span>
          <span className="gt-result-val gt-mono">{bound.toFixed(4)} (d=2)</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="λ(G)=max|λ_i| (i≥2)" en="λ(G)=max|λ_i| (i≥2)" /></span>
          <span className="gt-result-val gt-mono">{Math.max(Math.abs(lambda2), Math.abs(lambdaMin)).toFixed(6)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="满足 Ramanujan?" en="Ramanujan?" /></span>
          <span className="gt-result-val" style={{ color: 'var(--green)' }}>
            <L zh="是 (d=2 退化情形)" en="Yes (d=2 degenerate case)" />
          </span>
        </div>
        <div style={{ padding: '8px 0', fontSize: 13, color: 'var(--ink-dim)' }}>
          <L
            zh={<>谱隙 <TeX src={String.raw`4\sin^2(\pi/n)`} /> → 0（n → ∞），
              混合时间 <TeX src={String.raw`\Theta(n^2)`} />：循环族是正则扩张族的<em>反例</em>。</>}
            en={<>Spectral gap <TeX src={String.raw`4\sin^2(\pi/n)\to 0`} /> as n→∞,
              mixing time <TeX src={String.raw`\Theta(n^2)`} />: the cycle family is the canonical
              <em>failure</em> of expansion.</>}
          />
        </div>
      </div>
    </div>
  );
}

// ── Panel 2: Abelian Cayley spectrum explorer ─────────────────────────────────

const GEN_CONFIGS: { id: GeneratorConfig; zh: string; en: string }[] = [
  { id: '±1', zh: '生成元 {±1}，d=2', en: 'Generators {±1}, d=2' },
  { id: '±1,±2', zh: '生成元 {±1,±2}，d=4', en: 'Generators {±1,±2}, d=4' },
  { id: '±1,±floor(n/3)', zh: '生成元 {±1,±⌊n/3⌋}，d=4', en: 'Generators {±1,±⌊n/3⌋}, d=4' },
];

function AbelianSpectrumPanel() {
  const lang = useLang();
  const [n, setN] = useState(20);
  const [cfg, setCfg] = useState<GeneratorConfig>('±1,±2');

  const S = useMemo(() => buildGeneratorSet(n, cfg), [n, cfg]);
  const d = S.length;
  const evs = useMemo(() => abelianSpectrum(n, S), [n, S]);

  const lambda1 = evs[0] ?? d;
  const lambda2 = evs[1] ?? 0;
  const lambdaMin = evs[evs.length - 1] ?? 0;
  const lambdaG = Math.max(Math.abs(lambda2), Math.abs(lambdaMin));
  const gap = lambda1 - lambda2;
  const bound = ramanBound(d);
  const isRamanujan = lambdaG <= bound + 1e-9;

  // Map eigenvalue to x-pixel for SVG
  const W = 320, H = 90;
  const padL = 32, padR = 32, padT = 18;
  const innerW = W - padL - padR;
  const margin = 0.5;
  const lo = -bound - margin, hi = bound + margin;
  const toX = (v: number) => padL + ((v - lo) / (hi - lo)) * innerW;

  // Group by rounded value for multiplicity display
  const grouped2: Map<string, { val: number; count: number }> = new Map();
  for (const v of evs) {
    const key = v.toFixed(7);
    const ex = grouped2.get(key);
    if (ex) ex.count++;
    else grouped2.set(key, { val: v, count: 1 });
  }
  const uniq2 = Array.from(grouped2.values());

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="面板 2 — 阿贝尔 Cayley 图谱探索器" en="Panel 2 — Abelian Cayley spectrum explorer" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>
            有限阿贝尔群 <TeX src={String.raw`\mathbb{Z}/n`} /> 的 Cayley 图：字符给出精确特征值
            <TeX src={String.raw`\lambda_a = \sum_{s\in S}\cos\!\tfrac{2\pi as}{n}`} />（全为实数，无需数值求解）。
            更多生成元 → 更大谱隙 → 更快混合。右侧绿线是 Ramanujan 阈值 <TeX src={String.raw`\pm 2\sqrt{d-1}`} />。
          </>}
          en={<>
            Cayley graph of <TeX src={String.raw`\mathbb{Z}/n`} />: characters give exact eigenvalues
            <TeX src={String.raw`\lambda_a=\sum_{s\in S}\cos\!\tfrac{2\pi as}{n}`} /> (all real, no eigensolver needed).
            More generators → larger spectral gap → faster mixing. Green lines mark the
            Ramanujan bound <TeX src={String.raw`\pm 2\sqrt{d-1}`} />.
          </>}
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>n = {n}</label>
        <input
          type="range" min={5} max={80} value={n}
          onChange={e => setN(Number(e.target.value))}
          className="gt-input" style={{ flex: 1, minWidth: 100 }}
        />
      </div>
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {GEN_CONFIGS.map(gc => (
          <button key={gc.id}
            className={`gt-chip${cfg === gc.id ? ' gt-chip-active' : ''}`}
            onClick={() => setCfg(gc.id)}>
            <L zh={gc.zh} en={gc.en} />
          </button>
        ))}
      </div>

      {/* Eigenvalue number line with Ramanujan bound marks */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', marginTop: 8, maxWidth: W }}>
        {/* Axis */}
        <line x1={padL} y1={padT + 30} x2={W - padR} y2={padT + 30}
          stroke="var(--rule)" strokeWidth={1.5} />

        {/* Ramanujan bound verticals */}
        <line x1={toX(bound)} y1={padT} x2={toX(bound)} y2={padT + 50}
          stroke="var(--green)" strokeWidth={1.5} strokeDasharray="4 3" />
        <line x1={toX(-bound)} y1={padT} x2={toX(-bound)} y2={padT + 50}
          stroke="var(--green)" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={toX(bound) + 2} y={padT + 8} fontSize={8} fill="var(--green)"
          style={{ fontFamily: 'var(--mono)' }}>+{bound.toFixed(2)}</text>
        <text x={toX(-bound) - 2} y={padT + 8} fontSize={8} fill="var(--green)"
          textAnchor="end" style={{ fontFamily: 'var(--mono)' }}>−{bound.toFixed(2)}</text>

        {/* Tick marks */}
        {[Math.ceil(lo), 0, Math.floor(hi)].map(v => {
          const x = toX(v);
          if (x < padL || x > W - padR) return null;
          return (
            <g key={v}>
              <line x1={x} y1={padT + 27} x2={x} y2={padT + 33}
                stroke="var(--ink-faint)" strokeWidth={1} />
              <text x={x} y={padT + 44} textAnchor="middle" fontSize={9}
                fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>{v}</text>
            </g>
          );
        })}

        {/* Eigenvalue dots */}
        {uniq2.map(({ val, count }) => {
          const x = toX(val);
          const isTrivial = Math.abs(val - lambda1) < 1e-7;
          const outside = Math.abs(val) > bound + 1e-8 && !isTrivial;
          const color = isTrivial
            ? 'var(--accent)'
            : outside
            ? 'var(--warn)'
            : 'var(--accent-2)';
          return Array.from({ length: Math.min(count, 8) }, (_, i) => (
            <circle key={`${val.toFixed(5)}-${i}`}
              cx={x} cy={padT + 30 - 7 * (i + 1)}
              r={3.5} fill={color} fillOpacity={0.85}
              stroke="var(--bg)" strokeWidth={1} />
          ));
        })}

        {/* Gap bracket */}
        {(() => {
          const x1 = toX(lambda2);
          const x2 = toX(lambda1);
          const by = padT + 58;
          if (by > H - 4) return null;
          return (
            <g>
              <line x1={x1} y1={by} x2={x2} y2={by}
                stroke="var(--gold)" strokeWidth={2} />
              <line x1={x1} y1={by - 3} x2={x1} y2={by + 3}
                stroke="var(--gold)" strokeWidth={1.5} />
              <line x1={x2} y1={by - 3} x2={x2} y2={by + 3}
                stroke="var(--gold)" strokeWidth={1.5} />
              <text x={(x1 + x2) / 2} y={by + 12} textAnchor="middle" fontSize={9}
                fill="var(--gold)" style={{ fontFamily: 'var(--mono)' }}>
                gap={gap.toFixed(4)}
              </text>
            </g>
          );
        })()}
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="度 d = |S|" en="Degree d = |S|" /></span>
          <span className="gt-result-val gt-mono">{d}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\lambda_1`} /></span>
          <span className="gt-result-val gt-mono">{lambda1.toFixed(6)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\lambda_2`} /></span>
          <span className="gt-result-val gt-mono">{lambda2.toFixed(6)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\lambda_{\min}`} /></span>
          <span className="gt-result-val gt-mono">{lambdaMin.toFixed(6)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><TeX src={String.raw`\lambda(G)=\max_{i\ge2}|\lambda_i|`} /></span>
          <span className="gt-result-val-strong">{lambdaG.toFixed(6)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="谱隙 d−λ₂" en="Spectral gap d−λ₂" /></span>
          <span className="gt-result-val-strong" style={{ color: gap > 0.5 ? 'var(--green)' : gap > 0.1 ? 'var(--gold)' : 'var(--warn)' }}>
            {gap.toFixed(6)}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="Ramanujan 阈值 2√(d−1)" en="Ramanujan bound 2√(d−1)" /></span>
          <span className="gt-result-val gt-mono">{bound.toFixed(6)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="满足 Ramanujan 不等式？" en="Satisfies Ramanujan bound?" /></span>
          <span className="gt-result-val-strong" style={{ color: isRamanujan ? 'var(--green)' : 'var(--warn)' }}>
            {isRamanujan
              ? (lang === 'zh' ? '是' : 'Yes')
              : (lang === 'zh' ? '否' : 'No')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Panel 3: Random-walk mixing race ─────────────────────────────────────────

const RACE_PRESETS: { id: string; zhLabel: string; enLabel: string; genFn: (n: number) => number[] }[] = [
  {
    id: 'cycle',
    zhLabel: 'C_n（慢，生成元 {±1}）',
    enLabel: 'C_n (slow, gens {±1})',
    genFn: (n) => buildGeneratorSet(n, '±1'),
  },
  {
    id: 'dense',
    zhLabel: 'Z/n，生成元 {±1,±2}（快）',
    enLabel: 'Z/n, gens {±1,±2} (fast)',
    genFn: (n) => buildGeneratorSet(n, '±1,±2'),
  },
  {
    id: 'skip',
    zhLabel: 'Z/n，大步生成元（更快）',
    enLabel: 'Z/n, big-skip gens (faster)',
    genFn: (n) => buildGeneratorSet(n, '±1,±floor(n/3)'),
  },
];

const COLORS_RACE = ['#8B2E3C', '#2A4D69', '#3F7050'];

function MixingRacePanel() {
  const lang = useLang();
  const [n, setN] = useState(24);
  const [tMax] = useState(120);
  const [activePresets, setActivePresets] = useState<Set<string>>(new Set(['cycle', 'dense']));

  const togglePreset = useCallback((id: string) => {
    setActivePresets(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  }, []);

  // Compute mixing bounds for each active preset
  const curves = useMemo(() => {
    return RACE_PRESETS.filter(p => activePresets.has(p.id)).map((preset) => {
      const S = preset.genFn(n);
      const d = S.length;
      const evs = abelianSpectrum(n, S);
      const lambda2 = evs[1] ?? 0;
      const lambdaMin = evs[evs.length - 1] ?? 0;
      const lambdaG = Math.max(Math.abs(lambda2), Math.abs(lambdaMin));
      const gap = d - lambda2;
      // Use lazy-walk eigenvalue to avoid bipartite oscillation
      // λ_lazy = (1 + λ_adj/d) / 2, so max non-trivial = (1 + lambdaG/d)/2
      const lazyLambda = (1 + lambdaG / d) / 2;
      const points: { t: number; y: number }[] = [];
      for (let t = 0; t <= tMax; t++) {
        const bound = 0.5 * Math.sqrt(n - 1) * Math.pow(lazyLambda, t);
        points.push({ t, y: bound });
      }
      return {
        id: preset.id,
        zhLabel: preset.zhLabel,
        enLabel: preset.enLabel,
        color: COLORS_RACE[RACE_PRESETS.findIndex(p => p.id === preset.id) % COLORS_RACE.length],
        d, gap, lambdaG, lazyLambda, points,
      };
    });
  }, [n, activePresets, tMax]);

  // Find y range (log scale)
  const allY = curves.flatMap(c => c.points.map(p => p.y).filter(y => y > 1e-12));
  const yMin = Math.min(...allY, 1e-6);
  const yMax = Math.max(...allY, 1);

  // SVG dimensions for the log-scale chart
  const W = 320, H = 140;
  const padL = 36, padR = 10, padT = 12, padB = 24;
  const iW = W - padL - padR, iH = H - padT - padB;

  const logScale = (y: number) => {
    const ly = Math.log10(Math.max(y, 1e-12));
    const lo = Math.log10(yMin);
    const hi = Math.log10(Math.max(yMax, 1));
    return padT + iH * (1 - (ly - lo) / (hi - lo));
  };

  // y-axis ticks (powers of 10)
  const yTicks: number[] = [];
  for (let p = Math.floor(Math.log10(yMin)); p <= Math.ceil(Math.log10(yMax)); p++) {
    yTicks.push(Math.pow(10, p));
  }

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="面板 3 — 混合速度竞赛：谱隙决定收敛速率" en="Panel 3 — Mixing race: spectral gap governs convergence rate" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>
            懒游走（lazy walk，以概率 1/2 原地停留）的全变差距离谱上界为
            <TeX src={String.raw`\tfrac{1}{2}\sqrt{n-1}\cdot\!\left(\tfrac{1+\lambda(G)/d}{2}\right)^{\!t}`} />。
            谱隙越大，曲线下降越陡。Rubik 魔方在 HTM 中谱隙未知，但直径 20 对 4.3×10¹⁹ 个顶点体现了类似低直径扩张行为。
          </>}
          en={<>
            The lazy walk (stay in place with prob. 1/2) TV-distance spectral bound is
            <TeX src={String.raw`\tfrac{1}{2}\sqrt{n-1}\cdot\!\left(\tfrac{1+\lambda(G)/d}{2}\right)^{\!t}`} />.
            Larger spectral gap → steeper descent. The Rubik's Cube (diameter 20, 4.3×10¹⁹ vertices in HTM)
            illustrates the same low-diameter / fast-mixing intuition, though its exact spectral gap is unknown.
          </>}
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>n = {n}</label>
        <input
          type="range" min={8} max={80} value={n}
          onChange={e => setN(Number(e.target.value))}
          className="gt-input" style={{ flex: 1, minWidth: 100 }}
        />
      </div>
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {RACE_PRESETS.map((p, ci) => (
          <button key={p.id}
            className={`gt-chip${activePresets.has(p.id) ? ' gt-chip-active' : ''}`}
            style={activePresets.has(p.id) ? { borderColor: COLORS_RACE[ci] } : {}}
            onClick={() => togglePreset(p.id)}>
            <L zh={p.zhLabel} en={p.enLabel} />
          </button>
        ))}
      </div>

      {/* Log-scale mixing bound chart */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', marginTop: 8, maxWidth: W }}>
        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + iH} stroke="var(--rule)" strokeWidth={1.2} />
        <line x1={padL} y1={padT + iH} x2={W - padR} y2={padT + iH} stroke="var(--rule)" strokeWidth={1.2} />

        {/* y-axis ticks */}
        {yTicks.filter(y => y <= yMax * 1.1 && y >= yMin * 0.9).map(y => {
          const yPx = logScale(y);
          if (yPx < padT || yPx > padT + iH) return null;
          const label = y >= 1 ? y.toFixed(0) : y.toExponential(0);
          return (
            <g key={y}>
              <line x1={padL - 3} y1={yPx} x2={padL} y2={yPx} stroke="var(--ink-faint)" strokeWidth={1} />
              <text x={padL - 4} y={yPx + 3} textAnchor="end" fontSize={8}
                fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>{label}</text>
            </g>
          );
        })}

        {/* x-axis label */}
        <text x={padL + iW / 2} y={H - 2} textAnchor="middle" fontSize={9}
          fill="var(--ink-dim)" style={{ fontFamily: 'var(--mono)' }}>
          {lang === 'zh' ? '步数 t' : 'Steps t'}
        </text>

        {/* x-axis ticks */}
        {[0, Math.floor(tMax / 4), Math.floor(tMax / 2), Math.floor(3 * tMax / 4), tMax].map(t => {
          const xPx = padL + (t / tMax) * iW;
          return (
            <g key={t}>
              <line x1={xPx} y1={padT + iH} x2={xPx} y2={padT + iH + 3} stroke="var(--ink-faint)" strokeWidth={1} />
              <text x={xPx} y={padT + iH + 12} textAnchor="middle" fontSize={8}
                fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>{t}</text>
            </g>
          );
        })}

        {/* Mixing curves */}
        {curves.map(c => {
          const pts = c.points
            .filter(p => p.y > 1e-12)
            .map(p => {
              const xPx = padL + (p.t / tMax) * iW;
              const yPx = logScale(p.y);
              return `${xPx.toFixed(1)},${yPx.toFixed(1)}`;
            })
            .join(' ');
          return (
            <polyline key={c.id} points={pts}
              fill="none" stroke={c.color} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" />
          );
        })}

        {/* ε = 0.01 threshold line */}
        {(() => {
          const eLine = logScale(0.01);
          if (eLine < padT || eLine > padT + iH) return null;
          return (
            <>
              <line x1={padL} y1={eLine} x2={W - padR} y2={eLine}
                stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="3 3" />
              <text x={W - padR - 2} y={eLine - 2} textAnchor="end" fontSize={8}
                fill="var(--ink-dim)" style={{ fontFamily: 'var(--mono)' }}>ε=0.01</text>
            </>
          );
        })()}
      </svg>

      {/* Legend + numeric results */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        {curves.map(c => (
          <div key={c.id} style={{ flex: '1 1 200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 20, height: 3, background: c.color, borderRadius: 2 }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
                <L zh={c.zhLabel.split('（')[0]} en={c.enLabel.split(' (')[0]} />
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="度 d" en="Degree d" /></span>
              <span className="gt-result-val gt-mono">{c.d}</span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="谱隙" en="Spectral gap" /></span>
              <span className="gt-result-val-strong" style={{ color: c.gap > 0.5 ? 'var(--green)' : c.gap > 0.1 ? 'var(--gold)' : 'var(--warn)' }}>
                {c.gap.toFixed(5)}
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="λ(G)/d" en="λ(G)/d" /></span>
              <span className="gt-result-val gt-mono">
                {c.d > 0 ? (c.lambdaG / c.d).toFixed(5) : '—'}
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label">
                <L zh={`τ(0.01) 步`} en={`τ(0.01) steps`} />
              </span>
              <span className="gt-result-val gt-mono">
                {(() => {
                  const thresh = c.points.findIndex(p => p.y <= 0.01);
                  return thresh >= 0 ? thresh : `>${tMax}`;
                })()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main section export ───────────────────────────────────────────────────────

export default function ExpanderRamanujan() {
  return (
    <GTSec id="expander-ramanujan" className="gt-sec">
      <div className="gt-sec-num">§62</div>
      <h2 className="gt-sec-title">
        <L zh="扩张图与 Ramanujan 图" en="Expander &amp; Ramanujan graphs" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            Cayley 图不仅是群论的图示工具——它的邻接矩阵谱隐藏着关于随机游走、信息扩散与密码学的深层秘密。
            "谱隙"决定随机游走多快收敛到均匀分布，而 Ramanujan 图则以数论奇迹将这个速度推到理论极限。
            Rubik 魔方的状态空间本身就是一张 Cayley 图：4.3×10¹⁹ 个顶点，直径仅 20——扩张行为的活生生例证。
          </>}
          en={<>
            Cayley graphs are not merely a pictorial device for group theory — the spectrum of their
            adjacency matrix encodes deep facts about random walks, information spreading, and cryptography.
            The "spectral gap" dictates how quickly a random walk reaches the uniform distribution, and
            Ramanujan graphs push this speed to the theoretical optimum via a feat of number theory.
            The Rubik's Cube state space is itself a Cayley graph: 4.3×10¹⁹ vertices, diameter only 20 — a
            vivid illustration of expander-like behavior.
          </>}
        />
      </p>

      {/* Definition: Cayley graph */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义 — Cayley 图 Cay(G, S)" en="Definition — Cayley graph Cay(G, S)" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>
                设 <TeX src={String.raw`G`} /> 为有限群，<TeX src={String.raw`S \subseteq G`} /> 为<em>对称生成集</em>：
                <TeX src={String.raw`S = S^{-1}`} />（即 <TeX src={String.raw`s \in S \Rightarrow s^{-1} \in S`} />），
                且 <TeX src={String.raw`1 \notin S`} />。
                <strong>Cayley 图</strong> <TeX src={String.raw`\mathrm{Cay}(G,S)`} /> 是以 <TeX src={String.raw`G`} /> 为顶点集、
                以 <TeX src={String.raw`\{g,\,gs\}`} />（<TeX src={String.raw`g\in G,\,s\in S`} />）为边集的无向图。
                它是 <TeX src={String.raw`d`} />-正则图，其中 <TeX src={String.raw`d = |S|`} />；当且仅当 <TeX src={String.raw`S`} /> 生成 <TeX src={String.raw`G`} /> 时连通。
              </>}
              en={<>
                Let <TeX src={String.raw`G`} /> be a finite group and <TeX src={String.raw`S\subseteq G`} /> a
                <em>symmetric generating set</em>: <TeX src={String.raw`S=S^{-1}`} />
                (i.e. <TeX src={String.raw`s\in S\Rightarrow s^{-1}\in S`} />) with <TeX src={String.raw`1\notin S`} />.
                The <strong>Cayley graph</strong> <TeX src={String.raw`\mathrm{Cay}(G,S)`} /> has vertex set <TeX src={String.raw`G`} /> and
                edges <TeX src={String.raw`\{g,gs\}`} /> for <TeX src={String.raw`g\in G`} />, <TeX src={String.raw`s\in S`} />.
                It is <TeX src={String.raw`d`} />-regular with <TeX src={String.raw`d=|S|`} />, connected iff <TeX src={String.raw`S`} /> generates <TeX src={String.raw`G`} />.
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                邻接矩阵 <TeX src={String.raw`A`} />（对称 0/1 矩阵）有 <TeX src={String.raw`n = |G|`} /> 个实特征值
                <TeX src={String.raw`d = \lambda_1 \ge \lambda_2 \ge \cdots \ge \lambda_n`} />。
                最大特征值 <TeX src={String.raw`\lambda_1 = d`} /> 对应全 1 向量，是最简单的"平凡"模式。
              </>}
              en={<>
                The adjacency matrix <TeX src={String.raw`A`} /> (symmetric 0/1) has <TeX src={String.raw`n=|G|`} /> real
                eigenvalues <TeX src={String.raw`d=\lambda_1\ge\lambda_2\ge\cdots\ge\lambda_n`} />.
                The largest, <TeX src={String.raw`\lambda_1=d`} />, corresponds to the all-ones vector — the trivial "constant" mode.
              </>}
            />
          </p>
        </div>
      </div>

      {/* Definition: Spectral gap & expander */}
      <div className="gt-def" style={{ marginTop: 24 }}>
        <div className="gt-def-title">
          <L zh="定义 — 谱隙与扩张族" en="Definition — Spectral gap and expander family" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>
                连通 <TeX src={String.raw`d`} />-正则图的<strong>（邻接）谱隙</strong>为
                <TeX src={String.raw`d - \lambda_2`} />，其中 <TeX src={String.raw`\lambda_2`} /> 是第二大特征值。
                双侧谱参数 <TeX src={String.raw`\lambda(G) := \max_{i \ge 2}|\lambda_i|`} /> 同时控制负端，
                对连通性更完备。谱隙越大，随机游走收敛越快，Cheeger 常数（边扩张）越好。
              </>}
              en={<>
                The <strong>(adjacency) spectral gap</strong> of a connected <TeX src={String.raw`d`} />-regular graph is
                <TeX src={String.raw`d-\lambda_2`} />. The two-sided parameter
                <TeX src={String.raw`\lambda(G):=\max_{i\ge2}|\lambda_i|`} /> also captures the negative end, and
                is the relevant quantity for random-walk mixing and Cheeger expansion.
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                一族 <TeX src={String.raw`d`} />-正则图 <TeX src={String.raw`\{G_m\}`} />（<TeX src={String.raw`|V(G_m)|\to\infty`} />）
                是<strong>扩张族</strong>，若存在固定 <TeX src={String.raw`\varepsilon > 0`} /> 使得对所有 <TeX src={String.raw`m`} />：
                <TeX src={String.raw`\lambda_2(G_m) \le d - \varepsilon`} />。
                注意："扩张"是<em>族</em>的属性，不是单张图的属性——单张图的谱隙只是一个数字。
              </>}
              en={<>
                A family <TeX src={String.raw`\{G_m\}`} /> of <TeX src={String.raw`d`} />-regular graphs with <TeX src={String.raw`|V(G_m)|\to\infty`} /> is
                an <strong>expander family</strong> if there exists a fixed <TeX src={String.raw`\varepsilon>0`} /> such that
                <TeX src={String.raw`\lambda_2(G_m)\le d-\varepsilon`} /> for all <TeX src={String.raw`m`} />.
                Crucially, "expander" is a property of an <em>infinite family</em> at fixed degree — never of a single graph.
              </>}
            />
          </p>
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="Alon–Boppana 定理与 Ramanujan 图" en="The Alon–Boppana theorem and Ramanujan graphs" />
      </h3>

      <p>
        <L
          zh={<>
            不是任何正则族都能成为扩张族——事实上，谱隙有不可逾越的渐近上界。
            对无限 <TeX src={String.raw`d`} />-正则图族（<TeX src={String.raw`d \ge 3`} />），Alon–Boppana 定理给出：
          </>}
          en={<>
            Not every regular family can be an expander — there is an inescapable asymptotic ceiling on the spectral gap.
            For infinite <TeX src={String.raw`d`} />-regular families with <TeX src={String.raw`d\ge3`} />, the Alon–Boppana theorem gives:
          </>}
        />
      </p>

      {/* Theorem: Alon-Boppana */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 (Alon–Boppana)" en="Theorem (Alon–Boppana)" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>
                对任意 <TeX src={String.raw`d \ge 3`} /> 和任意 <TeX src={String.raw`\varepsilon > 0`} />，存在 <TeX src={String.raw`N`} />
                使得每个顶点数 <TeX src={String.raw`\ge N`} /> 的连通 <TeX src={String.raw`d`} />-正则图满足
                <TeXBlock src={String.raw`\lambda_2 \ge 2\sqrt{d-1} - \varepsilon.`} />
                等价地，<TeX src={String.raw`\liminf_{n\to\infty} \lambda_2(G_n) \ge 2\sqrt{d-1}`} />
                对任意 <TeX src={String.raw`d`} />-正则图序列成立。
              </>}
              en={<>
                For every <TeX src={String.raw`d\ge3`} /> and every <TeX src={String.raw`\varepsilon>0`} /> there exists <TeX src={String.raw`N`} />
                such that every connected <TeX src={String.raw`d`} />-regular graph on at least <TeX src={String.raw`N`} /> vertices satisfies
                <TeXBlock src={String.raw`\lambda_2 \ge 2\sqrt{d-1} - \varepsilon.`} />
                Equivalently, <TeX src={String.raw`\liminf_{n\to\infty}\lambda_2(G_n)\ge 2\sqrt{d-1}`} />
                for any <TeX src={String.raw`d`} />-regular sequence.
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                直觉：<TeX src={String.raw`2\sqrt{d-1}`} /> 是无限 <TeX src={String.raw`d`} />-正则树（即 <TeX src={String.raw`d`} />-正则图的万有覆叠）的谱半径。
                有限图的谱必须"感受到"无限树的谱，故 <TeX src={String.raw`\lambda_2`} /> 不能比 <TeX src={String.raw`2\sqrt{d-1}`} /> 小太多。
              </>}
              en={<>
                Intuition: <TeX src={String.raw`2\sqrt{d-1}`} /> is the spectral radius of the infinite <TeX src={String.raw`d`} />-regular tree,
                the universal cover of any <TeX src={String.raw`d`} />-regular graph. The spectrum of any finite graph must "feel"
                the tree's spectrum, so <TeX src={String.raw`\lambda_2`} /> cannot fall too far below <TeX src={String.raw`2\sqrt{d-1}`} />.
              </>}
            />
          </p>
        </div>
      </div>

      {/* Definition: Ramanujan graph */}
      <div className="gt-def" style={{ marginTop: 24 }}>
        <div className="gt-def-title">
          <L zh="定义 — Ramanujan 图" en="Definition — Ramanujan graph" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>
                连通 <TeX src={String.raw`d`} />-正则图 <TeX src={String.raw`G`} /> 是 <strong>Ramanujan 图</strong>，若每个非平凡特征值满足
                <TeXBlock src={String.raw`|\lambda_i| \le 2\sqrt{d-1}, \quad i \ge 2.`} />
                即 <TeX src={String.raw`\lambda(G) \le 2\sqrt{d-1}`} />。Ramanujan 图达到了 Alon–Boppana 给出的渐近最优——
                它们是最佳谱扩张图。其名来自 Deligne 对 Ramanujan–Petersson 猜想的证明，后者是 Lubotzky–Phillips–Sarnak 构造的关键。
              </>}
              en={<>
                A connected <TeX src={String.raw`d`} />-regular graph <TeX src={String.raw`G`} /> is a <strong>Ramanujan graph</strong>
                if every non-trivial eigenvalue satisfies
                <TeXBlock src={String.raw`|\lambda_i| \le 2\sqrt{d-1}, \quad i \ge 2.`} />
                i.e. <TeX src={String.raw`\lambda(G)\le2\sqrt{d-1}`} />. Ramanujan graphs achieve the asymptotic optimum
                given by Alon–Boppana — they are the best possible spectral expanders. The name comes from
                Deligne's proof of the Ramanujan–Petersson conjecture, which is the key analytic input in the
                Lubotzky–Phillips–Sarnak construction.
              </>}
            />
          </p>
        </div>
      </div>

      {/* Theorem: LPS existence */}
      <div className="gt-thm" style={{ marginTop: 24 }}>
        <div className="gt-thm-title">
          <L zh="定理 (Lubotzky–Phillips–Sarnak 1988; Margulis)" en="Theorem (Lubotzky–Phillips–Sarnak 1988; Margulis)" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>
                对每个素数 <TeX src={String.raw`p \equiv 1 \pmod{4}`} />，存在一个显式无限族连通
                <TeX src={String.raw`(p+1)`} />-正则 Ramanujan 图（LPS 图 <TeX src={String.raw`X^{p,q}`} />），
                构造为 <TeX src={String.raw`\mathrm{PSL}(2,\mathbb{Z}/q\mathbb{Z})`} /> 的 Cayley 图，
                生成元来自 Jacobi 四平方和表示。Ramanujan 性质由 Deligne 的 Ramanujan–Petersson 定理保证。
                Marcus–Spielman–Srivastava (2015) 后来证明了每个度 <TeX src={String.raw`d \ge 3`} /> 的二部 Ramanujan 图均存在（但非显式）。
              </>}
              en={<>
                For every prime <TeX src={String.raw`p\equiv1\pmod4`} /> there exists an explicit infinite family of
                connected <TeX src={String.raw`(p+1)`} />-regular Ramanujan graphs (the LPS graphs <TeX src={String.raw`X^{p,q}`} />),
                constructed as Cayley graphs of <TeX src={String.raw`\mathrm{PSL}(2,\mathbb{Z}/q\mathbb{Z})`} />
                with <TeX src={String.raw`p+1`} /> generators from Jacobi's four-square representation of <TeX src={String.raw`p`} />.
                The Ramanujan property follows from Deligne's theorem on the Ramanujan–Petersson conjecture.
                Marcus–Spielman–Srivastava (2015) later proved bipartite Ramanujan graphs of every degree <TeX src={String.raw`d\ge3`} /> exist
                (non-explicitly).
              </>}
            />
          </p>
        </div>
      </div>

      {/* Cheeger inequality */}
      <div className="gt-aside" style={{ marginTop: 24 }}>
        <L
          zh={<>
            <strong>离散 Cheeger 不等式</strong>（Alon–Milman）：设 <TeX src={String.raw`g = d - \lambda_2`} /> 为谱隙，
            <TeX src={String.raw`h(G)`} /> 为边扩张常数（Cheeger 常数），则
            <TeXBlock src={String.raw`\frac{g}{2} \;\le\; h(G) \;\le\; \sqrt{2dg}.`} />
            谱隙与边扩张两侧相互夹逼：大谱隙 ↔ 大边扩张（每个小顶点集都有大量"出边"）。
          </>}
          en={<>
            <strong>Discrete Cheeger inequality</strong> (Alon–Milman): let <TeX src={String.raw`g=d-\lambda_2`} /> be the spectral gap
            and <TeX src={String.raw`h(G)`} /> the edge-expansion (Cheeger) constant; then
            <TeXBlock src={String.raw`\frac{g}{2} \;\le\; h(G) \;\le\; \sqrt{2dg}.`} />
            Spectral gap and edge expansion are two-sidedly equivalent: large gap ↔ good expansion
            (every small vertex set sends many edges outward).
          </>}
        />
      </div>

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="循环群 C_n 的精确谱" en="Exact spectrum of the cycle C_n" />
      </h3>

      <p>
        <L
          zh={<>
            循环图 <TeX src={String.raw`C_n = \mathrm{Cay}(\mathbb{Z}/n, \{\pm1\})`} /> 是 2-正则图，
            其邻接矩阵是一个循环矩阵，可用离散傅里叶变换精确对角化：
            特征值恰好是 <TeX src={String.raw`\lambda_k = 2\cos(2\pi k/n)`} />（<TeX src={String.raw`k = 0,\ldots,n-1`} />），
            特征向量为离散 Fourier 模式 <TeX src={String.raw`v_k(j) = e^{2\pi i kj/n}`} />。
            谱隙 <TeX src={String.raw`2 - 2\cos(2\pi/n) = 4\sin^2(\pi/n) \to 0`} />（<TeX src={String.raw`n\to\infty`} />），
            故循环族<em>不是</em>扩张族，混合时间为 <TeX src={String.raw`\Theta(n^2)`} />。
          </>}
          en={<>
            The cycle <TeX src={String.raw`C_n=\mathrm{Cay}(\mathbb{Z}/n,\{\pm1\})`} /> is 2-regular. Its adjacency matrix
            is circulant and is exactly diagonalized by the DFT:
            eigenvalues <TeX src={String.raw`\lambda_k=2\cos(2\pi k/n)`} /> for <TeX src={String.raw`k=0,\ldots,n-1`} />,
            with eigenvectors <TeX src={String.raw`v_k(j)=e^{2\pi ikj/n}`} />.
            Spectral gap <TeX src={String.raw`2-2\cos(2\pi/n)=4\sin^2(\pi/n)\to0`} /> as <TeX src={String.raw`n\to\infty`} />,
            so cycles are <em>not</em> an expander family, with mixing time <TeX src={String.raw`\Theta(n^2)`} />.
          </>}
        />
      </p>

      <p>
        <L
          zh={<>
            注意 <TeX src={String.raw`d = 2`} /> 时 Ramanujan 阈值恰为 <TeX src={String.raw`2\sqrt{d-1} = 2`} />——
            循环图的所有非平凡特征值满足 <TeX src={String.raw`|\lambda_i| \le 2`} />，故<em>每个</em> <TeX src={String.raw`C_n`} /> 在技术上满足 Ramanujan 不等式，
            但这是退化情形：<TeX src={String.raw`d = 2`} /> 时 Alon–Boppana 不适用（需要 <TeX src={String.raw`d \ge 3`} />），
            且谱隙趋于 0 意味着循环族根本不是扩张族。
          </>}
          en={<>
            Note that for <TeX src={String.raw`d=2`} /> the Ramanujan bound is exactly <TeX src={String.raw`2\sqrt{d-1}=2`} />,
            so every <TeX src={String.raw`C_n`} /> trivially satisfies <TeX src={String.raw`|\lambda_i|\le2`} /> — a degenerate case.
            The Alon–Boppana theorem requires <TeX src={String.raw`d\ge3`} />, and the vanishing spectral gap
            already disqualifies cycles as an expander family.
          </>}
        />
      </p>

      {/* Panel 1 */}
      <CycleSpectrumPanel />

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="用字符表计算阿贝尔 Cayley 图谱" en="Abelian Cayley spectra via characters" />
      </h3>

      <p>
        <L
          zh={<>
            对有限阿贝尔群 <TeX src={String.raw`\mathbb{Z}/n`} />，字符 <TeX src={String.raw`\chi_a(x) = e^{2\pi i ax/n}`} /> 是所有不可约表示。
            若生成集 <TeX src={String.raw`S`} /> 对称，则每个字符给出一个<em>实</em>特征值
            <TeXBlock src={String.raw`\lambda_a = \sum_{s \in S} \cos\!\tfrac{2\pi a s}{n},`} />
            虚部全部抵消（因为 <TeX src={String.raw`s \in S \Rightarrow -s \in S`} />）。
            这是纯闭合公式，不需要数值求解特征方程。
            用更多生成元（更大的 <TeX src={String.raw`S`} />）可以显著增大谱隙——代价是度 <TeX src={String.raw`d`} /> 增加。
          </>}
          en={<>
            For the finite abelian group <TeX src={String.raw`\mathbb{Z}/n`} />, the characters <TeX src={String.raw`\chi_a(x)=e^{2\pi iax/n}`} /> are
            all irreducible representations. For a symmetric <TeX src={String.raw`S`} />, each character gives a <em>real</em> eigenvalue
            <TeXBlock src={String.raw`\lambda_a = \sum_{s\in S}\cos\!\tfrac{2\pi as}{n},`} />
            because imaginary parts cancel pairwise (<TeX src={String.raw`s\in S\Rightarrow -s\in S`} />).
            This is a pure closed-form formula — no numerical eigensolver is needed.
            Using more generators (larger <TeX src={String.raw`|S|`} />) substantially increases the spectral gap,
            at the cost of higher degree <TeX src={String.raw`d`} />.
          </>}
        />
      </p>

      {/* Panel 2 */}
      <AbelianSpectrumPanel />

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="谱隙决定混合速度" en="Spectral gap governs mixing speed" />
      </h3>

      <p>
        <L
          zh={<>
            设 <TeX src={String.raw`p_t`} /> 为从某一顶点出发的 <TeX src={String.raw`t`} /> 步游走分布，<TeX src={String.raw`U`} /> 为均匀分布。
            对<em>懒游走</em>（以概率 1/2 原地停留，消除二部图振荡），全变差距离满足谱上界：
            <TeXBlock src={String.raw`\|p_t - U\|_{\mathrm{TV}} \;\le\; \tfrac{1}{2}\sqrt{n-1} \cdot \left(\frac{1 + \lambda(G)/d}{2}\right)^{\!t}.`} />
            记 <TeX src={String.raw`\mu = (1+\lambda(G)/d)/2`} />，则混合时间
            <TeX src={String.raw`\tau(\varepsilon) = O\!\left(\log(n/\varepsilon) / \log(1/\mu)\right)`} />。
            大谱隙 → <TeX src={String.raw`\mu`} /> 小 → 曲线下降陡 → 混合快。
          </>}
          en={<>
            Let <TeX src={String.raw`p_t`} /> be the distribution of a <TeX src={String.raw`t`} />-step walk from a fixed start,
            and <TeX src={String.raw`U`} /> uniform. For the <em>lazy walk</em> (stay with prob. 1/2, eliminating bipartite oscillation),
            the TV distance satisfies the spectral bound:
            <TeXBlock src={String.raw`\|p_t-U\|_{\mathrm{TV}} \;\le\; \tfrac{1}{2}\sqrt{n-1}\cdot\left(\frac{1+\lambda(G)/d}{2}\right)^{\!t}.`} />
            Writing <TeX src={String.raw`\mu=(1+\lambda(G)/d)/2`} />, mixing time
            <TeX src={String.raw`\tau(\varepsilon)=O\!\left(\log(n/\varepsilon)/\log(1/\mu)\right)`} />.
            Large gap → small <TeX src={String.raw`\mu`} /> → steep descent → fast mixing.
          </>}
        />
      </p>

      {/* Panel 3 */}
      <MixingRacePanel />

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="Rubik 魔方：一张 Cayley 图" en="The Rubik's Cube as a Cayley graph" />
      </h3>

      <p>
        <L
          zh={<>
            魔方的状态空间恰好构成一张 Cayley 图：
            顶点是 <TeX src={String.raw`|G| = 43{,}252{,}003{,}274{,}489{,}856{,}000`} />（约 4.3×10¹⁹）种状态，
            每条有向边是一次面转动。
            在<em>半转度量</em>（HMT，18 个生成元 <TeX src={String.raw`\{U,U',U2,\ldots\}`} />，18-正则）中，
            "上帝数"—— Cayley 图的直径——经 Rokicki 等 2010 年计算机辅助穷举证明为 <strong>20</strong>。
            在<em>四分之一转度量</em>（QTM，12 个生成元，12-正则）中直径为 <strong>26</strong>。
          </>}
          en={<>
            The Rubik's Cube state space is exactly a Cayley graph:
            vertices are <TeX src={String.raw`|G|=43{,}252{,}003{,}274{,}489{,}856{,}000`} /> (≈ 4.3×10¹⁹) states,
            and each directed edge is one face turn.
            In the <em>half-turn metric</em> (HTM, 18 generators <TeX src={String.raw`\{U,U',U2,\ldots\}`} />, 18-regular),
            "God's Number" — the graph diameter — was proven to be <strong>20</strong> by Rokicki et al. (2010)
            via exhaustive computer search. In the <em>quarter-turn metric</em> (QTM, 12 generators, 12-regular)
            the diameter is <strong>26</strong>.
          </>}
        />
      </p>

      <p>
        <L
          zh={<>
            直径 20 对应顶点数 4.3×10¹⁹ 意味着什么？以 18 为底：<TeX src={String.raw`18^{20} \approx 1.27\times10^{25} > |G|`} />，
            即直径约为 <TeX src={String.raw`\log_{18}|G|`} /> 量级——这正是低直径"类扩张"行为的特征。
            这也是 WCA 竞赛打乱使用约 20 步随机转动即可充分打乱的理论依据：少数随机步转动已足以将魔方分布推向接近均匀。
          </>}
          en={<>
            What does diameter 20 mean against 4.3×10¹⁹ vertices?
            Since <TeX src={String.raw`18^{20}\approx1.27\times10^{25}>|G|`} />, the diameter is of order <TeX src={String.raw`\log_{18}|G|`} /> —
            the hallmark of low-diameter expander-like behavior.
            This is also why WCA scrambles use roughly 20 random moves: a handful of random face turns
            is already sufficient to push the cube's distribution close to uniform.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            <strong>重要区分。</strong> 魔方 Cayley 图是一张<em>固定的单张</em>图，而"扩张"和"Ramanujan"是无限正则族的属性。
            把单张魔方图称为"扩张图"或"Ramanujan 图"在范畴上是错误的。
            魔方图的精确 <TeX src={String.raw`\lambda_2`} /> 至今未知。
            魔方的正确地位是：Cayley 图的生动实例，以及扩张行为的<em>直觉</em>来源——不是谱意义上的范例。
          </>}
          en={<>
            <strong>Important distinction.</strong> The Rubik's Cube Cayley graph is a single fixed graph,
            while "expander" and "Ramanujan" are properties of infinite families. Calling one cube graph
            an "expander" or "Ramanujan graph" is a category error. The cube graph's exact <TeX src={String.raw`\lambda_2`} /> is
            unknown in closed form. The cube's correct role here is as a vivid Cayley-graph illustration
            and intuitive motivation for expansion — not a spectral exemplar.
          </>}
        />
      </div>

      {/* References */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, marginTop: 40, marginBottom: 10, color: 'var(--ink-dim)' }}>
        <L zh="参考文献" en="References" />
      </h3>
      <ul style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.9, paddingLeft: 20 }}>
        <li>S. Hoory, N. Linial, A. Wigderson, "Expander graphs and their applications," <em>Bull. AMS</em> 43 (2006), 439–561.</li>
        <li>A. Lubotzky, R. Phillips, P. Sarnak, "Ramanujan graphs," <em>Combinatorica</em> 8 (1988), 261–277.</li>
        <li>A. Marcus, D. Spielman, N. Srivastava, "Interlacing families II: mixed characteristic polynomials," <em>Ann. of Math.</em> 182 (2015).</li>
        <li>A. E. Brouwer, W. H. Haemers, <em>Spectra of Graphs</em>, Springer 2012, §1.4.</li>
        <li>T. Rokicki et al., "God's Number is 20," <em>SIAM J. Discrete Math.</em> 27 (2013); <a href="https://cube20.org" style={{ color: 'var(--accent-2)' }}>cube20.org</a>.</li>
      </ul>
    </GTSec>
  );
}
