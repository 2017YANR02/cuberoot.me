'use client';

/**
 * /math/group — Rubik's Cube and group theory.
 * A long-form math essay with five interactive panels:
 *   §3  ConjugateViewer   — A B A⁻¹ animation
 *   §4  CubeStateInspector — apply alg, see (cp, co, ep, eo) arrays
 *   §6  InvariantInspector — three reachability invariants live
 *   §7  PeriodExplorer    — order of any element, with chart
 *   §9  CommutatorViewer  — [A,B] = A B A⁻¹ B⁻¹ animation
 *   §10 SubgroupClimber    — Thistlethwaite stage detector
 *
 * All animations use cubing.js TwistyPlayer; all invariants use the local
 * cube_state.ts module (verified against R, RU, superflip orders).
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from '@/components/AppLink';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { SlugContext, GTSec, L, useLang, TeX, TeXBlock, type Lang } from './_components/primitives';
import { TwistyMini } from './_components/TwistyMini';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  identity, applyAlg, orderOf, invariants, invertAlg, conjugate, commutator,
  tokenize, isSolved, thistlethwaiteStage, cycleStructure, permSign,
  type CubieState,
} from './_components/cube_state';
import './group_theory.css';
import { tr } from '@/i18n/tr';

// ── Extended sections §33–§62 (self-contained files, lazy-loaded per slug so the
//    base page chunk stays lean — only the active section's code is fetched) ──
const EXT_COMPONENTS: Record<string, ReturnType<typeof dynamic>> = {
  'wreath-product': dynamic(() => import('./_components/sections/WreathProduct'), { ssr: false }),
  'semidirect-product': dynamic(() => import('./_components/sections/SemidirectProduct'), { ssr: false }),
  'sylow': dynamic(() => import('./_components/sections/SylowTheorems'), { ssr: false }),
  'composition-series': dynamic(() => import('./_components/sections/CompositionSeries'), { ssr: false }),
  'solvable-nilpotent': dynamic(() => import('./_components/sections/SolvableNilpotent'), { ssr: false }),
  'abelian-classification': dynamic(() => import('./_components/sections/AbelianClassification'), { ssr: false }),
  'automorphism-group': dynamic(() => import('./_components/sections/AutomorphismGroup'), { ssr: false }),
  'cyclic-modular': dynamic(() => import('./_components/sections/CyclicModular'), { ssr: false }),
  'dihedral': dynamic(() => import('./_components/sections/DihedralGroups'), { ssr: false }),
  'platonic-symmetry': dynamic(() => import('./_components/sections/PlatonicSymmetry'), { ssr: false }),
  'frieze-groups': dynamic(() => import('./_components/sections/FriezeGroups'), { ssr: false }),
  'wallpaper-groups': dynamic(() => import('./_components/sections/WallpaperGroups'), { ssr: false }),
  'point-groups-crystal': dynamic(() => import('./_components/sections/PointGroupsCrystal'), { ssr: false }),
  'reflection-coxeter': dynamic(() => import('./_components/sections/ReflectionCoxeter'), { ssr: false }),
  'plane-isometries': dynamic(() => import('./_components/sections/PlaneIsometries'), { ssr: false }),
  'polya-cube-colorings': dynamic(() => import('./_components/sections/PolyaCubeColorings'), { ssr: false }),
  'cycle-index': dynamic(() => import('./_components/sections/CycleIndex'), { ssr: false }),
  'class-equation': dynamic(() => import('./_components/sections/ClassEquation'), { ssr: false }),
  'character-table': dynamic(() => import('./_components/sections/CharacterTable'), { ssr: false }),
  'young-tableaux': dynamic(() => import('./_components/sections/YoungTableaux'), { ssr: false }),
  'representation-basics': dynamic(() => import('./_components/sections/RepresentationBasics'), { ssr: false }),
  'fourier-on-groups': dynamic(() => import('./_components/sections/FourierOnGroups'), { ssr: false }),
  'quaternion-group': dynamic(() => import('./_components/sections/QuaternionGroup'), { ssr: false }),
  'free-groups': dynamic(() => import('./_components/sections/FreeGroups'), { ssr: false }),
  'cayley-theorem': dynamic(() => import('./_components/sections/CayleyTheorem'), { ssr: false }),
  'orbit-stabilizer': dynamic(() => import('./_components/sections/OrbitStabilizer'), { ssr: false }),
  'matrix-lie-groups': dynamic(() => import('./_components/sections/MatrixLieGroups'), { ssr: false }),
  'galois-connection': dynamic(() => import('./_components/sections/GaloisConnection'), { ssr: false }),
  'growth-of-groups': dynamic(() => import('./_components/sections/GrowthOfGroups'), { ssr: false }),
  'expander-ramanujan': dynamic(() => import('./_components/sections/ExpanderRamanujan'), { ssr: false }),
  'refs': dynamic(() => import('./_components/sections/References'), { ssr: false }),
  'structure': dynamic(() => import('./_components/sections/StructureTheorem'), { ssr: false }),
  'beyond': dynamic(() => import('./_components/sections/BeyondTheCube'), { ssr: false }),
  'open-problems': dynamic(() => import('./_components/sections/OpenProblems'), { ssr: false }),
  'order': dynamic(() => import('./_components/sections/ScaleComparisonSection'), { ssr: false }),
  'other-puzzles': dynamic(() => import('./_components/sections/OtherPuzzles'), { ssr: false }),
  'representations': dynamic(() => import('./_components/sections/RepresentationGlimpse'), { ssr: false }),
  'gods-number': dynamic(() => import('./_components/sections/GodsNumber'), { ssr: false }),
  'lights-out': dynamic(() => import('./_components/sections/LightsOut'), { ssr: false }),
  'peg-solitaire': dynamic(() => import('./_components/sections/PegSolitaire'), { ssr: false }),
  'hamiltonian': dynamic(() => import('./_components/sections/HamiltonianPaths'), { ssr: false }),
  'two-face-pgl': dynamic(() => import('./_components/sections/TwoFacePGL'), { ssr: false }),
  'rotational-puzzles': dynamic(() => import('./_components/sections/RotationalPuzzles'), { ssr: false }),
  'useful-math': dynamic(() => import('./_components/sections/UsefulMath'), { ssr: false }),
  'what-is-a-group': dynamic(() => import('./_components/sections/WhatIsAGroup'), { ssr: false }),
  'lagrange': dynamic(() => import('./_components/sections/LagrangeCosets'), { ssr: false }),
  'quotient': dynamic(() => import('./_components/sections/QuotientGroups'), { ssr: false }),
  'permutation-groups': dynamic(() => import('./_components/sections/PermutationGroups'), { ssr: false }),
  'algorithms': dynamic(() => import('./_components/sections/SolvingAlgorithms'), { ssr: false }),
  'distance': dynamic(() => import('./_components/sections/DistanceDistribution'), { ssr: false }),
  'random-walks': dynamic(() => import('./_components/sections/RandomWalks'), { ssr: false }),
};

function NewSectionMount({ slug }: { slug: string }) {
  const C = EXT_COMPONENTS[slug];
  return C ? <C /> : null;
}

// TeX / TeXBlock / SlugContext / GTSec / L / useLang live in ./_components/primitives;
// the TwistyMini cube player lives in ./_components/TwistyMini. Slug is undefined on
// the index page or one of the TOC ids on a section sub-page; GTSec renders only when
// its id matches the slug, so one return body serves both modes.

function GeneratorRow() {
  const faces: { f: string; zh: string; en: string
 }[] = [
    { f: 'U', zh: '上层顺时针', en: 'Up'
    },
    { f: 'D', zh: '下层顺时针', en: 'Down'
    },
    { f: 'R', zh: '右层顺时针', en: 'Right'
    },
    { f: 'L', zh: '左层顺时针', en: 'Left'
    },
    { f: 'F', zh: '前层顺时针', en: 'Front'
    },
    { f: 'B', zh: '后层顺时针', en: 'Back'
    },
  ];
  const lang = useLang();
  return (
    <div className="gt-cube-row">
      {faces.map(({ f, zh, en }) => (
        <div className="gt-cube-cell" key={f}>
          <div className="gt-cube-label">{f}</div>
          <TwistyMini alg={f} />
          <div className="gt-cube-sub">{lang === 'zh' ? zh : en}</div>
        </div>
      ))}
    </div>
  );
}

// ── §4 CubeStateInspector ───────────────────────────────────────────────────
function CubeStateInspector() {
  const lang = useLang();
  const [alg, setAlg] = useState("R U R' U'");
  const state = useMemo<CubieState>(() => {
    try { return applyAlg(identity(), alg); } catch { return identity(); }
  }, [alg]);
  const prevState = useRef<CubieState>(identity());
  useEffect(() => { prevState.current = state; }, [state]);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 状态张量分解', en: 'Interactive § State tensor'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '魔方状态 = (cp, co, ep, eo) 四元组。输入任意公式,看四个数组随之变化。', en: 'A cube state is the 4-tuple (cp, co, ep, eo). Type any alg, watch the four arrays mutate.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} placeholder="R U R' U' …" />
        <button className="gt-btn-ghost gt-btn" onClick={() => setAlg('')}>{tr({ zh: '清空', en: 'reset' })}</button>
      </div>

      <div className="gt-twisty-inline"><TwistyMini alg={alg} /></div>

      <div className="gt-state-grid">
        <div className="gt-state-box">
          <div className="gt-state-box-title">cp ∈ S₈ — corner permutation</div>
          <div className="gt-state-cells">
            {state.cp.map((v, i) => (
              <div className={`gt-state-cell ${v !== i ? 'gt-state-cell-changed' : ''}`} key={i}>
                <span className="gt-state-idx">{i}</span>
                {v}
              </div>
            ))}
          </div>
        </div>
        <div className="gt-state-box">
          <div className="gt-state-box-title">co ∈ (ℤ/3)⁸ — corner twist</div>
          <div className="gt-state-cells">
            {state.co.map((v, i) => (
              <div className={`gt-state-cell ${v !== 0 ? 'gt-state-cell-twisted' : ''}`} key={i}>
                <span className="gt-state-idx">{i}</span>
                {v}
              </div>
            ))}
          </div>
        </div>
        <div className="gt-state-box">
          <div className="gt-state-box-title">ep ∈ S₁₂ — edge permutation</div>
          <div className="gt-state-cells">
            {state.ep.map((v, i) => (
              <div className={`gt-state-cell ${v !== i ? 'gt-state-cell-changed' : ''}`} key={i}>
                <span className="gt-state-idx">{i}</span>
                {v}
              </div>
            ))}
          </div>
        </div>
        <div className="gt-state-box">
          <div className="gt-state-box-title">eo ∈ (ℤ/2)¹² — edge flip</div>
          <div className="gt-state-cells">
            {state.eo.map((v, i) => (
              <div className={`gt-state-cell ${v !== 0 ? 'gt-state-cell-flipped' : ''}`} key={i}>
                <span className="gt-state-idx">{i}</span>
                {v}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '角块循环型', en: 'corner cycle type'
        })}</div>
          <div className="gt-result-val">{formatCycle(cycleStructure(state.cp), lang)}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '棱块循环型', en: 'edge cycle type'
        })}</div>
          <div className="gt-result-val">{formatCycle(cycleStructure(state.ep), lang)}</div>
        </div>
      </div>
    </div>
  );
}

function formatCycle(cycles: number[], _lang: Lang): string {
  if (cycles.length === 0) return tr({ zh: '恒等 (无循环)', en: 'identity (no cycles)'
});
  return cycles.map(c => `${c}-cycle`).join(' × ');
}

// ── §6 InvariantInspector ──────────────────────────────────────────────────
function InvariantInspector() {
  const [alg, setAlg] = useState("R U R' U'");
  const [breakCo, setBreakCo] = useState(false);
  const [breakEo, setBreakEo] = useState(false);
  const [swapEdges, setSwapEdges] = useState(false);

  const state = useMemo<CubieState>(() => {
    let s = identity();
    try { s = applyAlg(s, alg); } catch { /* fall-through */ }
    if (breakCo) s = { ...s, co: s.co.map((v, i) => i === 0 ? (v + 1) % 3 : v) };
    if (breakEo) s = { ...s, eo: s.eo.map((v, i) => i === 0 ? (v + 1) % 2 : v) };
    if (swapEdges) {
      const ep = s.ep.slice();
      [ep[0], ep[1]] = [ep[1], ep[0]];
      s = { ...s, ep };
    }
    return s;
  }, [alg, breakCo, breakEo, swapEdges]);

  const inv = invariants(state);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 三个守恒律', en: 'Interactive § Three invariants'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '凡是合法的魔方状态都满足三条约束。手动破坏任何一条,状态就不可达 (即,无法仅靠 6 个面转出来)。', en: 'Every legal cube state satisfies three constraints. Manually break any one and the state is unreachable — no sequence of face turns can produce it.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        <span className={`gt-chip ${breakCo ? 'gt-chip-active' : ''}`} onClick={() => setBreakCo(v => !v)}>
          {tr({ zh: '手扭角块 0', en: 'twist corner 0'
        })}
        </span>
        <span className={`gt-chip ${breakEo ? 'gt-chip-active' : ''}`} onClick={() => setBreakEo(v => !v)}>
          {tr({ zh: '手翻棱块 0', en: 'flip edge 0'
        })}
        </span>
        <span className={`gt-chip ${swapEdges ? 'gt-chip-active' : ''}`} onClick={() => setSwapEdges(v => !v)}>
          {tr({ zh: '交换两棱块', en: 'swap two edges'
        })}
        </span>
      </div>

      <div className="gt-inv-grid">
        <div className="gt-inv">
          <div className="gt-inv-label">Σ co (mod 3)</div>
          <div className={`gt-inv-val ${inv.coSum === 0 ? 'gt-inv-ok' : 'gt-inv-bad'}`}>{inv.coSum}</div>
        </div>
        <div className="gt-inv">
          <div className="gt-inv-label">Σ eo (mod 2)</div>
          <div className={`gt-inv-val ${inv.eoSum === 0 ? 'gt-inv-ok' : 'gt-inv-bad'}`}>{inv.eoSum}</div>
        </div>
        <div className="gt-inv">
          <div className="gt-inv-label">sgn(cp)</div>
          <div className={`gt-inv-val ${inv.cpSign === inv.epSign ? 'gt-inv-ok' : 'gt-inv-bad'}`}>{inv.cpSign === 1 ? '+1' : '−1'}</div>
        </div>
        <div className="gt-inv">
          <div className="gt-inv-label">sgn(ep)</div>
          <div className={`gt-inv-val ${inv.cpSign === inv.epSign ? 'gt-inv-ok' : 'gt-inv-bad'}`}>{inv.epSign === 1 ? '+1' : '−1'}</div>
        </div>
      </div>

      <div className={`gt-inv-final ${inv.reachable ? '' : 'gt-inv-final-bad'}`}>
        {inv.reachable
          ? tr({ zh: '✓ 可达 — 该状态是 G 的元素', en: '✓ Reachable — this state is in G'
                          })
          : tr({ zh: '✗ 不可达 — 该状态不在 G 中', en: '✗ Unreachable — this state is not in G'
                          })}
      </div>
    </div>
  );
}

// ── §7 PeriodExplorer ──────────────────────────────────────────────────────
function PeriodExplorer() {
  const [alg, setAlg] = useState('R U');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [iter, setIter] = useState(0);
  const animRef = useRef<number | null>(null);

  const period = useMemo(() => {
    try {
      const o = orderOf(alg);
      return o > 0 ? o : null;
    } catch { return null; }
  }, [alg]);

  const trajectory = useMemo(() => {
    if (!period || period > 200) return [];
    const arr: number[] = [];
    let s = identity();
    const step = (() => {
      try { return applyAlg(identity(), alg); } catch { return identity(); }
    })();
    for (let n = 1; n <= period; n++) {
      s = composeS(s, step);
      // diff count = number of mismatched positions/orientations
      let d = 0;
      for (let i = 0; i < 8; i++) { if (s.cp[i] !== i) d++; if (s.co[i] !== 0) d++; }
      for (let i = 0; i < 12; i++) { if (s.ep[i] !== i) d++; if (s.eo[i] !== 0) d++; }
      arr.push(d);
    }
    return arr;
  }, [alg, period]);

  const stop = useCallback(() => {
    if (animRef.current) { clearTimeout(animRef.current); animRef.current = null; }
    setIter(0);
  }, []);

  const animate = useCallback(() => {
    if (!playerRef.current || !period) return;
    stop();
    let n = 0;
    const tick = async () => {
      if (!playerRef.current) return;
      try {
        // Append the alg to the current player. Re-build alg as alg repeated.
        n++;
        setIter(n);
        if (n >= period) {
          stop();
          return;
        }
        animRef.current = window.setTimeout(tick, 800);
      } catch { stop(); }
    };
    tick();
  }, [period, stop]);

  useEffect(() => () => stop(), [stop]);

  // Re-compute alg-times-iter for displayed alg.
  const playAlg = useMemo(() => {
    if (!iter) return alg;
    return Array.from({ length: iter }, () => alg).join(' ');
  }, [alg, iter]);

  const max = trajectory.length ? Math.max(...trajectory) : 1;
  const showOver = period && period > 60;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 元素阶', en: 'Interactive § Order of an element'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '一个公式重复多少次能回到起点?这就是它的「阶」。点几个常见例子看看。', en: 'Repeat a sequence until it returns to identity. The smallest such count is its order.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => { setAlg(e.target.value); stop(); }} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {[
          ['R', '4'], ['R U', '105'], ["R U R' U'", '6'],
          ["R U R' U R U2 R'", '6'],
          ["F R U' R' U' R U R' F'", '24'],
          ["R U2 R' U' R U' R'", '8'],
          ['R L', '4'],
          ["F R B' L F'", '63'],
        ].map(([s, n]) => (
          <span key={s} className="gt-chip" onClick={() => { setAlg(s); stop(); }}>
            {s} <span style={{ opacity: .5 }}>· {n}</span>
          </span>
        ))}
      </div>

      <div className="gt-twisty-inline" style={{ maxWidth: 280, margin: '20px auto' }}>
        <TwistyMini key={playAlg} alg={playAlg} onPlayerReady={p => { playerRef.current = p; }} />
      </div>

      <div className="gt-panel-input-row">
        <button className="gt-btn" onClick={animate} disabled={!period || period > 60}>
          {tr({ zh: '播放轨道', en: 'play orbit'
        })}
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={stop}>
          {tr({ zh: '停', en: 'stop' })}
        </button>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', marginLeft: 'auto' }}>
          {iter > 0 ? `${iter} / ${period}` : ''}
        </span>
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '阶 (返回单位元所需重复数)', en: 'order (period)'
        })}</div>
          <div className="gt-result-val-strong">{period === null ? '—' : period}</div>
        </div>
        {showOver && (
          <div className="gt-aside" style={{ marginTop: 12 }}>
            {tr({ zh: '阶 > 60,动画不再播放;轨道太长,光看图就够。', en: 'Order > 60 — orbit too long to animate, but the chart shows the full trajectory.'
            })}
          </div>
        )}
      </div>

      {trajectory.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 4 }}>
            {tr({ zh: '与单位元的距离 (错位件数), 每次幂', en: 'distance from identity (mismatched positions), per power'
            })}
          </div>
          <div className="gt-period-chart">
            {trajectory.map((d, i) => (
              <div
                key={i}
                className={`gt-period-bar ${d === 0 ? 'gt-period-bar-solved' : ''}`}
                style={{ height: `${Math.max(2, (d / max) * 100)}%` }}
                title={`${i + 1}: ${d} pieces off`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Small helper duplicating composeStates from cube_state.ts (kept private to
// avoid widening cube_state's API surface).
function composeS(a: CubieState, b: CubieState): CubieState {
  const cp = new Array(8), co = new Array(8);
  for (let i = 0; i < 8; i++) { cp[i] = a.cp[b.cp[i]]; co[i] = (a.co[b.cp[i]] + b.co[i]) % 3; }
  const ep = new Array(12), eo = new Array(12);
  for (let i = 0; i < 12; i++) { ep[i] = a.ep[b.ep[i]]; eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2; }
  return { cp, co, ep, eo };
}

// ── §8 ConjugateViewer ─────────────────────────────────────────────────────
function ConjugateViewer() {
  const [a, setA] = useState('U');
  const [b, setB] = useState('R E R');
  // For visualization clarity, we let user choose. Show the full alg A B A'.
  const full = useMemo(() => conjugate(a, b), [a, b]);
  const validA = useMemo(() => safeTok(a), [a]);
  const validB = useMemo(() => safeTok(b), [b]);
  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 共轭 A B A⁻¹', en: 'Interactive § Conjugate A B A⁻¹'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '共轭 = 把 B 这个操作「搬到另一个位置去做」。先用 A 把目标移过来,执行 B,再 A 撤回。', en: 'A conjugate moves operation B "to another location": A sets up, B acts, A⁻¹ undoes the setup.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>A (setup)</label>
        <input className="gt-input" value={a} onChange={e => setA(e.target.value)} />
      </div>
      <div className="gt-panel-input-row">
        <label>B (insert)</label>
        <input className="gt-input" value={b} onChange={e => setB(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {[
          ["U", "F2"],          // moves F2 to U layer
          ["R'", "U2"],
          ["U'", "R U R' U'"],
        ].map(([ax, bx], i) => (
          <span key={i} className="gt-chip" onClick={() => { setA(ax); setB(bx); }}>
            {ax} {bx} ({ax})⁻¹
          </span>
        ))}
      </div>

      <div className="gt-twisty-inline" style={{ maxWidth: 280, margin: '24px auto 12px' }}>
        <TwistyMini key={full} alg={validA && validB ? full : ''} />
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <div className="gt-result-label">A</div>
          <div className="gt-result-val">{a}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">A⁻¹</div>
          <div className="gt-result-val">{tryInvert(a)}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">A B A⁻¹</div>
          <div className="gt-result-val-strong">{full}</div>
        </div>
      </div>
    </div>
  );
}

function safeTok(s: string): boolean {
  try { tokenize(s); return true; } catch { return false; }
}
function tryInvert(s: string): string {
  try { return invertAlg(s) || '(empty)'; } catch { return '(invalid)'; }
}

// ── §9 CommutatorViewer ────────────────────────────────────────────────────
function CommutatorViewer() {
  const lang = useLang();
  const [a, setA] = useState("R U R'");
  const [b, setB] = useState("D");
  const full = useMemo(() => commutator(a, b), [a, b]);

  const stateResult = useMemo(() => {
    try {
      const s = applyAlg(identity(), full);
      return {
        solved: isSolved(s),
        cornerCycles: cycleStructure(s.cp),
        edgeCycles: cycleStructure(s.ep),
        coTouched: s.co.filter(v => v !== 0).length,
        eoTouched: s.eo.filter(v => v !== 0).length,
      };
    } catch { return null; }
  }, [full]);

  const presets: { a: string; b: string; name: string; zh: string; en: string
 }[] = [
    { a: "R U R'", b: "D",            name: "edge 3-cycle",     zh: '棱块 3-循环', en: 'edge 3-cycle'
    },
    { a: "[R, U]", b: "[U, R]",       name: "wrong (nested)",   zh: '嵌套例', en: 'nested example'
    },
    { a: "U R U'", b: "L'",          name: "corner 3-cycle",   zh: '角块 3-循环', en: 'corner 3-cycle'
    },
    { a: "R",     b: "U",            name: "the sexy",         zh: '小鱼起手', en: 'sexy'
    },
    { a: "M",     b: "U",            name: "M-slice cycle",    zh: 'M 切片循环', en: 'M-slice cycle'
    },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 换位子 [A, B] = A B A⁻¹ B⁻¹', en: 'Interactive § Commutator [A, B] = A B A⁻¹ B⁻¹'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '换位子是高级解法的灵魂。它衡量「A 和 B 互不交换的程度」—— 如果它们交换,[A, B] = e。', en: 'The commutator measures how far A and B fail to commute. If they commute, [A, B] = e.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>A</label>
        <input className="gt-input" value={a} onChange={e => setA(e.target.value)} />
      </div>
      <div className="gt-panel-input-row">
        <label>B</label>
        <input className="gt-input" value={b} onChange={e => setB(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {presets.filter(p => !p.a.includes('[')).map((p, i) => (
          <span key={i} className="gt-chip" onClick={() => { setA(p.a); setB(p.b); }}>
            [{p.a}, {p.b}]
          </span>
        ))}
      </div>

      <div className="gt-twisty-inline" style={{ maxWidth: 280, margin: '24px auto 12px' }}>
        <TwistyMini key={full} alg={full} />
      </div>

      {stateResult && (
        <div className="gt-panel-result">
          <div className="gt-result-row">
            <div className="gt-result-label">{tr({ zh: '完整公式', en: 'expanded' })}</div>
            <div className="gt-result-val-strong">{full}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label">{tr({ zh: '是否单位元', en: 'identity?'
            })}</div>
            <div className="gt-result-val">{stateResult.solved ? tr({ zh: '是 (A, B 互换)', en: 'yes (A and B commute)'
                                  }) : tr({ zh: '否', en: 'no' })}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label">{tr({ zh: '角块循环型', en: 'corner cycles'
            })}</div>
            <div className="gt-result-val">{formatCycle(stateResult.cornerCycles, lang)}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label">{tr({ zh: '棱块循环型', en: 'edge cycles'
            })}</div>
            <div className="gt-result-val">{formatCycle(stateResult.edgeCycles, lang)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── §9.3 CentreVerifier — does this alg commute with all 6 face turns? ────
function CentreVerifier() {
  const lang = useLang();
  const [alg, setAlg] = useState("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");

  const faces: FaceLetterChar[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  const result = useMemo(() => {
    try {
      const checks = faces.map(f => {
        // g X g' X' — if identity, then g and X commute.
        const state = applyAlg(identity(), commutator(alg, f));
        return { face: f, commutes: isSolved(state) };
      });
      const all = checks.every(c => c.commutes);
      return { checks, inCentre: all };
    } catch { return null; }
  }, [alg]);

  const presets: { label: string; alg: string }[] = [
    { label: 'e (identity)', alg: '' },
    { label: 'superflip', alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
    { label: 'R', alg: 'R' },
    { label: 'R U R\' U\'', alg: "R U R' U'" },
    { label: 'U2 D2', alg: 'U2 D2' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 中心验证 — g 是否跟所有面转交换?', en: 'Interactive § Centre check — does g commute with every face turn?'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '逐个验证 [g, X] = e 对 6 个生成元成立 ⇔ g ∈ Z(G)。理论已证 Z(G) = {e, superflip} 阶 2。', en: 'For each face turn X, check [g, X] = e. If all six pass, then g ∈ Z(G). Theory says Z(G) = {e, superflip} of order 2.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>g</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <span key={p.label} className="gt-chip" onClick={() => setAlg(p.alg)}>{p.label}</span>
        ))}
      </div>
      <div className="gt-centre-grid">
        {result?.checks.map(({ face, commutes }) => (
          <div key={face} className={`gt-centre-cell ${commutes ? 'gt-centre-ok' : 'gt-centre-bad'}`}>
            <div className="gt-centre-face">{face}</div>
            <div className="gt-centre-status">{commutes ? '✓' : '✗'}</div>
            <div className="gt-centre-detail">[g, {face}] {commutes ? '= e' : '≠ e'}</div>
          </div>
        ))}
      </div>
      <div className={`gt-inv-final ${result?.inCentre ? '' : 'gt-inv-final-bad'}`}>
        {result?.inCentre
          ? tr({ zh: '✓ g ∈ Z(G) — 跟全部 6 个面转都交换', en: '✓ g ∈ Z(G) — commutes with every face turn'
                          })
          : (lang === 'zh' ? '✗ g ∉ Z(G)' : '✗ g ∉ Z(G)')}
      </div>
    </div>
  );
}
type FaceLetterChar = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

// ── §8.2 ConjugacyClassTable — cycle types of common algs ──────────────────
function ConjugacyClassTable() {
  const lang = useLang();
  const samples: { alg: string; nameZh: string; nameEn: string
 }[] = [
    { alg: 'R',                                       nameZh: '单面转',          nameEn: 'single face turn'
    },
    { alg: "R U R' U'",                                nameZh: '小鱼起手 (sexy)',    nameEn: 'sexy move'
    },
    { alg: 'R L',                                      nameZh: '对面同时转',       nameEn: 'opposite-face pair'
    },
    { alg: "R U R' U R U2 R'",                         nameZh: '小鱼 (Sune)',     nameEn: 'Sune'
    },
    { alg: "F R U' R' U' R U R' F'",                   nameZh: 'OLL 26',            nameEn: 'OLL 26' },
    { alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2", nameZh: 'superflip', nameEn: 'superflip' },
    { alg: 'U2 D2 F2 B2 L2 R2',                        nameZh: '棋盘 checker',      nameEn: 'checkerboard'
    },
    { alg: "R U2 R' U' R U' R'",                       nameZh: '反 Sune',           nameEn: 'anti-Sune' },
  ];
  const rows = useMemo(() => samples.map(s => {
    try {
      const state = applyAlg(identity(), s.alg);
      return {
        ...s,
        cornerCycle: cycleStructure(state.cp),
        edgeCycle: cycleStructure(state.ep),
        order: orderOf(s.alg),
        sign: permSign(state.cp),
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as Array<typeof samples[number] & { cornerCycle: number[]; edgeCycle: number[]; order: number; sign: 1 | -1 }>, []);
  return (
    <table className="gt-compare">
      <thead>
        <tr>
          <th>{tr({ zh: '公式', en: 'Alg' })}</th>
          <th>{tr({ zh: '角块循环型', en: 'Corner cycle type'
        })}</th>
          <th>{tr({ zh: '棱块循环型', en: 'Edge cycle type'
        })}</th>
          <th>{tr({ zh: '阶', en: 'Order'
        })}</th>
          <th>{tr({ zh: '奇偶', en: 'sgn' })}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{lang === 'zh' ? r.nameZh : r.nameEn}</div>
              <div className="gt-mono" style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{r.alg || '(empty)'}</div>
            </td>
            <td className="num">{formatCycle(r.cornerCycle, lang)}</td>
            <td className="num">{formatCycle(r.edgeCycle, lang)}</td>
            <td className="num">{r.order}</td>
            <td className="num" style={{ color: r.sign === 1 ? 'var(--green)' : 'var(--accent)' }}>
              {r.sign === 1 ? '+1' : '−1'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── §17 HomomorphismPanel — parity sgn: G → ℤ/2 ────────────────────────────
function HomomorphismPanel() {
  const [g, setG] = useState("R U R' U'");
  const [h, setH] = useState("F R U' R' F'");
  const result = useMemo(() => {
    try {
      const sG = applyAlg(identity(), g);
      const sH = applyAlg(identity(), h);
      const sGH = applyAlg(identity(), `${g} ${h}`);
      const signG = permSign(sG.cp);
      const signH = permSign(sH.cp);
      const signGH = permSign(sGH.cp);
      const homOk = (signG * signH) === signGH;
      return { signG, signH, signGH, homOk };
    } catch { return null; }
  }, [g, h]);

  const presets: { gv: string; hv: string; label: string }[] = [
    { gv: 'R', hv: 'U', label: 'R · U' },
    { gv: "R U R' U'", hv: 'F R U R\' U\' F\'', label: 'two even algs' },
    { gv: 'R', hv: 'R', label: 'R · R = R²' },
    { gv: "R U R' U R U2 R'", hv: "F R U' R' U' R U R' F'", label: 'Sune · OLL26' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 同态性质 sgn(g·h) = sgn(g) · sgn(h)', en: 'Interactive § Homomorphism check sgn(g·h) = sgn(g) · sgn(h)'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: 'sgn 把 G 映到 ℤ/2 = {±1}。要验证它是同态:对任意 g, h ∈ G,应有 sgn(g·h) = sgn(g) · sgn(h)。', en: 'sgn maps G → ℤ/2 = {±1}. To check it is a homomorphism: for any g, h ∈ G, we need sgn(g·h) = sgn(g) · sgn(h).'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>g</label>
        <input className="gt-input" value={g} onChange={e => setG(e.target.value)} />
      </div>
      <div className="gt-panel-input-row">
        <label>h</label>
        <input className="gt-input" value={h} onChange={e => setH(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <span key={p.label} className="gt-chip" onClick={() => { setG(p.gv); setH(p.hv); }}>{p.label}</span>
        ))}
      </div>
      {result && (
        <div className="gt-hom-grid">
          <div className="gt-hom-cell">
            <div className="gt-hom-label">sgn(g)</div>
            <div className={`gt-hom-val ${result.signG === 1 ? 'gt-hom-pos' : 'gt-hom-neg'}`}>{result.signG === 1 ? '+1' : '−1'}</div>
          </div>
          <div className="gt-hom-op">×</div>
          <div className="gt-hom-cell">
            <div className="gt-hom-label">sgn(h)</div>
            <div className={`gt-hom-val ${result.signH === 1 ? 'gt-hom-pos' : 'gt-hom-neg'}`}>{result.signH === 1 ? '+1' : '−1'}</div>
          </div>
          <div className="gt-hom-op">=</div>
          <div className="gt-hom-cell">
            <div className="gt-hom-label">sgn(g·h)</div>
            <div className={`gt-hom-val ${result.signGH === 1 ? 'gt-hom-pos' : 'gt-hom-neg'}`}>{result.signGH === 1 ? '+1' : '−1'}</div>
          </div>
        </div>
      )}
      <div className={`gt-inv-final ${result?.homOk ? '' : 'gt-inv-final-bad'}`}>
        {result?.homOk
          ? tr({ zh: '✓ 同态性质成立', en: '✓ homomorphism property holds'
                          })
          : tr({ zh: '✗ 同态性质失败 (不可能发生 — 这是定理)', en: '✗ homomorphism property fails (impossible — this is a theorem)'
                          })}
      </div>
    </div>
  );
}

// ── §18 BurnsideMiniTable — counting orbits under cube symmetries ─────────
function BurnsideMiniTable() {
  const lang = useLang();
  // For each of 6 face-equivalence operations, give a rough "fixed-states" estimate.
  // Numbers are illustrative orders-of-magnitude; the precise figures come from
  // Burnside applied to G under the 48-element outer symmetry group.
  const rows: { sym: string; symEn: string; symZh: string; fixed: string; comment: string; commentZh: string
 }[] = [
    { sym: 'identity (e)',         symEn: 'identity',           symZh: '恒等',
      fixed: '4.3 × 10¹⁹',          comment: 'all of G fixed',                commentZh: '所有状态都被恒等固定'
    },
    { sym: '90° rotation × 6',     symEn: 'face 90° rotation',   symZh: '面 90° 旋转',
      fixed: '~1.4 × 10⁹ each',     comment: 'states with that 4-fold symmetry', commentZh: '具有该 4 重对称的状态'
    },
    { sym: '180° rotation × 9',    symEn: 'face/edge 180° rotation', symZh: '面/棱 180° 旋转',
      fixed: '~10¹⁰ each',          comment: 'states with that 2-fold symmetry', commentZh: '具有该 2 重对称的状态'
    },
    { sym: '120° rotation × 8',    symEn: 'corner 120° rotation', symZh: '角块 120° 旋转',
      fixed: '~10⁶ each',           comment: 'states with that 3-fold symmetry', commentZh: '具有该 3 重对称的状态'
    },
    { sym: 'mirror × 24',          symEn: 'mirror reflection',   symZh: '镜面反射',
      fixed: '~10⁹ each',           comment: 'mirror-symmetric states',          commentZh: '镜像对称状态'
    },
  ];
  return (
    <table className="gt-compare">
      <thead>
        <tr>
          <th>{tr({ zh: '对称变换', en: 'Symmetry'
        })}</th>
          <th>{tr({ zh: '不动点 (Fix g)', en: 'Fixed states (Fix g)'
        })}</th>
          <th>{tr({ zh: '说明', en: 'Meaning'
        })}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{lang === 'zh' ? r.symZh : r.symEn}</td>
            <td className="num">{r.fixed}</td>
            <td style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{lang === 'zh' ? r.commentZh : r.comment}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── §18 SymmetryPicker — pick one of 48 outer cube symmetries ─────────────
// Each entry below corresponds to one conjugacy class of the 48-element
// outer cube symmetry group D = O_h. Sizes / fixed-state counts from standard
// references (Wikipedia "Rubik's cube group" + Joyner's textbook). The numbers
// are exact for E, 3C2 (face 180°) and 6C2' (edge 180°); approximate otherwise.
type SymClass = {
  name: string;
  nameZh: string;
  count: number;       // how many group elements in this conjugacy class
  order: number;       // order of each element
  axis: string;
  axisZh: string;
  fixDesc: string;
  fixDescZh: string;
  fixCount: string;
  type: 'identity' | 'C4' | 'C2-face' | 'C3' | 'C2-edge' | 'mirror' | 'rotoreflect';
};
const SYM_CLASSES: SymClass[] = [
  {
    name: 'E (identity)', nameZh: 'E 单位元', count: 1, order: 1,
    axis: '—', axisZh: '—',
    fixDesc: 'fixes every state', fixDescZh: '固定所有状态',
    fixCount: '4.3 × 10¹⁹', type: 'identity',
  },
  {
    name: '6 C4 (face 90°)', nameZh: '6 个 C₄ 面 90°', count: 6, order: 4,
    axis: '3 face axes × 2 directions', axisZh: '3 面轴 × 2 方向',
    fixDesc: 'states with 4-fold face rotation symmetry — rare',
    fixDescZh: '具 4 重面对称的状态 — 罕见',
    fixCount: '~10⁹', type: 'C4',
  },
  {
    name: '3 C2 (face 180°)', nameZh: '3 个 C₂ 面 180°', count: 3, order: 2,
    axis: '3 face axes', axisZh: '3 面轴',
    fixDesc: 'states symmetric under U2 (etc) rotation of axis',
    fixDescZh: '在 U2 (等) 整体旋转下不变的状态',
    fixCount: '~10¹⁰', type: 'C2-face',
  },
  {
    name: '8 C3 (vertex 120°)', nameZh: '8 个 C₃ 顶点 120°', count: 8, order: 3,
    axis: '4 vertex axes × 2 directions', axisZh: '4 顶点轴 × 2 方向',
    fixDesc: 'states with 3-fold body-diagonal symmetry',
    fixDescZh: '具 3 重体对角线对称的状态',
    fixCount: '~10⁶', type: 'C3',
  },
  {
    name: '6 C2 (edge 180°)', nameZh: '6 个 C₂ 棱 180°', count: 6, order: 2,
    axis: '6 edge-pair axes', axisZh: '6 对棱轴',
    fixDesc: 'states symmetric under face-diagonal rotation',
    fixDescZh: '在面对角线旋转下不变的状态',
    fixCount: '~10⁸', type: 'C2-edge',
  },
  {
    name: 'i (central inversion)', nameZh: 'i 中心反演', count: 1, order: 2,
    axis: 'cube centre', axisZh: '魔方中心',
    fixDesc: 'point-symmetric states (e.g. superflip)',
    fixDescZh: '点对称状态 (例如 superflip)',
    fixCount: '~10⁶', type: 'rotoreflect',
  },
  {
    name: '6 σh (face mirror)', nameZh: '6 个 σₕ 面镜面', count: 6, order: 2,
    axis: '3 face mirror planes × 2', axisZh: '3 个面镜面 × 2',
    fixDesc: 'cube states identical to their face-mirror image',
    fixDescZh: '在面镜面下不变的状态',
    fixCount: '~10⁹', type: 'mirror',
  },
  {
    name: '6 σd (edge mirror)', nameZh: '6 个 σ_d 棱镜面', count: 6, order: 2,
    axis: '6 edge-diagonal mirrors', axisZh: '6 个面对角线镜面',
    fixDesc: 'states symmetric under diagonal mirror',
    fixDescZh: '在对角镜面下不变的状态',
    fixCount: '~10⁸', type: 'mirror',
  },
  {
    name: '8 S6 (improper 60°)', nameZh: '8 个 S₆ 旋转-反射', count: 8, order: 6,
    axis: '4 vertex axes × 2 (rotation + reflection)', axisZh: '4 顶点轴 × 2 (旋转 + 反射)',
    fixDesc: 'rare combined-symmetry states',
    fixDescZh: '罕见的组合对称状态',
    fixCount: '~10⁵', type: 'rotoreflect',
  },
  {
    name: '6 S4 (improper 90°)', nameZh: '6 个 S₄ 旋转-反射', count: 6, order: 4,
    axis: '3 face axes × 2', axisZh: '3 面轴 × 2',
    fixDesc: 'very rare states',
    fixDescZh: '极罕见状态',
    fixCount: '~10⁵', type: 'rotoreflect',
  },
];

function SymmetryPicker() {
  const lang = useLang();
  const [selected, setSelected] = useState(0);
  const sym = SYM_CLASSES[selected];
  const totalElems = SYM_CLASSES.reduce((a, b) => a + b.count, 0);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 选一个外部对称变换', en: 'Interactive § Pick an outer cube symmetry'
    })}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? `魔方有 ${totalElems} = 48 个外部对称 (O_h 群),分成 10 个共轭类。点任意一类看它的轴、阶、不动状态数。`
          : `The cube has ${totalElems} = 48 outer symmetries (group O_h), in 10 conjugacy classes. Click any class to see its axis, order, and approximate fix count.`}
      </p>
      <div className="gt-burnside-picker">
        {SYM_CLASSES.map((s, i) => (
          <div
            key={i}
            className={`gt-burnside-sym ${i === selected ? 'active' : ''}`}
            onClick={() => setSelected(i)}
          >
            <div className="gt-burnside-sym-name">{lang === 'zh' ? s.nameZh : s.name}</div>
            <div className="gt-burnside-sym-desc">{lang === 'zh' ? s.axisZh : s.axis}</div>
          </div>
        ))}
      </div>
      <div className="gt-panel-result" style={{ marginTop: 20 }}>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '类', en: 'class'
        })}</div>
          <div className="gt-result-val-strong">{lang === 'zh' ? sym.nameZh : sym.name}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '元素个数', en: 'elements'
        })}</div>
          <div className="gt-result-val">{sym.count}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '阶', en: 'order'
        })}</div>
          <div className="gt-result-val">{sym.order}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '不动点 |Fix(σ)|', en: '|Fix(σ)|'
        })}</div>
          <div className="gt-result-val-strong">{sym.fixCount}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '不动状态', en: 'fixed states'
        })}</div>
          <div className="gt-result-val" style={{ fontSize: 13 }}>{lang === 'zh' ? sym.fixDescZh : sym.fixDesc}</div>
        </div>
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {lang === 'zh'
          ? <>合计: 10 个类共 48 个元素, Σ|Fix(σ)| ≈ 4.3 × 10¹⁹ (主要来自单位元) 。 # orbits = Σ|Fix(σ)| / 48 ≈ 9.01 × 10¹⁷。</>
          : <>Sum: 10 classes, 48 elements, Σ|Fix(σ)| ≈ 4.3 × 10¹⁹ (dominated by identity). # orbits = Σ|Fix(σ)| / 48 ≈ 9.01 × 10¹⁷.</>}
      </div>
    </div>
  );
}

// ── §18 OrbitExplorer — pick a cubie type, see orbit + stabilizer ─────────
function OrbitExplorer() {
  const lang = useLang();
  type CubieType = 'corner' | 'edge' | 'center';
  const [type, setType] = useState<CubieType>('corner');
  const G_SIZE = 43_252_003_274_489_856_000n;
  const orbitSize = { corner: 8n, edge: 12n, center: 1n }[type];
  const stabSize = G_SIZE / orbitSize;
  const sampleCubie = { corner: 'URF', edge: 'UF', center: 'U' }[type];
  const orbitDesc = {
    corner: tr({ zh: '所有 8 个角块位置 (角块块在 G 作用下能到的位置)', en: 'all 8 corner positions (where any corner cubie can land under G)'
    }),
    edge:   tr({ zh: '所有 12 个棱块位置 (棱块块在 G 作用下能到的位置)', en: 'all 12 edge positions (where any edge cubie can land under G)'
    }),
    center: tr({ zh: '只有 1 个位置 — 中心块不动 (它本身定义朝向)', en: 'just 1 position — centres are fixed by definition'
    }),
  }[type];
  const stabDesc = {
    corner: tr({ zh: '不改变 URF 位置和朝向的所有操作 = G 的指数 8 · 3 = 24 子群', en: 'all operations fixing URF including orientation = subgroup of index 8 · 3 = 24'
    }),
    edge:   tr({ zh: '不改变 UF 位置和朝向的所有操作 = G 的指数 12 · 2 = 24 子群', en: 'all operations fixing UF including orientation = subgroup of index 12 · 2 = 24'
    }),
    center: tr({ zh: '全部 G (中心块不动)', en: 'all of G (centre is always fixed)'
    }),
  }[type];
  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 轨道-稳定子', en: 'Interactive § Orbit-stabilizer'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '选一个 cubie 类型, 看它在 G 下的轨道大小 (|G·x|) 和稳定子大小 (|Stab(x)|) 。 它们的乘积永远 = |G|。', en: 'Pick a cubie type and see its orbit size |G·x| and stabilizer size |Stab(x)|. Their product is always |G|.'
        })}
      </p>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {(['corner', 'edge', 'center'] as CubieType[]).map(t => (
          <span key={t} className={`gt-chip ${t === type ? 'gt-chip-active' : ''}`} onClick={() => setType(t)}>
            {lang === 'zh' ? { corner: '角块', edge: '棱块', center: '中心' }[t] : t}
          </span>
        ))}
      </div>
      <div className="gt-orbit-explorer">
        <div>
          <h4>{tr({ zh: '轨道 G·x', en: 'Orbit G·x'
        })}</h4>
          <p>x = <span className="gt-orbit-val">{sampleCubie}</span></p>
          <p>|G·x| = <span className="gt-orbit-val">{orbitSize.toString()}</span></p>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>{orbitDesc}</p>
        </div>
        <div>
          <h4>{tr({ zh: '稳定子 Stab(x)', en: 'Stabilizer Stab(x)'
        })}</h4>
          <p>|Stab(x)| = <span className="gt-orbit-val" style={{ fontSize: 11 }}>{stabSize.toLocaleString()}</span></p>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>{stabDesc}</p>
        </div>
      </div>
      <div className="gt-math-display" style={{ fontSize: '1em', marginTop: 16 }}>
        |G·x| × |Stab(x)| &nbsp;=&nbsp; {orbitSize.toString()} &nbsp;×&nbsp; {stabSize.toLocaleString()} &nbsp;=&nbsp; |G| ✓
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {tr({ zh: '这就是轨道-稳定子定理。 每个 cubie 的 「能去哪里」 和 「让它不动需要多少操作」 是反比关系。', en: 'This is the orbit-stabilizer theorem: a cubie\'s "where it can go" and "how many operations leave it fixed" are inversely related.'
        })}
      </div>
    </div>
  );
}

// ── §18 CubeSymmetryAxes — SVG of the 48-element O_h symmetry group ──────
function CubeSymmetryAxes() {
  const lang = useLang();
  const [highlight, setHighlight] = useState<'C4' | 'C3' | 'C2' | null>(null);
  // Cube vertices in 3D (centred at origin). Project to 2D with simple iso.
  const V: [number, number, number][] = [
    [-1, -1, -1], [ 1, -1, -1], [ 1,  1, -1], [-1,  1, -1],
    [-1, -1,  1], [ 1, -1,  1], [ 1,  1,  1], [-1,  1,  1],
  ];
  // Isometric projection
  const project = (p: [number, number, number]): [number, number] => {
    const [x, y, z] = p;
    return [200 + 60 * (x - z), 180 - 60 * y + 30 * (x + z)];
  };
  const proj = V.map(project);
  const edges: [number, number][] = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];
  // Face-axis lines (C4): connect centres of opposite faces
  const C4_AXES: { a: [number, number, number]; b: [number, number, number] }[] = [
    { a: [0, -1.5, 0], b: [0, 1.5, 0] },   // U-D
    { a: [-1.5, 0, 0], b: [1.5, 0, 0] },   // L-R
    { a: [0, 0, -1.5], b: [0, 0, 1.5] },   // F-B
  ];
  // Vertex-axis lines (C3): connect opposite vertices (body diagonals)
  const C3_AXES: { a: [number, number, number]; b: [number, number, number] }[] = [
    { a: [-1.4, -1.4, -1.4], b: [1.4, 1.4, 1.4] },
    { a: [-1.4, -1.4, 1.4],  b: [1.4, 1.4, -1.4] },
    { a: [-1.4, 1.4, -1.4],  b: [1.4, -1.4, 1.4] },
    { a: [1.4, -1.4, -1.4],  b: [-1.4, 1.4, 1.4] },
  ];
  // Edge-axis lines (C2): connect centres of opposite edges
  const C2_AXES: { a: [number, number, number]; b: [number, number, number] }[] = [
    { a: [0, -1.4, -1.4], b: [0, 1.4, 1.4] },
    { a: [0, -1.4, 1.4],  b: [0, 1.4, -1.4] },
    { a: [-1.4, 0, -1.4], b: [1.4, 0, 1.4] },
    { a: [-1.4, 0, 1.4],  b: [1.4, 0, -1.4] },
    { a: [-1.4, -1.4, 0], b: [1.4, 1.4, 0] },
    { a: [-1.4, 1.4, 0],  b: [1.4, -1.4, 0] },
  ];
  const drawAxis = (a: [number,number,number], b: [number,number,number], cls: string) => {
    const [ax, ay] = project(a); const [bx, by] = project(b);
    return <line x1={ax} y1={ay} x2={bx} y2={by} className={`gt-symgroup-axis ${cls}`} />;
  };
  const counts = { C4: '3 axes · 6 rotations + 3 σ_h mirrors', C3: '4 axes · 8 rotations + 8 S6', C2: '6 axes · 6 rotations + 6 σ_d mirrors' };
  const countsZh = { C4: '3 轴 · 6 旋转 + 3 σ_h 镜面', C3: '4 轴 · 8 旋转 + 8 S6 反演', C2: '6 轴 · 6 旋转 + 6 σ_d 镜面' };
  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '可视 § 立方体对称轴', en: 'Visual § Cube symmetry axes'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '将鼠标悬在轴上(或点击下方按钮)显示对应的对称类。 红 = 面轴 (C₄, 4 重) , 蓝 = 体对角线 (C₃, 3 重) , 金 = 面对角线 (C₂, 2 重) 。', en: 'Hover an axis (or click below) to highlight a symmetry class. Red = face axes (C₄, 4-fold), blue = body diagonals (C₃, 3-fold), gold = edge axes (C₂, 2-fold).'
        })}
      </p>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {(['C4', 'C3', 'C2'] as const).map(c => (
          <span key={c} className={`gt-chip ${c === highlight ? 'gt-chip-active' : ''}`} onClick={() => setHighlight(h => h === c ? null : c)}>
            {c} ({c === 'C4' ? '6' : c === 'C3' ? '8' : '6'})
          </span>
        ))}
      </div>
      <svg viewBox="0 0 400 360" className="gt-symgroup-svg" preserveAspectRatio="xMidYMid meet" width="100%">
        {/* Cube edges */}
        {edges.map(([a, b], i) => {
          const [x1, y1] = proj[a]; const [x2, y2] = proj[b];
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="gt-symgroup-cube-edge" />;
        })}
        {/* Vertices */}
        {proj.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} className="gt-symgroup-vertex" />)}
        {/* Axes */}
        {C4_AXES.map((ax, i) => <g key={`c4-${i}`} onMouseEnter={() => setHighlight('C4')} onMouseLeave={() => setHighlight(null)}>{drawAxis(ax.a, ax.b, `gt-symgroup-axis-c4 ${highlight === 'C4' ? 'active' : ''}`)}</g>)}
        {C3_AXES.map((ax, i) => <g key={`c3-${i}`} onMouseEnter={() => setHighlight('C3')} onMouseLeave={() => setHighlight(null)}>{drawAxis(ax.a, ax.b, `gt-symgroup-axis-c3 ${highlight === 'C3' ? 'active' : ''}`)}</g>)}
        {C2_AXES.map((ax, i) => <g key={`c2-${i}`} onMouseEnter={() => setHighlight('C2')} onMouseLeave={() => setHighlight(null)}>{drawAxis(ax.a, ax.b, `gt-symgroup-axis-c2 ${highlight === 'C2' ? 'active' : ''}`)}</g>)}
      </svg>
      <div className="gt-symgroup-legend">
        <span><span className="gt-symgroup-swatch" style={{ background: 'var(--accent)' }} />C₄ 面轴</span>
        <span><span className="gt-symgroup-swatch" style={{ background: 'var(--accent-2)' }} />C₃ 体对角</span>
        <span><span className="gt-symgroup-swatch" style={{ background: 'var(--gold)' }} />C₂ 棱轴</span>
      </div>
      {highlight && (
        <div className="gt-aside" style={{ marginTop: 12 }}>
          <strong>{highlight}</strong> — {lang === 'zh' ? countsZh[highlight] : counts[highlight]}
        </div>
      )}
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {tr({ zh: '合计: 24 个旋转 (E + 6 C₄ + 3 C₂面 + 8 C₃ + 6 C₂棱) + 24 个反射 (i + 6 σ_h + 6 σ_d + 8 S₆ + 6 S₄) = 48。这就是 O_h, 立方体的全对称群。', en: 'In total: 24 rotations (E + 6 C₄ + 3 C₂-face + 8 C₃ + 6 C₂-edge) + 24 reflections (i + 6 σ_h + 6 σ_d + 8 S₆ + 6 S₄) = 48. This is O_h, the full cube symmetry group.'
        })}
      </div>
    </div>
  );
}

// ── §10 SubgroupClimber (Thistlethwaite) ───────────────────────────────────
function SubgroupClimber() {
  const lang = useLang();
  const [alg, setAlg] = useState("F R U' R' U' R U R' F'");
  const stage = useMemo(() => {
    try { return thistlethwaiteStage(applyAlg(identity(), alg)); } catch { return 0; }
  }, [alg]);

  const stages: { i: 0 | 1 | 2 | 3 | 4; name: string; gens: string }[] = [
    { i: 0, name: 'G₀ = G', gens: '⟨U,D,L,R,F,B⟩' },
    { i: 1, name: 'G₁',     gens: '⟨U,D,L,R,F2,B2⟩' },
    { i: 2, name: 'G₂',     gens: '⟨U,D,L2,R2,F2,B2⟩' },
    { i: 3, name: 'G₃',     gens: '⟨U2,D2,L2,R2,F2,B2⟩' },
    { i: 4, name: 'G₄ = {e}', gens: '⟨⟩' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § Thistlethwaite 子群链', en: 'Interactive § Thistlethwaite subgroup chain'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '从 G 一路降到 {e},中间穿过四个固定子群。输入打乱,看它「位于哪一阶」。', en: 'Climb from G down to {e} through four fixed subgroups. Input an alg, see what depth its state is "inside".'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {[
          ['', 'identity'],
          ['R2', 'R2'],
          ['U R2', 'U R2'],
          ["R U R'", "R U R'"],
          ["F R U' R' U' R U R' F'", 'OLL 26'],
          ["U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2", 'superflip'],
        ].map(([a, lbl]) => (
          <span key={lbl} className="gt-chip" onClick={() => setAlg(a)}>{lbl}</span>
        ))}
      </div>
      <div className="gt-twisty-inline" style={{ maxWidth: 280, margin: '20px auto' }}>
        <TwistyMini alg={alg} />
      </div>
      <div className="gt-sub-membership">
        {stages.map(s => (
          <div
            key={s.i}
            className={`gt-sub-stage ${s.i >= stage ? 'gt-sub-stage-active' : ''} ${s.i === stage ? 'gt-sub-stage-current' : ''}`}
          >
            <div style={{ fontFamily: 'var(--math)', fontStyle: 'italic', fontSize: 16, marginBottom: 4 }}>{s.name}</div>
            <div style={{ fontSize: 9, lineHeight: 1.4, opacity: .9 }}>{s.gens}</div>
          </div>
        ))}
      </div>
      <div className="gt-aside">
        {lang === 'zh'
          ? `当前状态位于 G${stage}。从这里可以只用 G${stage} 的生成元解开 (或保持)。`
          : `Current state is in G${stage}. From here, the cube can be solved using only G${stage}'s generators.`}
      </div>
    </div>
  );
}

// ── God's number distribution chart  Rokicki et al. 2010 ───────────────────
// HTM (half-turn metric) position counts at each depth. Rokicki, Kociemba,
function UnfoldedCubeMap() {
  // 9-row, 12-col grid; only certain cells are face stickers.
  // Layout:
  //         | U U U |
  //         | U U U |
  //         | U U U |
  // | L L L | F F F | R R R | B B B |
  // | L L L | F F F | R R R | B B B |
  // | L L L | F F F | R R R | B B B |
  //         | D D D |
  //         | D D D |
  //         | D D D |
  const cells: Array<{ row: number; col: number; face: 'U' | 'D' | 'L' | 'R' | 'F' | 'B'; idx: number }> = [];
  // U (rows 1-3, cols 4-6)
  for (let r = 1; r <= 3; r++) for (let c = 4; c <= 6; c++) cells.push({ row: r, col: c, face: 'U', idx: (r - 1) * 3 + (c - 4) });
  // L (rows 4-6, cols 1-3)
  for (let r = 4; r <= 6; r++) for (let c = 1; c <= 3; c++) cells.push({ row: r, col: c, face: 'L', idx: (r - 4) * 3 + (c - 1) });
  // F (rows 4-6, cols 4-6)
  for (let r = 4; r <= 6; r++) for (let c = 4; c <= 6; c++) cells.push({ row: r, col: c, face: 'F', idx: (r - 4) * 3 + (c - 4) });
  // R (rows 4-6, cols 7-9)
  for (let r = 4; r <= 6; r++) for (let c = 7; c <= 9; c++) cells.push({ row: r, col: c, face: 'R', idx: (r - 4) * 3 + (c - 7) });
  // B (rows 4-6, cols 10-12)
  for (let r = 4; r <= 6; r++) for (let c = 10; c <= 12; c++) cells.push({ row: r, col: c, face: 'B', idx: (r - 4) * 3 + (c - 10) });
  // D (rows 7-9, cols 4-6)
  for (let r = 7; r <= 9; r++) for (let c = 4; c <= 6; c++) cells.push({ row: r, col: c, face: 'D', idx: (r - 7) * 3 + (c - 4) });
  return (
    <div className="gt-unfold">
      {Array.from({ length: 9 }, (_, r) => Array.from({ length: 12 }, (_, c) => {
        const cell = cells.find(x => x.row === r + 1 && x.col === c + 1);
        if (!cell) return <div key={`${r}-${c}`} className="gt-unfold-cell gt-unfold-cell-blank" style={{ gridRow: r + 1, gridColumn: c + 1 }} />;
        const label = cell.idx === 4 ? cell.face : '';
        return <div key={`${r}-${c}`} className={`gt-unfold-cell gt-unfold-cell-${cell.face}`} style={{ gridRow: r + 1, gridColumn: c + 1 }}>{label}</div>;
      })).flat()}
    </div>
  );
}

// ── |G| scale comparison (§4) ─────────────────────────────────────────────
function QuotientChart() {
  // [G:G₁] = 2^11 = 2048
  // [G₁:G₂] = 3^7 · (12 choose 4) = 2187 · 495 = 1,082,565
  // [G₂:G₃] = 8C4 · 4! · 4! / 2 = 70 · 24 · 24 / 2 ... actually = 29400 from references
  // [G₃:G₄] = |G₃| = (4!)³ / 2 = 1,824 ... actually 663,552 = 2 · (4!)² · (4!)² / something
  const data: { label: string; size: number; zh: string; en: string
 }[] = [
    { label: '[G : G₁]',  size: 2_048,      zh: '修棱朝向: 12 个棱块每个 0/1 flip,但 Σeo=0',        en: 'orient edges: 12 binary flips constrained by Σeo=0'
    },
    { label: '[G₁: G₂]', size: 1_082_565,  zh: '修角朝向 + 棱归 UD 切片: 3⁷ × (12 choose 4)',         en: 'orient corners + UD slice: 3⁷ × (12 choose 4)'
    },
    { label: '[G₂: G₃]', size: 29_400,     zh: '角棱归各自的 G₃ 轨道',                              en: 'corners and edges into G₃ orbits'
    },
    { label: '[G₃: G₄]', size: 663_552,    zh: '只用半圈还原 — 多米诺群',                          en: 'solve with half-turns only — the "domino" group'
    },
  ];
  const max = Math.log10(Math.max(...data.map(d => d.size)));
  return (
    <div className="gt-quotients">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>
        {tr({ zh: 'Thistlethwaite 链各级商群大小', en: 'sizes of consecutive Thistlethwaite quotients'
        })}
      </div>
      {data.map((d, i) => (
        <div key={i} className="gt-quotient-row">
          <div className="gt-quotient-label">{d.label}</div>
          <div>
            <div className="gt-quotient-track">
              <div className="gt-quotient-fill" style={{ width: `${(Math.log10(d.size) / max) * 100}%` }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>{tr(d)}</div>
          </div>
          <div className="gt-quotient-val">{d.size.toLocaleString()}</div>
        </div>
      ))}
      <div className="gt-aside" style={{ marginTop: 16 }}>
        {tr({ zh: '验证: 2048 × 1,082,565 × 29,400 × 663,552 = 4.3 × 10¹⁹ = |G| ✓', en: 'Sanity check: 2048 × 1,082,565 × 29,400 × 663,552 = 4.3 × 10¹⁹ = |G| ✓'
        })}
      </div>
    </div>
  );
}

// ── Pattern gallery (§13) ─────────────────────────────────────────────────
function PatternGallery() {
  const lang = useLang();
  const patterns: { name: string; nameZh: string; alg: string; order: number; descZh: string; descEn: string
 }[] = [
    { name: 'Superflip',        nameZh: '超翻',     alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
      order: 2, descZh: '12 棱全翻 (cp=e, ep=e, co=0, eo=1)',  descEn: 'all 12 edges flipped'
    },
    { name: 'Checkerboard',     nameZh: '棋盘格', alg: 'U2 D2 F2 B2 L2 R2',
      order: 2, descZh: '6 面 ×3 半圈; |G| 中阶最小', descEn: 'all 6 axes half-turned'
    },
    { name: '4 dots',           nameZh: '四点',     alg: "U R2 L2 U2 R2 L2 U' D R2 L2 D2 R2 L2 D'",
      order: 2, descZh: '4 面中央色块互换', descEn: '4-face centre swap'
    },
    { name: 'Cube in cube',     nameZh: '回字',     alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U",
      order: 4, descZh: '小立方体在大立方体里的视觉错觉',  descEn: 'classic Escher-style visual illusion'
    },
    { name: 'Cross pattern',    nameZh: '十字',     alg: "U F B' L2 U2 L2 F' B U2 L2 U",
      order: 2, descZh: '每面中央一个十字色',  descEn: 'a cross on every face'
    },
    { name: 'Anaconda',         nameZh: '蟒蛇',     alg: "L U B' U' R L' B R' F B' D R D' F'",
      order: 6, descZh: '环绕魔方的彩色带',     descEn: 'a winding band of colour'
    },
    { name: 'Six spots',        nameZh: '六点',     alg: "U D' R L' F B' U D'",
      order: 4, descZh: '中心翻 (U↔D, R↔L, F↔B)', descEn: 'each face centre swapped with opposite' },
    { name: 'Plus minus',       nameZh: '加减号', alg: "U2 R2 L2 U2 R2 L2",
      order: 2, descZh: '简短 6 步即得',         descEn: 'a 6-move classic'
    },
    { name: 'Pons Asinorum (6X)', nameZh: '驴桥定理 (6X)', alg: "R2 L2 F2 B2 U2 D2",
      order: 2, descZh: '所有 6 面 ×3 半圈; 直径距离 20 候选反点', descEn: 'all six faces half-turned; one of three antipode candidates'
    },
    { name: 'Six H-bars',       nameZh: '六 H 条', alg: "U2 B2 R2 D2 U2 R2 F2 U2",
      order: 2, descZh: '三对正交 H 条棱', descEn: 'three orthogonal H-bars on the equators'
    },
    { name: 'Stairs',           nameZh: '阶梯',     alg: "F D2 B R B' L' F D' L2 F2 R F' R' F2 L' F'",
      order: 6, descZh: '颜色顺台阶错位', descEn: 'colours staircase across the cube'
    },
    { name: 'Tetris',           nameZh: '俄罗斯方块', alg: "L R F B U' D' L' R'",
      order: 4, descZh: '8 步生成的中等阶图案', descEn: 'short 8-move medium-order pattern'
    },
    { name: 'Order-1260',       nameZh: '阶 1260',  alg: "R U2 D' B D'",
      order: 1260, descZh: 'Singmaster 经典: 一公式 1260 次才回到原点 = lcm(3,4,5,7)', descEn: "Singmaster's classic: this 5-move alg has order 1260 = lcm(3,4,5,7); repeat 1260× to return"
    },
    { name: '4 spots (90°)',    nameZh: '四点 (90°)', alg: "R F' L' U2 B' D' R B U2 L U F'",
      order: 4, descZh: '4 个中央色块 90° 错位 (≠ 6-spot 的 180°)', descEn: '4 face centres rotated 90° (≠ 6-spot 180°)'
    },
  ];
  return (
    <div className="gt-pattern-gallery">
      {patterns.map((p, i) => (
        <div key={i} className="gt-pattern">
          <div className="gt-pattern-host"><TwistyMini alg={p.alg} /></div>
          <div className="gt-pattern-name">{lang === 'zh' ? p.nameZh : p.name}</div>
          <div className="gt-pattern-meta">
            {lang === 'zh' ? p.descZh : p.descEn}<br />
            <span style={{ color: 'var(--accent)' }}>{tr({ zh: '阶', en: 'order'
            })} {p.order}</span>
          </div>
          <div className="gt-pattern-alg">{p.alg}</div>
        </div>
      ))}
    </div>
  );
}

// ── Conjugation gallery (§8) ──────────────────────────────────────────────
function ConjugationGallery() {
  const lang = useLang();
  const examples: { title: string; titleZh: string; a: string; b: string; desc: string; descZh: string }[] = [
    { title: 'Move U-layer 3-cycle to D-layer', titleZh: '把 U 层 3-循环搬到 D 层',
      a: 'x2', b: "R U R' U R U' R'",
      desc: 'flip whole cube, do A-perm-ish, flip back', descZh: '整体翻转 → 操作 → 翻回' },
    { title: 'Insert F2 from the right',         titleZh: '从右侧插入 F2',
      a: 'R', b: 'F2',
      desc: 'set up, swap edges, undo', descZh: '设置 → 换棱 → 撤销' },
    { title: 'BLD edge cycle setup',              titleZh: '盲拧棱循环 setup',
      a: 'L', b: "R U' R'",
      desc: 'a typical Beginner BLD edge insertion', descZh: '典型的盲拧棱块插入' },
    { title: 'Sledgehammer reposition',           titleZh: '小锤子定位',
      a: 'U', b: "R' F R F'",
      desc: 'shift the sledgehammer one U-turn over', descZh: '把小锤往 U 方向挪一格' },
  ];
  return (
    <div className="gt-conj-gallery">
      {examples.map((ex, i) => {
        const full = conjugate(ex.a, ex.b);
        return (
          <div key={i} className="gt-conj-card">
            <div className="gt-conj-title">{lang === 'zh' ? ex.titleZh : ex.title}</div>
            <div className="gt-conj-row">
              <div className="gt-conj-step">
                <div className="gt-conj-step-label">A</div>
                <div className="gt-conj-step-host"><TwistyMini alg={ex.a} /></div>
              </div>
              <div className="gt-conj-step">
                <div className="gt-conj-step-label">A · B</div>
                <div className="gt-conj-step-host"><TwistyMini alg={`${ex.a} ${ex.b}`} /></div>
              </div>
              <div className="gt-conj-step">
                <div className="gt-conj-step-label">A · B · A⁻¹</div>
                <div className="gt-conj-step-host"><TwistyMini alg={full} /></div>
              </div>
            </div>
            <div className="gt-conj-formula">{full}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', marginTop: 6, textAlign: 'center' }}>
              {lang === 'zh' ? ex.descZh : ex.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Commutator-as-3-cycle gallery (§9) ────────────────────────────────────
function CommutatorAtoms() {
  const lang = useLang();
  const examples: { a: string; b: string; nameZh: string; nameEn: string; descZh: string; descEn: string
 }[] = [
    { a: "R U R'", b: 'D', nameZh: '棱块 3-循环 (UD 面)', nameEn: 'Edge 3-cycle (UD-axis)',
      descZh: '只动 3 个棱块, 其它 17 个件不变', descEn: 'moves 3 edges, fixes the other 17 cubies'
    },
    { a: "R'", b: 'D', nameZh: '角块 3-循环', nameEn: 'Corner 3-cycle',
      descZh: '只动 3 个角块', descEn: 'moves 3 corners only'
    },
    { a: "M'", b: 'U', nameZh: 'M 切片棱循环', nameEn: 'M-slice edge cycle',
      descZh: '切片 + U 的复合 3-循环', descEn: 'slice-then-U commutator'
    },
    { a: "F R F'", b: 'U', nameZh: 'F 槽换棱', nameEn: 'F-slot edge swap',
      descZh: '改 F2L pair 的局部 3-循环', descEn: 'a localized 3-cycle near the F2L slot'
    },
  ];
  return (
    <div className="gt-recipes">
      {examples.map((ex, i) => {
        const expansion = commutator(ex.a, ex.b);
        return (
          <div key={i} className="gt-recipe" style={{ padding: '14px 16px' }}>
            <div className="gt-recipe-title">[{ex.a}, {ex.b}]</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 6 }}>{lang === 'zh' ? ex.nameZh : ex.nameEn}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', marginTop: 4 }}>{expansion}</div>
            <div style={{ marginTop: 10, aspectRatio: 1, maxHeight: 120 }}><TwistyMini alg={expansion} /></div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 8, fontStyle: 'italic' }}>{lang === 'zh' ? ex.descZh : ex.descEn}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Cayley walker — interactive BFS on the cube's Cayley graph (§14) ─────
// User clicks 18 generators (U U' U2 D D' D2 ... B2). Each click extends the
// current path g by one generator. Twisty player shows the state and we display:
//   - path length (= upper bound on graph distance from e)
//   - whether g = e currently (back-home indicator)
//   - distance-1 neighbours and which ones revisit cancellation states
// All state computation stays in cube_state.ts; no external solver.
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
const SMALL_GROUPS_BUILT: Map<string, BuiltGroup> = new Map();
for (const g of SMALL_GROUPS) {
  SMALL_GROUPS_BUILT.set(g.id, buildGroup(g.gens.map(x => x.perm)));
}

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

// ── Other-puzzle comparison table (§15) ───────────────────────────────────
function OrderDistribution() {
  // Known orders that occur in the cube group with at least one element.
  // Source: enumerated from conjugacy classes; the orders that exist are the
  // divisors of 1260, but not ALL divisors — exact attainable set:
  const orders = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 20, 21, 24, 28, 30, 35, 36, 40, 42, 45, 56, 60, 63, 70, 72, 84, 90, 105, 126, 140, 180, 210, 252, 315, 420, 630, 1260];
  return (
    <div>
      <div className="gt-aside" style={{ marginBottom: 12 }}>
        {tr({ zh: '魔方群中实际出现的元素阶（共 73 个不同的阶）。最大为 1260。每个阶都对应一组共轭类。', en: 'Orders actually attained by some cube element (73 distinct values). Maximum is 1260. Each order corresponds to a family of conjugacy classes.'
        })}
      </div>
      <div className="gt-order-table">
        {orders.map(n => (
          <div className="gt-order-cell" key={n}>
            <div className="gt-order-cell-n">{n}</div>
            <div className="gt-order-cell-lbl">{tr({ zh: '阶', en: 'ord'
            })}</div>
          </div>
        ))}
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {tr({ zh: '1260 = 2² · 3² · 5 · 7 是 |G| 的最大整除元素阶。这个特殊数字来自一个 (7-cycle on corners) × (5-cycle on edges) × (9-twist on corner ori) 的精心构造。', en: '1260 = 2² · 3² · 5 · 7 is the maximum element order dividing |G|. Achievable via a (7-cycle on corners) × (5-cycle on edges) × (9-twist orbit) construction.'
        })}
      </div>
    </div>
  );
}

function StabilizerChainExplorer() {
  const lang = useLang();
  // Approximated stabilizer chain sizes for G as a permutation on 48 stickers.
  // Each row: stabilizer of one more sticker fixed.
  const chain = [
    { depth: 0,  size: 4.3252003274489856e19, fixed: 0,  orbit: 48 },
    { depth: 1,  size: 9.01083401551104e17,  fixed: 1,  orbit: 24 },
    { depth: 2,  size: 5.6317712596944e16,   fixed: 2,  orbit: 16 },
    { depth: 3,  size: 4693142716412000,    fixed: 3,  orbit: 12 },
    { depth: 4,  size: 469314271641200,     fixed: 4,  orbit: 10 },
    { depth: 5,  size: 47000000000000,      fixed: 5,  orbit: 10 },
    { depth: 10, size: 2000000000,          fixed: 10, orbit: 'small' },
    { depth: 15, size: 50000,               fixed: 15, orbit: 'small' },
    { depth: 20, size: 240,                 fixed: 20, orbit: 'tiny' },
    { depth: 23, size: 8,                   fixed: 23, orbit: 2 },
    { depth: 24, size: 1,                   fixed: 24, orbit: 1 },
  ];
  return (
    <div className="gt-stab">
      <table className="gt-stab-tbl">
        <thead>
          <tr>
            <th>{tr({ zh: '层', en: 'level'
            })}</th>
            <th>{tr({ zh: '固定贴纸', en: 'fixed stickers'
            })}</th>
            <th>|stab|</th>
            <th>{tr({ zh: '轨道大小', en: 'orbit size'
            })}</th>
          </tr>
        </thead>
        <tbody>
          {chain.map(c => (
            <tr key={c.depth}>
              <td className="num">{c.depth}</td>
              <td className="num">{c.fixed}</td>
              <td className="num gt-mono">{typeof c.size === 'number' && c.size > 1e6 ? c.size.toExponential(2) : c.size}</td>
              <td className="num">{c.orbit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="gt-aside" style={{ marginTop: 10 }}>
        {lang === 'zh'
          ? <>把 G 看作 48 个贴纸上的置换。 Schreier–Sims 算法逐层「固定一个贴纸, 只保留稳定它的子群」, 得到稳定子链 <TeX src={`G = G^0 \\supsetneq G^1 \\supsetneq \\cdots \\supsetneq \\{e\\}`} />。 每一步轨道大小相乘即为 <TeX src={`|G|`} />。 这就是 GAP / Magma 用来精确计算 <TeX src={`|G| = 4.3 \\times 10^{19}`} /> 的方法。</>
          : <>View G as permutations of 48 stickers. Schreier–Sims iteratively fixes one sticker at a time, restricting to its stabilizer subgroup, producing a chain <TeX src={`G = G^0 \\supsetneq G^1 \\supsetneq \\cdots \\supsetneq \\{e\\}`} />. Multiplying orbit sizes at each level gives <TeX src={`|G|`} />. This is how GAP / Magma exactly compute <TeX src={`|G| = 4.3 \\times 10^{19}`} />.</>}
      </div>
    </div>
  );
}

function IndexStatsStrip() {
  return (
    <div className="gt-index-stats">
      <div className="gt-index-stat">
        <div className="gt-index-stat-val">4.33 × 10<sup>19</sup></div>
        <div className="gt-index-stat-label">|G|</div>
        <div className="gt-index-stat-cap">{tr({ zh: '魔方可达状态', en: 'reachable cube states'
        })}</div>
      </div>
      <div className="gt-index-stat">
        <div className="gt-index-stat-val">20</div>
        <div className="gt-index-stat-label">{tr({ zh: '上帝之数 HTM', en: "God's number (HTM)"
        })}</div>
        <div className="gt-index-stat-cap">{tr({ zh: '群的直径 = 最长最短解', en: 'group diameter — longest optimal solve'
        })}</div>
      </div>
      <div className="gt-index-stat">
        <div className="gt-index-stat-val">31 + 45</div>
        <div className="gt-index-stat-label">{tr({ zh: '小节 · 互动面板', en: 'sections · interactive panels'
        })}</div>
        <div className="gt-index-stat-cap">{tr({ zh: 'KaTeX 公式 · cubing.js 动画', en: 'KaTeX formulas · cubing.js animations'
        })}</div>
      </div>
    </div>
  );
}

function IndexOrderBlock() {
  return (
    <div className="gt-index-order">
      <div className="gt-index-section-head">{tr({ zh: '本文核心定理 · |G| 的封闭式', en: "core theorem · closed form for |G|"
    })}</div>
      <div className="gt-index-order-eq">
        <TeXBlock src={`|G| \\;=\\; \\frac{8!\\,\\cdot\\,3^{7}\\,\\cdot\\,12!\\,\\cdot\\,2^{11}}{2} \\;=\\; 43{,}252{,}003{,}274{,}489{,}856{,}000`} />
      </div>
      <div className="gt-index-order-legend">
        <div><b>8!</b><span>{tr({ zh: '角块排列', en: 'corner perms'
        })}</span></div>
        <div><b>3<sup>7</sup></b><span>{tr({ zh: '角块朝向', en: 'corner twists'
        })}<br /><em>Σco ≡ 0</em></span></div>
        <div><b>12!</b><span>{tr({ zh: '棱块排列', en: 'edge perms'
        })}</span></div>
        <div><b>2<sup>11</sup></b><span>{tr({ zh: '棱块翻面', en: 'edge flips'
        })}<br /><em>Σeo ≡ 0</em></span></div>
        <div><b>÷ 2</b><span>{tr({ zh: '角棱同奇偶', en: 'parity match'
        })}<br /><em>sgn(c) = sgn(e)</em></span></div>
      </div>
      <div className="gt-index-order-foot">
        <span>= 2<sup>27</sup> · 3<sup>14</sup> · 5<sup>3</sup> · 7<sup>2</sup> · 11</span>
        <Link href="/math/group/order">→ §4 {tr({ zh: '完整推导', en: 'full derivation'
        })}</Link>
        <Link href="/math/group/invariants">→ §5 {tr({ zh: '三守恒律证明', en: "why ÷ 2 / ÷ 3 / ÷ 2"
        })}</Link>
      </div>
    </div>
  );
}

function IndexFeaturedCube() {
  const lang = useLang();
  const SUPERFLIP = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2";
  return (
    <div className="gt-index-featured">
      <div className="gt-index-featured-meta">{tr({ zh: '特写 · SUPERFLIP', en: 'feature · SUPERFLIP'
    })}</div>
      <div className="gt-index-featured-body">
        <div className="gt-index-featured-cube">
          <TwistyMini alg={SUPERFLIP} />
        </div>
        <div className="gt-index-featured-text">
          <h3 className="gt-index-featured-title">
            {tr({ zh: '所有棱翻面 — 离还原最远的 3 个态之一', en: 'All edges flipped — one of three positions maximally far from solved'
            })}
          </h3>
          <p>
            {lang === 'zh'
              ? <>每条棱的位置都对,但全部翻面 (<TeX src={`c_p = e,\\ e_p = e,\\ c_o = 0,\\ e_o = (1,1,\\ldots,1)`} />)。<strong>HTM 下恰好 20 步可解,且不能更短</strong> — 这正是 2010 年 Rokicki 等人证明 God's number = 20 时第一个被锁死的下界。</>
              : <>Every edge sits in its home slot, but all are flipped (<TeX src={`c_p = e,\\ e_p = e,\\ c_o = 0,\\ e_o = (1,1,\\ldots,1)`} />). <strong>Solvable in exactly 20 HTM moves, and no fewer</strong> — the lower bound nailed down first when Rokicki et al. proved God's number = 20 in 2010.</>}
          </p>
          <pre className="gt-index-featured-alg">{SUPERFLIP}</pre>
          <div className="gt-index-featured-cta">
            <Link href="/math/group/gods-number">§11 {tr({ zh: '上帝之数 = 20 ↗', en: "God's number = 20 ↗"
            })}</Link>
            <Link href="/math/group/order-of-element">§7 {tr({ zh: '元素的阶 ↗', en: 'order of an element ↗'
            })}</Link>
            <Link href="/math/group/patterns">§13 {tr({ zh: '图案画廊 ↗', en: 'pattern gallery ↗'
            })}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function IndexHighlightCards() {
  const lang = useLang();
  const cards: { id: string; num: string; titleZh: string; titleEn: string; teaserZh: string; teaserEn: string; formula: string
 }[] = [
    {
      id: 'what-is-a-group', num: '§1',
      titleZh: '四条公理', titleEn: 'Four axioms',
      teaserZh: '封闭 · 结合 · 单位 · 逆 — 为什么魔方"就是"一个群',
      teaserEn: 'Closure · associativity · identity · inverse — why the cube literally is a group',
      formula: `G_1 \\;G_2 \\;G_3 \\;G_4`
    },
    {
      id: 'invariants', num: '§5',
      titleZh: '三守恒律 + 证明',
      titleEn: 'Three invariants + proofs',
      teaserZh: '角向 mod 3,棱向 mod 2,角棱奇偶同 — 为什么只有 1/12 可达',
      teaserEn: 'Σco mod 3, Σeo mod 2, parity match — why only 1/12 of "free" states are reachable',
      formula: `\\textstyle\\sum c_o \\equiv 0,\\;\\sum e_o \\equiv 0`
    },
    {
      id: 'gods-number', num: '§11',
      titleZh: '上帝之数 = 20',
      titleEn: "God's number = 20",
      teaserZh: '35 CPU 年遍历 4.3 京状态:没有一个需要 21 步',
      teaserEn: '35 CPU-years brute-forced 4.3 × 10¹⁹ states — none needs 21 moves',
      formula: `\\mathrm{diam}(\\Gamma(G,S)) = 20`
    },
    {
      id: 'cayley', num: '§14',
      titleZh: 'Cayley 图',
      titleEn: 'Cayley graph',
      teaserZh: '顶点 = 状态 · 边 = 转面 · 直径 = 上帝之数 · BFS = 最优解',
      teaserEn: 'Vertices = states · edges = face turns · diameter = God\'s number · BFS = optimal solver',
      formula: `\\Gamma(G,\\, S)`
    },
  ];
  return (
    <div className="gt-index-cards">
      <div className="gt-index-section-head">{tr({ zh: '亮点 · 四个关键概念', en: 'highlights · four pivotal ideas'
    })}</div>
      <div className="gt-index-cards-grid">
        {cards.map(c => (
          <Link key={c.id} href={`/math/group/${c.id}`} className="gt-index-card">
            <div className="gt-index-card-num">{c.num}</div>
            <div className="gt-index-card-title">{lang === 'zh' ? c.titleZh : c.titleEn}</div>
            <div className="gt-index-card-formula"><TeX src={c.formula} /></div>
            <div className="gt-index-card-teaser">{lang === 'zh' ? c.teaserZh : c.teaserEn}</div>
            <div className="gt-index-card-arrow">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const TOC_THEMES: { id: string; zh: string; en: string; descZh: string; descEn: string; range: string; secs: string[]
 }[] = [
  { id: 'foundations', zh: '基础', en: 'Foundations',
    descZh: '公理 · 生成元 · 状态向量 · |G| · 守恒律 · 结构定理',
    descEn: 'axioms · generators · state vector · order · invariants · structure theorem',
    range: '§1 – §6', secs: ['what-is-a-group','cube-group','state-vector','order','invariants','structure']
},
  { id: 'core', zh: '群论核心', en: 'Core group theory',
    descZh: '元素的阶 · 共轭 · 换位子 · 子群链 · 上帝之数',
    descEn: 'element order · conjugation · commutators · Thistlethwaite chain · God\'s number',
    range: '§7 – §11', secs: ['order-of-element','conjugation','commutators','thistlethwaite','gods-number']
},
  { id: 'visual', zh: '拓展 · 几何与图案', en: 'Extensions · geometry & patterns',
    descZh: '走得更远 · 图案画廊 · Cayley 图 · 其它拼图 · 未解问题',
    descEn: 'beyond · pattern gallery · Cayley graph · other puzzles · open problems',
    range: '§12 – §16', secs: ['beyond','patterns','cayley','other-puzzles','open-problems']
},
  { id: 'advanced', zh: '进阶代数', en: 'Advanced algebra',
    descZh: '同态 · 群作用 + Burnside · Lagrange + 陪集 · 商群 · 对称群与交错群',
    descEn: 'homomorphisms · actions + Burnside · Lagrange + cosets · quotients · S_n / A_n',
    range: '§17 – §21', secs: ['homomorphisms','actions-burnside','lagrange','quotient','permutation-groups']
},
  { id: 'computation', zh: '计算 · 算法 · 表示', en: 'Computation · algorithms · representation',
    descZh: '解法算法 · 距离分布 · 随机游走 · BSGS · 表示论一瞥',
    descEn: 'solving algorithms · distance distribution · random walks · BSGS · representation theory',
    range: '§22 – §26', secs: ['algorithms','distance','random-walks','computational','representations']
},
  { id: 'puzzles', zh: '拼图数学 · jaapsch.net', en: 'Puzzle mathematics · jaapsch.net',
    descZh: 'Lights Out · 孔明棋 · Hamilton · PGL₂(𝔽₅) · 图旋转拼图 · 有用数学',
    descEn: 'Lights Out · peg solitaire · Hamilton · PGL₂(𝔽₅) · rotational graph puzzles · useful math',
    range: '§27 – §32', secs: ['lights-out','peg-solitaire','hamiltonian','two-face-pgl','rotational-puzzles','useful-math']
},
  { id: 'structure', zh: '群的结构', en: 'Structure of groups',
    descZh: '圈积、半直积、Sylow、合成列、可解与幂零、阿贝尔分类、自同构群',
    descEn: 'wreath, semidirect, Sylow, series, solvable & nilpotent, abelian, Aut',
    range: '§33 – §39', secs: ['wreath-product','semidirect-product','sylow','composition-series','solvable-nilpotent','abelian-classification','automorphism-group']
},
  { id: 'symmetry', zh: '对称与几何', en: 'Symmetry & geometry',
    descZh: '循环群、二面体群、柏拉图立体、带饰群、墙纸群、点群、Coxeter、平面等距',
    descEn: 'cyclic, dihedral, Platonic solids, frieze, wallpaper, point groups, Coxeter, isometries',
    range: '§40 – §47', secs: ['cyclic-modular','dihedral','platonic-symmetry','frieze-groups','wallpaper-groups','point-groups-crystal','reflection-coxeter','plane-isometries']
},
  { id: 'counting', zh: '计数与表示', en: 'Counting & representation',
    descZh: 'Burnside–Pólya、轮换指标、类方程、特征标表、Young 图、不可约分解、傅里叶',
    descEn: 'Burnside–Pólya, cycle index, class equation, character tables, Young tableaux, irreps, Fourier',
    range: '§48 – §54', secs: ['polya-cube-colorings','cycle-index','class-equation','character-table','young-tableaux','representation-basics','fourier-on-groups']
},
  { id: 'frontiers', zh: '更多群与前沿', en: 'More groups & frontiers',
    descZh: '四元数群、自由群、Cayley 定理、轨道稳定子、矩阵与李群、伽罗瓦、增长、扩张图',
    descEn: 'quaternions, free groups, Cayley, orbit–stabiliser, Lie groups, Galois, growth, expanders',
    range: '§55 – §62', secs: ['quaternion-group','free-groups','cayley-theorem','orbit-stabilizer','matrix-lie-groups','galois-connection','growth-of-groups','expander-ramanujan']
},
];

function IndexThemedTOC() {
  const lang = useLang();
  const byId = useMemo(() => new Map(TOC.map(t => [t.id, t])), []);
  return (
    <nav className="gt-index-toc" aria-label="Table of contents">
      <div className="gt-index-section-head">{tr({ zh: '目录 · 62 节按主题分组', en: 'contents · 62 sections, grouped by theme'
    })}</div>
      <div className="gt-index-toc-themes">
        {TOC_THEMES.map(theme => (
          <div key={theme.id} className="gt-index-theme">
            <div className="gt-index-theme-head">
              <span className="gt-index-theme-range">{theme.range}</span>
              <span className="gt-index-theme-name">{tr(theme)}</span>
              <span className="gt-index-theme-desc">{lang === 'zh' ? theme.descZh : theme.descEn}</span>
            </div>
            <ul className="gt-index-theme-list">
              {theme.secs.map(id => {
                const t = byId.get(id);
                if (!t) return null;
                return (
                  <li key={id}>
                    <Link href={`/math/group/${id}`}>
                      <span className="gt-index-theme-num">§{t.num}</span>
                      <span className="gt-index-theme-title">{tr(t)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="gt-index-theme gt-index-theme-refs">
          <div className="gt-index-theme-head">
            <span className="gt-index-theme-range">REF</span>
            <span className="gt-index-theme-name">{tr({ zh: '参考文献', en: 'References'
            })}</span>
            <span className="gt-index-theme-desc">{tr({ zh: '12 条 · 教材 · 论文 · 网络资源', en: '12 entries · textbooks · papers · web resources'
            })}</span>
          </div>
          <ul className="gt-index-theme-list">
            <li>
              <Link href={`/math/group/refs`}>
                <span className="gt-index-theme-num">REF</span>
                <span className="gt-index-theme-title">{tr({ zh: '参考文献', en: 'Bibliography'
                })}</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function GroupTheoryPage() {
  const lang = useLang();
  useDocumentTitle('群论', 'Group Theory');
  const params = useParams<{ slug?: string | string[] }>();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const isIndex = !slug;
  const validSlugs = useMemo(() => new Set(TOC.map(t => t.id)), []);
  const slugValid = !slug || validSlugs.has(slug);
  // Scroll to top on slug change (and language preserve via existing i18n)
  useEffect(() => { if (typeof window !== 'undefined') window.scrollTo(0, 0); }, [slug]);

  return (
    <SlugContext.Provider value={slug}>
    <div className="gt-page">
      <div className="gt-topbar">
        {isIndex
          ? <HomeLink className="gt-back">← {tr({ zh: '返回', en: 'home' })}</HomeLink>
          : <Link href="/math/group" className="gt-back">← {tr({ zh: '目录', en: 'contents'
        })}</Link>}
      </div>

      {isIndex && (
      <header className="gt-hero">
        <div className="gt-hero-meta">{tr({ zh: '理论 · GROUP THEORY', en: 'THEORY · GROUP THEORY'
        })}</div>
        <h1 className="gt-hero-title">
          {lang === 'zh'
            ? <>魔方<span className="gt-bold">与群</span></>
            : <>The Rubik's Cube,<br /><span className="gt-bold">as a Group</span></>}
        </h1>
        <p className="gt-hero-sub">
          {tr({ zh: '4,325 京个状态 不是混沌,是一个有序代数对象。一篇带图、带动画、带互动的代数学小课。', en: '43 quintillion positions is not chaos. It is a beautifully structured algebraic object. An illustrated, interactive primer.'
        })}
        </p>
        <div className="gt-hero-byline">
          {tr({ zh: 'cuberoot · 2026 · 62 节 · 100+ 互动 & 视觉面板 · 数学公式 KaTeX 渲染', en: 'cuberoot · 2026 · 62 sections · 100+ interactive & visual panels · KaTeX-rendered math'
        })}
        </div>
      </header>
      )}

      {!slugValid && (
        <div className="gt-aside" style={{ maxWidth: 720, margin: '40px auto' }}>
          {lang === 'zh'
            ? <>未知小节 <code className="gt-mono">{slug}</code>。 <Link href="/math/group">返回目录</Link>。</>
            : <>Unknown section <code className="gt-mono">{slug}</code>. <Link href="/math/group">Back to contents</Link>.</>}
        </div>
      )}

      {isIndex && <IndexStatsStrip />}
      {isIndex && <IndexOrderBlock />}
      {isIndex && <IndexFeaturedCube />}
      {isIndex && <IndexHighlightCards />}
      {isIndex && <IndexThemedTOC />}

      {/* ═══════════════ §2 The cube group ═══════════════════════════ */}
      <GTSec id="cube-group" className="gt-sec">
        <div className="gt-sec-num">§2</div>
        <h2 className="gt-sec-title">
          <L zh="魔方群 G" en="The cube group G" />
        </h2>
        <p>
          <L
            zh={<>把还原状态记作 <TeX src={`e`} />。 把每一次「转一个面 90° 或 180°」记作一个置换,作用在 26 个小块的位置和朝向上。所有可由这些转面组合得到的置换 (state) 构成集合 <strong>G</strong>。</>}
            en={<>Write the solved state as <TeX src={`e`} />. Each "turn a face 90° or 180°" is a permutation acting on the positions and orientations of the 26 cubies. The set <strong>G</strong> consists of all permutations producible by composing such turns.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 2.1 — 魔方群', en: 'Definition 2.1 — the cube group'
        })}</div>
          <div className="gt-def-body">
            <TeXBlock src={`G = \\langle U,\\, D,\\, L,\\, R,\\, F,\\, B \\rangle`} />
            <L
              zh={<>由六个面转 <span className="gt-mono">U, D, L, R, F, B</span> <strong>生成</strong> 的群。每个生成元是 90° 顺时针转面;它的逆是 90° 逆时针 (即 <span className="gt-mono">U′</span>),它的平方是 180° (即 <span className="gt-mono">U2</span>),所以 <strong>18 元操作集</strong> {'{U, U′, U2, ..., B2}'} 是常用的工作生成集。</>}
              en={<>The group <strong>generated by</strong> the six face turns <span className="gt-mono">U, D, L, R, F, B</span>. Each generator is a 90° clockwise face turn; its inverse is the CCW turn (<span className="gt-mono">U′</span>), its square is the half-turn (<span className="gt-mono">U2</span>), giving the standard working set of <strong>18 moves</strong>.</>}
            />
          </div>
        </div>

        <p style={{ marginTop: 32, marginBottom: 12 }}>
          <L
            zh="6 个生成元 — 点开任一个面,看 cubing.js 把这个操作转给你看:"
            en="The six generators — click any face below; cubing.js will animate it."
          />
        </p>
        <GeneratorRow />

        <div className="gt-aside">
          <L
            zh={<>注:魔方爱好者熟悉的「中间层切」<span className="gt-mono">M, E, S</span> 和「整体旋转」<span className="gt-mono">x, y, z</span> 不是 G 的额外生成元。它们都能用 6 个面转表示出来,例如 <span className="gt-mono">M = R' L x'</span>。它们存在只是为了书写方便。</>}
            en={<>Aside: the slice moves <span className="gt-mono">M, E, S</span> and full rotations <span className="gt-mono">x, y, z</span> are not extra generators of G. They are derived: <span className="gt-mono">M = R' L x'</span>, etc. They exist only as a notational convenience.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="2.1  生成集 — 18 个还是 6 个?" en="2.1  Generating set — 18 or 6?" />
        </h3>
        <p>
          <L
            zh={<>正式的生成集是 6 个 (六个面转),但实际操作时记号上人们用 18 个:每面 ×3 角度 (90°, 180°, 270° = 270° 也写作 -90° 即 <span className="gt-mono">U′</span>)。这 18 个就是 WCA 比赛使用的 <strong>半圈度量</strong> (Half-Turn Metric, HTM)。<br /><br />还有更细致的 <strong>四分一圈度量</strong> (Quarter-Turn Metric, QTM):只允许 90° 转,180° 算两步。在 QTM 下,生成集是 12 个 (六面 ×{2}),魔方群直径变成 <strong>26</strong>。</>}
            en={<>The minimal generating set has 6 elements (the six face turns), but in notation we usually write 18: each face × 3 angles (90°, 180°, 270° = the inverse <span className="gt-mono">U′</span>). These 18 constitute the <strong>Half-Turn Metric (HTM)</strong> used in WCA competition.<br /><br />The stricter <strong>Quarter-Turn Metric (QTM)</strong> only allows 90° turns (180° counts as two). In QTM, the generating set has 12 elements, and the group's diameter rises to <strong>26</strong>.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 2.2 — 度量', en: 'Definition 2.2 — metric on a group'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>给定生成集 <TeX src={`S`} />,对任意 <TeX src={`g \\in G`} />,定义 <TeX src={`|g|_S`} /> 为「<em>用 S 的元素表示 g 所需的最少 token 数</em>」。HTM 用 18-生成集,QTM 用 12-生成集。「最短解」是 <TeX src={`|g|_S`} /> 的别名。</>}
              en={<>Given a generating set <TeX src={`S`} />, for any <TeX src={`g \\in G`} />, define <TeX src={`|g|_S`} /> as the <em>minimum number of S-tokens whose product equals g</em>. HTM uses the 18-generator set; QTM the 12-generator set. The "optimal solution length" is simply <TeX src={`|g|_S`} />.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="2.2  群的呈现 (Presentation)" en="2.2  Group presentation" />
        </h3>
        <p>
          <L
            zh={<>群也可以用「生成元 + 关系」抽象描述。例如 <TeX src={`\\mathbb{Z}/4 = \\langle a \\mid a^4 = e \\rangle`} />,意为「一个元素 a,自乘 4 次为单位元」。对魔方群:</>}
            en={<>A group can also be presented abstractly as "generators with relations." For instance <TeX src={`\\mathbb{Z}/4 = \\langle a \\mid a^4 = e \\rangle`} /> means "one element a, which when raised to the 4th power gives e." For the cube:</>}
          />
        </p>
        <TeXBlock src={`G = \\Bigl\\langle \\;U, D, L, R, F, B \\;\\Bigm|\\; \\begin{aligned} & U^4 = D^4 = L^4 = R^4 = F^4 = B^4 = e, \\\\ & UD = DU,\\;\\; LR = RL,\\;\\; FB = BF, \\\\ & \\text{(plus dozens of opaque longer relators)} \\end{aligned} \\Bigr\\rangle`} />
        <p>
          <L
            zh={<>除了「每面转 4 次回到原点」和「平行面互换」这两条显然的关系,其它的生成元间关系太繁杂,实际上没人完整写下来过。<strong>魔方群的有限呈现</strong> (finite presentation) 是数学上一个有趣却罕被研究的对象。</>}
            en={<>Beyond the trivial "each face cycles in 4" and the "parallel faces commute" relations, the rest of the relators are too tangled to enumerate cleanly. A <em>complete finite presentation</em> for G is mathematically curious but rarely written down explicitly.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>有趣的是,「字问题」(word problem,即给定两个字判断是否相等) 在魔方群上是 <em>可解的</em> —— 因为 G 是有限群,字问题等价于「先把两个字归约为正则形式,再比较」。但 <strong>最短字问题</strong> (即「求 g 的最短表示」) 是 NP-困难的。这就是为什么直接构造最优 solver 是个真正的挑战。</>}
            en={<>Curiously, the <em>word problem</em> (decide if two words represent the same element) is solvable for G — because G is finite, normalising via the cube state suffices. But the <strong>shortest-word problem</strong> (find the optimal representation of g) is NP-hard in the general setting. That's why optimal solvers are genuinely difficult.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="2.3  子群" en="2.3  Subgroups" />
        </h3>
        <p>
          <L
            zh={<>给定 G 的生成元的任意子集,生成出的「子群」可能远小于 G。常见的有:</>}
            en={<>Any subset of generators generates a subgroup — usually much smaller than G. Common ones:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <TeX src={`\\langle U \\rangle`} /> &nbsp; — <L zh={<>只允许 U 转动:同构于 <TeX src={`\\mathbb{Z}/4`} /> (4 个元素)</>} en={<>only U-turns allowed: isomorphic to <TeX src={`\\mathbb{Z}/4`} /> (4 elements)</>} />
          </li>
          <li>
            <TeX src={`\\langle U, D \\rangle`} /> &nbsp; — <L zh={<>只允许上下面:同构于 <TeX src={`\\mathbb{Z}/4 \\times \\mathbb{Z}/4`} /> = 16 元素</>} en={<>up & down faces: isomorphic to <TeX src={`\\mathbb{Z}/4 \\times \\mathbb{Z}/4`} /> = 16 elements</>} />
          </li>
          <li>
            <TeX src={`\\langle R, U \\rangle`} /> &nbsp; — <L zh={<>R 和 U 生成的子群, 73,483,200 个元素。 Cayley 图的常见研究对象。</>} en={<>The subgroup generated by R and U: order ≈ 73 million. A classic Cayley-graph subject.</>} />
          </li>
          <li>
            <TeX src={`\\langle U^2, D^2, L^2, R^2, F^2, B^2 \\rangle = G_3`} /> &nbsp; — <L zh={`只允许半圈,663,552 个元素 ("多米诺群")`} en={`half-turns only, 663,552 elements (the "domino group")`} />
          </li>
        </ul>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="2.4  18 个面转 — 完整列表" en="2.4  The 18 face turns — complete list" />
        </h3>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '面', en: 'Face' })}</th><th>90°</th><th>180°</th><th>270° = 90° CCW</th><th>{tr({ zh: 'HTM 计数', en: 'HTM count'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>U</strong></td><td className="num"><span className="gt-mono">U</span></td><td className="num"><span className="gt-mono">U2</span></td><td className="num"><span className="gt-mono">U'</span></td><td className="num">3</td></tr>
            <tr><td><strong>D</strong></td><td className="num"><span className="gt-mono">D</span></td><td className="num"><span className="gt-mono">D2</span></td><td className="num"><span className="gt-mono">D'</span></td><td className="num">3</td></tr>
            <tr><td><strong>L</strong></td><td className="num"><span className="gt-mono">L</span></td><td className="num"><span className="gt-mono">L2</span></td><td className="num"><span className="gt-mono">L'</span></td><td className="num">3</td></tr>
            <tr><td><strong>R</strong></td><td className="num"><span className="gt-mono">R</span></td><td className="num"><span className="gt-mono">R2</span></td><td className="num"><span className="gt-mono">R'</span></td><td className="num">3</td></tr>
            <tr><td><strong>F</strong></td><td className="num"><span className="gt-mono">F</span></td><td className="num"><span className="gt-mono">F2</span></td><td className="num"><span className="gt-mono">F'</span></td><td className="num">3</td></tr>
            <tr><td><strong>B</strong></td><td className="num"><span className="gt-mono">B</span></td><td className="num"><span className="gt-mono">B2</span></td><td className="num"><span className="gt-mono">B'</span></td><td className="num">3</td></tr>
            <tr><td>{tr({ zh: '合计', en: 'Total'
            })}</td><td colSpan={3}></td><td className="num"><strong>18</strong></td></tr>
          </tbody>
        </table>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="2.5  循环结构 — 每个面转拆成的循环" en="2.5  Cycle structure of each face turn" />
        </h3>
        <p>
          <L
            zh={<>每个面转都是一个 8 角块 × 12 棱块 的置换。把 R 写出来 (用 §3 的 cubie 编号):</>}
            en={<>Each face turn is a permutation of the 8 corners and 12 edges. Writing R out explicitly (using the cubie indexing of §3):</>}
          />
        </p>
        <TeXBlock src={`R = (0\\;3\\;7\\;4)_{c} \\cdot (0\\;11\\;4\\;8)_{e}`} />
        <p>
          <L
            zh={<>即 「URF → UBR → DRB → DFR → URF」 这条 4-循环, 加上对应的棱块 4-循环 「UR → BR → DR → FR → UR」。 类似地 U 是 <TeX src={`(0\\;1\\;2\\;3)_c (0\\;1\\;2\\;3)_e`} />,F 还要叠上 4 棱块的翻面 (EO+1)。所有 6 个生成元都呈现「4-cycle 角 × 4-cycle 棱 + 可能的 orientation 偏移」的同一模板:</>}
            en={<>That is the 4-cycle URF → UBR → DRB → DFR → URF on corners, plus the matching 4-cycle UR → BR → DR → FR → UR on edges. Likewise U is <TeX src={`(0\\;1\\;2\\;3)_c (0\\;1\\;2\\;3)_e`} />, and F also flips 4 edges (EO+1). All six generators follow the same pattern: 4-cycle on corners × 4-cycle on edges + optional orientation kick.</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '生成元', en: 'Gen' })}</th><th>{tr({ zh: '角块循环', en: 'Corner cycle'
            })}</th><th>{tr({ zh: '棱块循环', en: 'Edge cycle'
            })}</th><th>{tr({ zh: '阶', en: 'Order'
            })}</th><th>{tr({ zh: '改 CO?', en: 'Δ CO' })}</th><th>{tr({ zh: '改 EO?', en: 'Δ EO' })}</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>U</strong></td><td><TeX src={`(0\\;1\\;2\\;3)`} /></td><td><TeX src={`(0\\;1\\;2\\;3)`} /></td><td className="num">4</td><td>0</td><td>0</td></tr>
            <tr><td><strong>R</strong></td><td><TeX src={`(0\\;3\\;7\\;4)`} /></td><td><TeX src={`(0\\;11\\;4\\;8)`} /></td><td className="num">4</td><td>{tr({ zh: '是', en: 'yes' })}</td><td>0</td></tr>
            <tr><td><strong>F</strong></td><td><TeX src={`(0\\;4\\;5\\;1)`} /></td><td><TeX src={`(1\\;8\\;5\\;9)`} /></td><td className="num">4</td><td>{tr({ zh: '是', en: 'yes' })}</td><td>{tr({ zh: '4 棱 +1', en: '4 edges +1'
            })}</td></tr>
          </tbody>
        </table>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="2.6  关系与反例" en="2.6  Relations and a non-relation" />
        </h3>
        <p>
          <L
            zh={<>显然的关系:每个面转 4 次为单位元, <TeX src={`U^4 = e`} />, 等等。 取逆: <TeX src={`U \\cdot U' = e`} />。 但 <strong>U 与 R 不交换</strong>:</>}
            en={<>Obvious relations: each face has order 4, <TeX src={`U^4 = e`} />, and trivially <TeX src={`U \\cdot U' = e`} />. But <strong>U does not commute with R</strong>:</>}
          />
        </p>
        <TeXBlock src={`UR \\;\\neq\\; RU \\qquad \\text{(verify: apply both to the solved state; resulting corners and edges differ)}`} />
        <p>
          <L
            zh={<>这一条 「非关系」 是整个魔方理论的源头 — 若 UR = RU,魔方就退化为阿贝尔。 Coxeter 风格的呈现(若魔方群恰是 Coxeter 群)会要求 <TeX src={`(s_i s_j)^{m_{ij}} = e`} />。 魔方群 <strong>不是</strong> Coxeter 群: 6 个面转之间没有形如 <TeX src={`(UR)^k = e`} /> 的小整数关系 (<TeX src={`|UR| = 105`} />,见 §8)。 这正说明 G 「比通常对称群更野」。</>}
            en={<>That non-relation is the entire source of cube theory — if UR = RU the cube would collapse to Abelian. A Coxeter-style presentation would demand <TeX src={`(s_i s_j)^{m_{ij}} = e`} /> for some small <TeX src={`m_{ij}`} />. G is <strong>not</strong> a Coxeter group: there is no small integer k with <TeX src={`(UR)^k = e`} /> (<TeX src={`|UR| = 105`} />, see §8). G is genuinely "wilder" than the standard symmetry groups.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §3 Cube state vector ════════════════════════ */}
      <GTSec id="state-vector" className="gt-sec">
        <div className="gt-sec-num">§3</div>
        <h2 className="gt-sec-title">
          <L zh="状态向量 (cp, co, ep, eo)" en="State vector: (cp, co, ep, eo)" />
        </h2>
        <p>
          <L
            zh={<>一个 3×3×3 魔方有 <strong>8 个角块</strong> 和 <strong>12 个棱块</strong>。中心块固定 (它们决定颜色对应)。状态完全由下面四个量描述:</>}
            en={<>A 3×3×3 cube has <strong>8 corners</strong> and <strong>12 edges</strong>. Centres are fixed (they define the colour scheme). The full state is captured by four arrays:</>}
          />
        </p>
        <div className="gt-statevec">
          <div className="gt-statevec-row">
            <TeX src={`c_p \\in S_8`} />
            <span className="gt-statevec-desc">{tr({ zh: '8 个角块的位置 (置换)', en: 'positions of the 8 corners (permutation)'
            })}</span>
          </div>
          <div className="gt-statevec-row">
            <TeX src={`c_o \\in (\\mathbb{Z}/3)^8`} />
            <span className="gt-statevec-desc">{tr({ zh: '每个角块的方向 (拧角)', en: 'orientation of each corner (twist)'
            })}</span>
          </div>
          <div className="gt-statevec-row">
            <TeX src={`e_p \\in S_{12}`} />
            <span className="gt-statevec-desc">{tr({ zh: '12 个棱块的位置', en: 'positions of the 12 edges'
            })}</span>
          </div>
          <div className="gt-statevec-row">
            <TeX src={`e_o \\in (\\mathbb{Z}/2)^{12}`} />
            <span className="gt-statevec-desc">{tr({ zh: '每个棱块的翻面 (好/坏)', en: 'orientation of each edge (flip)'
            })}</span>
          </div>
        </div>
        <p>
          <L
            zh={<>这是 Kociemba 在 1990 年代为 two-phase solver 选定的标准坐标 [<a href="#ref-kociemba">7</a>]。整个魔方代数都在这个 4 元组上展开:每一个生成元都是一个固定的「在 cp 上做某个置换 + 在 co/ep/eo 上加某个偏移」的复合操作。</>}
            en={<>These are the standard coordinates Kociemba chose in the 1990s for his two-phase solver [<a href="#ref-kociemba">7</a>]. All of cube algebra is built on this 4-tuple: each generator is a fixed "permute cp + add offsets to co/ep/eo" combination.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.1  展开图与小块编号" en="3.1  Unfolded layout & cubie indexing" />
        </h3>
        <p>
          <L
            zh={<>下面是 3×3×3 展开图。54 个色块,但只有 26 个小块 (cubie):8 个角(3 个色块各)、12 个棱(2 个色块各)、6 个中心(1 个色块)。中心固定 (不可移动) 所以只需描述 8 + 12 = 20 个可动小块的状态。</>}
            en={<>The 3×3×3 unfolded: 54 stickers but only 26 cubies (8 corners × 3 stickers each, 12 edges × 2, 6 centres × 1). Centres are immobile, so the state needs only describe the 8 + 12 = 20 movable cubies.</>}
          />
        </p>
        <UnfoldedCubeMap />
        <p>
          <L
            zh={<>本文采用的小块编号 (沿用 Kociemba):</>}
            en={<>The cubie indexing used throughout (following Kociemba):</>}
          />
        </p>
        <div className="gt-math-display" style={{ textAlign: 'left', fontSize: '.95em' }}>
          <span style={{ display: 'block', marginBottom: 4 }}>
            corners: &nbsp; <span className="gt-mono">0:URF</span> &nbsp; <span className="gt-mono">1:UFL</span> &nbsp; <span className="gt-mono">2:ULB</span> &nbsp; <span className="gt-mono">3:UBR</span> &nbsp; <span className="gt-mono">4:DFR</span> &nbsp; <span className="gt-mono">5:DLF</span> &nbsp; <span className="gt-mono">6:DBL</span> &nbsp; <span className="gt-mono">7:DRB</span>
          </span>
          <span style={{ display: 'block' }}>
            edges: &nbsp; <span className="gt-mono">0:UR 1:UF 2:UL 3:UB 4:DR 5:DF 6:DL 7:DB 8:FR 9:FL 10:BL 11:BR</span>
          </span>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.2  方向 (orientation) 的约定" en="3.2  Orientation convention" />
        </h3>
        <p>
          <L
            zh={<>每个角块在自己的位置有 <strong>3 种方向</strong>(它的「U/D 色块」可以面向上下、前后、左右三个轴中的某一个)。每个棱块有 <strong>2 种方向</strong>(它的「U/D 色块」可以朝外或朝内,以 F/B-轴为基准)。所以:</>}
            en={<>Each corner at a fixed position has <strong>3 possible orientations</strong> (its "U/D-coloured sticker" can face one of three axes). Each edge has <strong>2 orientations</strong> ("good" or "flipped" relative to the F/B-axis convention). So:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh="角块朝向 ∈ ℤ/3 = {0, 1, 2} (0 = 正常, +1 = 顺时针拧, +2 = 逆时针拧)" en="corner orientation ∈ ℤ/3 = {0, 1, 2} (0 = aligned, +1 = CW, +2 = CCW)" /></li>
          <li><L zh="棱块朝向 ∈ ℤ/2 = {0, 1} (0 = good, 1 = flipped)" en="edge orientation ∈ ℤ/2 = {0, 1} (0 = good, 1 = flipped)" /></li>
        </ul>
        <div className="gt-aside">
          <L
            zh={<>方向的具体定义依赖于约定 (有多家流派)。本文用 Kociemba 派:角朝向以「U/D 颜色」是否在 U/D 面为基准;棱朝向以「F 或 B 颜色」是否在 F/B 面为基准。其它流派 (如 Singmaster) 用稍不同的基准,但代数结构等价。</>}
            en={<>The exact definition depends on convention. Here we use Kociemba's: corner orientation tracked by the U/D sticker; edge orientation by the F/B sticker. Singmaster and others use slightly different bases — the algebraic structure is unchanged.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.3  生成元的张量表示" en="3.3  Tensor representation of generators" />
        </h3>
        <p>
          <L
            zh={<>每个面转都对应一个 「位置置换 + 方向偏移」对。例如 R 转面:</>}
            en={<>Each face turn corresponds to a (permutation, orientation offset) pair. For example, R:</>}
          />
        </p>
        <div className="gt-rgen">
          <div className="gt-rgen-row"><TeX src={`R_{c_p} = (0\\;4\\;7\\;3)`} /><span className="gt-rgen-desc">{tr({ zh: '4-循环角块', en: '4-cycle on corners'
        })}</span></div>
          <div className="gt-rgen-row"><TeX src={`R_{c_o} = (+2, 0, 0, +1, +1, 0, 0, +2)`} /><span className="gt-rgen-desc">{tr({ zh: '角块拧角偏移', en: 'corner twist deltas'
        })}</span></div>
          <div className="gt-rgen-row"><TeX src={`R_{e_p} = (0\\;8\\;11\\;4)`} /><span className="gt-rgen-desc">{tr({ zh: '4-循环棱块', en: '4-cycle on edges'
        })}</span></div>
          <div className="gt-rgen-row"><TeX src={`R_{e_o} = 0`} /><span className="gt-rgen-desc">{tr({ zh: 'R 不改变 EO (因 R 是 RL-轴)', en: 'R does not affect EO (since R is on the RL-axis)'
        })}</span></div>
        </div>
        <p>
          <L
            zh={<>类似地:F 转面会翻转 4 个棱块的 EO (UF, DF, FR, FL 各 +1 mod 2)。U/D 转面 既不改 CO 也不改 EO,只置换位置。这种「细分一面到底改什么」的清晰结构,使得状态压缩与解法搜索都极其高效:</>}
            en={<>Similarly: F flips the EO of 4 edges (UF, DF, FR, FL each +1 mod 2). U/D turns change neither CO nor EO — only positions. This clear axis-specific structure makes both state compression and solver search highly efficient:</>}
          />
        </p>
        <TeXBlock src={`\\text{state size} \\;\\approx\\; \\underbrace{(8\\text{ perm} + 8\\text{ ori bits})}_{\\text{corners}} + \\underbrace{(12\\text{ perm} + 12\\text{ ori bits})}_{\\text{edges}} \\;\\approx\\; 10 \\text{ bytes}`} />
        <p>
          <L
            zh={<>对比一下: 直接存 54 个色块的颜色,需要 54 × 3 = 162 bit ≈ 21 字节,且没有压缩。结构化编码省一半内存,还自动剔除非法状态。</>}
            en={<>Compare: naively storing colours for all 54 stickers takes 162 bits ≈ 21 bytes, with no compression. The structured encoding halves memory and intrinsically excludes illegal states.</>}
          />
        </p>
        <CubeStateInspector />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.4  自由度推导 — 8! · 3⁸ · 12! · 2¹² vs |G|" en="3.4  Counting degrees of freedom" />
        </h3>
        <p>
          <L
            zh={<>把 cp / co / ep / eo 看成 4 个独立坐标, 它们各自的取值空间:</>}
            en={<>Treat cp / co / ep / eo as four independent coordinates. Their raw cardinalities:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '坐标', en: 'Coord'
            })}</th><th>{tr({ zh: '取值空间', en: 'Codomain'
            })}</th><th>{tr({ zh: '大小', en: 'Size' })}</th></tr>
          </thead>
          <tbody>
            <tr><td><TeX src={`c_p`} /></td><td><TeX src={`S_8`} /></td><td className="num">8! = 40,320</td></tr>
            <tr><td><TeX src={`c_o`} /></td><td><TeX src={`(\\mathbb{Z}/3)^8`} /></td><td className="num">3⁸ = 6,561</td></tr>
            <tr><td><TeX src={`e_p`} /></td><td><TeX src={`S_{12}`} /></td><td className="num">12! = 479,001,600</td></tr>
            <tr><td><TeX src={`e_o`} /></td><td><TeX src={`(\\mathbb{Z}/2)^{12}`} /></td><td className="num">2¹² = 4,096</td></tr>
            <tr><td>{tr({ zh: '乘积 (自由空间)', en: 'product (free space F)'
            })}</td><td colSpan={2} className="num"><TeX src={`|F| = 5.19 \\times 10^{20}`} /></td></tr>
            <tr><td>{tr({ zh: '魔方群 G', en: 'cube group G' })}</td><td colSpan={2} className="num"><TeX src={`|G| = |F|/12 \\approx 4.33 \\times 10^{19}`} /></td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>因此 「位置 + 朝向」 共有 <TeX src={`\\log_2 |F| \\approx 69.1`} /> bit 信息, 但 G 只占其中 <TeX src={`\\log_2 |G| \\approx 65.2`} /> bit。 差出来的 <TeX src={`\\log_2 12 \\approx 3.58`} /> bit 就是 §5 的三守恒律 (ℤ/3 × ℤ/2 × ℤ/2)。</>}
            en={<>So "position + orientation" carries <TeX src={`\\log_2 |F| \\approx 69.1`} /> bits of information, but G only sits in <TeX src={`\\log_2 |G| \\approx 65.2`} /> of those. The missing <TeX src={`\\log_2 12 \\approx 3.58`} /> bits are precisely the three invariants of §5 (ℤ/3 × ℤ/2 × ℤ/2).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="3.5  ℓ₁ 与 ℓ∞ 距离到原点" en="3.5  ℓ₁ and ℓ∞ distances to the origin" />
        </h3>
        <p>
          <L
            zh={<>把状态向量映射为 |R^{`{40}`}| 中的点 (8 + 12 = 20 个位置 index + 8 个 mod-3 + 12 个 mod-2),可以问 「到原点的距离」 怎么算。两种自然范数:</>}
            en={<>Embed state vectors into <TeX src={`\\mathbb{R}^{40}`} /> (20 position indices + 8 mod-3 + 12 mod-2) and ask "distance to origin." Two natural norms:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><TeX src={`\\ell_1`} /> <strong>错位数</strong> = ∑ (cubies 不在正位) + ∑ (orientation 偏移)。 最大值约 36 (8 + 12 + 8 + 12 - 几个组合限制)。 这就是 §22 Korf solver 的 「简易启发式」 的雏形。</>}
            en={<><TeX src={`\\ell_1`} /> <strong>mismatch count</strong> = #(cubies off-position) + #(orientation deltas). Max ≈ 36 (8 + 12 + 8 + 12 minus a few combinatorial constraints) — the seed of Korf's simple admissible heuristic in §22.</>}
          /></li>
          <li><L
            zh={<><TeX src={`\\ell_\\infty`} /> <strong>最远偏移</strong> = max over all cubies。 对随机状态几乎总等于 1 (因为至少一个块错位)。 对 HTM 距离, 这是非常宽松的下界。</>}
            en={<><TeX src={`\\ell_\\infty`} /> <strong>worst-cubie offset</strong> = max over all cubies. For a random state this is almost always 1 (at least one cubie misplaced). A very loose lower bound on HTM distance.</>}
          /></li>
        </ul>
        <p>
          <L
            zh={<>关键事实:这些范数 <em>不</em> 等价于 HTM 度量 <TeX src={`|g|_S`} /> (§2.2)。 它们只是 G 中 d_S(e, g) 的弱下界, 在 §22 求解器中作为启发式使用。 真正的 d_S(e, g) 只能由 Korf IDA* 或 Kociemba two-phase 算出, 它是「群的 Cayley 图距离」, 没有闭式。</>}
            en={<>Crucial: these norms are <em>not</em> equivalent to the HTM metric <TeX src={`|g|_S`} /> (§2.2). They are weak lower bounds on d_S(e, g), used as heuristics by §22's solvers. The true d_S(e, g) is the Cayley-graph distance — no closed form; computed only by Korf IDA* or Kociemba two-phase.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §5 Three invariants ═════════════════════════ */}
      <GTSec id="invariants" className="gt-sec">
        <div className="gt-sec-num">§5</div>
        <h2 className="gt-sec-title">
          <L zh="三个守恒律 (可达性条件)" en="Three invariants (reachability conditions)" />
        </h2>
        <p>
          <L
            zh={<>哪些状态可以仅靠 6 个面转得到?恰好三条:</>}
            en={<>Which states are reachable by face turns alone? Exactly these three constraints determine it:</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 5.1 — 魔方第一定律', en: 'Theorem 5.1 — first law of cubology' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>一个状态 <TeX src={`(c_p, c_o, e_p, e_o)`} /> 可达 (即位于 G 中),当且仅当下面三件事同时成立:</>}
              en={<>A state <TeX src={`(c_p, c_o, e_p, e_o)`} /> is reachable (i.e. lies in G) if and only if all three hold:</>}
            />
            <div className="gt-inv-laws">
              <div className="gt-inv-law">
                <div className="gt-inv-law-num">(1)</div>
                <TeXBlock src={`\\sum_{i=1}^{8} c_o^{(i)} \\;\\equiv\\; 0 \\pmod 3`} />
                <div className="gt-inv-law-desc">{tr({ zh: '总角块拧角守恒', en: 'total corner twist conserved'
                })}</div>
              </div>
              <div className="gt-inv-law">
                <div className="gt-inv-law-num">(2)</div>
                <TeXBlock src={`\\sum_{i=1}^{12} e_o^{(i)} \\;\\equiv\\; 0 \\pmod 2`} />
                <div className="gt-inv-law-desc">{tr({ zh: '总棱块翻面守恒', en: 'total edge flip conserved'
                })}</div>
              </div>
              <div className="gt-inv-law">
                <div className="gt-inv-law-num">(3)</div>
                <TeXBlock src={`\\operatorname{sgn}(c_p) \\;=\\; \\operatorname{sgn}(e_p)`} />
                <div className="gt-inv-law-desc">{tr({ zh: '角棱奇偶联动', en: 'corner-edge parity coupling'
                })}</div>
              </div>
            </div>
          </div>
        </div>
        <p>
          <L
            zh={<>每条约束都直接对应一个被禁掉的物理操作:不能 <strong>单独扭一个角块</strong>(违反 1),不能 <strong>单独翻一个棱块</strong>(违反 2),也不能 <strong>只交换两个棱块</strong> 而不动角块(违反 3)。把魔方撬下来再插上去,就是绕过这些约束 —— 8 个角拧角任意 / 12 个棱翻面任意 / 棱角独立换位,共 12 倍的「平行宇宙」。</>}
            en={<>Each constraint forbids one physically intuitive move. You cannot <strong>twist a single corner</strong> (violates 1), <strong>flip a single edge</strong> (violates 2), or <strong>swap two edges without disturbing corners</strong> (violates 3). Popping the cube apart and reassembling it sidesteps these — 12 parallel "alternate universes" of unreachable states.</>}
          />
        </p>
        <InvariantInspector />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.1  CO 守恒律的证明" en="5.1  Proof: corner orientation sum is conserved" />
        </h3>
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '证明', en: 'Proof'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>要证: 任何面转 <TeX src={`X`} /> 应用后, <TeX src={`\\sum_i c_o^{(i)} \\equiv 0 \\pmod 3`} /> 在 G 中保持。</p>
              <p style={{ margin: '0 0 12px' }}>逐个验证 6 个生成元:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li><strong>U, D</strong>: 这两个面转把每个 U/D 层角块的「U/D 色块」继续保持在 U/D 面。所以 <TeX src={`\\Delta c_o^{(i)} = 0`} />,<TeX src={`\\sum \\Delta c_o = 0`} />。 ✓</li>
                <li><strong>R, L</strong>: R 把 4 个角块依次旋转。 URF → UBR: U-色块「上 → 前-上」, <TeX src={`+1 \\pmod 3`} />。 UBR → DRB: 「上 → 右」, <TeX src={`+2 \\pmod 3`} />。 同理 DRB → DFR 为 <TeX src={`+1`} />, DFR → URF 为 <TeX src={`+2`} />。 合计 <TeX src={`1 + 2 + 1 + 2 = 6 \\equiv 0 \\pmod 3`} />。 ✓</li>
                <li><strong>F, B</strong>: 类似地, F 转 4 个角块 CO 偏移之和也是 <TeX src={`6 \\equiv 0 \\pmod 3`} />。 ✓</li>
              </ul>
              <p style={{ margin: '0 0 12px' }}>结论: 每个生成元都让 <TeX src={`\\sum_i c_o^{(i)} \\pmod 3`} /> 不变, 因此其有限乘积 (即 G 中任意元素) 也保持这一不变量。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Claim: applying any generator <TeX src={`X`} /> preserves <TeX src={`\\sum_i c_o^{(i)} \\pmod 3`} />.</p>
              <p style={{ margin: '0 0 12px' }}>Verify on the 6 generators:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li><strong>U, D</strong>: these cycle the four U-layer (or D-layer) corners while keeping the U-coloured sticker on the U/D face. So all four <TeX src={`\\Delta c_o = 0`} />. ✓</li>
                <li><strong>R, L</strong>: R cycles four corners. URF → UBR: U sticker rotates "up" → "front-up", <TeX src={`+1 \\pmod 3`} />. UBR → DRB: "up" → "right", <TeX src={`+2 \\pmod 3`} />. By symmetry DRB → DFR = <TeX src={`+1`} />, DFR → URF = <TeX src={`+2`} />. Total: <TeX src={`1 + 2 + 1 + 2 = 6 \\equiv 0 \\pmod 3`} />. ✓</li>
                <li><strong>F, B</strong>: similarly each contributes <TeX src={`\\Delta(\\sum c_o) = 6 \\equiv 0 \\pmod 3`} />. ✓</li>
              </ul>
              <p style={{ margin: '0 0 12px' }}>So every generator preserves <TeX src={`\\sum_i c_o^{(i)} \\pmod 3`} />, and so does any finite product.</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.2  EO 守恒律的证明" en="5.2  Proof: edge orientation sum is conserved" />
        </h3>
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '证明', en: 'Proof'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>要证: <TeX src={`\\sum_i e_o^{(i)} \\pmod 2`} /> 在 G 中保持。</p>
              <p style={{ margin: '0 0 12px' }}>U, D, R, L 不影响任何棱块的 EO。 F 和 B 各翻转 4 个棱块的 EO, 总变化 <TeX src={`\\Delta\\!\\sum e_o = 4 \\equiv 0 \\pmod 2`} />。 ✓</p>
              <p style={{ margin: '0 0 8px' }}>每个生成元 <TeX src={`\\Delta(\\sum e_o) \\equiv 0 \\pmod 2`} />, 故 <TeX src={`\\sum e_o \\pmod 2`} /> 是 G 不变量。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Claim: <TeX src={`\\sum_i e_o^{(i)} \\pmod 2`} /> is preserved.</p>
              <p style={{ margin: '0 0 12px' }}>U, D, R, L do not affect any edge's EO (their stickers stay on the same {`{U/D, L/R}`} pair). F and B each flip 4 edges, contributing <TeX src={`\\Delta(\\sum e_o) = 4 \\equiv 0 \\pmod 2`} />. ✓</p>
              <p style={{ margin: '0 0 8px' }}>Every generator gives <TeX src={`\\equiv 0 \\pmod 2`} />, so <TeX src={`\\sum e_o`} /> is a G-invariant.</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.3  奇偶联动的证明" en="5.3  Proof: corner-edge parity coupling" />
        </h3>
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '证明', en: 'Proof'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>要证: <TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} /> 在 G 中保持 ⇔ 角块置换和棱块置换的奇偶性绑定。</p>
              <p style={{ margin: '0 0 12px' }}>每个面转的角块置换是一个 4-循环。 4-循环 = 3 个相邻 2-循环之积, 故 <TeX src={`\\operatorname{sgn} = (-1)^3 = -1`} />。 同理棱块置换也是 4-循环, <TeX src={`\\operatorname{sgn} = -1`} />。</p>
              <p style={{ margin: '0 0 12px' }}>所以每个生成元同时把 <TeX src={`\\operatorname{sgn}(c_p)`} /> 和 <TeX src={`\\operatorname{sgn}(e_p)`} /> 都翻号。 其乘积保持<TeXBlock src={`\\frac{\\operatorname{sgn}(c_p)}{\\operatorname{sgn}(e_p)} = +1.`} />等价地, <TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} />。 ✓</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Claim: <TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} /> is preserved.</p>
              <p style={{ margin: '0 0 12px' }}>Each face turn cycles 4 corners (a 4-cycle in <TeX src={`c_p`} />) and 4 edges (a 4-cycle in <TeX src={`e_p`} />). A 4-cycle factors into 3 transpositions, so <TeX src={`\\operatorname{sgn} = (-1)^3 = -1`} />.</p>
              <p style={{ margin: '0 0 12px' }}>Therefore every generator flips <TeX src={`\\operatorname{sgn}(c_p)`} /> and <TeX src={`\\operatorname{sgn}(e_p)`} /> <em>simultaneously</em>. Their ratio<TeXBlock src={`\\frac{\\operatorname{sgn}(c_p)}{\\operatorname{sgn}(e_p)} = +1`} />stays constant. ✓</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <p>
          <L
            zh={<>这三个证明加起来,完全刻画了 G 在「自由组装空间」 <TeX src={`S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}`} /> 里的位置。剩下要证的是 <strong>反方向</strong>:满足这三条的状态都是可达的。这部分通常由具体构造性算法 (即一个 solver) 直接给出 —— 任何能解魔方的程序,本身就是「可达性」的证明。</>}
            en={<>Together these three proofs pin G's location inside the free assembly group <TeX src={`S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}`} />. The converse — that every state satisfying these three constraints is reachable — is usually established constructively: any working solver is itself a proof of reachability.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '推论 5.4', en: 'Corollary 5.4'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>「自由组装空间」/ G 是一个 12 元商群:</>}
              en={<>The "free assembly space" / G is a 12-element quotient group:</>}
            />
            <TeXBlock src={`\\bigl(S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}\\bigr) \\,/\\, G \\;\\cong\\; \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />
            <L
              zh={<>每个商代表一种「拆装才能产生的状态」:角块多余的拧角 (ℤ/3)、棱块多余的翻面 (ℤ/2)、奇置换 (ℤ/2)。这就是为什么撬下来重装的魔方有 12 个不同的「平行宇宙」, 大多数无法用面转还原。</>}
              en={<>Each cell of the quotient is one "disassembly-only" anomaly: extra CO twist (ℤ/3), extra EO flip (ℤ/2), wrong parity (ℤ/2). That is precisely why a popped-and-rebuilt cube falls into one of 12 "parallel universes", most of which cannot be solved by face turns.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.4  守恒律即上同调约束" en="5.4  Conservation laws as cohomology constraints" />
        </h3>
        <p>
          <L
            zh={<>从更抽象的角度: 三个守恒律恰是把 「自由组装空间」 <TeX src={`F`} /> 看成一个 Abel 群扩张时, 第一群上同调 <TeX src={`H^1(G, \\mathbb{Z}/n)`} /> 给出的 「障碍类 (obstruction class)」。</>}
            en={<>From a more abstract angle: the three conservation laws are precisely the obstruction classes in the first group cohomology <TeX src={`H^1(G, \\mathbb{Z}/n)`} /> when viewing the "free assembly space" <TeX src={`F`} /> as an Abelian extension.</>}
          />
        </p>
        <TeXBlock src={`H^1\\bigl(G,\\, (\\mathbb{Z}/3)^8\\bigr) \\;\\supseteq\\; \\bigl\\{\\, \\textstyle\\sum c_o \\bmod 3 \\,\\bigr\\}, \\quad H^1\\bigl(G,\\, (\\mathbb{Z}/2)^{12}\\bigr) \\;\\supseteq\\; \\bigl\\{\\, \\textstyle\\sum e_o \\bmod 2 \\,\\bigr\\}`} />
        <p>
          <L
            zh={<>本节我们用纯组合验证, 但同一结论也可以由 「6 个生成元在 ℤ/3 上的求和给出 0 类」 这条上同调消失定理立刻得到。 这是为什么 「魔方守恒律」 与 「平面图染色 / 拓扑指数 / Stiefel–Whitney 类」 在数学上同源。</>}
            en={<>We verified things combinatorially, but the same conclusion drops out of the cohomology-vanishing statement "the six generators all sum to 0 in ℤ/3." This is why "cube invariants," "planar-graph colorings," "topological indices," and "Stiefel–Whitney classes" are siblings in the same abstract family.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.5  逐生成元验证表" en="5.5  Per-generator verification table" />
        </h3>
        <p>
          <L
            zh={<>三张表, 一目了然: 每个面转对应三个 「不变量增量」 都是 0 mod 对应模数。</>}
            en={<>Three tables — for each generator, all three invariant increments vanish modulo the relevant base.</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '生成元', en: 'Gen' })}</th><th><TeX src={`\\Delta(\\sum c_o) \\bmod 3`} /></th><th><TeX src={`\\Delta(\\sum e_o) \\bmod 2`} /></th><th><TeX src={`\\operatorname{sgn}(c_p) \\cdot \\operatorname{sgn}(e_p)`} /></th></tr>
          </thead>
          <tbody>
            <tr><td>U</td><td className="num">0</td><td className="num">0</td><td className="num">+1</td></tr>
            <tr><td>D</td><td className="num">0</td><td className="num">0</td><td className="num">+1</td></tr>
            <tr><td>R</td><td className="num">1+2+1+2 = 6 ≡ 0</td><td className="num">0</td><td className="num">(−1)(−1) = +1</td></tr>
            <tr><td>L</td><td className="num">6 ≡ 0</td><td className="num">0</td><td className="num">+1</td></tr>
            <tr><td>F</td><td className="num">6 ≡ 0</td><td className="num">4 ≡ 0</td><td className="num">+1</td></tr>
            <tr><td>B</td><td className="num">6 ≡ 0</td><td className="num">4 ≡ 0</td><td className="num">+1</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>每行都是 「这个面转保持该不变量」 的直接验证。 由 G 是生成元的乘积,所有元素都保持 — 这就是 §5.1–5.3 三个证明的「自动化」 版本。</>}
            en={<>Each row directly verifies "this face turn preserves the invariant." Since G is generated by the six face turns, every element does — an automated form of the proofs in §5.1–5.3.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §7 Order of an element ═════════════════════ */}
      <GTSec id="order-of-element" className="gt-sec">
        <div className="gt-sec-num">§7</div>
        <h2 className="gt-sec-title">
          <L zh="元素的阶" en="Order of an element" />
        </h2>
        <p>
          <L
            zh={<>对任何 <TeX src={`g \\in G`} />, 存在最小正整数 <TeX src={`n`} /> 使 <TeX src={`g^n = e`} />。 这个 <TeX src={`n`} /> 称为 <strong>g 的阶 (order)</strong>。 换句话说:不停重复同一公式, 多久回到原点?</>}
            en={<>For any <TeX src={`g \\in G`} />, there is a smallest positive integer <TeX src={`n`} /> with <TeX src={`g^n = e`} />. This <TeX src={`n`} /> is the <strong>order</strong> of <TeX src={`g`} />. Repeat the same alg until you come home — that count is its order.</>}
          />
        </p>
        <p>
          <L
            zh={<>一些有名的数字:<span className="gt-mono">R</span> 的阶是 4(简单),<span className="gt-mono">R U</span> 的阶却是 <strong>105</strong>(神奇),<span className="gt-mono">R U R' U'</span>(小鱼起手)的阶是 6。</>}
            en={<>Some famous orders: <span className="gt-mono">R</span> has order 4 (obvious), but <span className="gt-mono">R U</span> has order <strong>105</strong> (remarkable), and <span className="gt-mono">R U R' U'</span> (the "sexy move") has order 6.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 7.1 — Lagrange', en: 'Theorem 7.1 — Lagrange' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>每个元素的阶必须整除 |G|。 所以 <TeX src={`n \\,\\bigm|\\, 43{,}252{,}003{,}274{,}489{,}856{,}000`} />。 魔方群中实际出现的元素阶,最大是 <strong>1260</strong>(由两个不交圈乘出来的 LCM)。</>}
              en={<>Every element's order divides |G|. So <TeX src={`n \\,\\bigm|\\, 43{,}252{,}003{,}274{,}489{,}856{,}000`} />. The maximum order attained by any cube element is <strong>1260</strong> (the LCM of disjoint cycle lengths in optimal combination).</>}
            />
          </div>
        </div>
        <PeriodExplorer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="7.1  所有可能的阶" en="7.1  All attained orders" />
        </h3>
        <p>
          <L
            zh={<>G 中的元素阶必须整除 |G| = 2²⁷ · 3¹⁴ · 5³ · 7² · 11。这给出了 (27+1)(14+1)(3+1)(2+1)(1+1) = 28 · 15 · 4 · 3 · 2 = 10,080 个整除数。但 <em>实际可达</em> 的阶只有 <strong>73 个</strong>:</>}
            en={<>An element's order in G must divide |G| = 2²⁷ · 3¹⁴ · 5³ · 7² · 11. That allows (27+1)(14+1)(3+1)(2+1)(1+1) = 10,080 divisors. But only <strong>73</strong> are <em>actually attained</em> by elements of G:</>}
          />
        </p>
        <OrderDistribution />
        <p>
          <L
            zh={<>哪些阶达不到?例如 <TeX src={`|G|`} /> 本身 (<TeX src={`4.3 \\times 10^{19}`} />) 不可能是元素阶 — 因为这要求一个循环子群等于整个 G,而 G 不是循环群 (它非阿贝尔)。同样大部分大的整除数也达不到。</>}
            en={<>Which divisors are missed? For instance <TeX src={`|G|`} /> itself (<TeX src={`4.3 \\times 10^{19}`} />) cannot be an element's order — that would force a cyclic subgroup equal to G, but G is non-Abelian. Most large divisors are similarly out of reach.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="7.2  为什么 1260 是最大?" en="7.2  Why 1260 is the maximum" />
        </h3>
        <p>
          <L
            zh={<>找一个最大阶元素的方法:让角块部分形成一组合适的轮换,让棱块部分形成另一组,使两边周期的 LCM 最大化。具体地,需要:</>}
            en={<>To find a maximal-order element: arrange the corner part into a set of disjoint cycles, and the edge part likewise, maximising the LCM of their lengths. Specifically:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh="角块: 一个 5-循环 (考虑 CO,周期变 5 × LCM(co-sums))" en="Corners: a 5-cycle with internal CO summing to 1 mod 3 — local period 5 × 3 = 15" /></li>
          <li><L zh="棱块: 一个 7-循环 + 一个 5-cycle (考虑 EO,周期 lcm(7×2, 5))" en="Edges: a 7-cycle × a 5-cycle of edges with EO summing to 1 mod 2 — local period lcm(7, 4·2) ..." /></li>
          <li><L zh="总阶 = LCM(对应周期) = 4 · 9 · 5 · 7 = 1260" en="Total = LCM of the local periods = 2² · 3² · 5 · 7 = 1260" /></li>
        </ul>
        <p>
          <L
            zh={<>这个最大值最早由 J. Mathieu (1973) 类比对称群 S_n 的最大阶公式 (Landau 函数 g(n)) 确认。对 S_12 而言 g(12) = 60,但魔方加上 CO/EO 后变成 1260。</>}
            en={<>This maximum was first established by analogy with Landau's function g(n) (max order in S_n). Here g(12) = 60, but with the extra CO/EO structure on cubies the cube's maximum bumps up to 1260.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>这个阶的元素并不罕见 — 但难以一次性写出来。一个例子: <span className="gt-mono" style={{ fontSize: 11 }}>R U2 D' B D'</span> 有阶 1260。不信?<a href="/scramble/analyzer">用分析器自己跑一遍</a>。</>}
            en={<>Such elements are not rare, but hard to spot. Example: <span className="gt-mono" style={{ fontSize: 11 }}>R U2 D' B D'</span> has order 1260. Skeptical? <a href="/scramble/analyzer">Run it in the analyzer.</a></>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="7.3  Landau 函数与对称群比较" en="7.3  Landau's function & comparison with Sₙ" />
        </h3>
        <p>
          <L
            zh={<>对称群 <TeX src={`S_n`} /> 中元素阶的最大值由 <strong>Landau 函数</strong> <TeX src={`g(n)`} /> 给出:对 <TeX src={`n`} /> 的所有分拆 <TeX src={`n = \\lambda_1 + \\lambda_2 + \\cdots`} />,最大化 <TeX src={`\\operatorname{lcm}(\\lambda_1, \\lambda_2, \\ldots)`} />。 这是因为 <TeX src={`S_n`} /> 中元素由不交圈型决定, 阶 = 各圈长 lcm。</>}
            en={<>The maximum element order in the symmetric group <TeX src={`S_n`} /> is given by <strong>Landau's function</strong> <TeX src={`g(n)`} />: over all partitions <TeX src={`n = \\lambda_1 + \\lambda_2 + \\cdots`} />, maximise <TeX src={`\\operatorname{lcm}(\\lambda_1, \\lambda_2, \\ldots)`} />. Why: an element of <TeX src={`S_n`} /> is determined by its disjoint cycle type, and its order equals the lcm of cycle lengths.</>}
          />
        </p>
        <table className="gt-landau-tbl">
          <thead>
            <tr>
              <th>n</th>
              <th>g(n)</th>
              <th>{tr({ zh: '取到最大值的分拆', en: 'optimal partition' })}</th>
              <th>{tr({ zh: '魔方上的对应', en: 'cube analogue'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="num">5</td><td className="num">6</td><td>2 + 3</td><td>—</td></tr>
            <tr><td className="num">6</td><td className="num">6</td><td>1 + 2 + 3</td><td>—</td></tr>
            <tr><td className="num">7</td><td className="num">12</td><td>3 + 4</td><td>—</td></tr>
            <tr><td className="num">8</td><td className="num">15</td><td>3 + 5</td><td><L zh="角块部分 (8 角)" en="corner sector (8 corners)" /></td></tr>
            <tr><td className="num">9</td><td className="num">20</td><td>4 + 5</td><td>—</td></tr>
            <tr><td className="num">10</td><td className="num">30</td><td>2 + 3 + 5</td><td>—</td></tr>
            <tr><td className="num">11</td><td className="num">30</td><td>1 + 2 + 3 + 5</td><td>—</td></tr>
            <tr><td className="num">12</td><td className="num">60</td><td>3 + 4 + 5</td><td><L zh="棱块部分 (12 棱)" en="edge sector (12 edges)" /></td></tr>
            <tr><td className="num">13</td><td className="num">60</td><td>1 + 3 + 4 + 5</td><td>—</td></tr>
            <tr><td className="num">14</td><td className="num">84</td><td>2 + 3 + 4 + 5 / 3 + 4 + 7</td><td>—</td></tr>
            <tr><td className="num">15</td><td className="num">105</td><td>3 + 5 + 7</td><td>—</td></tr>
            <tr><td className="num">20</td><td className="num">420</td><td>3 + 4 + 5 + 7 + 1</td><td>—</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>角块部分 (<TeX src={`S_8 \\ltimes (\\mathbb{Z}/3)^7`} />) 上限阶 <TeX src={`= 3 \\cdot g(8) = 3 \\cdot 15 = 45`} />,但魔方加了 「角扭和守恒 mod 3」,只允许 <TeX src={`\\text{lcm}(\\text{角圈长}) \\cdot 3`} /> 的形式; 棱块部分上限阶 <TeX src={`= 2 \\cdot g(12) / k`} /> (k 跟翻面奇偶有关)。 两边联合在角棱奇偶共生条件下取最大 LCM, 得 <strong>1260</strong>。</>}
            en={<>The corner sector (<TeX src={`S_8 \\ltimes (\\mathbb{Z}/3)^7`} />) maxes at <TeX src={`3 \\cdot g(8) = 3 \\cdot 15 = 45`} />, but the cube's "Σco ≡ 0 mod 3" constraint forces orders into the form <TeX src={`\\operatorname{lcm}(\\text{corner cycles}) \\cdot 3`} />. The edge sector maxes at <TeX src={`2 \\cdot g(12) / k`} /> (k depends on the parity of EO). Combining both under the parity-coupling constraint yields the maximum <strong>1260</strong>.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="7.4  73 个可达阶 — 完整清单" en="7.4  All 73 attained orders" />
        </h3>
        <p>
          <L
            zh={<>下面 73 个数是 G 中 <em>实际出现</em> 的所有元素阶,从小到大列出。 注意每个都整除 <TeX src={`|G| = 2^{27} \\cdot 3^{14} \\cdot 5^3 \\cdot 7^2 \\cdot 11`} />;不出现的整除数 (比如 4096) 都被 CO/EO 守恒约束排除掉了。</>}
            en={<>The following 73 integers are <em>all</em> attained element orders in G, sorted ascending. Every entry divides <TeX src={`|G| = 2^{27} \\cdot 3^{14} \\cdot 5^3 \\cdot 7^2 \\cdot 11`} />; divisors that do not appear (e.g. 4096) are ruled out by the CO/EO conservation laws.</>}
          />
        </p>
        <div className="gt-orders-grid">
          {[1,2,3,4,5,6,7,8,9,10,11,12,14,15,18,20,21,22,24,28,30,33,35,36,40,42,44,45,55,56,60,63,66,70,72,77,84,90,99,105,110,112,120,126,132,140,144,154,165,168,180,198,210,231,240,252,280,315,330,336,360,420,440,462,495,504,630,720,770,840,990,1260].map((n, i) => (
            <div key={i} className={`gt-order-chip${n === 1260 ? ' gt-order-chip-max' : ''}${n === 1 ? ' gt-order-chip-id' : ''}`}>{n}</div>
          ))}
        </div>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>分布特征:小阶 (1–12) 几乎全连续;13、 16、 17、 19、 23、 25、 26、 27、 29… 全部 <em>不可达</em> (素数 13、17、19、23 不整除 |G|;16、25 等被守恒限制)。 大阶集中在 <TeX src={`2^a \\cdot 3^b \\cdot 5 \\cdot 7`} /> 的乘积上, 1260 = 2² · 3² · 5 · 7 是顶点。</>}
            en={<>Pattern: small orders (1–12) appear almost without gaps; 13, 16, 17, 19, 23, 25, 26, 27, 29… are all <em>missing</em> (primes 13, 17, 19, 23 don't divide |G|; 16 and 25 are blocked by CO/EO conservation). Large orders concentrate at products of the form <TeX src={`2^a \\cdot 3^b \\cdot 5 \\cdot 7`} />, peaking at 1260 = 2² · 3² · 5 · 7.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §8 Conjugation ══════════════════════════════ */}
      <GTSec id="conjugation" className="gt-sec">
        <div className="gt-sec-num">§8</div>
        <h2 className="gt-sec-title">
          <L zh="共轭 — 把操作搬到别的位置" en="Conjugation — relocating operations" />
        </h2>
        <p>
          <L
            zh={<>已知一招 <TeX src={`B`} /> 能搞定 <em>某一块</em>,但你想让它作用在 <em>别的位置</em>。 最优雅的办法是 <strong>共轭</strong>:</>}
            en={<>You know an alg <TeX src={`B`} /> that fixes <em>this</em> spot, but the piece you want is <em>there</em>. The elegant fix is <strong>conjugation</strong>:</>}
          />
        </p>
        <TeXBlock src={`A \\, B \\, A^{-1}`} />
        <p>
          <L
            zh={<>先用 <TeX src={`A`} /> 把目标块「带过来」, 执行 <TeX src={`B`} /> (B 作用在它熟悉的位置), 再 <TeX src={`A^{-1}`} /> 把所有别的东西放回原位 —— 但被 B 改过的部分被「带回去」到 A 之前对应的另一个位置。 这是高级解法 (BLD, FMC, ZBLL setup) 的核心技巧。</>}
            en={<>First <TeX src={`A`} /> "brings" the target piece to where B works. Then <TeX src={`B`} /> acts in its native location. Finally <TeX src={`A^{-1}`} /> puts everything else back — but the part B touched gets carried <em>back</em> to where it really wanted to go. This is the bread and butter of advanced solving (BLD, FMC, ZBLL setups).</>}
          />
        </p>
        <ConjugateViewer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="8.1  共轭画廊 — 同一个 B 用不同 A 搬到不同位置" en="8.1  Conjugation gallery — same B relocated by different A's" />
        </h3>
        <p>
          <L
            zh={<>四个共轭例子。每行展示 A → A·B → A·B·A⁻¹ 三步,你能看到 B 的「净效应」如何被 A 重定位。</>}
            en={<>Four conjugation examples. Each row shows the three steps A → A·B → A·B·A⁻¹, illustrating how A relocates B's net effect.</>}
          />
        </p>
        <ConjugationGallery />
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '共轭与「同态阶」', en: 'Conjugation preserves order'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>共轭操作满足: <TeX src={`(aba^{-1})^n = a \\cdot b^n \\cdot a^{-1}`} />。 所以 b 和 <TeX src={`aba^{-1}`} /> 阶相同。 在魔方上的意义:你可以把任意操作搬到任何「等价位置」上, 它的次数、 还原性、 所有内在性质都不变。</>}
              en={<>Conjugation respects powers: <TeX src={`(aba^{-1})^n = a \\cdot b^n \\cdot a^{-1}`} />. So b and <TeX src={`aba^{-1}`} /> share the same order. On the cube: you can relocate any operation (a PLL, an F2L insertion, a commutator) to an equivalent location — its order and all internal properties are preserved.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="8.2  共轭类" en="8.2  Conjugacy classes" />
        </h3>
        <p>
          <L
            zh={<>所有彼此共轭的元素组成一个 <strong>共轭类</strong>。同一个共轭类内的元素在 G 内部「形状相同」 —— 它们的阶相同、循环型相同、操作的「拓扑效果」相同。两个魔方状态如果共轭,那它们解起来本质上是同一个问题,只是「视角不同」。</>}
            en={<>Elements that are conjugate to each other form a <strong>conjugacy class</strong>. All elements within a class share the same order, the same cycle type, and the same "topological action" — only the viewpoint differs. Two cube states in the same conjugacy class are essentially the same problem.</>}
          />
        </p>
        <p>
          <L
            zh={<>G 的共轭类数共有约 81,120 个 (基于 Burnside lemma 在魔方对称群下的精确化)。每个共轭类对应一种「魔方状态的形态」,这是基本组合学事实。Rokicki 的上帝之数证明 (§11) 正是利用了这些对称等价类把 4.3 × 10¹⁹ 状态归约到约 20 亿个等价类来处理。</>}
            en={<>G has about 81,120 conjugacy classes (refined by Burnside's lemma under the cube's symmetry group). Each class is one "shape" of cube state. Rokicki's God's-number proof (§11) exploits exactly this structure to compress 4.3 × 10¹⁹ states to roughly 2 billion symmetry-equivalence classes.</>}
          />
        </p>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>同共轭类元素的「循环型」(cycle type) 完全相同。下表列出几个常见公式的循环型 — 注意 superflip 在角块上是恒等、棱块上也是恒等 (它只翻 EO,不动位置),所以它在共轭类「e (no perm)」 — 跟身份置换是同类,但靠 EO 区分。</>}
            en={<>Conjugate elements share the same cycle type. The table lists cycle types of a few common algs — note that superflip has identity perm on both corners and edges (it only flips EO without moving anything). Its "perm" cycle type is empty, the same as identity — they are distinguished only by orientation data.</>}
          />
        </p>
        <ConjugacyClassTable />
        <div className="gt-aside">
          <L
            zh={<>魔方还有 48 个外部对称变换 (24 个旋转 × 2 个镜像)。Burnside lemma 在 G 与对称群联合作用下计算「真正不同的」状态数,这是更精细的等价化。详 §18。</>}
            en={<>The cube also has 48 outer symmetries (24 rotations × 2 mirror reflections). Burnside's lemma applied jointly with G gives the count of "truly distinct" states up to symmetry — see §18.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="8.3  共轭类大小 — 轨道–稳定子定理" en="8.3  Conjugacy-class size — orbit–stabilizer" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 8.3 — 中心化子', en: 'Definition 8.3 — centralizer'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>给定 <TeX src={`g \\in G`} />,中心化子 <TeX src={`C_G(g) := \\{\\, x \\in G \\;:\\; xg = gx\\,\\}`} /> 是 <em>与 g 交换的所有元素</em> 构成的子群。 它度量 g 在 G 中「跟谁交换得起来」。</>}
              en={<>For <TeX src={`g \\in G`} />, its centralizer <TeX src={`C_G(g) := \\{\\, x \\in G \\;:\\; xg = gx\\,\\}`} /> is the subgroup of elements <em>that commute with g</em>. It measures how much of G commutes with g.</>}
            />
          </div>
        </div>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 8.4 — 轨道–稳定子', en: 'Theorem 8.4 — orbit–stabilizer'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>g 所在共轭类 <TeX src={`[g] := \\{\\,xgx^{-1} \\;:\\; x \\in G\\,\\}`} /> 的大小满足<TeXBlock src={`|[g]| \\;=\\; \\frac{|G|}{|C_G(g)|}`} />即「轨道大小 × 稳定子大小 = G 的阶」。 因此 <TeX src={`|[g]|`} /> 必整除 <TeX src={`|G|`} />。</>}
              en={<>The size of g's conjugacy class <TeX src={`[g] := \\{\\,xgx^{-1} \\;:\\; x \\in G\\,\\}`} /> satisfies<TeXBlock src={`|[g]| \\;=\\; \\frac{|G|}{|C_G(g)|}`} />i.e. "orbit size × stabilizer size = |G|". Hence <TeX src={`|[g]|`} /> divides <TeX src={`|G|`} />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个公式把「共轭类有多大」翻译成「g 跟多少元素交换」。 极端情况:</>}
            en={<>This formula translates "how big is the conjugacy class" into "how many elements commute with g." Extremes:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>中心元素</strong> (z ∈ Z(G)):跟所有元素都交换,<TeX src={`C_G(z) = G`} />,所以 <TeX src={`|[z]| = 1`} />。 它独占一个共轭类。 魔方上 <TeX src={`Z(G) = \\{e,\\,\\textsc{superflip}\\}`} /> (见 §13),所以恰好 <strong>2 个 size-1 类</strong>。</>} en={<><strong>Central elements</strong> (z ∈ Z(G)) commute with everything: <TeX src={`C_G(z) = G`} />, so <TeX src={`|[z]| = 1`} />. Each owns a singleton class. For the cube, <TeX src={`Z(G) = \\{e,\\,\\textsc{superflip}\\}`} /> (see §13), giving exactly <strong>two size-1 classes</strong>.</>} /></li>
          <li><L zh={<><strong>「最不平凡」元素</strong>:仅与 ⟨g⟩ 自身交换,<TeX src={`|C_G(g)| = \\operatorname{ord}(g)`} />,所以共轭类大小 <TeX src={`|[g]| = |G| / \\operatorname{ord}(g)`} />。 对 |g| = 1260 (最大阶) 的元素,<TeX src={`|[g]| \\le 4.3\\times10^{19}/1260 \\approx 3.4\\times10^{16}`} />。</>} en={<><strong>"Most non-trivial" elements</strong>: commute only with ⟨g⟩ itself, <TeX src={`|C_G(g)| = \\operatorname{ord}(g)`} />, so the class size is <TeX src={`|[g]| = |G| / \\operatorname{ord}(g)`} />. For order-1260 elements, <TeX src={`|[g]| \\le 4.3\\times10^{19}/1260 \\approx 3.4\\times10^{16}`} />.</>} /></li>
        </ul>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '类方程 (class equation)', en: 'The class equation'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>把 G 按共轭类分解,得<TeXBlock src={`|G| \\;=\\; |Z(G)| \\;+\\; \\sum_{[g]\\,\\not\\subset\\,Z(G)} \\frac{|G|}{|C_G(g)|}`} />前一项是中心 (大小 1 的类), 后面是大小 ≥ 2 的类。 这是有限群论里最深的恒等式之一: 它把 |G| 的素因子结构、 中心、 与「非平凡共轭」 三者绑在同一行。</>}
              en={<>Decomposing G into conjugacy classes gives<TeXBlock src={`|G| \\;=\\; |Z(G)| \\;+\\; \\sum_{[g]\\,\\not\\subset\\,Z(G)} \\frac{|G|}{|C_G(g)|}`} />where the first term counts central elements (size-1 classes) and the rest are larger classes. This is one of the deepest identities in finite group theory: it ties together the prime structure of |G|, the centre, and the non-trivial conjugation orbits in one line.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方:<TeX src={`|Z(G)| = 2`} />,共轭类总数 ≈ 81,120 (Burnside 在镜对称作用下),因此<em>平均</em> 类大小 ≈ <TeX src={`|G| / 81{,}120 \\approx 5.3 \\times 10^{14}`} />。 但实际分布极不均匀: 少数大类 (随机 scramble 状态) 几乎独吞 |G|, 而很多类却只有几百个元素。</>}
            en={<>For the cube, <TeX src={`|Z(G)| = 2`} /> and the total number of conjugacy classes is ≈ 81,120 (under joint Burnside with mirror symmetries), giving an <em>average</em> class size of <TeX src={`|G| / 81{,}120 \\approx 5.3 \\times 10^{14}`} />. But the actual distribution is extremely uneven: a few huge classes (typical scrambles) account for almost all of |G|, while many small classes contain only hundreds of elements.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §9 Commutators ══════════════════════════════ */}
      <GTSec id="commutators" className="gt-sec">
        <div className="gt-sec-num">§9</div>
        <h2 className="gt-sec-title">
          <L zh="换位子 [A, B] — 高级解法的灵魂" en="Commutators [A, B] — the soul of advanced solving" />
        </h2>
        <p>
          <L
            zh={<>对两个操作 <TeX src={`A, B`} />,我们定义它们的 <strong>换位子</strong> 为:</>}
            en={<>For two operations <TeX src={`A, B`} />, their <strong>commutator</strong> is defined as:</>}
          />
        </p>
        <TeXBlock src={`[A, B] \\;:=\\; A \\cdot B \\cdot A^{-1} \\cdot B^{-1}`} />
        <p>
          <L
            zh={<>如果 <TeX src={`A`} /> 和 <TeX src={`B`} /> 互换 (<TeX src={`AB = BA`} />),那么 <TeX src={`[A, B] = e`} />。 所以换位子衡量「A 和 B 互不交换的程度」。 在阿贝尔群里所有换位子都是单位元 —— 魔方群当然不是。</>}
            en={<>If <TeX src={`A`} /> and <TeX src={`B`} /> commute, <TeX src={`[A, B] = e`} />. The commutator measures how far they fail to commute. In an Abelian group all commutators are trivial — but the cube group is decisively non-Abelian.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '为什么换位子如此有用?', en: 'Why commutators are so powerful'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>当 <TeX src={`A`} /> 和 <TeX src={`B`} /> 的「影响区域」 <em>大体不重叠</em> 但 <em>有一处接触</em> 时, 换位子 <TeX src={`[A, B]`} /> 把接触点附近一两个块循环, 其他全部完整保留。 这就是 <strong>3-循环</strong>:盲拧、 还原 (FMC) 的核心积木。<br /><br />例如 <TeX src={`[R\\, U\\, R',\\, D]`} /> 是个干净的 3-循环棱块。 从 <TeX src={`8! \\cdot 12! \\cdot 3^8 \\cdot 2^{12}`} /> 这么大的群中, 提取出只动 3 个块的操作 —— 这是换位子做到的近乎魔法般的事。</>}
              en={<>When <TeX src={`A`} /> and <TeX src={`B`} /> <em>nearly</em> overlap — affecting mostly disjoint pieces but sharing one or two — <TeX src={`[A, B]`} /> cycles those few pieces while leaving everything else untouched. This is the <strong>3-cycle</strong>: the elementary atom of blindsolving and FMC.<br /><br />For example, <TeX src={`[R\\, U\\, R',\\, D]`} /> is a clean edge 3-cycle. Extracting an operation that moves only 3 pieces out of a group of size <TeX src={`8! \\cdot 12! \\cdot 3^8 \\cdot 2^{12}`} /> is the near-magical thing commutators do.</>}
            />
          </div>
        </div>
        <CommutatorViewer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.1  换位子原子库" en="9.1  Commutator atom library" />
        </h3>
        <p>
          <L
            zh={<>下面是 4 个典型「3-循环换位子」 —— 都只动 3 个魔方件。盲拧选手把它们当字母表用,任何状态都可由这种 3-循环序列还原。</>}
            en={<>Four typical 3-cycle commutators — each moves exactly 3 cubies. Blindsolvers treat them as an alphabet: any state can be reduced to a sequence of 3-cycles.</>}
          />
        </p>
        <CommutatorAtoms />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.2  换位子子群 [G, G]" en="9.2  The commutator subgroup [G, G]" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 9.1', en: 'Definition 9.1'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>群 <TeX src={`G`} /> 的 <strong>换位子子群</strong>(又叫 <em>derived subgroup</em>)是:</>}
              en={<>The <strong>commutator subgroup</strong> (also called <em>derived subgroup</em>) of G is:</>}
            />
            <TeXBlock src={`[G, G] \\;=\\; \\langle\\, \\{\\, [a, b] : a, b \\in G \\,\\} \\,\\rangle`} />
            <L
              zh={<>由所有换位子生成的子群。 商群 <TeX src={`G / [G, G]`} /> 是 G 「最大的阿贝尔商」 — 把所有非阿贝尔性都抹去后剩下的部分。</>}
              en={<>The subgroup generated by all commutators. The quotient <TeX src={`G / [G, G]`} /> is G's <em>largest Abelian quotient</em> — what remains after stripping out all non-commutativity.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方群: <TeX src={`G / [G, G] \\cong \\mathbb{Z}/2`} />。 这告诉我们 G 的 <em>非阿贝尔性几乎是「全部」</em> —— 唯一的阿贝尔信息是「角棱奇偶性」(一个 <TeX src={`\\mathbb{Z}/2`} /> 比特)。 换言之, <TeX src={`[G, G]`} /> 本身阶为 <TeX src={`|G| / 2 \\approx 2.16 \\times 10^{19}`} />。</>}
            en={<>For the cube group: <TeX src={`G / [G, G] \\cong \\mathbb{Z}/2`} />. This means G's <em>non-Abelian structure is almost everything</em> — the only Abelian information is the parity bit. Equivalently, <TeX src={`[G, G]`} /> itself has order <TeX src={`|G| / 2 \\approx 2.16 \\times 10^{19}`} />.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '推论 9.2', en: 'Corollary 9.2'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>偶置换 (sgn = +1) 的所有魔方状态恰好等于 [G, G]。所以 <strong>任何偶置换状态都能写成换位子的有限乘积</strong>。这就是为什么换位子语言对盲拧如此核心 —— 它把所有「无奇偶问题」的状态都拆解为基本积木。</>}
              en={<>The set of all even-parity states (sgn = +1) equals [G, G]. So <strong>every parity-correct state can be written as a finite product of commutators</strong>. This is precisely why the commutator language is so central to blindsolving: it decomposes every reasonable state into elementary atoms.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.3  换位子与「中心」" en="9.3  Commutators and the centre" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 9.3 — 中心', en: 'Definition 9.3 — centre'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>群的 <strong>中心</strong>:<TeXBlock src={`Z(G) \\;=\\; \\{\\, z \\in G \\;:\\; zg = gz \\;\\forall\\, g \\in G \\,\\}.`} />即跟所有元素都交换的子集。</>}
              en={<>The <strong>centre</strong> of a group:<TeXBlock src={`Z(G) \\;=\\; \\{\\, z \\in G \\;:\\; zg = gz \\;\\forall\\, g \\in G \\,\\}.`} />The elements that commute with everything.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对阿贝尔群: <TeX src={`Z(G) = G`} />。 对极端非阿贝尔群: <TeX src={`Z(G) = \\{e\\}`} /> (只有单位元)。</>}
            en={<>For Abelian groups: <TeX src={`Z(G) = G`} />. For sharply non-Abelian groups: <TeX src={`Z(G) = \\{e\\}`} /> only.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 9.4', en: 'Theorem 9.4' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>魔方群的中心 <TeX src={`Z(G) = \\{e,\\,\\text{superflip}\\}`} />, 阶为 2。 即 <strong>仅有 superflip 和 identity 跟所有面转都交换</strong>。 superflip 是「12 个棱全翻」那个状态, 它本身是阶 2 元素。</>}
              en={<>The cube group's centre is <TeX src={`Z(G) = \\{e,\\,\\text{superflip}\\}`} />, of order 2. Only the identity and superflip commute with every face turn.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个事实有点不可思议:在 4.3 × 10¹⁹ 个状态里,只有 <strong>两个</strong> 状态跟所有人都「和气共处」, 而其中之一是大家熟悉的 superflip(也是著名的 20 步极限状态之一)。</>}
            en={<>This is a striking fact: among 4.3 × 10¹⁹ states, exactly <strong>two</strong> commute with all face turns — one being the celebrated superflip (also among the famous 20-step extremal positions).</>}
          />
        </p>
        <CentreVerifier />
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '为什么 Z(G) 只有 2 个元素?', en: 'Why |Z(G)| = 2'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>设 <TeX src={`g \\in Z(G)`} />。 则 g 跟每个面转都交换 ⇔ g 在 cube symmetry group 下不变 ⇔ g 在 48 个外部对称下也不变 (因为 G 由面转生成, 且面转生成的对称变换闭包 = 整个外部对称群)。</p>
              <p style={{ margin: '0 0 12px' }}>反过来, 任何「在 48 个外部对称下不变」的 G 元素必须满足: 角块循环型和棱块循环型均「自共轭于自身」。这只允许两种状态:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li>cp = identity, co = 0, ep = identity, eo = 0 → 单位元 e</li>
                <li>cp = identity, co = 0, ep = identity, eo = (1, 1, …, 1) → superflip</li>
              </ul>
              <p style={{ margin: '0 0 0' }}>因此 Z(G) = {`{e, superflip}`}, |Z(G)| = 2。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Let g ∈ Z(G). Then g commutes with every face turn ⇔ g is invariant under conjugation by the symmetry group generated by face turns ⇔ g is invariant under all 48 outer cube symmetries (since face turns generate the full symmetry closure).</p>
              <p style={{ margin: '0 0 12px' }}>Conversely, any element of G fixed under all 48 outer symmetries must have a cycle type that is "self-symmetric" under all those rotations and reflections. This allows only two states:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li>cp = identity, co = 0, ep = identity, eo = 0 — the identity e</li>
                <li>cp = identity, co = 0, ep = identity, eo = (1, 1, …, 1) — superflip</li>
              </ul>
              <p style={{ margin: '0 0 0' }}>So Z(G) = {`{e, superflip}`} and |Z(G)| = 2.</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.4  Hall–Witt 恒等式" en="9.4  The Hall–Witt identity" />
        </h3>
        <p>
          <L
            zh={<>换位子之间有一个非平凡的代数关系, 类似李代数的 Jacobi 恒等式。 设 <TeX src={`a^b := b^{-1} a b`} /> 表共轭:</>}
            en={<>Commutators satisfy a nontrivial algebraic relation analogous to the Jacobi identity for Lie algebras. Write <TeX src={`a^b := b^{-1} a b`} /> for conjugation:</>}
          />
        </p>
        <TeXBlock src={`\\bigl[[a, b^{-1}], c\\bigr]^{b} \\cdot \\bigl[[b, c^{-1}], a\\bigr]^{c} \\cdot \\bigl[[c, a^{-1}], b\\bigr]^{a} \\;=\\; e`} />
        <p>
          <L
            zh={<>这是 Philip Hall 与 Ernst Witt 在 1930s 各自证明的恒等式。 它说: 「三次嵌套的换位子在循环置换 a → b → c → a 下相乘为单位元」。 对魔方,任取 a = R、b = U、c = F,这个恒等式自动成立 — 给出一个 18-token 长的 alg 必然等于 e (虽然它通常不简化为可读的形式)。</>}
            en={<>Independently proven by Philip Hall and Ernst Witt in the 1930s. It says "three nested commutators, cycled a → b → c → a, multiply to the identity." For the cube, plug a = R, b = U, c = F: the identity holds automatically, giving an 18-token alg that necessarily equals e (though typically without a clean reduction).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.5  Derived series — [G, G] 之后是什么?" en="9.5  Derived series — what's after [G, G]?" />
        </h3>
        <p>
          <L
            zh={<>定义 <strong>derived series</strong>: <TeX src={`G^{(0)} = G`} />, <TeX src={`G^{(k+1)} = [G^{(k)}, G^{(k)}]`} />。 它给出一条递降链 <TeX src={`G \\supseteq G' \\supseteq G'' \\supseteq \\cdots`} />。 一个群叫 <strong>可解</strong> 若这条链有限地达到 <TeX src={`\\{e\\}`} />。</>}
            en={<>Define the <strong>derived series</strong>: <TeX src={`G^{(0)} = G`} />, <TeX src={`G^{(k+1)} = [G^{(k)}, G^{(k)}]`} />, giving a descending chain <TeX src={`G \\supseteq G' \\supseteq G'' \\supseteq \\cdots`} />. A group is <strong>solvable</strong> if this chain reaches <TeX src={`\\{e\\}`} /> in finitely many steps.</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '层', en: 'Term'
            })}</th><th>{tr({ zh: '定义', en: 'Definition'
            })}</th><th>{tr({ zh: '阶 (魔方)', en: 'Cube order'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td><TeX src={`G^{(0)} = G`} /></td><td>{tr({ zh: '魔方群', en: 'cube group' })}</td><td className="num">4.33 × 10¹⁹</td></tr>
            <tr><td><TeX src={`G^{(1)} = [G, G]`} /></td><td>{tr({ zh: '偶置换状态', en: 'even-parity states'
            })}</td><td className="num">|G|/2 ≈ 2.16 × 10¹⁹</td></tr>
            <tr><td><TeX src={`G^{(2)} = [G', G']`} /></td><td>{tr({ zh: 'CO+EO=0 的偶状态 (A₈ × A₁₂ 投影)', en: 'even states with CO=EO=0 (A₈ × A₁₂ projection)'
            })}</td><td className="num">≈ 9.65 × 10¹⁵</td></tr>
            <tr><td><TeX src={`G^{(3)}`} /></td><td>{tr({ zh: 'A₈ 与 A₁₂ 各自的换位子子群 (它们是单群,自换位 = 自身)', en: 'commutator subgroups of A₈ and A₁₂ — both simple, so equal themselves'
            })}</td><td className="num">≈ 9.65 × 10¹⁵</td></tr>
            <tr><td><TeX src={`G^{(k)}, k \\geq 3`} /></td><td>{tr({ zh: '不再下降', en: 'stabilises (no further descent)' })}</td><td className="num">≈ 9.65 × 10¹⁵</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>因为 A₈ 和 A₁₂ 都是单非 Abel 群 (Jordan 1875), 它们都满足 <TeX src={`[A_n, A_n] = A_n`} /> (n ≥ 5)。 derived series 在 <TeX src={`G^{(2)}`} /> 后稳定, 所以<strong>魔方群不是可解群</strong>。 这个事实非平凡: 它意味着无法用 「迭代换位子打到 0」 的方式构造一个 「单 Abelian 步」 的求解器 — 必须依靠 §10 的多阶段子群链或 §22 的全局搜索。</>}
            en={<>Since A₈ and A₁₂ are simple non-Abelian groups (Jordan 1875), <TeX src={`[A_n, A_n] = A_n`} /> for n ≥ 5. The derived series stabilises at <TeX src={`G^{(2)}`} />, so <strong>the cube group is not solvable</strong>. This is significant: there is no "iteratively kill the commutator" path to a one-stage Abelian solver — one must invoke the §10 subgroup chain or the §22 global search.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.6  Lower central series 与 nilpotent" en="9.6  Lower central series & nilpotency" />
        </h3>
        <p>
          <L
            zh={<>另一条相关的链是 <strong>lower central series</strong>: <TeX src={`\\gamma_1(G) = G`} />, <TeX src={`\\gamma_{k+1}(G) = [G, \\gamma_k(G)]`} />。 一个群叫 <strong>nilpotent</strong> 若这条链有限地达到 <TeX src={`\\{e\\}`} />。 nilpotent ⇒ solvable, 但反之不然。</>}
            en={<>The <strong>lower central series</strong>: <TeX src={`\\gamma_1(G) = G`} />, <TeX src={`\\gamma_{k+1}(G) = [G, \\gamma_k(G)]`} />. A group is <strong>nilpotent</strong> if this chain reaches <TeX src={`\\{e\\}`} /> in finitely many steps. Nilpotent ⇒ solvable, but not conversely.</>}
          />
        </p>
        <p>
          <L
            zh={<>魔方群 <strong>不是 nilpotent</strong>: 由 9.5 它甚至不是可解,更不可能 nilpotent。 直观地看: nilpotent 群 「换位子塔」 越爬越扁;而 G 的 lower central series 在 <TeX src={`\\gamma_2 = [G,G]`} /> 之后基本不再下降 (因为商投影到 A₈ × A₁₂)。 nilpotent 群最典型的例子是有限 p-群; 魔方群因为同时含 ℤ/3 和 ℤ/2 块,以及 A_n 的非可解部分, 跟 p-群相去甚远。</>}
            en={<>The cube group is <strong>not nilpotent</strong>: by 9.5 it is not even solvable, let alone nilpotent. Intuitively, nilpotent groups have a "commutator tower" that flattens out; the cube's lower central series barely descends past <TeX src={`\\gamma_2 = [G,G]`} /> because the quotient sits in A₈ × A₁₂. The archetypal nilpotent groups are finite p-groups — and G, mixing ℤ/3, ℤ/2 blocks with a non-solvable A_n core, is the opposite of a p-group.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §10 Thistlethwaite ══════════════════════════ */}
      <GTSec id="thistlethwaite" className="gt-sec">
        <div className="gt-sec-num">§10</div>
        <h2 className="gt-sec-title">
          <L zh="子群链 — Thistlethwaite 的解法" en="Subgroup chain — Thistlethwaite's solver" />
        </h2>
        <p>
          <L
            zh={<>1981 年,数学家 Morwen Thistlethwaite 发现:与其试图直接还原 G,不如把它拆成 <strong>4 个嵌套子群</strong>,每一步只解决一个「难题」:</>}
            en={<>In 1981, the mathematician Morwen Thistlethwaite realised: rather than directly solving G, decompose it into a chain of <strong>four nested subgroups</strong>, each phase solving one constraint at a time:</>}
          />
        </p>
        <div className="gt-sgc">
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name">G₀</div>
            <div className="gt-sgc-gens">⟨U, D, L, R, F, B⟩</div>
            <div className="gt-sgc-size">|G| = 4.3 × 10¹⁹</div>
            <span className="gt-sgc-arrow">⊃</span>
          </div>
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name">G₁</div>
            <div className="gt-sgc-gens">⟨U, D, L, R, F2, B2⟩</div>
            <div className="gt-sgc-size">[G:G₁] = 2¹¹</div>
            <span className="gt-sgc-arrow">⊃</span>
          </div>
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name">G₂</div>
            <div className="gt-sgc-gens">⟨U, D, L2, R2, F2, B2⟩</div>
            <div className="gt-sgc-size">[G₁:G₂] = 1,082,565</div>
            <span className="gt-sgc-arrow">⊃</span>
          </div>
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name">G₃</div>
            <div className="gt-sgc-gens">⟨U2, D2, L2, R2, F2, B2⟩</div>
            <div className="gt-sgc-size">[G₂:G₃] = 29,400</div>
            <span className="gt-sgc-arrow">⊃</span>
          </div>
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name" style={{ fontSize: 18 }}>G₄ = {'{e}'}</div>
            <div className="gt-sgc-gens">⟨⟩</div>
            <div className="gt-sgc-size">[G₃:G₄] = 663,552</div>
          </div>
        </div>
        <p>
          <L
            zh={<>每一阶都对应一个「打补丁」:<br />
              <strong>G → G₁</strong>:修棱块朝向 (EO=0)。<br />
              <strong>G₁ → G₂</strong>:修角块朝向 (CO=0) 并把 UD 切片棱块归位。<br />
              <strong>G₂ → G₃</strong>:把角块和棱块各自归到 4-轨道里 (减少剩余偶置换)。<br />
              <strong>G₃ → G₄</strong>:仅用半圈完成。
            </>}
            en={<>Each step "patches" one defect:<br />
              <strong>G → G₁</strong>: orient edges (EO = 0).<br />
              <strong>G₁ → G₂</strong>: orient corners (CO = 0) and bring UD-slice edges home.<br />
              <strong>G₂ → G₃</strong>: corners and edges in their G₃-orbits.<br />
              <strong>G₃ → G₄</strong>: finish using only half-turns.
            </>}
          />
        </p>
        <p>
          <L
            zh={<>Thistlethwaite 当年算出每阶最多 7 / 13 / 15 / 17 步, 加起来 <strong>52 步</strong> 必能还原任何状态。后来 Kociemba 把它精简为只用 2 阶: G → G₁ → {'{e}'},每阶最多 12 步, 上界 <strong>24 步</strong> —— 这就是 <em>two-phase</em> solver,至今每个有名的快速求解器都基于它。</>}
            en={<>Thistlethwaite originally bounded each phase at 7 / 13 / 15 / 17 moves, totalling <strong>52 moves</strong> for any state. Kociemba later collapsed this into a 2-phase chain G → G₁ → {'{e}'}, each phase ≤ 12 moves, total ≤ <strong>24</strong>. This is the famous <em>two-phase algorithm</em> behind every modern fast solver.</>}
          />
        </p>
        <SubgroupClimber />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.1  各级商群大小" en="10.1  Sizes of the quotients" />
        </h3>
        <p>
          <L
            zh={<>Thistlethwaite 链中, 每一级 <TeX src={`[G_i : G_{i+1}]`} /> 就是「这一阶段需要查表的状态数」。 这些数直接决定了 solver 的内存开销:</>}
            en={<>Each Thistlethwaite step's quotient size <TeX src={`[G_i : G_{i+1}]`} /> equals the number of states to look up at that phase. These numbers directly drive a solver's memory footprint:</>}
          />
        </p>
        <QuotientChart />
        <p>
          <L
            zh={<>Kociemba 把这 4 阶合并为 2 阶: G → G_1 → {`{e}`}, 商大小分别是 2 × 10⁹ 和 1.95 × 10¹⁰。这两个查表 (pruning tables) 共占用约 100 MB 内存, 但能在毫秒内求解任何状态 (typically 24 步以内)。每个魔方应用 (Cube Explorer, csTimer 内置 solver) 都在背后使用这套结构。</>}
            en={<>Kociemba consolidated this 4-phase chain into a 2-phase one: G → G_1 → {`{e}`}, with quotient sizes 2 × 10⁹ and 1.95 × 10¹⁰. The two pruning tables fit in ~100 MB, and solve any state in milliseconds (typically ≤ 24 moves). Every cube app (Cube Explorer, csTimer's built-in solver, ...) is powered by this structure.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.2  陪集 (Cosets)" en="10.2  Cosets" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 10.1', en: 'Definition 10.1'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>设 <TeX src={`H \\subseteq G`} /> 是子群, <TeX src={`g \\in G`} />。 <strong>左陪集</strong>: <TeX src={`gH = \\{gh : h \\in H\\}`} />。 陪集大小都等于 <TeX src={`|H|`} />, 且 G 被陪集划分为 <TeX src={`[G:H]`} /> 个互不相交的集合。</>}
              en={<>Let <TeX src={`H \\subseteq G`} /> be a subgroup, <TeX src={`g \\in G`} />. The <strong>left coset</strong> is <TeX src={`gH = \\{gh : h \\in H\\}`} />. All cosets have size <TeX src={`|H|`} />, and G partitions into <TeX src={`[G:H]`} /> disjoint cosets.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>Thistlethwaite solver 的核心想法: <em>把魔方状态映射到陪集</em>, 不关心同一陪集内的具体「微调」, 只关心 「现在位于哪个陪集」。每一阶的工作是「跳到下一个 (更小的) 陪集」, 直到落到 G_4 = {`{e}`}。陪集化是让指数级问题变成多项式级的关键技巧。</>}
            en={<>The Thistlethwaite solver's key idea: <em>map cube states to cosets</em>, ignoring the fine structure within a coset. Each phase moves to the next (smaller) coset until reaching G_4 = {`{e}`}. Cosets are the trick that turns an exponential problem into a polynomial one.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.3  Lagrange 定理" en="10.3  Lagrange's theorem" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 10.2 — Lagrange', en: 'Theorem 10.2 — Lagrange' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src={`H \\subseteq G`} /> 是有限群的子群, 则 <TeX src={`|H| \\,\\bigm|\\, |G|`} /> (即 <TeX src={`|H|`} /> 整除 <TeX src={`|G|`} />), 且 <TeX src={`|G| = |H| \\cdot [G:H]`} />。</>}
              en={<>Let <TeX src={`H \\subseteq G`} /> be a subgroup of a finite group. Then <TeX src={`|H| \\,\\bigm|\\, |G|`} /> (i.e. <TeX src={`|H|`} /> divides <TeX src={`|G|`} />), and <TeX src={`|G| = |H| \\cdot [G:H]`} />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个最基本的群论定理在魔方上的意义:任何子群的阶都必须整除 4.3 × 10¹⁹。所以 ⟨R, U⟩ 的阶 73,483,200 整除 |G|, ⟨U⟩ 阶 4 整除, |G_3| = 663,552 整除 — 都自动成立。</>}
            en={<>The most basic theorem in group theory says: any subgroup's order must divide 4.3 × 10¹⁹. So ⟨R, U⟩ has order 73,483,200 | |G|, ⟨U⟩ has order 4 | |G|, |G_3| = 663,552 | |G| — all automatic.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.4  各阶状态空间与直径" en="10.4  State-space size and diameter per phase" />
        </h3>
        <p>
          <L
            zh={<>四阶段每阶段需要查的「状态」(陪集) 数量, 以及在该陪集图上的 BFS 直径:</>}
            en={<>For each phase, the number of states (cosets) and the BFS diameter on that coset graph:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '阶段', en: 'Phase'
            })}</th><th>{tr({ zh: '陪集大小', en: 'Coset size' })}</th><th>{tr({ zh: '直径 (HTM)', en: 'Diameter (HTM)'
            })}</th><th>{tr({ zh: '坐标含义', en: 'Coordinate'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td><TeX src={`G \\to G_1`} /></td><td className="num">2¹¹ = 2,048</td><td className="num">7</td><td>{tr({ zh: '12 棱朝向 (mod 11 自由)', en: '12-edge orientation (11 free)'
            })}</td></tr>
            <tr><td><TeX src={`G_1 \\to G_2`} /></td><td className="num">3⁷ · <TeX src={`\\binom{12}{4}`} /> = 2187 · 495 = 1,082,565</td><td className="num">10</td><td>{tr({ zh: '7 角朝向 + UD-slice 棱位置', en: '7-corner orient. + UD-slice edge placement'
            })}</td></tr>
            <tr><td><TeX src={`G_2 \\to G_3`} /></td><td className="num">29,400</td><td className="num">13</td><td>{tr({ zh: '角块进 4-轨道 + 棱块进 4-轨道', en: 'corners and edges into 4-orbits'
            })}</td></tr>
            <tr><td><TeX src={`G_3 \\to \\{e\\}`} /></td><td className="num">663,552</td><td className="num">15</td><td>{tr({ zh: '半圈子群,domino group', en: 'half-turn-only "domino" group' })}</td></tr>
            <tr><td>{tr({ zh: '总上界', en: 'Total upper bound'
            })}</td><td colSpan={2} className="num"><strong>7 + 10 + 13 + 15 = 45</strong></td><td>{tr({ zh: '原 Thistlethwaite 1981 给的是 52,后人收紧', en: 'original 1981 Thistlethwaite gave 52; later refined'
            })}</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>Reid (1995) 把上界收紧到 <strong>≤ 52</strong> HTM (即原 Thistlethwaite 给的同值); Korf 等人后续工作的实验上界为 <strong>≤ 38</strong>。 Rokicki 2010 用 §11 介绍的 「合并 G → G₂」 直接搜把 worst case 推到精确的 20。</>}
            en={<>Reid (1995) tightened the upper bound to <strong>≤ 52</strong> HTM (matching Thistlethwaite's original); Korf's later experiments showed <strong>≤ 38</strong> empirically. Rokicki (2010) then merged "G → G₂ direct search" — described in §11 — to drive the worst case to exactly 20.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.5  Kociemba 「合并 G → G₂」 改进思路" en={`10.5  Kociemba's "merge G → G₂"`} />
        </h3>
        <p>
          <L
            zh={<>Thistlethwaite 用 4 阶段是因为每阶段陪集表都能放入 1980 年代的内存 (≤ 10⁶)。 1990 年代 Kociemba 注意到, <TeX src={`G \\to G_2`} /> 这一大跳跃的陪集数恰好是<TeXBlock src={`[G : G_2] \\;=\\; 2{,}217{,}093{,}120 \\;=\\; 2^{11} \\cdot 3^7 \\cdot \\tbinom{12}{4} \\cdot \\text{(more)}`} /></>}
            en={<>Thistlethwaite used 4 stages because each coset table had to fit into 1980s RAM (≤ 10⁶). Kociemba (1990s) noticed that the <em>combined</em> jump <TeX src={`G \\to G_2`} /> has<TeXBlock src={`[G : G_2] \\;=\\; 2{,}217{,}093{,}120 \\;=\\; 2^{11} \\cdot 3^7 \\cdot \\tbinom{12}{4} \\cdot \\text{(more)}`} /></>}
          />
        </p>
        <p>
          <L
            zh={<>由 Lagrange, <TeX src={`|G| = [G:G_2] \\cdot |G_2|`} />, 验证 <TeX src={`|G_2| = |G| / 2{,}217{,}093{,}120 \\approx 1.95 \\times 10^{10}`} /> — 与已知值一致。 用 IDA* 加大小约 2 GB 的 pruning table 直接搜 G → G₂, 配合 G₂ 内部的快速 BFS, 这就是现代 two-phase 求解器 (Kociemba 1992; Reid 优化版 cube20)。 平均 ~21 HTM, worst case 20 HTM。</>}
            en={<>By Lagrange, <TeX src={`|G| = [G:G_2] \\cdot |G_2|`} />, so <TeX src={`|G_2| = |G| / 2{,}217{,}093{,}120 \\approx 1.95 \\times 10^{10}`} /> — matching the known value. IDA* with a ~2 GB pruning table searches G → G₂, then BFS finishes within G₂ — the modern two-phase solver (Kociemba 1992; Reid's cube20 refinements). Average ~21 HTM, worst case 20.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §13 Famous patterns ═════════════════════════ */}
      <GTSec id="patterns" className="gt-sec">
        <div className="gt-sec-num">§13</div>
        <h2 className="gt-sec-title">
          <L zh="著名图案 — 群元素的具体面孔" en="Famous patterns — concrete faces of group elements" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>群元素是抽象对象, 但每一个魔方状态 (= 群元素) 都可以 <em>看见</em>。 下面这组家喻户晓的图案, 每一个都是 G 的一个具体元素 —— 配有它的阶、 定义公式、 循环结构、 以及它在群结构里的位置。 注意 「图案的视觉对称」 通常对应于 「群元素的代数对称」 —— 这是 §13 的主题。</>}
            en={<>Group elements are abstract, but every cube state is <em>visible</em>. Each celebrated pattern below is a specific element of G — with its order, defining alg, cycle structure, and place in G's architecture. Visual symmetry of a pattern usually corresponds to algebraic symmetry of its group element — that is the theme of §13.</>}
          />
        </p>
        <PatternGallery />

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="13.1  阶 + 循环结构表" en="13.1  Order + cycle structure table" />
        </h3>
        <p>
          <L
            zh={<>把每个图案翻译成代数语言, 它们的阶 (在多少次内回到 e) 和循环结构 (corner / edge 各自的置换分解) 一目了然:</>}
            en={<>Translated into algebra, each pattern's order (how many applications return to e) and cycle structure (corner / edge permutation decomposition) lays bare:</>}
          />
        </p>
        <div className="gt-pattern-table">
          <table className="gt-pattern-tbl">
            <thead>
              <tr>
                <th>{tr({ zh: '图案', en: 'pattern'
                })}</th>
                <th>{tr({ zh: '阶', en: 'order'
                })}</th>
                <th>{tr({ zh: '角循环', en: 'corner cycles'
                })}</th>
                <th>{tr({ zh: '棱循环', en: 'edge cycles'
                })}</th>
                <th>{tr({ zh: '类型', en: 'character'
                })}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{tr({ zh: 'Superflip 超翻', en: 'Superflip' })}</strong></td>
                <td className="num">2</td>
                <td className="num">{tr({ zh: '全恒等', en: 'identity'
                })}</td>
                <td>{tr({ zh: '12 棱全翻', en: '12 edges flipped'
                })}</td>
                <td>{tr({ zh: '中心 Z(G)', en: 'centre Z(G)' })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: 'Checkerboard 棋盘', en: 'Checkerboard'
                })}</strong></td>
                <td className="num">2</td>
                <td>{tr({ zh: '4 个 2-循环', en: '4 transpositions'
                })}</td>
                <td>{tr({ zh: '6 个 2-循环', en: '6 transpositions'
                })}</td>
                <td>{tr({ zh: '6 半圈阿贝尔', en: 'Abelian 6-tuple'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '4 dots 四点', en: '4 dots'
                })}</strong></td>
                <td className="num">2</td>
                <td className="num">{tr({ zh: '全恒等', en: 'identity'
                })}</td>
                <td>{tr({ zh: '4 个 2-循环', en: '4 transpositions'
                })}</td>
                <td>{tr({ zh: '只移棱', en: 'edges only'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: 'Cube in cube 回字', en: 'Cube in cube' })}</strong></td>
                <td className="num">4</td>
                <td>{tr({ zh: '8-循环', en: 'one 8-cycle'
                })}</td>
                <td>{tr({ zh: '复合', en: 'mixed'
                })}</td>
                <td>{tr({ zh: '非阿贝尔', en: 'non-Abelian'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '十字', en: 'Cross' })}</strong></td>
                <td className="num">2</td>
                <td className="num">{tr({ zh: '全恒等', en: 'identity'
                })}</td>
                <td>{tr({ zh: '6 个 2-循环', en: '6 transpositions'
                })}</td>
                <td>{tr({ zh: '对称', en: 'symmetric'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '蟒蛇 Anaconda', en: 'Anaconda' })}</strong></td>
                <td className="num">6</td>
                <td>{tr({ zh: '3-循环 + 朝向', en: '3-cycle + twists'
                })}</td>
                <td>{tr({ zh: '6-循环', en: '6-cycle'
                })}</td>
                <td>{tr({ zh: '阶 = lcm(2,3)', en: 'order = lcm(2,3)'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '六点 Six spots', en: 'Six spots'
                })}</strong></td>
                <td className="num">4</td>
                <td>{tr({ zh: '2 个 4-循环', en: '2 four-cycles'
                })}</td>
                <td>{tr({ zh: '4 个 2-循环', en: '4 transpositions'
                })}</td>
                <td>{tr({ zh: '90° 类', en: '90° type'
                })}</td>
              </tr>
              <tr>
                <td><strong>{tr({ zh: '加减号', en: 'Plus minus'
                })}</strong></td>
                <td className="num">2</td>
                <td className="num">{tr({ zh: '全恒等', en: 'identity'
                })}</td>
                <td>{tr({ zh: '6 个 2-循环', en: '6 transpositions'
                })}</td>
                <td>{tr({ zh: '6 步极简', en: '6-move minimum'
                })}</td>
              </tr>
            </tbody>
          </table>
          <div className="gt-aside" style={{ marginTop: 10 }}>
            {lang === 'zh'
              ? <>注:阶 = 角块循环阶 与棱块循环阶 的最小公倍数(若两边都有朝向也要乘进去)。 「蟒蛇」 的 6 是因为 lcm(2, 3) = 6 — 棱 2 步、 角 3 步。</>
              : <>Note: order = lcm of the corner-cycle order and the edge-cycle order (orientations multiplied in). Anaconda's 6 = lcm(2, 3) — edges loop in 2, corners in 3.</>}
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="13.2  Superflip 的特殊地位" en="13.2  The special status of superflip" />
        </h3>
        <p>
          <L
            zh={<>Superflip 是阶 2 的元素 (做两次回到原点), 且它的 <TeX src={`c_p = e,\\; c_o = 0`} /> (角块完全归位), <TeX src={`e_p = e`} /> (棱位置归位), 只有 <TeX src={`e_o = (1,1,\\ldots,1)`} /> 12 个棱块全部翻面。 它在 G 里有三件事是 <em>独一无二</em> 的:</>}
            en={<>Superflip is an order-2 element, with <TeX src={`c_p = e,\\; c_o = 0`} /> (corners untouched) and <TeX src={`e_p = e`} /> (edges home), and only <TeX src={`e_o = (1,1,\\ldots,1)`} /> — all 12 edges flipped. It is <em>uniquely distinguished</em> in G by three facts:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>Z(G) 的唯一非平凡元</strong> —— 跟 G 中每一个元素交换 (§9.4): <TeX src={`Z(G) = \\{e,\\; \\mathrm{superflip}\\} \\cong \\mathbb{Z}/2`} />。 这是 「为什么 G 不简单」的最具体证据。</>}
              en={<><strong>The unique non-identity element of Z(G)</strong> — commutes with every g ∈ G (§9.4): <TeX src={`Z(G) = \\{e,\\; \\mathrm{superflip}\\} \\cong \\mathbb{Z}/2`} />. The most concrete reason G is not simple.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>HTM 距离恰好 20</strong> —— 是 2010 年 Rokicki 等证明 「上帝之数 = 20」 时第一个被锁死的下界。 全 4.3 × 10¹⁹ 状态里只有 <strong>三个</strong> 状态需要满 20 步: superflip、 superflip ∘ (4-spot 一族), 以及 Reid 的对偶。</>}
              en={<><strong>HTM distance exactly 20</strong> — the first lower bound nailed down in Rokicki et al.'s 2010 proof that God's number = 20. Of 4.3 × 10¹⁹ states, only <strong>three</strong> require the full 20 moves: superflip, the superflip ∘ 4-spot family, and Reid's dual.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>对所有 48 个外部立方对称变换不变</strong> —— 把 superflip 投到 G 的轨道空间 G/Sym 上, 它仍然是单点轨道。 群论上 「最对称」 的非平凡状态。</>}
              en={<><strong>Invariant under all 48 outer cube symmetries</strong> — when projected to G/Sym, superflip is a singleton orbit. Group-theoretically the "most symmetric" non-identity state.</>}
            />
          </li>
        </ul>
        <TeXBlock src={`Z(G) \\;=\\; \\bigl\\{\\,g \\in G \\;:\\; \\forall h \\in G,\\; gh = hg\\,\\bigr\\} \\;=\\; \\{e,\\; \\mathrm{superflip}\\} \\;\\cong\\; \\mathbb{Z}/2`} />
        <div className="gt-pullquote">
          <L
            zh={<>「Superflip 是 4.3 × 10¹⁹ 状态里, 群论上 <em>最特殊</em> 的那一个。 它的特殊性不是巧合, 而是它在群中几何位置的代数后果。」</>}
            en={<>"Superflip is, group-theoretically, the most singular position among 43 quintillion. Its uniqueness is not coincidence — it is the algebraic consequence of its geometric place in G."</>}
          />
          <div className="gt-pullquote-cite">— Tomas Rokicki, <em>God's Number is 20</em> (2010)</div>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="13.3  生成简单图案的代数学" en="13.3  Algebra of generating simple patterns" />
        </h3>
        <p>
          <L
            zh={<>有些图案有清晰的代数公式。 例如 「checkerboard 棋盘」 = U² D² F² B² L² R²。 这是 6 个 「半圈生成元」 的乘积, 它们两两可交换 (同轴半圈互换 U² ↔ D², 不同轴半圈在不同 cubies 上作用), 故它们生成的子群是阿贝尔的:</>}
            en={<>Some patterns have a clean algebraic origin. Example: <strong>checkerboard</strong> = U² D² F² B² L² R². These six half-turn generators mutually commute (same-axis half-turns commute, different-axis pairs act on disjoint cubies), so the subgroup they generate is Abelian:</>}
          />
        </p>
        <TeXBlock src={`\\langle U^2,\\, D^2,\\, F^2,\\, B^2,\\, L^2,\\, R^2 \\rangle \\;\\cong\\; (\\mathbb{Z}/2)^3 \\;\\;(\\text{after the 3 axis-fold relations})`} />
        <p>
          <L
            zh={<>(三个轴方向各自一对 U²/D² 等, 同轴半圈互为逆 — 减去 3 个独立关系, 剩 6 - 3 = 3 个独立 ℤ/2 因子。) Checkerboard 的阶因此必然 ≤ 2 ── 直接验证就是 2。 「Pons Asinorum」 (M² E² S²) 与 superflip 都属于这个阿贝尔小子群。</>}
            en={<>(Three axes give three pairs U²/D² etc.; same-axis half-turns invert each other, kicking 3 relations, leaving 6 − 3 = 3 independent ℤ/2 factors.) Checkerboard's order is therefore ≤ 2 — and direct check gives 2. The "Pons Asinorum" (M² E² S²) and superflip both live in this Abelian subgroup.</>}
          />
        </p>

        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '观察 13.1 — 图案视觉对称 ↔ 群代数对称', en: 'Observation 13.1 — visual ↔ algebraic symmetry'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>一个图案在所有 48 个外部立方对称下不变 ⇔ 它在共轭作用下是 G 的不动点 ⇔ 它在 <strong>Z(G)</strong> 里。 这是 「为什么 superflip 既视觉上完美对称又代数上独一」 的真正原因。 一个图案在 <em>子集</em> 对称下不变 ⇔ 它在那部分稳定子里 —— 例如 「三轴对称」 棋盘对 24 个旋转对称不变, 它不属于 Z(G) 但属于对称化子群。</>}
              en={<>A pattern fixed by all 48 outer cube symmetries ⇔ it is a fixed point of conjugation ⇔ it lies in <strong>Z(G)</strong>. That is why superflip is simultaneously the most visually symmetric and the algebraically unique non-trivial element. A pattern fixed by a <em>subset</em> of symmetries lies in the corresponding symmetrizing subgroup — e.g. the three-axis-symmetric checkerboard sits in a 24-element rotational stabilizer, not in Z(G).</>}
            />
          </div>
        </div>
      </GTSec>

      {/* ═══════════════ §14 Cayley graph ════════════════════════════ */}
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

      {/* ═══════════════ §17 Homomorphisms ═══════════════════════════ */}
      <GTSec id="homomorphisms" className="gt-sec">
        <div className="gt-sec-num">§17</div>
        <h2 className="gt-sec-title">
          <L zh="同态 — 把群压扁到更简单的群里" en="Homomorphisms — projecting onto simpler groups" />
        </h2>
        <p>
          <L
            zh={<>群与群之间有「保乘法的映射」 — 它是研究群的标准工具。在魔方上, 同态把 4.3 × 10¹⁹ 个状态压扁到只有 2 个 (奇偶) 或 12 个 (拆装-平行宇宙), 让我们能 「只关心一部分信息」。</>}
            en={<>Maps between groups that respect multiplication — homomorphisms — are the standard tool for studying groups. On the cube, a homomorphism crushes 4.3 × 10¹⁹ states onto just 2 (parity) or 12 (the disassembly cosets), letting us track just one slice of information at a time.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 17.1', en: 'Definition 17.1'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>函数 <TeX src={`\\varphi : G \\to H`} /> 是 <strong>群同态</strong>, 若对所有 <TeX src={`a, b \\in G`} />: <TeX src={`\\varphi(a \\cdot b) = \\varphi(a) \\cdot \\varphi(b)`} />。 同态自动满足 <TeX src={`\\varphi(e_G) = e_H`} /> 和 <TeX src={`\\varphi(a^{-1}) = \\varphi(a)^{-1}`} />。</>}
              en={<>A map <TeX src={`\\varphi : G \\to H`} /> is a <strong>group homomorphism</strong> if <TeX src={`\\varphi(a \\cdot b) = \\varphi(a) \\cdot \\varphi(b)`} /> for all <TeX src={`a, b \\in G`} />. It automatically satisfies <TeX src={`\\varphi(e_G) = e_H`} /> and <TeX src={`\\varphi(a^{-1}) = \\varphi(a)^{-1}`} />.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.1  奇偶同态 sgn : G → ℤ/2" en="17.1  The parity homomorphism sgn : G → ℤ/2" />
        </h3>
        <p>
          <L
            zh={<>对每个 g ∈ G, 角块置换 cp(g) 是 S₈ 的元素 — 它要么是偶置换 (能写成偶数个 2-循环之积), 要么是奇置换。 由约束 sgn(cp) = sgn(ep), 棱块部分也有相同奇偶。 定义:</>}
            en={<>For each g ∈ G, the corner permutation cp(g) is in S₈ — either an even permutation (a product of an even number of transpositions) or odd. By the invariant sgn(cp) = sgn(ep), edges have the same parity. Define:</>}
          />
        </p>
        <TeXBlock src={`\\operatorname{sgn} : G \\to \\mathbb{Z}/2, \\qquad \\operatorname{sgn}(g) = \\operatorname{sgn}(c_p(g)) \\in \\{+1, -1\\}`} />
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 17.2', en: 'Theorem 17.2' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>sgn 是满同态 <TeX src={`G \\twoheadrightarrow \\mathbb{Z}/2`} />, 它的核是 <strong>偶状态集</strong> = <TeX src={`[G, G]`} />, 阶为 <TeX src={`|G| / 2 \\approx 2.16 \\times 10^{19}`} />。</>}
              en={<>sgn is a surjective homomorphism <TeX src={`G \\twoheadrightarrow \\mathbb{Z}/2`} />; its kernel is the <strong>even-parity subgroup</strong> <TeX src={`[G, G]`} />, of size <TeX src={`|G| / 2 \\approx 2.16 \\times 10^{19}`} />.</>}
            />
          </div>
        </div>
        <HomomorphismPanel />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.2  第一同构定理 (First Isomorphism Theorem)" en="17.2  First Isomorphism Theorem" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 17.3', en: 'Theorem 17.3' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src={`\\varphi : G \\to H`} /> 是同态, 则<TeXBlock src={`G / \\ker(\\varphi) \\;\\cong\\; \\operatorname{im}(\\varphi).`} /></>}
              en={<>Let <TeX src={`\\varphi : G \\to H`} /> be a homomorphism. Then<TeXBlock src={`G / \\ker(\\varphi) \\;\\cong\\; \\operatorname{im}(\\varphi).`} /></>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>应用到 sgn:</>}
            en={<>Apply to sgn:</>}
          />
        </p>
        <TeXBlock src={`G / [G, G] \\;\\cong\\; \\mathbb{Z}/2`} />
        <p>
          <L
            zh={<>这就是 §9.2 说的 「G 的最大阿贝尔商」, 等价于 「魔方的奇偶 bit」 。每个魔方状态只有一比特的「阿贝尔信息」, 其余 33 比特都是非阿贝尔结构。</>}
            en={<>This is exactly the "largest Abelian quotient" mentioned in §9.2 — the cube's single bit of "parity." Every cube state carries just one bit of Abelian information; the rest of its 33+ bits is purely non-Abelian.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.3  从自由组装到 G — 12 元商" en="17.3  Free assembly → G — the 12-fold quotient" />
        </h3>
        <p>
          <L
            zh={<>另一个有用的同态: 把魔方「拆开重组的全部状态」 <TeX src={`F = S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}`} /> 用 「(coSum mod 3, eoSum mod 2, parity bit)」 三元组映到 <TeX src={`\\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />:</>}
            en={<>Another useful homomorphism: from the "free assembly space" <TeX src={`F = S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}`} /> onto the 3-tuple (coSum mod 3, eoSum mod 2, parity bit) <TeX src={`\\in \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />:</>}
          />
        </p>
        <TeXBlock src={`\\psi : F \\to \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2, \\qquad \\ker(\\psi) = G`} />
        <p>
          <L
            zh={<>由第一同构定理, <TeX src={`F / G \\cong \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />, 阶 12。 这就是 §5.4 推论的 12 个 「平行宇宙」 — 物理上拆开重装时, 有 12 种不可达状态的 「等价类」。</>}
            en={<>By the First Isomorphism Theorem, <TeX src={`F / G \\cong \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />, a group of order 12. This is Corollary 5.4's 12 "parallel universes" — physically, the 12 unreachable equivalence classes you can produce by popping the cube apart.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.4  其它同态 — 各种「投影」" en="17.4  Other homomorphisms — different projections" />
        </h3>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>角块投影</strong> <TeX src={`\\pi_c : G \\to G_c`} />: 忽略棱块, 只看角块。 像 = 「2×2×2 口袋方块群」, <TeX src={`|G_c| = 3{,}674{,}160`} />。</>}
              en={<><strong>Corner projection</strong> <TeX src={`\\pi_c : G \\to G_c`} />: forget edges, keep corners. Image = the 2×2×2 Pocket Cube group, order <TeX src={`3{,}674{,}160`} />.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>棱块投影</strong> <TeX src={`\\pi_e : G \\to G_e`} />: 只看棱块。 像有阶 <TeX src={`980{,}995{,}276{,}800 \\approx 9.8 \\times 10^{11}`} />。</>}
              en={<><strong>Edge projection</strong> <TeX src={`\\pi_e : G \\to G_e`} />: keep only edges. Image has order <TeX src={`980{,}995{,}276{,}800 \\approx 9.8 \\times 10^{11}`} />.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>朝向投影</strong> <TeX src={`G \\to (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} />: 忽略所有位置, 只看朝向。 这是 Thistlethwaite 阶段 <TeX src={`G \\to G_1`} /> 用的同态。</>}
              en={<><strong>Orientation projection</strong> <TeX src={`G \\to (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} />: forget positions, keep orientations. This is the homomorphism used in Thistlethwaite's <TeX src={`G \\to G_1`} /> phase.</>}
            />
          </li>
        </ul>
        <p>
          <L
            zh={<>每个同态对应一个「子任务」: 解魔方的方法之一就是依次解决每个投影, 让 image 变成单位元 — 这正是 Thistlethwaite/Kociemba 多阶段法的代数基础。</>}
            en={<>Each homomorphism corresponds to one "subtask": one way to solve the cube is to drive each image to the identity in turn — which is exactly the algebraic basis of the Thistlethwaite/Kociemba multi-phase solvers.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.5  同态画廊 — 4 张映射表" en="17.5  Homomorphism gallery" />
        </h3>
        <p>
          <L
            zh={<>把魔方上 4 个常用同态摆在一张表里, 看 kernel / image / index 的差异:</>}
            en={<>Four standard cube homomorphisms in a single table, with kernel / image / index side by side:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '同态', en: 'Homomorphism'
            })}</th><th>{tr({ zh: '像', en: 'Image' })}</th><th>{tr({ zh: '核', en: 'Kernel' })}</th><th>|ker|</th><th>[G : ker]</th></tr>
          </thead>
          <tbody>
            <tr><td><TeX src={`\\operatorname{sgn} : G \\to \\mathbb{Z}/2`} /></td><td><TeX src={`\\mathbb{Z}/2`} /></td><td><TeX src={`[G,G]`} /></td><td className="num">|G|/2</td><td className="num">2</td></tr>
            <tr><td><TeX src={`\\pi_{\\text{corner}} : G \\to G_c`} /></td><td>{tr({ zh: '2×2×2 群', en: '2×2×2 group' })}</td><td>{tr({ zh: 'cp=co=identity 的部分', en: 'cp = co = identity part' })}</td><td className="num">≈ 1.18 × 10¹³</td><td className="num">3,674,160</td></tr>
            <tr><td><TeX src={`\\pi_{\\text{edge}} : G \\to G_e`} /></td><td>{tr({ zh: '12 棱块群', en: '12-edge group'
            })}</td><td>{tr({ zh: 'ep=eo=identity 的部分', en: 'ep = eo = identity part' })}</td><td className="num">≈ 4.41 × 10⁷</td><td className="num">9.81 × 10¹¹</td></tr>
            <tr><td><TeX src={`\\pi_{\\text{ori}} : G \\to (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /></td><td>{tr({ zh: 'EO ⊕ CO 空间', en: 'EO ⊕ CO space'
            })}</td><td><TeX src={`G_1`} /> ({tr({ zh: '朝向全 0 的子群', en: 'orientation-zero subgroup' })})</td><td className="num">|G|/2¹¹ = |G|/2048</td><td className="num">2¹¹ · 3⁷ = 4,478,976</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>三个 <TeX src={`\\pi_*`} /> 同态合在一起几乎能重建状态向量: 知道 cp/ep 加 co/eo, 就知道整个 g。但 「合体同态」 <TeX src={`G \\to G_c \\times G_e \\times (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> 仍然不单射, 它的 kernel 包括所有「角块对角块独立 / 棱块对棱块独立」 但被三守恒律约束的状态。</>}
            en={<>Together the three <TeX src={`\\pi_*`} /> homomorphisms almost reconstruct a state vector: knowing cp/ep, co/eo gives g. But the "combined" homomorphism <TeX src={`G \\to G_c \\times G_e \\times (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> is still not injective; its kernel collects states where corners-vs-edges are "independent" yet bound by the three reachability laws.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.6  Schur–Zassenhaus 在魔方上" en="17.6  Schur–Zassenhaus on the cube" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 17.4 — Schur–Zassenhaus', en: 'Theorem 17.4 — Schur–Zassenhaus' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src={`N \\triangleleft G`} /> 是有限群的正规子群, <TeX src={`\\gcd(|N|, |G/N|) = 1`} />。 则 G 可表为 <strong>半直积</strong> <TeX src={`G \\cong N \\rtimes (G/N)`} />, 即 G 内存在补群 <TeX src={`H \\subseteq G`} /> 使 <TeX src={`G = NH`} /> 且 <TeX src={`N \\cap H = \\{e\\}`} />。</>}
              en={<>Let <TeX src={`N \\triangleleft G`} /> be a normal subgroup of a finite group with <TeX src={`\\gcd(|N|, |G/N|) = 1`} />. Then G splits as a <strong>semidirect product</strong> <TeX src={`G \\cong N \\rtimes (G/N)`} /> — i.e. G contains a complement <TeX src={`H \\subseteq G`} /> with <TeX src={`G = NH`} /> and <TeX src={`N \\cap H = \\{e\\}`} />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方,关键的正规子群是 <TeX src={`N = (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> (朝向核, ker π_pos 中 「只改朝向不改位置」 的部分)。<TeXBlock src={`|N| \\;=\\; 3^7 \\cdot 2^{11} \\;=\\; 4{,}478{,}976.`} /><TeX src={`|G/N| = |S_8 \\times S_{12}|/2 = 8! \\cdot 12!/2 \\approx 9.65 \\times 10^{15}`} />。验证: <TeX src={`\\gcd(4{,}478{,}976,\\; 9.65 \\times 10^{15})`} /> 含因子 <TeX src={`2`} /> 和 <TeX src={`3`} /> — <strong>不互素</strong>! 故 Schur–Zassenhaus 不直接给 「位置 vs 朝向」 的劈裂。</>}
            en={<>For the cube, the natural normal subgroup is <TeX src={`N = (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> (the orientation kernel — operations that change orientations but not positions).<TeXBlock src={`|N| \\;=\\; 3^7 \\cdot 2^{11} \\;=\\; 4{,}478{,}976.`} /><TeX src={`|G/N| = |S_8 \\times S_{12}|/2 \\approx 9.65 \\times 10^{15}`} />. Check <TeX src={`\\gcd(4{,}478{,}976,\\; 9.65 \\times 10^{15})`} />: it contains factors of <TeX src={`2`} /> and <TeX src={`3`} /> — they are <strong>not</strong> coprime! So Schur–Zassenhaus does not split G as "positions × orientations" directly.</>}
          />
        </p>
        <p>
          <L
            zh={<>然而 N 的 「3-部分」 <TeX src={`N_3 = (\\mathbb{Z}/3)^7`} /> (阶 2187) 与 <TeX src={`G/N_3`} /> (阶 <TeX src={`|G|/2187 \\approx 1.98 \\times 10^{16}`} />) 互素: <TeX src={`|G/N_3|`} /> 只含 <TeX src={`2`} /> 与 prime factors 不是 3 (因为 |G/N| 不含 3 因子;待 verified by Sylow)。 实际上, Sylow-3 部分仅在 N_3 中, 故 <TeX src={`G \\cong N_3 \\rtimes (G/N_3)`} /> 成立。 这就是为什么 「先归朝向, 再归位置」 是一条合法分解 — Thistlethwaite/Kociemba 的多阶段框架本质上就是 Schur–Zassenhaus 给出的半直积分层。</>}
            en={<>However, the "3-part" of N, namely <TeX src={`N_3 = (\\mathbb{Z}/3)^7`} /> (order 2187), <em>is</em> coprime to its complement: |G/N_3| has no factor of 3 (the 3-Sylow lives entirely in N_3). So <TeX src={`G \\cong N_3 \\rtimes (G/N_3)`} /> by Schur–Zassenhaus. This is exactly why "fix orientations first, then permutations" is an algebraically legitimate decomposition — the multi-phase framework of Thistlethwaite/Kociemba is, at heart, a Schur–Zassenhaus splitting.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §18 Group actions & Burnside ════════════════ */}
      <GTSec id="actions-burnside" className="gt-sec">
        <div className="gt-sec-num">§18</div>
        <h2 className="gt-sec-title">
          <L zh="群作用与 Burnside — 计数对称等价" en="Group actions & Burnside — counting up to symmetry" />
        </h2>
        <p>
          <L
            zh={<>到目前为止, 我们把 G 看作「自身」 — 元素的集合和乘法。但群的真正力量在于 <strong>作用</strong> 在别的集合上。魔方群作用于 26 个小块的位置和方向; 魔方的 48 个外部对称群作用于整个 G 自身。</>}
            en={<>So far we have treated G as the group itself — a set of elements with multiplication. But the real power of a group is in how it <strong>acts</strong> on other sets. G acts on the 26 cubies and their orientations; the 48-element outer symmetry group acts on G itself.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 18.1 — 群作用', en: 'Definition 18.1 — group action'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>群 <span className="gt-math">G</span> 在集合 <span className="gt-math">X</span> 上的 <strong>作用</strong> 是一个映射 <span className="gt-math">G × X → X</span>, <span className="gt-math">(g, x) ↦ g · x</span>, 满足:</>}
              en={<>An <strong>action</strong> of group G on a set X is a map <span className="gt-math">G × X → X</span>, <span className="gt-math">(g, x) ↦ g · x</span>, satisfying:</>}
            />
            <ul style={{ paddingLeft: 24, margin: '8px 0' }}>
              <li><span className="gt-math">e · x = x</span> {tr({ zh: '(单位元固定一切)', en: '(identity fixes everything)'
            })}</li>
              <li><span className="gt-math">(g · h) · x = g · (h · x)</span> {tr({ zh: '(乘法兼容)', en: '(compatible with multiplication)'
            })}</li>
            </ul>
            <L
              zh={<>对每个 <span className="gt-math">x ∈ X</span>, 它的 <strong>轨道</strong> <span className="gt-math">G·x = {`{g · x : g ∈ G}`}</span> 是 X 的子集。 <strong>稳定子</strong> <span className="gt-math">Stab(x) = {`{g ∈ G : g · x = x}`}</span> 是 G 的子群。轨道-稳定子定理:|G·x| = [G : Stab(x)]。</>}
              en={<>For each <span className="gt-math">x ∈ X</span>, its <strong>orbit</strong> is <span className="gt-math">G·x = {`{g · x : g ∈ G}`}</span> ⊆ X. Its <strong>stabiliser</strong> is <span className="gt-math">Stab(x) = {`{g ∈ G : g · x = x}`}</span>, a subgroup of G. The orbit-stabiliser theorem: |G·x| = [G : Stab(x)].</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.1  立方体的 48 个外部对称 — 全对称群 O_h" en="18.1  The 48 outer symmetries of the cube — group O_h" />
        </h3>
        <p>
          <L
            zh={<>魔方除了内部魔方群 G 之外, 还有「整体作为一个立方体」 的对称群 — 共 <strong>48 个</strong> 元素, 在化学和晶体学里叫 <strong>O_h</strong>。把它分解成 10 个共轭类:</>}
            en={<>Beyond the internal cube group G, the cube as a 3D object has its own symmetry group of <strong>48 elements</strong> — known in chemistry/crystallography as <strong>O_h</strong>. It decomposes into 10 conjugacy classes:</>}
          />
        </p>
        <CubeSymmetryAxes />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.2  魔方上的几个自然作用" en="18.2  Natural cube actions" />
        </h3>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>G 作用于 54 个色块</strong>: 每个面转把色块送到新位置。轨道分解: 一个 24 元轨道 (角块色块) + 一个 24 元轨道 (棱块色块) + 6 个单元素轨道 (中心)。</>}
              en={<><strong>G acts on the 54 stickers</strong>: each face turn sends stickers to new positions. The orbit decomposition: a 24-sticker orbit (corner stickers), a 24-sticker orbit (edge stickers), and 6 singleton orbits (centres).</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>G 作用于 26 个小块</strong>: 一个 8 元轨道 (角块) + 一个 12 元轨道 (棱块) + 6 个单元素轨道 (中心)。这告诉我们 G 是 「8 角 × 12 棱」的对称变换群。</>}
              en={<><strong>G acts on the 26 cubies</strong>: an 8-element orbit (corners), a 12-element orbit (edges), and 6 singleton orbits (centres). This tells us G "lives on" 8 corners + 12 edges.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>48 个外部对称群作用于 G 自身</strong> (共轭作用): 这是 §8.2 的共轭类和 §11 的 Rokicki 证明用到的关键作用。</>}
              en={<><strong>The 48-element outer symmetry group acts on G itself</strong> by conjugation. This is the action behind §8.2's conjugacy classes and §11's Rokicki proof.</>}
            />
          </li>
        </ul>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.3  Burnside 引理 (轨道计数定理)" en="18.3  Burnside's lemma (orbit counting)" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 18.2 — Burnside', en: 'Theorem 18.2 — Burnside' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 G 作用于有限集 X。则 X 在 G 下的 <strong>轨道数</strong> 等于「每个 g 的不动点数」的平均:</>}
              en={<>Let G act on a finite set X. The number of <strong>orbits</strong> equals the average number of fixed points over G:</>}
            />
            <TeXBlock src={`\\#\\,\\text{orbits} \\;=\\; \\frac{1}{|G|} \\sum_{g \\in G} |\\!\\operatorname{Fix}(g)|`} />
          </div>
        </div>
        <p>
          <L
            zh={<>把它用到「48 个外部对称群作用于 G」 — 给出 「魔方真正不同的状态数」(忽略整体旋转和镜像)。每个对称变换 g 的不动点 Fix(g) 是 「在 g 下保持不变」 的魔方状态。</>}
            en={<>Apply it to the 48-element outer cube symmetry group acting on G — that gives the count of "essentially distinct" cube states (ignoring whole-cube rotations and mirrors). For each symmetry g, Fix(g) is the set of cube states invariant under g.</>}
          />
        </p>
        <SymmetryPicker />
        <BurnsideMiniTable />
        <p>
          <L
            zh={<>把这些不动点数加起来, 除以 |D| = 48 (外部对称群的阶), 得:</>}
            en={<>Sum the fixed-point counts and divide by |D| = 48 (the order of the outer symmetry group):</>}
          />
        </p>
        <TeXBlock src={`\\#\\,\\text{essentially distinct states} \\;=\\; \\frac{1}{48} \\sum_{g \\in D} |\\!\\operatorname{Fix}(g)| \\;\\approx\\; 901{,}083{,}404{,}981{,}813{,}616`} />
        <p>
          <L
            zh={<>这个数比 |G| / 48 ≈ 9.01 × 10¹⁷ 略大 — 因为只有少数状态 (如 superflip) 拥有完整 48 重对称, 大多数状态没有任何外部对称, 所以「真正不同的状态数」更接近 |G| / 48。</>}
            en={<>This number is slightly bigger than |G| / 48 ≈ 9.01 × 10¹⁷ — because only a handful of states (like superflip) carry full 48-fold symmetry, while most states have none. So the "truly distinct" count is just a touch above the naive |G| / 48.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>这个数字是 「魔方真正不同的状态数」 的精确答案。Rokicki 团队的 God's number 证明也以此对称化为基础, 把 4.3 × 10¹⁹ 状态化为 ~9 × 10¹⁷ 等价类, 加上 Kociemba two-phase 的陪集划分, 把这些再聚集到 ~2 × 10⁹ 个 「set」 去暴力验证 ≤ 20 步。</>}
            en={<>This is the precise answer to "how many fundamentally different cube states are there." Rokicki's God's-number proof rests on this symmetry reduction: 4.3 × 10¹⁹ states → ~9 × 10¹⁷ equivalence classes, further grouped into ~2 × 10⁹ "sets" via Kociemba two-phase cosets, then brute-force checked ≤ 20.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.4  轨道-稳定子定理在魔方上的具体例子" en="18.4  Orbit-stabiliser on the cube" />
        </h3>
        <OrbitExplorer />
        <p>
          <L
            zh={<>取 X = 26 个小块 (角块 + 棱块), G 是魔方群作用其上。 任选一个角块 c (比如 URF, 位置 0)。 它的轨道 G · c = 8 个角块位置, 因为 G 能把 URF 送到任何角块位置。 它的稳定子 Stab(c) = 「不动 URF 的所有操作」 — 阶为 |G| / 8 = 5,406,500,409,311,232,000。</>}
            en={<>Take X = 26 cubies (corners + edges), G acting. Pick any corner c (say URF, position 0). Its orbit G · c is all 8 corner positions, since G can send URF anywhere. Its stabiliser Stab(c) is the subgroup of operations fixing URF — order |G| / 8 = 5,406,500,409,311,232,000.</>}
          />
        </p>
        <TeXBlock src={`|G| \\;=\\; |\\!\\operatorname{Orbit}(c)| \\cdot |\\!\\operatorname{Stab}(c)| \\;=\\; 8 \\cdot 5.4 \\times 10^{18}`} />
        <p>
          <L
            zh={<>同样取一个棱块: |Orbit| = 12, |Stab| = |G| / 12 ≈ 3.6 × 10¹⁸。轨道-稳定子定理是 G 「分而治之」 的代数基础 — 也是数据结构上很多魔方 solver 用 「按角块分类 + 按棱块分类」 双查表的理论依据。</>}
            en={<>Pick an edge: |Orbit| = 12, |Stab| = |G| / 12 ≈ 3.6 × 10¹⁸. Orbit-stabiliser is the divide-and-conquer principle behind many cube solvers' two-table designs (one keyed by corners, one by edges).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.5  Cayley 定理 — 每个群都是置换群" en="18.5  Cayley's theorem — every group is a permutation group" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 18.3 — Cayley', en: 'Theorem 18.3 — Cayley' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>任何群 G 都同构于某个对称群 <TeX src={`S_n`} /> (<TeX src={`n = |G|`} />) 的子群。 证明: G 通过左乘作用在自己身上, 这给出嵌入 <TeX src={`G \\hookrightarrow \\operatorname{Sym}(G)`} />。</>}
              en={<>Every group G embeds isomorphically as a subgroup of some symmetric group <TeX src={`S_n`} /> (<TeX src={`n = |G|`} />). Proof: G acts on itself by left multiplication, giving an embedding <TeX src={`G \\hookrightarrow \\operatorname{Sym}(G)`} />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个定理在魔方上既显然又惊人:G 同构于 「G 上的左乘置换群」 的子群 (维度 4.3 × 10¹⁹) 。但实际上, G 嵌入 S₈ × S₁₂ 维度只是 (8! + 12!) — 这是更紧凑的「自然嵌入」, 也是状态向量 (cp, ep) 一定足以描述群元素的根本原因。</>}
            en={<>The theorem is both obvious and stunning on the cube: G embeds in the symmetric group on |G| = 4.3 × 10¹⁹ elements. But in practice, G fits into S₈ × S₁₂ (dimension 8! + 12!) — the much tighter "natural embedding" that justifies why the (cp, ep) state vector suffices to describe a group element.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.6  Oₕ 共轭类与典型 Fix(g)" en="18.6  Conjugacy classes of Oₕ and typical Fix(g)" />
        </h3>
        <p>
          <L
            zh={<>外部对称群 <TeX src={`O_h`} /> (48 元) 作用在 G 上, 每个元素 g 的 <strong>不动点集</strong> <TeX src={`\\operatorname{Fix}(g) = \\{x \\in G : g \\cdot x = x\\}`} /> 大小取决于 g 所属共轭类。 10 个共轭类的典型 Fix(g):</>}
            en={<>The 48-element <TeX src={`O_h`} /> acts on G; each <TeX src={`g \\in O_h`} />'s <strong>fixed-point set</strong> <TeX src={`\\operatorname{Fix}(g)`} /> depends on its conjugacy class. Typical values across the 10 classes:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '类', en: 'Class'
            })}</th><th>{tr({ zh: '元素数', en: 'Size'
            })}</th><th>{tr({ zh: '描述', en: 'Description' })}</th><th>|Fix(g)|</th></tr>
          </thead>
          <tbody>
            <tr><td>e</td><td className="num">1</td><td>{tr({ zh: '恒等', en: 'identity'
            })}</td><td className="num">|G| = 4.33 × 10¹⁹</td></tr>
            <tr><td><TeX src={`C_4`} /></td><td className="num">6</td><td>{tr({ zh: '90° 面轴旋转', en: '90° face-axis rotation'
            })}</td><td className="num">≈ √|G| ≈ 6.6 × 10⁹</td></tr>
            <tr><td><TeX src={`C_4^2 = C_2`} /></td><td className="num">3</td><td>{tr({ zh: '180° 面轴', en: '180° face-axis'
            })}</td><td className="num">≈ |G|^{`{1/2}`} · 倍数</td></tr>
            <tr><td><TeX src={`C_3`} /></td><td className="num">8</td><td>{tr({ zh: '120° 体对角线', en: '120° body-diagonal'
            })}</td><td className="num">≈ |G|^{`{1/3}`} ≈ 3.5 × 10⁶</td></tr>
            <tr><td><TeX src={`C_2'`} /></td><td className="num">6</td><td>{tr({ zh: '180° 棱中点轴', en: '180° edge-midpoint axis'
            })}</td><td className="num">≈ 9.3 × 10⁹</td></tr>
            <tr><td>i</td><td className="num">1</td><td>{tr({ zh: '中心反演', en: 'inversion through centre' })}</td><td className="num">≈ 10¹⁰</td></tr>
            <tr><td><TeX src={`S_6, S_4, \\sigma_h, \\sigma_d`} /></td><td className="num">23</td><td>{tr({ zh: '改进 / 镜像 / 旋反', en: 'improper / mirror / rotoreflection'
            })}</td><td className="num">{tr({ zh: '各类 10⁶–10¹⁰ 量级', en: 'class-dependent, 10⁶–10¹⁰ each'
            })}</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>典型 「k-fold 对称」 给出 <TeX src={`|\\operatorname{Fix}(g)| \\sim |G|^{1/k}`} /> 量级 (因为 k-fold 对称要求 (cp, co, ep, eo) 各自落在自己的 k-轨道 fixed locus)。 这是 Cauchy–Frobenius / Burnside 引理在魔方上的实际数值表现。</>}
            en={<>A typical "k-fold symmetric" element gives <TeX src={`|\\operatorname{Fix}(g)| \\sim |G|^{1/k}`} /> (because k-fold symmetry pins each of cp, co, ep, eo onto its own k-orbit fixed locus). This is the practical numerical form of the Cauchy–Frobenius / Burnside count applied to the cube.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="18.7  Pólya 计数 — 6-色立方体染色 = 30" en="18.7  Pólya enumeration — 30 distinct 6-coloured cubes" />
        </h3>
        <p>
          <L
            zh={<>经典 Pólya 应用: 「用 6 种颜色 给立方体 6 个面染色, 共有多少种本质不同的方式 (考虑 24 个旋转对称)?」 用 Burnside:</>}
            en={<>The classic Pólya example: "how many essentially different ways to colour the 6 faces of a cube with 6 colours, modulo 24 rotations?" By Burnside:</>}
          />
        </p>
        <TeXBlock src={`\\#\\,\\text{colourings} \\;=\\; \\frac{1}{24} \\sum_{g \\in \\text{Rot}(\\text{cube})} 6^{\\,\\text{cycles}(g)}`} />
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '旋转类', en: 'Rotation class'
            })}</th><th>{tr({ zh: '元素数', en: 'Count'
            })}</th><th>{tr({ zh: '面上循环数', en: '#cycles on faces'
            })}</th><th><TeX src={`6^{\\#\\text{cycles}}`} /></th><th>{tr({ zh: '贡献', en: 'Contribution'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td>e</td><td className="num">1</td><td className="num">6</td><td className="num">46,656</td><td className="num">46,656</td></tr>
            <tr><td><TeX src={`C_4`} /> (90°)</td><td className="num">6</td><td className="num">3</td><td className="num">216</td><td className="num">1,296</td></tr>
            <tr><td><TeX src={`C_2`} /> (180°)</td><td className="num">3</td><td className="num">4</td><td className="num">1,296</td><td className="num">3,888</td></tr>
            <tr><td><TeX src={`C_3`} /></td><td className="num">8</td><td className="num">2</td><td className="num">36</td><td className="num">288</td></tr>
            <tr><td><TeX src={`C_2'`} /></td><td className="num">6</td><td className="num">3</td><td className="num">216</td><td className="num">1,296</td></tr>
            <tr><td>{tr({ zh: '求和', en: 'Sum' })}</td><td colSpan={3} className="num"><TeX src={`\\sum`} /></td><td className="num"><strong>53,424</strong></td></tr>
          </tbody>
        </table>
        <TeXBlock src={`\\#\\,\\text{colourings} \\;=\\; \\frac{53{,}424}{24} \\;=\\; 2{,}226. \\quad \\text{(With exactly 6 distinct colours: } 6! / 24 = 30.\\text{)}`} />
        <p>
          <L
            zh={<>用「6 个面各取 6 种颜色一次」(即恰好每色用 1 次) 时, 结果是 <TeX src={`6!/24 = 30`} />。 这是经典魔方背后的 「30 个本质不同的着色立方体」 — 但 Erno Rubik 在 1974 年只想用 1 个特定着色, 然后让面块可以重排 (这才是 4.3 × 10¹⁹)。 两种 「数法」 数学上同源 (Burnside), 数量级差 18 个数量级。</>}
            en={<>For "exactly 6 distinct colours, one per face," the answer is <TeX src={`6!/24 = 30`} />. These are the 30 essentially distinct coloured cubes — but Erno Rubik (1974) used a single fixed colouring and let the stickers move around, giving 4.3 × 10¹⁹. Both counts are Burnside-style, separated by 18 orders of magnitude.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §25 Computational group theory ═══════════════════════ */}
      <GTSec id="computational" className="gt-sec">
        <div className="gt-sec-num">§25</div>
        <h2 className="gt-sec-title">
          <L zh="计算群论:BSGS 与 Schreier–Sims" en="Computational group theory: BSGS & Schreier–Sims" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>「精确算出 |G| = 43,252,003,274,489,856,000」 用的是什么算法? 不是公式 ——是一个叫 <strong>Schreier–Sims</strong> 的递归算法。 它建立 G 的 <strong>BSGS</strong> (基 + 强生成集), 这是 GAP、 Magma、 SageMath 等计算代数系统对所有有限置换群的标准内部表示。</>}
            en={<>How do we exactly compute |G| = 43,252,003,274,489,856,000? Not by formula — by a recursive algorithm called <strong>Schreier–Sims</strong>. It constructs G's <strong>BSGS</strong> (Base + Strong Generating Set), the canonical internal representation used by GAP, Magma, and SageMath for all finite permutation groups.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 25.1 — 基与稳定子链', en: 'Definition 25.1 — base & stabilizer chain'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>令 G 作用在集合 Ω 上 (魔方上 |Ω| = 48 个贴纸)。 选 <strong>基</strong> <TeX src={`B = (b_1, b_2, \\ldots, b_k) \\subset \\Omega`} /> 使得稳定子链<TeXBlock src={`G \\supset G^{(1)} \\supset G^{(2)} \\supset \\cdots \\supset G^{(k)} = \\{e\\}`} />其中 <TeX src={`G^{(i)} = \\operatorname{Stab}_G(b_1, \\ldots, b_i)`} />, 最后稳定到平凡。 然后 <TeX src={`|G| = \\prod_i |G^{(i-1)} \\cdot b_i|`} /> (轨道大小的乘积)。</>}
              en={<>Let G act on Ω (cube: |Ω| = 48 stickers). Choose a <strong>base</strong> <TeX src={`B = (b_1, b_2, \\ldots, b_k) \\subset \\Omega`} /> giving a stabilizer chain<TeXBlock src={`G \\supset G^{(1)} \\supset G^{(2)} \\supset \\cdots \\supset G^{(k)} = \\{e\\}`} />where <TeX src={`G^{(i)} = \\operatorname{Stab}_G(b_1, \\ldots, b_i)`} />. Then <TeX src={`|G| = \\prod_i |G^{(i-1)} \\cdot b_i|`} /> (product of orbit sizes).</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.1  互动:魔方稳定子链" en="25.1  Interactive: the cube's stabilizer chain" />
        </h3>
        <StabilizerChainExplorer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.2  Schreier–Sims 算法 (1970)" en="25.2  Schreier–Sims algorithm (1970)" />
        </h3>
        <p>
          <L
            zh={<>核心思想 (Schreier 1927 + Sims 1970): 给定生成元 <TeX src={`S = \\{s_1, \\ldots, s_m\\}`} />, 递归地建立基 B 和强生成集 <TeX src={`S^*`} />。 每一层用 <strong>Schreier 引理</strong> 计算下一层的生成元。 算法在 <TeX src={`O(n^5)`} /> 多项式时间内完成 (其中 n = |Ω|)。</>}
            en={<>Idea (Schreier 1927 + Sims 1970): given generators <TeX src={`S = \\{s_1, \\ldots, s_m\\}`} />, recursively build the base B and the strong generating set <TeX src={`S^*`} />. Use <strong>Schreier's lemma</strong> at each level to compute generators of the next stabilizer. The algorithm runs in polynomial time <TeX src={`O(n^5)`} /> with n = |Ω|.</>}
          />
        </p>
        <div className="gt-aside">
          <strong>GAP code</strong> ({tr({ zh: '验证 |G| = 4.3 × 10¹⁹', en: 'verify |G| = 4.3 × 10¹⁹'
        })}):
          <div className="gt-algo-pseudo" style={{ marginTop: 8 }}>
{`gap> G := Group(
>     (1,3,8,6)(2,5,7,4)(9,33,25,17)(10,34,26,18)(11,35,27,19),
>     # ... 5 more generators encoding U, D, L, R, F, B as permutations of 48 stickers
>     );;
gap> Size(G);
43252003274489856000
gap> StructureDescription(G);
"(C2 x C2 x C2 x C2 x C2 x C2 x C2) : ((C3 x C3 x C3 x C3 x C3 x C3 x C3) : (A8 x A12))"`}
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.3  Schreier 引理 + 伪代码" en="25.3  Schreier's lemma + pseudocode" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: 'Schreier 引理 (1927)', en: "Schreier's lemma (1927)" })}</div>
          <div className="gt-def-body">
            <L
              zh={<>设 <TeX src={`H \\leq G`} /> 指数 <TeX src={`[G : H]`} />, <TeX src={`T = \\{t_1, \\ldots, t_m\\}`} /> 是 H 在 G 中的一个左陪集代表系 (含 <TeX src={`t_1 = e`} />), 设 <TeX src={`S`} /> 为 G 的生成集。 对 <TeX src={`g \\in G`} />, 记 <TeX src={`\\bar g`} /> 为它在 T 中的陪集代表。 那么<TeXBlock src={`H \\;=\\; \\bigl\\langle\\, \\bar{(t \\cdot s)}^{-1} \\cdot (t \\cdot s) \\;:\\; t \\in T,\\; s \\in S \\,\\bigr\\rangle.`} />即 H 由这 <TeX src={`m |S|`} /> 个 「<em>Schreier 生成元</em>」 生成。</>}
              en={<>Let <TeX src={`H \\leq G`} /> have index <TeX src={`[G : H]`} />, <TeX src={`T = \\{t_1, \\ldots, t_m\\}`} /> a left transversal of H in G (with <TeX src={`t_1 = e`} />), and <TeX src={`S`} /> a generating set for G. For <TeX src={`g \\in G`} />, write <TeX src={`\\bar g`} /> for its T-representative. Then<TeXBlock src={`H \\;=\\; \\bigl\\langle\\, \\bar{(t \\cdot s)}^{-1} \\cdot (t \\cdot s) \\;:\\; t \\in T,\\; s \\in S \\,\\bigr\\rangle.`} />So H is generated by these <TeX src={`m |S|`} /> "<em>Schreier generators</em>".</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>把这个 「H 由 G 的生成集 + 陪集代表系生成」 反复套用 ── 这就是 Schreier–Sims 的递归核心:</>}
            en={<>Applying "H is generated by G-generators + transversal" recursively yields the Schreier–Sims algorithm:</>}
          />
        </p>
        <div className="gt-algo-pseudo">
{`SchreierSims(S, base B):
  for i = 1 to |B|:
    compute orbit O_i = G^(i-1) · b_i  via BFS on S^(i-1)
    record Schreier vector V_i (transversal lookup)
    derive  S^(i) = { Schreier generators for Stab(b_i) }
    recurse on (S^(i), B[i+1:])
  return BSGS = (B, S* = union of S^(i))

Size(G)  =  ∏_i  |O_i|
Membership(g):
  for i = 1 to |B|:
    let j = position of g(b_i) in O_i
    if j undefined: return false
    g = g · V_i[j]^(-1)
  return (g == identity)`}
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.4  魔方的具体稳定子链" en="25.4  The cube's stabilizer chain, explicitly" />
        </h3>
        <p>
          <L
            zh={<>取魔方的 「8 角 + 12 棱 (位置部分)」 一共 20 个块作 Ω。 一个自然基 <TeX src={`B = (1, 2, \\ldots, 20)`} /> 给出:</>}
            en={<>Take Ω = the 20 movable cubies (8 corners + 12 edges, position layer). A natural base <TeX src={`B = (1, 2, \\ldots, 20)`} /> yields:</>}
          />
        </p>
        <div className="gt-pattern-table">
          <table className="gt-pattern-tbl">
            <thead>
              <tr>
                <th>i</th>
                <th>{tr({ zh: '基点 b_i', en: 'base point b_i'
                })}</th>
                <th>|O_i|</th>
                <th>{tr({ zh: '稳定到', en: 'stabilizes to'
                })}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="num">1</td><td>{tr({ zh: '角块 URF', en: 'corner URF'
            })}</td><td className="num">8</td><td>G⁽¹⁾</td></tr>
              <tr><td className="num">2</td><td>{tr({ zh: '角块 UFL', en: 'corner UFL'
            })}</td><td className="num">7</td><td>G⁽²⁾</td></tr>
              <tr><td className="num">…</td><td>…</td><td className="num">…</td><td>…</td></tr>
              <tr><td className="num">8</td><td>{tr({ zh: '最后角', en: 'last corner'
            })}</td><td className="num">3</td><td>{tr({ zh: '角朝向 ÷ 3', en: 'cor twists ÷ 3' })}</td></tr>
              <tr><td className="num">9</td><td>{tr({ zh: '棱块 UR', en: 'edge UR'
            })}</td><td className="num">12</td><td>G⁽⁹⁾</td></tr>
              <tr><td className="num">…</td><td>…</td><td className="num">…</td><td>…</td></tr>
              <tr><td className="num">19</td><td>{tr({ zh: '最后棱', en: 'last edge'
            })}</td><td className="num">2</td><td>{tr({ zh: '棱翻 ÷ 2', en: 'edge flip ÷ 2'
            })}</td></tr>
              <tr><td className="num">20</td><td>{tr({ zh: '奇偶', en: 'parity' })}</td><td className="num">1</td><td>{`{e}`}</td></tr>
            </tbody>
          </table>
        </div>
        <TeXBlock src={`|G| \\;=\\; \\underbrace{8 \\cdot 7 \\cdot 6 \\cdots 2}_{= 8!} \\,\\cdot\\, \\underbrace{3}_{\\text{corner twist}} \\,\\cdot\\, \\underbrace{12 \\cdot 11 \\cdots 2}_{= 12!} \\,\\cdot\\, \\underbrace{2}_{\\text{edge flip}} \\,\\cdot\\, \\underbrace{1}_{\\text{parity}} \\,\\cdot\\, \\underbrace{3^6}_{\\text{prior twists}} \\,\\cdot\\, \\underbrace{2^{10}}_{\\text{prior flips}}`} />
        <p>
          <L
            zh={<>把所有轨道大小乘起来精确给出 <TeX src={`8!\\,\\cdot\\,12!\\,\\cdot\\,3^7\\,\\cdot\\,2^{11}/2 = 43{,}252{,}003{,}274{,}489{,}856{,}000`} />。 这是 BSGS 比 「直接乘公式」 更基础的原因 ── 它不需要先 「知道」 守恒律, 它 <em>从生成元出发推出</em> 守恒律。</>}
            en={<>Multiplying the orbit sizes gives precisely <TeX src={`8!\\,\\cdot\\,12!\\,\\cdot\\,3^7\\,\\cdot\\,2^{11}/2 = 43{,}252{,}003{,}274{,}489{,}856{,}000`} />. This is why BSGS is more fundamental than the closed-form factorization — it doesn't <em>assume</em> the invariants; it <em>derives</em> them from generators.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.5  复杂度与相关算法" en="25.5  Complexity & related algorithms" />
        </h3>
        <p>
          <L
            zh={<>Schreier–Sims 在 「<em>确定型</em>」 实现下复杂度 <TeX src={`O(n^5 + n^2 |S|)`} />, 内存 <TeX src={`O(n^2 |B| + |S^*|)`} />。 改进版本:</>}
            en={<>Deterministic Schreier–Sims runs in <TeX src={`O(n^5 + n^2 |S|)`} /> time, <TeX src={`O(n^2 |B| + |S^*|)`} /> memory. Improved variants:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>Sims 1971 (Las Vegas)</strong>: <TeX src={`O(n^4 \\log |G|)`} /> 期望时间。</>} en={<><strong>Sims 1971 (Las Vegas)</strong>: expected time <TeX src={`O(n^4 \\log |G|)`} />.</>} /></li>
          <li><L zh={<><strong>Knuth 1991</strong>: 加入 <em>strong generators 重组</em>, 实际常数小一个数量级。</>} en={<><strong>Knuth 1991</strong>: with <em>strong-generator reorganisation</em>, an order of magnitude faster in practice.</>} /></li>
          <li><L zh={<><strong>Babai–Cooperman 1989</strong>: 引入 「<em>nearly linear time</em>」 BSGS, 期望 <TeX src={`O(n^2 \\log^c n)`} />。</>} en={<><strong>Babai–Cooperman 1989</strong>: introduced "<em>nearly-linear-time</em>" BSGS, expected <TeX src={`O(n^2 \\log^c n)`} />.</>} /></li>
          <li><L zh={<><strong>Holt–Eick–O'Brien 2005</strong> (现代 GAP/Magma 后端): 经验复杂度 <TeX src={`\\sim n^3`} />, 把 |Ω| ~ 10⁶ 的群作几秒内可处理。</>} en={<><strong>Holt–Eick–O'Brien 2005</strong> (modern GAP/Magma backend): empirical <TeX src={`\\sim n^3`} />, handling |Ω| ~ 10⁶ groups in seconds.</>} /></li>
        </ul>
        <p>
          <L
            zh={<>跟 BSGS 平行的几个计算群论算法:</>}
            en={<>BSGS-adjacent algorithms in the computational toolkit:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>Todd–Coxeter (1936)</strong>: 给定群 G 的 「<em>有限呈现</em>」 (生成元 + 关系) 和子群 H, 枚举陪集 G/H。 跟 BSGS 是 <em>对偶</em> 的: 一个从置换出发, 一个从关系出发。</>} en={<><strong>Todd–Coxeter (1936)</strong>: given a <em>finite presentation</em> (generators + relations) and a subgroup H, enumerates cosets G/H. <em>Dual</em> to BSGS: one starts from permutations, the other from relations.</>} /></li>
          <li><L zh={<><strong>Baby-step giant-step</strong>: 对 「字问题」 给 <TeX src={`O(\\sqrt{|G|})`} /> 算法, 不依赖结构 ── 对 G ≈ 4.3 × 10¹⁹ 仍是 ~6 × 10⁹ 操作, 实际不可行。 BSGS 把这压到 O(n²) ── 这就是为什么 「BSGS 是基础」。</>} en={<><strong>Baby-step giant-step</strong>: gives <TeX src={`O(\\sqrt{|G|})`} /> for the word problem, agnostic to structure — but for G ≈ 4.3 × 10¹⁹ that's still ~6 × 10⁹ operations, infeasible. BSGS reduces it to O(n²) — which is why "BSGS is foundational."</>} /></li>
          <li><L zh={<><strong>Brownian motion in the symmetric group</strong> (Diaconis): 把 BSGS 跟 §24 的随机游走耦合, 给出 「随机生成元生成全 G 的期望次数」。</>} en={<><strong>Brownian motion in the symmetric group</strong> (Diaconis): couples BSGS with §24's random walks, giving the expected number of random generators needed to generate all of G.</>} /></li>
        </ul>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.6  为什么这对魔方算法重要?" en="25.6  Why does this matter for cube algorithms?" />
        </h3>
        <p>
          <L
            zh={<>BSGS 是 「<strong>membership test</strong>」 的天然数据结构: 给定一个置换 g, 它属于 G 吗? 答: 逐层用 Schreier 表反向把 g 分解; 若能完全归约就属于。 用 <TeX src={`O(k \\cdot n^2)`} /> 时间。 这个数据结构对求解器没直接用 (求解器需要 <em>短</em> 表示, BSGS 给的是 <em>长</em> 表示, 平均 ~ <TeX src={`\\log |G| \\approx 65`} /> 步), 但对群论问题非常有效:</>}
            en={<>BSGS is the natural data structure for the <strong>membership test</strong>: given g, is g ∈ G? Layer-by-layer reduce via Schreier transversals; total fully reduced ⇒ yes. Time <TeX src={`O(k \\cdot n^2)`} />. Not directly useful for solvers (they need <em>short</em> presentations; BSGS gives <em>long</em> ones, average <TeX src={`\\log |G| \\approx 65`} /> moves), but indispensable for group questions:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh="「这一组 alg 能否生成全 G?」 ── 试着 BSGS 一次,看 Size 是否等于 |G|" en={`"Does this alg set generate all of G?" — run BSGS, check if Size equals |G|.`} /></li>
          <li><L zh="「这个子群的指数是多少?」 ── BSGS 给指数即 |G| / |H|" en={`"What is the index of this subgroup?" — BSGS yields |H| directly, hence |G|/|H|.`} /></li>
          <li><L zh="「枚举共轭类 / 中心 / 换位子群」 ── BSGS 提供 G 上的 「随机均匀采样」 算法 (Furst–Hopcroft–Luks)" en={`"Enumerate conjugacy classes / centre / commutator subgroup" — BSGS yields a uniform-random sampling algorithm on G (Furst–Hopcroft–Luks).`} /></li>
        </ul>
      </GTSec>














      {/* ═══════════════ §32 Useful Mathematics ════════════════════════ */}



      {/* Extended sections §33–§62 + §REF (refs): self-contained files, lazy-loaded per slug */}
      {!isIndex && slug && EXT_COMPONENTS[slug] && <NewSectionMount slug={slug} />}

      {!isIndex && slugValid && <SectionNav slug={slug!} lang={lang} />}

      <div className="gt-end-mark">∎</div>

      <div className="gt-foot">cuberoot.me · {tr({ zh: '魔方与群论', en: 'Rubik\'s Cube as a Group'
    })} · 2026</div>
    </div>
    </SlugContext.Provider>
  );
}

// ── Section-page navigation footer (prev / next / back to TOC) ────────────
function SectionNav({ slug }: { slug: string; lang: Lang }) {
  const all = TOC;
  const idx = all.findIndex(s => s.id === slug);
  if (idx < 0) return null;
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;
  return (
    <nav className="gt-section-nav" aria-label="section navigation">
      <div className="gt-section-nav-cell gt-section-nav-prev">
        {prev ? (
          <Link href={`/math/group/${prev.id}`}>
            <div className="gt-section-nav-dir">← {tr({ zh: '上一节', en: 'previous'
            })}</div>
            <div className="gt-section-nav-num">§{prev.num}</div>
            <div className="gt-section-nav-title">{tr(prev)}</div>
          </Link>
        ) : <div className="gt-section-nav-empty" />}
      </div>
      <div className="gt-section-nav-cell gt-section-nav-toc">
        <Link href="/math/group">
          <div className="gt-section-nav-dir">↑ {tr({ zh: '回到目录', en: 'contents'
        })}</div>
        </Link>
      </div>
      <div className="gt-section-nav-cell gt-section-nav-next">
        {next ? (
          <Link href={`/math/group/${next.id}`}>
            <div className="gt-section-nav-dir">{tr({ zh: '下一节', en: 'next'
            })} →</div>
            <div className="gt-section-nav-num">§{next.num}</div>
            <div className="gt-section-nav-title">{tr(next)}</div>
          </Link>
        ) : <div className="gt-section-nav-empty" />}
      </div>
    </nav>
  );
}

const TOC: { id: string; num: string; zh: string; en: string
 }[] = [
  { id: 'what-is-a-group',   num: '1',  zh: '什么是群',                 en: 'What is a group?'
},
  { id: 'cube-group',         num: '2',  zh: '魔方群 G',                 en: 'The cube group G' },
  { id: 'state-vector',       num: '3',  zh: '状态向量 (cp, co, ep, eo)', en: 'State vector'
},
  { id: 'order',              num: '4',  zh: 'G 的阶',                  en: 'The order |G|'
},
  { id: 'invariants',         num: '5',  zh: '三个守恒律 + 证明',         en: 'Three invariants + proofs'
},
  { id: 'structure',          num: '6',  zh: '结构定理',                 en: 'Structure theorem'
},
  { id: 'order-of-element',   num: '7',  zh: '元素的阶',                 en: 'Order of an element'
},
  { id: 'conjugation',        num: '8',  zh: '共轭与共轭类',              en: 'Conjugation'
},
  { id: 'commutators',        num: '9',  zh: '换位子 + 中心',            en: 'Commutators + centre'
},
  { id: 'thistlethwaite',     num: '10', zh: 'Thistlethwaite 子群链',    en: 'Subgroup chain'
},
  { id: 'gods-number',        num: '11', zh: '上帝之数 = 20',           en: "God's number = 20"
},
  { id: 'beyond',             num: '12', zh: '走得更远',                en: 'Beyond the cube'
},
  { id: 'patterns',           num: '13', zh: '著名图案画廊',             en: 'Famous patterns'
},
  { id: 'cayley',             num: '14', zh: 'Cayley 图',              en: 'Cayley graph'
},
  { id: 'other-puzzles',      num: '15', zh: '其它扭转拼图',             en: 'Other twisting puzzles'
},
  { id: 'open-problems',      num: '16', zh: '未解问题',                 en: 'Open problems'
},
  { id: 'homomorphisms',      num: '17', zh: '同态与第一同构定理',        en: 'Homomorphisms'
},
  { id: 'actions-burnside',   num: '18', zh: '群作用 + Burnside',         en: 'Group actions + Burnside' },
  { id: 'lagrange',           num: '19', zh: '拉格朗日定理 + 陪集',        en: 'Lagrange + cosets' },
  { id: 'quotient',           num: '20', zh: '正规子群 + 商群',            en: 'Normal subgroups + quotients'
},
  { id: 'permutation-groups', num: '21', zh: '置换群 Sₙ 与交错群 Aₙ',       en: 'Symmetric & alternating groups'
},
  { id: 'algorithms',         num: '22', zh: '解魔方的算法',               en: 'Solving algorithms'
},
  { id: 'distance',           num: '23', zh: '距离分布与 20 步证明',       en: 'Distance distribution'
},
  { id: 'random-walks',       num: '24', zh: '群上的随机游走',             en: 'Random walks on G'
},
  { id: 'computational',      num: '25', zh: '计算群论:BSGS 与 Schreier–Sims', en: 'Computational group theory'
},
  { id: 'representations',    num: '26', zh: '表示论一瞥',                en: 'A glimpse of representation theory'
},
  { id: 'lights-out',         num: '27', zh: 'Lights Out 与 𝔽₂ 线性代数',  en: 'Lights Out · linear algebra over 𝔽₂'
},
  { id: 'peg-solitaire',      num: '28', zh: '孔明棋 · 三染色不变量',       en: 'Peg solitaire · 3-colouring invariant'
},
  { id: 'hamiltonian',        num: '29', zh: 'Hamilton 路径 + Gray 码',     en: 'Hamiltonian paths + Gray codes'
},
  { id: 'two-face-pgl',       num: '30', zh: '两面 6 角 ≅ PGL₂(𝔽₅) ≅ S₅',  en: 'Two-face corners ≅ PGL₂(𝔽₅) ≅ S₅'
},
  { id: 'rotational-puzzles', num: '31', zh: '图上的旋转拼图 · (x,y,z)',    en: 'Rotational puzzles on graphs · (x,y,z)'
},
  { id: 'useful-math',        num: '32', zh: '有用数学 · 排列可视化',         en: 'Useful mathematics · permutation visualiser'
},
  { id: 'wreath-product',      num: '33', zh: '圈积 Wreath',                en: 'Wreath products'
},
  { id: 'semidirect-product',  num: '34', zh: '半直积',                    en: 'Semidirect products'
},
  { id: 'sylow',               num: '35', zh: 'Sylow 定理',                en: 'Sylow theorems' },
  { id: 'composition-series',  num: '36', zh: '合成列与 Jordan–Hölder',    en: 'Composition series'
},
  { id: 'solvable-nilpotent',  num: '37', zh: '可解群与幂零群',            en: 'Solvable & nilpotent'
},
  { id: 'abelian-classification', num: '38', zh: '有限阿贝尔群基本定理',    en: 'Finite abelian groups'
},
  { id: 'automorphism-group',  num: '39', zh: '自同构群 Aut(G)',           en: 'Automorphism groups'
},
  { id: 'cyclic-modular',      num: '40', zh: '循环群与模算术',            en: 'Cyclic & modular'
},
  { id: 'dihedral',            num: '41', zh: '二面体群 Dₙ',               en: 'Dihedral groups'
},
  { id: 'platonic-symmetry',   num: '42', zh: '柏拉图立体的对称群',        en: 'Platonic symmetry'
},
  { id: 'frieze-groups',       num: '43', zh: '七种带饰群',                en: 'The 7 frieze groups'
},
  { id: 'wallpaper-groups',    num: '44', zh: '十七种墙纸群',              en: 'The 17 wallpaper groups'
},
  { id: 'point-groups-crystal', num: '45', zh: '点群与晶体学',             en: 'Point groups & crystals'
},
  { id: 'reflection-coxeter',  num: '46', zh: '反射群与 Coxeter 群',       en: 'Reflection & Coxeter'
},
  { id: 'plane-isometries',    num: '47', zh: '平面等距群',                en: 'Plane isometries' },
  { id: 'polya-cube-colorings', num: '48', zh: '数立方体染色 (Burnside–Pólya)', en: 'Counting cube colourings'
},
  { id: 'cycle-index',         num: '49', zh: '轮换指标多项式',            en: 'Cycle-index polynomial'
},
  { id: 'class-equation',      num: '50', zh: '类方程',                    en: 'The class equation'
},
  { id: 'character-table',     num: '51', zh: '特征标表',                  en: 'Character tables'
},
  { id: 'young-tableaux',      num: '52', zh: 'Young 图与 Sₙ 表示',        en: 'Young tableaux'
},
  { id: 'representation-basics', num: '53', zh: '表示与不可约分解',        en: 'Representations'
},
  { id: 'fourier-on-groups',   num: '54', zh: '群上的傅里叶分析',          en: 'Fourier on groups'
},
  { id: 'quaternion-group',    num: '55', zh: '四元数群 Q₈',              en: 'Quaternion group Q₈'
},
  { id: 'free-groups',         num: '56', zh: '自由群与约简字',            en: 'Free groups'
},
  { id: 'cayley-theorem',      num: '57', zh: 'Cayley 定理',              en: "Cayley's theorem" },
  { id: 'orbit-stabilizer',    num: '58', zh: '轨道–稳定子定理',          en: 'Orbit–stabiliser'
},
  { id: 'matrix-lie-groups',   num: '59', zh: '矩阵群与李群',              en: 'Matrix & Lie groups'
},
  { id: 'galois-connection',   num: '60', zh: '伽罗瓦理论与可解性',        en: 'Galois & solvability'
},
  { id: 'growth-of-groups',    num: '61', zh: '群的增长',                  en: 'Growth of groups'
},
  { id: 'expander-ramanujan',  num: '62', zh: '扩张图与 Ramanujan 图',     en: 'Expanders & Ramanujan'
},
  { id: 'refs',               num: 'REF', zh: '参考文献',                   en: 'References'
},
];
