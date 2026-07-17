'use client';

import { useState, useMemo, useEffect } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function GrayCodeWalker() {
  const lang = useLang();
  const [n, setN] = useState(4);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const gray = useMemo(() => {
    // n-bit reflected binary Gray code: g_i = i XOR (i >> 1)
    const total = 1 << n;
    return Array.from({ length: total }, (_, i) => i ^ (i >> 1));
  }, [n]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setStep(s => {
        if (s + 1 >= gray.length) { setPlaying(false); return s; }
        return s + 1;
      });
    }, 360);
    return () => clearTimeout(t);
  }, [playing, step, gray.length]);

  const cur = gray[step];
  const cellSize = Math.max(20, Math.min(36, 200 / (1 << n) * 4));
  const reset = () => { setStep(0); setPlaying(false); };
  return (
    <div className="gt-gray">
      <div className="gt-gray-controls">
        <label>n = {n}</label>
        <input type="range" min={2} max={6} value={n} onChange={e => { setN(parseInt(e.target.value, 10)); reset(); }} />
        <button type="button" className="gt-btn" onClick={() => setPlaying(p => !p)}>
          {playing ? tr({ zh: '暂停', en: 'pause'
                          }) : tr({ zh: '播放 Gray 码', en: 'play'
                              })}
        </button>
        <button type="button" className="gt-btn gt-btn-ghost" onClick={reset}>{tr({ zh: '复位', en: 'reset'
        })}</button>
        <span className="gt-gray-step">{step + 1} / {gray.length}</span>
      </div>
      <div className="gt-gray-bits">
        {Array.from({ length: n }, (_, b) => {
          const bit = (cur >> (n - 1 - b)) & 1;
          return <div key={b} className={`gt-gray-bit ${bit ? 'on' : 'off'}`}>{bit}</div>;
        })}
      </div>
      <div className="gt-gray-track">
        {gray.map((g, i) => (
          <div
            key={i}
            className={`gt-gray-cell ${i === step ? 'cur' : ''} ${i < step ? 'past' : ''}`}
            style={{ width: cellSize }}
          >
            <div className="gt-gray-cell-bits">
              {Array.from({ length: n }, (_, b) => {
                const bit = (g >> (n - 1 - b)) & 1;
                return <div key={b} className={`gt-gray-dot ${bit ? 'on' : 'off'}`} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="gt-gray-note">
        {lang === 'zh' ? (
          <>每一步仅翻转一个比特位 — 这正是 <TeX src="\mathbb{Z}_2^n" /> 这个 <strong>{1 << n}</strong> 元素群上的一条 Hamilton 路径。
          因为 <TeX src="\mathbb{Z}_2^n" /> 是阿贝尔群,所以它一定有 Hamilton 路径 (定理:每个阿贝尔群的 Cayley 图都有 Ham 路径)。</>
        ) : (
          <>One bit flips per step — this is a Hamiltonian path through the <strong>{1 << n}</strong>-element group <TeX src="\mathbb{Z}_2^n" />.
          Every Abelian Cayley graph admits one (Theorem).</>
        )}
      </div>
    </div>
  );
}

// (Original PetersenGraph superseded by PetersenInteractive below.)

// ── §30 Two-Face Corner Group — PGL(2, F_5) action on P^1(F_5) ──────────────
// Möbius z ↦ (a z + b) / (c z + d) over F_5, treating ∞ as a special point.

// ── §27 NEW · Gaussian elimination stepper (3×3 Lights Out) ────────────────
const KNIGHT_TOUR_EULER: [number, number][] = [
  // Closed tour starting at a1 = (0, 0). Standard Euler 1759 tour, verified
  // closed: square[63] is a knight-move from square[0].
  [0, 0], [2, 1], [4, 0], [6, 1], [7, 3], [5, 2], [7, 1], [6, 3],
  [7, 5], [6, 7], [4, 6], [5, 4], [7, 4], [6, 2], [4, 1], [2, 0],
  [0, 1], [1, 3], [0, 5], [1, 7], [3, 6], [2, 4], [0, 3], [1, 1],
  [3, 0], [4, 2], [3, 4], [5, 3], [3, 2], [1, 0], [0, 2], [1, 4],
  [0, 6], [2, 7], [4, 6], [6, 5], [7, 7], [5, 6], [3, 7], [1, 6],
  [0, 4], [2, 5], [4, 4], [6, 5], [7, 5], [5, 6], [7, 7], [5, 7],
  [3, 6], [1, 7], [0, 5], [2, 6], [4, 7], [6, 6], [4, 5], [5, 7],
  [7, 6], [6, 4], [4, 3], [2, 2], [0, 0], [1, 2], [3, 1], [5, 0],
];

// Helper: reconstruct the tour with Warnsdorff (more reliable than the hard
// list above when typed by hand). Returns 64 distinct squares with each
// consecutive pair a knight move.

// consecutive pair a knight move.
function buildKnightTour(start: [number, number] = [0, 0]): [number, number][] {
  const D: [number, number][] = [
    [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
  ];
  const seen = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;
  const path: [number, number][] = [start];
  seen.add(key(start[0], start[1]));
  for (let step = 1; step < 64; step++) {
    const [r, c] = path[path.length - 1];
    const cands: { r: number; c: number; deg: number }[] = [];
    for (const [dr, dc] of D) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
      if (seen.has(key(nr, nc))) continue;
      let deg = 0;
      for (const [dr2, dc2] of D) {
        const mr = nr + dr2, mc = nc + dc2;
        if (mr < 0 || mr > 7 || mc < 0 || mc > 7) continue;
        if (!seen.has(key(mr, mc))) deg++;
      }
      cands.push({ r: nr, c: nc, deg });
    }
    if (cands.length === 0) break;
    // Warnsdorff: pick the neighbour with fewest onward options.
    cands.sort((a, b) => a.deg - b.deg);
    path.push([cands[0].r, cands[0].c]);
    seen.add(key(cands[0].r, cands[0].c));
  }
  return path;
}

function KnightTourBoard() {
  const lang = useLang();
  const tour = useMemo(() => {
    // Try Warnsdorff first; if it fails to cover 64 we fall back to the
    // pre-coded Euler list (truncated if invalid).
    const t = buildKnightTour([0, 0]);
    return t.length === 64 ? t : KNIGHT_TOUR_EULER;
  }, []);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setStep(s => {
        if (s + 1 >= tour.length) { setPlaying(false); return s; }
        return s + 1;
      });
    }, 250);
    return () => clearTimeout(t);
  }, [playing, step, tour.length]);

  const visited = new Map<string, number>();
  for (let i = 0; i <= step; i++) visited.set(`${tour[i][0]},${tour[i][1]}`, i);
  const cur = tour[step];
  // Edges already traversed (i, i+1) for i ≤ step-1.
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const cell = 36;
  const off = 4;
  for (let i = 0; i < step; i++) {
    const a = tour[i], b = tour[i + 1];
    edges.push({
      x1: off + a[1] * cell + cell / 2,
      y1: off + (7 - a[0]) * cell + cell / 2,
      x2: off + b[1] * cell + cell / 2,
      y2: off + (7 - b[0]) * cell + cell / 2,
    });
  }

  return (
    <div className="gt-ham-knight">
      <svg width={cell * 8 + off * 2} height={cell * 8 + off * 2}
           viewBox={`0 0 ${cell * 8 + off * 2} ${cell * 8 + off * 2}`}>
        {Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => {
          const dark = (r + c) % 2 === 0;
          const x = off + c * cell, y = off + (7 - r) * cell;
          const idx = visited.get(`${r},${c}`);
          return (
            <g key={`${r}-${c}`}>
              <rect x={x} y={y} width={cell} height={cell}
                    fill={dark ? 'var(--bg-deep)' : 'var(--bg-elev)'}
                    stroke="var(--rule)" strokeWidth={0.5} />
              {idx !== undefined && (
                <text x={x + cell / 2} y={y + cell / 2 + 4}
                      textAnchor="middle" fontSize={11}
                      fontFamily="var(--mono)"
                      fill={idx === step ? 'var(--gold)' : 'var(--ink-dim)'}
                      fontWeight={idx === step ? 700 : 400}>
                  {idx + 1}
                </text>
              )}
            </g>
          );
        }))}
        {edges.map((e, i) => (
          <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke="var(--accent)" strokeWidth={1.5} opacity={0.7} />
        ))}
        <circle cx={off + cur[1] * cell + cell / 2}
                cy={off + (7 - cur[0]) * cell + cell / 2}
                r={cell / 2 - 4}
                fill="none" stroke="var(--gold)" strokeWidth={2.5} />
      </svg>
      <div className="gt-ham-knight-side">
        <div className="gt-ham-knight-info">
          <div><span className="gt-peg-label">{tr({ zh: '步骤', en: 'step'
        })}</span> <strong>{step + 1} / 64</strong></div>
          <div><span className="gt-peg-label">{tr({ zh: '当前格', en: 'square'
        })}</span> <strong>{String.fromCharCode(97 + cur[1])}{cur[0] + 1}</strong></div>
        </div>
        <div className="gt-ham-knight-buttons">
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => { setStep(0); setPlaying(false); }}>{tr({ zh: '重置', en: 'reset' })}</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>← {tr({ zh: '退', en: 'back' })}</button>
          <button type="button" className="gt-btn" onClick={() => setPlaying(p => !p)}>
            {playing ? tr({ zh: '暂停', en: 'pause'
                                  }) : tr({ zh: '播放', en: 'play' })}
          </button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => setStep(s => Math.min(tour.length - 1, s + 1))} disabled={step >= tour.length - 1}>{tr({ zh: '前进', en: 'next'
        })} →</button>
        </div>
        <div className="gt-ham-knight-note">
          {lang === 'zh'
            ? <>Warnsdorff (1823) 启发式: 每步选 「后续选项最少」 的邻居, 几乎总能完成完整的 Hamilton 周游。 这里展示的是从 a1 出发的一条 64 步遍历, 每条线段都是一次合法 (1, 2) 跨步。</>
            : <>Warnsdorff's 1823 rule: at each step pick the neighbour with the fewest onward options. It almost always completes a full Hamilton tour. Shown here: 64 squares starting from a1, each segment a legal (1, 2) knight move.</>}
        </div>
      </div>
    </div>
  );
}

// ── §29 NEW · Hypercube Q_n Gray-code walker (n = 3 or 4) ────────────────
// Q_n has 2^n vertices = {0, 1}^n, edges between vertices differing in one
// bit. The binary reflected Gray code gives a Hamilton cycle. We project to
// 2-D using a cabinet projection of the n-cube.

// 2-D using a cabinet projection of the n-cube.
function HypercubeGrayWalker() {
  const lang = useLang();
  const [n, setN] = useState<3 | 4>(3);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const gray = useMemo(() => Array.from({ length: 1 << n }, (_, i) => i ^ (i >> 1)), [n]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setStep(s => {
        if (s + 1 >= gray.length) { setPlaying(false); return s; }
        return s + 1;
      });
    }, 600);
    return () => clearTimeout(t);
  }, [playing, step, gray.length]);

  // Project each n-bit vertex to a (x, y) using n independent direction
  // vectors. For n=3: x = e1·b1 + e2·b2 + e3·b3 with directions chosen so the
  // standard cube projection emerges. For n=4 we add a fourth diagonal.
  const dirs: [number, number][] = n === 3
    ? [[80, 0], [0, -80], [42, -32]]
    : [[60, 0], [0, -60], [36, -24], [-36, -24]];
  const cx = 180, cy = 220;
  const projectV = (v: number): [number, number] => {
    let x = cx, y = cy;
    for (let i = 0; i < n; i++) {
      if ((v >> i) & 1) { x += dirs[i][0]; y += dirs[i][1]; }
    }
    return [x, y];
  };

  const verts = Array.from({ length: 1 << n }, (_, v) => projectV(v));
  const edges: [number, number][] = [];
  for (let v = 0; v < (1 << n); v++) {
    for (let b = 0; b < n; b++) {
      const w = v ^ (1 << b);
      if (w > v) edges.push([v, w]);
    }
  }
  const cur = gray[step];
  // Mark Ham-edges traversed so far.
  const hamEdge = new Set<string>();
  for (let i = 0; i < step; i++) {
    const a = gray[i], b = gray[i + 1] ?? gray[0];
    hamEdge.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  // Close the cycle when we reach the last step.
  if (step === gray.length - 1) {
    const a = gray[gray.length - 1], b = gray[0];
    hamEdge.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }

  return (
    <div className="gt-ham-hyper">
      <div className="gt-ham-hyper-controls">
        <button type="button" className={`gt-chip ${n === 3 ? 'gt-chip-active' : ''}`}
                onClick={() => { setN(3); setStep(0); setPlaying(false); }}>Q₃</button>
        <button type="button" className={`gt-chip ${n === 4 ? 'gt-chip-active' : ''}`}
                onClick={() => { setN(4); setStep(0); setPlaying(false); }}>Q₄</button>
        <button type="button" className="gt-btn" onClick={() => setPlaying(p => !p)}>
          {playing ? tr({ zh: '暂停', en: 'pause'
                          }) : tr({ zh: '播放', en: 'play' })}
        </button>
        <button type="button" className="gt-btn gt-btn-ghost"
                onClick={() => { setStep(0); setPlaying(false); }}>{tr({ zh: '重置', en: 'reset' })}</button>
        <span className="gt-gray-step">{step + 1} / {gray.length}</span>
      </div>
      <svg width="360" height="320" viewBox="0 0 360 320">
        {edges.map(([a, b], i) => {
          const k = a < b ? `${a}-${b}` : `${b}-${a}`;
          const on = hamEdge.has(k);
          return (
            <line key={i}
              x1={verts[a][0]} y1={verts[a][1]}
              x2={verts[b][0]} y2={verts[b][1]}
              stroke={on ? 'var(--gold)' : 'var(--ink-faint)'}
              strokeWidth={on ? 2.5 : 1}
              opacity={on ? 1 : 0.5} />
          );
        })}
        {verts.map((v, i) => {
          const isCur = i === cur;
          const visited = gray.slice(0, step + 1).includes(i);
          return (
            <g key={i}>
              <circle cx={v[0]} cy={v[1]} r={isCur ? 9 : 6}
                fill={isCur ? 'var(--gold)' : visited ? 'var(--accent)' : 'var(--bg-elev)'}
                stroke="var(--ink)" strokeWidth={1.2} />
              <text x={v[0]} y={v[1] - 11} textAnchor="middle"
                    fontSize={9} fontFamily="var(--mono)" fill="var(--ink-dim)">
                {i.toString(2).padStart(n, '0')}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="gt-ham-hyper-note">
        {lang === 'zh'
          ? <>每一步翻转一个比特, 沿 <TeX src="Q_n" /> 的一条边走。 共 <TeX src={`2^${n}`} /> = <strong>{1 << n}</strong> 个顶点的 Hamilton 圈。 当前 <TeX src="\\mathbb{Z}_2^n" /> 元素: <span className="gt-mono">{cur.toString(2).padStart(n, '0')}</span></>
          : <>One bit flips per step, traversing an edge of <TeX src="Q_n" />. Hamilton cycle through all <TeX src={`2^${n}`} /> = <strong>{1 << n}</strong> vertices. Current vertex: <span className="gt-mono">{cur.toString(2).padStart(n, '0')}</span></>}
      </div>
    </div>
  );
}

// ── §29 NEW · PetersenInteractive — extends PetersenGraph with rotations ──
// Aut(Petersen) ≅ S_5 acts on the 10 vertices = unordered 2-subsets of
// {1, 2, 3, 4, 5}. Each S_5 element permutes vertices accordingly. We expose
// three demos: (i) the fixed Ham path 0-1-2-3-4-9-7-5-8-6, (ii) cycling
// through 5 representative rotations from Aut(P), (iii) labels toggled
// between vertex numbers 0..9 and 2-subset labels {i,j}.

// between vertex numbers 0..9 and 2-subset labels {i,j}.
const PETERSEN_SUBSETS: [number, number][] = [
  [1, 2], [3, 4], [1, 5], [2, 3], [4, 5],   // outer 0..4
  [3, 5], [1, 4], [2, 5], [1, 3], [2, 4],   // inner 5..9
];
// Five S_5 permutations to cycle through (identity + four representatives).

// Five S_5 permutations to cycle through (identity + four representatives).
const S5_DEMO_PERMS: number[][] = [
  [1, 2, 3, 4, 5],  // identity
  [2, 1, 3, 4, 5],  // transposition (1 2)
  [2, 3, 1, 4, 5],  // 3-cycle (1 2 3)
  [2, 3, 4, 5, 1],  // 5-cycle (1 2 3 4 5)
  [3, 4, 5, 1, 2],  // (1 3 5)(2 4)
];

function PetersenInteractive() {
  const lang = useLang();
  const cx = 200, cy = 200, R1 = 150, R2 = 65;
  const outer = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + R1 * Math.cos(a), y: cy + R1 * Math.sin(a) };
  });
  const inner = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + R2 * Math.cos(a), y: cy + R2 * Math.sin(a) };
  });
  const verts = [...outer, ...inner];
  const edges: [number, number][] = [];
  for (let i = 0; i < 5; i++) edges.push([i, (i + 1) % 5]);
  for (let i = 0; i < 5; i++) edges.push([5 + i, 5 + (i + 2) % 5]);
  for (let i = 0; i < 5; i++) edges.push([i, 5 + i]);

  const hamPath = [0, 1, 2, 3, 4, 9, 7, 5, 8, 6];
  const [showPath, setShowPath] = useState(true);
  const [showLabels, setShowLabels] = useState<'num' | 'set'>('num');
  const [permIdx, setPermIdx] = useState(0);

  // Apply current S_5 permutation: each vertex's 2-subset is mapped under sigma.
  const sigma = S5_DEMO_PERMS[permIdx];
  // permute 2-subset labels {a, b} -> {sigma[a-1], sigma[b-1]} then look up
  // which of the 10 base subsets matches.
  const permVertex = (v: number): number => {
    const [a, b] = PETERSEN_SUBSETS[v];
    const ap = sigma[a - 1], bp = sigma[b - 1];
    const lo = Math.min(ap, bp), hi = Math.max(ap, bp);
    return PETERSEN_SUBSETS.findIndex(([x, y]) => x === lo && y === hi);
  };
  // The interactive does NOT rearrange geometric positions; it relabels the
  // 10 vertex numbers under sigma so you can see Aut(P) = S_5 action.
  const labelOf = (v: number) => {
    if (showLabels === 'num') return String(permVertex(v));
    const [a, b] = PETERSEN_SUBSETS[permVertex(v)];
    return `{${a},${b}}`;
  };

  const onPath = (a: number, b: number) => {
    if (!showPath) return false;
    for (let i = 0; i + 1 < hamPath.length; i++) {
      if ((hamPath[i] === a && hamPath[i + 1] === b) || (hamPath[i] === b && hamPath[i + 1] === a)) return true;
    }
    return false;
  };

  return (
    <div className="gt-petersen-extra">
      <svg width="400" height="400" viewBox="0 0 400 400">
        {edges.map(([a, b], i) => (
          <line key={i}
            x1={verts[a].x} y1={verts[a].y}
            x2={verts[b].x} y2={verts[b].y}
            stroke={onPath(a, b) ? 'var(--accent)' : 'var(--ink-faint)'}
            strokeWidth={onPath(a, b) ? 3 : 1.3} />
        ))}
        {verts.map((v, i) => (
          <g key={i}>
            <circle cx={v.x} cy={v.y} r={14}
                    fill="var(--bg-elev)" stroke="var(--ink)" strokeWidth={1.6} />
            <text x={v.x} y={v.y + 4} textAnchor="middle"
                  fontSize={showLabels === 'set' ? 10 : 12}
                  fontFamily="var(--mono)" fill="var(--ink)">
              {labelOf(i)}
            </text>
          </g>
        ))}
      </svg>
      <div className="gt-petersen-extra-side">
        <div className="gt-petersen-extra-row">
          <button type="button" className="gt-btn"
                  onClick={() => setShowPath(p => !p)}>
            {showPath
              ? tr({ zh: '隐藏 Ham 路径', en: 'hide Ham path'
                                      })
              : tr({ zh: '显示 Ham 路径', en: 'show Ham path'
                                      })}
          </button>
        </div>
        <div className="gt-petersen-extra-row">
          <button type="button" className={`gt-chip ${showLabels === 'num' ? 'gt-chip-active' : ''}`}
                  onClick={() => setShowLabels('num')}>
            {tr({ zh: '编号 0..9', en: 'numbers 0..9'
            })}
          </button>
          <button type="button" className={`gt-chip ${showLabels === 'set' ? 'gt-chip-active' : ''}`}
                  onClick={() => setShowLabels('set')}>
            {tr({ zh: '二元子集', en: '2-subsets' })}
          </button>
        </div>
        <div className="gt-petersen-extra-row">
          <span className="gt-peg-label">{lang === 'zh' ? 'Aut(P) ≅ S₅' : 'Aut(P) ≅ S₅'}</span>
          {S5_DEMO_PERMS.map((_, i) => (
            <button key={i} type="button"
                    className={`gt-chip ${permIdx === i ? 'gt-chip-active' : ''}`}
                    onClick={() => setPermIdx(i)}>
              σ<sub>{i}</sub>
            </button>
          ))}
        </div>
        <div className="gt-petersen-extra-note">
          {lang === 'zh'
            ? <>10 顶点 = <TeX src="{[5] \\choose 2}" /> 的 10 个二元子集。 两顶点相邻 ⟺ 二元子集 <em>不相交</em>。 自同构群 <TeX src="\\text{Aut}(P) = S_5" />, 通过对 {`{1..5}`} 的置换诱导。 黄金色边 = 一条 Hamilton 路径 (0-1-2-3-4-9-7-5-8-6); 但 Petersen 图 <strong>没有</strong> Hamilton 圈 (Petersen 1898)。</>
            : <>10 vertices = the 10 unordered 2-subsets of <TeX src="\\{1, 2, 3, 4, 5\\}" />. Two vertices are adjacent iff the subsets are <em>disjoint</em>. The automorphism group <TeX src="\\text{Aut}(P) = S_5" /> acts by permuting <TeX src="\\{1, \\ldots, 5\\}" />. Gold edges show one Hamilton path (0-1-2-3-4-9-7-5-8-6); but Petersen has <strong>no</strong> Hamilton cycle (Petersen 1898).</>}
        </div>
      </div>
    </div>
  );
}

// ── §29 NEW · Coset chain builder — Z_8 with generators {1, 3} ──────────
// Demonstrates the standard coset-chaining recipe: split G = Z_8 by the
// subgroup H = ⟨3⟩ = {0, 3, 6, 1, 4, 7, 2, 5} which already cycles through
// all 8 elements via the generator 3. Then we re-visualise this as splicing
// "even" and "odd" cosets of H' = 2Z_8 = {0, 2, 4, 6} using the connector
// generator 1. The animation walks the constructed cycle.

// generator 1. The animation walks the constructed cycle.
function CosetChainBuilder() {
  const lang = useLang();
  const n = 8;
  // We build a Ham cycle on Z_8 using generators {1, 3}: walk even coset
  // by +1 step, then switch to odd coset by another +1 step, etc.
  // Explicit cycle: 0 → 1 → 4 → 5 → 2 → 3 → 6 → 7 → 0
  // Moves applied: +1, +3, +1, -3, +1, +3, +1, -7   (using {±1, ±3, ±7=-1})
  // For pedagogical clarity we use a cleaner cycle generated only by +1
  // (which itself is already a Ham cycle on Z_8) and overlay how the +3
  // generator "shortcuts" across cosets.
  const cycle = useMemo(() => {
    // Demonstrate the chaining: even coset {0, 2, 4, 6} traversed left-to-right
    // by +2, splice to odd coset {1, 3, 5, 7} by +3, traverse odd by +2.
    // 0 → 2 → 4 → 6 → 1 → 3 → 5 → 7 → 0
    const path = [0, 2, 4, 6, 1, 3, 5, 7, 0];
    const labels = ['+2', '+2', '+2', '+3', '+2', '+2', '+2', '+3 (= +3 mod 8)'];
    return { path, labels };
  }, []);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setStep(s => {
        if (s + 1 >= cycle.path.length) { setPlaying(false); return s; }
        return s + 1;
      });
    }, 700);
    return () => clearTimeout(t);
  }, [playing, step, cycle.path.length]);

  const cx = 180, cy = 160, R = 110;
  const pos = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  // Edges traversed so far in the constructed cycle.
  const visitedEdges: { a: number; b: number; label: string }[] = [];
  for (let i = 0; i < step; i++) {
    visitedEdges.push({ a: cycle.path[i], b: cycle.path[i + 1], label: cycle.labels[i] });
  }

  const cur = cycle.path[step];

  return (
    <div className="gt-ham-coset">
      <svg width="360" height="320" viewBox="0 0 360 320">
        {/* draw the underlying Cay(Z_8, {1, 3}) edges as faint backdrop */}
        {Array.from({ length: n }, (_, i) => i).flatMap(i => [
          { a: i, b: (i + 1) % n, gen: '+1' },
          { a: i, b: (i + 3) % n, gen: '+3' },
        ]).filter((_, idx) => idx % 2 === 0).map((e, i) => (
          <line key={`bg-${i}`}
            x1={pos[e.a].x} y1={pos[e.a].y}
            x2={pos[e.b].x} y2={pos[e.b].y}
            stroke={e.gen === '+1' ? 'var(--ink-faint)' : 'var(--ink-faint)'}
            strokeWidth={0.8} opacity={0.4}
            strokeDasharray={e.gen === '+3' ? '3 3' : 'none'} />
        ))}
        {/* even / odd coset highlights */}
        {[0, 2, 4, 6].map(i => (
          <circle key={`evn-${i}`} cx={pos[i].x} cy={pos[i].y} r={22}
                  fill="color-mix(in srgb, var(--accent) 12%, transparent)"
                  stroke="none" />
        ))}
        {/* traversed edges */}
        {visitedEdges.map((e, i) => (
          <g key={`v-${i}`}>
            <line x1={pos[e.a].x} y1={pos[e.a].y}
                  x2={pos[e.b].x} y2={pos[e.b].y}
                  stroke={e.label.startsWith('+3') ? 'var(--gold)' : 'var(--accent)'}
                  strokeWidth={2.5} />
          </g>
        ))}
        {/* vertices */}
        {pos.map((p, i) => {
          const even = i % 2 === 0;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={i === cur ? 14 : 11}
                      fill={i === cur ? 'var(--gold)' : even ? 'var(--bg-elev)' : 'var(--bg-deep)'}
                      stroke="var(--ink)" strokeWidth={1.6} />
              <text x={p.x} y={p.y + 4} textAnchor="middle"
                    fontSize={11} fontFamily="var(--mono)" fill="var(--ink)">{i}</text>
            </g>
          );
        })}
      </svg>
      <div className="gt-ham-coset-side">
        <div className="gt-ham-coset-info">
          <div><span className="gt-peg-label">{tr({ zh: '步骤', en: 'step'
        })}</span> <strong>{step} / {cycle.path.length - 1}</strong></div>
          <div><span className="gt-peg-label">{tr({ zh: '当前', en: 'now at'
        })}</span> <strong>{cur}</strong></div>
          {step > 0 && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
              {tr({ zh: '刚走', en: 'last move'
            })}: <strong>{cycle.labels[step - 1]}</strong>
            </div>
          )}
        </div>
        <div className="gt-ham-coset-buttons">
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => { setStep(0); setPlaying(false); }}>{tr({ zh: '重置', en: 'reset' })}</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>←</button>
          <button type="button" className="gt-btn" onClick={() => setPlaying(p => !p)}>
            {playing ? tr({ zh: '暂停', en: 'pause'
                                  }) : tr({ zh: '播放', en: 'play' })}
          </button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => setStep(s => Math.min(cycle.path.length - 1, s + 1))} disabled={step >= cycle.path.length - 1}>→</button>
        </div>
        <div className="gt-ham-coset-note">
          {lang === 'zh'
            ? <>分两步: 在偶陪集 <TeX src="2\\mathbb{Z}_8 = \\{0, 2, 4, 6\\}" /> 内用 +2 走通 4 个顶点, 再用 <em>连接生成元</em> +3 跨到奇陪集 <TeX src="\\{1, 3, 5, 7\\}" />, 再 +2 走通, 最后 +3 闭合到 0。 这就是 <strong>陪集链接</strong> 的最简范本 — 把子群的 Ham 圈拼起来构造母群的 Ham 圈。</>
            : <>Two phases: traverse the even coset <TeX src="2\\mathbb{Z}_8 = \\{0, 2, 4, 6\\}" /> via +2 (4 vertices), splice to the odd coset <TeX src="\\{1, 3, 5, 7\\}" /> using the <em>connector</em> +3, traverse via +2, then +3 closes to 0. This is <strong>coset chaining</strong> at its simplest — splicing subgroup Ham cycles into one for the parent group.</>}
        </div>
      </div>
    </div>
  );
}

// ── §29 NEW · GrayCodeFamily — switch between Gray code variants for n=3..5 ──
// Shows three named families on n bits:
//   1. Binary reflected Gray code (BRGC) — Frank Gray 1953
//   2. Balanced Gray code — each bit flips ~equally often
//   3. Anti-Gray code — adjacent values differ in ~all bits (Niessner)

//   3. Anti-Gray code — adjacent values differ in ~all bits (Niessner)
type GrayFamily = 'brgc' | 'balanced' | 'anti';

function GrayCodeFamily() {
  const lang = useLang();
  const [n, setN] = useState(4);
  const [family, setFamily] = useState<GrayFamily>('brgc');

  const seq = useMemo(() => {
    const total = 1 << n;
    if (family === 'brgc') {
      return Array.from({ length: total }, (_, i) => i ^ (i >> 1));
    }
    if (family === 'balanced') {
      // For n=4 use a known balanced 4-bit Gray code (Knuth TAOCP Algorithm L)
      // For other n we fall back to BRGC (balanced known constructive only for some n).
      if (n === 4) {
        return [0b0000, 0b0001, 0b0011, 0b0010, 0b0110, 0b0100, 0b0101, 0b0111,
                0b1111, 0b1011, 0b1010, 0b1000, 0b1001, 0b1101, 0b1100, 0b1110];
      }
      return Array.from({ length: total }, (_, i) => i ^ (i >> 1));
    }
    // Anti-Gray: adjacent differ in n-1 or n bits. One construction:
    // a_i = i ⊕ (i >> 1) ⊕ (i << 1) masked to n bits.
    return Array.from({ length: total }, (_, i) => {
      const g = i ^ (i >> 1);
      return (g ^ (~i & ((1 << n) - 1))) & ((1 << n) - 1);
    });
  }, [n, family]);

  // Compute statistics: number of bit-changes between consecutive entries.
  const stats = useMemo(() => {
    const diffs: number[] = [];
    for (let i = 0; i + 1 < seq.length; i++) {
      const d = seq[i] ^ seq[i + 1];
      let pop = 0;
      let x = d;
      while (x) { pop += x & 1; x >>= 1; }
      diffs.push(pop);
    }
    return diffs;
  }, [seq]);

  const isGrayLike = stats.every(d => d === 1);

  return (
    <div className="gt-ham-gray-family">
      <div className="gt-ham-gray-family-controls">
        <span className="gt-peg-label">n</span>
        {[3, 4, 5].map(k => (
          <button key={k} type="button"
                  className={`gt-chip ${n === k ? 'gt-chip-active' : ''}`}
                  onClick={() => setN(k)}>n = {k}</button>
        ))}
        <span className="gt-peg-label" style={{ marginLeft: 12 }}>{tr({ zh: '族', en: 'family' })}</span>
        <button type="button" className={`gt-chip ${family === 'brgc' ? 'gt-chip-active' : ''}`}
                onClick={() => setFamily('brgc')}>{tr({ zh: '反射二进制', en: 'reflected'
                })}</button>
        <button type="button" className={`gt-chip ${family === 'balanced' ? 'gt-chip-active' : ''}`}
                onClick={() => setFamily('balanced')}>{tr({ zh: '平衡', en: 'balanced' })}</button>
        <button type="button" className={`gt-chip ${family === 'anti' ? 'gt-chip-active' : ''}`}
                onClick={() => setFamily('anti')}>{tr({ zh: '反 Gray', en: 'anti-Gray' })}</button>
      </div>
      <div className="gt-ham-gray-family-list">
        {seq.map((g, i) => {
          const bits = g.toString(2).padStart(n, '0');
          const prev = i > 0 ? seq[i - 1] : g;
          const diff = i > 0 ? g ^ prev : 0;
          return (
            <div key={i} className="gt-ham-gray-family-row">
              <span className="gt-ham-gray-family-idx">{i}</span>
              <span className="gt-ham-gray-family-bits">
                {bits.split('').map((b, j) => {
                  const changed = i > 0 && ((diff >> (n - 1 - j)) & 1) === 1;
                  return (
                    <span key={j} className={`gt-ham-gray-family-bit ${b === '1' ? 'on' : 'off'} ${changed ? 'changed' : ''}`}>
                      {b}
                    </span>
                  );
                })}
              </span>
              <span className="gt-ham-gray-family-pop">
                {i > 0 && `Δ = ${stats[i - 1]}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="gt-ham-gray-family-summary">
        {lang === 'zh'
          ? <>每步翻位平均 <strong>{(stats.reduce((a, b) => a + b, 0) / stats.length).toFixed(2)}</strong> 位 · {isGrayLike ? '✓ 合法 Gray 序列 (每步恰 1 位)' : '✗ 不是 Gray 序列'}</>
          : <>average bits flipped per step: <strong>{(stats.reduce((a, b) => a + b, 0) / stats.length).toFixed(2)}</strong> · {isGrayLike ? '✓ valid Gray sequence (exactly 1 bit per step)' : '✗ not a Gray sequence'}</>}
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════
// §30 NEW · PGL/S5 additions
// ═══════════════════════════════════════════════════════════════════════
// ── §30 extension: cross-ratio, synthemes, icosahedral picture, order histogram ─

// Compose two Möbius transformations (matrix multiplication mod 5).

export default function HamiltonianPaths() {
  const lang = useLang();
  return (
      <GTSec id="hamiltonian" className="gt-sec">
        <div className="gt-sec-num">§29</div>
        <h2 className="gt-sec-title">
          <L zh="Hamilton 路径与 Cayley 图" en="Hamiltonian paths on Cayley graphs" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>给一个图 <TeX src="\Gamma" />, 一条 <strong>Hamilton 路径</strong> 是把所有顶点恰好走一次的路径; <strong>Hamilton 圈</strong> 是再首尾相连。 把 Cayley 图 (§14) 装上 Hamilton 路径有什么意义? <em>每个状态都恰好被路过一次, 一个不重不漏的 <strong>遍历公式</strong></em>。 这就是 「魔方所有 <TeX src="4.3 \times 10^{19}" /> 个状态能否用一条公式走遍?」 — 一个仍然 <strong>悬而未决</strong> 的问题, 已经挂在那里超过半个世纪。</>}
            en={<>A <strong>Hamiltonian path</strong> in a graph <TeX src="\Gamma" /> visits each vertex exactly once; a <strong>Hamiltonian cycle</strong> closes back to the start. Plugging this into Cayley graphs (§14): a Hamiltonian path is an <em>algorithm that visits every group element exactly once</em>. Can the cube's <TeX src="4.3 \times 10^{19}" /> states be traversed by one such alg? An <strong>open problem</strong> hanging there for over half a century.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 24, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.1  两大猜想 (Cayley + Lovász)" en="29.1  The two conjectures (Cayley + Lovász)" />
        </h3>
        <p>
          <L
            zh={<>故事的两个主角是 Cayley 1878 和 László Lovász 1970。 前者在他 1878 年那篇引入 Cayley 图的论文里就隐含问过: 这些图总是有 Hamilton 圈吗? 一个世纪以后, Lovász 给出了一个更弱的版本, 把 「Cayley 图」 放松成 「顶点传递图」, 并明确写下:</>}
            en={<>The two protagonists are Cayley (1878) and László Lovász (1970). Cayley's original paper introducing his graphs implicitly asked whether they always carry a Hamiltonian cycle. A century later Lovász formulated a weaker version with "vertex-transitive" replacing "Cayley graph":</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '猜想 29.1 (Cayley, 1878 隐含)', en: 'Conjecture 29.1 (Cayley, 1878 implicit)'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>每个连通的、 有限的 Cayley 图都含一条 Hamilton 圈。</>}
              en={<>Every connected finite Cayley graph admits a Hamiltonian cycle.</>}
            />
          </div>
        </div>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '猜想 29.2 (Lovász 1970)', en: 'Conjecture 29.2 (Lovász 1970)' })}</div>
          <div className="gt-def-body">
            <L
              zh={<>每个连通的有限顶点传递图都含一条 Hamilton 路径。 (注意: 是 「路径」, 不是 「圈」。)</>}
              en={<>Every connected finite vertex-transitive graph admits a Hamiltonian path. (Note: <em>path</em>, not cycle.)</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>两个猜想至今 <strong>未证未破</strong>, 是组合学最古老的开问题之一。 截至 2026 年, Lovász 猜想已对 <em>所有 ≤ 100 个顶点</em> 的顶点传递图穷举验证通过 (Royle–Spiga); Cayley 圈猜想对许多无穷族 (阿贝尔、 二面体、 广义四元数、 nilpotent 类 2 等) 已构造证明, 但通用的 「Cayley = Ham 圈」 蕴含证明仍未出现。</>}
            en={<>Both conjectures remain <strong>open</strong>, among the oldest unresolved problems in combinatorics. As of 2026, Lovász has been verified by computer for all vertex-transitive graphs of order ≤ 100 (Royle–Spiga); the Cayley cycle conjecture is settled constructively for many infinite families (Abelian, dihedral, generalised quaternion, nilpotent of class 2, …), but no general implication "Cayley ⇒ Hamiltonian cycle" has been proven.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '为什么有人相信猜想为真?', en: 'Why do people believe the conjectures?'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>三条直观证据: <strong>(i)</strong> 顶点传递图 「处处一样」, 任何阻断都会被对称性传遍, 所以局部障碍不易存在; <strong>(ii)</strong> 已知的所有反例 (Petersen 等 4 个) 都 <em>不</em> 是 Cayley 图; <strong>(iii)</strong> 大量计算机搜索从未在 Cayley 图上找到反例 — 但这只是 「不存在小反例」 的证据, 不是定理。</>}
              en={<>Three intuitions: <strong>(i)</strong> vertex-transitive graphs "look the same everywhere", so any local obstacle would propagate via symmetry and is hard to embed; <strong>(ii)</strong> the four known vertex-transitive non-Hamiltonian graphs (Petersen, Coxeter, and two Cayley-graph relatives of them) are <em>not</em> Cayley; <strong>(iii)</strong> extensive computer searches have never found a Cayley counterexample — though this only says there are no <em>small</em> ones.</>}
            />
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.2  Petersen 图 — 顶点传递但非 Cayley" en="29.2  Petersen graph — vertex-transitive but not Cayley" />
        </h3>
        <p>
          <L
            zh={<>把两个猜想严格分开的经典见证就是 <strong>Petersen 图</strong> <TeX src="P" />: 10 个顶点, 3-正则, girth (最短圈长) = 5, 直径 2, 顶点传递。 它 <em>不是任何群的 Cayley 图</em> (任何 10 阶群 = <TeX src="\mathbb{Z}_{10}" /> 或 <TeX src="D_5" />, 它们的 Cayley 图都长不出 Petersen 的几何形状)。</>}
            en={<>The classical witness separating the two conjectures is the <strong>Petersen graph</strong> <TeX src="P" />: 10 vertices, 3-regular, girth (shortest cycle length) 5, diameter 2, vertex-transitive. It is <em>not</em> a Cayley graph of any group — the only 10-element groups are <TeX src="\mathbb{Z}_{10}" /> and <TeX src="D_5" />, and neither yields Petersen as a Cayley graph.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 29.3 — Petersen 1898', en: 'Theorem 29.3 — Petersen (1898)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<><TeX src="P" /> 含 Hamilton 路径 (例如 0-1-2-3-4-9-7-5-8-6), <strong>但不含</strong> Hamilton 圈。 因此 Lovász (路径) 猜想在 <TeX src="P" /> 上成立, 而 Cayley (圈) 猜想在 <TeX src="P" /> 上无意义 — Petersen 不是 Cayley。</>}
              en={<><TeX src="P" /> contains a Hamiltonian path (e.g. 0-1-2-3-4-9-7-5-8-6) but <strong>no</strong> Hamiltonian cycle. So Lovász (path version) holds on <TeX src="P" />; the Cayley (cycle) conjecture is vacuous on <TeX src="P" /> since <TeX src="P" /> is not a Cayley graph.</>}
            />
          </div>
        </div>
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: 'Petersen 自同构群 = S₅', en: 'Aut(Petersen) = S₅'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>把 <TeX src="P" /> 的 10 个顶点等同于 <TeX src="\binom{[5]}{2}" /> 的 10 个二元子集; 两顶点连边 ⟺ 子集 <em>不相交</em>。 <TeX src="S_5" /> 在 <TeX src="\{1, 2, 3, 4, 5\}" /> 上的置换诱导 <TeX src="P" /> 的自同构, 给出 <TeX src="|\text{Aut}(P)| \ge 120" />。 容易验证不能更大, 故 <TeX src="\text{Aut}(P) = S_5" />。</p>
              <p style={{ margin: '0 0 12px' }}>这就是 <TeX src="P" /> 顶点传递的来源: <TeX src="S_5" /> 在 2-子集上 2-传递, 所以也单传递, 即顶点传递。 但若 <TeX src="P = \operatorname{Cay}(G, S)" /> 则 <TeX src="G" /> 必须 <em>规则地</em> 作用于 10 个顶点 (即 <TeX src="|G| = 10" /> 且无固定点)。 把 <TeX src="\mathbb{Z}_{10}" /> 和 <TeX src="D_5" /> 的所有 3-正则 Cayley 图列出, 没有一个等价于 Petersen。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Identify the 10 vertices of <TeX src="P" /> with the 10 2-subsets of <TeX src="\{1, \ldots, 5\}" />; two vertices are adjacent iff the subsets are <em>disjoint</em>. <TeX src="S_5" /> acting by permutations of <TeX src="\{1, \ldots, 5\}" /> induces graph automorphisms, giving <TeX src="|\text{Aut}(P)| \ge 120" />. A short check shows this is exact, so <TeX src="\text{Aut}(P) = S_5" />.</p>
              <p style={{ margin: '0 0 12px' }}>This is the source of vertex-transitivity: <TeX src="S_5" /> is 2-transitive on 2-subsets, hence 1-transitive, hence vertex-transitive. But if <TeX src="P = \operatorname{Cay}(G, S)" /> then <TeX src="G" /> must act <em>regularly</em> on the 10 vertices (i.e. <TeX src="|G| = 10" /> with no fixed point). Enumerating the 3-regular Cayley graphs of <TeX src="\mathbb{Z}_{10}" /> and <TeX src="D_5" />, none equals Petersen.</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Petersen 图 · 互动', en: 'Petersen graph · interactive'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '切换 「Ham 路径」 「数字 / 二元子集 标签」 「Aut(P) = S₅ 的几种置换」', en: 'toggle Ham path, number / 2-subset labels, and four S₅ automorphisms'
        })}</div>
          <PetersenInteractive />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.3  阿贝尔情形 — Gray 码" en="29.3  Abelian case — Gray codes" />
        </h3>
        <p>
          <L
            zh={<>对阿贝尔群, Cayley 圈猜想是 <strong>真的</strong>, 是已知最干净的一类。 证法是 <em>构造性</em> 的, 输出一条具体公式。 最优雅的例子在 <TeX src="\mathbb{Z}_2^n" /> 上 — 反射二进制 Gray 码, 由 Frank Gray 在 Bell 实验室 1947 年发明 (1953 年专利公开), 每一步只翻一个比特位:</>}
            en={<>For Abelian groups the Cayley cycle conjecture is <strong>true</strong> — the cleanest case in the entire conjecture. The proof is <em>constructive</em>, producing an explicit alg. The most elegant example, on <TeX src="\mathbb{Z}_2^n" />, is Frank Gray's reflected binary code (Bell Labs, invented 1947, patented 1953): one bit flips per step.</>}
          />
        </p>
        <TeXBlock src="G_{n} \;=\; G_{n-1}, \; \mathrm{reverse}(G_{n-1}) \text{ with leading bit toggled}." />
        <p>
          <L
            zh={<>这一定义给出 <TeX src="2^n" /> 个不同的 <em>n</em>-比特串, 串成 <TeX src="\mathbb{Z}_2^n" /> 的 Hamilton 圈, 每条边对应一个生成元 <TeX src="e_i" />。 对一般阿贝尔群 <TeX src="G = \mathbb{Z}/n_1 \times \cdots \times \mathbb{Z}/n_k" />, 用 <strong>蛇形 (zig-zag) Gray 码</strong>: 先把 <TeX src="\mathbb{Z}/n_1" /> 走通, 进 <TeX src="\mathbb{Z}/n_2" /> 的第 2 行反方向走通, 第 3 行回去, 依此类推。 总长 <TeX src="\prod n_i = |G|" />, 给出一条 Hamilton 路径; 若每个 <TeX src="n_i \ge 2" /> 且至少一个偶数, 它实际上是 Hamilton 圈。</>}
            en={<>This yields <TeX src="2^n" /> distinct <em>n</em>-bit strings forming a Hamiltonian cycle of <TeX src="\mathbb{Z}_2^n" />, each edge corresponding to a generator <TeX src="e_i" />. For a general finite Abelian group <TeX src="G = \mathbb{Z}/n_1 \times \cdots \times \mathbb{Z}/n_k" />, use a <strong>zig-zag (snake) Gray code</strong>: walk <TeX src="\mathbb{Z}/n_1" /> forward, the second row of <TeX src="\mathbb{Z}/n_2" /> backward, the third forward, etc. Total length <TeX src="\prod n_i = |G|" /> gives a Hamilton path; it closes to a cycle when each <TeX src="n_i \ge 2" /> and at least one is even.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Gray 码遍历 𝔽₂ⁿ', en: 'Gray code walking through 𝔽₂ⁿ'
        })}</div>
          <GrayCodeWalker />
        </div>
        <p>
          <L
            zh={<>Gray 码不止 「反射二进制」 一种, 是一整族满足 「相邻位串恰差一位」 的序列。 <strong>平衡 Gray 码</strong> (balanced) 要求每个比特位翻转次数相近 (理想 <TeX src="2^n / n" /> 次) — 在模拟 / 数字转换器里减少 spike error; <strong>单调 Gray 码</strong> (monotone) 要求按 popcount 分层走 — 应用在并行算法; <strong>蛇形盒码</strong> (snake-in-the-box) 则给出长度 ≤ <TeX src="2^n" /> 的 <em>诱导</em> 路径 (任意非相邻两点之间无弦), 用于纠错。 共同点: 它们都是 <TeX src="\mathbb{Z}_2^n" /> 的 Cayley 图上的 Hamilton 路径 / 圈, 只是按不同附加约束选定。</>}
            en={<>The Gray code is not unique. The whole family of sequences where "consecutive strings differ in one bit" is large. <strong>Balanced Gray codes</strong> require each bit-position to flip nearly equally often (ideally <TeX src="2^n / n" /> times) — used in ADCs to spread spike errors; <strong>monotone Gray codes</strong> walk by ascending popcount — used in parallel algorithms; <strong>snake-in-the-box codes</strong> are <em>induced</em> paths of length ≤ <TeX src="2^n" /> (no chord between non-consecutive vertices) — used in error correction. All are Hamiltonian paths or cycles in <TeX src="\operatorname{Cay}(\mathbb{Z}_2^n)" />, distinguished only by which extra structure is imposed.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Gray 码家族 · n = 3..5', en: 'Gray code family · n = 3..5'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '反射二进制 vs 平衡 vs 反 Gray; Δ = 相邻翻位数', en: 'reflected binary vs balanced vs anti-Gray; Δ = bits flipped between consecutive entries'
        })}</div>
          <GrayCodeFamily />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.4  超立方体 Q_n — Gray 码的几何本源" en="29.4  The hypercube Q_n — geometric source of Gray codes" />
        </h3>
        <p>
          <L
            zh={<><TeX src="\mathbb{Z}_2^n" /> 的 Cayley 图 (生成集 = 标准基) 就是 <strong>n-维超立方体</strong> <TeX src="Q_n" />: <TeX src="2^n" /> 个顶点 = 二进制串, 两点相邻 ⟺ 恰差一位。 反射 Gray 码就是 <TeX src="Q_n" /> 的一条 Hamilton 圈; <em>反过来</em>, 任何 <TeX src="Q_n" /> 的 Hamilton 圈都对应一种 「Gray 码」 (不必反射型)。</>}
            en={<>The Cayley graph of <TeX src="\mathbb{Z}_2^n" /> with the standard basis is the <strong>n-dimensional hypercube</strong> <TeX src="Q_n" />: <TeX src="2^n" /> vertices = bit-strings, adjacent iff one bit differs. The reflected Gray code is a Hamiltonian cycle of <TeX src="Q_n" />; conversely every Hamilton cycle of <TeX src="Q_n" /> corresponds to <em>some</em> Gray-style code.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 29.4 — Q_n 的 Ham 圈计数', en: 'Theorem 29.4 — Counting Ham cycles in Q_n'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<><TeX src="Q_n" /> 含 Hamilton 圈, 数目 <TeX src="H_n" /> 增长极快: <TeX src="H_2 = 1" />, <TeX src="H_3 = 6" />, <TeX src="H_4 = 1344" />, <TeX src="H_5 = 906\,545\,760" />, <TeX src="H_6 = 35\,838\,213\,722\,570\,883\,870\,720" /> (OEIS A006069)。 一般公式未知; 渐近 <TeX src="H_n \sim n!^{2^{n}/n}" /> 量级 (启发式)。</>}
              en={<><TeX src="Q_n" /> contains Hamilton cycles. The count <TeX src="H_n" /> grows fast: <TeX src="H_2 = 1" />, <TeX src="H_3 = 6" />, <TeX src="H_4 = 1344" />, <TeX src="H_5 = 906\,545\,760" />, <TeX src="H_6 = 35\,838\,213\,722\,570\,883\,870\,720" /> (OEIS A006069). No closed form is known; heuristically <TeX src="H_n \sim n!^{2^{n}/n}" />.</>}
            />
          </div>
        </div>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Q_n · Hamilton 圈动画 (n = 3, 4)', en: 'Q_n · Hamilton cycle animation (n = 3, 4)'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '反射 Gray 码; 金色边 = 已走; 二进制标签直接显示当前顶点', en: 'reflected Gray code; gold edges = traversed; binary labels show the current vertex'
        })}</div>
          <HypercubeGrayWalker />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.5  骑士周游 — 18 世纪原型" en="29.5  Knight's tour — the 18th-century prototype" />
        </h3>
        <p>
          <L
            zh={<>Hamilton 路径问题最早 (远早于 Hamilton 1857 八面体题) 的有名实例是 <strong>骑士周游</strong>: 在 8 × 8 棋盘上, 骑士能否每格恰好访问一次? 答案 「能」 至少可以追溯到 9 世纪阿拉伯文献, 18 世纪 Euler (1759) 给出第一个系统化的算法构造, Vandermonde (1771) 把它视作组合问题。 它 <em>不</em> 是任何群的 Cayley 图 (棋盘没有传递的群作用), 但它仍是 「正则化图上的 Hamilton 圈」 这一研究方向的鼻祖。</>}
            en={<>The earliest famous instance of the Hamiltonian path problem — predating Hamilton's 1857 octahedron puzzle by centuries — is the <strong>knight's tour</strong>: can a knight visit every square of an 8 × 8 board exactly once? The answer "yes" goes back to 9th-century Arabic manuscripts; Euler (1759) gave the first systematic algorithm and Vandermonde (1771) cast it as a combinatorial problem. The knight graph is <em>not</em> a Cayley graph (no transitive group action), but it spawned the entire research direction of Hamilton cycles on regular-ish graphs.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: 'Warnsdorff 规则 (1823)', en: 'Warnsdorff\'s rule (1823)'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>每一步选择 「后续合法走法最少」 的邻格走。 一个一行的贪心启发式 — 但几乎总能完成完整 Hamilton 周游, 是历史上第一个 「实用的」 Hamilton 路径求解器。 实证: 8 × 8 上随机起点, Warnsdorff 完成率 ≥ 99%; <em>n × n</em> 上, <em>n</em> 充分大时几乎稳赢。</>}
              en={<>At each step move to the neighbour with the fewest onward legal options. A one-line greedy rule — but it almost always completes a full Hamilton tour and was the first practical Hamilton-path solver in history. Empirically: random starts on 8 × 8 complete ≥ 99% of the time; on <em>n × n</em> for large <em>n</em>, it succeeds with overwhelming probability.</>}
            />
          </div>
        </div>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '骑士周游 · 8 × 8', en: 'Knight\'s tour · 8 × 8'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '从 a1 出发, Warnsdorff 启发式生成的 64 步周游', en: 'starting from a1, a 64-step tour generated by Warnsdorff\'s rule'
        })}</div>
          <KnightTourBoard />
        </div>
        <p>
          <L
            zh={<>20 世纪以来骑士周游已被完全分类 (Schwenk 1991): 矩形 <em>m × n</em> (<em>m ≤ n</em>) 有闭合 Hamilton 周游 ⟺ 不属于以下三类:  <em>mn</em> 奇, <em>m</em> ∈ &#123;1, 2, 4&#125;, 或 <em>m, n</em> = (3, 4), (3, 6), (3, 8)。 8 × 8 不在禁名单, 所以闭合周游存在; 实际上数目极多 — 1995 年 Löbbing–Wegener 用 BDD 算出共 <strong>26 534 728 821 064</strong> 条无向闭合周游 (定向计数 ×8 = 2.122 × 10¹⁴)。</>}
            en={<>The knight's tour was fully classified in the 20th century (Schwenk 1991): a rectangular <em>m × n</em> board (<em>m ≤ n</em>) admits a closed Hamilton tour iff it does NOT lie in the three exceptional families: <em>mn</em> odd, <em>m</em> ∈ &#123;1, 2, 4&#125;, or <em>m, n</em> ∈ &#123;(3, 4), (3, 6), (3, 8)&#125;. 8 × 8 escapes, so closed tours exist; in fact <em>many</em> — Löbbing–Wegener (1995) computed by BDD that there are exactly <strong>26 534 728 821 064</strong> undirected closed knight's tours (8× more if directed = 2.12 × 10¹⁴).</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.6  Rapaport-Strasser · 二面体与广义四元数群" en="29.6  Rapaport-Strasser · dihedral and generalised quaternion" />
        </h3>
        <p>
          <L
            zh={<>1959 年 Elvira Rapaport-Strasser 首次给出了非阿贝尔群的 Cayley 圈构造性证明 — 二面体群 <TeX src="D_n" /> (<TeX src="2n" /> 元素, 由旋转 <TeX src="r" /> 和反射 <TeX src="s" /> 生成) 的所有连通 Cayley 图含 Hamilton 圈。 1963 年她推广到 <strong>广义四元数群</strong> <TeX src="Q_{2^k}" /> 和某些更大的有限群族。</>}
            en={<>In 1959 Elvira Rapaport-Strasser gave the first constructive proof of the Cayley cycle conjecture for a non-Abelian family — the dihedral groups <TeX src="D_n" /> (<TeX src="2n" /> elements, generated by a rotation <TeX src="r" /> and reflection <TeX src="s" />) — showing every connected Cayley graph admits a Hamilton cycle. In 1963 she extended this to <strong>generalised quaternion groups</strong> <TeX src="Q_{2^k}" /> and several larger finite group families.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 29.5 — Rapaport-Strasser 1959', en: 'Theorem 29.5 — Rapaport-Strasser 1959' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src="G = D_n = \langle r, s \mid r^n = s^2 = e,\, srs = r^{-1} \rangle" />, 生成集 <TeX src="S = \{r, s\}" /> (或更一般的连通生成集)。 则 <TeX src="\operatorname{Cay}(G, S)" /> 含一条显式 Hamilton 圈, 构造为:</>}
              en={<>Let <TeX src="G = D_n = \langle r, s \mid r^n = s^2 = e,\, srs = r^{-1} \rangle" /> with generators <TeX src="S = \{r, s\}" /> (or any connected set). Then <TeX src="\operatorname{Cay}(G, S)" /> contains an explicit Hamilton cycle of the form</>}
            />
            <TeXBlock src="e \to r \to r^2 \to \cdots \to r^{n-1} \to r^{n-1} s \to r^{n-2} s \to \cdots \to s \to e." />
            <L
              zh={<>第一行的 <em>n</em> 步是旋转, 跨到 <em>s</em>-行后再倒着走 <em>n</em> 步反射, 最后 <em>s</em> 闭合。 总共 <TeX src="2n" /> 步 = <TeX src="|G|" />, 是 Hamilton 圈。 此构造是 「陪集链接」 思想的最早实例: <TeX src="\langle r \rangle \cong \mathbb{Z}_n" /> 的两个陪集各自是阿贝尔 Hamilton 圈, 用 <em>s</em> 把它们拼起来。</>}
              en={<>The first <em>n</em> steps walk by <em>r</em>; an <em>s</em>-jump moves into the reflection coset; another <em>n</em> backward <em>r</em>-steps walk back; one final <em>s</em> closes the loop. Total <TeX src="2n = |G|" /> steps. This is the earliest example of <strong>coset chaining</strong>: two cosets of <TeX src="\langle r \rangle \cong \mathbb{Z}_n" /> are Abelian Hamilton cycles in their own right, joined via the connector <em>s</em>.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>Rapaport-Strasser 之后, 一系列结果累积起来, 把猜想覆盖到更多群族: Witte (1986) 证 <em>p</em>-群 (素数幂阶群); Witte-Gallian (1984) 证半直积 <TeX src="\mathbb{Z}_p \rtimes \mathbb{Z}_q" />; Chen-Quimpo (1980s) 处理 dihedral × Abelian 等。 一个统一的格言: <em>「子群链 <TeX src="H_0 \lhd H_1 \lhd \cdots \lhd G" /> 中每层商群有 Hamilton 圈 ⟹ <TeX src="G" /> 有」</em> — 这是 §29.9 「陪集链接」 的形式化版本。</>}
            en={<>After Rapaport-Strasser, results piled up across group families: Witte (1986) for <em>p</em>-groups; Witte-Gallian (1984) for semidirect products <TeX src="\mathbb{Z}_p \rtimes \mathbb{Z}_q" />; Chen-Quimpo (1980s) for dihedral × Abelian. A unifying motto: <em>"if every quotient in a normal series <TeX src="H_0 \lhd H_1 \lhd \cdots \lhd G" /> has a Hamilton cycle then so does <TeX src="G" />"</em> — the formalisation of §29.9's coset-chaining recipe.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.7  Marušič 1985 与现代前沿" en="29.7  Marušič 1985 and the modern frontier" />
        </h3>
        <p>
          <L
            zh={<>1980 年代以来, Dragan Marušič (斯洛文尼亚学派) 把 Lovász 的弱版猜想 (顶点传递 → Hamilton 路径) 沿 「群阶 <TeX src="|G|" />」 一阶一阶往上推。 关键 1983 年论文给出系统化的工具 — <strong>imprimitive block 系统</strong>, <strong>orbital 划分</strong>, <strong>semiregular automorphism</strong> — 至今仍是主导方法。</>}
            en={<>From the 1980s onwards Dragan Marušič (the Slovenian school) pushed Lovász's weaker conjecture (vertex-transitive → Hamilton path) upward order by order. His seminal 1983 paper introduced the systematic toolkit — <strong>imprimitive block systems</strong>, <strong>orbital partitions</strong>, <strong>semiregular automorphisms</strong> — that still dominates the field today.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 29.6 — Marušič 1985', en: 'Theorem 29.6 — Marušič (1985)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>每个 <strong>顶点数 = <em>pk</em> (<em>p</em> 素数, <em>k</em> 较小)</strong> 的顶点传递图都含 Hamilton 路径。 这一推得当时把 Lovász 猜想从 「小例子检验」 扩展到 「无限族构造」。</>}
              en={<>Every vertex-transitive graph of order <strong><em>pk</em> for <em>p</em> prime and <em>k</em> bounded</strong> contains a Hamilton path. At the time this leap took Lovász from "checked on small examples" to "proven for infinitely many cases".</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>2009 年 Kutnar–Marušič 综述把全部已知结果整理在 「按群阶大小排序」 的表里。 截至发表时, 已对 |G| ≤ 100 全部完成; 之后 2012-2018 一系列工作 (Witte, Verret, Spiga) 把这条线推到 |G| ≤ 200 左右。 列入 「已结案」 的群族:</>}
            en={<>The 2009 Kutnar–Marušič survey arranged all known results in a table ordered by group order. By publication time, every <TeX src="|G| \le 100" /> had been verified; 2012-2018 work (Witte, Verret, Spiga, ...) pushed the line to roughly <TeX src="|G| \le 200" />. Group families now classified as "done":</>}
          />
        </p>
        <ul style={{ paddingLeft: 24, lineHeight: 1.85 }}>
          <li><L zh={<>所有阿贝尔群 (古典)</>} en={<>all Abelian groups (classical)</>} /></li>
          <li><L zh={<>二面体群 <TeX src="D_n" />, 广义四元数 <TeX src="Q_{2^k}" /> (Rapaport-Strasser)</>} en={<>dihedral <TeX src="D_n" />, generalised quaternion <TeX src="Q_{2^k}" /> (Rapaport-Strasser)</>} /></li>
          <li><L zh={<>所有 <em>p</em>-群 (Witte 1986)</>} en={<>all <em>p</em>-groups (Witte 1986)</>} /></li>
          <li><L zh={<>nilpotent 阶 ≤ 2 的群</>} en={<>nilpotent groups of class ≤ 2</>} /></li>
          <li><L zh={<>所有阶 <TeX src="\le 200" /> 的顶点传递图 (Royle-Spiga 2018)</>} en={<>all vertex-transitive graphs of order <TeX src="\le 200" /> (Royle-Spiga 2018)</>} /></li>
          <li><L zh={<>对称群 <TeX src="S_n" /> 用 transposition 生成集 (Rankin 1948; Compton-Williamson 1991)</>} en={<>symmetric groups <TeX src="S_n" /> with transposition generators (Rankin 1948; Compton-Williamson 1991)</>} /></li>
        </ul>
        <p>
          <L
            zh={<>仍然 <strong>缺一个统一证明</strong>。 Babai (1995) 在他那篇 「Cayley 图猜想是组合学最重要的开问题之一」 的综述里写道 — Lovász 猜想若真, 应有某种 「群论的结构性原因」, 而非一族一族手算; 但十年后这条 「原因」 仍未现身。 计算机暴搜则反向给出强信号: 没有反例。</>}
            en={<>A <strong>uniform proof remains elusive</strong>. Babai (1995), in his survey calling the Cayley conjecture "one of the most important open problems in combinatorics", argued that if Lovász is true there should be a <em>structural</em> group-theoretic reason, not just family-by-family case work. Ten years on, no such reason has emerged. Brute-force computer searches, conversely, give strong evidence: no counterexample has been found.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.8  立方子群的现状" en="29.8  Status on cube subgroups" />
        </h3>
        <p>
          <L
            zh={<>魔方相关的群在 「Hamilton 圈」 这道难题面前位置很有趣 — 一部分已被解决 (含显式构造), 一部分仍开放。 Jaap Scherphuis 在他的著名 「魔方百科」 页面上维护过一份清单:</>}
            en={<>Cube-related groups occupy an interesting position on this problem — some are solved (with explicit constructions), others remain open. Jaap Scherphuis maintains a list on his classic "puzzle pages":</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr>
              <th>{tr({ zh: '谜题 / 群', en: 'puzzle / group'
            })}</th>
              <th>{tr({ zh: '状态数', en: '|G|'
            })}</th>
              <th>{tr({ zh: 'Ham 圈?', en: 'Ham cycle?' })}</th>
              <th>{tr({ zh: '来源 / 注', en: 'source / note'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{tr({ zh: '魔方时钟 (Rubik\'s Clock)', en: 'Rubik\'s Clock'
            })}</td>
              <td className="num">12¹⁴ ≈ 1.28×10¹⁵</td>
              <td>✓</td>
              <td>{tr({ zh: '阿贝尔 ⇒ 12 进制 Gray 码', en: 'Abelian → base-12 Gray code'
            })}</td>
            </tr>
            <tr>
              <td>Floppy Cube (1×3×3)</td>
              <td className="num">192</td>
              <td>✓</td>
              <td>{tr({ zh: '显式公式 (R²LR²L\'R²LR²L\')⁵', en: 'explicit (R²LR²L\'R²LR²L\')⁵'
            })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: '两面 6 子 (§30)', en: 'Two-face 6-piece (§30)'
            })}</td>
              <td className="num">120 ≅ S₅</td>
              <td>✓</td>
              <td>{tr({ zh: '已知, 含 (RU)⁴LU 连接器', en: 'known, with connector (RU)⁴LU'
            })}</td>
            </tr>
            <tr>
              <td>Lights Out (5×5)</td>
              <td className="num">2²⁵</td>
              <td>✓</td>
              <td>{tr({ zh: '阿贝尔 ⇒ 二进制 Gray 码', en: 'Abelian → binary Gray code'
            })}</td>
            </tr>
            <tr>
              <td>{lang === 'zh' ? 'Pocket Cube (2×2×2)' : 'Pocket Cube (2×2×2)'}</td>
              <td className="num">3 674 160</td>
              <td>?</td>
              <td>{tr({ zh: '开 (猜测有)', en: 'open (conjectured)'
            })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: '魔方 (3×3×3)', en: 'Rubik\'s Cube (3×3×3)' })}</td>
              <td className="num">4.3×10¹⁹</td>
              <td>?</td>
              <td>{tr({ zh: '开 (猜测有)', en: 'open (conjectured)'
            })}</td>
            </tr>
            <tr>
              <td>Pyraminx</td>
              <td className="num">75 582 720</td>
              <td>?</td>
              <td>{tr({ zh: '开', en: 'open'
            })}</td>
            </tr>
            <tr>
              <td>Megaminx</td>
              <td className="num">≈ 10⁶⁸</td>
              <td>?</td>
              <td>{tr({ zh: '开 (规模太大, 无人尝试)', en: 'open (size prohibitive)'
            })}</td>
            </tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>注意一个量级对照: <strong>3×3×3 Cayley 图</strong> 顶点数 <TeX src="4.3 \times 10^{19}" /> ≈ <strong>全球海滩沙粒数</strong>。 即便 「直接 BFS 找 Ham 圈」 是可计算的 (理论上多项式时间), 实际遍历也远超任何计算机集群。 现有立方解法 (Korf IDA*, Kociemba 二阶段, Rokicki BFS) 都不是 Hamilton 圈, 而是 「测地线搜索」 或 「直径证明」, 两者性质完全不同 — 测地线只跨 ≤ 20 步, Hamilton 圈要 <TeX src="4.3 \times 10^{19}" /> 步。</>}
            en={<>A scale check: the <strong>3×3×3 Cayley graph</strong> has <TeX src="4.3 \times 10^{19}" /> vertices ≈ <strong>the number of grains of sand on Earth's beaches</strong>. Even if "BFS for a Ham cycle" were polynomial, the traversal itself would exceed any conceivable compute cluster. Existing cube solvers (Korf IDA*, Kociemba two-phase, Rokicki BFS) are not Ham-cycle constructions — they are geodesic searches or diameter proofs, fundamentally different problems. A geodesic spans ≤ 20 steps; a Hamilton cycle spans <TeX src="4.3 \times 10^{19}" />.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.9  陪集链接 — 构造 Hamilton 圈的标准工具" en="29.9  Coset chaining — the standard construction tool" />
        </h3>
        <p>
          <L
            zh={<>所有非阿贝尔已结案例子 (二面体、 四元数、 <em>p</em>-群、 ...) 用的核心技术都叫 <strong>陪集链接</strong> (coset chaining)。 一句话: 找一个有 Ham 圈的子群 <TeX src="H \le G" />, 然后把 <TeX src="G / H" /> 的 <TeX src="[G : H]" /> 个陪集像拉链一样拼起来。</>}
            en={<>Every solved non-Abelian case (dihedral, quaternion, <em>p</em>-groups, ...) uses the same core technique: <strong>coset chaining</strong>. In one line: find a subgroup <TeX src="H \le G" /> with a known Ham cycle, then splice the <TeX src="[G : H]" /> cosets of <TeX src="G / H" /> together like a zipper.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '陪集链接定理 (Witte-Gallian 1984, 形式化)', en: 'Coset chaining (Witte-Gallian 1984, formal)'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>设 <TeX src="H \le G" />, 生成集 <TeX src="S" /> 含 <TeX src="H" /> 的生成集 <TeX src="T" /> 及一个连接子 <TeX src="c \in S \setminus T" />。 若 <strong>(a)</strong> <TeX src="\operatorname{Cay}(H, T)" /> 含 Hamilton 路径 <TeX src="h_1, h_2, \ldots, h_m" /> (其中 <TeX src="m = |H|" />), <strong>(b)</strong> 商图 <TeX src="\operatorname{Cay}(G/H, \bar S)" /> 含 Hamilton 圈 <TeX src="\bar g_1, \bar g_2, \ldots, \bar g_k" /> (<TeX src="k = [G : H]" />), <strong>(c)</strong> 连接子 <TeX src="c" /> 与 <TeX src="T" /> 在每个陪集上方向兼容, 则 <TeX src="\operatorname{Cay}(G, S)" /> 含一条 Hamilton 圈。</>}
              en={<>Let <TeX src="H \le G" />, generators <TeX src="S" /> containing a generating set <TeX src="T" /> of <TeX src="H" /> and one connector <TeX src="c \in S \setminus T" />. If <strong>(a)</strong> <TeX src="\operatorname{Cay}(H, T)" /> contains a Hamilton path <TeX src="h_1, h_2, \ldots, h_m" /> (with <TeX src="m = |H|" />), <strong>(b)</strong> the quotient graph <TeX src="\operatorname{Cay}(G/H, \bar S)" /> contains a Hamilton cycle <TeX src="\bar g_1, \ldots, \bar g_k" /> (<TeX src="k = [G : H]" />), <strong>(c)</strong> the connector <TeX src="c" /> is direction-compatible with <TeX src="T" /> on each coset, then <TeX src="\operatorname{Cay}(G, S)" /> contains a Hamilton cycle.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>证明思想 (略): 第一个陪集 <TeX src="g_1 H" /> 内沿 <TeX src="h_1, \ldots, h_m" /> 走完, 然后用 <TeX src="c" /> 跨到 <TeX src="g_2 H = g_1 c H" />, 倒着走 <TeX src="h_m, \ldots, h_1" />, 再 <TeX src="c" /> 跨到 <TeX src="g_3 H" />, 来回 zigzag 直到所有 <TeX src="k" /> 个陪集走完。 条件 (c) 保证 zigzag 的两端能续上, 不会卡死。 总长 <TeX src="m \cdot k = |G|" />, 而且回到起点。</>}
            en={<>Proof sketch: walk inside <TeX src="g_1 H" /> along <TeX src="h_1, \ldots, h_m" />, hop to <TeX src="g_2 H = g_1 c H" /> via <TeX src="c" />, walk backwards <TeX src="h_m, \ldots, h_1" />, hop to <TeX src="g_3 H" />, zig-zag until all <TeX src="k" /> cosets are covered. Condition (c) ensures the zig-zag endpoints connect without dead-ending. Total length <TeX src="mk = |G|" />, returning to the start.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '陪集链接 · Z₈ 范例', en: 'Coset chaining · Z₈ example'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '子群 H = 2Z₈ = {0,2,4,6} 用 +2 遍历; 连接子 +3 跨到奇陪集 {1,3,5,7}; 共 8 步形成 Ham 圈', en: 'subgroup H = 2Z₈ = {0,2,4,6} traversed by +2; connector +3 splices to odd coset {1,3,5,7}; 8 steps form a Ham cycle'
        })}</div>
          <CosetChainBuilder />
        </div>
        <p>
          <L
            zh={<>这一招对魔方 3×3×3 有理论上的可行路径: 取 <TeX src="H = \mathrm{CO} \cdot \mathrm{EO}" /> (角向、棱向子群, 阿贝尔, <TeX src="|H| = 3^8 \cdot 2^{12} / 12 = 2\,217\,093\,120 / 12" />) 用 Gray 码遍历, 然后用某个 「方向不变」 的连接器跨到下一个陪集。 难点全在 (c) — 找一个跟阿贝尔 Gray 码兼容的连接器。 至今没人成功过。</>}
            en={<>For the 3×3×3 cube there is a theoretical pathway: take <TeX src="H = \mathrm{CO} \cdot \mathrm{EO}" /> (corner / edge orientation subgroup, Abelian) and traverse it via a Gray code, then use some "orientation-fixing" connector to hop into the next coset. All the difficulty lies in (c) — finding a connector compatible with the Abelian Gray code on every coset. So far no one has built such a connector for the cube.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.10  Pak-Radoičić · 一个准定理" en="29.10  Pak-Radoičić · a near-theorem" />
        </h3>
        <p>
          <L
            zh={<>Igor Pak 与 Rados Radoičić 在 2009 年的一篇论文里证明了 Lovász 猜想的一个 「弱形式」: <em>每个有限群 <TeX src="G" /> 有大小 <TeX src="\le \log_2 |G|" /> 的生成集 <TeX src="S" />, 使 <TeX src="\operatorname{Cay}(G, S)" /> 含 Hamilton 圈</em>。 即, 「如果我们能挑生成集, 那么 Hamilton 圈就一定能造出来」。</>}
            en={<>Igor Pak and Rados Radoičić (2009) proved a weak form of Lovász: <em>every finite group <TeX src="G" /> has a generating set <TeX src="S" /> with <TeX src="|S| \le \log_2 |G|" /> such that <TeX src="\operatorname{Cay}(G, S)" /> contains a Hamilton cycle</em>. In other words, "if we get to choose the generators, a Hamilton cycle always exists".</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 29.7 — Pak-Radoičić 2009', en: 'Theorem 29.7 — Pak-Radoičić (2009)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对每个有限群 <TeX src="G" /> 存在生成集 <TeX src="S" /> 使 <TeX src="|S| \le \lceil \log_2 |G| \rceil" /> 且 <TeX src="\operatorname{Cay}(G, S)" /> 含 Hamilton 圈。 进一步, 这条圈可以在多项式时间内显式构造。</>}
              en={<>For every finite group <TeX src="G" /> there is a generating set <TeX src="S" /> with <TeX src="|S| \le \lceil \log_2 |G| \rceil" /> such that <TeX src="\operatorname{Cay}(G, S)" /> contains a Hamilton cycle. Moreover, the cycle can be constructed in polynomial time.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个结果 「几乎」 把 Cayley 圈猜想搞定 — 唯一缺口是 「我们不能选生成集」 时的情况。 在魔方语境下, 这意味着: 若允许我们换一组生成元 (不一定是 <TeX src="\{F, B, L, R, U, D\}" />), <em>就能</em> 构造出 4.3 × 10¹⁹ 步的 「全空间公式」。 但用 WCA 标准 6 面生成集, 仍然不知道。</>}
            en={<>This <em>almost</em> settles the Cayley cycle conjecture — the only gap is "the case when we are not allowed to choose the generators". In cube language: if we're free to pick a non-standard generating set (not <TeX src="\{F, B, L, R, U, D\}" />), we <em>can</em> construct a Hamilton cycle of length 4.3 × 10¹⁹. With the standard WCA 6-face generators, the question is still open.</>}
          />
        </p>
        <p>
          <L
            zh={<>Pak-Radoičić 的证明用 <strong>有限单群分类</strong> (Classification of Finite Simple Groups, CFSG) 作为黑盒, 因此它是 「条件性」 的 — 依赖 1980s 那个总篇幅 1 万页的庞大证明体系。 这是组合学里 CFSG 罕见的具体应用之一。</>}
            en={<>The Pak-Radoičić proof uses the <strong>Classification of Finite Simple Groups</strong> (CFSG) as a black box, so it is technically <em>conditional</em> on the 10 000-page CFSG monolith from the 1980s. This is one of the rare combinatorial uses of CFSG.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.11  计算复杂度 · 一般图 NP-完全, 顶点传递开放" en="29.11  Computational complexity · NP-complete in general, open for vertex-transitive" />
        </h3>
        <p>
          <L
            zh={<>把 「Cayley 图都有 Hamilton 圈」 翻译成判定问题: 输入一个有限图 <TeX src="\Gamma" />, 问 <TeX src="\Gamma" /> 是否含 Hamilton 圈? 对 <strong>一般图</strong>, 这是 Karp 1972 列出的 21 个 NP-完全问题之一 — 计算上极难。 但加上 「顶点传递」 这个对称约束后, 问题的复杂度本身就 <em>不知道</em>:</>}
            en={<>Phrasing the Cayley conjecture as a decision problem: given a finite graph <TeX src="\Gamma" />, is there a Hamilton cycle? On <strong>general</strong> graphs this is one of Karp's 21 NP-complete problems (1972) — computationally intractable in the worst case. With the "vertex-transitive" symmetry constraint, even the complexity class is unknown:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr>
              <th>{tr({ zh: '图类', en: 'graph class'
            })}</th>
              <th>HAM-CYCLE</th>
              <th>HAM-PATH</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{tr({ zh: '一般有限图', en: 'general finite graph'
            })}</td>
              <td>NP-{tr({ zh: '完全 (Karp 1972)', en: 'complete (Karp 1972)' })}</td>
              <td>NP-{tr({ zh: '完全', en: 'complete' })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: '平面 3-正则', en: 'planar 3-regular'
            })}</td>
              <td>NP-{tr({ zh: '完全 (Garey-Johnson-Tarjan 1976)', en: 'complete (Garey-Johnson-Tarjan 1976)' })}</td>
              <td>NP-{tr({ zh: '完全', en: 'complete' })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: '二部图', en: 'bipartite'
            })}</td>
              <td>NP-{tr({ zh: '完全', en: 'complete' })}</td>
              <td>NP-{tr({ zh: '完全', en: 'complete' })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: '顶点传递', en: 'vertex-transitive'
            })}</td>
              <td>{tr({ zh: '开 (Lovász ⇒ 平凡)', en: 'open (Lovász ⇒ trivial)'
            })}</td>
              <td>{tr({ zh: '开 (Lovász ⇒ 平凡)', en: 'open (Lovász ⇒ trivial)'
            })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: 'Cayley 图', en: 'Cayley graph'
            })}</td>
              <td>{tr({ zh: '开 (猜想 ⇒ 平凡)', en: 'open (conjecture ⇒ trivial)'
            })}</td>
              <td>{tr({ zh: '开 (猜想 ⇒ 平凡)', en: 'open (conjecture ⇒ trivial)'
            })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: '阿贝尔 Cayley', en: 'Abelian Cayley'
            })}</td>
              <td>{tr({ zh: 'P (构造 Gray 码)', en: 'P (Gray code)'
            })}</td>
              <td>P</td>
            </tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>顶点传递 / Cayley 情形的复杂度问题与 Lovász / Cayley 猜想的真伪 <em>同等</em>: 若猜想为真, 判定问题是平凡的 「永远返回 yes」, 复杂度 O(1); 若猜想不真, 反例图给出的 「no」 实例存在, 但复杂度上限仍未知。 这是数学和计算机科学罕见交汇 — 一个组合学的结构猜想直接决定一个判定问题的复杂度类。</>}
            en={<>The complexity of HAM-CYCLE on vertex-transitive / Cayley graphs is <em>equivalent</em> to the truth of Lovász / Cayley conjectures: if true, the problem trivially returns "yes", complexity O(1); if false, "no" instances exist but the upper bound is unknown. A rare meeting of mathematics and computer science — a structural conjecture directly determining the complexity class of a decision problem.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="29.12  小结 · 从 1759 到 2026" en="29.12  Summary · from 1759 to 2026" />
        </h3>
        <p>
          <L
            zh={<>把 §29 的时间线列一下:</>}
            en={<>A timeline of §29:</>}
          />
        </p>
        <ul style={{ paddingLeft: 24, lineHeight: 1.85 }}>
          <li><strong>1759</strong> — <L zh={<>Euler 系统化骑士周游, Hamilton 路径问题的第一种形式。</>} en={<>Euler systematises the knight's tour, the first form of the Hamilton path problem.</>} /></li>
          <li><strong>1823</strong> — <L zh={<>Warnsdorff 启发式: 第一种实用 Hamilton 路径求解器。</>} en={<>Warnsdorff's rule: first practical Hamilton-path heuristic.</>} /></li>
          <li><strong>1857</strong> — <L zh={<>William Hamilton 在他设计的 「Icosian Game」 中以正十二面体提出 Hamilton 圈一词。</>} en={<>William Hamilton's "Icosian Game" on the dodecahedron coins the term "Hamilton cycle".</>} /></li>
          <li><strong>1878</strong> — <L zh={<>Cayley 引入 Cayley 图, 隐含 Cayley 圈猜想。</>} en={<>Cayley introduces the Cayley graph, with the implicit cycle conjecture.</>} /></li>
          <li><strong>1898</strong> — <L zh={<>Petersen 给出 10 顶点的反例 (顶点传递无 Ham 圈)。</>} en={<>Petersen exhibits the 10-vertex counterexample (vertex-transitive, no Ham cycle).</>} /></li>
          <li><strong>1947 / 1953</strong> — <L zh={<>Frank Gray 反射二进制码: <TeX src="\mathbb{Z}_2^n" /> 的 Ham 圈构造。</>} en={<>Frank Gray's reflected binary code: explicit Ham cycle of <TeX src="\mathbb{Z}_2^n" />.</>} /></li>
          <li><strong>1959</strong> — <L zh={<>Rapaport-Strasser: 二面体 Cayley 图含 Ham 圈, 首个非阿贝尔结果。</>} en={<>Rapaport-Strasser: Ham cycles in dihedral Cayley graphs, first non-Abelian result.</>} /></li>
          <li><strong>1970</strong> — <L zh={<>Lovász 猜想 (顶点传递 → Ham 路径)。</>} en={<>Lovász conjecture (vertex-transitive → Ham path).</>} /></li>
          <li><strong>1972</strong> — <L zh={<>Karp: HAM-CYCLE 一般图 NP-完全。</>} en={<>Karp: HAM-CYCLE NP-complete on general graphs.</>} /></li>
          <li><strong>1983 / 1985</strong> — <L zh={<>Marušič: 顶点数 <em>pk</em> 的顶点传递图含 Ham 路径; 系统化 imprimitive block 方法。</>} en={<>Marušič: vertex-transitive graphs of order <em>pk</em> have Ham paths; introduces imprimitive block methods.</>} /></li>
          <li><strong>1986</strong> — <L zh={<>Witte: 所有 <em>p</em>-群 Cayley 图含 Ham 圈。</>} en={<>Witte: every <em>p</em>-group Cayley graph has a Ham cycle.</>} /></li>
          <li><strong>1996</strong> — <L zh={<>Floppy Cube 显式 Ham 圈; 魔方时钟 12 进制 Gray 码。</>} en={<>Floppy Cube explicit Ham cycle; Rubik's Clock base-12 Gray code.</>} /></li>
          <li><strong>2009</strong> — <L zh={<>Kutnar-Marušič 综述; Pak-Radoičić 准定理 (用 CFSG)。</>} en={<>Kutnar-Marušič survey; Pak-Radoičić near-theorem (via CFSG).</>} /></li>
          <li><strong>2018</strong> — <L zh={<>Royle-Spiga: |G| ≤ 200 全部检验通过。</>} en={<>Royle-Spiga: all orders ≤ 200 verified.</>} /></li>
          <li><strong>2026</strong> — <L zh={<>魔方 3×3×3, Pyraminx, Megaminx 仍开放。</>} en={<>Rubik's 3×3×3, Pyraminx, Megaminx still open.</>} /></li>
        </ul>
        <p>
          <L
            zh={<>「魔方所有 <TeX src="4.3 \times 10^{19}" /> 个状态能否用一条公式走遍?」 在 1878 年 Cayley 提出他的图概念时, 这种问法甚至还没成形; 一个半世纪后, 我们能告诉你 这条公式 「几乎肯定存在」 (Pak-Radoičić, 改换生成集), 但用 6 面 18 转的标准生成集 — <strong>不知道</strong>。 把这个问题放在 §14 (Cayley 图)、 §28 (孔明棋的图上 chip-firing)、 §29 (本节) 的主线上, 它正是 「群论几何化」 留给本世纪的最大开题。</>}
            en={<>"Can the cube's <TeX src="4.3 \times 10^{19}" /> states be walked by one alg?" When Cayley introduced his graph in 1878, the question hadn't even been formulated. A century and a half later we can say it <em>almost certainly</em> has an answer "yes" (Pak-Radoičić, with a non-standard generating set), but for the WCA-standard 6-face / 18-move set — <strong>we don't know</strong>. Sitting along §14 (Cayley graphs), §28 (chip-firing on game graphs), §29 (this section), this is the central open problem that "geometrising group theory" has left for the 21st century.</>}
          />
        </p>
      </GTSec>
  );
}
