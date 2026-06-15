'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Categorical palette ──────────────────────────────────────────────────────
const PAL = ['#8B2E3C','#2A4D69','#3F7050','#B8860B','#6B4E9C','#C2410C','#5C7CA0','#9C4E6B'];

// ── 2D reflection & orbit helpers ───────────────────────────────────────────
/** Reflect point p across line through origin at angle a (radians). */
function reflectAcrossLine(px: number, py: number, a: number): [number, number] {
  const c2 = Math.cos(2 * a);
  const s2 = Math.sin(2 * a);
  return [c2 * px + s2 * py, s2 * px - c2 * py];
}

/** Compute the 2m-point dihedral orbit of a seed point under I_2(m).
 *  L1 at angle 0, L2 at angle phi = π/m.
 *  Returns array of {x,y,label} where label is the word s1/s2 used. */
interface OrbitPoint { x: number; y: number; label: string; idx: number }
function computeDihedralOrbit(seedX: number, seedY: number, m: number): OrbitPoint[] {
  const phi = Math.PI / m;
  // Group elements: rotations (s1 s2)^k and reflections s1·(s1 s2)^k, k=0..m-1
  const pts: OrbitPoint[] = [];
  for (let k = 0; k < m; k++) {
    // rotation by 2k·phi  (= (s1 s2)^k applied to seed)
    const angle = 2 * k * phi;
    const c = Math.cos(angle), s = Math.sin(angle);
    pts.push({ x: c * seedX - s * seedY, y: s * seedX + c * seedY, label: k === 0 ? 'e' : `(s₁s₂)^${k}`, idx: k });
    // reflection in line at k·phi  (= s1·(s1 s2)^k)
    const [rx, ry] = reflectAcrossLine(c * seedX - s * seedY, s * seedX + c * seedY, 0);
    pts.push({ x: rx, y: ry, label: k === 0 ? 's₁' : `s₁(s₁s₂)^${k}`, idx: m + k });
  }
  return pts;
}

// ── Widget 1: Dihedral mirror orbit ─────────────────────────────────────────
function DihedralWidget() {
  const lang = useLang();
  const [m, setM] = useState(4);
  const [showLabels, setShowLabels] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  // Seed point in viewport coords (SVG viewBox [-1,1]²), default non-special position
  const [seed, setSeed] = useState<[number, number]>([0.55, 0.20]);
  const [dragging, setDragging] = useState(false);

  const phi = Math.PI / m;
  const orbit = useMemo(() => computeDihedralOrbit(seed[0], seed[1], m), [seed, m]);

  // SVG coordinate helpers: viewBox -1.2 to 1.2
  const vb = 1.25;
  const toSvg = (v: number) => ((v + vb) / (2 * vb)) * 260;

  const getSvgPoint = useCallback((e: React.PointerEvent<SVGSVGElement>): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 2 * vb - vb;
    const sy = ((e.clientY - rect.top) / rect.height) * 2 * vb - vb;
    const r = Math.hypot(sx, sy);
    // Clamp to circle of radius 0.9 to stay in viewport
    if (r > 0.9) return [sx / r * 0.9, sy / r * 0.9];
    return [sx, sy];
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const p = getSvgPoint(e);
    if (!p) return;
    const dist = Math.hypot(p[0] - seed[0], p[1] - seed[1]);
    if (dist < 0.12) { setDragging(true); (e.target as Element).setPointerCapture?.(e.pointerId); }
  }, [getSvgPoint, seed]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const p = getSvgPoint(e);
    if (p) setSeed(p);
  }, [dragging, getSvgPoint]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  // Mirror lines at angles 0 and phi
  const mirrorLines = [0, phi];
  const R = 1.05;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="二面群轨道 I₂(m)" en="Dihedral orbit I₂(m)" />
      </div>
      <p className="gt-panel-sub">
        <L
          zh={<>两条镜像线交角 <TeX src={String.raw`\pi/m`} />，对一点反复反射，轨道恰有 2m 个点。</>}
          en={<>Two mirrors meeting at angle <TeX src={String.raw`\pi/m`} />; reflecting a point alternately generates exactly 2m orbit points.</>}
        />
      </p>
      <div className="gt-panel-input-row">
        <label>{lang === 'zh' ? 'm =' : 'm ='}</label>
        <input
          type="range" min={2} max={12} value={m}
          onChange={e => setM(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--ink)', minWidth: 18 }}>{m}</span>
        <label style={{ marginLeft: 8 }}>
          <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)}
            style={{ marginRight: 5 }} />
          <L zh="显示生成元" en="labels" />
        </label>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 260 260`}
        width="100%"
        style={{ display: 'block', touchAction: 'none', cursor: dragging ? 'grabbing' : 'default', maxWidth: 360, margin: '0 auto' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Background circle */}
        <circle cx={130} cy={130} r={toSvg(R) - toSvg(0)} fill="none" stroke="var(--rule)" strokeWidth={1} />
        {/* Fundamental wedge shading (angle 0 to phi) */}
        {(() => {
          const r = toSvg(R) - toSvg(0);
          const cx = 130, cy = 130;
          const x1 = cx + r * Math.cos(0), y1 = cy - r * Math.sin(0);
          const x2 = cx + r * Math.cos(phi), y2 = cy - r * Math.sin(phi);
          const large = phi > Math.PI ? 1 : 0;
          return (
            <path
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2} Z`}
              fill="var(--accent)" fillOpacity={0.07}
            />
          );
        })()}
        {/* Mirror lines */}
        {mirrorLines.map((a, i) => {
          const r = toSvg(R) - toSvg(0);
          const cx = 130, cy = 130;
          return (
            <line
              key={i}
              x1={cx - r * Math.cos(a)} y1={cy + r * Math.sin(a)}
              x2={cx + r * Math.cos(a)} y2={cy - r * Math.sin(a)}
              stroke={i === 0 ? 'var(--accent)' : 'var(--accent-2)'}
              strokeWidth={1.5} strokeDasharray={i === 0 ? '' : '5 3'}
            />
          );
        })}
        {/* Mirror labels */}
        {(() => {
          const r = toSvg(R) - toSvg(0) + 14;
          const cx = 130, cy = 130;
          return [0, phi].map((a, i) => (
            <text key={i}
              x={cx + r * Math.cos(a)} y={cy - r * Math.sin(a)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={11} fill={i === 0 ? 'var(--accent)' : 'var(--accent-2)'}
              fontFamily="var(--mono)"
            >
              {i === 0 ? 'L₁' : 'L₂'}
            </text>
          ));
        })()}
        {/* Angle arc annotation π/m */}
        {(() => {
          const arcR = 28;
          const cx = 130, cy = 130;
          const x1 = cx + arcR * Math.cos(0), y1 = cy - arcR * Math.sin(0);
          const x2 = cx + arcR * Math.cos(phi), y2 = cy - arcR * Math.sin(phi);
          const large = phi > Math.PI ? 1 : 0;
          const midA = phi / 2;
          return (
            <>
              <path d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 ${large} 0 ${x2} ${y2}`}
                fill="none" stroke="var(--ink-faint)" strokeWidth={1} />
              <text x={cx + (arcR + 12) * Math.cos(midA)} y={cy - (arcR + 12) * Math.sin(midA)}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fill="var(--ink-faint)" fontFamily="var(--mono)">π/m</text>
            </>
          );
        })()}
        {/* Orbit points */}
        {orbit.map((pt, i) => {
          const px = 130 + (pt.x / vb) * 130;
          const py = 130 - (pt.y / vb) * 130;
          const color = i === 0 ? 'var(--accent)' : (i % 2 === 0 ? PAL[2] : PAL[4]);
          return (
            <g key={i}>
              <circle cx={px} cy={py} r={i === 0 ? 6 : 4.5}
                fill={color} stroke="var(--bg)" strokeWidth={1.5} />
              {showLabels && (
                <text x={px + 7} y={py - 7} fontSize={8}
                  fill="var(--ink-dim)" fontFamily="var(--mono)">{pt.label}</text>
              )}
            </g>
          );
        })}
        {/* Polygon outline */}
        {orbit.length >= 2 && (
          <polygon
            points={orbit.map(pt => `${130 + (pt.x / vb) * 130},${130 - (pt.y / vb) * 130}`).join(' ')}
            fill="none" stroke="var(--ink-faint)" strokeWidth={0.8} strokeDasharray="3 2"
          />
        )}
        {/* Drag handle for seed */}
        <circle
          cx={130 + (seed[0] / vb) * 130} cy={130 - (seed[1] / vb) * 130}
          r={7} fill="var(--accent)" stroke="white" strokeWidth={2}
          style={{ cursor: 'grab' }}
        />
        <text x={130 + (seed[0] / vb) * 130 + 9} y={130 - (seed[1] / vb) * 130}
          fontSize={11} fill="var(--accent)" fontFamily="var(--mono)" dominantBaseline="middle">P</text>
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="m (阶参数)" en="m (order param)" /></span>
          <span className="gt-result-val">{m}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="镜像线夹角" en="mirror angle" /></span>
          <span className="gt-result-val"><TeX src={String.raw`\pi/${m}`} /></span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="乘积 s₁s₂ 的阶" en="order of s₁s₂" /></span>
          <span className="gt-result-val">{m}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="轨道点数 = |I₂(m)|" en="orbit size = |I₂(m)|" /></span>
          <span className="gt-result-val-strong">{2 * m}</span>
        </div>
      </div>
    </div>
  );
}

// ── Widget 2: Type A_n – adjacent transpositions (bubble sort) ───────────────
const TILE_COLORS = ['#8B2E3C','#2A4D69','#3F7050','#B8860B','#6B4E9C','#C2410C'];

function countInversions(perm: number[]): number {
  let count = 0;
  for (let i = 0; i < perm.length; i++)
    for (let j = i + 1; j < perm.length; j++)
      if (perm[i] > perm[j]) count++;
  return count;
}

function scramblePerm(n: number): number[] {
  const p = Array.from({ length: n }, (_, i) => i);
  // Fisher-Yates shuffle. Math.random() here is safe because scramblePerm is
  // only ever invoked from the doScramble event handler, never during render.
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

function TypeAWidget() {
  const lang = useLang();
  const [n, setN] = useState(3); // permuting n+1 tokens
  const size = n + 1;
  const [perm, setPerm] = useState<number[]>(() => Array.from({ length: 4 }, (_, i) => i));
  const [word, setWord] = useState<number[]>([]); // list of generator indices (1-based)
  const [lastSwapped, setLastSwapped] = useState<number | null>(null);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  // Resize perm when n changes
  const prevN = useRef(n);
  useEffect(() => {
    if (prevN.current !== n) {
      prevN.current = n;
      setPerm(Array.from({ length: n + 1 }, (_, i) => i));
      setWord([]);
      setLastSwapped(null);
      setVerifyResult(null);
    }
  }, [n]);

  const applySwap = useCallback((i: number) => {
    setPerm(p => {
      const np = [...p];
      [np[i - 1], np[i]] = [np[i], np[i - 1]];
      return np;
    });
    setWord(w => [...w, i]);
    setLastSwapped(i);
    setVerifyResult(null);
  }, []);

  const reset = useCallback(() => {
    setPerm(Array.from({ length: size }, (_, i) => i));
    setWord([]);
    setLastSwapped(null);
    setVerifyResult(null);
  }, [size]);

  const doScramble = useCallback(() => {
    setPerm(scramblePerm(size));
    setWord([]);
    setLastSwapped(null);
    setVerifyResult(null);
  }, [size]);

  const verifyBraid = useCallback(() => {
    // Verify s_i s_{i+1} s_i = s_{i+1} s_i s_{i+1} for the first valid i
    if (n < 2) { setVerifyResult(tr({ zh: 'n≥2 才有辫关系', en: 'Need n≥2 for braid relation'
    })); return; }
    const i = 1;
    // Apply s_i s_{i+1} s_i to identity
    const p1 = Array.from({ length: size }, (_, k) => k);
    for (const idx of [i, i + 1, i]) { [p1[idx - 1], p1[idx]] = [p1[idx], p1[idx - 1]]; }
    // Apply s_{i+1} s_i s_{i+1} to identity
    const p2 = Array.from({ length: size }, (_, k) => k);
    for (const idx of [i + 1, i, i + 1]) { [p2[idx - 1], p2[idx]] = [p2[idx], p2[idx - 1]]; }
    const same = p1.every((v, k) => v === p2[k]);
    setVerifyResult(same
      ? tr({ zh: `s₁s₂s₁ = s₂s₁s₂ ✓  (辫关系成立, m(1,2)=3)`, en: `s₁s₂s₁ = s₂s₁s₂ ✓  (braid relation holds, m(1,2)=3)`
            })
      : `mismatch`
    );
  }, [lang, n, size]);

  const inversions = useMemo(() => countInversions(perm), [perm]);
  const isId = perm.every((v, i) => v === i);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="类型 A — 对换生成对称群 S_{n+1}" en="Type A — transpositions generate S_{n+1}" />
      </div>
      <p className="gt-panel-sub">
        <L
          zh={<>点击相邻标号之间的 <strong>s₁, …, s_n</strong> 按钮来对换，观察任意排列均可分解为相邻对换之积，逆序数 = 字长 <TeX src={String.raw`\ell(w)`} />。</>}
          en={<>Click the adjacent-swap generators <strong>s₁,…,s_n</strong> to permute the tiles; any permutation factors into adjacent transpositions, and the inversion count equals the word length <TeX src={String.raw`\ell(w)`} />.</>}
        />
      </p>
      <div className="gt-panel-input-row">
        <label>n =</label>
        <input type="range" min={2} max={5} value={n}
          onChange={e => setN(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--ink)', minWidth: 16 }}>{n}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', marginLeft: 8 }}>
          <L zh={`S_${size}`} en={`S_${size}`} />
        </span>
      </div>

      {/* Tile row */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '16px 0 4px', flexWrap: 'wrap' }}>
        {perm.map((v, idx) => (
          <div key={idx} style={{
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16,
            background: TILE_COLORS[v % TILE_COLORS.length], color: 'white',
            boxShadow: (lastSwapped !== null && (idx === lastSwapped - 1 || idx === lastSwapped))
              ? '0 0 0 2.5px var(--ink)' : 'none',
            transition: 'box-shadow .2s',
          }}>{v + 1}</div>
        ))}
      </div>

      {/* Generator buttons */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', margin: '10px 0 14px' }}>
        {Array.from({ length: n }, (_, k) => k + 1).map(i => (
          <button key={i} className="gt-btn gt-btn-ghost" onClick={() => applySwap(i)}
            style={{ minWidth: 38 }}>
            s<sub>{i}</sub>
          </button>
        ))}
        <button className="gt-btn gt-btn-ghost" onClick={doScramble} style={{ marginLeft: 10 }}>
          <L zh="打乱" en="Scramble" />
        </button>
        <button className="gt-btn gt-btn-ghost" onClick={reset}>
          <L zh="复位" en="Reset" />
        </button>
      </div>

      {/* Coxeter diagram of A_n (path graph) */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <svg viewBox={`0 0 ${n * 48 + 20} 36`} width={Math.min(n * 48 + 20, 320)} height={36}>
          {Array.from({ length: n }, (_, k) => {
            const i = k + 1;
            const cx = 20 + k * 48;
            const nx = cx + 48;
            return (
              <g key={k}>
                {k < n - 1 && (
                  <line x1={cx} y1={18} x2={nx - 10} y2={18}
                    stroke="var(--ink-faint)" strokeWidth={1.5} />
                )}
                <circle cx={cx} cy={18} r={10}
                  fill={lastSwapped === i ? 'var(--accent)' : 'var(--bg-elev)'}
                  stroke={lastSwapped === i ? 'var(--accent)' : 'var(--rule)'} strokeWidth={1.5} />
                <text x={cx} y={18} textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fill={lastSwapped === i ? 'white' : 'var(--ink-dim)'}
                  fontFamily="var(--mono)">s{i}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 12 }}>
        <L zh={`A_${n} 的 Coxeter 图（路径图，所有边 m=3，活跃生成元高亮）`}
           en={`Coxeter diagram of A_${n} (path graph, all edges m=3; active generator highlighted)`} />
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="当前排列" en="current permutation" /></span>
          <span className="gt-result-val">[{perm.map(v => v + 1).join(', ')}]</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="字 (应用的生成元)" en="word (gens applied)" /></span>
          <span className="gt-result-val" style={{ wordBreak: 'break-all' }}>
            {word.length === 0 ? tr({ zh: 'e (单位元)', en: 'e (identity)'
                                  }) : word.map(i => `s${i}`).join(' ')}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="逆序数 = ℓ(w)" en="inversions = ℓ(w)" /></span>
          <span className="gt-result-val-strong">{inversions}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="字长 |word|" en="word length" /></span>
          <span className="gt-result-val">{word.length}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="|W(A_n)| = (n+1)!" en="|W(A_n)| = (n+1)!" /></span>
          <span className="gt-result-val-strong">{Array.from({length: size}, (_, k) => k+1).reduce((a,b) => a*b, 1)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="是否为单位元" en="is identity" /></span>
          <span className="gt-result-val" style={{ color: isId ? 'var(--green)' : 'var(--accent)' }}>
            {isId ? tr({ zh: '是', en: 'yes' }) : tr({ zh: '否', en: 'no' })}
          </span>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="gt-btn gt-btn-ghost" onClick={verifyBraid} style={{ fontSize: 12 }}>
          <L zh="验证辫关系 s₁s₂s₁ = s₂s₁s₂" en="Verify braid: s₁s₂s₁ = s₂s₁s₂" />
        </button>
        {verifyResult && (
          <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 12,
            color: verifyResult.includes('✓') ? 'var(--green)' : 'var(--warn)' }}>
            {verifyResult}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Widget 3: Rank-2 root systems A₂ / B₂ / G₂ ─────────────────────────────
interface RootSystemDef { name: string; m: number; nameZh: string; desc: string; descZh: string }
const ROOT_SYSTEMS: RootSystemDef[] = [
  { name: 'A₂', m: 3, nameZh: 'A₂ = I₂(3)', desc: '6 roots, angle 60°, order 6', descZh: '6 根，夹角 60°，|W|=6' },
  { name: 'B₂', m: 4, nameZh: 'B₂ = I₂(4)', desc: '8 roots (2 lengths, ratio √2), angle 45°, order 8', descZh: '8 根（两种长度，比 √2），夹角 45°，|W|=8' },
  { name: 'G₂', m: 6, nameZh: 'G₂ = I₂(6)', desc: '12 roots (2 lengths, ratio √3), angle 30°, order 12', descZh: '12 根（两种长度，比 √3），夹角 30°，|W|=12' },
];
// For B₂ and G₂ there are two root lengths. Indices of long roots (0-based among 2m roots placed at k·π/m):
// A₂: all equal length (long flag = false for all)
// B₂: roots at 45° offsets are long; specifically roots at odd multiples of π/4 are length √2, even multiples length 1
// G₂: long roots at multiples of 60°; short at multiples of 30° that aren't 60°
function getRoots(m: number): { x: number; y: number; long: boolean }[] {
  const phi = Math.PI / m;
  const roots: { x: number; y: number; long: boolean }[] = [];
  for (let k = 0; k < 2 * m; k++) {
    const angle = k * phi;
    let long = false;
    let scale = 1.0;
    if (m === 4) {
      // B₂: alternate short/long. Roots at 0,π/4,π/2,3π/4,π,5π/4,3π/2,7π/4
      // Short at 0,π/2,π,3π/2 (k even); Long (√2) at π/4,3π/4,5π/4,7π/4 (k odd)
      long = k % 2 === 1;
      scale = long ? Math.SQRT2 : 1.0;
    } else if (m === 6) {
      // G₂: short roots at multiples of π/6, long roots at multiples of π/3 (every other)
      long = k % 2 === 0;
      scale = long ? Math.sqrt(3) : 1.0;
    }
    roots.push({ x: Math.cos(angle) * scale, y: Math.sin(angle) * scale, long });
  }
  // Normalise so the longest root fits within radius 1
  const maxR = Math.max(...roots.map(r => Math.hypot(r.x, r.y)));
  return roots.map(r => ({ x: r.x / maxR, y: r.y / maxR, long: r.long }));
}

function RootSystemWidget() {
  const lang = useLang();
  const [sel, setSel] = useState(0); // index into ROOT_SYSTEMS
  const [showMirrors, setShowMirrors] = useState(true);
  const [clickedRoot, setClickedRoot] = useState<number | null>(null);

  const rs = ROOT_SYSTEMS[sel];
  const roots = useMemo(() => getRoots(rs.m), [rs.m]);
  const phi = Math.PI / rs.m;

  // When a root is clicked, reflect all roots through it to show W-invariance
  const displayRoots = useMemo(() => {
    if (clickedRoot === null) return roots;
    const nr = roots[clickedRoot];
    const nLen2 = nr.x * nr.x + nr.y * nr.y;
    return roots.map(r => {
      const dot = r.x * nr.x + r.y * nr.y;
      return { x: r.x - 2 * dot / nLen2 * nr.x, y: r.y - 2 * dot / nLen2 * nr.y, long: r.long };
    });
  }, [roots, clickedRoot]);

  const cx = 130, cy = 130, R = 108;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="秩 2 根系展示 A₂ / B₂ / G₂" en="Rank-2 root systems A₂ / B₂ / G₂" />
      </div>
      <p className="gt-panel-sub">
        <L
          zh={<>根系是 W 稳定的有限向量集。点击某根，可观察整个根系在该根对应的反射下映射为自身（W 不变性）。</>}
          en={<>A root system is a W-stable finite set of vectors. Click a root to apply its reflection and watch the whole system map onto itself.</>}
        />
      </p>

      {/* Selector chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {ROOT_SYSTEMS.map((rs2, i) => (
          <button key={i} className={`gt-chip ${sel === i ? 'gt-chip-active' : ''}`}
            onClick={() => { setSel(i); setClickedRoot(null); }}>
            {rs2.name}
          </button>
        ))}
        <label style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={showMirrors} onChange={e => setShowMirrors(e.target.checked)} />
          <L zh="显示镜像线" en="mirrors" />
        </label>
        {clickedRoot !== null && (
          <button className="gt-chip" onClick={() => setClickedRoot(null)}>
            <L zh="复位根系" en="reset roots" />
          </button>
        )}
      </div>

      <svg viewBox="0 0 260 260" width="100%"
        style={{ display: 'block', maxWidth: 320, margin: '0 auto' }}>
        {/* Circle */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--rule)" strokeWidth={1} />
        {/* Mirror lines */}
        {showMirrors && Array.from({ length: rs.m }, (_, k) => {
          const a = k * phi;
          return (
            <line key={k}
              x1={cx - R * Math.cos(a)} y1={cy + R * Math.sin(a)}
              x2={cx + R * Math.cos(a)} y2={cy - R * Math.sin(a)}
              stroke="var(--ink-faint)" strokeWidth={0.8} strokeDasharray="4 3" />
          );
        })}
        {/* Simple root angle annotation */}
        {(() => {
          // Simple roots: α₁ at angle 0, α₂ at angle π - π/m (obtuse angle between them)
          const simplePhi = Math.PI - phi; // angle of second simple root
          const arcR = 24;
          const x1 = cx + arcR, y1 = cy;
          const x2 = cx + arcR * Math.cos(simplePhi), y2 = cy - arcR * Math.sin(simplePhi);
          return (
            <>
              <path d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 0 0 ${x2} ${y2}`}
                fill="none" stroke="var(--gold)" strokeWidth={1} strokeDasharray="3 2" />
              <text x={cx + arcR * Math.cos(simplePhi / 2) + 8}
                y={cy - arcR * Math.sin(simplePhi / 2)}
                fontSize={9} fill="var(--gold)" fontFamily="var(--mono)">π−π/m</text>
            </>
          );
        })()}
        {/* Roots as arrows */}
        {displayRoots.map((r, i) => {
          const ex = cx + r.x * R * 0.88, ey = cy - r.y * R * 0.88;
          const isSimple = i === 0 || i === rs.m; // simple roots at index 0 and m
          const isClicked = i === clickedRoot;
          const color = isSimple ? 'var(--accent)' : (r.long ? 'var(--accent-2)' : 'var(--green)');
          return (
            <g key={i} style={{ cursor: 'pointer' }} onClick={() => setClickedRoot(i === clickedRoot ? null : i)}>
              <line x1={cx} y1={cy} x2={ex} y2={ey}
                stroke={isClicked ? 'var(--warn)' : color}
                strokeWidth={isSimple ? 2.2 : (r.long ? 1.8 : 1.4)}
                markerEnd={`url(#arrow-${i < 3 ? 'r' : 'b'})`} />
              <circle cx={ex} cy={ey} r={4} fill={isClicked ? 'var(--warn)' : color} opacity={0.85} />
            </g>
          );
        })}
        {/* Arrow markers */}
        <defs>
          <marker id="arrow-r" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="var(--accent)" />
          </marker>
          <marker id="arrow-b" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="var(--accent-2)" />
          </marker>
        </defs>
        {/* Origin dot */}
        <circle cx={cx} cy={cy} r={3} fill="var(--ink-dim)" />
      </svg>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-dim)', fontStyle: 'italic', marginTop: 8 }}>
        <L zh={rs.descZh} en={rs.desc} />
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="型 / 群" en="type / group" /></span>
          <span className="gt-result-val">{lang === 'zh' ? rs.nameZh : rs.name + ' = I₂(' + rs.m + ')'}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="m (乘积阶)" en="m (product order)" /></span>
          <span className="gt-result-val">{rs.m}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="根数 = 2m" en="root count = 2m" /></span>
          <span className="gt-result-val-strong">{2 * rs.m}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="|W| = 2m" en="|W| = 2m" /></span>
          <span className="gt-result-val-strong">{2 * rs.m}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="简单根间夹角" en="simple root angle" /></span>
          <span className="gt-result-val">π − π/{rs.m} = {Math.round((1 - 1 / rs.m) * 180)}°</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="是晶格类型？(m∈{2,3,4,6})" en="crystallographic? (m∈{2,3,4,6})" /></span>
          <span className="gt-result-val" style={{ color: [2,3,4,6].includes(rs.m) ? 'var(--green)' : 'var(--warn)' }}>
            {[2,3,4,6].includes(rs.m) ? tr({ zh: '是（Weyl 群）', en: 'yes (Weyl group)' }) : tr({ zh: '否（非晶格）', en: 'no (non-crystallographic)' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main section export ──────────────────────────────────────────────────────
export default function ReflectionCoxeter() {
  const lang = useLang();
  return (
    <GTSec id="reflection-coxeter" className="gt-sec">
      <div className="gt-sec-num">§46</div>
      <h2 className="gt-sec-title">
        <L zh="反射群与 Coxeter 群" en="Reflection &amp; Coxeter Groups" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            在欧氏空间里，<strong>反射</strong>是最基本的对称操作：给定一个非零向量 <TeX src={String.raw`\alpha`} />，它的反射 <TeX src={String.raw`s_\alpha`} /> 沿法向量 <TeX src={String.raw`\alpha`} /> 翻转，固定超平面 <TeX src={String.raw`H_\alpha = \{x : \langle x,\alpha\rangle = 0\}`} /> 上的每一点。<strong>有限反射群</strong>由这样的反射生成，它们被 Coxeter 在 1935 年完全分类，连接了几何、李代数与组合学的深层结构。魔方爱好者会发现：正方体形状的<strong>全对称群</strong>（包含镜像反射）恰好是 B₃ 型反射群，阶为 48——这一事实对打乱数据库的对称化操作有直接用途。
          </>}
          en={<>
            In Euclidean space, a <strong>reflection</strong> is the primordial symmetry: given a nonzero vector <TeX src={String.raw`\alpha`} />, the reflection <TeX src={String.raw`s_\alpha`} /> flips along the normal <TeX src={String.raw`\alpha`} /> while fixing every point in the hyperplane <TeX src={String.raw`H_\alpha = \{x : \langle x,\alpha\rangle = 0\}`} />. <strong>Finite reflection groups</strong> are generated by such maps; they were completely classified by Coxeter in 1935, weaving together geometry, Lie theory, and combinatorics. For speedcubers: the <strong>full symmetry group of the cube shape</strong> (including mirror reflections) is precisely the type-B₃ reflection group, of order 48 — a fact with direct uses in symmetry-reduction of scramble databases.
          </>}
        />
      </p>

      {/* Reflection formula definition */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义：超平面反射" en="Definition: hyperplane reflection" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`V`} /> 是实内积空间，<TeX src={String.raw`\alpha \in V`} /> 非零。关于 <TeX src={String.raw`\alpha`} /> 的<strong>反射</strong> <TeX src={String.raw`s_\alpha \in O(V)`} /> 定义为
              <TeXBlock src={String.raw`s_\alpha(x) \;=\; x - 2\frac{\langle x,\alpha\rangle}{\langle\alpha,\alpha\rangle}\,\alpha.`} />
              它是<strong>对合</strong>（<TeX src={String.raw`s_\alpha^2 = \mathrm{id}`} />），行列式为 <TeX src={String.raw`-1`} />，逐点固定超平面 <TeX src={String.raw`H_\alpha`} />，并将 <TeX src={String.raw`\alpha`} /> 映射到 <TeX src={String.raw`-\alpha`} />。<strong>有限反射群</strong>是由有限多个这样的 <TeX src={String.raw`s_\alpha`} /> 生成的 <TeX src={String.raw`O(V)`} /> 的有限子群。
            </>}
            en={<>
              Let <TeX src={String.raw`V`} /> be a real inner-product space and <TeX src={String.raw`\alpha \in V`} /> nonzero. The <strong>reflection</strong> <TeX src={String.raw`s_\alpha \in O(V)`} /> is
              <TeXBlock src={String.raw`s_\alpha(x) \;=\; x - 2\frac{\langle x,\alpha\rangle}{\langle\alpha,\alpha\rangle}\,\alpha.`} />
              It is an <strong>involution</strong> (<TeX src={String.raw`s_\alpha^2 = \mathrm{id}`} />) with determinant <TeX src={String.raw`-1`} />, fixing <TeX src={String.raw`H_\alpha`} /> pointwise and sending <TeX src={String.raw`\alpha \mapsto -\alpha`} />. A <strong>finite reflection group</strong> is a finite subgroup of <TeX src={String.raw`O(V)`} /> generated by finitely many such reflections.
            </>}
          />
        </div>
      </div>

      {/* Coxeter system definition */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义：Coxeter 系统与 Coxeter 图" en="Definition: Coxeter system &amp; diagram" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              <strong>Coxeter 系统</strong> <TeX src={String.raw`(W,S)`} /> 是一个群 <TeX src={String.raw`W`} /> 配上有限生成元集 <TeX src={String.raw`S = \{s_1,\dots,s_n\}`} />，满足 <TeX src={String.raw`W`} /> 有如下表现：
              <TeXBlock src={String.raw`W = \bigl\langle s_1,\dots,s_n \;\big|\; (s_i s_j)^{m(i,j)} = e \;\text{ for all } i,j \bigr\rangle,`} />
              其中 <TeX src={String.raw`m(i,i)=1`} />（即 <TeX src={String.raw`s_i^2=e`} />），<TeX src={String.raw`m(i,j)=m(j,i)\ge 2`} /> 当 <TeX src={String.raw`i\ne j`} />。当 <TeX src={String.raw`m(i,j)=\infty`} /> 时不施加关系。<strong>Coxeter 图</strong>：顶点集为 <TeX src={String.raw`S`} />；当 <TeX src={String.raw`m(i,j)\ge 3`} /> 时连边，边上标注 <TeX src={String.raw`m(i,j)`} />（若恰为 3 则省略标注）；<TeX src={String.raw`m(i,j)=2`} /> 时不连边（两生成元交换）。
            </>}
            en={<>
              A <strong>Coxeter system</strong> <TeX src={String.raw`(W,S)`} /> is a group <TeX src={String.raw`W`} /> with finite generators <TeX src={String.raw`S = \{s_1,\dots,s_n\}`} /> such that <TeX src={String.raw`W`} /> has the presentation
              <TeXBlock src={String.raw`W = \bigl\langle s_1,\dots,s_n \;\big|\; (s_i s_j)^{m(i,j)} = e \;\text{ for all } i,j \bigr\rangle,`} />
              with <TeX src={String.raw`m(i,i)=1`} /> (so <TeX src={String.raw`s_i^2=e`} />) and <TeX src={String.raw`m(i,j)\ge 2`} /> for <TeX src={String.raw`i\ne j`} /> (no relation when <TeX src={String.raw`m=\infty`} />). The <strong>Coxeter diagram</strong> has vertex set <TeX src={String.raw`S`} />; vertices <TeX src={String.raw`s_i,s_j`} /> are joined when <TeX src={String.raw`m(i,j)\ge 3`} />, labelled by <TeX src={String.raw`m(i,j)`} /> (label 3 omitted); no edge when <TeX src={String.raw`m(i,j)=2`} /> (commuting pair).
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            最简单的例子是<strong>二面 Coxeter 群 <TeX src={String.raw`I_2(m)`} /></strong>：两个生成反射 <TeX src={String.raw`s_1,s_2`} /> 各自是对合，乘积 <TeX src={String.raw`s_1 s_2`} /> 的阶恰为 <TeX src={String.raw`m`} />。几何实现：平面上两条过原点的镜像线夹角 <TeX src={String.raw`\pi/m`} />，反射之乘积是绕交点旋转 <TeX src={String.raw`2\pi/m`} />（注意：夹角是 <TeX src={String.raw`\pi/m`} />，旋转角是 <strong>两倍</strong> <TeX src={String.raw`2\pi/m`} />，这是初学者最常犯的混淆）。 <TeX src={String.raw`I_2(m)`} /> 作为抽象群同构于正 <TeX src={String.raw`m`} /> 边形的对称群，阶为 <TeX src={String.raw`2m`} />。
          </>}
          en={<>
            The simplest example is the <strong>dihedral Coxeter group <TeX src={String.raw`I_2(m)`} /></strong>: two generating reflections <TeX src={String.raw`s_1,s_2`} />, each an involution, with <TeX src={String.raw`s_1 s_2`} /> of order exactly <TeX src={String.raw`m`} />. Geometric realisation: two mirror lines in the plane meeting at angle <TeX src={String.raw`\pi/m`} />; their product is rotation by <TeX src={String.raw`2\pi/m`} /> (note: the mirror angle is <TeX src={String.raw`\pi/m`} />, the rotation angle is <strong>twice</strong> that — a perennial source of confusion). As an abstract group <TeX src={String.raw`I_2(m)`} /> is the dihedral symmetry group of a regular <TeX src={String.raw`m`} />-gon, of order <TeX src={String.raw`2m`} />.
          </>}
        />
      </p>

      {/* Widget 1: Dihedral orbit */}
      <DihedralWidget />

      {/* Classification theorem */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理：有限反射群的分类（Coxeter, 1935）" en="Theorem: Classification of finite reflection groups (Coxeter, 1935)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              有限 Coxeter 群（= 有限实反射群）恰好由以下不可约类型的直积组成，这些不可约类型与<strong>连通 Coxeter 图</strong>一一对应：
              <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.8 }}>
                <li><strong>无穷族：</strong><TeX src={String.raw`A_n`} /> (<TeX src={String.raw`n\ge1`} />), <TeX src={String.raw`B_n=C_n`} /> (<TeX src={String.raw`n\ge2`} />), <TeX src={String.raw`D_n`} /> (<TeX src={String.raw`n\ge4`} />), <TeX src={String.raw`I_2(m)`} /> (<TeX src={String.raw`m\ge5,m\ne6`} />)。</li>
                <li><strong>例外群：</strong><TeX src={String.raw`E_6, E_7, E_8, F_4, H_3, H_4, G_2`} />。</li>
                <li><TeX src={String.raw`I_2(3)=A_2`} />, <TeX src={String.raw`I_2(4)=B_2`} />, <TeX src={String.raw`I_2(6)=G_2`} />（重名用晶格名）。满足 <TeX src={String.raw`m\in\{2,3,4,6\}`} /> 的类型是 Weyl 群（满足整性条件的晶格型根系）。</li>
              </ul>
            </>}
            en={<>
              The finite Coxeter groups (equivalently, finite real reflection groups) are classified, up to direct products, by the connected Coxeter diagrams. The irreducible types are:
              <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.8 }}>
                <li><strong>Infinite families:</strong> <TeX src={String.raw`A_n`} /> (<TeX src={String.raw`n\ge1`} />), <TeX src={String.raw`B_n=C_n`} /> (<TeX src={String.raw`n\ge2`} />), <TeX src={String.raw`D_n`} /> (<TeX src={String.raw`n\ge4`} />), <TeX src={String.raw`I_2(m)`} /> (<TeX src={String.raw`m\ge5, m\ne6`} />).</li>
                <li><strong>Exceptionals:</strong> <TeX src={String.raw`E_6,E_7,E_8,F_4,H_3,H_4,G_2`} />.</li>
                <li><TeX src={String.raw`I_2(3)=A_2`} />, <TeX src={String.raw`I_2(4)=B_2`} />, <TeX src={String.raw`I_2(6)=G_2`} /> (crystallographic names). The Weyl groups are exactly those with <TeX src={String.raw`m\in\{2,3,4,6\}`} /> only.</li>
              </ul>
            </>}
          />
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="类型 A：对称群与相邻对换" en="Type A: symmetric groups and adjacent transpositions" />
      </h3>

      <p>
        <L
          zh={<>
            类型 <TeX src={String.raw`A_n`} /> 的 Coxeter 群同构于 <TeX src={String.raw`S_{n+1}`} />：在 <TeX src={String.raw`\mathbb{R}^{n+1}`} /> 中，简单根为 <TeX src={String.raw`e_i - e_{i+1}`} />，对应的反射 <TeX src={String.raw`s_i`} /> 是相邻对换 <TeX src={String.raw`(i\;i{+}1)`} />。乘积 <TeX src={String.raw`s_i s_{i+1}`} /> 是三轮换，阶为 3，故 <TeX src={String.raw`m(i,i{+}1)=3`} />；不相邻的对换互相交换，<TeX src={String.raw`m(i,j)=2`} />（<TeX src={String.raw`|i-j|\ge 2`} />）。Coxeter 图是 <TeX src={String.raw`n`} /> 个顶点的<strong>路径图</strong>，所有边都是无标号边（意味着 <TeX src={String.raw`m=3`} />）。最小生成字的长度 <TeX src={String.raw`\ell(w)`} /> 恰好等于排列 <TeX src={String.raw`w`} /> 的<strong>逆序数</strong>。
          </>}
          en={<>
            The type-<TeX src={String.raw`A_n`} /> Coxeter group is <TeX src={String.raw`S_{n+1}`} />: in <TeX src={String.raw`\mathbb{R}^{n+1}`} />, simple roots are <TeX src={String.raw`e_i - e_{i+1}`} /> and the reflection <TeX src={String.raw`s_i`} /> is the adjacent transposition <TeX src={String.raw`(i\;i{+}1)`} />. The product <TeX src={String.raw`s_i s_{i+1}`} /> is a 3-cycle (order 3), giving <TeX src={String.raw`m(i,i{+}1)=3`} />; disjoint transpositions commute, <TeX src={String.raw`m(i,j)=2`} /> for <TeX src={String.raw`|i-j|\ge2`} />. The Coxeter diagram is a <strong>path graph</strong> on <TeX src={String.raw`n`} /> vertices with unlabelled edges (all <TeX src={String.raw`m=3`} />). The minimal generator word length <TeX src={String.raw`\ell(w)`} /> equals exactly the <strong>inversion count</strong> of <TeX src={String.raw`w`} />.
          </>}
        />
      </p>

      {/* Widget 2: Type A */}
      <TypeAWidget />

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="秩 2 根系与晶格性" en="Rank-2 root systems and crystallography" />
      </h3>

      <p>
        <L
          zh={<>
            对有限反射群 <TeX src={String.raw`W`} />，<strong>根系</strong> <TeX src={String.raw`\Phi`} /> 是一个 <TeX src={String.raw`W`} /> 稳定的有限向量集，满足 <TeX src={String.raw`\Phi\cap\mathbb{R}\alpha=\{\pm\alpha\}`} /> 且每个 <TeX src={String.raw`s_\alpha`} /> 置换 <TeX src={String.raw`\Phi`} />。选取正根系 <TeX src={String.raw`\Phi^+`} /> 后，其中不可再分解的元素构成<strong>简单系</strong> <TeX src={String.raw`\Delta`} />，对应的反射恰好是 Coxeter 生成元。二阶情况 <TeX src={String.raw`I_2(m)`} /> 有 <TeX src={String.raw`2m`} /> 个根，镜像线将全空间分成 <TeX src={String.raw`2m`} /> 个等角扇形。当 <TeX src={String.raw`m\in\{2,3,4,6\}`} /> 时，整性条件
            <TeXBlock src={String.raw`\frac{2\langle\alpha,\beta\rangle}{\langle\beta,\beta\rangle} \;\in\; \mathbb{Z} \quad\text{对所有 } \alpha,\beta\in\Phi`} />
            成立，给出 Lie 理论中的 <strong>Weyl 群</strong>（<TeX src={String.raw`A_2`} />, <TeX src={String.raw`B_2`} />, <TeX src={String.raw`G_2`} /> 即 <TeX src={String.raw`I_2(3,4,6)`} />）。<TeX src={String.raw`H_2=I_2(5)`} /> 是非晶格型有限 Coxeter 群（五边形对称）。
          </>}
          en={<>
            For a finite reflection group <TeX src={String.raw`W`} />, a <strong>root system</strong> <TeX src={String.raw`\Phi`} /> is a <TeX src={String.raw`W`} />-stable finite set with <TeX src={String.raw`\Phi\cap\mathbb{R}\alpha=\{\pm\alpha\}`} /> and each <TeX src={String.raw`s_\alpha`} /> permuting <TeX src={String.raw`\Phi`} />. Choosing positive roots <TeX src={String.raw`\Phi^+`} />, the indecomposable elements form the <strong>simple system</strong> <TeX src={String.raw`\Delta`} />, whose reflections are the Coxeter generators. For rank-2 <TeX src={String.raw`I_2(m)`} /> there are <TeX src={String.raw`2m`} /> roots, and the mirrors divide the plane into <TeX src={String.raw`2m`} /> equal wedges. The <strong>integrality (Cartan) condition</strong>
            <TeXBlock src={String.raw`\frac{2\langle\alpha,\beta\rangle}{\langle\beta,\beta\rangle} \;\in\; \mathbb{Z} \quad\text{for all } \alpha,\beta\in\Phi`} />
            holds exactly when <TeX src={String.raw`m\in\{2,3,4,6\}`} />, giving the <strong>Weyl groups</strong> (<TeX src={String.raw`A_2,B_2,G_2`} /> = <TeX src={String.raw`I_2(3,4,6)`} />). <TeX src={String.raw`H_2=I_2(5)`} /> is a non-crystallographic finite Coxeter group (pentagonal symmetry).
          </>}
        />
      </p>

      {/* Widget 3: Root systems */}
      <RootSystemWidget />

      {/* Comparison table */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="经典类型对比" en="Classical types at a glance" />
      </h3>

      <table className="gt-compare">
        <thead>
          <tr>
            <th><L zh="类型" en="Type" /></th>
            <th><L zh="Coxeter 图" en="Coxeter diagram" /></th>
            <th><L zh="同构群" en="Isomorphism" /></th>
            <th className="num"><L zh="阶 |W|" en="Order |W|" /></th>
            <th><L zh="晶格?" en="Crystallo?" /></th>
          </tr>
        </thead>
        <tbody>
          {[
            { type: 'A_n', diag: tr({ zh: '路径图（全无标号）', en: 'path graph (all unlabelled)'
            }), iso: 'S_{n+1}', order: '(n+1)!', cryst: true },
            { type: 'B_n', diag: tr({ zh: '路径图，一端边标 4', en: 'path, one end-edge labelled 4'
            }), iso: '\\mathbb{Z}_2\\wr S_n', order: '2^n\\cdot n!', cryst: true },
            { type: 'I_2(m)', diag: tr({ zh: '两顶点，边标 m', en: 'two vertices, edge labelled m'
            }), iso: 'D_m', order: '2m', cryst: false },
            { type: 'G_2', diag: tr({ zh: '两顶点，边标 6', en: 'two vertices, edge labelled 6'
            }), iso: 'I_2(6)', order: '12', cryst: true },
            { type: 'H_3', diag: tr({ zh: '路径图，一端边标 5', en: 'path, one end-edge labelled 5'
            }), iso: tr({ zh: '正二十面体群', en: 'icosahedral group'
            }), order: '120', cryst: false },
          ].map(row => (
            <tr key={row.type}>
              <td><TeX src={String.raw`${row.type}`} /></td>
              <td style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{row.diag}</td>
              <td><TeX src={String.raw`${row.iso}`} /></td>
              <td className="num"><TeX src={String.raw`${row.order}`} /></td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: row.cryst ? 'var(--green)' : 'var(--ink-faint)' }}>
                {row.cryst ? tr({ zh: '是', en: 'yes' }) : tr({ zh: '否', en: 'no' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cube connection */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="正方体的反射群 B₃（阶 48）" en="The cube's reflection group B₃ (order 48)" />
      </h3>

      <p>
        <L
          zh={<>
            类型 <TeX src={String.raw`B_3`} /> 是超八面体群（<strong>有符号置换群</strong>），由 3 条轴的所有置换加上每条轴的正负号选择构成，阶为 <TeX src={String.raw`2^3 \cdot 3! = 48`} />，同构于 <TeX src={String.raw`S_4 \times \mathbb{Z}_2`} />（<TeX src={String.raw`\mathbb{Z}_2`} /> 由中心对称 <TeX src={String.raw`-I`} /> 生成）。这正是<strong>正方体形状的全对称群</strong>（包含所有保持立方体不变的镜像和旋转），Coxeter 图为 <TeX src={String.raw`s_1 - \overset{4}{-} - s_2 - s_3`} />，三个简单反射分别对应：平行于某面的平面反射（<TeX src={String.raw`m=4`} />）、穿越对边的反射（<TeX src={String.raw`m=3`} />）。其中 24 个旋转对称形成子群 <TeX src={String.raw`S_4`} />，另外 24 个是这些旋转与 <TeX src={String.raw`-I`} /> 的合成（镜像对称）。
          </>}
          en={<>
            Type <TeX src={String.raw`B_3`} /> is the <strong>hyperoctahedral group</strong> of signed permutations of 3 axes, of order <TeX src={String.raw`2^3\cdot 3! = 48`} />, isomorphic to <TeX src={String.raw`S_4\times\mathbb{Z}_2`} /> (with <TeX src={String.raw`\mathbb{Z}_2`} /> generated by the central inversion <TeX src={String.raw`-I`} />). This is precisely the <strong>full symmetry group of the cube shape</strong> (all rigid motions and mirror reflections preserving the solid), with Coxeter diagram <TeX src={String.raw`s_1 - \overset{4}{-} - s_2 - s_3`} />. The three simple reflections correspond to: a face-parallel mirror plane (order-4 relation), and two edge planes (order-3 relation). The 24 rotation symmetries form the subgroup <TeX src={String.raw`S_4`} /> (permuting the 4 body diagonals); the remaining 24 mirror symmetries are their composites with <TeX src={String.raw`-I`} />.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            <strong>重要区分：</strong>B₃（阶 48）是正方体<em>形状</em>的对称群，不是魔方的<em>拼法</em>群（约 <TeX src={String.raw`4.3\times 10^{19}`} /> 个元素，且所有合法转动均保向，不含反射）。但这 48 个对称恰好是"不改变面颜色分布、只换持法"的等价操作，在打乱数据库中用于等价类归并（例如识别某 PLL 的镜像情形），是对称化工具的数学依据。
          </>}
          en={<>
            <strong>Important distinction:</strong> B₃ (order 48) is the symmetry group of the <em>cube shape</em>, not the Rubik's Cube <em>move group</em> (order ~<TeX src={String.raw`4.3\times10^{19}`} />, orientation-preserving, no reflections). However, these 48 symmetries are exactly the "hold-the-puzzle-differently" equivalences, used in scramble databases to merge symmetric cases (e.g., recognizing mirror PLL setups). That is the honest, useful speedcubing connection.
          </>}
        />
      </div>

      {/* B₃ order facts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, margin: '24px 0' }}>
        {[
          { label: lang === 'zh' ? '|W(B₃)|' : '|W(B₃)|', val: '48', sub: lang === 'zh' ? '= 2³·3!' : '= 2³·3!' },
          { label: tr({ zh: '旋转子群', en: 'rotation subgroup'
        }), val: '24', sub: 'S₄' },
          { label: tr({ zh: '镜像对称数', en: 'mirror symmetries'
        }), val: '24', sub: tr({ zh: '= 9 个镜面', en: '= 9 planes'
        }) },
          { label: tr({ zh: '根数', en: 'root count'
        }), val: '18', sub: tr({ zh: 'B₃ 根系', en: 'B₃ root system' }) },
        ].map(item => (
          <div key={item.label} style={{ border: '1px solid var(--rule)', borderRadius: 6, padding: '14px 12px', textAlign: 'center', background: 'var(--bg-elev)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.08em', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>{item.val}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', marginTop: 4 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Exchange condition */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理：交换条件与字长" en="Theorem: Exchange condition and word length" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              在 Coxeter 系统 <TeX src={String.raw`(W,S)`} /> 中，定义<strong>字长函数</strong> <TeX src={String.raw`\ell(w)`} /> 为 <TeX src={String.raw`w`} /> 的最短生成元表达式的长度。<strong>交换条件</strong>（Exchange Condition）：若 <TeX src={String.raw`s_{i_1}\cdots s_{i_k}`} /> 是 <TeX src={String.raw`w`} /> 的最短表达式（即 <TeX src={String.raw`k=\ell(w)`} />），且对某 <TeX src={String.raw`s\in S`} /> 有 <TeX src={String.raw`\ell(ws)<\ell(w)`} />，则存在下标 <TeX src={String.raw`j`} /> 使得 <TeX src={String.raw`ws=s_{i_1}\cdots\hat{s}_{i_j}\cdots s_{i_k}`} />（删去第 <TeX src={String.raw`j`} /> 个字母）。此条件完全刻画了 Coxeter 群，也是 Bruhat 偏序的基础。对 <TeX src={String.raw`A_n=S_{n+1}`} />，字长恰为逆序数，可在上方 Widget 中验证。
            </>}
            en={<>
              In a Coxeter system <TeX src={String.raw`(W,S)`} />, the <strong>length function</strong> <TeX src={String.raw`\ell(w)`} /> is the minimal number of generators needed to express <TeX src={String.raw`w`} />. The <strong>Exchange Condition</strong>: if <TeX src={String.raw`s_{i_1}\cdots s_{i_k}`} /> is reduced (<TeX src={String.raw`k=\ell(w)`} />) and <TeX src={String.raw`\ell(ws)<\ell(w)`} /> for some <TeX src={String.raw`s\in S`} />, then <TeX src={String.raw`ws = s_{i_1}\cdots\hat{s}_{i_j}\cdots s_{i_k}`} /> for some <TeX src={String.raw`j`} /> (delete one letter). This characterises Coxeter groups among groups generated by involutions, and underlies the Bruhat partial order. For <TeX src={String.raw`A_n=S_{n+1}`} /> the length equals the inversion count — verifiable in the widget above.
            </>}
          />
        </div>
      </div>

      {/* References */}
      <div style={{ marginTop: 40 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 12 }}>
          <L zh="参考文献" en="References" />
        </div>
        <div className="gt-refs">
          <ol>
            <li>J. E. Humphreys, <em>Reflection Groups and Coxeter Groups</em>, CUP, 1990.</li>
            <li>N. Bourbaki, <em>Groupes et algèbres de Lie</em>, Ch. IV–VI, Hermann/Springer.</li>
            <li>A. Björner &amp; F. Brenti, <em>Combinatorics of Coxeter Groups</em>, GTM 231, Springer, 2005.</li>
          </ol>
        </div>
      </div>
    </GTSec>
  );
}
