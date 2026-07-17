'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { applyAlg, invariants, isSolved, thistlethwaiteStage, cycleStructure, identity, CubieState } from '../cube_state';
import { tr } from '@/i18n/tr';
import { TwistyMini } from '../TwistyMini';
import { formatCycle, type FaceLetterChar } from '../gt-helpers';

function CayleyWalker() {
  const lang = useLang();
  const [path, setPath] = useState<string[]>([]);
  const algStr = path.join(' ');

  const state = useMemo<CubieState>(() => {
    try { return applyAlg(identity(), algStr); }
    catch { return identity(); }
  }, [algStr]);

  const isHome = isSolved(state);
  const inv = invariants(state);
  const cornerCycles = cycleStructure(state.cp);
  const edgeCycles = cycleStructure(state.ep);
  const stage = thistlethwaiteStage(state);
  // Note: the displayed "distance bound" is the trivial upper bound = path
  // length. The true minimum could be smaller (optimal solver needed). We
  // honestly label this as "upper bound" rather than "distance."
  const upperBound = path.length;

  const faces: FaceLetterChar[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  // Generators in WCA HTM: face, face', face2 = 18 total.
  const allMoves = faces.flatMap(f => [f, `${f}'`, `${f}2`]);

  function push(m: string) { setPath(p => [...p, m]); }
  function pop() { setPath(p => p.slice(0, -1)); }
  function reset() { setPath([]); }
  function random(n: number) {
    setPath(() => {
      const out: string[] = [];
      let lastFace = '';
      while (out.length < n) {
        const f = faces[Math.floor(Math.random() * 6)];
        if (f === lastFace) continue;
        const variant = ['', "'", '2'][Math.floor(Math.random() * 3)];
        out.push(`${f}${variant}`);
        lastFace = f;
      }
      return out;
    });
  }

  return (
    <div className="gt-cayley-walker">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        {tr({ zh: '互动 § 在 Cayley 图上走一步', en: 'Interactive § Walk one edge of the Cayley graph'
        })}
      </div>
      <div className="gt-cayley-walker-controls">
        <span className="gt-cayley-walker-label">{tr({ zh: '点一个生成元', en: 'click a generator'
        })}</span>
        {allMoves.map(m => (
          <button key={m} className="gt-cayley-walker-move" onClick={() => push(m)}>{m}</button>
        ))}
      </div>
      <div className="gt-cayley-walker-controls">
        <button className="gt-btn-ghost gt-btn" onClick={pop} disabled={path.length === 0}>
          {tr({ zh: '↶ 撤回', en: '↶ undo' })}
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={reset}>
          {tr({ zh: '回到 e', en: 'reset' })}
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={() => random(5)}>
          {tr({ zh: '随机走 5 步', en: 'random walk 5'
        })}
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={() => random(15)}>
          {tr({ zh: '随机 15', en: 'random 15'
        })}
        </button>
      </div>
      <div className="gt-cayley-walker-path">
        {path.length === 0
          ? <span className="gt-cayley-walker-empty">{tr({ zh: '路径 = e (单位元, 起点)', en: 'path = e (identity, start node)'
        })}</span>
          : path.map((m, i) => <span key={i} className="gt-cayley-walker-token">{m}</span>)
        }
      </div>
      <div className="gt-cayley-walker-twisty">
        <TwistyMini alg={algStr} />
      </div>
      <div className="gt-cayley-walker-stats">
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{tr({ zh: '路径长度', en: 'path length'
        })}</div>
          <div className="gt-cayley-walker-stat-val">{path.length}</div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{tr({ zh: 'd(e, g) 上界', en: 'd(e, g) upper bound' })}</div>
          <div className="gt-cayley-walker-stat-val">{upperBound}</div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{tr({ zh: '在 G 中?', en: 'in G?' })}</div>
          <div className="gt-cayley-walker-stat-val" style={{ color: inv.reachable ? 'var(--green)' : 'var(--accent)' }}>
            {inv.reachable ? '✓' : '✗'}
          </div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{tr({ zh: '在子群', en: 'in subgroup' })}</div>
          <div className="gt-cayley-walker-stat-val" style={{ fontSize: 14 }}>G<sub>{stage}</sub></div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{tr({ zh: '角块循环', en: 'corner cyc.'
        })}</div>
          <div className="gt-cayley-walker-stat-val" style={{ fontSize: 13 }}>{formatCycle(cornerCycles, lang)}</div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{tr({ zh: '棱块循环', en: 'edge cyc.'
        })}</div>
          <div className="gt-cayley-walker-stat-val" style={{ fontSize: 13 }}>{formatCycle(edgeCycles, lang)}</div>
        </div>
      </div>
      <div className="gt-aside" style={{ marginTop: 12, marginBottom: 0 }}>
        {isHome && path.length > 0
          ? (lang === 'zh' ? `走了 ${path.length} 步又回到 e — 你转了一个圈 (这条路径是 G 中的一个 ${path.length}-阶元素)。` : `Walked ${path.length} steps and returned to e — you traced a cycle (this path is an ${path.length}-order element of G).`)
          : tr({ zh: '每个按钮都是一条边。路径长度 = 在 Cayley 图上的步数 (≥ 真实距离 d(e,g))。', en: 'Each button is an edge. Path length = walk length in Cayley graph (≥ the true distance d(e, g)).'
                          })}
      </div>
    </div>
  );
}

// BFS sphere sizes |S_r| at each HTM radius in the full cube Cayley graph.
// These are the *exact* known counts (same as GOD_DIST below, repeated here
// for use in the §14 BFS table to avoid forward references). Source: Rokicki
// et al. 2010, cube20.org.

// et al. 2010, cube20.org.
const CAYLEY_SPHERE: { d: number; count: bigint; exact: boolean }[] = [
  { d: 0, count: 1n, exact: true },
  { d: 1, count: 18n, exact: true },
  { d: 2, count: 243n, exact: true },
  { d: 3, count: 3_240n, exact: true },
  { d: 4, count: 43_239n, exact: true },
  { d: 5, count: 574_908n, exact: true },
  { d: 6, count: 7_618_438n, exact: true },
  { d: 7, count: 100_803_036n, exact: true },
  { d: 8, count: 1_332_343_288n, exact: true },
  { d: 9, count: 17_596_479_795n, exact: true },
  { d: 10, count: 232_248_063_316n, exact: true },
  { d: 11, count: 3_063_288_809_012n, exact: true },
  { d: 12, count: 40_374_425_656_248n, exact: true },
  { d: 13, count: 531_653_418_284_628n, exact: true },
  { d: 14, count: 6_989_320_578_825_358n, exact: true },
  { d: 15, count: 91_365_146_187_124_313n, exact: true },
  { d: 16, count: 1_100_531_606_815_050_000n, exact: false },
  { d: 17, count: 12_217_338_577_780_000_000n, exact: false },
  { d: 18, count: 29_290_000_000_000_000_000n, exact: false },
  { d: 19, count: 1_357_000_000_000_000_000n, exact: false },
  { d: 20, count: 490_000_000n, exact: true },
];

function CayleyBFSTable() {
  const maxLog = Math.log10(Number(CAYLEY_SPHERE[18].count));
  return (
    <div className="gt-cayley-bfs">
      <div className="gt-cayley-bfs-row head">
        <div>{tr({ zh: '距离 d', en: 'radius d'
        })}</div>
        <div>{tr({ zh: '球壳 |S_d| (对数刻度)', en: '|S_d| (log-scale bar)'
        })}</div>
        <div>{tr({ zh: '状态数', en: 'count'
        })}</div>
      </div>
      {CAYLEY_SPHERE.map(({ d, count, exact }) => {
        const log = Math.log10(Number(count));
        return (
          <div key={d} className="gt-cayley-bfs-row">
            <div className="gt-cayley-bfs-depth">{d}</div>
            <div>
              <div className="gt-cayley-bfs-bar" style={{ width: `${Math.max(2, (log / maxLog) * 100)}%` }} />
            </div>
            <div className="gt-cayley-bfs-count">
              {count.toLocaleString()}{!exact && <span style={{ color: 'var(--ink-faint)', marginLeft: 4 }}>≈</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Cayley graph mini (§14) ───────────────────────────────────────────────
// A tiny visualization: subgroup ⟨R, U⟩'s first few BFS layers as a Cayley graph.
// Because the full graph has 73,483,200 nodes (the order of ⟨R, U⟩), we just
// render the identity, its first neighbours, and a few second-layer nodes —
// enough to convey the geometric idea.

// enough to convey the geometric idea.
function CayleyMini() {
  // Pre-computed positions of nodes at depths 0, 1, 2 in a layout-friendly form.
  // Layer 0: e
  // Layer 1: R, R', R2, U, U', U2
  // Layer 2 sample: U R, R U, R U', U R', U2 R, R2 U, R U2, U' R...
  const W = 720, H = 360;
  const cx = W / 2, cy = H / 2;
  const nodes = [
    { id: 'e',    x: cx,        y: cy,        label: 'e',  solved: true,  layer: 0 },
    { id: 'R',    x: cx + 100,  y: cy - 60,   label: 'R',  layer: 1 },
    { id: "R'",   x: cx - 100,  y: cy - 60,   label: "R'", layer: 1 },
    { id: 'R2',   x: cx,        y: cy - 120,  label: 'R²', layer: 1 },
    { id: 'U',    x: cx + 100,  y: cy + 60,   label: 'U',  layer: 1 },
    { id: "U'",   x: cx - 100,  y: cy + 60,   label: "U'", layer: 1 },
    { id: 'U2',   x: cx,        y: cy + 120,  label: 'U²', layer: 1 },
    { id: 'RU',   x: cx + 220,  y: cy + 10,   label: 'RU', layer: 2 },
    { id: 'UR',   x: cx + 220,  y: cy - 10,   label: 'UR', layer: 2 },
    { id: "RU'",  x: cx + 240,  y: cy + 90,   label: "RU'",layer: 2 },
    { id: "UR'",  x: cx + 240,  y: cy - 110,  label: "UR'",layer: 2 },
    { id: "R'U",  x: cx - 240,  y: cy + 90,   label: "R'U",layer: 2 },
    { id: "R'U'", x: cx - 240,  y: cy - 10,   label: "R'U'",layer: 2 },
    { id: "U'R",  x: cx - 240,  y: cy - 110,  label: "U'R",layer: 2 },
    { id: "U'R'", x: cx - 240,  y: cy + 110,  label: "U'R'",layer: 2 },
  ];
  // Edges from each node by R or U (only show same-layer-and-up neighbours)
  const edges = [
    // R edges (red)
    ['e', 'R', 'R'], ['R', 'R2', 'R'], ['R2', "R'", 'R'], ["R'", 'e', 'R'],
    ['U', 'UR', 'R'], ['R', 'RU', 'U'],
    // U edges (blue)
    ['e', 'U', 'U'], ['U', 'U2', 'U'], ['U2', "U'", 'U'], ["U'", 'e', 'U'],
    ['R', 'RU', 'U'], ['U', 'UR', 'R'],
    [ "R'", "R'U", 'U'], [ "U'", "U'R", 'R'], ["U'", "U'R'", 'R'],
  ];
  const nMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="gt-cayley-svg">
        {edges.map(([a, b, kind], i) => {
          const na = nMap[a], nb = nMap[b];
          if (!na || !nb) return null;
          return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} className={`gt-cayley-edge gt-cayley-edge-${(kind as string).toLowerCase()}`} />;
        })}
        {nodes.map((n) => (
          <g key={n.id} className={`gt-cayley-node ${n.solved ? 'gt-cayley-node-solved' : ''}`}>
            <circle cx={n.x} cy={n.y} r={n.layer === 0 ? 22 : 18} />
            <text x={n.x} y={n.y + 4}>{n.label}</text>
          </g>
        ))}
      </svg>
      <div className="gt-cayley-legend">
        <span><span className="gt-cayley-legend-swatch" style={{ background: 'var(--accent)' }} />R</span>
        <span><span className="gt-cayley-legend-swatch" style={{ background: 'var(--accent-2)' }} />U</span>
        <span style={{ marginLeft: 12 }}>{tr({ zh: '节点 = 状态', en: 'nodes = states'
        })}</span>
      </div>
    </div>
  );
}

// ── Sphere log-scale plot (§14.3) ─────────────────────────────────────────
// Interactive log-scale plot of |S_d| for d = 0..20. Hover any bar to see
// the count, percentage of |G|, and instantaneous branching factor.

// the count, percentage of |G|, and instantaneous branching factor.
function SphereLogPlot() {
  const [hover, setHover] = useState<number | null>(null);
  const W = 740, H = 320, ML = 56, MR = 24, MT = 18, MB = 38;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;
  const maxLog = 20;
  const dx = plotW / 21;
  const xOf = (d: number) => ML + d * dx;
  const yOf = (logV: number) => MT + plotH - (logV / maxLog) * plotH;
  const data = useMemo(() => CAYLEY_SPHERE.map(s => ({
    ...s,
    log: Math.log10(Math.max(1, Number(s.count))),
    pct: (Number(s.count) / 4.3252e19) * 100,
  })), []);
  const branchingAt = (d: number): number | null => {
    if (d === 0) return null;
    return Number(CAYLEY_SPHERE[d].count) / Number(CAYLEY_SPHERE[d - 1].count);
  };
  const yTicks = [0, 4, 8, 12, 16, 19];
  return (
    <div className="gt-sphere-plot">
      <svg viewBox={`0 0 ${W} ${H}`} className="gt-sphere-svg" role="img" aria-label={tr({ zh: '球壳大小对数图', en: 'sphere size log plot'
    })}>
        {yTicks.map(t => (
          <g key={t}>
            <line x1={ML} y1={yOf(t)} x2={W - MR} y2={yOf(t)} className="gt-sphere-grid" />
            <text x={ML - 8} y={yOf(t) + 4} className="gt-sphere-axis-text" textAnchor="end">10<tspan baselineShift="super" fontSize="9">{t}</tspan></text>
          </g>
        ))}
        {Array.from({ length: 21 }, (_, i) => i).map(d => (
          <text key={d} x={xOf(d) + dx / 2} y={H - MB + 16} className="gt-sphere-axis-text" textAnchor="middle">{d}</text>
        ))}
        <text x={ML - 44} y={MT + 4} className="gt-sphere-axis-text" textAnchor="start">|S<tspan baselineShift="sub" fontSize="9">d</tspan>|</text>
        <text x={W - MR} y={H - 6} className="gt-sphere-axis-text" textAnchor="end">{tr({ zh: '距离 d', en: 'distance d'
        })}</text>
        {data.map((s, i) => {
          const isPeak = s.d === 18;
          const isHovered = hover === i;
          const barH = MT + plotH - yOf(s.log);
          return (
            <g key={s.d} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={xOf(s.d) + 2} y={yOf(s.log)} width={dx - 4} height={barH} className={`gt-sphere-bar ${isPeak ? 'gt-sphere-bar-peak' : ''} ${isHovered ? 'gt-sphere-bar-hover' : ''}`} />
              {!s.exact && (
                <text x={xOf(s.d) + dx / 2} y={yOf(s.log) - 4} className="gt-sphere-approx" textAnchor="middle">≈</text>
              )}
            </g>
          );
        })}
        <line x1={xOf(18) + dx / 2} y1={yOf(data[18].log) - 4} x2={xOf(18) + dx / 2} y2={yOf(data[18].log) - 22} className="gt-sphere-ann" />
        <text x={xOf(18) + dx / 2} y={yOf(data[18].log) - 26} className="gt-sphere-peak" textAnchor="middle">{tr({ zh: '峰值 d=18', en: 'peak d=18' })}</text>
      </svg>
      <div className="gt-sphere-readout">
        {hover === null ? (
          <span className="gt-sphere-readout-empty">{tr({ zh: '悬停某根条 → 显示该距离的详细数据', en: 'hover a bar for that radius'
        })}</span>
        ) : (
          <>
            <span><strong>d = {data[hover].d}</strong></span>
            <span>|S<sub>d</sub>| = {CAYLEY_SPHERE[hover].count.toLocaleString()}{!data[hover].exact && ' ≈'}</span>
            <span>{tr({ zh: '占 |G|:', en: '% of |G|:'
            })} {data[hover].pct < 1e-6 ? data[hover].pct.toExponential(2) : data[hover].pct.toFixed(4)}%</span>
            {branchingAt(data[hover].d) !== null && (
              <span>{tr({ zh: '分支因子:', en: 'branching:' })} ×{branchingAt(data[hover].d)!.toFixed(2)}</span>
            )}
          </>
        )}
      </div>
      <div className="gt-aside" style={{ marginTop: 8, marginBottom: 0 }}>
        {tr({ zh: '前 13 步增长率稳定在 ≈ 17.97× (略低于 18 — 因为 R 后不能立刻走 R\'); d = 18 达到 ≈ 2.93 × 10¹⁹ 的峰值; d = 20 仅剩 ≈ 4.9 亿状态, 其中包含 superflip。 这是「球面填空」在有限图上的几何后果 — 顶端必然收缩。', en: 'Steady growth at ~17.97× for d ≤ 13 (just below 18 because R cannot be immediately undone). Peak at d = 18 ≈ 2.93 × 10¹⁹. By d = 20 only ~490 million states remain (superflip among them). This is the geometric consequence of "sphere packing in a finite graph" — the outer tip must shrink.'
        })}
      </div>
    </div>
  );
}

// ── Small-group toolkit (§14.x interactive) ───────────────────────────────
// Generic finite group built by BFS from a list of generator permutations.
// Works for D_n, S_n (small n), A_n (small n), Z/n, Z/m × Z/n, Q_8.

// Works for D_n, S_n (small n), A_n (small n), Z/n, Z/m × Z/n, Q_8.
type SmallGroup = {
  id: string;
  zh: string;
  en: string;
  // permutation generators (each is a number[] of equal length, acting on {0..N-1})
  gens: { label: string; perm: number[]; cssVar: string }[];
  // optional fixed-layout for cyclic / direct product groups
  layoutZh?: string;
  layoutEn?: string;
  layout?: 'cycle' | 'grid' | 'force';
  // for 'grid' layouts only
  rows?: number; cols?: number;
};

function permCompose(p: number[], q: number[]): number[] {
  // Right action: (g * s)(x) = s(g(x)); we treat perm as image array, so
  // compose returns the permutation that maps x to p[q[x]] — i.e. apply q
  // first, then p. This matches "walk on right" convention for Cay(G, S).
  return q.map(x => p[x]);
}

function permEq(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function permId(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }

function permKey(p: number[]): string { return p.join(','); }

function permInverse(p: number[]): number[] {
  const inv = new Array(p.length);
  for (let i = 0; i < p.length; i++) inv[p[i]] = i;
  return inv;
}

// Build the whole group from a list of (closed-under-inversion) generators.
// Returns the multiplication table mul[i][j] = index of (g_i * g_j), the
// indices of the generators in the enumeration, and the list of elements.

// indices of the generators in the enumeration, and the list of elements.
type BuiltGroup = {
  elements: number[][];
  mul: number[][];
  identity: number;
  genIndices: number[];
  edgesByGen: { src: number; dst: number; gen: number }[];
};

function buildGroup(gens: number[][]): BuiltGroup {
  if (gens.length === 0) return { elements: [], mul: [], identity: 0, genIndices: [], edgesByGen: [] };
  const n = gens[0].length;
  const id = permId(n);
  const list: number[][] = [id];
  const map = new Map<string, number>([[permKey(id), 0]]);
  // close under right multiplication by gens (and their inverses).
  const closure: number[][] = [];
  for (const g of gens) closure.push(g);
  // ensure inverses present (so the Cayley graph is undirected)
  for (const g of gens) {
    const inv = permInverse(g);
    if (!closure.some(x => permEq(x, inv))) closure.push(inv);
  }
  let head = 0;
  while (head < list.length) {
    const g = list[head++];
    for (const s of closure) {
      const h = permCompose(g, s);
      const k = permKey(h);
      if (!map.has(k)) { map.set(k, list.length); list.push(h); }
    }
  }
  const N = list.length;
  const mul: number[][] = Array.from({ length: N }, () => new Array(N).fill(-1));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      mul[i][j] = map.get(permKey(permCompose(list[i], list[j])))!;
    }
  }
  const genIndices = gens.map(g => map.get(permKey(g))!);
  const edgesByGen: { src: number; dst: number; gen: number }[] = [];
  for (let i = 0; i < N; i++) {
    for (let gi = 0; gi < gens.length; gi++) {
      const dst = mul[i][genIndices[gi]];
      edgesByGen.push({ src: i, dst, gen: gi });
    }
  }
  return { elements: list, mul, identity: 0, genIndices, edgesByGen };
}

// BFS to find distances from the identity using the chosen generators.

// BFS to find distances from the identity using the chosen generators.
function bfsFromIdentity(b: BuiltGroup, activeGens: number[]): { dist: number[]; pred: number[]; predGen: number[] } {
  const N = b.elements.length;
  const dist = new Array(N).fill(-1);
  const pred = new Array(N).fill(-1);
  const predGen = new Array(N).fill(-1);
  dist[b.identity] = 0;
  const queue: number[] = [b.identity];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    for (const gi of activeGens) {
      const v = b.mul[u][b.genIndices[gi]];
      if (dist[v] === -1) {
        dist[v] = dist[u] + 1;
        pred[v] = u; predGen[v] = gi;
        queue.push(v);
      }
    }
  }
  return { dist, pred, predGen };
}

// Find girth: shortest non-trivial cycle. For a vertex-transitive Cayley
// graph this equals the shortest cycle through the identity, so a single
// BFS from e suffices. The graph is treated as undirected and simple — we
// dedupe each edge once and skip BFS tree edges. (An involution s with
// s² = e contributes a single undirected edge, not a 2-cycle.)

// s² = e contributes a single undirected edge, not a 2-cycle.)
function computeGirth(b: BuiltGroup, bfs: { dist: number[]; pred: number[] }): number {
  let girth = Infinity;
  const N = b.elements.length;
  const seen = new Set<string>();
  for (let i = 0; i < N; i++) {
    if (bfs.dist[i] === -1) continue;
    for (const gi of b.genIndices) {
      const j = b.mul[i][gi];
      if (j === i) continue;
      if (bfs.dist[j] === -1) continue;
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(k)) continue;
      seen.add(k);
      // Skip the tree edge that BFS used to reach j (or i).
      if (bfs.pred[j] === i || bfs.pred[i] === j) continue;
      const cyc = bfs.dist[i] + bfs.dist[j] + 1;
      if (cyc >= 3 && cyc < girth) girth = cyc;
    }
  }
  return girth === Infinity ? 0 : girth;
}

// ── Predefined small groups ──────────────────────────────────────────────

// ── Predefined small groups ──────────────────────────────────────────────
const SMALL_GROUPS: SmallGroup[] = [
  {
    id: 'z8', zh: 'ℤ/8 (循环, 单生成元)', en: 'ℤ/8 (cyclic, one generator)',
    layout: 'cycle',
    gens: [
      { label: '+1', perm: [1, 2, 3, 4, 5, 6, 7, 0], cssVar: '--accent' },
    ]
},
  {
    id: 'z8b', zh: 'ℤ/8 (双生成元 +1, +3)', en: 'ℤ/8 (two generators +1, +3)',
    layout: 'cycle',
    gens: [
      { label: '+1', perm: [1, 2, 3, 4, 5, 6, 7, 0], cssVar: '--accent' },
      { label: '+3', perm: [3, 4, 5, 6, 7, 0, 1, 2], cssVar: '--accent-2' },
    ]
},
  {
    id: 'z4z3', zh: 'ℤ/4 × ℤ/3 (网格)', en: 'ℤ/4 × ℤ/3 (grid)',
    layout: 'grid', rows: 3, cols: 4,
    gens: [
      // 4 rows of 3 = 12 elements. (i, j) ↔ 4j + i ∈ {0..11}.
      // +1 in ℤ/4 direction
      { label: 'x', perm: [1, 2, 3, 0, 5, 6, 7, 4, 9, 10, 11, 8], cssVar: '--accent' },
      // +1 in ℤ/3 direction
      { label: 'y', perm: [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3], cssVar: '--accent-2' },
    ]
},
  {
    id: 'd4', zh: '二面体 D₄ (正方形对称)', en: 'Dihedral D₄ (square symmetries)',
    layout: 'force',
    gens: [
      // 4-cycle (1234) acts on positions 0..3 (the rotation r)
      { label: 'r', perm: [1, 2, 3, 0], cssVar: '--accent' },
      // reflection s = (1 3)(2)(4) on positions 0..3
      { label: 's', perm: [0, 3, 2, 1], cssVar: '--accent-2' },
    ]
},
  {
    id: 's3', zh: '对称群 S₃ (3 元置换)', en: 'Symmetric S₃ (3 perms)',
    layout: 'force',
    gens: [
      { label: '(12)', perm: [1, 0, 2], cssVar: '--accent' },
      { label: '(23)', perm: [0, 2, 1], cssVar: '--accent-2' },
    ]
},
  {
    id: 's4-adj', zh: 'S₄ (相邻换位 (12),(23),(34))', en: 'S₄ (adjacent transpositions)',
    layout: 'force',
    gens: [
      { label: '(12)', perm: [1, 0, 2, 3], cssVar: '--accent' },
      { label: '(23)', perm: [0, 2, 1, 3], cssVar: '--accent-2' },
      { label: '(34)', perm: [0, 1, 3, 2], cssVar: '--accent-3' },
    ]
},
  {
    id: 's4-cycle', zh: 'S₄ (4-循环 + 换位)', en: 'S₄ (4-cycle + transposition)',
    layout: 'force',
    gens: [
      { label: '(1234)', perm: [1, 2, 3, 0], cssVar: '--accent' },
      { label: '(12)', perm: [1, 0, 2, 3], cssVar: '--accent-2' },
    ]
},
  {
    id: 'a4', zh: '交错群 A₄ (3-循环 (123),(124))', en: 'Alternating A₄ (3-cycles (123),(124))',
    layout: 'force',
    gens: [
      { label: '(123)', perm: [1, 2, 0, 3], cssVar: '--accent' },
      { label: '(124)', perm: [1, 3, 2, 0], cssVar: '--accent-2' },
    ]
},
];

// Build all groups once (memoized at module scope).

// Build all groups once (memoized at module scope).
const SMALL_GROUPS_BUILT: Map<string, BuiltGroup> = new Map();
for (const g of SMALL_GROUPS) {
  SMALL_GROUPS_BUILT.set(g.id, buildGroup(g.gens.map(x => x.perm)));
}

// ── Layout helpers ────────────────────────────────────────────────────────

// ── Layout helpers ────────────────────────────────────────────────────────
function layoutForGroup(g: SmallGroup, built: BuiltGroup, W: number, H: number): { x: number; y: number }[] {
  const N = built.elements.length;
  if (g.layout === 'cycle') {
    const r = Math.min(W, H) * 0.4;
    return Array.from({ length: N }, (_, i) => {
      const a = (2 * Math.PI * i) / N - Math.PI / 2;
      return { x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a) };
    });
  }
  if (g.layout === 'grid' && g.rows && g.cols) {
    const rows = g.rows, cols = g.cols;
    const padX = 60, padY = 36;
    const gx = (W - 2 * padX) / Math.max(1, cols - 1);
    const gy = (H - 2 * padY) / Math.max(1, rows - 1);
    return Array.from({ length: N }, (_, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      return { x: padX + c * gx, y: padY + r * gy };
    });
  }
  // force-directed: Fruchterman-Reingold
  // Seed positions on a small circle so we don't bias on Math.random().
  const pos = Array.from({ length: N }, (_, i) => {
    const a = (2 * Math.PI * i) / N;
    return { x: W / 2 + Math.cos(a) * (W * 0.25), y: H / 2 + Math.sin(a) * (H * 0.25) };
  });
  // Edges as undirected pairs (deduped).
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];
  for (const e of built.edgesByGen) {
    if (e.src === e.dst) continue;
    const a = Math.min(e.src, e.dst), b = Math.max(e.src, e.dst);
    const k = `${a}-${b}`;
    if (!edgeSet.has(k)) { edgeSet.add(k); edges.push([a, b]); }
  }
  const k = Math.sqrt((W * H) / N) * 0.85;
  let t = W / 8;
  const iters = N <= 12 ? 220 : N <= 24 ? 300 : 380;
  for (let it = 0; it < iters; it++) {
    const disp = Array.from({ length: N }, () => ({ x: 0, y: 0 }));
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const f = (k * k) / d;
        const ux = (dx / d) * f, uy = (dy / d) * f;
        disp[i].x += ux; disp[i].y += uy;
        disp[j].x -= ux; disp[j].y -= uy;
      }
    }
    for (const [a, b] of edges) {
      const dx = pos[a].x - pos[b].x, dy = pos[a].y - pos[b].y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const f = (d * d) / k;
      const ux = (dx / d) * f, uy = (dy / d) * f;
      disp[a].x -= ux; disp[a].y -= uy;
      disp[b].x += ux; disp[b].y += uy;
    }
    for (let i = 0; i < N; i++) {
      const dx = disp[i].x, dy = disp[i].y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      pos[i].x += (dx / d) * Math.min(d, t);
      pos[i].y += (dy / d) * Math.min(d, t);
      pos[i].x = Math.max(28, Math.min(W - 28, pos[i].x));
      pos[i].y = Math.max(28, Math.min(H - 28, pos[i].y));
    }
    t *= 0.965;
  }
  return pos;
}

function elementLabel(perm: number[]): string {
  // Cycle-notation string. (1 2 3) for the cycle 1→2→3→1; identity = e.
  const n = perm.length;
  const seen = new Array(n).fill(false);
  const cycles: string[] = [];
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    if (perm[i] === i) { seen[i] = true; continue; }
    const c: number[] = [i];
    seen[i] = true;
    let j = perm[i];
    while (j !== i) { c.push(j); seen[j] = true; j = perm[j]; }
    cycles.push(c.map(x => x + 1).join(' '));
  }
  return cycles.length === 0 ? 'e' : cycles.map(c => `(${c})`).join('');
}

// ── Component: SmallGroupCayleyExplorer (§14.x) ───────────────────────────

// ── Component: SmallGroupCayleyExplorer (§14.x) ───────────────────────────
function SmallGroupCayleyExplorer() {
  const [groupId, setGroupId] = useState('d4');
  const [hover, setHover] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const spec = SMALL_GROUPS.find(g => g.id === groupId)!;
  const built = SMALL_GROUPS_BUILT.get(groupId)!;
  const W = 600, H = 380;
  const pos = useMemo(() => layoutForGroup(spec, built, W, H), [groupId]);
  const bfs = useMemo(() => bfsFromIdentity(built, spec.gens.map((_, i) => i)), [groupId]);
  const diameter = useMemo(() => Math.max(...bfs.dist), [bfs]);
  const girth = useMemo(() => computeGirth(built, bfs), [groupId, bfs]);
  // shortest-path edges from e to hovered/target
  const pathEdges: Set<string> = useMemo(() => {
    const set = new Set<string>();
    const sink = target ?? hover;
    if (sink === null) return set;
    let v = sink;
    while (v !== built.identity && bfs.pred[v] !== -1) {
      const u = bfs.pred[v];
      set.add(`${u}-${v}-${bfs.predGen[v]}`);
      v = u;
    }
    return set;
  }, [hover, target, groupId, bfs]);
  // de-duped edge list for rendering (skip self-loops where g * s = g)
  const edges: { from: number; to: number; gen: number; key: string }[] = useMemo(() => {
    const seen = new Set<string>();
    const out: { from: number; to: number; gen: number; key: string }[] = [];
    for (const e of built.edgesByGen) {
      if (e.src === e.dst) continue;
      const a = Math.min(e.src, e.dst), b = Math.max(e.src, e.dst);
      const k = `${a}-${b}-${e.gen}`;
      if (!seen.has(k)) { seen.add(k); out.push({ from: e.src, to: e.dst, gen: e.gen, key: k }); }
    }
    return out;
  }, [groupId]);
  // sphere sizes
  const spheres: number[] = useMemo(() => {
    const out: number[] = [];
    for (const d of bfs.dist) {
      if (d < 0) continue;
      out[d] = (out[d] || 0) + 1;
    }
    return out;
  }, [bfs]);
  return (
    <div className="gt-sg-explorer">
      <div className="gt-sg-row gt-sg-row-top">
        <label className="gt-sg-label">{tr({ zh: '挑一个群 G', en: 'pick a group G'
        })}</label>
        <select className="gt-sg-select" value={groupId} onChange={e => { setGroupId(e.target.value); setHover(null); setTarget(null); }}>
          {SMALL_GROUPS.map(g => (
            <option key={g.id} value={g.id}>{tr(g)}</option>
          ))}
        </select>
        <div className="gt-sg-legend">
          {spec.gens.map((g, i) => (
            <span key={i} className="gt-sg-legend-item">
              <span className="gt-sg-legend-swatch" style={{ background: `var(${g.cssVar})` }} />
              {g.label}
            </span>
          ))}
        </div>
      </div>
      <div className="gt-sg-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} className="gt-sg-svg">
          {edges.map(e => {
            const a = pos[e.from], b = pos[e.to];
            if (!a || !b) return null;
            const isPath = pathEdges.has(`${e.from}-${e.to}-${e.gen}`) || pathEdges.has(`${e.to}-${e.from}-${e.gen}`);
            const cssVar = spec.gens[e.gen].cssVar;
            return (
              <line key={e.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={`var(${cssVar})`}
                strokeWidth={isPath ? 3.4 : 1.6}
                opacity={isPath ? 1 : 0.6}
              />
            );
          })}
          {built.elements.map((_, i) => {
            const p = pos[i];
            if (!p) return null;
            const d = bfs.dist[i];
            const isE = i === built.identity;
            const isHovered = hover === i;
            const isTarget = target === i;
            const r = isE ? 16 : isHovered || isTarget ? 14 : 11;
            return (
              <g key={i}
                 onMouseEnter={() => setHover(i)}
                 onMouseLeave={() => setHover(null)}
                 onClick={() => setTarget(t => t === i ? null : i)}
                 className="gt-sg-node">
                <circle cx={p.x} cy={p.y} r={r}
                  fill={isE ? 'var(--green)' : isTarget ? 'var(--accent)' : 'var(--bg-elev)'}
                  stroke={isHovered ? 'var(--accent-2)' : 'var(--ink-dim)'}
                  strokeWidth={isE || isHovered || isTarget ? 2.4 : 1.3}
                />
                <text x={p.x} y={p.y + 4} textAnchor="middle" className="gt-sg-node-label">
                  {isE ? 'e' : d < 10 ? String(d) : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="gt-sg-readout">
        {hover !== null || target !== null ? (() => {
          const i = target ?? hover!;
          return (
            <>
              <div className="gt-sg-readout-item">
                <span className="gt-sg-readout-label">{tr({ zh: '元素 g', en: 'element g' })}</span>
                <span className="gt-sg-readout-val gt-mono">{elementLabel(built.elements[i])}</span>
              </div>
              <div className="gt-sg-readout-item">
                <span className="gt-sg-readout-label">d(e, g)</span>
                <span className="gt-sg-readout-val">{bfs.dist[i]}</span>
              </div>
              <div className="gt-sg-readout-item">
                <span className="gt-sg-readout-label">{tr({ zh: '阶 ord(g)', en: 'order ord(g)'
                })}</span>
                <span className="gt-sg-readout-val">{(() => {
                  let v = i, n = 0;
                  do { v = built.mul[v][i]; n++; } while (v !== built.identity && n < built.elements.length);
                  return n;
                })()}</span>
              </div>
            </>
          );
        })() : (
          <span className="gt-sg-readout-empty">{tr({ zh: '悬停一个节点 → 显示 g, d(e,g), ord(g);   点击 → 锁定 + 显示最短路径', en: 'hover a node → g, d(e,g), ord(g);   click → lock + show shortest path'
        })}</span>
        )}
      </div>
      <div className="gt-sg-stats">
        <div className="gt-sg-stat"><div className="gt-sg-stat-label">|G|</div><div className="gt-sg-stat-val">{built.elements.length}</div></div>
        <div className="gt-sg-stat"><div className="gt-sg-stat-label">|S|</div><div className="gt-sg-stat-val">{spec.gens.length}</div></div>
        <div className="gt-sg-stat"><div className="gt-sg-stat-label">{tr({ zh: '直径', en: 'diameter'
        })}</div><div className="gt-sg-stat-val">{diameter}</div></div>
        <div className="gt-sg-stat"><div className="gt-sg-stat-label">{tr({ zh: '围长', en: 'girth'
        })}</div><div className="gt-sg-stat-val">{girth || '—'}</div></div>
        <div className="gt-sg-stat"><div className="gt-sg-stat-label">|E|</div><div className="gt-sg-stat-val">{edges.length}</div></div>
        <div className="gt-sg-stat">
          <div className="gt-sg-stat-label">{tr({ zh: '球壳 |S_d|', en: 'spheres |S_d|'
        })}</div>
          <div className="gt-sg-stat-val gt-mono" style={{ fontSize: 12 }}>{spheres.join(', ')}</div>
        </div>
      </div>
      <div className="gt-aside" style={{ marginTop: 12, marginBottom: 0 }}>
        {tr({ zh: '生成元颜色 = 边色; 节点数字 = d(e, g); 中心绿点 = 单位元 e。 切换不同生成集观察 — 同一个 G 的直径会变 (e.g. ℤ/8 配 {+1} 直径 = 4, 配 {+1, +3} 直径 = 2)。', en: 'Generator = edge colour; node number = d(e, g); central green = identity e. Switch generators to see how |E|, diameter, girth all change for the same G (e.g. ℤ/8 with {+1} has diameter 4; with {+1, +3} it drops to 2).'
        })}
      </div>
    </div>
  );
}

// ── Component: RandomWalkMixingPlot (§14.x) ───────────────────────────────
// Watch a simple random walk on a small group converge to uniform. We
// compute exact distributions by left-multiplying p_t by the transition
// matrix, then plot TV(p_t, U) vs t.

// matrix, then plot TV(p_t, U) vs t.
const MIXING_GROUPS: { id: string; zh: string; en: string; spec: string
 }[] = [
  { id: 'd4',       zh: 'D₄ (8)',  en: 'D₄ (8)',       spec: 'd4' },
  { id: 's3',       zh: 'S₃ (6)',  en: 'S₃ (6)',       spec: 's3' },
  { id: 's4-adj',   zh: 'S₄ 相邻换位 (24)', en: 'S₄ adj. transpositions (24)', spec: 's4-adj'
},
  { id: 'a4',       zh: 'A₄ (12)', en: 'A₄ (12)',      spec: 'a4' },
  { id: 'z4z3',     zh: 'ℤ/4 × ℤ/3 (12)', en: 'ℤ/4 × ℤ/3 (12)', spec: 'z4z3' },
];

function totalVariation(p: Float64Array): number {
  const N = p.length;
  const u = 1 / N;
  let tv = 0;
  for (let i = 0; i < N; i++) tv += Math.abs(p[i] - u);
  return tv / 2;
}

function RandomWalkMixingPlot() {
  const lang = useLang();
  const [groupId, setGroupId] = useState('s4-adj');
  const [step, setStep] = useState(0);
  const mg = MIXING_GROUPS.find(g => g.id === groupId)!;
  const built = SMALL_GROUPS_BUILT.get(mg.spec)!;
  const N = built.elements.length;
  // transition matrix as sparse: for each i, which j and weight
  const T_MAX = 80;
  // Lazy random walk: at each step, with prob 1/2 stay put, otherwise pick
  // uniformly from S ∪ S^{-1}. Lazy walks always converge to uniform — they
  // bypass bipartiteness (e.g. S_n with transpositions flips sign every step,
  // so the non-lazy walk never converges to U).
  const { stepFn, tvSeries } = useMemo(() => {
    const invGenIdx: number[] = built.genIndices.map(gi => {
      for (let j = 0; j < N; j++) if (built.mul[gi][j] === built.identity) return j;
      return gi;
    });
    const stepGens = [...built.genIndices, ...invGenIdx];
    const neigh: number[][] = Array.from({ length: N }, (_, i) => stepGens.map(gj => built.mul[i][gj]));
    const wEach = 0.5 / stepGens.length;
    const advance = (p: Float64Array): Float64Array => {
      const q = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const pi = p[i];
        if (pi === 0) continue;
        q[i] += pi * 0.5;
        for (const j of neigh[i]) q[j] += pi * wEach;
      }
      return q as Float64Array;
    };
    let p: Float64Array = new Float64Array(N);
    p[built.identity] = 1;
    const out: number[] = [totalVariation(p)];
    for (let t = 1; t <= T_MAX; t++) {
      p = advance(p);
      out.push(totalVariation(p));
    }
    return { stepFn: advance, tvSeries: out };
  }, [groupId]);
  const currentP = useMemo(() => {
    let p: Float64Array = new Float64Array(N);
    p[built.identity] = 1;
    for (let t = 0; t < step; t++) p = stepFn(p);
    return p;
  }, [groupId, step, stepFn]);
  // Plot
  const W = 720, H = 220, ML = 56, MR = 16, MT = 12, MB = 32;
  const plotW = W - ML - MR, plotH = H - MT - MB;
  const xOf = (t: number) => ML + (t / T_MAX) * plotW;
  const yOf = (v: number) => MT + plotH - (v / 1) * plotH;
  return (
    <div className="gt-mix-plot">
      <div className="gt-sg-row gt-sg-row-top">
        <label className="gt-sg-label">{tr({ zh: '群 (生成集 = 上方所有元)', en: 'group (generators = listed above)' })}</label>
        <select className="gt-sg-select" value={groupId} onChange={e => { setGroupId(e.target.value); setStep(0); }}>
          {MIXING_GROUPS.map(g => (
            <option key={g.id} value={g.id}>{tr(g)}</option>
          ))}
        </select>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="gt-mix-svg">
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={t}>
            <line x1={ML} y1={yOf(t)} x2={W - MR} y2={yOf(t)} className="gt-sphere-grid" />
            <text x={ML - 6} y={yOf(t) + 4} className="gt-sphere-axis-text" textAnchor="end">{t.toFixed(2)}</text>
          </g>
        ))}
        {[0, 10, 20, 30, 40, 50, 60, 70, 80].map(t => (
          <text key={t} x={xOf(t)} y={H - MB + 14} className="gt-sphere-axis-text" textAnchor="middle">{t}</text>
        ))}
        <text x={ML - 44} y={MT + 8} className="gt-sphere-axis-text">TV</text>
        <text x={W - MR} y={H - 6} className="gt-sphere-axis-text" textAnchor="end">{tr({ zh: '步数 t', en: 'steps t'
        })}</text>
        <path d={tvSeries.map((v, t) => `${t === 0 ? 'M' : 'L'}${xOf(t)},${yOf(v)}`).join(' ')} className="gt-mix-line" />
        {/* current step marker */}
        <line x1={xOf(step)} y1={MT} x2={xOf(step)} y2={MT + plotH} className="gt-mix-cursor" />
        <circle cx={xOf(step)} cy={yOf(tvSeries[step] ?? 0)} r={4.5} className="gt-mix-cursor-dot" />
      </svg>
      <div className="gt-sg-row" style={{ alignItems: 'center', gap: 12 }}>
        <input type="range" min={0} max={T_MAX} value={step} onChange={e => setStep(parseInt(e.target.value))} className="gt-mix-slider" style={{ flex: 1 }} />
        <span className="gt-mix-step gt-mono">{lang === 'zh' ? `t = ${step}` : `t = ${step}`}</span>
        <span className="gt-mix-tv gt-mono">TV = {(tvSeries[step] ?? 0).toFixed(4)}</span>
        <button className="gt-btn gt-btn-ghost" onClick={() => setStep(0)}>{tr({ zh: '重置', en: 'reset' })}</button>
      </div>
      <div className="gt-mix-dist">
        {Array.from({ length: N }, (_, i) => {
          const v = currentP[i];
          const u = 1 / N;
          const dev = (v - u) / u; // relative deviation
          return (
            <div key={i} className="gt-mix-dist-bar" title={`p[${i}] = ${v.toFixed(4)}`}>
              <div className="gt-mix-dist-bar-fill" style={{ height: `${Math.min(100, v * 100 * N * 1.2)}%`, background: i === built.identity ? 'var(--green)' : Math.abs(dev) < 0.1 ? 'var(--accent-2)' : 'var(--accent)' }} />
            </div>
          );
        })}
      </div>
      <div className="gt-aside" style={{ marginTop: 8, marginBottom: 0 }}>
        {lang === 'zh'
          ? <>分布初始集中在 e (单根高条), 随每一步均匀化, TV 单调下降到 0。 <strong>混合时间</strong> τ_mix = 最小 t 使 TV(p_t, U) ≤ 1/(2e)。 例如 S₄ 配相邻换位: τ_mix ≈ 7-9 步, 与 Diaconis-Shahshahani (n=4 时 n·log(n)/2 ≈ 2.77) 量级一致 (常数因子取决于生成集)。 数学定理: TV(p_t, U) ≤ (1 − λ)<sup>t</sup>, 其中 λ = spectral gap = 1 − |second eigenvalue| 。 因此 spectral gap 越大, 混合越快。</>
          : <>The distribution starts as a spike at e and flattens to uniform; TV decays monotonically to 0. The <strong>mixing time</strong> τ<sub>mix</sub> = the smallest t with TV(p_t, U) ≤ 1/(2e). For S₄ with adjacent transpositions τ<sub>mix</sub> ≈ 7-9 steps, comparable in order to Diaconis-Shahshahani's n log(n)/2 ≈ 2.77 for n = 4 (constants depend on the generating set). The driving theorem: TV(p_t, U) ≤ (1 − λ)<sup>t</sup>, where λ is the <em>spectral gap</em> = 1 − |second eigenvalue| of the transition matrix.</>}
      </div>
    </div>
  );
}

// ── Bibliography panel (§14.17) ───────────────────────────────────────────
// A categorized reference list for the Cayley graph section. Each entry has
// authors, year, title, venue, optional link, and bilingual one-line notes.

// authors, year, title, venue, optional link, and bilingual one-line notes.
type CayleyRef = {
  authors: string;
  year: string;
  title: string;
  venue: string;
  link?: string;
  category: 'foundational' | 'diameter' | 'expander' | 'mixing' | 'growth' | 'cube';
  noteZh?: string;
  noteEn?: string;
};

const CAYLEY_REFS: CayleyRef[] = [
  // ── Foundational ──
  {
    authors: 'Cayley, A.', year: '1854',
    title: 'On the theory of groups, as depending on the symbolic equation θⁿ = 1',
    venue: 'Philosophical Magazine 7 (42): 40-47',
    link: 'https://archive.org/details/jstor-2369433',
    category: 'foundational',
    noteZh: '群论的诞生论文之一; 含 Cayley 定理 (每个群嵌入对称群)。',
    noteEn: 'One of the birth papers of abstract group theory; contains Cayley\'s theorem.'
},
  {
    authors: 'Cayley, A.', year: '1878',
    title: 'Desiderata and suggestions: No. 2. The theory of groups: graphical representation',
    venue: 'American Journal of Mathematics 1 (2): 174-176',
    link: 'https://www.jstor.org/stable/2369306',
    category: 'foundational',
    noteZh: '「Cayley 图」 第一次定义; 画了一个 order-12 的非阿贝尔群的图。',
    noteEn: 'First definition of the "Cayley graph"; the original drawing was a non-Abelian group of order 12.'
},
  // ── Cube-specific ──
  {
    authors: 'Rokicki, T.; Kociemba, H.; Davidson, M.; Dethridge, J.', year: '2010',
    title: "The diameter of the Rubik's cube group is twenty",
    venue: 'SIAM Journal on Discrete Mathematics 27 (2): 1082-1105',
    link: 'https://arxiv.org/abs/0710.3686',
    category: 'cube',
    noteZh: '上帝之数 HTM = 20 的最终证明 (35 CPU-年, 对称约简 + IDA* + 共置 lookup)。',
    noteEn: "God's number HTM = 20 proven exactly (35 CPU-years; symmetry reduction + IDA* + cosets)."
},
  {
    authors: 'Rokicki, T.', year: '2014',
    title: "The diameter of the Rubik's cube group is twenty-six in the quarter-turn metric",
    venue: 'arXiv:1408.6303',
    link: 'https://arxiv.org/abs/1408.6303',
    category: 'cube',
    noteZh: 'QTM 直径 = 26 (HTM 的伴生结果, 同年完工)。',
    noteEn: 'QTM diameter = 26 (companion to the 2010 HTM result).'
},
  {
    authors: 'Korf, R. E.', year: '1997',
    title: "Finding optimal solutions to Rubik's cube using pattern databases",
    venue: 'AAAI-97: 700-705',
    link: 'https://www.cs.cmu.edu/afs/cs/academic/class/15780-s11/www/papers/korf97.pdf',
    category: 'cube',
    noteZh: 'IDA* + 角块/棱块 pattern-database 启发式; 「在 Cayley 图上找测地线」 的算法奠基。',
    noteEn: "IDA* + corner/edge pattern databases; foundational solver for shortest paths on the cube's Cayley graph."
},
  {
    authors: 'Kociemba, H.', year: '1992-2009',
    title: 'Cube Explorer & the two-phase algorithm (Web monograph)',
    venue: 'kociemba.org',
    link: 'http://kociemba.org/cube.htm',
    category: 'cube',
    noteZh: '二阶段法的官方网页; G → G₁ → e 两段 IDA*, 任何状态 ≤ 24 步。',
    noteEn: 'Official two-phase reference (G → G₁ → e); any scramble solved in ≤ 24 moves.'
},
  {
    authors: 'Bordoni, A.; Reiter, F.', year: '2024',
    title: "Rubik's cube scrambling requires at least 26 random moves",
    venue: 'arXiv:2410.20630',
    link: 'https://arxiv.org/abs/2410.20630',
    category: 'cube',
    noteZh: '魔方混合时间下界证明: 25 步随机打乱 在 TV 意义上仍非均匀。',
    noteEn: 'Lower bound on the cube mixing time: 25-step random scrambles are not yet TV-uniform.'
},
  // ── Diameter / Babai ──
  {
    authors: 'Babai, L.; Seress, Á.', year: '1992',
    title: 'On the diameter of permutation groups',
    venue: 'European Journal of Combinatorics 13 (4): 231-243',
    link: 'https://doi.org/10.1016/S0195-6698(05)80029-0',
    category: 'diameter',
    noteZh: 'Babai 猜想首次提出; 给出 S_n 直径的早期亚指数上界。',
    noteEn: "Babai's conjecture first stated; an early sub-exponential bound for diam(S_n)."
},
  {
    authors: 'Helfgott, H. A.', year: '2008',
    title: 'Growth and generation in SL₂(ℤ/pℤ)',
    venue: 'Annals of Mathematics 167 (2): 601-623',
    link: 'https://annals.math.princeton.edu/wp-content/uploads/annals-v167-n2-p06.pdf',
    category: 'diameter',
    noteZh: 'PSL₂(𝔽_p) 直径 O((log p)^c); Cayley 直径研究的转折点 (additive combinatorics)。',
    noteEn: 'Diameter of PSL₂(𝔽_p) is O((log p)^c); turning point via additive combinatorics.'
},
  {
    authors: 'Pyber, L.; Szabó, E.', year: '2016',
    title: 'Growth in finite simple groups of Lie type',
    venue: 'Journal of the American Mathematical Society 29: 95-146',
    link: 'https://www.ams.org/journals/jams/2016-29-01/S0894-0347-2014-00821-3/',
    category: 'diameter',
    noteZh: 'Babai 猜想在所有有界秩 Lie 型单群上完全解决。',
    noteEn: "Babai's conjecture fully resolved for all finite simple groups of Lie type of bounded rank."
},
  {
    authors: 'Breuillard, E.; Green, B.; Tao, T.', year: '2011',
    title: 'Approximate subgroups of linear groups',
    venue: 'Geometric and Functional Analysis 21 (4): 774-819',
    link: 'https://arxiv.org/abs/1005.1881',
    category: 'diameter',
    noteZh: '同期的另一个有界秩 Babai 猜想证明 (近似子群结构定理)。',
    noteEn: 'Independent proof of bounded-rank Babai conjecture via approximate subgroup theory.'
},
  {
    authors: 'Helfgott, H. A.; Seress, Á.', year: '2014',
    title: 'On the diameter of permutation groups',
    venue: 'Annals of Mathematics 179 (2): 611-658',
    link: 'https://annals.math.princeton.edu/2014/179-2/p04',
    category: 'diameter',
    noteZh: 'A_n 直径上界改进到 exp((log n)^4 log log n) — 仍非 polylog。',
    noteEn: 'Best known bound diam(A_n) ≤ exp((log n)^4 log log n) — still super-polylog.'
},
  // ── Expander / Ramanujan ──
  {
    authors: 'Margulis, G. A.', year: '1973',
    title: 'Explicit constructions of expanders',
    venue: 'Problemy Peredachi Informatsii 9 (4): 71-80',
    category: 'expander',
    noteZh: '历史上第一个显式扩张图构造, 用 SL₂(ℤ) 在 ℤ/n 上的作用。',
    noteEn: 'First explicit expander construction, via SL₂(ℤ) acting on ℤ/n.'
},
  {
    authors: 'Lubotzky, A.; Phillips, R.; Sarnak, P.', year: '1988',
    title: 'Ramanujan graphs',
    venue: 'Combinatorica 8 (3): 261-277',
    link: 'https://link.springer.com/article/10.1007/BF02126799',
    category: 'expander',
    noteZh: 'LPS 构造: PSL₂(𝔽_p) 的 (p+1)-正则 Cayley 图是 Ramanujan; 谱最优, 围长大。',
    noteEn: 'The LPS construction: (p+1)-regular Cayley graphs of PSL₂(𝔽_p) are Ramanujan; spectrally optimal.'
},
  {
    authors: 'Alon, N.; Roichman, Y.', year: '1994',
    title: 'Random Cayley graphs and expanders',
    venue: 'Random Structures & Algorithms 5 (2): 271-284',
    link: 'https://doi.org/10.1002/rsa.3240050203',
    category: 'expander',
    noteZh: '随机 Cayley 图 (生成集大小 ~log|G|) 几乎必然是扩张图。',
    noteEn: 'Random Cayley graphs with |S| ~ log|G| are almost surely expanders.'
},
  {
    authors: 'Hoory, S.; Linial, N.; Wigderson, A.', year: '2006',
    title: 'Expander graphs and their applications',
    venue: 'Bulletin of the AMS 43 (4): 439-561',
    link: 'https://www.ams.org/journals/bull/2006-43-04/S0273-0979-06-01126-8/',
    category: 'expander',
    noteZh: '扩张图标准综述 (Cheeger, LPS, zig-zag, 应用, 70 页)。',
    noteEn: 'The standard survey of expander graphs (Cheeger, LPS, zig-zag, applications).'
},
  // ── Mixing time / random walks ──
  {
    authors: 'Diaconis, P.; Shahshahani, M.', year: '1981',
    title: 'Generating a random permutation with random transpositions',
    venue: 'Z. Wahrscheinlichkeitstheorie 57: 159-179',
    link: 'https://statweb.stanford.edu/~cgates/PERSI/papers/81_03_random_transpositions.pdf',
    category: 'mixing',
    noteZh: '随机换位 shuffle 混合时间 = (n/2) log n + O(n); 首次用群表示论分析随机游走。',
    noteEn: 'Random-transposition mixing time = (n/2) log n + O(n); first analysis via group representations.'
},
  {
    authors: 'Bayer, D.; Diaconis, P.', year: '1992',
    title: 'Trailing the dovetail shuffle to its lair',
    venue: 'Annals of Applied Probability 2 (2): 294-313',
    link: 'https://projecteuclid.org/journals/annals-of-applied-probability/volume-2/issue-2/Trailing-the-Dovetail-Shuffle-to-its-Lair/10.1214/aoap/1177005705.full',
    category: 'mixing',
    noteZh: '7 次 riffle shuffle 足够洗 52 张牌; cutoff 现象的经典例子。',
    noteEn: '7 riffle shuffles suffice for 52 cards — the canonical cutoff phenomenon example.'
},
  {
    authors: 'Aldous, D.; Diaconis, P.', year: '1986',
    title: 'Shuffling cards and stopping times',
    venue: 'American Mathematical Monthly 93 (5): 333-348',
    link: 'https://doi.org/10.1080/00029890.1986.11971821',
    category: 'mixing',
    noteZh: '「cutoff 现象」 这个词首次出现; 联系了停时和混合时间。',
    noteEn: 'Coined the term "cutoff phenomenon" and linked stopping times to mixing.'
},
  {
    authors: 'Levin, D. A.; Peres, Y.', year: '2017',
    title: 'Markov Chains and Mixing Times (2nd ed.)',
    venue: 'American Mathematical Society',
    link: 'https://pages.uoregon.edu/dlevin/MARKOV/',
    category: 'mixing',
    noteZh: '混合时间标准教材; 含 Cayley 图、 spectral gap、 cutoff 现象的完整理论。',
    noteEn: 'The standard textbook; full theory of Cayley random walks, spectral gap, cutoff.'
},
  // ── Growth / geometric group theory ──
  {
    authors: 'Gromov, M.', year: '1981',
    title: 'Groups of polynomial growth and expanding maps',
    venue: 'Publications IHES 53: 53-78',
    link: 'https://www.ihes.fr/~gromov/wp-content/uploads/2018/08/631.pdf',
    category: 'growth',
    noteZh: '多项式增长 ⇔ 几乎幂零; 引入 Gromov-Hausdorff 收敛, 开创几何群论。',
    noteEn: 'Polynomial growth ⇔ virtually nilpotent; introduced Gromov-Hausdorff convergence, founded GGT.'
},
  {
    authors: 'Grigorchuk, R.', year: '1984',
    title: 'Degrees of growth of finitely generated groups, and the theory of invariant means',
    venue: 'Mathematics of the USSR-Izvestiya 25 (2): 259-300',
    link: 'https://doi.org/10.1070/IM1985v025n02ABEH001281',
    category: 'growth',
    noteZh: '第一个 「中间增长」 群的例子 (Grigorchuk 群); 比多项式快、 比指数慢。',
    noteEn: 'First example of a group of intermediate growth (the Grigorchuk group).'
},
  {
    authors: 'Cheeger, J.', year: '1970',
    title: 'A lower bound for the smallest eigenvalue of the Laplacian',
    venue: 'Problems in Analysis (Princeton): 195-199',
    category: 'growth',
    noteZh: '原 Cheeger 不等式 (流形版); 1985 Dodziuk &amp; Alon-Milman 给出图论对应。',
    noteEn: 'The original Cheeger inequality on manifolds; graph version came later (Dodziuk, Alon-Milman 1985).'
},
];

function CayleyReferences() {
  const lang = useLang();
  const sections: { id: CayleyRef['category']; zh: string; en: string
 }[] = [
    { id: 'foundational', zh: '基础', en: 'Foundational'
    },
    { id: 'cube', zh: '魔方专题', en: 'Cube-specific'
    },
    { id: 'diameter', zh: '直径与 Babai 猜想', en: 'Diameter & Babai\'s conjecture'
    },
    { id: 'expander', zh: '扩张图与 Ramanujan', en: 'Expanders & Ramanujan'
    },
    { id: 'mixing', zh: '混合时间与随机游走', en: 'Mixing time & random walks'
    },
    { id: 'growth', zh: '增长函数与几何群论', en: 'Growth & geometric group theory'
    },
  ];
  return (
    <div className="gt-refs">
      {sections.map(s => {
        const items = CAYLEY_REFS.filter(r => r.category === s.id);
        if (items.length === 0) return null;
        return (
          <div key={s.id} className="gt-refs-section">
            <div className="gt-refs-section-head">{tr(s)}</div>
            <ul className="gt-refs-list">
              {items.map((r, i) => (
                <li key={i} className="gt-refs-item">
                  <div className="gt-refs-meta">
                    <span className="gt-refs-authors">{r.authors}</span>
                    <span className="gt-refs-year">({r.year})</span>
                  </div>
                  <div className="gt-refs-title">
                    {r.link
                      ? <a href={r.link} target="_blank" rel="noopener noreferrer">{r.title}</a>
                      : <span>{r.title}</span>}
                    <span className="gt-refs-venue"> · {r.venue}</span>
                  </div>
                  {(r.noteZh || r.noteEn) && (
                    <div className="gt-refs-note">{lang === 'zh' ? r.noteZh : r.noteEn}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function CayleyGraph() {
  const lang = useLang();
  return (
      <GTSec id="cayley" className="gt-sec">
        <div className="gt-sec-num">§14</div>
        <h2 className="gt-sec-title">
          <L zh="Cayley 图 — 群的几何" en="The Cayley graph — geometry of a group" />
        </h2>
        <p>
          <L
            zh={<>群本身是抽象代数对象, 但我们可以给它一副 「面孔」 —— 把每个元素画成一个点, 每个 「生成元 s」 画成一条边。 这就是 <strong>Cayley 图</strong>: 它把抽象群变成具体的几何对象, 让群论里的 「直径」 「测地线」 「球壳」 「邻域」 等词有了字面意义。 凯莱图是 1878 年由 Arthur Cayley 提出的, 比魔方早了一个世纪, 但它最自然的可视化就是魔方。</>}
            en={<>A group is an abstract algebraic object, but we can give it a face — draw each element as a node, each generator <em>s</em> as an edge. The result is the <strong>Cayley graph</strong>, turning an abstract group into a concrete geometric object. Words like "diameter," "geodesic," "ball of radius <em>r</em>," and "neighbourhood" all gain literal meaning. Arthur Cayley introduced it in 1878, a century before the Rubik's cube — but the cube is its most tactile visualisation.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 14.1', en: 'Definition 14.1'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>设群 <TeX src={`G`} /> 有生成集 <TeX src={`S`} /> (假设 <TeX src={`S = S^{-1}`} />, 即生成元的逆也在 S 中)。 <strong>Cayley 图</strong> <TeX src={`\\operatorname{Cay}(G, S)`} /> 是: 顶点 = G 的每个元素, 每对 <TeX src={`(g, s)`} /> 给出一条 <TeX src={`g \\to g \\cdot s`} /> 的有色无向边 (按 s 配色)。 它是一个 <strong>顶点传递</strong> (vertex-transitive) 图。</>}
              en={<>Let G be a group with generating set S, closed under inversion (so that <TeX src={`S = S^{-1}`} />). The <strong>Cayley graph</strong> <TeX src={`\\operatorname{Cay}(G, S)`} /> has one node per element of G; for every pair <TeX src={`(g, s)`} /> there is an edge <TeX src={`g \\to g \\cdot s`} /> coloured by <em>s</em>. The graph is <strong>vertex-transitive</strong>.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.1  小例子热身 — ⟨R, U⟩ 的前两层" en="14.1  Warm-up — first two layers of ⟨R, U⟩" />
        </h3>
        <p>
          <L
            zh={<>魔方的完整 Cayley 图有 4.3 × 10¹⁹ 个节点和 ≈ 3.9 × 10²⁰ 条边, 没法画出来。但我们可以画 <strong>小子群</strong>。下面是 ⟨R, U⟩ 的前两层 BFS — 从 e 出发, 一步、两步能到达的部分节点。 红边 = R, 蓝边 = U。 已经能看出非阿贝尔群特有的 「不对称扇形」 (R·U ≠ U·R, 所以两边的两步邻居各占一片):</>}
            en={<>The full cube Cayley graph has 4.3 × 10¹⁹ nodes and ≈ 3.9 × 10²⁰ edges — impossible to render. But we can plot a <strong>small subgroup</strong>. Below: the first two BFS layers of ⟨R, U⟩ from e. Red edges = R, blue = U. The "asymmetric fan" of a non-Abelian group is already visible — R·U ≠ U·R, so the two-step neighbours bifurcate:</>}
          />
        </p>
        <div className="gt-panel">
          <CayleyMini />
          <div className="gt-aside" style={{ marginTop: 12, marginBottom: 0 }}>
            {tr({ zh: '完整的 ⟨R, U⟩ Cayley 图有 73,483,200 个节点, 直径约 26 (HTM)。这里只画了前 15 个节点作示意。', en: 'The full Cay(⟨R, U⟩, {R, U}) has 73,483,200 nodes and diameter ≈ 26 (HTM). Only 15 nodes shown here.'
            })}
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.2  互动 — 在 Cayley 图上自己走" en="14.2  Interactive — walk it yourself" />
        </h3>
        <p>
          <L
            zh={<>你正站在节点 <span className="gt-math">e</span> 上。 点 18 个生成元里的任意一个, 就沿那条 「彩色边」 跨到邻居。 路径就是 「在 Cayley 图上走过的边序列」 。 走着走着回到 e? 你刚刚走完一个 <em>闭路</em> — 这条路径作为 G 的元素 = 单位元, 它的长度就是相应元素的 <em>阶</em>。</>}
            en={<>You are standing at node <span className="gt-math">e</span>. Click any of the 18 generators to traverse that coloured edge to a neighbour. The path is the sequence of edges walked. Wandered back to e? You just closed a loop — the product of the path is the identity, and its length is the order of that element.</>}
          />
        </p>
        <CayleyWalker />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.3  球壳 |S_d| — 距离为 d 的状态有多少" en="14.3  Spheres |S_d| — counting states at radius d" />
        </h3>
        <p>
          <L
            zh={<>对 <TeX src={`e \\in G`} />, 距离恰为 d 的状态集合记作 <TeX src={`S_d = \\{g : d(e, g) = d\\}`} /> (Cayley 图上的「球壳」)。 球壳大小 <TeX src={`|S_d|`} /> 由 BFS 直接给出, 在魔方上是 21 个精确已知的数字 (来自 cube20.org):</>}
            en={<>For <TeX src={`e \\in G`} />, the set of states at distance exactly d is <TeX src={`S_d = \\{g : d(e, g) = d\\}`} /> — the "sphere of radius d" in Cay(G). The sizes <TeX src={`|S_d|`} /> come from BFS. For the cube, all 21 values are known exactly (a byproduct of Rokicki et al. 2010):</>}
          />
        </p>
        <CayleyBFSTable />
        <p>
          <L
            zh={<>球壳大小先以 <strong>17.97 倍</strong> 的稳定指数增长 (这是 「分支因子」, 接近 18 但略小, 因为有 reduction — 比如 <span className="gt-mono">R</span> 之后不再走 <span className="gt-mono">R'</span>) , 在 d ≈ 13 达到 5 × 10¹⁴ 量级, 然后 <strong>急剧饱和</strong> 在 d = 18 达到峰值, 接着突然下降。 d = 20 时只剩 4.9 亿个状态 (其中包括 superflip)。 这是经典 「球面填空」 现象 — 一个有限图的 「外缘」 一定收缩。</>}
            en={<>Sphere sizes grow at a steady factor of about <strong>17.97×</strong> (the branching factor — close to 18 but slightly less, due to reductions like "don't immediately undo <span className="gt-mono">R</span>"). They reach ~5 × 10¹⁴ around d = 13, then sharply <strong>saturate</strong> at the peak d = 18, and collapse. By d = 20 only 490 million states remain (including superflip). This is the classic "sphere packing in a finite graph" phenomenon — the outer boundary must shrink.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.4  测地线、捷径与算法" en="14.4  Geodesics, shortcuts and algorithms" />
        </h3>
        <p>
          <L
            zh={<>从 e 到 g 的 「最短路径」 称为 <strong>测地线</strong> (geodesic), 长度 = d(e, g) = 「g 的最短解 |g|_S」 。 一个公式 (alg) 就是一条 walk; 它是测地线当且仅当它是最优解。 这正是 「solver」 在做的事 — <em>找测地线</em>。</>}
            en={<>The shortest path from e to g is a <strong>geodesic</strong>, of length d(e, g) = |g|_S (the optimal solution length for g). Any alg is a walk on Cay(G); it is a geodesic iff it is optimal. Solvers, in graph-theoretic language, search for geodesics.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '直径 (Theorem 14.2)', en: 'Diameter (Theorem 14.2)'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>Cay(G, S) 的 <strong>直径</strong> diam(G, S) = max<sub>g ∈ G</sub> d(e, g) = G 中 「最难还原状态」 的最短解长度。 在 HTM 下 = 20 (上帝之数); 在 QTM 下 = 26。</>}
              en={<>The <strong>diameter</strong> diam(G, S) = max<sub>g ∈ G</sub> d(e, g) = the optimal length for the hardest state. Under HTM this is 20 (God's number); under QTM it is 26.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>有意思的对比 — Korf 算法 (1997) 是直接在 Cayley 图上做 IDA* 搜索 (启发式: 用角块查表和棱块查表的 max 作下界估计); Kociemba 二阶段法 (§10) 先走 G → G_1 的捷径再走 G_1 → e, 不一定是测地线但保证 ≤ 24 步; Rokicki 的 God's number 证明在 Cayley 图上做了一次 「分块的全局 BFS」 (按对称等价类切片, 35 CPU 年)。 这三个就是 「Cayley 图上的三种穿越策略」 。</>}
            en={<>A nice contrast: Korf's 1997 algorithm does IDA* directly on Cay(G), using max(corner-PDB, edge-PDB) as a heuristic; Kociemba's two-phase (§10) walks G → G_1, then G_1 → e, sacrificing optimality for speed and bounded length (≤ 24); Rokicki's 2010 proof did a "block-BFS" of Cay(G) using symmetry-quotient classes, costing 35 CPU-years. Three different ways to traverse the same graph.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.5  扩张性 (Expander 性质)" en="14.5  Expander properties" />
        </h3>
        <p>
          <L
            zh={<>魔方 Cayley 图是一个 <strong>「胖」</strong> 图 — 每个节点 18 邻居, 直径只 20, 节点数 4.3 × 10¹⁹。 这意味着图的 「扩张系数」 接近最大: 任何子集 A ⊆ G (|A| ≤ |G|/2), 它的边界 |∂A| / |A| 不会太小。 数学上, 这与图 Laplacian 的 <strong>spectral gap</strong> 直接相关; 实验上, 它表现为 「随机游走快速混合」 (rapidly mixing random walk)。</>}
            en={<>The cube's Cayley graph is a <strong>"fat" graph</strong> — every node has 18 neighbours, diameter only 20, with 4.3 × 10¹⁹ nodes. The "expansion" is near-maximal: for any subset A ⊆ G with |A| ≤ |G|/2, the boundary |∂A| / |A| does not shrink. Mathematically this connects to the <strong>spectral gap</strong> of the graph Laplacian; practically, it makes random walks "rapidly mix" through G.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '混合时间', en: 'Mixing time'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>魔方 Cayley 图的随机游走混合时间是 <strong>O(log |G| / λ)</strong> 步, 其中 λ 是 spectral gap。 数值实验给出 λ ≈ 0.6, 混合时间 ≈ 70 步 — 即任何 70 步以上的均匀随机打乱在统计意义上跟 「真正均匀分布」 几乎不可区分。 WCA 比赛打乱长度 (3x3 一般 25 步) 远低于这个值, 所以打乱有一些 「偏」 — 比如靠近 e 的状态出现概率比预期高一点点。</>}
              en={<>Random-walk mixing time on the cube Cayley graph is <strong>O(log |G| / λ)</strong>, where λ is the spectral gap. Numerical experiments give λ ≈ 0.6 and a mixing time of roughly 70 steps. Any scramble longer than ~70 random moves is statistically indistinguishable from the uniform distribution on G. WCA scrambles (25 moves on 3x3) sit well below this, so they retain a slight bias — states near e occur slightly more often than expected.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.6  生成集变化, Cayley 图也变化" en="14.6  Cayley graph depends on the generating set" />
        </h3>
        <p>
          <L
            zh={<>同一个群 G, 不同的生成集 S 给出 <em>不同</em> 的 Cayley 图。 度量、直径、球壳大小、混合时间, 全都会变。 下表对比魔方的几种度量:</>}
            en={<>The same G, with a different generating set S, gives a <em>different</em> Cayley graph. Distance, diameter, sphere sizes, mixing time — all change. The cube under various metrics:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr>
              <th>{tr({ zh: '生成集 S', en: 'Generators S' })}</th>
              <th>{lang === 'zh' ? '|S|' : '|S|'}</th>
              <th>{tr({ zh: '直径', en: 'Diameter'
            })}</th>
              <th>{tr({ zh: '说明', en: 'Notes'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>HTM = U U' U2 D D' D2 ...</td>
              <td className="num">18</td>
              <td className="num">20</td>
              <td>{tr({ zh: 'WCA 标准, 半圈算一步', en: 'WCA standard, half-turn metric'
            })}</td>
            </tr>
            <tr>
              <td>QTM = U U' D D' ...</td>
              <td className="num">12</td>
              <td className="num">26</td>
              <td>{tr({ zh: '只允许 90°, 半圈算两步', en: 'quarter-turn only; U2 = 2 moves'
            })}</td>
            </tr>
            <tr>
              <td>STM = HTM + M E S (切片)</td>
              <td className="num">27</td>
              <td className="num">18</td>
              <td>{tr({ zh: '加 9 个切片转, 直径少 2', en: '+ 9 slice moves; diameter drops by 2'
            })}</td>
            </tr>
            <tr>
              <td>BTM (block turn)</td>
              <td className="num">36</td>
              <td className="num">≤ 16</td>
              <td>{tr({ zh: '宽幅 + 切片; 进一步缩短', en: 'wide + slice; shortens further'
            })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: '只用 ⟨R, U⟩ 两个面', en: 'only ⟨R, U⟩'
            })}</td>
              <td className="num">2 (or 6 with inverses/dbl)</td>
              <td className="num">~26</td>
              <td>{tr({ zh: '只能到达 73,483,200 个状态', en: 'reaches just 73,483,200 states'
            })}</td>
            </tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>注意: 「⟨R, U⟩ 直径 26」 是相对它生成的 <em>子群</em> (那个 73M 子群) 而言的; 在整个 G 中 R, U 不是生成集, 所以 「在 G 里只用 R, U」 大部分状态根本到不了, 距离是无穷大。这就是为什么生成集 「越多越好」 — 更多边 = 更小直径 = 更易解。</>}
            en={<>Note: "⟨R, U⟩ has diameter 26" refers to the <em>subgroup</em> it generates (the 73 million-element subgroup). Within G itself, R and U alone do not generate G, so most states are unreachable — at "distance infinity." This is why "more generators = better": more edges → smaller diameter → easier to solve.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.7  Cayley 图与可视化" en="14.7  Visualising the Cayley graph" />
        </h3>
        <p>
          <L
            zh={<>4.3 × 10¹⁹ 个节点没法画。但 Cayley 图的 <strong>局部结构</strong> 总是可视化的 — 每个节点附近都长得跟 「单位元附近」 一样 (顶点传递)。 几个常见的可视化策略:</>}
            en={<>Forty-three quintillion nodes is unrenderable. But the <strong>local structure</strong> of a Cayley graph can always be drawn — every node looks like the neighbourhood of e (vertex-transitive). Common visualisation tricks:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>BFS 树</strong> — 从 e 出发, 按距离层画。 「球面填空」 现象在这里最直观: 树底厚, 树顶尖。</>}
              en={<><strong>BFS tree</strong> — root at e, layers by depth. The "sphere packing in a finite graph" effect shows up directly: a wide middle and thin tips at both ends.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>商图</strong> — 用一个子群 H 把 G 折叠: 节点 = 陪集 gH, 边 = 同样的生成元。 例如把 G/G_3 画出来只有 |G|/|G_3| ≈ 6.5 × 10¹³ 个节点 — 但 Thistlethwaite 用过的 「商图」 远小得多 (G/G_1 才 2048 节点, 真的可以画)。</>}
              en={<><strong>Quotient graphs</strong> — fold G by a subgroup H: nodes = cosets gH, same generators on edges. For example G/G_1 has 2048 nodes — small enough to draw, large enough to be revealing. Thistlethwaite's algorithm essentially walks the chain of quotient graphs G/G_i.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>对称约简</strong> — 用 48 个外部对称变换把 「图自同构」 折叠掉, 节点数砍到 ≈ 9 × 10¹⁷。 Rokicki 算法就是按这个减少计算量。</>}
              en={<><strong>Symmetry reduction</strong> — quotient out the 48 outer cube symmetries; node count drops to ~9 × 10¹⁷. Rokicki's solver uses this to make the BFS tractable.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>径向投影</strong> — 在二维平面上, 以 e 为圆心, 按距离 d 把所有节点画在第 d 个圆环上。 节点数据来源 = CAYLEY_SPHERE 表 (§14.3) 。 这种画法不可能精确, 但能 「看清形状」 — 像一个胖中间、尖两头的 「橄榄」 。</>}
              en={<><strong>Radial layout</strong> — on a 2D plane, put e at the centre and every node at distance d on the d-th concentric circle. Counts come from the CAYLEY_SPHERE table above. The shape is unmistakably "olive-like" — fat middle, sharp tips.</>}
            />
          </li>
        </ul>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.8  其它群的 Cayley 图" en="14.8  Cayley graphs of other groups" />
        </h3>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><TeX src={`\\mathbb{Z}`} /> 配 <TeX src={`\\{+1\\}`} />: 一条无限直线。</>}
              en={<><TeX src={`\\mathbb{Z}`} /> with <TeX src={`\\{+1\\}`} />: an infinite line.</>}
            />
          </li>
          <li>
            <L
              zh={<><TeX src={`\\mathbb{Z} \\times \\mathbb{Z}`} /> 配 <TeX src={`\\{(1,0), (0,1)\\}`} />: 平面方格。</>}
              en={<><TeX src={`\\mathbb{Z} \\times \\mathbb{Z}`} /> with <TeX src={`\\{(1,0), (0,1)\\}`} />: the integer lattice.</>}
            />
          </li>
          <li>
            <L
              zh={<><TeX src={`\\mathbb{Z}/n`} /> 配 <TeX src={`\\{+1\\}`} />: 一个圆环 (n 边形)。</>}
              en={<><TeX src={`\\mathbb{Z}/n`} /> with <TeX src={`\\{+1\\}`} />: a regular n-gon cycle.</>}
            />
          </li>
          <li>
            <L
              zh={<><TeX src={`F_2 = \\langle a, b \\rangle`} /> (自由群): 一棵无限 4-叉树 — 没有环, 永远不回到 e (因为自由群)。</>}
              en={<><TeX src={`F_2 = \\langle a, b \\rangle`} /> (free group): an infinite 4-regular tree — no cycles, you never return to e (because it's free).</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>魔方 G</strong>: 球壳大小见 §14.3 表。 直径 20, |G| = 4.3 × 10¹⁹。 顶点传递 + 几乎正则 + 高扩张 = 一个 「漂亮的有限非阿贝尔图」 。</>}
              en={<><strong>The cube G</strong>: sphere sizes from §14.3. Diameter 20, |G| = 4.3 × 10¹⁹. Vertex-transitive, near-regular, highly expanding — a "beautiful finite non-Abelian graph."</>}
            />
          </li>
        </ul>
        <div className="gt-pullquote">
          <L
            zh={<>「魔方的 Cayley 图是数学上最广为研究的、有限的、非阿贝尔的、高对称的图。 它直径 20、有 4.3 × 10¹⁹ 个顶点 — 几乎是这类对象的极限。」</>}
            en={<>"The cube's Cayley graph is the most thoroughly studied finite, non-Abelian, highly symmetric graph in mathematics. Diameter 20, 4.3 × 10¹⁹ vertices — about as extreme as such an object can get."</>}
          />
        </div>

        {/* ─────────────── 14.9 Interactive log-scale plot ─────────────── */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.9  互动 § 球壳分布的对数图" en="14.9  Interactive § sphere sizes on a log scale" />
        </h3>
        <p>
          <L
            zh={<>把 §14.3 的 21 个 |S_d| 数字摊到对数纸上, 「分支因子 17.97×」 就是图里的恒定斜率。 鼠标悬停每一根条 → 显示 d、 |S_d|、 占 |G| 的百分比、 以及 <strong>瞬时分支因子</strong> |S_d| / |S_{`{d-1}`}|。 注意中段 (d = 3 → 13) 的斜率几乎是常数 (≈ 17.97×), 然后突然在 d = 16 → 18 显著放缓 (饱和), 在 d = 19 → 20 几乎消失 (球面填空尾部)。</>}
            en={<>The same 21 numbers from §14.3, laid on log paper — the "17.97× branching factor" appears as a constant slope. Hover any bar to see d, |S_d|, percentage of |G|, and the <strong>instantaneous branching</strong> |S_d| / |S_<sub>d-1</sub>|. The middle (d = 3 → 13) is almost linear (slope ≈ log<sub>10</sub> 17.97 ≈ 1.255); growth visibly slows from d = 16 → 18 (saturation), then collapses by d = 19 → 20 (the sphere-packing tail).</>}
          />
        </p>
        <SphereLogPlot />
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '观察 14.9 — 球面饱和', en: 'Observation 14.9 — sphere saturation'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对于 finite vertex-transitive graph Γ = Cay(G, S), 球壳大小 |S_d| 必满足: <strong>(a)</strong> 单峰 (上下文意义上的) — 存在唯一 d* 使得 |S_{`{d-1}`}| ≤ |S_d| ≥ |S_{`{d+1}`}|; <strong>(b)</strong> 总和 ∑|S_d| = |G|; <strong>(c)</strong> 在直径 D 处必有 |S_D| ≥ 1。 对魔方 d* = 18, D = 20, |S_D| = 4.9 × 10⁸ (其中 superflip 是被研究最多的)。</>}
              en={<>For a finite vertex-transitive graph Γ = Cay(G, S), the sphere sizes |S_d| satisfy: <strong>(a)</strong> a unimodal envelope — there is a unique d* with |S_<sub>d-1</sub>| ≤ |S_d| ≥ |S_<sub>d+1</sub>|; <strong>(b)</strong> ∑|S_d| = |G|; <strong>(c)</strong> at the diameter D, |S_D| ≥ 1. For the cube: d* = 18, D = 20, |S_D| = 4.9 × 10⁸ (superflip being its most-studied member).</>}
            />
          </div>
        </div>

        {/* ─────────────── 14.10 Small-group laboratory ─────────────── */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.10  互动 § 小群的 Cayley 图实验室" en="14.10  Interactive § small-group Cayley laboratory" />
        </h3>
        <p>
          <L
            zh={<>真正的 4.3 × 10¹⁹ 节点画不出来。 但 <em>小</em> 的 Cayley 图能完整渲染, 而它们携带的几何直觉跟魔方完全是同一类。 下面 8 个例子横跨阿贝尔/非阿贝尔、单生成元/多生成元、循环/网格/置换。 切换它们, 看 「同一个 G 改生成集后直径 / 围长 / 边数都变」。 节点上的数字 = d(e, g)。 点一个节点 → 锁定 + 显示从 e 到它的最短路径 (沿生成元颜色)。</>}
            en={<>The full 4.3 × 10¹⁹-node graph cannot be drawn — but <em>small</em> Cayley graphs can, and they encode the same geometric intuition. The eight below span Abelian/non-Abelian, one/many generators, cyclic/grid/permutation. Switch between them to see how <strong>the same G</strong> changes diameter / girth / |E| under different generating sets. Numbers on nodes = d(e, g); click a node → lock + display shortest path coloured by generator.</>}
          />
        </p>
        <SmallGroupCayleyExplorer />
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 14.10 — 围长 (girth)', en: 'Definition 14.10 — girth'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>图 Γ 的 <strong>围长</strong> g(Γ) = 最短闭合圈的长度。 对 Cay(G, S), 这等于 G 中 「除 e 以外最短的关系字 (relator) 长度」。 自由群无关系字 ⇒ 围长 = ∞。 ℤ/n 配 {`{+1}`} 围长 = n。 D₄ 配 {`{r, s}`} 围长 = 4 (来自 r⁴ = e)。 围长大 ⇒ Cayley 图局部 「像树」 ⇒ 高扩张 (随后 §14.13 会用到)。</>}
              en={<>The <strong>girth</strong> g(Γ) of a graph is the length of its shortest cycle. For Cay(G, S) this equals the length of the shortest non-trivial relator in G. The free group has no relators ⇒ infinite girth (its Cayley graph is a tree). ℤ/n with {`{+1}`} has girth n. D₄ with {`{r, s}`} has girth 4 (from r⁴ = e). Large girth ⇒ Cayley graph is locally tree-like ⇒ high expansion (used in §14.13).</>}
            />
          </div>
        </div>

        {/* ─────────────── 14.11 Spectral gap, Cheeger ─────────────── */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.11  谱隙 (spectral gap) 与 Cheeger 不等式" en="14.11  Spectral gap and the Cheeger inequality" />
        </h3>
        <p>
          <L
            zh={<>Cayley 图 Γ 是 k-正则图 (k = |S|), 它的 <strong>邻接矩阵</strong> A 是对称的 N × N 矩阵 (N = |G|)。 谱定理告诉我们 A 的特征值都是实数: <TeX src={`k = \\lambda_1 \\geq \\lambda_2 \\geq \\cdots \\geq \\lambda_N \\geq -k`} />, 而 「<strong>谱隙</strong>」 (spectral gap) 定义为 <TeX src={`\\Delta = k - \\lambda_2`} /> (或归一化后 <TeX src={`1 - \\lambda_2 / k`} />)。 谱隙大 ⇔ 图 「连接性强」 ⇔ 随机游走快速混合。</>}
            en={<>The Cayley graph Γ is k-regular (k = |S|), so its <strong>adjacency matrix</strong> A is a symmetric N × N matrix (N = |G|). The spectral theorem gives real eigenvalues <TeX src={`k = \\lambda_1 \\geq \\lambda_2 \\geq \\cdots \\geq \\lambda_N \\geq -k`} />. The <strong>spectral gap</strong> is <TeX src={`\\Delta = k - \\lambda_2`} /> (or normalized as <TeX src={`1 - \\lambda_2 / k`} />). Large spectral gap ⇔ graph is "well-connected" ⇔ random walks mix quickly.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: 'Cheeger 不等式 (Theorem 14.11)', en: 'Cheeger inequality (Theorem 14.11)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对图 Γ 定义 <strong>Cheeger 常数</strong> (等周常数): <TeXBlock src={`h(\\Gamma) \\;=\\; \\min_{S \\subset V,\\, |S| \\leq |V|/2} \\;\\frac{|\\partial S|}{|S|}`} /> 其中 ∂S = 「一头在 S 内、 另一头在 S 外」 的边集。 那么:</>}
              en={<>Define the <strong>Cheeger constant</strong> (edge isoperimetric ratio) <TeXBlock src={`h(\\Gamma) \\;=\\; \\min_{S \\subset V,\\, |S| \\leq |V|/2} \\;\\frac{|\\partial S|}{|S|}`} /> where ∂S is the set of edges with one endpoint in S and one outside. Then:</>}
            />
            <TeXBlock src={`\\frac{\\Delta}{2} \\;\\leq\\; h(\\Gamma) \\;\\leq\\; \\sqrt{2 k \\,\\Delta}`} />
            <L
              zh={<>所以谱隙和「图能不能切成两半」是双向控制的: Δ ≈ 0 ⇒ 图有 「细颈」 (bottleneck); Δ 大 ⇒ 图 「均匀展开」。 (经典证明用 Rayleigh 商 + 极小割等周 + 平方根技巧 — Cheeger 1970 几何版, Dodziuk & Alon-Milman 1985 图论版。)</>}
              en={<>So the spectral gap and "can-you-cut-the-graph-in-half" are mutually controlled: Δ ≈ 0 ⇒ a bottleneck exists; large Δ ⇒ the graph expands uniformly. (Classical proof uses Rayleigh quotients + extreme cut + square-root trick — Cheeger 1970 in geometry, Dodziuk &amp; Alon-Milman 1985 in graphs.)</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方 G 与生成集 S (HTM), 数值实验给出 <TeX src={`\\lambda_2 / k \\approx 0.95`} />, 即 <TeX src={`\\Delta / k \\approx 0.05`} /> (是 「小」 但远非 0)。 这就是为什么 25 步打乱 「几乎均匀」 但仍 「不完全均匀」 — 用 Cheeger 估计, 混合时间 τ<sub>mix</sub> = Θ(log |G| / Δ) ≈ log(4.3 × 10¹⁹) / 0.05 ≈ 905. 但严格的随机游走分析 (考虑 spectral gap of the lazy walk + dominant eigenfunctions) 给出更紧的界, 实验观察 ≈ 70-100 步即视觉不可区分。</>}
            en={<>For the cube G with HTM, numerical experiments give <TeX src={`\\lambda_2 / k \\approx 0.95`} />, i.e. <TeX src={`\\Delta / k \\approx 0.05`} /> ("small" but not zero). This is why a 25-move WCA scramble is <em>nearly</em> uniform but not exactly so — by Cheeger, τ<sub>mix</sub> = Θ(log |G| / Δ) ≈ log(4.3 × 10¹⁹) / 0.05 ≈ 905. Tighter random-walk analysis (using spectral gap of the lazy walk + dominant eigenfunctions) gives much smaller bounds; experimentally ~70-100 random moves are visually indistinguishable from uniform.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>注: λ₂ 不是直接 「群论计算」 出来的 — 它来自 A 的谱。 但对 Abelian Cayley 图, λ_i 是 Fourier-style 特征和; 对非 Abelian 群, 它们是 character sums (§26 表示论 会用)。 这就是 「<strong>表示论控制图论</strong>」 的源头。</>}
            en={<>Note: λ₂ does not pop out of "pure group theory" — it comes from the spectrum of A. For Abelian groups, λ_i are Fourier-style character sums; for non-Abelian, they involve irreducible characters (§26). This is the source of the slogan "<strong>representation theory controls graph theory</strong>".</>}
          />
        </div>

        {/* ─────────────── 14.12 Mixing time + interactive ─────────────── */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.12  互动 § 随机游走的混合时间" en="14.12  Interactive § random walks and mixing time" />
        </h3>
        <p>
          <L
            zh={<>给 G 配一个生成集 S, 定义 <strong>懒惰随机游走</strong> (lazy random walk): 从 e 出发, 每一步以 1/2 的概率原地不动, 否则随机抽 S ∪ S⁻¹ 中的一个元素左乘。 t 步后到 g 的概率分布记 p_t(g)。 「懒惰」 的好处: 即使 G 在该生成集下是二部图 (如 S_n 配换位 — 每步符号翻转), 收敛到均匀仍成立: <TeX src={`p_t \\xrightarrow{t \\to \\infty} U = 1/|G|`} />。 <strong>混合时间</strong> τ<sub>mix</sub>(ε) = 最小 t 使 TV(p_t, U) ≤ ε。 通常取 ε = 1/(2e) 或 1/4。</>}
            en={<>The <strong>lazy random walk</strong> on G with generating set S: from e, at each step stay put with probability 1/2 or else left-multiply by a uniformly chosen element of S ∪ S⁻¹. The distribution after t steps is p_t. "Lazy" matters: when G is bipartite under S (e.g. S_n with transpositions — every step flips parity), the non-lazy walk never converges. The lazy version always converges: <TeX src={`p_t \\xrightarrow{t \\to \\infty} U = 1/|G|`} />. The <strong>mixing time</strong> τ<sub>mix</sub>(ε) = the smallest t with TV(p_t, U) ≤ ε (standard choice ε = 1/(2e) or 1/4).</>}
          />
        </p>
        <TeXBlock src={`\\mathrm{TV}(p, U) \\;=\\; \\tfrac{1}{2}\\sum_{g \\in G} \\big|\\, p(g) - 1/|G|\\,\\big|`} />
        <RandomWalkMixingPlot />
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 14.12 — Diaconis-Shahshahani (1981)', en: 'Theorem 14.12 — Diaconis-Shahshahani (1981)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对 G = S_n 配 「全体换位 S = {`{(i j) : i < j}`}」 (即 「随机换位 shuffle」), 混合时间存在 <strong>cutoff 现象</strong>:</>}
              en={<>For G = S_n with the symmetric generating set of all transpositions {`{(i j) : i < j}`}, the mixing time exhibits the <strong>cutoff phenomenon</strong>:</>}
            />
            <TeXBlock src={`\\tau_{\\mathrm{mix}}\\bigl(\\tfrac{1}{2e}\\bigr) \\;=\\; \\tfrac{n}{2} \\log n \\;+\\; O(n)`} />
            <L
              zh={<>这是 「<strong>表示论解锁的概率论结果</strong>」 — 证明需要计算 S_n 所有不可约表示的 character ratios (Frobenius formula + Murnaghan-Nakayama)。 上界来自 Plancherel: <TeX src={`\\|p_t - U\\|_2^2 = \\frac{1}{|G|}\\sum_{\\rho \\neq 1} d_\\rho^2 (\\hat{p}_S(\\rho)/d_\\rho)^{2t}`} />。 同类的 cutoff 也出现在 Rubik、 卡片洗牌 (Bayer-Diaconis 1992, 7 次 riffle 即足) 等。</>}
              en={<>This is "<strong>probability theory unlocked by representation theory</strong>" — the proof computes character ratios over irreps of S_n (Frobenius formula + Murnaghan-Nakayama). The upper bound comes from Plancherel: <TeX src={`\\|p_t - U\\|_2^2 = \\frac{1}{|G|}\\sum_{\\rho \\neq 1} d_\\rho^2 (\\hat{p}_S(\\rho)/d_\\rho)^{2t}`} />. The same cutoff phenomenon appears for the cube and for card shuffles (Bayer-Diaconis 1992: 7 riffles suffice).</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>同年 Aldous-Diaconis 给 「cutoff」 这个词起名 — 现象本质是: TV 在 τ_mix 之前几乎不下降, 然后在 O(√t)-宽度内骤降到 0。 这与 「热扩散稳定 → 突然均匀化」 的物理直觉对应。 现代研究 (Berestycki-Şengül 2019, Bordenave-Lacoin-Salez 2019) 把 cutoff 扩展到非交换 conjugacy-invariant walk, 对 PGL 等 Lie 型也成立。</>}
            en={<>The same year, Aldous-Diaconis coined the term "cutoff" — TV stays nearly flat until τ_mix, then drops to 0 within a window of width O(√t). It mirrors the physical intuition of "metastable diffusion → sudden equilibration". Modern work (Berestycki-Şengül 2019, Bordenave-Lacoin-Salez 2019) extends the cutoff phenomenon to non-Abelian conjugacy-invariant walks; it holds for Lie-type groups like PGL.</>}
          />
        </p>

        {/* ─────────────── 14.13 Expanders, Ramanujan ─────────────── */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.13  扩张图 (expanders) 与 Ramanujan 图" en="14.13  Expanders and Ramanujan graphs" />
        </h3>
        <p>
          <L
            zh={<>一个 k-正则图序列 <TeX src={`\\{\\Gamma_n\\}`} /> (节点数 → ∞) 是 <strong>扩张族</strong> (expander family), 如果存在 ε {'>'} 0 使 h(Γ_n) ≥ ε 对所有 n 成立。 等价地 (Cheeger): λ₂(A_n)/k ≤ 1 − δ 对某 δ {'>'} 0。 扩张图是 「最稀疏的连通图」 — 用 O(N) 条边把 N 个点维持 「全局紧密」, 是计算机科学的圣杯 (用于 error-correcting codes, 伪随机, 哈希, hardness amplification 等)。</>}
            en={<>A sequence of k-regular graphs <TeX src={`\\{\\Gamma_n\\}`} /> (number of nodes → ∞) is an <strong>expander family</strong> if there is ε {'>'} 0 with h(Γ_n) ≥ ε for all n. Equivalently (by Cheeger): λ₂(A_n)/k ≤ 1 − δ for some δ {'>'} 0. Expanders are "the sparsest connected graphs" — O(N) edges keep N nodes globally well-connected. They are a holy grail of CS (error-correcting codes, pseudorandomness, hashing, hardness amplification).</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 14.13 — Ramanujan 图', en: 'Definition 14.13 — Ramanujan graph'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>k-正则图 Γ 是 <strong>Ramanujan</strong> 如果所有非平凡特征值 <TeX src={`|\\lambda_i| \\leq 2\\sqrt{k-1}`} />。 这是 Alon-Boppana 定理给出的 「谱下界」 — 没有图能比 <TeX src={`2\\sqrt{k-1}`} /> 更稀疏。 故 Ramanujan = 「<strong>最优扩张图</strong>」 (spectrally optimal expander)。</>}
              en={<>A k-regular graph Γ is <strong>Ramanujan</strong> if every non-trivial eigenvalue satisfies <TeX src={`|\\lambda_i| \\leq 2\\sqrt{k-1}`} />. This is optimal — Alon-Boppana proved no graph can do better. Hence "Ramanujan" = "<strong>spectrally optimal expander</strong>".</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>奇迹: Lubotzky-Phillips-Sarnak (1988) 给出了 <strong>无穷多个</strong> Ramanujan 图族, 构造方法是: 取 G = PSL₂(𝔽_p), 选 <em>p + 1</em> 个 「Hecke 算子」 作为生成集 S (来自四元数代数和 Ramanujan-Petersson 猜想, Deligne 1974 已证)。 这些图是 (p+1)-正则的, 直径 O(log |G|), 围长 (4/3) log_{`{p}`}(|G|), 谱满足 |λ| ≤ 2√p。 它们都是 <strong>Cayley 图</strong>。</>}
            en={<>The miracle (Lubotzky-Phillips-Sarnak 1988): they constructed <strong>infinite families</strong> of Ramanujan graphs via G = PSL₂(𝔽_p) and a generating set S of <em>p + 1</em> "Hecke operators" coming from quaternion algebras and Ramanujan-Petersson (Deligne 1974). The graphs are (p+1)-regular, diameter O(log |G|), girth (4/3) log<sub>p</sub>|G|, with |λ| ≤ 2√p. They are all <strong>Cayley graphs</strong>.</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr>
              <th>{tr({ zh: '图族', en: 'family'
            })}</th>
              <th>{tr({ zh: '次数 k', en: 'degree k'
            })}</th>
              <th>{tr({ zh: '直径', en: 'diameter'
            })}</th>
              <th>{tr({ zh: '谱性质', en: 'spectral'
            })}</th>
              <th>{tr({ zh: '是否 Cayley', en: 'Cayley?' })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{tr({ zh: '随机正则图 (Friedman 2003)', en: 'random k-regular (Friedman 2003)'
            })}</td>
              <td className="num">k</td>
              <td className="num">log_k N</td>
              <td>|λ| ≤ 2√(k-1) + ε{tr({ zh: ' (高概率)', en: ' (whp)'
            })}</td>
              <td>—</td>
            </tr>
            <tr>
              <td>LPS 1988 (PSL₂(𝔽_p))</td>
              <td className="num">p+1</td>
              <td className="num">~log N</td>
              <td>|λ| ≤ 2√p {lang === 'zh' ? '(Ramanujan)' : '(Ramanujan)'}</td>
              <td>✓</td>
            </tr>
            <tr>
              <td>Margulis 1973 (SL₂(ℤ))</td>
              <td className="num">8</td>
              <td className="num">O(log N)</td>
              <td>{tr({ zh: '一类显式扩张', en: 'explicit expander'
            })}</td>
              <td>{tr({ zh: '商图', en: 'quotient'
            })}</td>
            </tr>
            <tr>
              <td>{tr({ zh: '魔方 (HTM)', en: 'Rubik cube (HTM)' })}</td>
              <td className="num">18</td>
              <td className="num">20</td>
              <td>λ₂/k ≈ 0.95{tr({ zh: ' (扩张但非 Ramanujan)', en: ' (expander, not Ramanujan)'
            })}</td>
              <td>✓</td>
            </tr>
            <tr>
              <td>{tr({ zh: 'Alon-Roichman 随机 Cayley', en: 'Alon-Roichman random Cayley'
            })}</td>
              <td className="num">~log|G|</td>
              <td className="num">{lang === 'zh' ? 'polylog' : 'polylog'}</td>
              <td>{tr({ zh: '扩张 (高概率)', en: 'expander (whp)'
            })}</td>
              <td>✓</td>
            </tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>三个独立的扩张图构造方法 (Margulis 1973 → LPS 1988 → Alon-Roichman 1994) 各自代表了 「<strong>显式数论</strong>」 「<strong>四元数代数 + Ramanujan 猜想</strong>」 「<strong>随机化</strong>」 三种思路。 后来 Reingold-Vadhan-Wigderson (2002) 给了 「zig-zag 乘积」 构造, 完全组合学没用代数。 这是过去 50 年 「极值组合学」 最深的方向之一。</>}
            en={<>Three independent expander constructions (Margulis 1973 → LPS 1988 → Alon-Roichman 1994) embody three strategies: "<strong>explicit number theory</strong>", "<strong>quaternion algebras + Ramanujan conjecture</strong>", "<strong>randomization</strong>". Later Reingold-Vadhan-Wigderson (2002) gave a purely combinatorial "zig-zag product" construction. One of the deepest threads in extremal combinatorics of the last 50 years.</>}
          />
        </p>

        {/* ─────────────── 14.14 Babai's conjecture, diameter problem ─────────────── */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.14  直径问题 — Babai 猜想" en="14.14  The diameter problem — Babai's conjecture" />
        </h3>
        <p>
          <L
            zh={<>对一个 「<em>任意</em>」 生成集 S, Cayley 图的直径能小到什么程度? 魔方的 20 是 「极小直径但巨大状态空间」 的奇观 — 我们都看到了。 对其他群呢? Babai (1992) 提出一个大胆猜想:</>}
            en={<>How small can the diameter of Cay(G, S) be, taken over <em>arbitrary</em> generating sets S? The cube's 20 is one wonder — tiny diameter on a vast state space. What about other groups? Babai (1992) made a bold conjecture:</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: 'Babai 猜想 (1992)', en: "Babai's conjecture (1992)" })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对每个 <em>非阿贝尔有限单群</em> G 和每个对称生成集 S, <TeXBlock src={`\\mathrm{diam}\\bigl(\\mathrm{Cay}(G, S)\\bigr) \\;\\leq\\; (\\log |G|)^c`} /> 其中 c 是绝对常数 (与 G 无关)。 即 「<strong>所有非阿贝尔有限单群都是 polylog-直径</strong>」 — 不管你怎么挑生成集。</>}
              en={<>For every <em>non-Abelian finite simple group</em> G and every symmetric generating set S, <TeXBlock src={`\\mathrm{diam}\\bigl(\\mathrm{Cay}(G, S)\\bigr) \\;\\leq\\; (\\log |G|)^c`} /> for some absolute constant c independent of G. In short: "<strong>every non-Abelian finite simple group has polylog diameter</strong>" — no matter what generating set you pick.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个猜想至今 (2026) 仍 <strong>开放</strong>。 已知结果是 「分层进展」:</>}
            en={<>The conjecture remains <strong>open</strong> as of 2026. Known progress is "layered":</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>Helfgott 2008</strong>: G = PSL₂(𝔽_p) 时 diam = O((log p)^c) (即 c = O(1))。 用加性组合 (Bourgain-Gamburd-Sarnak 工具箱) 证明 「product theorem」: <TeX src={`|A \\cdot A \\cdot A| \\geq |A|^{1+\\epsilon}`} /> 除非 A 已经接近一个子群。 这是 Cayley 直径研究的转折点。</>}
              en={<><strong>Helfgott 2008</strong>: G = PSL₂(𝔽_p) gives diam = O((log p)^c), so c = O(1). The proof uses additive-combinatorics tools (Bourgain-Gamburd-Sarnak) to establish a "product theorem": <TeX src={`|A \\cdot A \\cdot A| \\geq |A|^{1+\\epsilon}`} /> unless A is already close to a subgroup. Turning-point work.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>Pyber-Szabó & Breuillard-Green-Tao (2016)</strong>: 把 Helfgott 的结果扩展到 <em>所有有界秩</em> 的 Lie 型单群 (PSL_n, PSp, ...)。 这部分 Babai 猜想完全解决。</>}
              en={<><strong>Pyber-Szabó &amp; Breuillard-Green-Tao (2016)</strong>: extended Helfgott's bound to <em>all bounded-rank</em> finite simple groups of Lie type (PSL_n, PSp, ...). This portion of Babai's conjecture is fully solved.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>无界秩仍开放</strong>: A_n (alternating group) 和 PSL_n(𝔽_p) (n → ∞) 还不知道。 Babai-Seress (1992) 早期上界 <TeX src={`e^{(1+o(1))\\sqrt{n \\log n}}`} /> (亚指数), Helfgott-Seress (2014) 给出 <TeX src={`\\exp\\bigl((\\log n)^4 \\log \\log n\\bigr)`} /> 的更紧界, 仍远高于 polylog。</>}
              en={<><strong>Unbounded rank still open</strong>: A_n and PSL_n(𝔽_p) (n → ∞) remain mysteries. Babai-Seress (1992) gave an early subexponential bound <TeX src={`e^{(1+o(1))\\sqrt{n \\log n}}`} />; Helfgott-Seress (2014) tightened to <TeX src={`\\exp\\bigl((\\log n)^4 \\log \\log n\\bigr)`} /> — still far above polylog.</>}
            />
          </li>
        </ul>
        <div className="gt-aside">
          <L
            zh={<>魔方的 G 不是 「有限单群」 — 它是非阿贝尔但 <em>可解</em> 的, 有合成列。 所以 「diam = 20」 不属于 Babai 猜想的范畴, 而是更易处理的 「可解群直径」 范畴。 但魔方仍是 「polylog 直径 + 巨大 |G|」 的典型例子, 给 Babai 猜想提供了 「这是合理的」 的直觉支撑。</>}
            en={<>Note: the cube G is <em>not</em> a finite simple group — it is non-Abelian but solvable, with a composition series. So "diam = 20" is outside Babai's conjecture proper. But it is a flagship example of "polylog diameter on huge |G|" and provides intuition that the conjecture is reasonable.</>}
          />
        </div>

        {/* ─────────────── 14.15 Growth functions, Gromov ─────────────── */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.15  增长函数与几何群论" en="14.15  Growth functions and geometric group theory" />
        </h3>
        <p>
          <L
            zh={<>对 <em>无限</em> 群 G 配生成集 S, 定义 <strong>增长函数</strong> <TeX src={`\\gamma_G^S(n) = |B_n(e)|`} /> = 距 e 不超过 n 的球内顶点数。 不同 S 给不同 γ, 但 「<em>增长率类</em>」 是不变的:</>}
            en={<>For an <em>infinite</em> group G with generating set S, the <strong>growth function</strong> is <TeX src={`\\gamma_G^S(n) = |B_n(e)|`} />, the size of the ball of radius n around e. Different S gives different γ, but the <em>growth class</em> is invariant:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>多项式增长</strong>: <TeX src={`\\gamma(n) \\leq C n^d`} /> for some d。 例: <TeX src={`\\mathbb{Z}^d`} /> 增长 ∼ n^d。</>} en={<><strong>Polynomial growth</strong>: <TeX src={`\\gamma(n) \\leq C n^d`} />. Example: <TeX src={`\\mathbb{Z}^d`} /> grows as n^d.</>} /></li>
          <li><L zh={<><strong>指数增长</strong>: <TeX src={`\\gamma(n) \\geq C\\, a^n`} /> for some a {'>'} 1。 例: 自由群 F_2 增长 ∼ 3·4^{`{n-1}`}。</>} en={<><strong>Exponential growth</strong>: <TeX src={`\\gamma(n) \\geq C\\, a^n`} /> with a {'>'} 1. Example: free group F_2 grows as 3·4^{`{n-1}`}.</>} /></li>
          <li><L zh={<><strong>中间增长</strong>: 比多项式快, 比指数慢。 Milnor 1968 提问: 存在吗? Grigorchuk 1984 给出第一个例子 (Grigorchuk 群)。</>} en={<><strong>Intermediate growth</strong>: faster than polynomial, slower than exponential. Asked by Milnor (1968); Grigorchuk (1984) gave the first example (the Grigorchuk group).</>} /></li>
        </ul>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: "Gromov 定理 (1981) — 多项式增长 ⇔ 几乎幂零", en: "Gromov's theorem (1981) — polynomial growth ⇔ virtually nilpotent"
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>一个有限生成群 G 多项式增长 ⇔ G 包含一个有限指数的幂零 (nilpotent) 子群。 进一步, Bass-Guivarc'h 公式给出增长阶 <TeX src={`d = \\sum_i i \\cdot \\mathrm{rank}(\\Gamma_i / \\Gamma_{i+1})`} /> 永远是整数 (没有分数次方增长)。</>}
              en={<>A finitely generated group G has polynomial growth ⇔ G contains a nilpotent subgroup of finite index. Moreover, the Bass-Guivarc'h formula gives the growth degree <TeX src={`d = \\sum_i i \\cdot \\mathrm{rank}(\\Gamma_i / \\Gamma_{i+1})`} /> as always an integer (no fractional growth rates).</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>Gromov 的证明引入 「<strong>Gromov-Hausdorff 收敛</strong>」 — 把一族 Cayley 图按比例缩放然后取极限, 极限是一个度量空间 (group's asymptotic cone)。 这把 Cayley 图从 「图论对象」 推到 「几何对象」, 开创了 <strong>几何群论</strong> (geometric group theory) 这门学科。 后续 Cannon, Gersten, Bestvina 等延伸到 hyperbolic groups, CAT(0) groups, mapping class groups。</>}
            en={<>Gromov's proof introduced <strong>Gromov-Hausdorff convergence</strong> — rescale a Cayley graph and take a limit, the asymptotic cone is a metric space. This promoted the Cayley graph from "graph-theoretic object" to "geometric object", launching the field of <strong>geometric group theory</strong>. Later Cannon, Gersten, Bestvina extended this to hyperbolic groups, CAT(0) groups, mapping class groups.</>}
          />
        </p>
        <div className="gt-pullquote">
          <L
            zh={<>「一个群应该被研究为一个度量空间。 它的代数性质由 Cayley 图作为一个无限度量对象的几何性质表达。」</>}
            en={<>"A group should be studied as a metric space. Its algebraic properties are expressed by the geometric properties of its Cayley graph as an infinite metric object."</>}
          />
          <div className="gt-pullquote-cite">— Mikhail Gromov, paraphrased from <em>Asymptotic Invariants of Infinite Groups</em> (1993)</div>
        </div>

        {/* ─────────────── 14.16 Cayley's theorem ─────────────── */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.16  Cayley 定理 (1854) — 每个群都是置换群" en="14.16  Cayley's theorem (1854) — every group is a permutation group" />
        </h3>
        <p>
          <L
            zh={<>有意思的历史: 那篇 1878 年画 Cayley 图的论文之前, Cayley 在 1854 年已证明了一个更深的定理 — 把抽象群和具体置换群锁在了一起:</>}
            en={<>A historical aside: a quarter century before drawing his graphs (1878), Cayley had already proved a deeper theorem (1854) that locks abstract groups to concrete permutation groups:</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: "定理 14.16 — Cayley 1854", en: "Theorem 14.16 — Cayley 1854" })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>每个群 G 同构地嵌入 Sym(G), 即 <TeX src={`G \\hookrightarrow S_{|G|}`} />。 嵌入由 「左乘」 给出: <TeX src={`g \\mapsto L_g`} /> 其中 L_g(x) = g·x。</>}
              en={<>Every group G embeds isomorphically into Sym(G), i.e. <TeX src={`G \\hookrightarrow S_{|G|}`} />. The embedding is by "left-multiplication": <TeX src={`g \\mapsto L_g`} /> with L_g(x) = g·x.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<><strong>证明概要</strong>: 检查 L_g 是双射 (因为 <TeX src={`L_{g^{-1}}`} /> 是它的反函数), 且 <TeX src={`L_{gh}(x) = (gh)x = g(hx) = L_g(L_h(x))`} />, 即 g ↦ L_g 是群同态。 核 = {`{g : L_g = \\mathrm{id}\\}`} = {`{g : g \\cdot x = x \\;\\forall x\\}`} = {`{e}`}。 故是嵌入。 ∎</>}
            en={<><strong>Proof sketch</strong>: L_g is a bijection (with inverse <TeX src={`L_{g^{-1}}`} />), and <TeX src={`L_{gh}(x) = (gh)x = g(hx) = L_g(L_h(x))`} />, so g ↦ L_g is a group homomorphism. Its kernel is {`{g : L_g = \\mathrm{id}\\}`} = {`{g : gx = x \\;\\forall x\\}`} = {`{e}`}. Hence the map is injective. ∎</>}
          />
        </p>
        <p>
          <L
            zh={<>这就是 「Cayley 图」 的祖先 — Cayley 图的边 g → g·s <em>就是</em> 「L_s 在节点 g 上的作用」。 把 Cayley 定理可视化 = 把 G 的每个生成元 s 画成 「permutation of vertices = arrow set」 = Cayley 图。 因此 Cayley 1878 的论文标题 <em>Graphical representation</em> (图形表示) 正是这层意义: <strong>用图把 1854 的定理画出来</strong>。</>}
            en={<>This is the ancestor of "the Cayley graph" — the edge g → g·s <em>is</em> "L_s acting on node g". Visualising Cayley's theorem = drawing each generator s as a "permutation of vertices = arrow set" = the Cayley graph. The title of Cayley's 1878 paper, <em>Graphical representation</em>, is precisely this: <strong>drawing his 1854 theorem on paper</strong>.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '推论 14.16.1 — 魔方 G 嵌入 S₄.₃ₓ₁₀¹⁹', en: 'Corollary 14.16.1 — the cube G embeds in S_{4.3×10¹⁹}'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>形式上, 魔方的 G 是 <TeX src={`S_{4.3 \\times 10^{19}}`} /> 的一个子群。 但这没什么用 — <TeX src={`|S_n| = (4.3 \\times 10^{19})!`} /> 是远超宇宙原子数的天文数。 实际我们用 「<strong>更紧的</strong>」 嵌入 G ↪ S₈ × S₁₂ (角块 + 棱块置换) 来计算, 把 cube state 编码成 (8 + 12)-元置换 + 朝向向量 — 这就是 §5 的 (cp, co, ep, eo) 表示。</>}
              en={<>Formally, G is a subgroup of <TeX src={`S_{4.3 \\times 10^{19}}`} />. This is useless in practice — <TeX src={`|S_n| = (4.3 \\times 10^{19})!`} /> is astronomically larger than the number of atoms in the universe. We use the <strong>much tighter</strong> embedding G ↪ S₈ × S₁₂ (corner and edge permutations) plus an orientation vector — that is the (cp, co, ep, eo) representation from §5.</>}
            />
          </div>
        </div>

        {/* ─────────────── 14.17 Open problems + bibliography ─────────────── */}
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.17  开放问题 与 延伸阅读" en="14.17  Open problems and further reading" />
        </h3>
        <p>
          <L
            zh={<>魔方 Cayley 图是 「研究最深的极端有限对象之一」, 但仍有许多基本问题悬而未决:</>}
            en={<>The cube Cayley graph is one of the most thoroughly studied "extreme" finite objects in mathematics, yet many basic questions remain open:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>4×4×4 直径</strong>: 已知 ≥ 22, ≤ 36 (HTM), 真实值未知。 状态空间 ≈ 7.4 × 10⁴⁵, 比 3×3×3 大 2 × 10²⁶ 倍。 没有任何 「god's number」 风格的全局 BFS 可行。</>}
              en={<><strong>4×4×4 diameter</strong>: bounded 22 ≤ diam ≤ 36 (HTM), exact unknown. State space ≈ 7.4 × 10⁴⁵, a factor of 2 × 10²⁶ larger than 3×3×3 — no Rokicki-style global BFS is feasible.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>魔方谱隙的解析值</strong>: λ₂/k ≈ 0.95 来自数值估计, 但没有解析公式。 (对 Abelian Cayley 图, 谱由 Fourier 自然给出; 对魔方非 Abelian, 需要 G 的所有不可约表示 — 约 80 个 — 上的 character sums。)</>}
              en={<><strong>Analytic spectral gap for the cube</strong>: λ₂/k ≈ 0.95 is numerical only; no closed form. For Abelian Cayley graphs the spectrum is Fourier; for the cube it requires character sums over G's ~80 irreps.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>魔方混合时间精确值</strong>: 已知 ≥ 26 (Bordoni-Reiter 2024); 上界 ≤ 70 (数值); 精确常数和 cutoff 现象未知。</>}
              en={<><strong>Exact cube mixing time</strong>: ≥ 26 (Bordoni-Reiter 2024); ≤ 70 (numerical); exact value and cutoff window unknown.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>QTM 直径 vs HTM</strong>: 26 vs 20。 已知准确, 但 「为什么差 6」 没有解析解释 — 它是 「Cayley 图重新连线后的全局重排」 后果。</>}
              en={<><strong>QTM vs HTM diameter</strong>: 26 vs 20. Both proven exact. But why the gap is exactly 6 has no analytic explanation — it is a global rearrangement effect of rewiring the graph.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>Babai 猜想 (A_n 与无界秩)</strong>: 至 2026 仍开放 (§14.14)。</>}
              en={<><strong>Babai's conjecture for A_n and unbounded rank</strong>: open as of 2026 (§14.14).</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>Hamilton 路径 (Lovász 1969)</strong>: 是否每个连通的 Cayley 图都有 Hamilton 圈? 对魔方等于问 「有没有一个 4.3 × 10¹⁹ 长的 「打乱序列」 不重复任何状态」 — 是的 (Curtis 1970)。 一般情形仍开放。</>}
              en={<><strong>Lovász Hamilton path conjecture (1969)</strong>: every connected Cayley graph has a Hamiltonian cycle (up to four exceptions). For the cube: yes (Curtis 1970). The general conjecture remains open.</>}
            />
          </li>
        </ul>

        <h4 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="参考文献 (24 篇)" en="References (24 entries)" />
        </h4>
        <CayleyReferences />

        <div className="gt-pullquote">
          <L
            zh={<>「Cayley 图把抽象的乘法表变成度量空间。 一旦能 「<em>看</em>」 群, 群论里 「直径」 「球壳」 「混合时间」 「扩张」 「增长」 这些词就有了几何含义 — 而魔方恰好是这种几何最容易直观体会的对象。」</>}
            en={<>"The Cayley graph promotes an abstract multiplication table to a metric space. Once one can <em>see</em> the group, words like 'diameter,' 'sphere,' 'mixing,' 'expansion,' 'growth' acquire geometric meaning — and the Rubik's cube is the most tactile example of this geometry."</>}
          />
        </div>

      </GTSec>
  );
}
