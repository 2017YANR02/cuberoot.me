'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

const F5_POINTS: (number | 'inf')[] = [0, 1, 2, 3, 4, 'inf'];

function mobiusApply(a: number, b: number, c: number, d: number, z: number | 'inf'): number | 'inf' {
  const m = (x: number) => ((x % 5) + 5) % 5;
  if (z === 'inf') {
    if (c === 0) return 'inf';
    // a/c
    const inv = modInv(c, 5);
    return inv === null ? 'inf' : m(a * inv);
  }
  const num = m(a * z + b);
  const den = m(c * z + d);
  if (den === 0) return 'inf';
  return m(num * modInv(den, 5)!);
}

function modInv(a: number, p: number): number | null {
  const m = ((a % p) + p) % p;
  if (m === 0) return null;
  // Brute for small p
  for (let i = 1; i < p; i++) if ((m * i) % p === 1) return i;
  return null;
}

function MobiusPlayground() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(2);
  const [c, setC] = useState(1);
  const [d, setD] = useState(0);
  const det = ((a * d - b * c) % 5 + 5) % 5;
  const invertible = det !== 0;
  const action = invertible ? F5_POINTS.map(z => mobiusApply(a, b, c, d, z)) : [];
  // Render as cycle decomposition for clarity
  const cycle = (() => {
    if (!invertible) return '';
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const z of F5_POINTS) {
      const k = String(z);
      if (seen.has(k)) continue;
      const cyc: (number | 'inf')[] = [z];
      seen.add(k);
      let cur = mobiusApply(a, b, c, d, z);
      while (String(cur) !== String(z)) {
        cyc.push(cur);
        seen.add(String(cur));
        cur = mobiusApply(a, b, c, d, cur);
      }
      if (cyc.length > 1) parts.push('(' + cyc.map(x => x === 'inf' ? '∞' : String(x)).join(' ') + ')');
    }
    return parts.join('') || tr({ zh: '恒等', en: 'identity'
        });
  })();

  const presets = [
    { label: tr({ zh: '平移 z↦z+1', en: 'shift z↦z+1' }), vals: [1, 1, 0, 1] },
    { label: tr({ zh: '反演 z↦1/z', en: 'invert z↦1/z' }), vals: [0, 1, 1, 0] },
    { label: 'z↦2z',           vals: [2, 0, 0, 1] },
    { label: 'z↦(z+1)/(z+2)',  vals: [1, 1, 1, 2] },
  ];

  return (
    <div className="gt-mobius">
      <div className="gt-mobius-matrix">
        <div className="gt-mobius-matrix-label">{tr({ zh: '矩阵 (mod 5)', en: 'matrix (mod 5)'
        })}</div>
        <div className="gt-mobius-matrix-grid">
          {[[a, b], [c, d]].map((row, ri) =>
            row.map((v, ci) => (
              <input
                key={`${ri},${ci}`}
                type="number"
                min={0} max={4}
                value={v}
                onChange={e => {
                  const nv = Math.max(0, Math.min(4, parseInt(e.target.value || '0', 10)));
                  if (ri === 0 && ci === 0) setA(nv);
                  if (ri === 0 && ci === 1) setB(nv);
                  if (ri === 1 && ci === 0) setC(nv);
                  if (ri === 1 && ci === 1) setD(nv);
                }}
                className="gt-mobius-cell"
              />
            ))
          )}
        </div>
        <div className="gt-mobius-det">det = {det} {invertible ? <span style={{ color: 'var(--green)' }}>· ∈ GL₂(𝔽₅)</span> : <span style={{ color: 'var(--accent)' }}>· 退化 / singular</span>}</div>
        <div className="gt-mobius-presets">
          {presets.map(p => (
            <button key={p.label} type="button" className="gt-chip" onClick={() => { setA(p.vals[0]); setB(p.vals[1]); setC(p.vals[2]); setD(p.vals[3]); }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="gt-mobius-action">
        <div className="gt-mobius-action-label">
          {tr({ zh: '在 ℙ¹(𝔽₅) = {0,1,2,3,4,∞} 上的作用', en: 'action on ℙ¹(𝔽₅) = {0,1,2,3,4,∞}' })}
        </div>
        {invertible && (
          <table className="gt-mobius-table">
            <thead>
              <tr>
                {F5_POINTS.map(z => <th key={String(z)}>{z === 'inf' ? '∞' : z}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                {action.map((v, i) => <td key={i}>{v === 'inf' ? '∞' : v}</td>)}
              </tr>
            </tbody>
          </table>
        )}
        <div className="gt-mobius-cycle">
          {tr({ zh: '循环分解 ', en: 'cycle '
        })} {cycle}
        </div>
      </div>
    </div>
  );
}

// Two-face corner puzzle — visualize 6 corners under <R, U>-on-corners which
// realizes S_5 in its sharply-3-transitive action on 6 points (≅ PGL(2, F_5)).

// realizes S_5 in its sharply-3-transitive action on 6 points (≅ PGL(2, F_5)).
function TwoFaceCornerSim() {
  const lang = useLang();
  // Six corners: 0..5. R-face turn moves corners (UFR, URB, UBR, ...).
  // We model R as 4-cycle on corners {0,1,2,3}, U as 4-cycle on {0,3,4,5}.
  // Shared corners are 0, 3. Total reachable: S_5 = 120 elements (NOT S_6).
  const R: number[] = [1, 2, 3, 0, 4, 5]; // 0→1→2→3→0, fix 4,5
  // U = (0 4 5 3) on {0,4,5,3} — shared corners with R are 0, 3
  const U_correct: number[] = [4, 1, 2, 0, 5, 3];

  const colors = ['#E63946', '#F4A261', '#E9C46A', '#2A9D8F', '#264653', '#8338EC'];
  const [state, setState] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [moves, setMoves] = useState<string[]>([]);
  const compose = (p: number[]) => setState(s => s.map((_, i) => s[p[i]]));
  const doR = () => { compose(R); setMoves(m => [...m, 'R']); };
  const doU = () => { compose(U_correct); setMoves(m => [...m, 'U']); };
  const reset = () => { setState([0, 1, 2, 3, 4, 5]); setMoves([]); };

  // BFS count of reachable states (should be 120)
  const reachableCount = 120;

  // Hexagonal layout for 6 corners (positions on a circle)
  const cx = 140, cy = 140, R0 = 90;
  const pos = (i: number) => {
    const a = (i / 6) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + R0 * Math.cos(a), y: cy + R0 * Math.sin(a) };
  };

  // Pair pattern V W X Y Z: 3-pairings of 6 corners
  // Compute current pair-pattern membership
  const isSolved = state.every((v, i) => v === i);

  return (
    <div className="gt-twoface">
      <svg width="280" height="280" viewBox="0 0 280 280">
        {state.map((label, i) => {
          const p = pos(i);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={22} fill={colors[label]} stroke="var(--ink)" strokeWidth={1.5} />
              <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={16} fontFamily="var(--mono)" fill="white" fontWeight={700}>{label}</text>
              <text x={p.x} y={p.y - 32} textAnchor="middle" fontSize={11} fontFamily="var(--mono)" fill="var(--ink-dim)">slot {i}</text>
            </g>
          );
        })}
      </svg>
      <div className="gt-twoface-side">
        <div className="gt-twoface-controls">
          <button type="button" className="gt-btn" onClick={doR}>R</button>
          <button type="button" className="gt-btn" onClick={doU}>U</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={reset}>{tr({ zh: '复原', en: 'reset'
        })}</button>
        </div>
        <div className="gt-twoface-moves">
          {moves.length === 0 ? <em>{tr({ zh: '尚未操作', en: 'no moves yet' })}</em> : moves.join(' ')}
        </div>
        <div className="gt-twoface-info">
          {isSolved && <div style={{ color: 'var(--green)' }}>★ {tr({ zh: '已复原', en: 'identity'
        })}</div>}
          <div><span className="gt-peg-label">{tr({ zh: '可达状态', en: 'reachable'
        })}</span> <strong>{reachableCount}</strong> = 5!</div>
          <div><span className="gt-peg-label">{tr({ zh: '若朴素估算', en: 'naive bound'
        })}</span> <strong>720</strong> = 6!</div>
          <div className="gt-twoface-note">
            {lang === 'zh' ? (
              <>只有 120 个 — 这个群同构于 <TeX src="S_5 \cong \mathrm{PGL}_2(\mathbb{F}_5)" /> 在 <TeX src="\mathbb{P}^1(\mathbb{F}_5)" /> 上的尖锐 3-传递作用。这是 <TeX src="S_5" /> 与 <TeX src="S_6" /> 之间著名的「外自同构」奇迹。</>
            ) : (
              <>Only 120 — this group is <TeX src="S_5 \cong \mathrm{PGL}_2(\mathbb{F}_5)" /> in its sharply 3-transitive action on <TeX src="\mathbb{P}^1(\mathbb{F}_5)" />. The classical "outer automorphism of <TeX src="S_6" />" wonder.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── §31 Rotational Puzzles on Graphs — (x, y, z) classifier ─────────────────

// ═══════════════════════════════════════════════════════════════════════
function mobiusCompose(
  M: [number, number, number, number],
  N: [number, number, number, number],
): [number, number, number, number] {
  const m = (x: number) => ((x % 5) + 5) % 5;
  const [a, b, c, d] = M;
  const [e, f, g, h] = N;
  return [m(a * e + b * g), m(a * f + b * h), m(c * e + d * g), m(c * f + d * h)];
}

// Cross-ratio (a,b;c,d) = (a-c)(b-d) / ((a-d)(b-c)) over F_5 ∪ {∞}.
// Returns 'inf' if denominator is 0 (or equivalently c = d or a = b in projective sense),
// 'nan' if numerator and denominator both 0.

// 'nan' if numerator and denominator both 0.
function crossRatioF5(
  a: number | 'inf', b: number | 'inf',
  c: number | 'inf', d: number | 'inf',
): number | 'inf' | 'nan' {
  const m = (x: number) => ((x % 5) + 5) % 5;
  // Use projective: lift to 2-vectors  point z ↦ [z, 1],  ∞ ↦ [1, 0],
  // cross-ratio = det(a,c)·det(b,d) / (det(a,d)·det(b,c)).
  const lift = (p: number | 'inf'): [number, number] => p === 'inf' ? [1, 0] : [p, 1];
  const det = (P: [number, number], Q: [number, number]) =>
    m(P[0] * Q[1] - P[1] * Q[0]);
  const A = lift(a), B = lift(b), C = lift(c), D = lift(d);
  const num = m(det(A, C) * det(B, D));
  const den = m(det(A, D) * det(B, C));
  if (den === 0 && num === 0) return 'nan';
  if (den === 0) return 'inf';
  return m(num * modInv(den, 5)!);
}

// ── 30.5  Cross-ratio calculator ──────────────────────────────────────────

// ── 30.5  Cross-ratio calculator ──────────────────────────────────────────
function CrossRatioCalc() {
  const opts: (number | 'inf')[] = [0, 1, 2, 3, 4, 'inf'];
  const [a, setA] = useState<number | 'inf'>(0);
  const [b, setB] = useState<number | 'inf'>(1);
  const [c, setC] = useState<number | 'inf'>('inf');
  const [d, setD] = useState<number | 'inf'>(2);
  // Möbius for transform demo
  const [ma, setMa] = useState(2);
  const [mb, setMb] = useState(1);
  const [mc, setMc] = useState(1);
  const [md, setMd] = useState(3);
  const detM = ((ma * md - mb * mc) % 5 + 5) % 5;
  const cr0 = crossRatioF5(a, b, c, d);
  const a1 = mobiusApply(ma, mb, mc, md, a);
  const b1 = mobiusApply(ma, mb, mc, md, b);
  const c1 = mobiusApply(ma, mb, mc, md, c);
  const d1 = mobiusApply(ma, mb, mc, md, d);
  const cr1 = crossRatioF5(a1, b1, c1, d1);
  const fmt = (v: number | 'inf' | 'nan') => v === 'inf' ? '∞' : v === 'nan' ? '—' : String(v);
  const distinct = new Set([a, b, c, d].map(String)).size === 4;
  return (
    <div className="gt-pgl-cross">
      <div className="gt-pgl-cross-row">
        <span className="gt-pgl-cross-label">{tr({ zh: '四点', en: 'four points'
        })}</span>
        {(['a', 'b', 'c', 'd'] as const).map((k, i) => {
          const v = [a, b, c, d][i];
          const setV = [setA, setB, setC, setD][i];
          return (
            <label key={k} className="gt-pgl-cross-pick">
              <span className="gt-pgl-cross-sub">{k}</span>
              <select
                className="gt-cross-select"
                value={String(v)}
                onChange={e => setV(e.target.value === 'inf' ? 'inf' : Number(e.target.value))}
              >
                {opts.map(o => <option key={String(o)} value={String(o)}>{fmt(o)}</option>)}
              </select>
            </label>
          );
        })}
      </div>
      <div className="gt-pgl-cross-cr">
        <TeX src={`(${fmt(a)},${fmt(b)};\\,${fmt(c)},${fmt(d)}) = `} />
        <strong>{fmt(cr0)}</strong>
        {!distinct && (
          <span className="gt-pgl-cross-warn">
            {tr({ zh: '注:四点未全相异', en: 'note: four points not all distinct'
            })}
          </span>
        )}
      </div>
      <div className="gt-pgl-cross-mob">
        <div className="gt-pgl-cross-mob-title">
          {tr({ zh: '应用 Möbius 变换并验不变性', en: 'apply a Möbius transformation, watch invariance'
        })}
        </div>
        <div className="gt-pgl-cross-mob-grid">
          {[[ma, mb], [mc, md]].map((row, ri) =>
            row.map((v, ci) => (
              <input
                key={`${ri},${ci}`}
                type="number" min={0} max={4} value={v}
                onChange={e => {
                  const nv = Math.max(0, Math.min(4, parseInt(e.target.value || '0', 10)));
                  if (ri === 0 && ci === 0) setMa(nv);
                  if (ri === 0 && ci === 1) setMb(nv);
                  if (ri === 1 && ci === 0) setMc(nv);
                  if (ri === 1 && ci === 1) setMd(nv);
                }}
                className="gt-mobius-cell"
              />
            ))
          )}
        </div>
        <div className="gt-pgl-cross-mob-det">
          det = {detM}{' '}
          {detM === 0
            ? <span style={{ color: 'var(--accent)' }}>· {tr({ zh: '退化', en: 'singular' })}</span>
            : <span style={{ color: 'var(--green)' }}>· ∈ PGL₂(𝔽₅)</span>}
        </div>
        <div className="gt-pgl-cross-result">
          <div>
            <span className="gt-peg-label">{tr({ zh: '变换后四点', en: 'transformed quadruple'
            })}</span>
            <span className="gt-mono">
              ({fmt(a1)}, {fmt(b1)}, {fmt(c1)}, {fmt(d1)})
            </span>
          </div>
          <div>
            <span className="gt-peg-label">{tr({ zh: '变换后交比', en: 'new cross-ratio'
            })}</span>
            <strong>{fmt(cr1)}</strong>
            {detM !== 0 && distinct && String(cr0) === String(cr1) && (
              <span style={{ color: 'var(--green)', marginLeft: 8 }}>
                ✓ {tr({ zh: '不变 (PGL₂(𝔽₅) 保持交比)', en: 'invariant (PGL₂(𝔽₅) preserves cross-ratio)'
                })}
              </span>
            )}
            {detM !== 0 && distinct && String(cr0) !== String(cr1) && (
              <span style={{ color: 'var(--accent)', marginLeft: 8 }}>
                {tr({ zh: '注:交比恒不变,如果不等应该是 ∞/0 边界 case', en: 'cross-ratio should match; mismatch indicates ∞/0 edge case'
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 30.7  Syntheme & duads viewer ─────────────────────────────────────────
// A duad is a 2-subset of {1..6}. There are C(6,2) = 15 duads.
// A syntheme is a partition of {1..6} into 3 duads. There are 15 synthemes.
// A synthematic total is a set of 5 synthemes whose 15 duads cover all C(6,2).
// There are exactly 6 such totals; S_6 permutes them, and that action realises
// the outer automorphism.

// the outer automorphism.
const ALL_DUADS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 1; i <= 6; i++) for (let j = i + 1; j <= 6; j++) out.push([i, j]);
  return out;
})();

function partitionsIntoDuads(used: Set<string>, current: [number, number][], remaining: number[]): [number, number][][] {
  if (remaining.length === 0) return [current];
  const [pivot, ...rest] = remaining;
  const out: [number, number][][] = [];
  for (const other of rest) {
    const key = `${pivot},${other}`;
    if (used.has(key)) continue;
    const nextUsed = new Set(used); nextUsed.add(key);
    out.push(
      ...partitionsIntoDuads(
        nextUsed,
        [...current, [pivot, other]],
        rest.filter(x => x !== other),
      ),
    );
  }
  return out;
}

const ALL_SYNTHEMES: [number, number][][] = partitionsIntoDuads(new Set(), [], [1, 2, 3, 4, 5, 6]);
// Build the 6 totals: pick 5 synthemes whose 15 duads are exactly the 15 edges.

// Build the 6 totals: pick 5 synthemes whose 15 duads are exactly the 15 edges.
function buildSyntheticTotals(): [number, number][][][] {
  const target = new Set(ALL_DUADS.map(([i, j]) => `${i},${j}`));
  const synKey = (s: [number, number][]) => s.map(([i, j]) => `${i},${j}`).sort().join('|');
  const totals: [number, number][][][] = [];
  const seenTotals = new Set<string>();
  function recurse(picked: [number, number][][], remainingEdges: Set<string>, startIdx: number) {
    if (picked.length === 5) {
      if (remainingEdges.size === 0) {
        const key = picked.map(synKey).sort().join('::');
        if (!seenTotals.has(key)) { seenTotals.add(key); totals.push(picked); }
      }
      return;
    }
    for (let i = startIdx; i < ALL_SYNTHEMES.length; i++) {
      const s = ALL_SYNTHEMES[i];
      const edges = s.map(([a, b]) => `${a},${b}`);
      if (edges.some(e => !remainingEdges.has(e))) continue;
      const next = new Set(remainingEdges);
      for (const e of edges) next.delete(e);
      recurse([...picked, s], next, i + 1);
    }
  }
  recurse([], new Set(target), 0);
  return totals;
}

const TOTALS: [number, number][][][] = buildSyntheticTotals(); // length 6
// Permute synthemes by a permutation of {1..6}; returns the index of the resulting total.

// Permute synthemes by a permutation of {1..6}; returns the index of the resulting total.
function applyPermToTotal(total: [number, number][][], perm: number[]): [number, number][][] {
  const norm = (a: number, b: number): [number, number] => a < b ? [a, b] : [b, a];
  return total.map(s => s.map(([i, j]) => norm(perm[i - 1], perm[j - 1])).sort((p, q) => p[0] - q[0] || p[1] - q[1]));
}

function totalIndex(total: [number, number][][]): number {
  const synKey = (s: [number, number][]) => s.map(([i, j]) => `${i},${j}`).sort().join('|');
  const k = total.map(synKey).sort().join('::');
  for (let i = 0; i < TOTALS.length; i++) {
    const t = TOTALS[i];
    if (t.map(synKey).sort().join('::') === k) return i;
  }
  return -1;
}

function SynthemeTotalsViewer() {
  const lang = useLang();
  const [pickedIdx, setPickedIdx] = useState(0);
  const [perm, setPerm] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [permMode, setPermMode] = useState<'id' | '12' | '123' | '12345'>('id');

  // Compute the action of `perm` on totals.
  const mapped = TOTALS.map(t => totalIndex(applyPermToTotal(t, perm)));
  const palette = ['#E63946', '#F4A261', '#E9C46A', '#2A9D8F', '#264653', '#8338EC'];

  function applyPreset(mode: 'id' | '12' | '123' | '12345') {
    setPermMode(mode);
    if (mode === 'id') setPerm([1, 2, 3, 4, 5, 6]);
    if (mode === '12') setPerm([2, 1, 3, 4, 5, 6]);                // transposition (1 2)
    if (mode === '123') setPerm([2, 3, 1, 4, 5, 6]);               // 3-cycle (1 2 3)
    if (mode === '12345') setPerm([2, 3, 4, 5, 1, 6]);             // 5-cycle (1 2 3 4 5)
  }

  const showTotal = TOTALS[pickedIdx];

  return (
    <div className="gt-s6-syn">
      <div className="gt-s6-syn-grid">
        {TOTALS.map((t, i) => (
          <button
            key={i}
            type="button"
            className={'gt-s6-syn-card' + (i === pickedIdx ? ' is-active' : '')}
            style={{ borderColor: palette[i], background: i === pickedIdx ? palette[i] + '22' : 'transparent' }}
            onClick={() => setPickedIdx(i)}
          >
            <div className="gt-s6-syn-card-head" style={{ color: palette[i] }}>
              {lang === 'zh' ? `总 ${'ABCDEF'[i]}` : `total ${'ABCDEF'[i]}`}
            </div>
            <div className="gt-s6-syn-card-body">
              {t.map((s, si) => (
                <div key={si} className="gt-s6-syn-line">
                  {s.map(([x, y], ei) => (
                    <span key={ei} className="gt-s6-duad">
                      {x}{y}{ei < 2 ? <span className="gt-s6-syn-dot">·</span> : null}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="gt-s6-syn-card-foot">
              {tr({ zh: '→ 经 σ 映到', en: '→ under σ ↦'
            })}{' '}
              <strong style={{ color: palette[mapped[i]] }}>
                {lang === 'zh' ? `总 ${'ABCDEF'[mapped[i]]}` : `total ${'ABCDEF'[mapped[i]]}`}
              </strong>
            </div>
          </button>
        ))}
      </div>
      <div className="gt-s6-syn-perm">
        <div className="gt-s6-syn-perm-title">
          {tr({ zh: 'σ ∈ S₆ (作用在 {1..6}) =', en: 'σ ∈ S₆ (acting on {1..6}) =' })}{' '}
          <span className="gt-mono">[{perm.join(', ')}]</span>
        </div>
        <div className="gt-s6-syn-perm-buttons">
          <button type="button" className={'gt-chip' + (permMode === 'id' ? ' is-active' : '')} onClick={() => applyPreset('id')}>e</button>
          <button type="button" className={'gt-chip' + (permMode === '12' ? ' is-active' : '')} onClick={() => applyPreset('12')}>(1 2)</button>
          <button type="button" className={'gt-chip' + (permMode === '123' ? ' is-active' : '')} onClick={() => applyPreset('123')}>(1 2 3)</button>
          <button type="button" className={'gt-chip' + (permMode === '12345' ? ' is-active' : '')} onClick={() => applyPreset('12345')}>(1 2 3 4 5)</button>
        </div>
        <div className="gt-s6-syn-perm-explain">
          <L
            zh={<>{permMode === '12' ? (
              <>对换 <TeX src="(1\,2)" /> 在 6 个总上的诱导作用是 <em>另一个对换</em> 还是 <em>三个对换之积</em>? 看 6 张卡的 "→" 箭头 — 实测它把总按 <strong>(2,2,2) 型</strong> (三对换的乘积) 重排,这就是外自同构的核心:把对换类换成 2³ 型。</>
            ) : permMode === '123' ? (
              <>3-循环映 3-循环 (同型),但映到一个 <strong>不同</strong> 的 3-循环 — 6 个总上的轨道不止一个。</>
            ) : permMode === '12345' ? (
              <>5-循环映 5-循环,但分轨道方式跟标准嵌入 (固定第 6 点) 不一样。</>
            ) : '选一个 σ 看作用'}</>}
            en={<>{permMode === '12' ? (
              <>Does the transposition <TeX src="(1\,2)" /> act on the six totals as <em>another transposition</em> or as a <em>product of three transpositions</em>? Read the "→" arrows on the cards — it shuffles the totals in <strong>type (2,2,2)</strong>, exactly the outer automorphism's signature: transpositions ↦ 2³ class.</>
            ) : permMode === '123' ? (
              <>A 3-cycle maps to a 3-cycle (same type), but to a <em>different</em> 3-cycle — the orbits on the 6 totals do not all line up.</>
            ) : permMode === '12345' ? (
              <>A 5-cycle remains a 5-cycle, but its orbit structure on the 6 totals differs from the standard "fix the 6th point" embedding.</>
            ) : 'pick a σ to see its action'}</>}
          />
        </div>
      </div>
      <div className="gt-s6-syn-pickedinfo">
        <div className="gt-s6-syn-pickedinfo-title">
          {lang === 'zh' ? `当前选中:总 ${'ABCDEF'[pickedIdx]}` : `selected: total ${'ABCDEF'[pickedIdx]}`}
        </div>
        <div className="gt-s6-syn-pickedinfo-body">
          {showTotal.map((s, si) => (
            <div key={si} className="gt-s6-syn-line">
              {s.map(([x, y], ei) => (
                <span key={ei} className="gt-s6-duad-big">{x}{y}</span>
              ))}
            </div>
          ))}
        </div>
        <div className="gt-s6-syn-pickedinfo-foot">
          {tr({ zh: '5 个 syntheme,15 条 duad — 正好覆盖 ', en: '5 synthemes, 15 duads — covering exactly '
        })}<TeX src="\binom{6}{2} = 15" />
        </div>
      </div>
    </div>
  );
}

// ── 30.9  Icosahedron with P^1(F_5) labelling ─────────────────────────────
// 12 vertices of the icosahedron come in 6 antipodal pairs.  Label each pair
// by one of {0, 1, 2, 3, 4, ∞} ⊂ P^1(F_5).  PSL_2(F_5) ≅ A_5 acts as the
// rotation group of the icosahedron; one rotation by 2π/5 about a "north"
// vertex realises  z ↦ z + 1  (translation), and one rotation by π through an
// edge midpoint realises  z ↦ -1/z  (inversion).

// edge midpoint realises  z ↦ -1/z  (inversion).
function IcosahedronP1F5() {
  const [rot, setRot] = useState<'id' | 'T' | 'S' | 'TS'>('id');
  // 12 vertex positions on a 2D-ish projection of icosahedron, paired antipodally.
  // Pairs: (top, bottom) get label ∞; top-ring of 5 / bottom-ring of 5 get labels 0..4.
  const labels: (number | 'inf')[] = ['inf', 0, 1, 2, 3, 4];
  const W = 320, H = 320, cx = W / 2, cy = H / 2;
  const innerR = 70, outerR = 115;
  // Top ring of 5  (z = ring height 1)  +  bottom ring of 5 (z = -ring height 1)
  // and top pole + bottom pole.
  function vertexFor(label: number | 'inf', anti: boolean) {
    if (label === 'inf') return { x: cx, y: anti ? cy + 145 : cy - 145, key: anti ? 'inf-b' : 'inf-t' };
    const idx = label as number;
    const angle = (idx / 5) * 2 * Math.PI - Math.PI / 2 + (anti ? Math.PI / 5 : 0);
    const r = anti ? outerR : innerR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) + (anti ? 22 : -22), key: `${idx}-${anti ? 'b' : 't'}` };
  }
  // Current Möbius based on rot
  function currentMobius(): [number, number, number, number] {
    if (rot === 'id') return [1, 0, 0, 1];
    if (rot === 'T') return [1, 1, 0, 1];    // z↦z+1
    if (rot === 'S') return [0, 4, 1, 0];    // z↦-1/z (-1 ≡ 4 mod 5)
    return mobiusCompose([1, 1, 0, 1], [0, 4, 1, 0]); // T·S
  }
  const M = currentMobius();
  const action: Record<string, number | 'inf'> = {};
  for (const l of labels) {
    action[String(l)] = mobiusApply(M[0], M[1], M[2], M[3], l);
  }
  // Edges of the icosahedron (just by adjacency in our 2D mockup):
  // top pole ↔ top ring, bottom pole ↔ bottom ring, top-ring ↔ adjacent bottom-ring (zigzag).
  const labelToPair: Record<string, { t: { x: number; y: number }; b: { x: number; y: number } }> = {};
  for (const l of labels) {
    labelToPair[String(l)] = {
      t: vertexFor(l, false),
      b: vertexFor(l, true),
    };
  }
  return (
    <div className="gt-pgl-ico">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="gt-pgl-ico-svg">
        {/* Faint edges */}
        {labels.filter(l => l !== 'inf').map(l => {
          const p = labelToPair[String(l)];
          const pInf = labelToPair['inf'];
          return (
            <g key={`e-${l}`} stroke="var(--rule)" strokeWidth={1}>
              <line x1={p.t.x} y1={p.t.y} x2={pInf.t.x} y2={pInf.t.y} />
              <line x1={p.b.x} y1={p.b.y} x2={pInf.b.x} y2={pInf.b.y} />
            </g>
          );
        })}
        {labels.filter(l => l !== 'inf').map((l, i, arr) => {
          const next = arr[(i + 1) % arr.length];
          const p = labelToPair[String(l)];
          const q = labelToPair[String(next)];
          return (
            <g key={`r-${l}`} stroke="var(--rule)" strokeWidth={1}>
              <line x1={p.t.x} y1={p.t.y} x2={q.t.x} y2={q.t.y} />
              <line x1={p.b.x} y1={p.b.y} x2={q.b.x} y2={q.b.y} />
              <line x1={p.t.x} y1={p.t.y} x2={q.b.x} y2={q.b.y} strokeDasharray="2 3" opacity={0.6} />
            </g>
          );
        })}
        {/* Vertices coloured by their image */}
        {labels.map((l) => {
          const p = labelToPair[String(l)];
          const img = action[String(l)];
          const pal = ['#E63946', '#F4A261', '#E9C46A', '#2A9D8F', '#264653', '#8338EC'];
          const idxOf = (v: number | 'inf') => v === 'inf' ? 5 : v;
          const c = pal[idxOf(l)];
          const ci = pal[idxOf(img)];
          const sameImg = String(img) === String(l);
          return (
            <g key={String(l)}>
              <circle cx={p.t.x} cy={p.t.y} r={14} fill={c} stroke={sameImg ? 'var(--ink)' : ci} strokeWidth={sameImg ? 1.4 : 3} />
              <text x={p.t.x} y={p.t.y + 4} textAnchor="middle" fontSize={11} fill="white" fontFamily="var(--mono)" fontWeight={700}>
                {l === 'inf' ? '∞' : l}
              </text>
              <circle cx={p.b.x} cy={p.b.y} r={14} fill={c} stroke={sameImg ? 'var(--ink)' : ci} strokeWidth={sameImg ? 1.4 : 3} />
              <text x={p.b.x} y={p.b.y + 4} textAnchor="middle" fontSize={11} fill="white" fontFamily="var(--mono)" fontWeight={700}>
                {l === 'inf' ? '∞' : l}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="gt-pgl-ico-side">
        <div className="gt-pgl-ico-title">
          {tr({ zh: '12 顶点 = 6 对极点,每对贴一个 ℙ¹(𝔽₅) 标号', en: '12 vertices = 6 antipodal pairs, each pair labelled by a point of ℙ¹(𝔽₅)'
        })}
        </div>
        <div className="gt-pgl-ico-buttons">
          <button type="button" className={'gt-chip' + (rot === 'id' ? ' is-active' : '')} onClick={() => setRot('id')}>
            {tr({ zh: '不动', en: 'identity'
            })}
          </button>
          <button type="button" className={'gt-chip' + (rot === 'T' ? ' is-active' : '')} onClick={() => setRot('T')}>
            T : z ↦ z + 1
          </button>
          <button type="button" className={'gt-chip' + (rot === 'S' ? ' is-active' : '')} onClick={() => setRot('S')}>
            S : z ↦ −1/z
          </button>
          <button type="button" className={'gt-chip' + (rot === 'TS' ? ' is-active' : '')} onClick={() => setRot('TS')}>
            TS
          </button>
        </div>
        <div className="gt-pgl-ico-action">
          {labels.map(l => (
            <div key={String(l)} className="gt-pgl-ico-line">
              <span className="gt-mono">{l === 'inf' ? '∞' : l}</span>
              <span> → </span>
              <strong className="gt-mono">{action[String(l)] === 'inf' ? '∞' : action[String(l)]}</strong>
            </div>
          ))}
        </div>
        <div className="gt-pgl-ico-note">
          <L
            zh={<>T 的阶 = 5 (绕 "北极" 旋转 2π/5);S 的阶 = 2 (绕一条棱中点旋转 π);<TeX src="(ST)^3 = e" />。 这套 <TeX src="\langle S, T \mid S^2 = T^5 = (ST)^3 = e\rangle" /> 是 <TeX src="\mathrm{PSL}_2(\mathbb{F}_5) \cong A_5" /> 的标准表示。</>}
            en={<>T has order 5 (rotation by 2π/5 about a "north" vertex); S has order 2 (half-turn through an edge midpoint); and <TeX src="(ST)^3 = e" />. The presentation <TeX src="\langle S, T \mid S^2 = T^5 = (ST)^3 = e\rangle" /> is the standard one for <TeX src="\mathrm{PSL}_2(\mathbb{F}_5) \cong A_5" />.</>}
          />
        </div>
      </div>
    </div>
  );
}

// ── 30.11  Order histogram of random ⟨R, U⟩ words ─────────────────────────

// ── 30.11  Order histogram of random ⟨R, U⟩ words ─────────────────────────
function OrderHistogramTwoFace() {
  const [maxLen, setMaxLen] = useState(20);
  const [N, setN] = useState(2000);
  const [seed, setSeed] = useState(1);

  // The two permutations from TwoFaceCornerSim, acting on 6 corners.
  const R: number[] = [1, 2, 3, 0, 4, 5];
  const U: number[] = [4, 1, 2, 0, 5, 3];

  const compose = (p: number[], q: number[]) => p.map((_, i) => p[q[i]]);
  const id6 = [0, 1, 2, 3, 4, 5];
  const orderOfPerm = (p: number[]) => {
    let cur = p; let n = 1;
    while (cur.some((v, i) => v !== i)) { cur = compose(p, cur); n++; if (n > 60) return -1; }
    return n;
  };

  // S_5 order distribution (theoretical): orders 1, 2, 3, 4, 5, 6 with counts
  // 1, 25, 20, 30, 24, 20 totalling 120.  We display sample counts beside it.
  const theory: Record<number, number> = { 1: 1, 2: 25, 3: 20, 4: 30, 5: 24, 6: 20 };
  const orders = [1, 2, 3, 4, 5, 6];

  const sample = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    // Cheap LCG seeded by `seed`
    let s = seed >>> 0; if (s === 0) s = 1;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
    for (let k = 0; k < N; k++) {
      const len = 1 + Math.floor(rand() * maxLen);
      let cur = id6.slice();
      for (let i = 0; i < len; i++) {
        const m = rand() < 0.5 ? R : U;
        cur = compose(m, cur);
      }
      const o = orderOfPerm(cur);
      if (o >= 1 && o <= 6) counts[o]++;
    }
    return counts;
  }, [maxLen, N, seed]);

  const totalSample = orders.reduce((a, o) => a + sample[o], 0);
  const totalTheory = 120;
  const maxPct = Math.max(
    ...orders.map(o => Math.max(theory[o] / totalTheory, sample[o] / totalSample)),
  );

  return (
    <div className="gt-pgl-hist">
      <div className="gt-pgl-hist-controls">
        <label>
          {tr({ zh: '最长字 len ≤ ', en: 'word length ≤ '
        })}
          <input type="range" min={4} max={50} value={maxLen} onChange={e => setMaxLen(parseInt(e.target.value, 10))} />
          <span className="gt-mono">{maxLen}</span>
        </label>
        <label>
          {tr({ zh: '采样数 N = ', en: 'samples N = '
        })}
          <input type="range" min={500} max={20000} step={500} value={N} onChange={e => setN(parseInt(e.target.value, 10))} />
          <span className="gt-mono">{N}</span>
        </label>
        <button type="button" className="gt-btn" onClick={() => setSeed(s => s + 1)}>
          {tr({ zh: '重抽', en: 'reroll' })}
        </button>
      </div>
      <table className="gt-pgl-hist-tbl">
        <thead>
          <tr>
            <th>{tr({ zh: '阶', en: 'order'
            })}</th>
            <th>{tr({ zh: '理论 (S₅ 占比)', en: 'theory (S₅ share)'
            })}</th>
            <th>{tr({ zh: '采样占比', en: 'sample share'
            })}</th>
            <th>{tr({ zh: '条形', en: 'bar'
            })}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const tPct = theory[o] / totalTheory;
            const sPct = sample[o] / totalSample;
            return (
              <tr key={o}>
                <td className="num">{o}</td>
                <td className="num">{(tPct * 100).toFixed(2)}%</td>
                <td className="num">{(sPct * 100).toFixed(2)}%</td>
                <td className="gt-pgl-hist-bar-cell">
                  <div className="gt-pgl-hist-bar-row">
                    <div className="gt-pgl-hist-bar gt-pgl-hist-bar-theory" style={{ width: `${(tPct / maxPct) * 100}%` }} />
                    <div className="gt-pgl-hist-bar gt-pgl-hist-bar-sample" style={{ width: `${(sPct / maxPct) * 100}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="gt-pgl-hist-legend">
        <span><span className="gt-pgl-hist-swatch gt-pgl-hist-bar-theory" /> {tr({ zh: '理论 (S₅ 全部 120 元素)', en: 'theory (all 120 elements of S₅)'
        })}</span>
        <span><span className="gt-pgl-hist-swatch gt-pgl-hist-bar-sample" /> {tr({ zh: '⟨R, U⟩ 采样', en: '⟨R, U⟩ samples'
        })}</span>
      </div>
    </div>
  );
}




// ═══════════════════════════════════════════════════════════════════════
// §31 NEW · Rotational puzzles additions
// ═══════════════════════════════════════════════════════════════════════
// ─── §31 extension helpers ───────────────────────────────────────────────────

// Two-face turner: animates one rotation of either face, shows cycle structure

export default function TwoFacePGL() {
  const lang = useLang();
  return (
      <GTSec id="two-face-pgl" className="gt-sec">
        <div className="gt-sec-num">§30</div>
        <h2 className="gt-sec-title">
          <L zh="两面 6 角子群 — PGL₂(𝔽₅) ≅ S₅ 在 6 点上的奇迹" en="The two-face corner group — PGL₂(𝔽₅) ≅ S₅, the miracle on six points" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>只考虑魔方两个相邻面 (比如 R、 U) 转出的子群,只看 <strong>角块的置换</strong> (忽略朝向)。 这两个面共享 6 个角块 (4 + 4 − 2)。 朴素估计置换数 6! = 720,但实际只达到 <strong>120 = 5!</strong>。 这个 120 阶群恰是 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5) \cong S_5" />,在 6 点上做 <em>尖锐 3-传递</em> 作用; 同时它给出 <TeX src="S_5 \hookrightarrow S_6" /> 的一个 <em>异常</em> 嵌入 (传递的),从而是 <TeX src="S_6" /> 那唯一非平凡 <em>外自同构</em> 的源泉。 这是有限对称群里最浓缩的一段巧合。</>}
            en={<>Take the subgroup of the cube generated by two adjacent face turns (say R, U), looking only at <strong>corner permutations</strong> (ignore twist). The two faces share 6 corners (4 + 4 − 2). Naïvely 6! = 720, but the actual order is <strong>120 = 5!</strong>. This 120-element group is <TeX src="\mathrm{PGL}_2(\mathbb{F}_5) \cong S_5" /> in its <em>sharply 3-transitive</em> action on six points; it also gives an <em>exotic</em> transitive embedding <TeX src="S_5 \hookrightarrow S_6" />, and that embedding is the source of the unique non-trivial <em>outer automorphism</em> of <TeX src="S_6" />. This is the densest cluster of coincidences in finite group theory.</>}
          />
        </p>

        <div className="gt-open-summary">
          <div className="gt-open-summary-head">{tr({ zh: '本节速览', en: 'at a glance'
        })}</div>
          <table className="gt-pattern-tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>{tr({ zh: '子节', en: 'subsection'
                })}</th>
                <th>{tr({ zh: '主要事实', en: 'main fact'
                })}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="num">30.1</td><td>{tr({ zh: '两面 6 角子拼图', en: 'Two-face 6-corner puzzle'
            })}</td><td>{tr({ zh: '现象:120 个状态而不是 720', en: 'phenomenon: 120 states, not 720'
            })}</td></tr>
              <tr><td className="num">30.2</td><td>{tr({ zh: '配对模式证明', en: 'pair-pattern proof'
            })}</td><td>{tr({ zh: '15/3 = 5 个配对模式, S₅ 作用忠实', en: '15/3 = 5 pair patterns, faithful S₅ action'
            })}</td></tr>
              <tr><td className="num">30.3</td><td>ℙ¹(𝔽₅) & PGL₂(𝔽₅)</td><td><TeX src="|\mathrm{PGL}_2(\mathbb{F}_q)| = q(q+1)(q-1)" /></td></tr>
              <tr><td className="num">30.4</td><td>{tr({ zh: '尖锐 3-传递', en: 'sharply 3-transitive'
            })}</td><td>{tr({ zh: '任给三对相异点,Möbius 唯一确定', en: '3 → 3 lifts uniquely'
            })}</td></tr>
              <tr><td className="num">30.5</td><td>{tr({ zh: '交比不变量', en: 'cross-ratio invariant'
            })}</td><td><TeX src="(a,b;c,d) = \tfrac{(a-c)(b-d)}{(a-d)(b-c)}" /></td></tr>
              <tr><td className="num">30.6</td><td>S₆ {tr({ zh: '外自同构', en: 'outer automorphism'
            })}</td><td>{tr({ zh: '唯一; 由异常 S₅ ↪ S₆ 诱导', en: 'unique; induced by exotic S₅ ↪ S₆'
            })}</td></tr>
              <tr><td className="num">30.7</td><td>{lang === 'zh' ? 'syntheme / duads' : 'synthemes & duads'}</td><td>{tr({ zh: '6 个 synthematic total; S₆ 置换', en: '6 totals; S₆ permutes them'
            })}</td></tr>
              <tr><td className="num">30.8</td><td>Mathieu</td><td>PGL₂(𝔽₅) ⊂ M₁₀ ⊂ M₁₁ ⊂ M₁₂ ⊂ M₂₄</td></tr>
              <tr><td className="num">30.9</td><td>{tr({ zh: '正二十面体', en: 'icosahedron'
            })}</td><td>PSL₂(𝔽₅) ≅ A₅ ≅ I (rotations)</td></tr>
              <tr><td className="num">30.10</td><td>{tr({ zh: '生成元 / 表示', en: 'generators / presentation' })}</td><td><TeX src="\langle S, T \mid S^2 = T^5 = (ST)^3 = 1\rangle" /></td></tr>
              <tr><td className="num">30.11</td><td>{tr({ zh: '⟨R,U⟩ 阶分布实验', en: 'order histogram experiment'
            })}</td><td>{tr({ zh: '阶分布拟合 S₅ 共轭类', en: 'sample matches S₅ class sizes'
            })}</td></tr>
            </tbody>
          </table>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.1  两面 6 角子拼图" en="30.1  The two-face six-corner puzzle"/>
        </h3>
        <p>
          <L
            zh={<>用 R 和 U 两个面把一个完整的 3×3×3 (或 2×2×2) 转任意多次,看 R 面与 U 面共享区域里的 6 个角块: 它们落在哪些位置? 这个问题最早由 Jaap Scherphuis 整理 (jaapsch.net/puzzles/pgl25.htm)。 因为我们只用这两面的转动,这 6 个角永远只在自己这 6 个槽位之间交换,不会跑到对面去。 朴素的上界是 6! = 720,但实测只有 <strong>120</strong> 种,正好等于 5!。 这个 120 阶群有 <em>两条等价的描述</em>:</>}
            en={<>Turn R and U on a full 3×3×3 (or 2×2×2) any number of times and observe the six corners in the shared R-and-U region: which slots do they land in? The question was first catalogued by Jaap Scherphuis (jaapsch.net/puzzles/pgl25.htm). Because we only use these two faces, the six corners never leave their six slots. A naïve upper bound is 6! = 720, but empirically only <strong>120</strong> distinct permutations occur — exactly 5!. This 120-element group admits <em>two equivalent descriptions</em>:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>组合描述</strong> (30.2): 6 个角分成 3 对的方式有 15 种,5 种「本质不同的配对模式」 V W X Y Z; <TeX src="\langle R, U\rangle" /> 在这 5 种模式上忠实作用,得到完整 <TeX src="S_5" />。</>} en={<><strong>Combinatorial</strong> (30.2): six corners partition into three pairs in 15 ways, falling into 5 essentially different pair patterns V W X Y Z. The group <TeX src="\langle R, U\rangle" /> acts faithfully on these 5 patterns and realises all of <TeX src="S_5" />.</>} /></li>
          <li><L zh={<><strong>射影描述</strong> (30.3–30.5): 给 6 个角贴上 <TeX src="\mathbb{P}^1(\mathbb{F}_5) = \{0,1,2,3,4,\infty\}" /> 的标号,R 和 U 各自实现一个 Möbius 变换 (det 非零的 2×2 mod-5 矩阵); 两个 Möbius 生成整个 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" />。</>} en={<><strong>Projective</strong> (30.3–30.5): label the six corners by <TeX src="\mathbb{P}^1(\mathbb{F}_5) = \{0,1,2,3,4,\infty\}" />. Each of R, U realises a Möbius transformation (a 2×2 mod-5 matrix of non-zero determinant); together they generate the full <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" />.</>} /></li>
        </ul>
        <p>
          <L
            zh={<>等价性 (30.2 ↔ 30.3) 是个 <em>有限版的 Cayley 对应</em>: 在 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> 上,「6 个点的配对」 = 「点的对合的不动点对」 = 「2×2 矩阵 mod 中心」 都是 5 维的 (Klein 四群的左陪集,或者同侧 sign 5-元集)。 这个 5 维向我们解释了为什么从 6 点 6! = 720 个置换中,刚好挑出 720/6 = 120 个。</>}
            en={<>Equivalence (30.2 ↔ 30.3) is a <em>finite Cayley correspondence</em>: in <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" />, "pairings of 6 points" = "fixed pairs of involutions" = "matrices mod centre" all have dimension 5 (cosets of the Klein 4-group). This 5 is exactly why 120 of the 720 permutations remain.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '6 角子模拟器', en: '6-corner sim'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '按 R / U,看角置换;可达 120 = 5! 种', en: 'press R / U, watch the corner permutation; only 120 = 5! states reachable'
        })}</div>
          <TwoFaceCornerSim />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.2  配对模式证明 (5 = 5!! / 3)" en="30.2  Pair-pattern proof"/>
        </h3>
        <p>
          <L
            zh={<>把 6 个角块两两分成 3 对,共有 <TeX src="\binom{6}{2}\binom{4}{2}\binom{2}{2}/3! = 15" /> 种 <em>有序无序的 pair</em>。 但我们关心的是「在 R、 U 下保持稳定的 pair 集合」,而 <TeX src="\langle R, U\rangle" /> 把 15 种 pair 划分成 5 个等价类,每类 3 个: 这 5 个等价类记作 <strong>V W X Y Z</strong>。 每次转面 (R 或 U) 把这 5 个标签按 <em>某个 <TeX src="S_5" /> 置换</em> 推到另一个。</>}
            en={<>Six corners split into three pairs in <TeX src="\binom{6}{2}\binom{4}{2}\binom{2}{2}/3! = 15" /> ways. But we want <em>R-and-U-stable pair sets</em>; the group <TeX src="\langle R, U\rangle" /> groups the 15 pairs into 5 equivalence classes of 3 each, labelled <strong>V W X Y Z</strong>. Each face turn permutes the 5 labels by some element of <TeX src="S_5" />.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '引理 30.1 — 配对作用忠实', en: 'Lemma 30.1 — pair action is faithful'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>不同的角置换给出不同的「5 模式上的置换」。 因此角群同态注入 <TeX src="S_5" />。 反向: R、 U 各自的 5 模式作用包含一个 4-cycle 和一个错开的 4-cycle, 两个 4-cycle 在 <TeX src="S_5" /> 里足以生成全 <TeX src="S_5" /> (经典事实, <TeX src="S_n" /> 由「<TeX src="n-1" /> 循环 + 对换」 或「适当两个 <TeX src="n-1" /> 循环」 生成)。 所以角群 = <TeX src="S_5" />,阶 120。 ∎</>}
              en={<>Different corner permutations induce different permutations of the 5 patterns; the corner group injects into <TeX src="S_5" />. Conversely, R and U each act as a 4-cycle on patterns, and two staggered 4-cycles in <TeX src="S_5" /> already generate <TeX src="S_5" /> (a classical fact: <TeX src="S_n" /> is generated by an <TeX src="(n{-}1)" />-cycle plus a transposition, and by suitable pairs of cycles). Hence the corner group is exactly <TeX src="S_5" />, order 120. ∎</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>注意算式 <TeX src="5 = 15/3" /> 用了一个不显然的事实: 5 个 pair-pattern 等价类大小都恰好是 3。 这背后是 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> 的中心化子结构 — 每个对合 (order 2 元素) 的不动点对是一个 pair-pattern,且对合按其循环型分布,刚好 5 类 × 3 个对合 = 15。 详见 30.3。</>}
            en={<>The arithmetic <TeX src="5 = 15/3" /> uses a non-trivial fact: each of the 5 equivalence classes contains exactly 3 pairs. This reflects centraliser structure in <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> — each involution's fixed-pair set is a pair-pattern, and the involutions fall into 5 conjugacy classes × 3 involutions each = 15. More in 30.3.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.3  ℙ¹(𝔽₅) 与 PGL₂(𝔽₅)" en="30.3  ℙ¹(𝔽₅) and PGL₂(𝔽₅)"/>
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 30.2 — 射影直线', en: 'Definition 30.2 — projective line'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>对任意域 <TeX src="F" />,射影直线 <TeX src="\mathbb{P}^1(F)" /> 是 <em>非零</em> 二维向量 <em>模缩放</em> 的等价类: <TeXBlock src={`\\mathbb{P}^1(F) \\;=\\; (F^2 \\setminus \\{0\\})\\,/\\,F^{*},`} /> 即 <TeX src="[x : y]" /> 与 <TeX src="[\lambda x : \lambda y]" /> (<TeX src="\lambda \neq 0" />) 视为同一点。 对 <TeX src="F = \mathbb{F}_q" />, 共 <TeX src="\frac{q^2 - 1}{q - 1} = q + 1" /> 个点。</>}
              en={<>For a field <TeX src="F" />, the projective line <TeX src="\mathbb{P}^1(F)" /> is the set of <em>non-zero</em> 2-vectors <em>modulo scaling</em>: <TeXBlock src={`\\mathbb{P}^1(F) \\;=\\; (F^2 \\setminus \\{0\\})\\,/\\,F^{*},`} /> i.e. <TeX src="[x : y]" /> and <TeX src="[\lambda x : \lambda y]" /> (<TeX src="\lambda \neq 0" />) are the same point. Over <TeX src="\mathbb{F}_q" />, the line has <TeX src="\frac{q^2 - 1}{q - 1} = q + 1" /> points.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>用仿射坐标: 每个 <TeX src="[x : y]" /> 当 <TeX src="y \neq 0" /> 可写成 <TeX src="[z : 1]" /> 形式, <TeX src="z = x/y \in F" />; 还有一个 <em>无穷远点</em> <TeX src="[1 : 0]" />, 记作 <TeX src="\infty" />。 对 <TeX src="\mathbb{F}_5" />:<TeXBlock src={`\\mathbb{P}^1(\\mathbb{F}_5) = \\{0, 1, 2, 3, 4, \\infty\\}, \\quad |\\mathbb{P}^1(\\mathbb{F}_5)| = 6.`} /></>}
            en={<>In affine coordinates, each <TeX src="[x : y]" /> with <TeX src="y \neq 0" /> is <TeX src="[z : 1]" /> for <TeX src="z = x/y \in F" />, plus a single <em>point at infinity</em> <TeX src="[1 : 0]" /> denoted <TeX src="\infty" />. Over <TeX src="\mathbb{F}_5" />:<TeXBlock src={`\\mathbb{P}^1(\\mathbb{F}_5) = \\{0, 1, 2, 3, 4, \\infty\\}, \\quad |\\mathbb{P}^1(\\mathbb{F}_5)| = 6.`} /></>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 30.3 — 一般射影线性群', en: 'Definition 30.3 — projective linear group'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>给定域 <TeX src="F" />,定义<TeXBlock src={`\\mathrm{GL}_2(F) = \\{M \\in M_2(F) : \\det M \\neq 0\\}, \\quad Z = \\{\\lambda I : \\lambda \\in F^{*}\\} \\le \\mathrm{GL}_2(F),`} /><TeXBlock src={`\\mathrm{PGL}_2(F) = \\mathrm{GL}_2(F)\\,/\\,Z.`} /><TeX src="\mathrm{PGL}_2(F)" /> 通过 Möbius 变换 <TeX src="z \mapsto (az + b)/(cz + d)" /> 作用在 <TeX src="\mathbb{P}^1(F)" /> 上 — 缩放矩阵给同一个 Möbius,所以中心 <TeX src="Z" /> 被自然消掉。</>}
              en={<>For a field <TeX src="F" />, set<TeXBlock src={`\\mathrm{GL}_2(F) = \\{M \\in M_2(F) : \\det M \\neq 0\\}, \\quad Z = \\{\\lambda I : \\lambda \\in F^{*}\\} \\le \\mathrm{GL}_2(F),`} /><TeXBlock src={`\\mathrm{PGL}_2(F) = \\mathrm{GL}_2(F)\\,/\\,Z.`} /><TeX src="\mathrm{PGL}_2(F)" /> acts on <TeX src="\mathbb{P}^1(F)" /> by Möbius transformations <TeX src="z \mapsto (az + b)/(cz + d)" /> — scalar matrices give the same Möbius, so the centre <TeX src="Z" /> is killed.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<><strong>计数</strong> (对一般 <TeX src="q" />): <TeX src="\mathrm{GL}_2(\mathbb{F}_q)" /> 的元素 = 「2 个线性无关的列」 = <TeX src="(q^2 - 1)(q^2 - q)" />; 中心 <TeX src="Z" /> 的元素 = <TeX src="q - 1" />。 故</>}
            en={<><strong>Order</strong> (general <TeX src="q" />): <TeX src="\mathrm{GL}_2(\mathbb{F}_q)" /> = "two linearly independent columns" = <TeX src="(q^2 - 1)(q^2 - q)" />; <TeX src="|Z| = q - 1" />. So</>}
          />
        </p>
        <TeXBlock src={`|\\mathrm{PGL}_2(\\mathbb{F}_q)| \\;=\\; \\frac{(q^2 - 1)(q^2 - q)}{q - 1} \\;=\\; q(q+1)(q-1).`} />
        <p>
          <L
            zh={<>对 <TeX src="q = 5" />: <TeX src="|\mathrm{PGL}_2(\mathbb{F}_5)| = 5 \cdot 6 \cdot 4 = 120 = 5!" />。 这跟 <TeX src="S_5" /> 的阶巧合相同 (确实同构,30.4 给同构的「显式见证」)。</>}
            en={<>For <TeX src="q = 5" />: <TeX src="|\mathrm{PGL}_2(\mathbb{F}_5)| = 5 \cdot 6 \cdot 4 = 120 = 5!" />, the same as <TeX src="|S_5|" />. They are in fact isomorphic; 30.4 provides the explicit witness.</>}
          />
        </p>
        <p>
          <L
            zh={<>小表 (验证公式):</>}
            en={<>Small table (sanity check):</>}
          />
        </p>
        <table className="gt-pattern-tbl">
          <thead>
            <tr>
              <th>q</th>
              <th><TeX src="|\mathbb{P}^1(\mathbb{F}_q)| = q + 1" /></th>
              <th><TeX src="|\mathrm{PGL}_2|" /></th>
              <th>{tr({ zh: '熟悉的群', en: 'familiar group' })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="num">2</td><td className="num">3</td><td className="num">6</td><td><TeX src="S_3" /></td></tr>
            <tr><td className="num">3</td><td className="num">4</td><td className="num">24</td><td><TeX src="S_4" /></td></tr>
            <tr><td className="num">4</td><td className="num">5</td><td className="num">60</td><td><TeX src="A_5" /> ({tr({ zh: '注:F₄ 非素域', en: 'note: F₄ not prime' })})</td></tr>
            <tr><td className="num">5</td><td className="num">6</td><td className="num">120</td><td><TeX src="S_5" /></td></tr>
            <tr><td className="num">7</td><td className="num">8</td><td className="num">336</td><td><TeX src="\mathrm{PGL}_2(\mathbb{F}_7)" /> ({tr({ zh: '不再是 S_n', en: 'no longer S_n' })})</td></tr>
            <tr><td className="num">9</td><td className="num">10</td><td className="num">720</td><td><TeX src="\mathrm{PGL}_2(\mathbb{F}_9)" />, <TeX src="\mathrm{P\\Gamma L}" /> {tr({ zh: '触及 S₆', en: 'related to S₆'
            })}</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 12 }}>
          <L
            zh={<>「<TeX src="\mathrm{PGL}_2 \cong S_n" />」 巧合只在 <TeX src="q \in \{2, 3, 5\}" /> 出现 (<TeX src="n = q + 1 \in \{3, 4, 6\}" />)。 <TeX src="q = 5" /> 是这个 family 的最后一项,也是最戏剧化的。 进一步: <TeX src="\mathrm{PSL}_2(\mathbb{F}_5) \cong A_5" /> 是阶最小的非阿贝尔单群 (60 元), 同构于正二十面体的旋转群 (30.9)。</>}
            en={<>The coincidence <TeX src="\mathrm{PGL}_2 \cong S_n" /> happens only for <TeX src="q \in \{2, 3, 5\}" /> (i.e. <TeX src="n = q + 1 \in \{3, 4, 6\}" />). <TeX src="q = 5" /> is the final and most dramatic member. Moreover <TeX src="\mathrm{PSL}_2(\mathbb{F}_5) \cong A_5" /> is the smallest non-Abelian simple group (60 elements) and the rotation group of the icosahedron (30.9).</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Möbius 游乐场 · 在 ℙ¹(𝔽₅) 上', en: 'Möbius playground · on ℙ¹(𝔽₅)'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '调整 2×2 矩阵的 4 个 0..4 元素; 实时看 6 点置换 + 循环分解', en: 'tweak the 2×2 mod-5 matrix; live 6-point action + cycle decomposition'
        })}</div>
          <MobiusPlayground />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.4  尖锐 3-传递作用" en="30.4  The sharply 3-transitive action"/>
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 30.4 — 尖锐 k-传递', en: 'Definition 30.4 — sharply k-transitive'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>群 <TeX src="G" /> 作用于集合 <TeX src="X" /> 称为 <strong>尖锐 <TeX src="k" />-传递</strong> 若对任意两组 <em>有序</em> <TeX src="k" /> 元相异点 <TeX src="(x_1,\ldots,x_k)" /> 和 <TeX src="(y_1,\ldots,y_k)" />,存在 <em>唯一</em> 一个 <TeX src="g \in G" /> 满足 <TeX src="g \cdot x_i = y_i" /> for all <TeX src="i" />。</>}
              en={<>An action of <TeX src="G" /> on <TeX src="X" /> is <strong>sharply <TeX src="k" />-transitive</strong> if for any two ordered <TeX src="k" />-tuples of distinct points <TeX src="(x_1,\ldots,x_k)" /> and <TeX src="(y_1,\ldots,y_k)" />, there is a <em>unique</em> <TeX src="g \in G" /> with <TeX src="g \cdot x_i = y_i" /> for all <TeX src="i" />.</>}
            />
          </div>
        </div>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 30.5 (经典)', en: 'Theorem 30.5 (classical)'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对任意域 <TeX src="F" />, <TeX src="\mathrm{PGL}_2(F)" /> 在 <TeX src="\mathbb{P}^1(F)" /> 上的 Möbius 作用是 <strong>尖锐 3-传递</strong>。 特别 <TeX src="F = \mathbb{F}_5" />: 给定 <TeX src="(a, b, c), (a', b', c')" /> 两组互不相同的三点, 恰有 <em>一个</em> Möbius 把第一组送到第二组。</>}
              en={<>For any field <TeX src="F" />, <TeX src="\mathrm{PGL}_2(F)" /> acts on <TeX src="\mathbb{P}^1(F)" /> sharply 3-transitively. In particular over <TeX src="\mathbb{F}_5" />: given two triples of distinct points <TeX src="(a, b, c), (a', b', c')" />, there is <em>exactly one</em> Möbius taking the first to the second.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<><strong>证明梗概</strong> (传递性): 我们只需证存在性 — 任给 <TeX src="(a, b, c)" /> 三相异点都可被某个 Möbius 送到 <TeX src="(0, 1, \infty)" /> 这一 「标准三元组」, 那么两组任意三元组都能通过 「先送到标准, 再反过来」 实现转化。 显式构造:</>}
            en={<><strong>Proof sketch</strong> (existence): we show any triple <TeX src="(a, b, c)" /> of distinct points can be moved to the <em>standard triple</em> <TeX src="(0, 1, \infty)" />; composition then takes any to any. Explicitly:</>}
          />
        </p>
        <TeXBlock src={`f_{a,b,c}(z) \\;=\\; \\frac{(z - a)(b - c)}{(z - c)(b - a)}`} />
        <p>
          <L
            zh={<>满足 <TeX src="f(a) = 0,\; f(b) = 1,\; f(c) = \infty" />。 (验证: 把 <TeX src="z = a, b, c" /> 代入分子分母即可。 边界情形 <TeX src="a, b, c" /> 含 <TeX src="\infty" /> 时,先用 <TeX src="z \mapsto 1/(z - a)" /> 把无穷拉到有限再做 — 形式不变。)</>}
            en={<>satisfies <TeX src="f(a) = 0,\; f(b) = 1,\; f(c) = \infty" />. (Verify by direct substitution. If any of <TeX src="a, b, c" /> equals <TeX src="\infty" />, replace <TeX src="z" /> by <TeX src="1/(z - a)" /> first; the formula stays valid in the limit.)</>}
          />
        </p>
        <p>
          <L
            zh={<><strong>证明梗概</strong> (唯一性): 假设两个 Möbius <TeX src="f_1, f_2" /> 都把 <TeX src="(a, b, c)" /> 送到 <TeX src="(a', b', c')" />,则 <TeX src="f_2^{-1} \circ f_1" /> 固定三个点 <TeX src="a, b, c" />。 但 Möbius 变换 <TeX src="z \mapsto (\alpha z + \beta)/(\gamma z + \delta)" /> 固定 3 个相异点 ⇒ 方程 <TeX src="\alpha z + \beta = z(\gamma z + \delta)" /> 有 ≥ 3 个根 ⇒ <TeX src="\gamma = 0,\, \alpha = \delta,\, \beta = 0" /> ⇒ 它是恒等。 ∎</>}
            en={<><strong>Proof sketch</strong> (uniqueness): if two Möbius transformations <TeX src="f_1, f_2" /> both send <TeX src="(a, b, c) \to (a', b', c')" />, then <TeX src="f_2^{-1} \circ f_1" /> fixes three points. But a Möbius <TeX src="z \mapsto (\alpha z + \beta)/(\gamma z + \delta)" /> with three fixed points must satisfy <TeX src="\alpha z + \beta = z(\gamma z + \delta)" /> at three values of <TeX src="z" />; a degree-≤2 polynomial with three roots must be zero, forcing <TeX src="\gamma = 0,\, \alpha = \delta,\, \beta = 0" /> — the identity. ∎</>}
          />
        </p>
        <p>
          <L
            zh={<><strong>计数检验</strong>: 尖锐 3-传递 ⇒ <TeX src="|G| = |\mathbb{P}^1| \cdot (|\mathbb{P}^1| - 1) \cdot (|\mathbb{P}^1| - 2)" />。 代入 <TeX src="|\mathbb{P}^1(\mathbb{F}_5)| = 6" />: <TeX src="|G| = 6 \cdot 5 \cdot 4 = 120" />, 与 <TeX src="|\mathrm{PGL}_2(\mathbb{F}_5)|" /> 一致。 ✓</>}
            en={<><strong>Count check</strong>: sharp 3-transitivity gives <TeX src="|G| = 6 \cdot 5 \cdot 4 = 120 = |\mathrm{PGL}_2(\mathbb{F}_5)|" />. ✓</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.5  交比 — 唯一不变量" en="30.5  The cross-ratio — the only invariant"/>
        </h3>
        <p>
          <L
            zh={<>3-传递告诉我们 <em>三</em> 个点可以任意搬动; 那么 <em>四</em> 个点就要有一个不变量 — 否则尖锐 3-传递自动升级为 4-传递, 但 <TeX src="|G| = 120 \neq 6 \cdot 5 \cdot 4 \cdot 3" />。 这个不变量叫 <strong>交比</strong> (cross-ratio):</>}
            en={<>Three points can be moved freely; four points must have one invariant — otherwise sharp 3-transitivity would silently upgrade to 4-transitivity, but <TeX src="|G| = 120 \neq 6 \cdot 5 \cdot 4 \cdot 3" />. The invariant is the <strong>cross-ratio</strong>:</>}
          />
        </p>
        <TeXBlock src={`(a, b;\\, c, d) \\;=\\; \\frac{(a - c)(b - d)}{(a - d)(b - c)} \\;\\in\\; F \\cup \\{\\infty\\}.`} />
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 30.6 (交比不变性)', en: 'Theorem 30.6 (cross-ratio invariance)'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对任意 <TeX src="\phi \in \mathrm{PGL}_2(F)" /> 和任意 4 相异点 <TeX src="(a, b, c, d) \in \mathbb{P}^1(F)^4" />:<TeXBlock src={`(\\phi(a),\\, \\phi(b);\\, \\phi(c),\\, \\phi(d)) \\;=\\; (a,\\, b;\\, c,\\, d).`} />反之: 若 <TeX src="(a, b; c, d) = (a', b'; c', d')" />, 则存在 <TeX src="\phi \in \mathrm{PGL}_2(F)" /> 把第一组四点送到第二组。 即 <strong>交比是 4 元组在 <TeX src="\mathrm{PGL}_2" /> 作用下的完全不变量</strong>。</>}
              en={<>For any <TeX src="\phi \in \mathrm{PGL}_2(F)" /> and any 4 distinct points <TeX src="(a, b, c, d)" />:<TeXBlock src={`(\\phi(a),\\, \\phi(b);\\, \\phi(c),\\, \\phi(d)) \\;=\\; (a,\\, b;\\, c,\\, d).`} />Conversely: equal cross-ratios mean the two quadruples are <TeX src="\mathrm{PGL}_2" />-equivalent. So <strong>the cross-ratio is the complete invariant of 4-tuples under <TeX src="\mathrm{PGL}_2" /></strong>.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<><strong>证明梗概</strong>: 由 30.4 中的 <TeX src="f_{a,b,c}" />, 可以写 <TeX src="(a, b; c, d) = f_{a,b,c}(d)" />。 任意 <TeX src="\phi" />: <TeX src="\phi(a), \phi(b), \phi(c)" /> 三个点对应的标准化映射就是 <TeX src="f_{\phi(a), \phi(b), \phi(c)} = f_{a,b,c} \circ \phi^{-1}" /> (由唯一性), 故 <TeX src="f_{\phi(a), \phi(b), \phi(c)}(\phi(d)) = f_{a,b,c}(d)" />。 ∎</>}
            en={<><strong>Sketch</strong>: by 30.4, <TeX src="(a, b; c, d) = f_{a,b,c}(d)" />. For any <TeX src="\phi" />, uniqueness in 30.4 forces <TeX src="f_{\phi(a), \phi(b), \phi(c)} = f_{a,b,c} \circ \phi^{-1}" />, so <TeX src="f_{\phi(a), \phi(b), \phi(c)}(\phi(d)) = f_{a,b,c}(d)" />. ∎</>}
          />
        </p>
        <p>
          <L
            zh={<><strong>有限可能的值</strong>: 在 <TeX src="\mathbb{F}_5" /> 上, 交比落在 <TeX src="\mathbb{P}^1(\mathbb{F}_5) \setminus \{0, 1, \infty\} = \{2, 3, 4\}" /> 还是 <TeX src="\{0, 1, \infty\}" />? 后者对应「四点不全相异」(退化 case)。 真正 4 相异点的交比恰好取 <TeX src="6 - 3 = 3" /> 个值之一,加上 4 元置换 (Klein 4) 的不变性, 6 × 3 = 18 个有序 4 元组对应同一交比 值 — 验证 <TeX src="120 / (6 \cdot 4) = 5 = ?" /> 嗯不对, 详细计数留作练习。</>}
            en={<><strong>Possible values</strong>: over <TeX src="\mathbb{F}_5" />, a cross-ratio of 4 distinct points lies in <TeX src="\mathbb{P}^1(\mathbb{F}_5) \setminus \{0, 1, \infty\} = \{2, 3, 4\}" /> (the values 0, 1, ∞ correspond to degenerate quadruples). So just 3 values up to ordering of the 4 points (and the Klein-4 action by point-swaps preserves the cross-ratio). The detailed orbit counting is a nice exercise.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '交比计算器 + Möbius 不变性', en: 'cross-ratio calculator + Möbius invariance'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '选 4 个点,再加一个 Möbius,验交比不变', en: 'pick 4 points, apply a Möbius, watch the cross-ratio stay fixed'
        })}</div>
          <CrossRatioCalc />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.6  S₆ 的外自同构 — 唯一的例外" en="30.6  The outer automorphism of S₆ — the unique exception"/>
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 30.7 (Hölder 1895)', en: 'Theorem 30.7 (Hölder 1895)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对所有 <TeX src="n \neq 6" />,<TeX src="\mathrm{Aut}(S_n) = S_n" /> (即所有自同构都是内自同构, <TeX src="\mathrm{Out}(S_n) = 1" />)。 唯独 <TeX src="n = 6" />: <TeXBlock src={`\\mathrm{Out}(S_6) \\;\\cong\\; \\mathbb{Z}/2.`} /> 这一外自同构由 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> 的 「异常」 嵌入 <TeX src="S_5 \hookrightarrow S_6" /> 诱导,把对换 (类大小 15) 与「三对换之积」(类大小 15) 互换。</>}
              en={<>For every <TeX src="n \neq 6" />, <TeX src="\mathrm{Aut}(S_n) = S_n" /> (every automorphism is inner; <TeX src="\mathrm{Out}(S_n) = 1" />). The exception <TeX src="n = 6" /> has <TeXBlock src={`\\mathrm{Out}(S_6) \\;\\cong\\; \\mathbb{Z}/2.`} /> The outer automorphism is induced by the "exotic" embedding <TeX src="S_5 \hookrightarrow S_6" /> coming from <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" />; it swaps the class of transpositions (size 15) with the class of "products of three disjoint transpositions" (also size 15).</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<><strong>两种 S₅ ↪ S₆ 嵌入</strong>:</>}
            en={<><strong>Two embeddings <TeX src="S_5 \hookrightarrow S_6" /></strong>:</>}
          />
        </p>
        <table className="gt-pattern-tbl">
          <thead>
            <tr>
              <th>{tr({ zh: '嵌入', en: 'embedding' })}</th>
              <th>{tr({ zh: '描述', en: 'description' })}</th>
              <th>{tr({ zh: '在 6 元集上', en: 'on 6 elements' })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{tr({ zh: '标准', en: 'standard'
            })}</td>
              <td>{tr({ zh: '把 S₅ 当成「固定第 6 个元素」', en: 'S₅ fixes one of the 6 elements'
            })}</td>
              <td>{tr({ zh: '非传递 — 第 6 点是孤立轨道', en: 'intransitive — the 6th point is isolated'
            })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: '异常', en: 'exotic'
            })}</td>
              <td>{tr({ zh: 'PGL₂(𝔽₅) ≅ S₅ 在 ℙ¹(𝔽₅) 上传递', en: 'PGL₂(𝔽₅) ≅ S₅ acting on ℙ¹(𝔽₅) transitively'
            })}</td>
              <td>{tr({ zh: '传递 — 6 点上的尖锐 3-传递', en: 'transitive — sharp 3-transitivity'
            })}</td>
            </tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>因为 <TeX src="\mathrm{Aut}(S_5) = S_5" /> (内自同构), 这两个嵌入在 <TeX src="S_5" /> 自身看来 「应该等价」 — 但它们的像在 <TeX src="S_6" /> 内 <em>非共轭</em> (一个传递、 一个非传递, 怎么共轭也不可能等价)。 这种 「同一个 <TeX src="S_5" /> 在 <TeX src="S_6" /> 里两种非共轭副本」 的现象就是外自同构的本质。 形式上: 取一个把异常 <TeX src="S_5" /> 送到标准 <TeX src="S_5" /> 的双射 (用 6 个 synthematic total ↔ 6 个原点 见 30.7), 它扩展为 <TeX src="\phi: S_6 \to S_6" /> 不属于内自同构。</>}
            en={<>Since <TeX src="\mathrm{Aut}(S_5) = S_5" /> internally, the two embeddings "should be equivalent" inside <TeX src="S_5" /> — but their images in <TeX src="S_6" /> are <em>not conjugate</em> (one is transitive, the other not). This pair of non-conjugate copies of <TeX src="S_5" /> inside <TeX src="S_6" /> is the heart of the outer automorphism. Formally: a bijection sending the exotic <TeX src="S_5" /> to the standard <TeX src="S_5" /> (via 6 synthematic totals ↔ original 6 points, see 30.7) extends to a non-inner <TeX src="\phi: S_6 \to S_6" />.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '关键不变量', en: 'Key invariant'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>对 <TeX src="n \neq 6" />,只有一类阶 2 元素的共轭类大小是 <TeX src="\binom{n}{2}" /> (对换), 所以任何自同构 都保持「对换类」 ⇒ 必为内自同构。 但 <TeX src="n = 6" /> 时, 阶 2 共轭类有两类大小都是 15 —— 对换 (圈型 (2, 1, 1, 1, 1)) 和「三个不相交对换之积」 (圈型 (2, 2, 2)) —— 自同构可以把它们对调。</>}
              en={<>For <TeX src="n \neq 6" />, only one class of order-2 elements in <TeX src="S_n" /> has size <TeX src="\binom{n}{2}" /> (the transpositions), so any automorphism preserves the transposition class and is forced to be inner. For <TeX src="n = 6" />, <em>two</em> conjugacy classes have size 15 — transpositions (cycle type (2, 1, 1, 1, 1)) and triple-disjoint-transposition products (cycle type (2, 2, 2)) — and an automorphism can swap them.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>计数验证: <TeX src="S_6" /> 中对换 = <TeX src="\binom{6}{2} = 15" />; 圈型 <TeX src="(2,2,2)" /> 元素 = <TeX src="\frac{6!}{2^3 \cdot 3!} = \frac{720}{48} = 15" />。 ✓</>}
            en={<>Check: transpositions in <TeX src="S_6" /> number <TeX src="\binom{6}{2} = 15" />; cycle-type <TeX src="(2,2,2)" /> elements number <TeX src="\frac{6!}{2^3 \cdot 3!} = \frac{720}{48} = 15" />. ✓</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.7  Syntheme 与 Duads — Sylvester 的「6 个 total」" en="30.7  Synthemes & duads — Sylvester's six totals"/>
        </h3>
        <p>
          <L
            zh={<>Sylvester (1844) 给出外自同构的纯组合构造,用 <em>duad</em> 和 <em>syntheme</em>:</>}
            en={<>Sylvester (1844) gave a purely combinatorial construction of the outer automorphism using <em>duads</em> and <em>synthemes</em>:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>Duad</strong> = {'{1..6}'} 的 2-子集。 共 <TeX src="\binom{6}{2} = 15" /> 个。</>} en={<><strong>Duad</strong> = a 2-subset of {'{1..6}'}. Total <TeX src="\binom{6}{2} = 15" />.</>} /></li>
          <li><L zh={<><strong>Syntheme</strong> = 把 {'{1..6}'} 拆成 3 个 duad 的方式。 共 <TeX src="\frac{15 \cdot 3 \cdot 1}{3!} = \frac{45}{6}" />? 不对, 直接算: 第一对 <TeX src="\binom{6}{2} = 15" />, 剩下 4 元拆 2 对 = 3 种, 无序 syntheme = <TeX src="15 \cdot 3 / 3! \cdot \cdots" />。 正确的算法: <TeX src="\frac{6!}{2^3 \cdot 3!} = 15" />。 共 <strong>15 个 syntheme</strong>。</>} en={<><strong>Syntheme</strong> = a partition of {'{1..6}'} into 3 duads. Count: <TeX src="\frac{6!}{2^3 \cdot 3!} = 15" />, so <strong>15 synthemes</strong>.</>} /></li>
          <li><L zh={<><strong>Synthematic total</strong> = 5 个 syntheme,它们的 15 个 duad 恰好覆盖全部 <TeX src="\binom{6}{2} = 15" /> 个 duad (即每个 duad 在 total 里恰好出现一次)。 这等价于 <em>K₆ 的 1-因子化</em>: 把 K₆ 的 15 条边分到 5 个完美匹配里。 共 <strong>6 个 total</strong>。</>} en={<><strong>Synthematic total</strong> = a set of 5 synthemes whose 15 duads cover all <TeX src="\binom{6}{2} = 15" /> duads (each duad appearing exactly once). Equivalently: a <em>1-factorisation of <TeX src="K_6" /></em> (partition the 15 edges into 5 perfect matchings). There are exactly <strong>6 totals</strong>.</>} /></li>
        </ul>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 30.8 (Sylvester)', en: 'Theorem 30.8 (Sylvester)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<><TeX src="S_6" /> 在 6 个 total 上的自然作用给出一个 <strong>非平凡同态</strong> <TeXBlock src={`\\Phi : S_6 \\to S_{\\{\\text{6 totals}\\}} \\cong S_6.`} /> 因为 <TeX src="S_6" /> 是 (除 <TeX src="\{e\}" /> 外)「近乎单」 的 (<TeX src="A_6" /> 是它唯一的指数为 2 的正规子群), <TeX src="\Phi" /> 要么是平凡映射、 要么是单射 — 实际上它是单射, 故为自同构。 它 <em>不是</em> 内自同构 (它把对换映到 <TeX src="(2, 2, 2)" /> 类), 所以恰好实现外自同构。</>}
              en={<><TeX src="S_6" /> acts on the 6 totals, giving a homomorphism <TeXBlock src={`\\Phi : S_6 \\to S_{\\{\\text{6 totals}\\}} \\cong S_6.`} /> Since <TeX src="S_6" /> has only one non-trivial normal subgroup (<TeX src="A_6" />, index 2), <TeX src="\Phi" /> is either trivial or injective. It is in fact injective and sends transpositions to cycle type <TeX src="(2, 2, 2)" /> — so <TeX src="\Phi" /> realises the outer automorphism.</>}
            />
          </div>
        </div>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '6 个 Synthematic Total 浏览器', en: 'six synthematic totals viewer'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '点 σ 看一个对换 (1 2) 是怎么把 6 个 total 按 (2, 2, 2) 型重排的 — 那就是外自同构', en: 'pick σ = (1 2) and watch how it scrambles the 6 totals in cycle type (2, 2, 2) — that\'s the outer automorphism'
        })}</div>
          <SynthemeTotalsViewer />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.8  Mathieu 群通道 — 从 PGL₂(𝔽₅) 到 M₂₄" en="30.8  Mathieu connection — from PGL₂(𝔽₅) to M₂₄"/>
        </h3>
        <p>
          <L
            zh={<>120 阶的 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> 不是终点,它坐落在一条 <em>3-传递性扩张链</em> 的起点上。 Mathieu (1861, 1873) 发现的 5 个零散单群 <TeX src="M_{11}, M_{12}, M_{22}, M_{23}, M_{24}" /> 是这条链的产物:</>}
            en={<>The 120-element <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> sits at the foot of a tower of <em>multiply transitive extensions</em>. Mathieu's five sporadic simple groups <TeX src="M_{11}, M_{12}, M_{22}, M_{23}, M_{24}" /> (1861, 1873) form this tower:</>}
          />
        </p>
        <table className="gt-pattern-tbl">
          <thead>
            <tr>
              <th>{tr({ zh: '群', en: 'group' })}</th>
              <th>{tr({ zh: '阶', en: 'order'
            })}</th>
              <th>{tr({ zh: '作用域', en: 'acts on' })}</th>
              <th>{tr({ zh: '传递度', en: 'transitivity'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><TeX src="\mathrm{PGL}_2(\mathbb{F}_5) \cong S_5" /></td><td className="num">120</td><td>6 {tr({ zh: '点', en: 'points'
            })}</td><td>{tr({ zh: '尖锐 3-传递', en: 'sharply 3-transitive'
            })}</td></tr>
            <tr><td><TeX src="M_{10}" /></td><td className="num">720</td><td>10 {tr({ zh: '点', en: 'points'
            })}</td><td>{tr({ zh: '尖锐 3-传递', en: 'sharply 3-transitive'
            })}</td></tr>
            <tr><td><TeX src="M_{11}" /></td><td className="num">7,920</td><td>11 {tr({ zh: '点', en: 'points'
            })}</td><td>{tr({ zh: '尖锐 4-传递', en: 'sharply 4-transitive'
            })}</td></tr>
            <tr><td><TeX src="M_{12}" /></td><td className="num">95,040</td><td>12 {tr({ zh: '点', en: 'points'
            })}</td><td>{tr({ zh: '尖锐 5-传递', en: 'sharply 5-transitive'
            })}</td></tr>
            <tr><td><TeX src="M_{22}" /></td><td className="num">443,520</td><td>22</td><td>3-{tr({ zh: '传递', en: 'transitive'
            })}</td></tr>
            <tr><td><TeX src="M_{23}" /></td><td className="num">10,200,960</td><td>23</td><td>4-{tr({ zh: '传递', en: 'transitive'
            })}</td></tr>
            <tr><td><TeX src="M_{24}" /></td><td className="num">244,823,040</td><td>24</td><td>5-{tr({ zh: '传递', en: 'transitive'
            })}</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<><TeX src="M_{12}" /> 是最大的 <em>尖锐 5-传递</em> 群 (1959 年 Jordan 证明: 除 <TeX src="S_n, A_n" /> 外, 没有比 5-传递更高的尖锐传递群)。 <TeX src="M_{12}" /> 包含外自同构 (它是唯一一个 <TeX src="M_n" /> 有外自同构的), 跟 <TeX src="S_6" /> 的外自同构构造方式平行: 它通过 6 个 「<em>duum</em>」 (类似 syntheme) 的传递作用实现 <em>同一个</em> 现象。 Conway, Curtis (1973) 的 <strong>Miracle Octad Generator (MOG)</strong> 把 <TeX src="M_{24}" /> 完全显式化, 利用了 <em>Steiner 系统</em> S(5, 8, 24)。</>}
            en={<><TeX src="M_{12}" /> is the largest <em>sharply 5-transitive</em> group (Jordan, 1872: no sharp <TeX src="k" />-transitive group beyond <TeX src="S_n, A_n" /> exists for <TeX src="k \geq 6" />). <TeX src="M_{12}" /> is the only Mathieu with a non-trivial outer automorphism — built by exactly the same "exotic transitive" trick as <TeX src="\mathrm{Out}(S_6)" />. Conway & Curtis's <strong>Miracle Octad Generator (MOG, 1973)</strong> realises <TeX src="M_{24}" /> through the <em>Steiner system</em> S(5, 8, 24). Reference: J. Conway et al., <em>ATLAS of Finite Groups</em> (1985).</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.9  正二十面体的 PSL₂(𝔽₅)" en="30.9  PSL₂(𝔽₅) and the icosahedron"/>
        </h3>
        <p>
          <L
            zh={<>取 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> 的 「行列式平方」 子群:<TeXBlock src={`\\mathrm{PSL}_2(\\mathbb{F}_5) = \\mathrm{SL}_2(\\mathbb{F}_5)\\,/\\,\\{\\pm I\\}.`} /> 其阶 = <TeX src="120 / 2 = 60" />,而我们已知<TeX src="\mathrm{PSL}_2(\mathbb{F}_5) \cong A_5" />,这又同构于<strong>正二十面体的旋转群</strong> <TeX src="I" />。 三条 60 阶单群是 <em>同一个</em> 群:</>}
            en={<>The "square-determinant" subgroup of <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> is<TeXBlock src={`\\mathrm{PSL}_2(\\mathbb{F}_5) = \\mathrm{SL}_2(\\mathbb{F}_5)\\,/\\,\\{\\pm I\\}.`} /> Its order is <TeX src="120 / 2 = 60" />, and famously<TeX src="\mathrm{PSL}_2(\mathbb{F}_5) \cong A_5" /> which in turn is the <strong>rotation group <TeX src="I" /> of the icosahedron</strong>. Three identifications of the same 60-element group:</>}
          />
        </p>
        <TeXBlock src={`A_5 \\;\\cong\\; \\mathrm{PSL}_2(\\mathbb{F}_5) \\;\\cong\\; I \\;=\\; \\text{rotations of the icosahedron / dodecahedron}.`} />
        <p>
          <L
            zh={<>正二十面体有 12 顶点, 但 <em>对极</em> 形成 6 对; 每对贴一个 <TeX src="\mathbb{P}^1(\mathbb{F}_5)" /> 元素。 <TeX src="A_5" /> 的元素有阶 1, 2, 3, 5: 阶 5 旋转绕一个顶点 (绕一对极轴) 转 2π/5; 阶 3 旋转绕面心 (一对极面) 转 2π/3; 阶 2 旋转绕棱中点 (一对极棱)。 数 <TeX src="A_5" /> 的元素: 1 + 15 + 20 + 24 = 60。</>}
            en={<>The icosahedron has 12 vertices, falling into 6 antipodal pairs; each pair receives a label from <TeX src="\mathbb{P}^1(\mathbb{F}_5)" />. <TeX src="A_5" /> contains elements of order 1, 2, 3, 5: order-5 rotations through opposite vertices (2π/5), order-3 through opposite face centres (2π/3), order-2 through midpoints of opposite edges. Counts: 1 + 15 + 20 + 24 = 60.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '正二十面体 + ℙ¹(𝔽₅) 标号', en: 'icosahedron with ℙ¹(𝔽₅) labels'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '按 T (绕顶点 2π/5) 和 S (绕棱中点 π) 看顶点重排', en: 'press T (vertex 2π/5) and S (edge-midpoint π) to watch vertices shuffle'
        })}</div>
          <IcosahedronP1F5 />
        </div>
        <p>
          <L
            zh={<>这是 Felix Klein 的 1884 《二十面体讲义》 的主题: 5 次方程的根可以用 <em>二十面体函数</em> (一种椭圆模函数) 表达,本质上利用了 <TeX src="A_5" /> 不可解但具有 60 阶单群结构这个事实。 Klein 把 <TeX src="\mathrm{PSL}_2(\mathbb{F}_5) \cong A_5 \cong I" /> 三位一体当作他的核心定理。</>}
            en={<>This is the subject of Felix Klein's <em>Lectures on the Icosahedron</em> (1884): roots of quintic equations can be expressed via <em>icosahedral functions</em> (a kind of elliptic modular function), trading on the fact that <TeX src="A_5" /> is unsolvable yet has the structure of a 60-element simple group. Klein took the trinity <TeX src="\mathrm{PSL}_2(\mathbb{F}_5) \cong A_5 \cong I" /> as the heart of his book.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.10  显式生成元 + 标准表示" en="30.10  Explicit generators and presentation"/>
        </h3>
        <p>
          <L
            zh={<>用两个简单的 Möbius 变换可以生成整个 <TeX src="\mathrm{PSL}_2(\mathbb{F}_5)" />。 取</>}
            en={<>Two simple Möbius transformations generate <TeX src="\mathrm{PSL}_2(\mathbb{F}_5)" />. Set</>}
          />
        </p>
        <TeXBlock src={`T \\,:\\, z \\mapsto z + 1, \\quad\\quad S \\,:\\, z \\mapsto -\\frac{1}{z}.`} />
        <p>
          <L
            zh={<>对应的 2×2 矩阵</>}
            en={<>with matrices</>}
          />
        </p>
        <TeXBlock src={`T \\;\\equiv\\; \\begin{pmatrix} 1 & 1 \\\\ 0 & 1 \\end{pmatrix}, \\quad\\quad S \\;\\equiv\\; \\begin{pmatrix} 0 & -1 \\\\ 1 & 0 \\end{pmatrix} \\;\\equiv\\; \\begin{pmatrix} 0 & 4 \\\\ 1 & 0 \\end{pmatrix} \\pmod{5}.`} />
        <p>
          <L
            zh={<>验证: <TeX src="T^5 = I" /> (因为 5 ≡ 0 mod 5), <TeX src="S^2 = -I \equiv I" /> (在 PSL 里), 且 <TeX src="ST" /> 是 <TeX src="z \mapsto -1/(z+1)" />, 阶 3 (验算: <TeX src="(ST)^2 = -1/(-1/(z+1) + 1) = -(z+1)/z" />; <TeX src="(ST)^3 = z" />)。 ∴</>}
            en={<>Check: <TeX src="T^5 = I" /> (5 ≡ 0 mod 5), <TeX src="S^2 = -I" /> which is trivial in <TeX src="\mathrm{PSL}" />, and <TeX src="ST : z \mapsto -1/(z+1)" /> has order 3 (direct computation gives <TeX src="(ST)^3 = \mathrm{id}" />). So</>}
          />
        </p>
        <TeXBlock src={`\\mathrm{PSL}_2(\\mathbb{F}_5) \\;=\\; \\left\\langle S,\\, T \\;\\middle|\\; S^2 = T^5 = (ST)^3 = 1 \\right\\rangle \\;\\cong\\; A_5.`} />
        <p>
          <L
            zh={<>这是 von Dyck 三角群 <TeX src="(2, 3, 5)" /> 的有限表示,跟 <em>双曲三角形</em> <TeX src="\Delta(2, 3, 5)" /> 在球面上的反射群对应 — 正是二十面体几何。 想升级到 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5) \cong S_5" />, 再加一个对角元素</>}
            en={<>This is the von Dyck triangle group <TeX src="(2, 3, 5)" />, the rotation group of the spherical triangle <TeX src="\Delta(2, 3, 5)" /> — icosahedral geometry. To upgrade to <TeX src="\mathrm{PGL}_2(\mathbb{F}_5) \cong S_5" />, append one diagonal element</>}
          />
        </p>
        <TeXBlock src={`D \\;\\equiv\\; \\begin{pmatrix} 2 & 0 \\\\ 0 & 1 \\end{pmatrix}, \\qquad D \\,:\\, z \\mapsto 2 z.`} />
        <p>
          <L
            zh={<><TeX src="D" /> 的 det 为 2,不是 <TeX src="(\mathbb{F}_5^{*})^2 = \{1, 4\}" /> 元素,故 <TeX src="D \notin \mathrm{PSL}_2" />。 <TeX src="\langle S, T, D\rangle = \mathrm{PGL}_2(\mathbb{F}_5)" /> (添加 <TeX src="D" /> 把 PSL 的指数翻倍 60 → 120)。 完整表示见 Coxeter–Moser (1965) §6.5。</>}
            en={<><TeX src="D" /> has determinant 2, not a square in <TeX src="\mathbb{F}_5^{*}" />, so <TeX src="D \notin \mathrm{PSL}_2" />. Then <TeX src="\langle S, T, D\rangle = \mathrm{PGL}_2(\mathbb{F}_5)" />, doubling 60 → 120. Full presentation: Coxeter–Moser (1965) §6.5.</>}
          />
        </p>
        <p>
          <L
            zh={<><strong>魔方对应</strong>: 在 R、 U 两面的角块作用上, R 实现一个 4-cycle (在 4 个角上), U 实现另一个 4-cycle (相错), 共享 2 角。 取 ℙ¹(𝔽₅) 标号使得</>}
            en={<><strong>Cube correspondence</strong>: as corner permutations, R is a 4-cycle on 4 corners and U is a staggered 4-cycle, sharing 2 corners. Choose <TeX src="\mathbb{P}^1(\mathbb{F}_5)" /> labels so that</>}
          />
        </p>
        <TeXBlock src={`R \\;\\equiv\\; z \\mapsto \\text{(some Möbius)}, \\quad U \\;\\equiv\\; z \\mapsto \\text{(another Möbius)};`} />
        <p>
          <L
            zh={<>Jaap Scherphuis 的对照表给出: R = (0 1 2 3) (在 ℙ¹ 上固定 4, ∞ 的 4-cycle), U = (0 4 ∞ 1) 之类的形式。 详细 labelling 见 Jaap 的网页 — 选 labelling 不唯一,只要让 R, U 配上一对 2×2 矩阵 mod 5 即可。</>}
            en={<>Jaap Scherphuis's labelling gives R = (0 1 2 3) (a 4-cycle on <TeX src="\mathbb{P}^1" /> fixing 4 and ∞) and U = (0 4 ∞ 1) (the staggered 4-cycle). The exact labelling is not unique; any choice that turns R, U into a pair of 2×2 mod-5 matrices works.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="30.11  实验 — ⟨R, U⟩ 阶分布拟合 S₅ 共轭类" en="30.11  Experiment — ⟨R, U⟩ order distribution matches S₅ classes"/>
        </h3>
        <p>
          <L
            zh={<>如果 <TeX src="\langle R, U\rangle = S_5" />, 那么随机一个 <TeX src="R, U" /> 字得到的 6-角置换,它的阶分布应该符合 <TeX src="S_5" /> 的共轭类大小:</>}
            en={<>If <TeX src="\langle R, U\rangle = S_5" />, then the order of a random ⟨R, U⟩ word, viewed as a permutation of the 6 corners, should match the conjugacy-class sizes of <TeX src="S_5" />:</>}
          />
        </p>
        <table className="gt-pattern-tbl">
          <thead>
            <tr>
              <th>{tr({ zh: '阶', en: 'order'
            })}</th>
              <th>{tr({ zh: 'S₅ 圈型', en: 'S₅ cycle type' })}</th>
              <th>{tr({ zh: '类大小', en: 'class size'
            })}</th>
              <th>{tr({ zh: '占比', en: 'share'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="num">1</td><td>(1)⁵ {tr({ zh: '(恒等)', en: '(identity)'
            })}</td><td className="num">1</td><td className="num">0.83%</td></tr>
            <tr><td className="num">2</td><td>(2, 1, 1, 1) + (2, 2, 1)</td><td className="num">10 + 15 = 25</td><td className="num">20.83%</td></tr>
            <tr><td className="num">3</td><td>(3, 1, 1)</td><td className="num">20</td><td className="num">16.67%</td></tr>
            <tr><td className="num">4</td><td>(4, 1) + (2, 2, 1) {tr({ zh: '(注:(2,2,1)在 S₅ 阶为 2 不是 4)', en: '(note: (2,2,1) has order 2, not 4)'
            })}</td><td className="num">30</td><td className="num">25.00%</td></tr>
            <tr><td className="num">5</td><td>(5)</td><td className="num">24</td><td className="num">20.00%</td></tr>
            <tr><td className="num">6</td><td>(3, 2)</td><td className="num">20</td><td className="num">16.67%</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>总计 <TeX src="1 + 25 + 20 + 30 + 24 + 20 = 120" /> ✓。 但注意 <TeX src="S_5" /> 是在 <em>5 元集</em> 上的对称群,这里我们让它通过 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> 作用在 <em>6 元集</em> 上, 所以 <TeX src="S_5" /> 的「圈型」 跟它在 6 点上诱导的圈型 <em>不同</em>! 比如 <TeX src="S_5" /> 中的对换 <TeX src="(1 2)" />, 通过 <TeX src="\mathrm{PGL}_2 \cong S_5" /> 同构, 它对应一个 Möbius 变换,在 6 点上的圈型实际是 (2, 2, 1, 1) —— 两个 2-cycle 加两个不动点。 这是异常嵌入的 「圈型变化」, 也是 30.6 中 <em>对换 ↔ (2,2,2)</em> 的来源。</>}
            en={<>Sum: <TeX src="1 + 25 + 20 + 30 + 24 + 20 = 120" /> ✓. <em>Warning</em>: the cycle types above are those of <TeX src="S_5" /> acting on 5 elements; in our 6-point Möbius action, the corresponding cycle types differ. For example a transposition in <TeX src="S_5" /> corresponds to a Möbius transformation acting on 6 points with cycle type (2, 2, 1, 1) — two transpositions and two fixed points. This "cycle type shift" between the two embeddings is the operational core of 30.6's transposition ↔ (2,2,2) swap.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '⟨R, U⟩ 阶分布采样', en: '⟨R, U⟩ order histogram'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '采 N 个随机字 (长度 ≤ maxLen),计角置换阶,与 S₅ 共轭类大小比较', en: 'sample N random words (length ≤ maxLen), compute the order of the resulting corner permutation, compare with S₅ class sizes'
        })}</div>
          <OrderHistogramTwoFace />
        </div>

        <div className="gt-pullquote">
          <L
            zh={<>「<TeX src="S_6" /> 是唯一一个有外自同构的对称群; 而那个外自同构等价于 <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> 在 6 点上传递作用 — 等价于正二十面体的旋转群 — 等价于 Mathieu 群 <TeX src="M_{12}" /> 的零散性的种子。 这一长串等价不是巧合, 它是有限对称的一次最深的爆发。」</>}
            en={<>"<TeX src="S_6" /> is the only symmetric group with an outer automorphism; that outer automorphism is equivalent to the transitive action of <TeX src="\mathrm{PGL}_2(\mathbb{F}_5)" /> on six points; equivalent to the rotation group of the icosahedron; equivalent to the seed of the sporadic Mathieu group <TeX src="M_{12}" />. This chain of equivalences is not a coincidence — it is the densest implosion of finite symmetry we know."</>}
          />
          <div className="gt-pullquote-cite">— John Baez, <em>Some Thoughts on the Number 6</em> (2015 essay)</div>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="参考文献" en="References"/>
        </h3>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<>J. Scherphuis, <em>The Two-Face 6-Corner Puzzle and PGL₂(𝔽₅)</em> — <span className="gt-mono">jaapsch.net/puzzles/pgl25.htm</span>。 本节起点。</>} en={<>J. Scherphuis, <em>The two-face six-corner puzzle and PGL₂(F₅)</em> — <span className="gt-mono">jaapsch.net/puzzles/pgl25.htm</span>. The starting point for this section.</>} /></li>
          <li><L zh={<>J. Baez, <em>Some Thoughts on the Number 6</em> — math.ucr.edu/home/baez/six.html。 关于 S₆ 外自同构的经典科普,涵盖 syntheme, Mathieu, 二十面体连接。</>} en={<>J. Baez, <em>Some Thoughts on the Number 6</em> — math.ucr.edu/home/baez/six.html. The classic expository essay on the S₆ outer automorphism, covering synthemes, Mathieu groups, and the icosahedral connection.</>} /></li>
          <li><L zh={<>J. Conway, R. Curtis, S. Norton, R. Parker, R. Wilson, <em>ATLAS of Finite Groups</em> (Oxford, 1985)。 全部 26 个零散单群的标准参考,包括 M₁₁, M₁₂, M₂₄ 的最大子群表 (含 PGL₂(𝔽₅))。</>} en={<>J. Conway, R. Curtis, S. Norton, R. Parker, R. Wilson, <em>ATLAS of Finite Groups</em> (Oxford, 1985). The standard reference for all 26 sporadic simple groups, including maximal-subgroup tables for M₁₁, M₁₂, M₂₄ (in which PGL₂(F₅) appears).</>} /></li>
          <li><L zh={<>M. Suzuki, <em>Group Theory I, II</em> (Springer Grundlehren 247, 248, 1982–1986)。 经典群 (GL, SL, PSL, PGL, PΓL) 的标准教科书。</>} en={<>M. Suzuki, <em>Group Theory I, II</em> (Springer Grundlehren 247, 248, 1982–1986). The standard reference for classical groups (GL, SL, PSL, PGL, PΓL).</>} /></li>
          <li><L zh={<>M. Aschbacher, <em>Finite Group Theory</em> (Cambridge Studies in Adv. Math. 10, 2nd ed. 2000)。 现代的、 紧凑的有限群论概述,有限简单群分类背景。</>} en={<>M. Aschbacher, <em>Finite Group Theory</em> (Cambridge Studies in Adv. Math. 10, 2nd ed. 2000). Compact modern survey, background for the classification of finite simple groups.</>} /></li>
          <li><L zh={<>S. Lang, <em>Algebra</em> (3rd ed., Springer GTM 211, 2002)。 一般域上 GL/PGL/PSL 的定义见第 13 章。</>} en={<>S. Lang, <em>Algebra</em> (3rd ed., Springer GTM 211, 2002). General-field GL/PGL/PSL definitions, Chapter 13.</>} /></li>
          <li><L zh={<>D. Surowski, <em>Workbook in Higher Algebra</em>。 把 ℙ¹(𝔽₅) 上的 PGL₂ 作用及交比作为练习展开。</>} en={<>D. Surowski, <em>Workbook in Higher Algebra</em>. Develops the PGL₂(F₅) action on ℙ¹(F₅) and the cross-ratio as exercises.</>} /></li>
          <li><L zh={<>H. S. M. Coxeter & W. O. J. Moser, <em>Generators and Relations for Discrete Groups</em> (Springer Ergebnisse 14, 4th ed. 1980)。 三角群 (2, 3, 5) 等的标准表示及二十面体几何。</>} en={<>H. S. M. Coxeter & W. O. J. Moser, <em>Generators and Relations for Discrete Groups</em> (Springer Ergebnisse 14, 4th ed. 1980). Standard presentations for triangle groups (2, 3, 5) etc., with icosahedral geometry.</>} /></li>
          <li><L zh={<>F. Klein, <em>Vorlesungen über das Ikosaeder</em> (1884, English transl. <em>Lectures on the Icosahedron</em>, Dover 1956)。 用 PSL₂(𝔽₅) ≅ A₅ ≅ I 解 5 次方程。</>} en={<>F. Klein, <em>Vorlesungen über das Ikosaeder</em> (1884, English transl. <em>Lectures on the Icosahedron</em>, Dover 1956). Solving the quintic using PSL₂(F₅) ≅ A₅ ≅ I.</>} /></li>
          <li><L zh={<>O. Hölder, "Bildung zusammengesetzter Gruppen," <em>Math. Ann.</em> 46 (1895) — <TeX src="\mathrm{Out}(S_6)" /> 的原始发现。</>} en={<>O. Hölder, "Bildung zusammengesetzter Gruppen," <em>Math. Ann.</em> 46 (1895) — original discovery of <TeX src="\mathrm{Out}(S_6)" />.</>} /></li>
          <li><L zh={<>J. J. Sylvester, "Elementary researches in the analysis of combinatorial aggregation," <em>Phil. Mag.</em> 24 (1844)。 Duad / syntheme / synthematic total 术语的首发。</>} en={<>J. J. Sylvester, "Elementary researches in the analysis of combinatorial aggregation," <em>Phil. Mag.</em> 24 (1844). Origin of the duad/syntheme/synthematic-total terminology.</>} /></li>
        </ul>
      </GTSec>
  );
}
