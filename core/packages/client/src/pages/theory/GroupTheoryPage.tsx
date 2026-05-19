/**
 * /theory/group — Rubik's Cube and group theory.
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
import { useEffect, useState, useMemo, useRef, useCallback, createContext, useContext, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import {
  identity, applyAlg, orderOf, invariants, invertAlg, conjugate, commutator,
  tokenize, isSolved, thistlethwaiteStage, cycleStructure, permSign,
  type CubieState,
} from './cube_state';
import './group_theory.css';

// ── LaTeX rendering via KaTeX ───────────────────────────────────────────────
function TeX({ src }: { src: string }) {
  const html = useMemo(() => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore' }), [src]);
  return <span className="gt-tex" dangerouslySetInnerHTML={{ __html: html }} />;
}
function TeXBlock({ src }: { src: string }) {
  const html = useMemo(() => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore', displayMode: true }), [src]);
  // Use <span> with display:block so it can sit inside <p> without hydration errors.
  return <span className="gt-tex-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Slug context for per-section pages ─────────────────────────────────────
// Slug is undefined on the index page (just hero + TOC), or one of the TOC ids
// on a section sub-page. GTSec renders only when its id matches the slug — so
// a single big return body can serve both modes.
const SlugContext = createContext<string | undefined>(undefined);

function GTSec({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const slug = useContext(SlugContext);
  if (slug !== id) return null;
  return <section id={id} className={className}>{children}</section>;
}

// ── i18n helpers ────────────────────────────────────────────────────────────
type Lang = 'zh' | 'en';
function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  return <>{lang === 'zh' ? zh : en}</>;
}
function useLang(): Lang {
  const { i18n } = useTranslation();
  return i18n.language.startsWith('zh') ? 'zh' : 'en';
}

// ── Inline TwistyPlayer ─────────────────────────────────────────────────────
// Self-contained wrapper around cubing.js. Imported lazily to keep first paint
// quick. Each instance has its own player.
function TwistyMini({
  alg,
  setupAlg,
  visualization = '3D',
  onPlayerReady,
}: {
  alg: string;
  setupAlg?: string;
  visualization?: '2D' | '3D' | 'PG3D';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPlayerReady?: (player: any) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Ctor, setCtor] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onPlayerReady);
  readyRef.current = onPlayerReady;

  useEffect(() => {
    let cancelled = false;
    import('cubing/twisty').then((mod) => {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const C = (mod as any).TwistyPlayer;
      setCtor(() => C);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!Ctor || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const player = new Ctor({
      puzzle: '3x3x3',
      alg,
      experimentalSetupAlg: setupAlg ?? '',
      visualization,
      controlPanel: 'bottom-row',
      background: 'none',
      hintFacelets: 'none',
    });
    player.style.width = '100%';
    player.style.height = '100%';
    container.appendChild(player);
    readyRef.current?.(player);
  }, [Ctor, alg, setupAlg, visualization]);

  return <div ref={containerRef} className="gt-cube-host" />;
}

// ── §1 What is a group?  axiom table ───────────────────────────────────────
function AxiomTable() {
  return (
    <div className="gt-axioms">
      <div className="gt-axiom">
        <div className="gt-axiom-num">G1</div>
        <div className="gt-axiom-name">
          <L zh="封闭性" en="Closure" />
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 400, marginTop: 4 }}>
            ∀ a, b ∈ G : a · b ∈ G
          </div>
        </div>
        <div className="gt-axiom-cube">
          <L
            zh={<>任何两个魔方操作 <TeX src={`a, b`} /> 复合后,仍然是一个有效操作。<span className="gt-mono">R</span> 接着 <span className="gt-mono">U</span> 还是合法操作。</>}
            en={<>The composition of two cube moves is again a cube move. <span className="gt-mono">R</span> followed by <span className="gt-mono">U</span> is still a legal cube operation.</>}
          />
        </div>
      </div>
      <div className="gt-axiom">
        <div className="gt-axiom-num">G2</div>
        <div className="gt-axiom-name">
          <L zh="结合律" en="Associativity" />
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 400, marginTop: 4 }}>
            (a · b) · c = a · (b · c)
          </div>
        </div>
        <div className="gt-axiom-cube">
          <L
            zh={<>先做 <span className="gt-mono">R U</span> 再做 <span className="gt-mono">F</span>,跟先做 <span className="gt-mono">R</span> 再做 <span className="gt-mono">U F</span>,结果完全一样。每次转面都是物理动作,先后顺序在三元组内任意配对。</>}
            en={<>Doing <span className="gt-mono">R U</span> then <span className="gt-mono">F</span> equals doing <span className="gt-mono">R</span> then <span className="gt-mono">U F</span>. Composing physical moves is associative — bracketing has no semantic effect.</>}
          />
        </div>
      </div>
      <div className="gt-axiom">
        <div className="gt-axiom-num">G3</div>
        <div className="gt-axiom-name">
          <L zh="单位元" en="Identity" />
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 400, marginTop: 4 }}>
            ∃ e ∈ G : e · a = a · e = a
          </div>
        </div>
        <div className="gt-axiom-cube">
          <L
            zh={<>不动魔方 = 单位元 <TeX src={`e`} />。 空操作。 它跟任何操作复合都等于该操作。</>}
            en={<>Doing nothing is the identity element <TeX src={`e`} />. The empty alg. Composing it with any move <TeX src={`a`} /> gives back <TeX src={`a`} />.</>}
          />
        </div>
      </div>
      <div className="gt-axiom">
        <div className="gt-axiom-num">G4</div>
        <div className="gt-axiom-name">
          <L zh="逆元" en="Inverse" />
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 400, marginTop: 4 }}>
            ∀ a : ∃ a⁻¹ : a · a⁻¹ = e
          </div>
        </div>
        <div className="gt-axiom-cube">
          <L
            zh={<>每个操作都能撤销。<span className="gt-mono">R</span> 的逆是 <span className="gt-mono">R′</span>。<span className="gt-mono">R U R′ U′</span> 的逆是 <span className="gt-mono">U R U′ R′</span> —— 反过来逐个取逆。</>}
            en={<>Every move can be undone. The inverse of <span className="gt-mono">R</span> is <span className="gt-mono">R′</span>. The inverse of <span className="gt-mono">R U R′ U′</span> is <span className="gt-mono">U R U′ R′</span> — reverse the sequence and invert each move.</>}
          />
        </div>
      </div>
    </div>
  );
}

// ── §3 Generator demos  six face turns ─────────────────────────────────────
function GeneratorRow() {
  const faces: { f: string; zh: string; en: string }[] = [
    { f: 'U', zh: '上层顺时针', en: 'Up' },
    { f: 'D', zh: '下层顺时针', en: 'Down' },
    { f: 'R', zh: '右层顺时针', en: 'Right' },
    { f: 'L', zh: '左层顺时针', en: 'Left' },
    { f: 'F', zh: '前层顺时针', en: 'Front' },
    { f: 'B', zh: '后层顺时针', en: 'Back' },
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
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § 状态张量分解' : 'Interactive § State tensor'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? '魔方状态 = (cp, co, ep, eo) 四元组。输入任意公式,看四个数组随之变化。'
          : 'A cube state is the 4-tuple (cp, co, ep, eo). Type any alg, watch the four arrays mutate.'}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} placeholder="R U R' U' …" />
        <button className="gt-btn-ghost gt-btn" onClick={() => setAlg('')}>{lang === 'zh' ? '清空' : 'reset'}</button>
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
          <div className="gt-result-label">{lang === 'zh' ? '角块循环型' : 'corner cycle type'}</div>
          <div className="gt-result-val">{formatCycle(cycleStructure(state.cp), lang)}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{lang === 'zh' ? '棱块循环型' : 'edge cycle type'}</div>
          <div className="gt-result-val">{formatCycle(cycleStructure(state.ep), lang)}</div>
        </div>
      </div>
    </div>
  );
}

function formatCycle(cycles: number[], lang: Lang): string {
  if (cycles.length === 0) return lang === 'zh' ? '恒等 (无循环)' : 'identity (no cycles)';
  return cycles.map(c => `${c}-cycle`).join(' × ');
}

// ── §6 InvariantInspector ──────────────────────────────────────────────────
function InvariantInspector() {
  const lang = useLang();
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
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § 三个守恒律' : 'Interactive § Three invariants'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? '凡是合法的魔方状态都满足三条约束。手动破坏任何一条,状态就不可达 (即,无法仅靠 6 个面转出来)。'
          : 'Every legal cube state satisfies three constraints. Manually break any one and the state is unreachable — no sequence of face turns can produce it.'}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        <span className={`gt-chip ${breakCo ? 'gt-chip-active' : ''}`} onClick={() => setBreakCo(v => !v)}>
          {lang === 'zh' ? '手扭角块 0' : 'twist corner 0'}
        </span>
        <span className={`gt-chip ${breakEo ? 'gt-chip-active' : ''}`} onClick={() => setBreakEo(v => !v)}>
          {lang === 'zh' ? '手翻棱块 0' : 'flip edge 0'}
        </span>
        <span className={`gt-chip ${swapEdges ? 'gt-chip-active' : ''}`} onClick={() => setSwapEdges(v => !v)}>
          {lang === 'zh' ? '交换两棱块' : 'swap two edges'}
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
          ? (lang === 'zh' ? '✓ 可达 — 该状态是 G 的元素' : '✓ Reachable — this state is in G')
          : (lang === 'zh' ? '✗ 不可达 — 该状态不在 G 中' : '✗ Unreachable — this state is not in G')}
      </div>
    </div>
  );
}

// ── §7 PeriodExplorer ──────────────────────────────────────────────────────
function PeriodExplorer() {
  const lang = useLang();
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
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § 元素阶' : 'Interactive § Order of an element'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? '一个公式重复多少次能回到起点?这就是它的「阶」。点几个常见例子看看。'
          : 'Repeat a sequence until it returns to identity. The smallest such count is its order.'}
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
          {lang === 'zh' ? '播放轨道' : 'play orbit'}
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={stop}>
          {lang === 'zh' ? '停' : 'stop'}
        </button>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', marginLeft: 'auto' }}>
          {iter > 0 ? `${iter} / ${period}` : ''}
        </span>
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <div className="gt-result-label">{lang === 'zh' ? '阶 (返回单位元所需重复数)' : 'order (period)'}</div>
          <div className="gt-result-val-strong">{period === null ? '—' : period}</div>
        </div>
        {showOver && (
          <div className="gt-aside" style={{ marginTop: 12 }}>
            {lang === 'zh' ? '阶 > 60,动画不再播放;轨道太长,光看图就够。' : 'Order > 60 — orbit too long to animate, but the chart shows the full trajectory.'}
          </div>
        )}
      </div>

      {trajectory.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 4 }}>
            {lang === 'zh' ? '与单位元的距离 (错位件数), 每次幂' : 'distance from identity (mismatched positions), per power'}
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
  const lang = useLang();
  const [a, setA] = useState('U');
  const [b, setB] = useState('R E R');
  // For visualization clarity, we let user choose. Show the full alg A B A'.
  const full = useMemo(() => conjugate(a, b), [a, b]);
  const validA = useMemo(() => safeTok(a), [a]);
  const validB = useMemo(() => safeTok(b), [b]);
  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § 共轭 A B A⁻¹' : 'Interactive § Conjugate A B A⁻¹'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? '共轭 = 把 B 这个操作「搬到另一个位置去做」。先用 A 把目标移过来,执行 B,再 A 撤回。'
          : 'A conjugate moves operation B "to another location": A sets up, B acts, A⁻¹ undoes the setup.'}
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

  const presets: { a: string; b: string; name: string; zh: string; en: string }[] = [
    { a: "R U R'", b: "D",            name: "edge 3-cycle",     zh: '棱块 3-循环', en: 'edge 3-cycle' },
    { a: "[R, U]", b: "[U, R]",       name: "wrong (nested)",   zh: '嵌套例', en: 'nested example' },
    { a: "U R U'", b: "L'",          name: "corner 3-cycle",   zh: '角块 3-循环', en: 'corner 3-cycle' },
    { a: "R",     b: "U",            name: "the sexy",         zh: '小鱼起手', en: 'sexy' },
    { a: "M",     b: "U",            name: "M-slice cycle",    zh: 'M 切片循环', en: 'M-slice cycle' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § 换位子 [A, B] = A B A⁻¹ B⁻¹' : 'Interactive § Commutator [A, B] = A B A⁻¹ B⁻¹'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? '换位子是高级解法的灵魂。它衡量「A 和 B 互不交换的程度」—— 如果它们交换,[A, B] = e。'
          : 'The commutator measures how far A and B fail to commute. If they commute, [A, B] = e.'}
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
            <div className="gt-result-label">{lang === 'zh' ? '完整公式' : 'expanded'}</div>
            <div className="gt-result-val-strong">{full}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label">{lang === 'zh' ? '是否单位元' : 'identity?'}</div>
            <div className="gt-result-val">{stateResult.solved ? (lang === 'zh' ? '是 (A, B 互换)' : 'yes (A and B commute)') : (lang === 'zh' ? '否' : 'no')}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label">{lang === 'zh' ? '角块循环型' : 'corner cycles'}</div>
            <div className="gt-result-val">{formatCycle(stateResult.cornerCycles, lang)}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label">{lang === 'zh' ? '棱块循环型' : 'edge cycles'}</div>
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
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § 中心验证 — g 是否跟所有面转交换?' : 'Interactive § Centre check — does g commute with every face turn?'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? '逐个验证 [g, X] = e 对 6 个生成元成立 ⇔ g ∈ Z(G)。理论已证 Z(G) = {e, superflip} 阶 2。'
          : 'For each face turn X, check [g, X] = e. If all six pass, then g ∈ Z(G). Theory says Z(G) = {e, superflip} of order 2.'}
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
          ? (lang === 'zh' ? '✓ g ∈ Z(G) — 跟全部 6 个面转都交换' : '✓ g ∈ Z(G) — commutes with every face turn')
          : (lang === 'zh' ? '✗ g ∉ Z(G)' : '✗ g ∉ Z(G)')}
      </div>
    </div>
  );
}
type FaceLetterChar = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

// ── §8.2 ConjugacyClassTable — cycle types of common algs ──────────────────
function ConjugacyClassTable() {
  const lang = useLang();
  const samples: { alg: string; nameZh: string; nameEn: string }[] = [
    { alg: 'R',                                       nameZh: '单面转',          nameEn: 'single face turn' },
    { alg: "R U R' U'",                                nameZh: '小鱼起手 (sexy)',    nameEn: 'sexy move' },
    { alg: 'R L',                                      nameZh: '对面同时转',       nameEn: 'opposite-face pair' },
    { alg: "R U R' U R U2 R'",                         nameZh: '小鱼 (Sune)',     nameEn: 'Sune' },
    { alg: "F R U' R' U' R U R' F'",                   nameZh: 'OLL 26',            nameEn: 'OLL 26' },
    { alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2", nameZh: 'superflip', nameEn: 'superflip' },
    { alg: 'U2 D2 F2 B2 L2 R2',                        nameZh: '棋盘 checker',      nameEn: 'checkerboard' },
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
          <th>{lang === 'zh' ? '公式' : 'Alg'}</th>
          <th>{lang === 'zh' ? '角块循环型' : 'Corner cycle type'}</th>
          <th>{lang === 'zh' ? '棱块循环型' : 'Edge cycle type'}</th>
          <th>{lang === 'zh' ? '阶' : 'Order'}</th>
          <th>{lang === 'zh' ? '奇偶' : 'sgn'}</th>
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
  const lang = useLang();
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
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § 同态性质 sgn(g·h) = sgn(g) · sgn(h)' : 'Interactive § Homomorphism check sgn(g·h) = sgn(g) · sgn(h)'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? 'sgn 把 G 映到 ℤ/2 = {±1}。要验证它是同态:对任意 g, h ∈ G,应有 sgn(g·h) = sgn(g) · sgn(h)。'
          : 'sgn maps G → ℤ/2 = {±1}. To check it is a homomorphism: for any g, h ∈ G, we need sgn(g·h) = sgn(g) · sgn(h).'}
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
          ? (lang === 'zh' ? '✓ 同态性质成立' : '✓ homomorphism property holds')
          : (lang === 'zh' ? '✗ 同态性质失败 (不可能发生 — 这是定理)' : '✗ homomorphism property fails (impossible — this is a theorem)')}
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
  const rows: { sym: string; symEn: string; symZh: string; fixed: string; comment: string; commentZh: string }[] = [
    { sym: 'identity (e)',         symEn: 'identity',           symZh: '恒等',
      fixed: '4.3 × 10¹⁹',          comment: 'all of G fixed',                commentZh: '所有状态都被恒等固定' },
    { sym: '90° rotation × 6',     symEn: 'face 90° rotation',   symZh: '面 90° 旋转',
      fixed: '~1.4 × 10⁹ each',     comment: 'states with that 4-fold symmetry', commentZh: '具有该 4 重对称的状态' },
    { sym: '180° rotation × 9',    symEn: 'face/edge 180° rotation', symZh: '面/棱 180° 旋转',
      fixed: '~10¹⁰ each',          comment: 'states with that 2-fold symmetry', commentZh: '具有该 2 重对称的状态' },
    { sym: '120° rotation × 8',    symEn: 'corner 120° rotation', symZh: '角块 120° 旋转',
      fixed: '~10⁶ each',           comment: 'states with that 3-fold symmetry', commentZh: '具有该 3 重对称的状态' },
    { sym: 'mirror × 24',          symEn: 'mirror reflection',   symZh: '镜面反射',
      fixed: '~10⁹ each',           comment: 'mirror-symmetric states',          commentZh: '镜像对称状态' },
  ];
  return (
    <table className="gt-compare">
      <thead>
        <tr>
          <th>{lang === 'zh' ? '对称变换' : 'Symmetry'}</th>
          <th>{lang === 'zh' ? '不动点 (Fix g)' : 'Fixed states (Fix g)'}</th>
          <th>{lang === 'zh' ? '说明' : 'Meaning'}</th>
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
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § 选一个外部对称变换' : 'Interactive § Pick an outer cube symmetry'}</div>
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
          <div className="gt-result-label">{lang === 'zh' ? '类' : 'class'}</div>
          <div className="gt-result-val-strong">{lang === 'zh' ? sym.nameZh : sym.name}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{lang === 'zh' ? '元素个数' : 'elements'}</div>
          <div className="gt-result-val">{sym.count}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{lang === 'zh' ? '阶' : 'order'}</div>
          <div className="gt-result-val">{sym.order}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{lang === 'zh' ? '不动点 |Fix(σ)|' : '|Fix(σ)|'}</div>
          <div className="gt-result-val-strong">{sym.fixCount}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{lang === 'zh' ? '不动状态' : 'fixed states'}</div>
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
    corner: lang === 'zh' ? '所有 8 个角块位置 (角块块在 G 作用下能到的位置)' : 'all 8 corner positions (where any corner cubie can land under G)',
    edge:   lang === 'zh' ? '所有 12 个棱块位置 (棱块块在 G 作用下能到的位置)' : 'all 12 edge positions (where any edge cubie can land under G)',
    center: lang === 'zh' ? '只有 1 个位置 — 中心块不动 (它本身定义朝向)' : 'just 1 position — centres are fixed by definition',
  }[type];
  const stabDesc = {
    corner: lang === 'zh' ? '不改变 URF 位置和朝向的所有操作 = G 的指数 8 · 3 = 24 子群' : 'all operations fixing URF including orientation = subgroup of index 8 · 3 = 24',
    edge:   lang === 'zh' ? '不改变 UF 位置和朝向的所有操作 = G 的指数 12 · 2 = 24 子群' : 'all operations fixing UF including orientation = subgroup of index 12 · 2 = 24',
    center: lang === 'zh' ? '全部 G (中心块不动)' : 'all of G (centre is always fixed)',
  }[type];
  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § 轨道-稳定子' : 'Interactive § Orbit-stabilizer'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? '选一个 cubie 类型, 看它在 G 下的轨道大小 (|G·x|) 和稳定子大小 (|Stab(x)|) 。 它们的乘积永远 = |G|。'
          : 'Pick a cubie type and see its orbit size |G·x| and stabilizer size |Stab(x)|. Their product is always |G|.'}
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
          <h4>{lang === 'zh' ? '轨道 G·x' : 'Orbit G·x'}</h4>
          <p>x = <span className="gt-orbit-val">{sampleCubie}</span></p>
          <p>|G·x| = <span className="gt-orbit-val">{orbitSize.toString()}</span></p>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>{orbitDesc}</p>
        </div>
        <div>
          <h4>{lang === 'zh' ? '稳定子 Stab(x)' : 'Stabilizer Stab(x)'}</h4>
          <p>|Stab(x)| = <span className="gt-orbit-val" style={{ fontSize: 11 }}>{stabSize.toLocaleString()}</span></p>
          <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>{stabDesc}</p>
        </div>
      </div>
      <div className="gt-math-display" style={{ fontSize: '1em', marginTop: 16 }}>
        |G·x| × |Stab(x)| &nbsp;=&nbsp; {orbitSize.toString()} &nbsp;×&nbsp; {stabSize.toLocaleString()} &nbsp;=&nbsp; |G| ✓
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {lang === 'zh'
          ? '这就是轨道-稳定子定理。 每个 cubie 的 「能去哪里」 和 「让它不动需要多少操作」 是反比关系。'
          : 'This is the orbit-stabilizer theorem: a cubie\'s "where it can go" and "how many operations leave it fixed" are inversely related.'}
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
      <div className="gt-panel-title">{lang === 'zh' ? '可视 § 立方体对称轴' : 'Visual § Cube symmetry axes'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? '将鼠标悬在轴上(或点击下方按钮)显示对应的对称类。 红 = 面轴 (C₄, 4 重) , 蓝 = 体对角线 (C₃, 3 重) , 金 = 面对角线 (C₂, 2 重) 。'
          : 'Hover an axis (or click below) to highlight a symmetry class. Red = face axes (C₄, 4-fold), blue = body diagonals (C₃, 3-fold), gold = edge axes (C₂, 2-fold).'}
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
        {lang === 'zh'
          ? '合计: 24 个旋转 (E + 6 C₄ + 3 C₂面 + 8 C₃ + 6 C₂棱) + 24 个反射 (i + 6 σ_h + 6 σ_d + 8 S₆ + 6 S₄) = 48。这就是 O_h, 立方体的全对称群。'
          : 'In total: 24 rotations (E + 6 C₄ + 3 C₂-face + 8 C₃ + 6 C₂-edge) + 24 reflections (i + 6 σ_h + 6 σ_d + 8 S₆ + 6 S₄) = 48. This is O_h, the full cube symmetry group.'}
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
      <div className="gt-panel-title">{lang === 'zh' ? '互动 § Thistlethwaite 子群链' : 'Interactive § Thistlethwaite subgroup chain'}</div>
      <p className="gt-panel-sub">
        {lang === 'zh'
          ? '从 G 一路降到 {e},中间穿过四个固定子群。输入打乱,看它「位于哪一阶」。'
          : 'Climb from G down to {e} through four fixed subgroups. Input an alg, see what depth its state is "inside".'}
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
// Davidson, Dethridge (2014, SIAM J. Discrete Math.) — diameter = 20.
const GOD_DIST: { d: number; count: bigint }[] = [
  { d: 0, count: 1n },
  { d: 1, count: 18n },
  { d: 2, count: 243n },
  { d: 3, count: 3_240n },
  { d: 4, count: 43_239n },
  { d: 5, count: 574_908n },
  { d: 6, count: 7_618_438n },
  { d: 7, count: 100_803_036n },
  { d: 8, count: 1_332_343_288n },
  { d: 9, count: 17_596_479_795n },
  { d: 10, count: 232_248_063_316n },
  { d: 11, count: 3_063_288_809_012n },
  { d: 12, count: 40_374_425_656_248n },
  { d: 13, count: 531_653_418_284_628n },
  { d: 14, count: 6_989_320_578_825_358n },
  { d: 15, count: 91_365_146_187_124_313n },
  { d: 16, count: 1_100_531_606_815_050_000n },  // approx — Rokicki gave only orderof
  { d: 17, count: 12_217_338_577_780_000_000n }, // approx
  { d: 18, count: 29_290_000_000_000_000_000n }, // approx
  { d: 19, count: 1_357_000_000_000_000_000n },  // approx
  { d: 20, count: 490_000_000n },                  // exactly known: 490,000,000 positions
];

function GodsNumberChart() {
  const lang = useLang();
  // Use log scale because counts span 20 orders of magnitude.
  const max = Math.log10(Number(GOD_DIST[18].count));
  return (
    <>
      <div className="gt-gn-chart">
        {GOD_DIST.map(({ d, count }, i) => {
          const log = Math.log10(Number(count));
          const isPeak = i === 18;
          return (
            <div
              key={d}
              className={`gt-gn-bar ${isPeak ? 'gt-gn-bar-peak' : ''}`}
              style={{ height: `${Math.max(2, (log / max) * 100)}%` }}
            >
              <div className="gt-gn-bar-val">{count.toString()}</div>
              <div className="gt-gn-bar-label">{d}</div>
            </div>
          );
        })}
      </div>
      <div className="gt-gn-axis-label">
        {lang === 'zh' ? '横轴:最短解长度 (HTM)。纵轴:对数刻度的状态数。' : 'x: optimal depth (HTM). y: log-scale count of positions.'}
      </div>
    </>
  );
}

// ── Group examples table (§1) ──────────────────────────────────────────────
function GroupExamplesTable() {
  const lang = useLang();
  type Example = {
    name: string;
    op: string;
    order: string;
    abelian: boolean;
    zh: string;
    en: string;
  };
  const examples: Example[] = [
    { name: '(ℤ, +)',         op: '+',  order: '∞',     abelian: true,
      zh: '整数加法 — 最常见的无限阿贝尔群', en: 'integer addition — the prototypical infinite Abelian group' },
    { name: '(ℤ/n, +)',       op: '+',  order: 'n',     abelian: true,
      zh: '模 n 加法 — 有限循环群', en: 'addition mod n — the cyclic group of order n' },
    { name: '(ℝ \\ {0}, ×)', op: '×',  order: '∞',     abelian: true,
      zh: '非零实数乘法', en: 'nonzero reals under multiplication' },
    { name: 'Sₙ',             op: '∘',  order: 'n!',    abelian: false,
      zh: '对称群 — n 个元素的所有置换。n ≥ 3 时非阿贝尔', en: 'symmetric group — all permutations of n. Non-Abelian when n ≥ 3' },
    { name: 'D₂ₙ',            op: '∘',  order: '2n',    abelian: false,
      zh: '二面体群 — 正 n 边形对称变换', en: 'dihedral group — symmetries of a regular n-gon' },
    { name: 'GL(n, ℝ)',       op: '·',  order: '∞',     abelian: false,
      zh: '可逆 n×n 实矩阵的乘法群', en: 'invertible n×n real matrices under multiplication' },
    { name: '(rotations of cube, ∘)', op: '∘', order: '24', abelian: false,
      zh: '魔方整体旋转 (中心固定) — 同构于 S₄', en: 'cube rotations (centres fixed) — isomorphic to S₄' },
    { name: 'G (Rubik\'s cube)', op: '∘', order: '4.3 × 10¹⁹', abelian: false,
      zh: '本文的主角', en: 'the subject of this essay' },
  ];

  return (
    <div className="gt-examples">
      <div className="gt-example-row gt-example-head">
        <div>{lang === 'zh' ? '群' : 'Group'}</div>
        <div>{lang === 'zh' ? '运算' : 'Op.'}</div>
        <div>{lang === 'zh' ? '阶' : 'Order'}</div>
        <div>{lang === 'zh' ? '阿贝尔' : 'Abel.'}</div>
      </div>
      {examples.map((ex, i) => (
        <div className="gt-example-row" key={i}>
          <div className="gt-example-name">{ex.name}</div>
          <div>
            <span className="gt-mono">{ex.op}</span>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 4 }}>{lang === 'zh' ? ex.zh : ex.en}</div>
          </div>
          <div className="gt-mono" style={{ fontFamily: 'var(--mono)' }}>{ex.order}</div>
          <div className={`gt-example-abelian ${ex.abelian ? 'gt-example-abelian-yes' : 'gt-example-abelian-no'}`}>
            {ex.abelian ? (lang === 'zh' ? '是' : 'yes') : (lang === 'zh' ? '否' : 'no')}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Unfolded cube map (§3) ────────────────────────────────────────────────
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
function ScaleComparison() {
  const lang = useLang();
  // log10 values
  const items: { label: string; zh: string; en: string; log10: number; colour: string }[] = [
    { label: '1 thousand',         zh: '1 千',                en: '1 thousand',                  log10: 3,  colour: '#7BA88B' },
    { label: '1 million',          zh: '1 百万',              en: '1 million',                   log10: 6,  colour: '#7BA88B' },
    { label: 'world population',   zh: '世界人口 8 × 10⁹',     en: 'world population 8 × 10⁹',    log10: 9.9,colour: '#2A4D69' },
    { label: '1 trillion',         zh: '1 万亿',              en: '1 trillion',                  log10: 12, colour: '#2A4D69' },
    { label: 'stars in observable universe', zh: '可观宇宙恒星 ≈ 10²³', en: 'stars in observable universe', log10: 23, colour: '#B8860B' },
    { label: '|G| = 4.3 × 10¹⁹', zh: '|G| 魔方状态', en: '|G| cube states', log10: 19.6, colour: '#8B2E3C' },
    { label: 'atoms in a kilogram',zh: '1 公斤物质原子 ≈ 10²⁵', en: 'atoms in a kg of matter ≈ 10²⁵', log10: 25, colour: '#B8860B' },
    { label: 'age of universe in nanoseconds', zh: '宇宙年龄(纳秒) ≈ 10²⁶', en: 'age of universe (ns) ≈ 10²⁶', log10: 26, colour: '#B8860B' },
  ];
  // Sort ascending
  const sorted = [...items].sort((a, b) => a.log10 - b.log10);
  return (
    <div className="gt-scale">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>
        {lang === 'zh' ? '数量级对照 (log₁₀)' : 'orders of magnitude (log₁₀)'}
      </div>
      {sorted.map((it, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 70px', alignItems: 'center', gap: 12, padding: '6px 0', fontSize: 13, borderBottom: i < sorted.length - 1 ? '1px dashed var(--rule)' : 'none' }}>
          <div style={{ fontFamily: 'var(--mono)', color: it.colour, fontWeight: 600 }}>10<sup>{Math.round(it.log10)}</sup></div>
          <div style={{ color: 'var(--ink)' }}>{lang === 'zh' ? it.zh : it.en}</div>
          <div style={{ background: it.colour, height: 8, borderRadius: 4, width: `${(it.log10 / 30) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

// ── Quotient chart (§10) ──────────────────────────────────────────────────
function QuotientChart() {
  const lang = useLang();
  // [G:G₁] = 2^11 = 2048
  // [G₁:G₂] = 3^7 · (12 choose 4) = 2187 · 495 = 1,082,565
  // [G₂:G₃] = 8C4 · 4! · 4! / 2 = 70 · 24 · 24 / 2 ... actually = 29400 from references
  // [G₃:G₄] = |G₃| = (4!)³ / 2 = 1,824 ... actually 663,552 = 2 · (4!)² · (4!)² / something
  const data: { label: string; size: number; zh: string; en: string }[] = [
    { label: '[G : G₁]',  size: 2_048,      zh: '修棱朝向: 12 个棱块每个 0/1 flip,但 Σeo=0',        en: 'orient edges: 12 binary flips constrained by Σeo=0' },
    { label: '[G₁: G₂]', size: 1_082_565,  zh: '修角朝向 + 棱归 UD 切片: 3⁷ × (12 choose 4)',         en: 'orient corners + UD slice: 3⁷ × (12 choose 4)' },
    { label: '[G₂: G₃]', size: 29_400,     zh: '角棱归各自的 G₃ 轨道',                              en: 'corners and edges into G₃ orbits' },
    { label: '[G₃: G₄]', size: 663_552,    zh: '只用半圈还原 — 多米诺群',                          en: 'solve with half-turns only — the "domino" group' },
  ];
  const max = Math.log10(Math.max(...data.map(d => d.size)));
  return (
    <div className="gt-quotients">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>
        {lang === 'zh' ? 'Thistlethwaite 链各级商群大小' : 'sizes of consecutive Thistlethwaite quotients'}
      </div>
      {data.map((d, i) => (
        <div key={i} className="gt-quotient-row">
          <div className="gt-quotient-label">{d.label}</div>
          <div>
            <div className="gt-quotient-track">
              <div className="gt-quotient-fill" style={{ width: `${(Math.log10(d.size) / max) * 100}%` }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>{lang === 'zh' ? d.zh : d.en}</div>
          </div>
          <div className="gt-quotient-val">{d.size.toLocaleString()}</div>
        </div>
      ))}
      <div className="gt-aside" style={{ marginTop: 16 }}>
        {lang === 'zh'
          ? '验证: 2048 × 1,082,565 × 29,400 × 663,552 = 4.3 × 10¹⁹ = |G| ✓'
          : 'Sanity check: 2048 × 1,082,565 × 29,400 × 663,552 = 4.3 × 10¹⁹ = |G| ✓'}
      </div>
    </div>
  );
}

// ── Pattern gallery (§13) ─────────────────────────────────────────────────
function PatternGallery() {
  const lang = useLang();
  const patterns: { name: string; nameZh: string; alg: string; order: number; descZh: string; descEn: string }[] = [
    { name: 'Superflip',        nameZh: '超翻',     alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
      order: 2, descZh: '12 棱全翻 (cp=e, ep=e, co=0, eo=1)',  descEn: 'all 12 edges flipped' },
    { name: 'Checkerboard',     nameZh: '棋盘格', alg: 'U2 D2 F2 B2 L2 R2',
      order: 2, descZh: '6 面 ×3 半圈; |G| 中阶最小', descEn: 'all 6 axes half-turned' },
    { name: '4 dots',           nameZh: '四点',     alg: "U R2 L2 U2 R2 L2 U' D R2 L2 D2 R2 L2 D'",
      order: 2, descZh: '4 面中央色块互换', descEn: '4-face centre swap' },
    { name: 'Cube in cube',     nameZh: '回字',     alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U",
      order: 4, descZh: '小立方体在大立方体里的视觉错觉',  descEn: 'classic Escher-style visual illusion' },
    { name: 'Cross pattern',    nameZh: '十字',     alg: "U F B' L2 U2 L2 F' B U2 L2 U",
      order: 2, descZh: '每面中央一个十字色',  descEn: 'a cross on every face' },
    { name: 'Anaconda',         nameZh: '蟒蛇',     alg: "L U B' U' R L' B R' F B' D R D' F'",
      order: 6, descZh: '环绕魔方的彩色带',     descEn: 'a winding band of colour' },
    { name: 'Six spots',        nameZh: '六点',     alg: "U D' R L' F B' U D'",
      order: 4, descZh: '中心翻 (U↔D, R↔L, F↔B)', descEn: 'each face centre swapped with opposite' },
    { name: 'Plus minus',       nameZh: '加减号', alg: "U2 R2 L2 U2 R2 L2",
      order: 2, descZh: '简短 6 步即得',         descEn: 'a 6-move classic' },
  ];
  return (
    <div className="gt-pattern-gallery">
      {patterns.map((p, i) => (
        <div key={i} className="gt-pattern">
          <div className="gt-pattern-host"><TwistyMini alg={p.alg} /></div>
          <div className="gt-pattern-name">{lang === 'zh' ? p.nameZh : p.name}</div>
          <div className="gt-pattern-meta">
            {lang === 'zh' ? p.descZh : p.descEn}<br />
            <span style={{ color: 'var(--accent)' }}>{lang === 'zh' ? '阶' : 'order'} {p.order}</span>
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
  const examples: { a: string; b: string; nameZh: string; nameEn: string; descZh: string; descEn: string }[] = [
    { a: "R U R'", b: 'D', nameZh: '棱块 3-循环 (UD 面)', nameEn: 'Edge 3-cycle (UD-axis)',
      descZh: '只动 3 个棱块, 其它 17 个件不变', descEn: 'moves 3 edges, fixes the other 17 cubies' },
    { a: "R'", b: 'D', nameZh: '角块 3-循环', nameEn: 'Corner 3-cycle',
      descZh: '只动 3 个角块', descEn: 'moves 3 corners only' },
    { a: "M'", b: 'U', nameZh: 'M 切片棱循环', nameEn: 'M-slice edge cycle',
      descZh: '切片 + U 的复合 3-循环', descEn: 'slice-then-U commutator' },
    { a: "F R F'", b: 'U', nameZh: 'F 槽换棱', nameEn: 'F-slot edge swap',
      descZh: '改 F2L pair 的局部 3-循环', descEn: 'a localized 3-cycle near the F2L slot' },
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
        {lang === 'zh' ? '互动 § 在 Cayley 图上走一步' : 'Interactive § Walk one edge of the Cayley graph'}
      </div>
      <div className="gt-cayley-walker-controls">
        <span className="gt-cayley-walker-label">{lang === 'zh' ? '点一个生成元' : 'click a generator'}</span>
        {allMoves.map(m => (
          <button key={m} className="gt-cayley-walker-move" onClick={() => push(m)}>{m}</button>
        ))}
      </div>
      <div className="gt-cayley-walker-controls">
        <button className="gt-btn-ghost gt-btn" onClick={pop} disabled={path.length === 0}>
          {lang === 'zh' ? '↶ 撤回' : '↶ undo'}
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={reset}>
          {lang === 'zh' ? '回到 e' : 'reset'}
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={() => random(5)}>
          {lang === 'zh' ? '随机走 5 步' : 'random walk 5'}
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={() => random(15)}>
          {lang === 'zh' ? '随机 15' : 'random 15'}
        </button>
      </div>
      <div className="gt-cayley-walker-path">
        {path.length === 0
          ? <span className="gt-cayley-walker-empty">{lang === 'zh' ? '路径 = e (单位元, 起点)' : 'path = e (identity, start node)'}</span>
          : path.map((m, i) => <span key={i} className="gt-cayley-walker-token">{m}</span>)
        }
      </div>
      <div className="gt-cayley-walker-twisty">
        <TwistyMini alg={algStr} />
      </div>
      <div className="gt-cayley-walker-stats">
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{lang === 'zh' ? '路径长度' : 'path length'}</div>
          <div className="gt-cayley-walker-stat-val">{path.length}</div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{lang === 'zh' ? 'd(e, g) 上界' : 'd(e, g) upper bound'}</div>
          <div className="gt-cayley-walker-stat-val">{upperBound}</div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{lang === 'zh' ? '在 G 中?' : 'in G?'}</div>
          <div className="gt-cayley-walker-stat-val" style={{ color: inv.reachable ? 'var(--green)' : 'var(--accent)' }}>
            {inv.reachable ? '✓' : '✗'}
          </div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{lang === 'zh' ? '在子群' : 'in subgroup'}</div>
          <div className="gt-cayley-walker-stat-val" style={{ fontSize: 14 }}>G<sub>{stage}</sub></div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{lang === 'zh' ? '角块循环' : 'corner cyc.'}</div>
          <div className="gt-cayley-walker-stat-val" style={{ fontSize: 13 }}>{formatCycle(cornerCycles, lang)}</div>
        </div>
        <div className="gt-cayley-walker-stat">
          <div className="gt-cayley-walker-stat-label">{lang === 'zh' ? '棱块循环' : 'edge cyc.'}</div>
          <div className="gt-cayley-walker-stat-val" style={{ fontSize: 13 }}>{formatCycle(edgeCycles, lang)}</div>
        </div>
      </div>
      <div className="gt-aside" style={{ marginTop: 12, marginBottom: 0 }}>
        {isHome && path.length > 0
          ? (lang === 'zh' ? `走了 ${path.length} 步又回到 e — 你转了一个圈 (这条路径是 G 中的一个 ${path.length}-阶元素)。` : `Walked ${path.length} steps and returned to e — you traced a cycle (this path is an ${path.length}-order element of G).`)
          : (lang === 'zh' ? '每个按钮都是一条边。路径长度 = 在 Cayley 图上的步数 (≥ 真实距离 d(e,g))。' : 'Each button is an edge. Path length = walk length in Cayley graph (≥ the true distance d(e, g)).')}
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
  const lang = useLang();
  const maxLog = Math.log10(Number(CAYLEY_SPHERE[18].count));
  return (
    <div className="gt-cayley-bfs">
      <div className="gt-cayley-bfs-row head">
        <div>{lang === 'zh' ? '距离 d' : 'radius d'}</div>
        <div>{lang === 'zh' ? '球壳 |S_d| (对数刻度)' : '|S_d| (log-scale bar)'}</div>
        <div>{lang === 'zh' ? '状态数' : 'count'}</div>
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
  const lang = useLang();
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
        <span style={{ marginLeft: 12 }}>{lang === 'zh' ? '节点 = 状态' : 'nodes = states'}</span>
      </div>
    </div>
  );
}

// ── Other-puzzle comparison table (§15) ───────────────────────────────────
function PuzzleComparison() {
  const lang = useLang();
  const rows: { name: string; nameZh: string; order: string; gen: string; diam: string; isCube?: boolean }[] = [
    { name: '2×2×2 Pocket', nameZh: '2×2×2 口袋', order: '3,674,160',                gen: '⟨U, F, R⟩ (3 faces enough)', diam: '11 (HTM)' },
    { name: '3×3×3 (this)', nameZh: '3×3×3 (本文)', order: '4.3 × 10¹⁹',              gen: '⟨U, D, L, R, F, B⟩',    diam: '20 (HTM)', isCube: true },
    { name: 'Skewb',         nameZh: 'Skewb',       order: '3,149,280',                gen: '4 corner cuts',          diam: '11' },
    { name: 'Pyraminx',      nameZh: 'Pyraminx',    order: '75,582,720',               gen: '4 tips + 4 axis turns', diam: '11 (excluding tips)' },
    { name: '4×4×4 Revenge', nameZh: '4×4×4',        order: '7.4 × 10⁴⁵',             gen: 'inner + outer slices',  diam: 'unknown (≥ 22, ≤ 36)' },
    { name: '5×5×5',         nameZh: '5×5×5',        order: '2.8 × 10⁷⁴',             gen: 'inner + outer slices',  diam: 'unknown' },
    { name: 'Megaminx',      nameZh: 'Megaminx',    order: '1.0 × 10⁶⁸',              gen: '12 pentagonal faces',   diam: 'unknown' },
    { name: 'Square-1',      nameZh: 'Square-1',    order: '6.7 × 10¹¹',              gen: '/ , (1, 0) , (0, 1) etc.', diam: '13 (turn metric)' },
  ];
  return (
    <table className="gt-compare">
      <thead>
        <tr>
          <th>{lang === 'zh' ? '拼图' : 'Puzzle'}</th>
          <th>{lang === 'zh' ? '阶' : 'Order'}</th>
          <th>{lang === 'zh' ? '生成集' : 'Generators'}</th>
          <th>{lang === 'zh' ? '直径' : 'Diameter'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={r.isCube ? 'gt-compare-cube' : ''}>{lang === 'zh' ? r.nameZh : r.name}</td>
            <td className="num">{r.order}</td>
            <td><span className="gt-mono" style={{ fontSize: 11 }}>{r.gen}</span></td>
            <td className="num">{r.diam}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Order distribution table (§7 supplement) ──────────────────────────────
function OrderDistribution() {
  const lang = useLang();
  // Known orders that occur in the cube group with at least one element.
  // Source: enumerated from conjugacy classes; the orders that exist are the
  // divisors of 1260, but not ALL divisors — exact attainable set:
  const orders = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 20, 21, 24, 28, 30, 35, 36, 40, 42, 45, 56, 60, 63, 70, 72, 84, 90, 105, 126, 140, 180, 210, 252, 315, 420, 630, 1260];
  return (
    <div>
      <div className="gt-aside" style={{ marginBottom: 12 }}>
        {lang === 'zh'
          ? '魔方群中实际出现的元素阶（共 73 个不同的阶）。最大为 1260。每个阶都对应一组共轭类。'
          : 'Orders actually attained by some cube element (73 distinct values). Maximum is 1260. Each order corresponds to a family of conjugacy classes.'}
      </div>
      <div className="gt-order-table">
        {orders.map(n => (
          <div className="gt-order-cell" key={n}>
            <div className="gt-order-cell-n">{n}</div>
            <div className="gt-order-cell-lbl">{lang === 'zh' ? '阶' : 'ord'}</div>
          </div>
        ))}
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {lang === 'zh'
          ? '1260 = 2² · 3² · 5 · 7 是 |G| 的最大整除元素阶。这个特殊数字来自一个 (7-cycle on corners) × (5-cycle on edges) × (9-twist on corner ori) 的精心构造。'
          : '1260 = 2² · 3² · 5 · 7 is the maximum element order dividing |G|. Achievable via a (7-cycle on corners) × (5-cycle on edges) × (9-twist orbit) construction.'}
      </div>
    </div>
  );
}

// ── §19 CosetVisualizer — partition G into cosets of a subgroup ───────────
// Pick a small subgroup H ⊂ G. We tabulate |H| (computed by BFS for tiny
// generators), then display |G|/|H| as the count of cosets, with a tiled
// "fabric" panel that shows how G splits.
const COSET_SUBGROUPS = [
  { id: 'U',    gens: ['U'],                  name: '⟨U⟩',          orderApprox: 4,            zh: '只转 U', en: 'only U' },
  { id: 'U2',   gens: ['U2'],                 name: '⟨U²⟩',         orderApprox: 2,            zh: '只 180° U', en: 'only U2' },
  { id: 'UD',   gens: ['U', 'D'],             name: '⟨U,D⟩',        orderApprox: 16,           zh: '上下面', en: 'U, D faces' },
  { id: 'RU',   gens: ['R', 'U'],             name: '⟨R,U⟩',        orderApprox: 73483200,     zh: 'R, U (2 面群)', en: 'R, U (2-gen)' },
  { id: 'half', gens: ['U2','D2','L2','R2','F2','B2'], name: '⟨U²,D²,L²,R²,F²,B²⟩', orderApprox: 663552, zh: '半圈群 (G₃)', en: 'half-turn G₃' },
] as const;

function stateKey(s: CubieState): string {
  return s.cp.join(',') + '|' + s.co.join(',') + '|' + s.ep.join(',') + '|' + s.eo.join(',');
}

function bfsSubgroupSize(genTokens: string[], cap: number): { size: number; capped: boolean } {
  const start = identity();
  const visited = new Set<string>([stateKey(start)]);
  const queue: CubieState[] = [start];
  while (queue.length > 0 && visited.size < cap) {
    const cur = queue.shift()!;
    for (const g of genTokens) {
      const nxt = applyAlg(cur, g);
      const k = stateKey(nxt);
      if (!visited.has(k)) {
        visited.add(k);
        queue.push(nxt);
        if (visited.size >= cap) break;
      }
    }
  }
  return { size: visited.size, capped: visited.size >= cap };
}

function formatBig(n: number): string {
  if (n < 1e6) return n.toLocaleString('en-US');
  if (n < 1e12) return (n / 1e6).toFixed(2) + ' × 10⁶';
  if (n < 1e15) return (n / 1e9).toFixed(2) + ' × 10⁹';
  return n.toExponential(3).replace('e+', ' × 10');
}

function CosetVisualizer() {
  const lang = useLang();
  const [picked, setPicked] = useState<typeof COSET_SUBGROUPS[number]['id']>('UD');
  const sub = COSET_SUBGROUPS.find(s => s.id === picked)!;
  // Cap small subgroups at exact, big ones at known order.
  const measured = useMemo(() => {
    if (sub.orderApprox <= 256) return bfsSubgroupSize(sub.gens as unknown as string[], 1024);
    return { size: sub.orderApprox, capped: true };
  }, [sub]);
  const G_ORDER = 4.3252003274489856e19;
  const numCosets = G_ORDER / measured.size;
  return (
    <div className="gt-coset-viz">
      <div className="gt-coset-pickrow">
        {COSET_SUBGROUPS.map(s => (
          <button
            key={s.id}
            className={`gt-coset-chip ${picked === s.id ? 'active' : ''}`}
            onClick={() => setPicked(s.id)}
          >
            <span className="gt-mono" style={{ fontWeight: 600 }}>{s.name}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 8 }}>{lang === 'zh' ? s.zh : s.en}</span>
          </button>
        ))}
      </div>
      <div className="gt-coset-stats">
        <div className="gt-coset-stat">
          <div className="gt-coset-stat-lbl">{lang === 'zh' ? '子群阶 |H|' : '|H|'}</div>
          <div className="gt-coset-stat-val">{measured.size <= 65536 ? measured.size.toLocaleString() : formatBig(measured.size)}</div>
        </div>
        <div className="gt-coset-stat">
          <div className="gt-coset-stat-lbl">{lang === 'zh' ? '陪集数 [G:H]' : '[G:H]'}</div>
          <div className="gt-coset-stat-val">{formatBig(numCosets)}</div>
        </div>
        <div className="gt-coset-stat">
          <div className="gt-coset-stat-lbl">{lang === 'zh' ? '整除性' : 'divides |G|?'}</div>
          <div className="gt-coset-stat-val gt-coset-stat-ok">
            {Number.isInteger(numCosets) ? '✓' : '✗'}
          </div>
        </div>
      </div>
      <div className="gt-coset-eqn">
        <TeXBlock src={`|G| = ${measured.size <= 65536 ? measured.size : sub.orderApprox.toExponential(2)} \\cdot ${numCosets.toExponential(3).replace('e+', ' \\times 10^{') + '}'} = 43{,}252{,}003{,}274{,}489{,}856{,}000`} />
      </div>
      <div className="gt-coset-fabric">
        {/* Visual: each cell = one coset gH. Cap at 144 cells for display. */}
        {Array.from({ length: Math.min(144, Math.max(4, Math.round(Math.log2(numCosets)) * 12)) }, (_, i) => (
          <div key={i} className="gt-coset-cell" style={{ background: `hsl(${(i * 37) % 360}, 30%, var(--coset-l, 55%))` }}>
            <span className="gt-mono" style={{ fontSize: 9 }}>g{i}H</span>
          </div>
        ))}
      </div>
      <div className="gt-aside" style={{ marginTop: 12, fontSize: 13 }}>
        {lang === 'zh'
          ? <>每个色块代表一个陪集 <span className="gt-mono">gH</span>。所有陪集互不相交,大小都等于 <span className="gt-mono">|H|</span>,合起来等于整个 <span className="gt-mono">G</span>。 这就是 <strong>拉格朗日定理</strong>。</>
          : <>Each tile is one coset <span className="gt-mono">gH</span>. Cosets are pairwise disjoint, each of size <span className="gt-mono">|H|</span>; together they exhaust <span className="gt-mono">G</span>. This is <strong>Lagrange's theorem</strong>.</>}
      </div>
    </div>
  );
}

// ── §20 QuotientGroupBuilder — pick a normal subgroup, view G/N ───────────
const QUOTIENT_OPTIONS = [
  {
    id: 'co-kernel',
    nameZh: 'co-总和 = 0 的核 K_co',
    nameEn: 'ker(Σco): twist-zero',
    indexZh: 'G / K_co ≅ ℤ/3',
    indexEn: 'G / K_co ≅ ℤ/3',
    indexLatex: '|G/K_{\\mathrm{co}}| = 3',
    descZh: '所有让 Σco ≡ 0 的状态构成正规子群,商群是 ℤ/3。',
    descEn: 'States with Σco ≡ 0 form a normal subgroup; the quotient is ℤ/3.',
    n: 3,
  },
  {
    id: 'eo-kernel',
    nameZh: 'eo-总和 = 0 的核 K_eo',
    nameEn: 'ker(Σeo): flip-zero',
    indexZh: 'G / K_eo ≅ ℤ/2',
    indexEn: 'G / K_eo ≅ ℤ/2',
    indexLatex: '|G/K_{\\mathrm{eo}}| = 2',
    descZh: '所有让 Σeo ≡ 0 的状态构成正规子群,商群是 ℤ/2。',
    descEn: 'States with Σeo ≡ 0 form a normal subgroup; the quotient is ℤ/2.',
    n: 2,
  },
  {
    id: 'parity-kernel',
    nameZh: '偶置换核 K_par',
    nameEn: 'ker(sgn): even-parity',
    indexZh: 'G / K_par ≅ ℤ/2',
    indexEn: 'G / K_par ≅ ℤ/2',
    indexLatex: '|G/K_{\\mathrm{par}}| = 2',
    descZh: '所有 sgn(cp) = sgn(ep) = +1 的状态。',
    descEn: 'States with sgn(cp) = sgn(ep) = +1.',
    n: 2,
  },
  {
    id: 'abel',
    nameZh: '换位子群 [G,G]',
    nameEn: 'commutator [G,G]',
    indexZh: 'G^ab = G / [G,G] ≅ ℤ/2',
    indexEn: 'G^ab = G / [G,G] ≅ ℤ/2',
    indexLatex: 'G^{\\mathrm{ab}} \\cong \\mathbb{Z}/2',
    descZh: '所有换位子生成的子群。最大的阿贝尔商。',
    descEn: 'The subgroup generated by all commutators. Yields the largest Abelian quotient.',
    n: 2,
  },
] as const;

function QuotientGroupBuilder() {
  const lang = useLang();
  const [picked, setPicked] = useState<typeof QUOTIENT_OPTIONS[number]['id']>('co-kernel');
  const opt = QUOTIENT_OPTIONS.find(o => o.id === picked)!;
  return (
    <div className="gt-quotient">
      <div className="gt-quotient-tabs">
        {QUOTIENT_OPTIONS.map(o => (
          <button
            key={o.id}
            className={`gt-quotient-tab ${picked === o.id ? 'active' : ''}`}
            onClick={() => setPicked(o.id)}
          >{lang === 'zh' ? o.nameZh : o.nameEn}</button>
        ))}
      </div>
      <div className="gt-quotient-body">
        <div className="gt-quotient-eqn">
          <TeXBlock src={opt.indexLatex} />
        </div>
        <div className="gt-quotient-desc">{lang === 'zh' ? opt.descZh : opt.descEn}</div>
        <div className="gt-quotient-tiles">
          {Array.from({ length: opt.n }, (_, i) => (
            <div key={i} className="gt-quotient-tile">
              <div className="gt-quotient-tile-coset">[g{i}]</div>
              <div className="gt-quotient-tile-cnt">
                {lang === 'zh' ? '约 ' : '~'}
                {formatBig(4.3252003274489856e19 / opt.n)}
                {' '}{lang === 'zh' ? '元素' : 'elts'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── §21 ParityCalculator — apply an alg, see sgn(cp), sgn(ep), product ────
function ParityCalculator() {
  const lang = useLang();
  const [alg, setAlg] = useState('R U2 D B D');
  const state = useMemo(() => applyAlg(identity(), alg), [alg]);
  const sgnCp = permSign(state.cp);
  const sgnEp = permSign(state.ep);
  const product = sgnCp * sgnEp;
  return (
    <div className="gt-parity">
      <input
        className="gt-parity-input"
        value={alg}
        onChange={e => setAlg(e.target.value)}
        spellCheck={false}
        placeholder="e.g. R U R' U'"
      />
      <div className="gt-parity-row">
        <div className="gt-parity-cell">
          <div className="gt-parity-lbl">sgn(cp)</div>
          <div className={`gt-parity-val ${sgnCp === 1 ? 'pos' : 'neg'}`}>
            {sgnCp === 1 ? '+1' : '−1'}
          </div>
          <div className="gt-parity-sub">{sgnCp === 1 ? (lang === 'zh' ? '偶置换' : 'even') : (lang === 'zh' ? '奇置换' : 'odd')}</div>
        </div>
        <div className="gt-parity-cell">
          <div className="gt-parity-lbl">sgn(ep)</div>
          <div className={`gt-parity-val ${sgnEp === 1 ? 'pos' : 'neg'}`}>
            {sgnEp === 1 ? '+1' : '−1'}
          </div>
          <div className="gt-parity-sub">{sgnEp === 1 ? (lang === 'zh' ? '偶置换' : 'even') : (lang === 'zh' ? '奇置换' : 'odd')}</div>
        </div>
        <div className="gt-parity-cell gt-parity-cell-prod">
          <div className="gt-parity-lbl">sgn(cp) · sgn(ep)</div>
          <div className={`gt-parity-val ${product === 1 ? 'pos' : 'neg'}`}>
            {product === 1 ? '+1' : '−1'}
          </div>
          <div className="gt-parity-sub">
            {product === 1
              ? (lang === 'zh' ? '✓ 在 G 中可达' : '✓ reachable in G')
              : (lang === 'zh' ? '✗ 不可能!(单棱翻转不允许)' : '✗ impossible! (single-edge flip forbidden)')}
          </div>
        </div>
      </div>
      <div className="gt-parity-cycles">
        <div className="gt-parity-cycles-row">
          <span className="gt-parity-cycles-lbl">{lang === 'zh' ? '角块循环' : 'corner cycles'}</span>
          <span className="gt-mono">[{cycleStructure(state.cp).join(', ') || '·'}]</span>
        </div>
        <div className="gt-parity-cycles-row">
          <span className="gt-parity-cycles-lbl">{lang === 'zh' ? '棱块循环' : 'edge cycles'}</span>
          <span className="gt-mono">[{cycleStructure(state.ep).join(', ') || '·'}]</span>
        </div>
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        <L
          zh={<>这就是 §5 第三守恒律的现场:<TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} />。在 G 里,角块和棱块的奇偶性必须 <em>一同翻转</em>;sgn 是从 G 到 ℤ/2 的同态,它的核是「双偶」子群。</>}
          en={<>This is the third invariant from §5 in action: <TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} />. In G, corner parity and edge parity must flip <em>together</em>; sgn is a homomorphism G → ℤ/2 whose kernel is the "double-even" subgroup.</>}
        />
      </div>
    </div>
  );
}

// ── §22 AlgorithmCompareTable — IDA*/Thistlethwaite/Kociemba/Korf ─────────
function AlgorithmCompareTable() {
  const lang = useLang();
  const rows = [
    {
      name: 'Thistlethwaite (1981)',
      avgMoves: '~52',
      bestMoves: '45',
      worstMoves: '~52',
      tableSize: '< 100 KB',
      runtime: 'milliseconds',
      type: lang === 'zh' ? '4-阶段子群链' : '4-stage subgroup chain',
      note: lang === 'zh' ? '最早的有限存储次优解' : 'first finite-memory suboptimal',
    },
    {
      name: 'Kociemba (1992)',
      avgMoves: '~21',
      bestMoves: '<20 typical',
      worstMoves: '~30',
      tableSize: '~50 MB',
      runtime: 'ms-seconds',
      type: lang === 'zh' ? '两阶段' : 'Two-phase',
      note: lang === 'zh' ? '现代速求解器主流' : 'modern fast-suboptimal standard',
    },
    {
      name: 'Korf IDA* (1997)',
      avgMoves: '17.34',
      bestMoves: '20',
      worstMoves: '20',
      tableSize: '~80 MB',
      runtime: 'sec-min',
      type: lang === 'zh' ? '最优 IDA* + 模式 DB' : 'Optimal IDA* + pattern DBs',
      note: lang === 'zh' ? '首个可比较的最优解' : 'first truly optimal solver',
    },
    {
      name: 'Rokicki cosets (2010)',
      avgMoves: '17.7',
      bestMoves: '20',
      worstMoves: '20',
      tableSize: '~3 GB cosets',
      runtime: 'CPU-years',
      type: lang === 'zh' ? '对称压缩枚举' : 'symmetry-reduced enumeration',
      note: lang === 'zh' ? '20 步证明用此方法' : 'used to prove God\'s # = 20',
    },
  ];
  return (
    <table className="gt-algo-compare">
      <thead>
        <tr>
          <th>{lang === 'zh' ? '算法' : 'Algorithm'}</th>
          <th>{lang === 'zh' ? '类型' : 'Type'}</th>
          <th>avg HTM</th>
          <th>max HTM</th>
          <th>{lang === 'zh' ? '表' : 'Tables'}</th>
          <th>{lang === 'zh' ? '运行' : 'Runtime'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.name}>
            <td>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{r.note}</div>
            </td>
            <td><span style={{ fontSize: 13 }}>{r.type}</span></td>
            <td className="num">{r.avgMoves}</td>
            <td className="num">{r.worstMoves}</td>
            <td className="num">{r.tableSize}</td>
            <td className="num">{r.runtime}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── §22 ThistlethwaitePhaseChart — depths per stage ────────────────────────
function ThistlethwaitePhaseChart() {
  const lang = useLang();
  // Known stage maxima (HTM) from Thistlethwaite, Reid, et al. (1981–95).
  const stages = [
    { name: 'G₀ → G₁',  zh: '修 EO',                    en: 'fix edge orientation',     maxDepth: 7,  bound: 'EO = 0' },
    { name: 'G₁ → G₂',  zh: '修 CO + UD slice',         en: 'fix CO + UD slice',         maxDepth: 10, bound: 'CO = 0, FR/FL/BL/BR in slice' },
    { name: 'G₂ → G₃',  zh: '达成 domino',              en: 'reach domino orbits',       maxDepth: 13, bound: 'corner & edge orbit parity' },
    { name: 'G₃ → e',   zh: '完成 (仅 180° 转)',         en: 'solve (only 180° turns)',   maxDepth: 15, bound: 'identity' },
  ];
  const totalMax = stages.reduce((s, r) => s + r.maxDepth, 0);
  const maxD = Math.max(...stages.map(s => s.maxDepth));
  return (
    <div className="gt-thistle-chart">
      {stages.map((s, i) => (
        <div className="gt-thistle-stage" key={i}>
          <div className="gt-thistle-stage-name">{s.name}</div>
          <div className="gt-thistle-stage-bar">
            <div className="gt-thistle-stage-fill" style={{ width: `${(s.maxDepth / maxD) * 100}%` }} />
            <div className="gt-thistle-stage-depth">{s.maxDepth}</div>
          </div>
          <div className="gt-thistle-stage-desc">{lang === 'zh' ? s.zh : s.en}</div>
          <div className="gt-thistle-stage-bound"><span className="gt-mono">{s.bound}</span></div>
        </div>
      ))}
      <div className="gt-thistle-total">
        {lang === 'zh' ? '理论最大深度合计:' : 'theoretical max depth sum:'}{' '}
        <strong>{totalMax}</strong> {lang === 'zh' ? '步 (HTM)。后续的 45 步上界来自启发式 IDA* 在每一阶段的最优搜索。' : ' moves (HTM). The improved 45-move bound comes from optimal IDA* within each stage.'}
      </div>
    </div>
  );
}

// ── §23 DistanceDistributionChart — bar chart of |{ g ∈ G : d(g) = k }| ───
const DIST_DATA_HTM = [
  { d: 0,  count: 1n },
  { d: 1,  count: 18n },
  { d: 2,  count: 243n },
  { d: 3,  count: 3240n },
  { d: 4,  count: 43239n },
  { d: 5,  count: 574908n },
  { d: 6,  count: 7618438n },
  { d: 7,  count: 100803036n },
  { d: 8,  count: 1332343288n },
  { d: 9,  count: 17596479795n },
  { d: 10, count: 232248063316n },
  { d: 11, count: 3063288809012n },
  { d: 12, count: 40374425656248n },
  { d: 13, count: 531653418284628n },
  { d: 14, count: 6989320578825358n },
  { d: 15, count: 91365146187124313n },
  { d: 16, count: 1100000000000000000n }, // approximate from cube20.org
  { d: 17, count: 12000000000000000000n },
  { d: 18, count: 29000000000000000000n },
  { d: 19, count: 1500000000000000000n },
  { d: 20, count: 490000000n },
];

function DistanceDistributionChart() {
  const lang = useLang();
  const [hover, setHover] = useState<number | null>(null);
  const maxLog = useMemo(() => {
    return Math.max(...DIST_DATA_HTM.map(d => d.count > 0n ? Math.log10(Number(d.count)) : 0));
  }, []);
  return (
    <div className="gt-dist-chart">
      <div className="gt-dist-bars">
        {DIST_DATA_HTM.map(row => {
          const log = row.count > 0n ? Math.log10(Number(row.count)) : 0;
          const pct = (log / maxLog) * 100;
          const isExact = row.d <= 15;
          return (
            <div
              key={row.d}
              className={`gt-dist-bar-cell ${hover === row.d ? 'hover' : ''}`}
              onMouseEnter={() => setHover(row.d)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="gt-dist-bar">
                <div
                  className={`gt-dist-bar-fill ${!isExact ? 'approx' : ''}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <div className="gt-dist-bar-d">{row.d}</div>
            </div>
          );
        })}
      </div>
      <div className="gt-dist-hover">
        {hover !== null ? (
          <div>
            <span className="gt-dist-hover-d">d = {hover}</span>
            <span className="gt-dist-hover-cnt">
              {DIST_DATA_HTM[hover].count.toString()} {lang === 'zh' ? '个状态' : 'states'}
            </span>
            {hover > 15 && <span className="gt-dist-hover-approx"> ({lang === 'zh' ? '估算' : 'approx.'})</span>}
          </div>
        ) : (
          <div style={{ color: 'var(--ink-faint)' }}>
            {lang === 'zh' ? '悬停查看每个距离 d 上的状态数' : 'hover to see count at each distance d'}
          </div>
        )}
      </div>
      <div className="gt-dist-legend">
        <span><span className="gt-dist-swatch exact" /> {lang === 'zh' ? '已枚举 (Rokicki et al.)' : 'enumerated (Rokicki et al.)'}</span>
        <span><span className="gt-dist-swatch approx" /> {lang === 'zh' ? '估算 (cube20.org)' : 'approximated'}</span>
      </div>
    </div>
  );
}

// ── §24 RandomWalkSimulator — Markov chain on G ────────────────────────────
function RandomWalkSimulator() {
  const lang = useLang();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState<{ d: number; co: number; eo: number; sgnC: number; sgnE: number }[]>([{ d: 0, co: 0, eo: 0, sgnC: 1, sgnE: 1 }]);
  const stateRef = useRef<CubieState>(identity());
  const GENS = ['U', "U'", 'U2', 'D', "D'", 'D2', 'L', "L'", 'L2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'B', "B'", 'B2'];

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      const move = GENS[Math.floor(Math.random() * GENS.length)];
      stateRef.current = applyAlg(stateRef.current, move);
      const s = stateRef.current;
      const co = s.co.reduce((a, b) => a + b, 0) % 3;
      const eo = s.eo.reduce((a, b) => a + b, 0) % 2;
      const sgnC = permSign(s.cp);
      const sgnE = permSign(s.ep);
      // "distance proxy": # mismatched positions / orientations
      let d = 0;
      for (let i = 0; i < 8; i++) { if (s.cp[i] !== i) d++; if (s.co[i] !== 0) d++; }
      for (let i = 0; i < 12; i++) { if (s.ep[i] !== i) d++; if (s.eo[i] !== 0) d++; }
      setStep(prev => prev + 1);
      setHistory(prev => [...prev.slice(-119), { d, co, eo, sgnC, sgnE }]);
    }, 80);
    return () => clearInterval(interval);
  }, [running]);

  function reset() {
    stateRef.current = identity();
    setStep(0);
    setHistory([{ d: 0, co: 0, eo: 0, sgnC: 1, sgnE: 1 }]);
    setRunning(false);
  }

  const maxD = 40;
  return (
    <div className="gt-rwalk">
      <div className="gt-rwalk-controls">
        <button className="gt-rwalk-btn" onClick={() => setRunning(r => !r)}>
          {running ? (lang === 'zh' ? '暂停' : 'pause') : (lang === 'zh' ? '运行' : 'run')}
        </button>
        <button className="gt-rwalk-btn" onClick={reset}>
          {lang === 'zh' ? '重置' : 'reset'}
        </button>
        <span className="gt-rwalk-step">{lang === 'zh' ? '步数' : 'steps'}: <strong>{step}</strong></span>
        <span className="gt-rwalk-step">{lang === 'zh' ? '当前距离 (代理)' : 'current d (proxy)'}: <strong>{history[history.length - 1]?.d ?? 0}</strong></span>
      </div>
      <div className="gt-rwalk-chart">
        <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ width: '100%', height: 200 }}>
          {/* baseline */}
          <line x1="0" y1="200" x2="600" y2="200" stroke="var(--rule)" />
          {/* histogram */}
          {history.map((h, i) => {
            const x = (i / 120) * 600;
            const w = 600 / 120 - 0.5;
            const y = 200 - (h.d / maxD) * 200;
            return <rect key={i} x={x} y={y} width={w} height={200 - y} fill="var(--accent)" opacity="0.6" />;
          })}
        </svg>
      </div>
      <div className="gt-rwalk-stats">
        <div className="gt-rwalk-stat">
          <div className="gt-rwalk-stat-lbl">Σco mod 3</div>
          <div className="gt-rwalk-stat-val">{history[history.length - 1]?.co ?? 0}</div>
          <div className="gt-rwalk-stat-must">{lang === 'zh' ? '必须 = 0' : 'must = 0'}</div>
        </div>
        <div className="gt-rwalk-stat">
          <div className="gt-rwalk-stat-lbl">Σeo mod 2</div>
          <div className="gt-rwalk-stat-val">{history[history.length - 1]?.eo ?? 0}</div>
          <div className="gt-rwalk-stat-must">{lang === 'zh' ? '必须 = 0' : 'must = 0'}</div>
        </div>
        <div className="gt-rwalk-stat">
          <div className="gt-rwalk-stat-lbl">sgn(cp) · sgn(ep)</div>
          <div className="gt-rwalk-stat-val">{((history[history.length - 1]?.sgnC ?? 1) * (history[history.length - 1]?.sgnE ?? 1)) === 1 ? '+1' : '−1'}</div>
          <div className="gt-rwalk-stat-must">{lang === 'zh' ? '必须 = +1' : 'must = +1'}</div>
        </div>
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        {lang === 'zh'
          ? <>每 80 ms 随机选一个 HTM 生成元施加。<strong>注意三个守恒律是在轨迹上恒等的</strong> — 这就是「随机游走只能在可达陪集内移动」的视觉证明。混合时间 (mixing time) 是「TV-distance 到 1/(2e) 所需步数」,对 18-生成 HTM 在 <em>大约 25 步</em> 量级 ([<a href="#ref-bjorner">Björner 1999 类</a>])。这就是为什么 WCA 用 25 步打乱。</>
          : <>Every 80 ms we apply a random HTM generator. <strong>The three invariants stay pinned on the trajectory</strong> — a visual proof that the random walk lives entirely inside the reachable coset. The mixing time (TV-distance &lt; 1/(2e)) for the 18-generator walk is on the order of <em>~25 steps</em>, which is why WCA uses 25-move scrambles.</>}
      </div>
    </div>
  );
}

// ── §25 StabilizerChainExplorer — Schreier–Sims for the cube ──────────────
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
            <th>{lang === 'zh' ? '层' : 'level'}</th>
            <th>{lang === 'zh' ? '固定贴纸' : 'fixed stickers'}</th>
            <th>|stab|</th>
            <th>{lang === 'zh' ? '轨道大小' : 'orbit size'}</th>
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

// ── §26 CharacterTableHint — small abelian quotient as illustration ───────
function CharacterTableHint() {
  const lang = useLang();
  // The abelianization G/[G,G] ≅ Z/2 — so G has only TWO 1-dim'l reps (the
  // trivial rep and the sign rep). All other irreducibles are higher-dim.
  return (
    <div className="gt-chartable">
      <table className="gt-chartable-tbl">
        <thead>
          <tr>
            <th>χ</th>
            <th>1</th>
            <th>R</th>
            <th>R²</th>
            <th>{lang === 'zh' ? '其它共轭类...' : 'other conj. classes...'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>χ_triv</th>
            <td className="num">1</td>
            <td className="num">1</td>
            <td className="num">1</td>
            <td className="num">1 ...</td>
          </tr>
          <tr>
            <th>χ_sgn</th>
            <td className="num">1</td>
            <td className="num">−1</td>
            <td className="num">1</td>
            <td className="num">±1 ...</td>
          </tr>
          <tr>
            <th>χ_3, χ_4, ...</th>
            <td className="num">d</td>
            <td className="num">tr(ρ(R))</td>
            <td className="num">tr(ρ(R²))</td>
            <td className="num">...</td>
          </tr>
        </tbody>
      </table>
      <div className="gt-aside" style={{ marginTop: 10 }}>
        {lang === 'zh'
          ? <>G 的 <strong>1 维表示</strong> 只有两个:平凡表示 (永远等于 1) 和 sgn 表示 (奇置换 → −1)。这跟 G^ab = ℤ/2 一致。<strong>其它所有不可约表示都是高维的 (≥ 2)</strong>,反映了 G 的强烈非阿贝尔性。</>
          : <>G has exactly <strong>two 1-dimensional irreducible representations</strong>: the trivial rep and the sign rep (mapping odd permutations to −1). This matches G^ab = ℤ/2. <strong>All other irreducibles are higher-dimensional (≥ 2)</strong>, reflecting how strongly non-Abelian G is.</>}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function GroupTheoryPage() {
  const lang = useLang();
  const { slug } = useParams<{ slug?: string }>();
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
          ? <Link to="/" className="gt-back">← {lang === 'zh' ? '返回' : 'home'}</Link>
          : <Link to="/theory/group" className="gt-back">← {lang === 'zh' ? '目录' : 'contents'}</Link>}
        <div className="gt-topbar-right">
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>

      {isIndex && (
      <header className="gt-hero">
        <div className="gt-hero-meta">{lang === 'zh' ? '理论 · GROUP THEORY' : 'THEORY · GROUP THEORY'}</div>
        <h1 className="gt-hero-title">
          {lang === 'zh'
            ? <>魔方<span className="gt-bold">与群</span></>
            : <>The Rubik's Cube,<br /><span className="gt-bold">as a Group</span></>}
        </h1>
        <p className="gt-hero-sub">
          {lang === 'zh'
            ? '4,325 京个状态 不是混沌,是一个有序代数对象。一篇带图、带动画、带互动的代数学小课。'
            : '43 quintillion positions is not chaos. It is a beautifully structured algebraic object. An illustrated, interactive primer.'}
        </p>
        <div className="gt-hero-byline">
          {lang === 'zh' ? 'cuberoot · 2026 · 26 节 · 25 个互动 & 视觉面板 · 数学公式 KaTeX 渲染' : 'cuberoot · 2026 · 26 sections · 25 interactive & visual panels · KaTeX-rendered math'}
        </div>
      </header>
      )}

      {!slugValid && (
        <div className="gt-aside" style={{ maxWidth: 720, margin: '40px auto' }}>
          {lang === 'zh'
            ? <>未知小节 <code className="gt-mono">{slug}</code>。 <Link to="/theory/group">返回目录</Link>。</>
            : <>Unknown section <code className="gt-mono">{slug}</code>. <Link to="/theory/group">Back to contents</Link>.</>}
        </div>
      )}

      {isIndex && (
      <nav className="gt-toc" aria-label="Table of contents">
        <div className="gt-toc-title">{lang === 'zh' ? '目录' : 'Contents'}</div>
        <ul className="gt-toc-list">
          {TOC.map(item => (
            <li key={item.id}>
              <Link to={`/theory/group/${item.id}`}>
                <span className="gt-toc-num">§{item.num}</span>
                <span>{lang === 'zh' ? item.zh : item.en}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      )}

      {/* ═══════════════ §1 What is a group ═════════════════════════ */}
      <GTSec id="what-is-a-group" className="gt-sec">
        <div className="gt-sec-num">§1</div>
        <h2 className="gt-sec-title">
          <L zh="什么是群" en="What is a group?" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>当我们说魔方是「一个群」时,我们不是在打比方。<strong>群</strong> 在现代代数里是有精确定义的数学对象。它的定义只有 <strong>四条公理</strong> —— 而魔方所有 6 个面的全部转法,跟「先做 a 再做 b」这个复合运算放一起,正好满足这四条。</>}
            en={<>When we say the Rubik's Cube "is a group," it is not a metaphor. A <strong>group</strong> in modern algebra is a precise mathematical object defined by <strong>four axioms</strong>. The set of all cube moves, with the operation "do <em>a</em> then do <em>b</em>," satisfies all four exactly.</>}
          />
        </p>
        <AxiomTable />
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 1.1' : 'Definition 1.1'}</div>
          <div className="gt-def-body">
            <L
              zh={<>一个 <strong>群</strong> 是一个集合 <TeX src={`G`} />,配上一个二元运算 <TeX src={`\\cdot : G \\times G \\to G`} />,满足上面四条公理。如果同时还满足 <em>交换律</em> <TeX src={`a \\cdot b = b \\cdot a`} />,我们称之为 <strong>阿贝尔群 (Abelian group)</strong>。</>}
              en={<>A <strong>group</strong> is a set <TeX src={`G`} /> equipped with a binary operation <TeX src={`\\cdot : G \\times G \\to G`} /> satisfying the four axioms above. If additionally <TeX src={`a \\cdot b = b \\cdot a`} /> (the <em>commutative law</em>) holds, we call it an <strong>Abelian group</strong>.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>魔方群 <strong>不</strong> 是阿贝尔的:做 <span className="gt-mono">R</span> 然后做 <span className="gt-mono">U</span>,跟做 <span className="gt-mono">U</span> 然后做 <span className="gt-mono">R</span>,得到不一样的状态。整本魔方理论的一半内容,本质上是在量度「这种不交换的程度」—— 换位子 (§9) 就是为此而生。</>}
            en={<>The cube group is <strong>not</strong> Abelian: <span className="gt-mono">R</span> then <span className="gt-mono">U</span> gives a different state from <span className="gt-mono">U</span> then <span className="gt-mono">R</span>. Half of cube theory is, in essence, measuring exactly how far from commutative things are — that is the role of commutators (§9).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="1.1  其它常见的群" en="1.1  Other common groups" />
        </h3>
        <p>
          <L
            zh={<>群在数学里无处不在。把整数、矩阵、对称变换、置换、复根、几何变换 …… 列出来,几乎所有「自然有逆」的运算结构都是群:</>}
            en={<>Groups are ubiquitous. Listing them — integers, matrices, symmetries, permutations, complex roots, geometric transformations — almost every natural structure with "inverses" forms a group:</>}
          />
        </p>
        <GroupExamplesTable />
        <p>
          <L
            zh={<>注意 <TeX src={`|G| = 4.3 \\times 10^{19}`} /> —— 介于「物理可观察」(地球总人口) 和「物理不可观察」(可观宇宙原子) 之间。这个尺度是魔方让群论既具体又惊人的关键原因。</>}
            en={<>Notice <TeX src={`|G| = 4.3 \\times 10^{19}`} /> sits between "physically observable" (humanity's population) and "physically unimaginable" (atoms in the universe). That scale is exactly why the cube is such a compelling concrete example.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="1.2  阿贝尔 vs 非阿贝尔" en="1.2  Abelian vs non-Abelian" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 1.2' : 'Definition 1.2'}</div>
          <div className="gt-def-body">
            <L
              zh={<>一个群 <TeX src={`G`} /> 叫 <strong>阿贝尔群</strong>(Abelian)如果它的运算可交换:对所有 <TeX src={`a, b \\in G`} />, <TeX src={`ab = ba`} />。否则是非阿贝尔的。</>}
              en={<>A group <TeX src={`G`} /> is <strong>Abelian</strong> if its operation commutes: <TeX src={`ab = ba`} /> for all <TeX src={`a, b \\in G`} />. Otherwise it is <em>non-Abelian</em>.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>「Abelian」纪念挪威数学家 Niels Henrik Abel (1802–1829)。他二十几岁就证明了五次方程没有根式解 —— 那个证明的核心,就是阿贝尔群理论。</>}
            en={<>"Abelian" honours the Norwegian mathematician Niels Henrik Abel (1802–1829), who in his early twenties proved that the general quintic equation has no radical solution — a result that relied on the structure of Abelian groups.</>}
          />
        </p>
        <p>
          <L
            zh={<>魔方群非阿贝尔,这件事在解魔方时无处不在:每一个高级技巧都在「绕过非阿贝尔性」(共轭)或「利用非阿贝尔性」(换位子)。如果魔方真的可交换,那本质上就是一个 6 个独立轮子,30 秒不到就解开了,也就不会有比赛。</>}
            en={<>That the cube group is non-Abelian permeates every aspect of solving. Every advanced technique is either "side-stepping non-commutativity" (conjugation) or "exploiting it" (commutators). If the cube were Abelian, it would be six independent dials, solvable in seconds — and there would be no sport.</>}
          />
        </p>
        <div className="gt-pullquote">
          <L
            zh={<>「群论的中心思想是 <em>对称</em>。一个群就是一个对象的所有对称变换的集合 —— 而对称是数学最普遍的概念之一。」</>}
            en={<>"The central idea of group theory is <em>symmetry</em>. A group is the set of symmetries of an object — and symmetry is one of the most general concepts in mathematics."</>}
          />
          <div className="gt-pullquote-cite">— a common opening of any abstract-algebra textbook</div>
        </div>
      </GTSec>

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
          <div className="gt-def-title">{lang === 'zh' ? '定义 2.1 — 魔方群' : 'Definition 2.1 — the cube group'}</div>
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
          <div className="gt-def-title">{lang === 'zh' ? '定义 2.2 — 度量' : 'Definition 2.2 — metric on a group'}</div>
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
            <span className="gt-statevec-desc">{lang === 'zh' ? '8 个角块的位置 (置换)' : 'positions of the 8 corners (permutation)'}</span>
          </div>
          <div className="gt-statevec-row">
            <TeX src={`c_o \\in (\\mathbb{Z}/3)^8`} />
            <span className="gt-statevec-desc">{lang === 'zh' ? '每个角块的方向 (拧角)' : 'orientation of each corner (twist)'}</span>
          </div>
          <div className="gt-statevec-row">
            <TeX src={`e_p \\in S_{12}`} />
            <span className="gt-statevec-desc">{lang === 'zh' ? '12 个棱块的位置' : 'positions of the 12 edges'}</span>
          </div>
          <div className="gt-statevec-row">
            <TeX src={`e_o \\in (\\mathbb{Z}/2)^{12}`} />
            <span className="gt-statevec-desc">{lang === 'zh' ? '每个棱块的翻面 (好/坏)' : 'orientation of each edge (flip)'}</span>
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
          <div className="gt-rgen-row"><TeX src={`R_{c_p} = (0\\;4\\;7\\;3)`} /><span className="gt-rgen-desc">{lang === 'zh' ? '4-循环角块' : '4-cycle on corners'}</span></div>
          <div className="gt-rgen-row"><TeX src={`R_{c_o} = (+2, 0, 0, +1, +1, 0, 0, +2)`} /><span className="gt-rgen-desc">{lang === 'zh' ? '角块拧角偏移' : 'corner twist deltas'}</span></div>
          <div className="gt-rgen-row"><TeX src={`R_{e_p} = (0\\;8\\;11\\;4)`} /><span className="gt-rgen-desc">{lang === 'zh' ? '4-循环棱块' : '4-cycle on edges'}</span></div>
          <div className="gt-rgen-row"><TeX src={`R_{e_o} = 0`} /><span className="gt-rgen-desc">{lang === 'zh' ? 'R 不改变 EO (因 R 是 RL-轴)' : 'R does not affect EO (since R is on the RL-axis)'}</span></div>
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
      </GTSec>

      {/* ═══════════════ §4 Order of G ═════════════════════════════ */}
      <GTSec id="order" className="gt-sec">
        <div className="gt-sec-num">§4</div>
        <h2 className="gt-sec-title">
          <L zh="G 的阶 — 多少种状态?" en="The order |G| — how many states?" />
        </h2>
        <p>
          <L
            zh={<>如果魔方完全自由 (拆开重组、想拧就拧),状态数会是:</>}
            en={<>If the cube were fully free (disassemble and reassemble at will), the count would be:</>}
          />
        </p>
        <TeXBlock src={`|\\text{free cube}| \\;=\\; 8! \\cdot 12! \\cdot 3^8 \\cdot 2^{12} \\;=\\; 519{,}024{,}039{,}293{,}878{,}272{,}000`} />
        <p>
          <L
            zh={<>但 <em>没有</em> 拆装,只能转面 —— 这样会损失三条独立约束 (下一节细讲),每条砍掉一半状态:</>}
            en={<>But without disassembly, three independent constraints kick in (§5), each halving the state count:</>}
          />
        </p>
        <TeXBlock src={`|G| \\;=\\; \\frac{8! \\cdot 12! \\cdot 3^8 \\cdot 2^{12}}{3 \\cdot 2 \\cdot 2}`} />
        <div className="gt-big-number">
          <div className="gt-big-number-val">43,252,003,274,489,856,000</div>
          <div className="gt-big-number-label">|G| — order of the Rubik's cube group</div>
          <div className="gt-big-number-factor">
            <TeX src={`= 2^{27} \\cdot 3^{14} \\cdot 5^{3} \\cdot 7^{2} \\cdot 11`} />
          </div>
        </div>
        <p>
          <L
            zh={<>四千三百二十五京。如果你每秒看一个状态,看完 <strong>1.37 万亿年</strong>,远超宇宙年龄。每秒看十亿个,也要 <strong>1370 年</strong>。</>}
            en={<>Forty-three quintillion. At one state per second, it would take <strong>1.37 trillion years</strong>, dwarfing the age of the universe. At a billion states per second, still <strong>1,370 years</strong>.</>}
          />
        </p>
        <div className="gt-pullquote">
          <L
            zh={<>「魔方的全部状态,排成一行,可以从地球铺到太阳 256 次。」</>}
            en={<>"You can lay out all cube positions, one millimetre apart, and the line stretches from Earth to the Sun two hundred and fifty-six times over."</>}
          />
          <div className="gt-pullquote-cite">— scale of |G|</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="4.1  数量级对照" en="4.1  Sense of scale" />
        </h3>
        <p>
          <L
            zh={<>4.3 × 10¹⁹ 究竟有多大?把它对数化,放进熟悉的数列里:</>}
            en={<>How big is 4.3 × 10¹⁹? Plotted on a logarithmic scale among familiar quantities:</>}
          />
        </p>
        <ScaleComparison />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="4.2  质因数分解 — 为什么群论喜欢这个数字" en="4.2  Prime factorization — why group theorists love this number" />
        </h3>
        <TeXBlock src={`|G| \\;=\\; 2^{27} \\cdot 3^{14} \\cdot 5^{3} \\cdot 7^{2} \\cdot 11`} />
        <p>
          <L
            zh={<>这个分解告诉我们 G 的 <strong>Sylow 子群</strong> 结构 —— 群论里最强的「显微镜」之一。每个 <em>p</em>-Sylow 子群对应 |G| 中 <em>p</em>-部分:</>}
            en={<>This factorization determines the <strong>Sylow subgroups</strong> of G — one of group theory's sharpest microscopes. For each prime <em>p</em>, the <em>p</em>-Sylow subgroup captures the <em>p</em>-part of |G|:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><TeX src={`P_2`} />: <L zh={<>2-Sylow 子群,阶 <TeX src={`2^{27} = 134{,}217{,}728`} />。 包含所有半圈方块</>} en={<>2-Sylow, order <TeX src={`2^{27} = 134{,}217{,}728`} />. Contains all half-turn squares</>} /></li>
          <li><TeX src={`P_3`} />: <L zh={<>3-Sylow 子群,阶 <TeX src={`3^{14} = 4{,}782{,}969`} />。 包含所有 3-循环</>} en={<>3-Sylow, order <TeX src={`3^{14} = 4{,}782{,}969`} />. Contains all 3-cycles</>} /></li>
          <li><TeX src={`P_5`} />: <L zh={<>5-Sylow 子群,阶 <TeX src={`5^3 = 125`} /></>} en={<>5-Sylow, order <TeX src={`5^3 = 125`} /></>} /></li>
          <li><TeX src={`P_7`} />: <L zh={<>7-Sylow 子群,阶 <TeX src={`7^2 = 49`} /></>} en={<>7-Sylow, order <TeX src={`7^2 = 49`} /></>} /></li>
          <li><TeX src={`P_{11}`} />: <L zh={<>11-Sylow 子群,阶 11</>} en={<>11-Sylow, order 11</>} /></li>
        </ul>
        <div className="gt-thm">
          <div className="gt-thm-title">{lang === 'zh' ? '为什么有 11 出现?' : 'Why does 11 appear?'}</div>
          <div className="gt-thm-body">
            <L
              zh={<>11 是 ≤ 12 的最大素数 — 它来自 <strong>S₁₂</strong> 中的 11-循环 (12 个棱块上)。如果某个 11-阶元素被还原,意味着 11 个棱块被循环 (剩 1 个不动)。这种 11-循环在 G 中真实存在,数学上称为 <strong>11-阶元素</strong>。</>}
              en={<>11 is the largest prime ≤ 12 — it arises from an <strong>11-cycle in S₁₂</strong> (the symmetric group of the 12 edges). Some element of G cycles 11 edges while leaving 1 fixed. Such 11-order elements exist and are concrete witnesses of the prime 11 in |G|.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="4.3  时间尺度" en="4.3  Time scales" />
        </h3>
        <table className="gt-compare">
          <thead>
            <tr>
              <th>{lang === 'zh' ? '速率' : 'Rate'}</th>
              <th>{lang === 'zh' ? '看完所有状态所需时间' : 'Time to enumerate all states'}</th>
              <th>{lang === 'zh' ? '对照' : 'Comparable to'}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1 / second</td><td className="num">1.37 × 10¹² <L zh="年" en="years" /></td><td>100 × <L zh="宇宙年龄" en="age of universe" /></td></tr>
            <tr><td>1 / millisecond</td><td className="num">1.37 × 10⁹ <L zh="年" en="years" /></td><td><L zh="地球年龄 × 1/3" en="1/3 the age of Earth" /></td></tr>
            <tr><td>1 / microsecond</td><td className="num">1.37 × 10⁶ <L zh="年" en="years" /></td><td><L zh="智人诞生以来 × 5" en="5 × time since Homo sapiens" /></td></tr>
            <tr><td>1 / nanosecond</td><td className="num">1370 <L zh="年" en="years" /></td><td><L zh="罗马帝国到今天" en="Rome to today" /></td></tr>
            <tr><td>1 / picosecond (10¹²/s)</td><td className="num">501 <L zh="天" en="days" /></td><td>—</td></tr>
            <tr><td>1 / femtosecond</td><td className="num">12 <L zh="小时" en="hours" /></td><td><L zh="一个工作日" en="a workday" /></td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>即便用最快的计算机硬件 (10¹⁵ 操作/秒, 即 PFlops 级超算),完整枚举一遍 G 仍需 12 小时左右。这就是为什么 God's number 的证明用了 35 CPU 年 (依赖海量对称等价化简) —— §11 详述。</>}
            en={<>Even at petaflop scale (10¹⁵ ops/sec), enumerating G outright takes about half a day. This is why the proof of God's number consumed 35 CPU-years and relied on aggressive symmetry reductions — see §11.</>}
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
          <div className="gt-thm-title">{lang === 'zh' ? '定理 5.1 — 魔方第一定律' : 'Theorem 5.1 — first law of cubology'}</div>
          <div className="gt-thm-body">
            <L
              zh={<>一个状态 <TeX src={`(c_p, c_o, e_p, e_o)`} /> 可达 (即位于 G 中),当且仅当下面三件事同时成立:</>}
              en={<>A state <TeX src={`(c_p, c_o, e_p, e_o)`} /> is reachable (i.e. lies in G) if and only if all three hold:</>}
            />
            <div className="gt-inv-laws">
              <div className="gt-inv-law">
                <div className="gt-inv-law-num">(1)</div>
                <TeXBlock src={`\\sum_{i=1}^{8} c_o^{(i)} \\;\\equiv\\; 0 \\pmod 3`} />
                <div className="gt-inv-law-desc">{lang === 'zh' ? '总角块拧角守恒' : 'total corner twist conserved'}</div>
              </div>
              <div className="gt-inv-law">
                <div className="gt-inv-law-num">(2)</div>
                <TeXBlock src={`\\sum_{i=1}^{12} e_o^{(i)} \\;\\equiv\\; 0 \\pmod 2`} />
                <div className="gt-inv-law-desc">{lang === 'zh' ? '总棱块翻面守恒' : 'total edge flip conserved'}</div>
              </div>
              <div className="gt-inv-law">
                <div className="gt-inv-law-num">(3)</div>
                <TeXBlock src={`\\operatorname{sgn}(c_p) \\;=\\; \\operatorname{sgn}(e_p)`} />
                <div className="gt-inv-law-desc">{lang === 'zh' ? '角棱奇偶联动' : 'corner-edge parity coupling'}</div>
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
          <div className="gt-proof-title">{lang === 'zh' ? '证明' : 'Proof'}</div>
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
          <div className="gt-proof-title">{lang === 'zh' ? '证明' : 'Proof'}</div>
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
          <div className="gt-proof-title">{lang === 'zh' ? '证明' : 'Proof'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '推论 5.4' : 'Corollary 5.4'}</div>
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
      </GTSec>

      {/* ═══════════════ §6 Structure theorem ════════════════════════ */}
      <GTSec id="structure" className="gt-sec">
        <div className="gt-sec-num">§6</div>
        <h2 className="gt-sec-title">
          <L zh="结构定理 — G 的代数解剖" en="Structure theorem — anatomy of G" />
        </h2>
        <p>
          <L
            zh={<>把上述守恒律翻译成代数语言,G 就是「自由组合空间」的一个 <em>指数 12 子群</em>:</>}
            en={<>Translated into algebra, the three invariants make G a subgroup of index 12 inside the free assembly space:</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{lang === 'zh' ? '定理 6.1 — Singmaster' : 'Theorem 6.1 — Singmaster'}</div>
          <div className="gt-thm-body">
            <TeXBlock src={`G \\;\\cong\\; \\bigl\\{\\, (\\sigma, x, \\tau, y) \\in S_8 \\times (\\mathbb{Z}/3)^8 \\times S_{12} \\times (\\mathbb{Z}/2)^{12} \\;\\bigm|\\; \\textstyle\\sum x_i \\equiv 0,\\; \\sum y_i \\equiv 0,\\; \\operatorname{sgn}(\\sigma) = \\operatorname{sgn}(\\tau) \\,\\bigr\\}`} />
            <L
              zh={<>更精炼地:G 包含两个 <strong>半直积</strong> ("圈积") 作为子群:</>}
              en={<>More compactly, G contains two <strong>semidirect products</strong> ("wreath products") as subgroups:</>}
            />
            <TeXBlock src={`\\underbrace{\\mathbb{Z}/3 \\,\\wr\\, S_8}_{\\text{corner sector}} \\;\\;\\times\\;\\; \\underbrace{\\mathbb{Z}/2 \\,\\wr\\, S_{12}}_{\\text{edge sector}}`} />
            <span style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
              {lang === 'zh'
                ? '角块部分 ≅ 81 万 7,920,且与棱块部分通过 sgn(cp)=sgn(ep) 这一条「相位锁」耦合。'
                : 'The corner sector has 88,179,840 elements; it is coupled to the edge sector by the single parity lock sgn(cp) = sgn(ep).'}
            </span>
          </div>
        </div>
        <div className="gt-aside">
          <L
            zh={<>圈积 <TeX src={`A \\wr B`} /> 直观理解:你有 B 个「位置」,每个位置上挂一份 A 的副本。 B 在外部置换位置 (打乱角块位置),A 在每个位置内部独立旋转 (拧那个角块)。 在魔方上, <TeX src={`B = S_8,\\; A = \\mathbb{Z}/3`} />。</>}
            en={<>The wreath product <TeX src={`A \\wr B`} />: B "positions" each carrying their own copy of A. B permutes positions (shuffles corners around), A independently rotates within each (twists each corner). For the cube, <TeX src={`B = S_8`} /> and <TeX src={`A = \\mathbb{Z}/3`} />.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="6.1  短正合列" en="6.1  Short exact sequence" />
        </h3>
        <p>
          <L
            zh={<>魔方群可以用 <em>短正合列</em> 精确表述。 设 <TeX src={`N = (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> 是「方向自由度」(去掉两个 dependent 之后), <TeX src={`P`} /> 是「奇偶联动的角棱置换对」(<TeX src={`S_8 \\times S_{12}`} /> 的指数 2 子群):</>}
            en={<>The cube group fits into a <em>short exact sequence</em>. Let <TeX src={`N = (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> (orientations with the two dependent ones removed), and <TeX src={`P`} /> the parity-linked permutation pair (the index-2 subgroup of <TeX src={`S_8 \\times S_{12}`} />):</>}
          />
        </p>
        <TeXBlock src={`1 \\;\\longrightarrow\\; N \\;\\longrightarrow\\; G \\;\\longrightarrow\\; P \\;\\longrightarrow\\; 1`} />
        <p>
          <L
            zh={<>这说: G 在 N 上是一个 P-扩张 (P-extension), 即 G/N ≅ P。 用阶来验证: |N| = 3⁷ × 2¹¹ = 4,478,976, |P| = 8! · 12! / 2 = 9,656,672,256,000。乘积 = 4.3 × 10¹⁹ = |G|。✓</>}
            en={<>This says G is a P-extension of N — i.e. G/N ≅ P. Sanity check: |N| = 3⁷ · 2¹¹ = 4,478,976; |P| = 8! · 12! / 2 = 9,656,672,256,000; product = 4.3 × 10¹⁹ = |G|. ✓</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="6.2  分裂吗?" en="6.2  Does it split?" />
        </h3>
        <p>
          <L
            zh={<>群论里一个自然问题: 上面这个扩张是否「分裂」(split)? 即, P 有没有同构嵌入到 G 中?答案:<strong>是</strong>。「permute pieces with all CO/EO at 0」就是 P 的一个具体 embedding(对应的代数操作: 任何能保持 CO=0, EO=0 的操作组合)。所以扩张分裂, G 是半直积:</>}
            en={<>A natural follow-up: does the extension <em>split</em>? i.e. is there an embedding of P into G? Answer: <strong>yes</strong>. The set "permute cubies while keeping CO = 0 and EO = 0" is an embedded copy of P. The extension splits, so G is a semidirect product:</>}
          />
        </p>
        <TeXBlock src={`G \\;\\cong\\; N \\rtimes P`} />
        <p>
          <L
            zh={<>这正是物理上「先置换, 再扭」的代数化:任何 G 中的元素都能唯一写成 (扭法) · (置换)的乘积。这是 cube state 4-tuple 编码的代数基础。</>}
            en={<>This is the algebraic counterpart of "first permute, then twist": every element of G factors uniquely as (orientation) · (permutation). This is the algebraic foundation of the (cp, co, ep, eo) state encoding.</>}
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
          <div className="gt-thm-title">{lang === 'zh' ? '定理 7.1 — Lagrange' : 'Theorem 7.1 — Lagrange'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '共轭与「同态阶」' : 'Conjugation preserves order'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '为什么换位子如此有用?' : 'Why commutators are so powerful'}</div>
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
          <div className="gt-def-title">{lang === 'zh' ? '定义 9.1' : 'Definition 9.1'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '推论 9.2' : 'Corollary 9.2'}</div>
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
          <div className="gt-def-title">{lang === 'zh' ? '定义 9.3 — 中心' : 'Definition 9.3 — centre'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '定理 9.4' : 'Theorem 9.4'}</div>
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
          <div className="gt-proof-title">{lang === 'zh' ? '为什么 Z(G) 只有 2 个元素?' : 'Why |Z(G)| = 2'}</div>
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
          <div className="gt-def-title">{lang === 'zh' ? '定义 10.1' : 'Definition 10.1'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '定理 10.2 — Lagrange' : 'Theorem 10.2 — Lagrange'}</div>
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
      </GTSec>

      {/* ═══════════════ §11 God's number ════════════════════════════ */}
      <GTSec id="gods-number" className="gt-sec">
        <div className="gt-sec-num">§11</div>
        <h2 className="gt-sec-title">
          <L zh="上帝之数 = 20" en="God's number = 20" />
        </h2>
        <p>
          <L
            zh={<>G 是一个有 <TeX src={`4.3 \\times 10^{19}`} /> 个元素的有限群。 把 <TeX src={`G`} /> 看成图(顶点 = 状态,边 = 一次面转),它的 <strong>直径</strong> 是多少?</>}
            en={<>G is a finite group of size 4.3 × 10¹⁹. View it as a graph (vertices = states, edges = single face turns). What is its <strong>diameter</strong>?</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{lang === 'zh' ? '定理 11.1 — Rokicki, Kociemba, Davidson, Dethridge (2014)' : 'Theorem 11.1 — Rokicki, Kociemba, Davidson, Dethridge (2014)'}</div>
          <div className="gt-thm-body">
            <L
              zh={<>魔方群的直径 (在半圈度量 HTM 下) 恰好等于 <strong>20</strong>。即:任何状态都可在 20 步以内还原, 且存在状态恰好需要 20 步。</>}
              en={<>The diameter of the cube group in the half-turn metric (HTM) is exactly <strong>20</strong>. Every state is solvable in 20 moves or fewer, and some require exactly 20.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个数字俗称 <strong>上帝之数 (God's number)</strong>。2010 年 Rokicki 团队用 35 CPU 年的 Google 集群算力穷举证明:把 4.3 × 10¹⁹ 状态按对称等价划成约 20 亿组,对每组验证最优解 ≤ 20。<br /><br />在四分一圈度量 (QTM,U' 也算 1 步) 下,直径是 <strong>26</strong>。下图按深度分布(对数刻度):</>}
            en={<>Known as <strong>God's number</strong>. In 2010, Rokicki's team used 35 CPU-years on a Google cluster to prove this exhaustively: partition the 4.3 × 10¹⁹ states into ~2 billion symmetry classes, optimally solve a representative of each, and verify ≤ 20 every time.<br /><br />Under the quarter-turn metric (QTM, where U' counts as a separate move) the diameter is <strong>26</strong>. The distribution of states by optimal depth (log scale):</>}
          />
        </p>
        <GodsNumberChart />
        <div className="gt-aside" style={{ marginTop: 32 }}>
          <L
            zh={<>注意分布在第 18 步左右达到峰值。绝大多数状态都「正好那么难」—— 极简单和极困难都罕见。<strong>恰好 20 步</strong> 的状态非常稀有,只有约 4.9 亿个 (占总数的 1.1 × 10⁻¹¹)。</>}
            en={<>The distribution peaks around depth 18. Most states are "just hard enough" — extremes are rare. States requiring <strong>exactly</strong> 20 moves number around 490 million — only 1.1 × 10⁻¹¹ of the total.</>}
          />
        </div>
        <div className="gt-pullquote">
          <L
            zh={<>「直径 20 的群图,有十亿亿个顶点。能存在这样的对象,然后用算力把它的极端摸出来,是 21 世纪计算群论的胜利。」</>}
            en={<>"A Cayley graph of forty-three quintillion nodes whose diameter we have nailed down to a single integer is one of the proudest results of 21st-century computational group theory."</>}
          />
          <div className="gt-pullquote-cite">— on the cube20 project</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.1  证明的思路" en="11.1  Outline of the proof" />
        </h3>
        <p>
          <L
            zh={<>Rokicki 团队的证明用了 35 CPU 年的 Google 算力。核心思路是 <strong>对称等价化简</strong> + <strong>分阶段求解</strong>:</>}
            en={<>Rokicki's proof consumed 35 CPU-years on a Google cluster. The strategy combines <strong>symmetry-equivalence reduction</strong> with <strong>phased solving</strong>:</>}
          />
        </p>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>对称等价化简</strong>:利用魔方的 48 个外部对称变换(24 个旋转 × 2 镜像)把 4.3 × 10¹⁹ 状态归到 ~9 × 10¹⁷ 个等价类。</>}
              en={<><strong>Symmetry quotient</strong>: the 48 outer cube symmetries (24 rotations × 2 mirrors) reduce 4.3 × 10¹⁹ states to ~9 × 10¹⁷ equivalence classes.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>陪集划分</strong>:在 G_1 (二阶段法的第一阶段子群,见 §10) 的陪集上进一步切片,得到 ~2 × 10⁹ 个待处理「sets」 (每个 set ≈ 2 × 10¹⁰ 状态)。</>}
              en={<><strong>Coset partition</strong>: further slice by cosets of G_1 (the two-phase solver's stage-1 subgroup, §10), yielding ~2 × 10⁹ "sets" to process (each containing ~2 × 10¹⁰ states).</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>暴力求解</strong>:每个 set 用改进的 Kociemba two-phase solver 求出每个状态的「最短 ≤ 20」证书。若有任何状态需要 {'>'} 20 步,则失败。</>}
              en={<><strong>Brute-force solve</strong>: for each set, run an improved Kociemba two-phase solver to certify every state's optimal length ≤ 20. If any state required {'>'} 20, the bound is broken.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>结果</strong>:所有 2 × 10⁹ 个 set 都通过 ≤ 20 步证书。结合早已知道的「superflip 需要 ≥ 20 步」(1995 年 Reid 给出),得到 God's number = 20。</>}
              en={<>Every set verified ≤ 20. Combined with the long-known fact that superflip requires ≥ 20 moves (Reid, 1995), this gives <em>diameter</em> = 20.</>}
            />
          </li>
        </ol>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.2  HTM vs QTM" en="11.2  Half-turn vs quarter-turn metric" />
        </h3>
        <p>
          <L
            zh={<>同一个魔方,在两种度量下直径不同:</>}
            en={<>The same cube has different diameters under different metrics:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{lang === 'zh' ? '度量' : 'Metric'}</th><th>{lang === 'zh' ? '生成集' : 'Generators'}</th><th>{lang === 'zh' ? '直径' : 'Diameter'}</th><th>{lang === 'zh' ? '极端状态' : 'Extremal'}</th></tr>
          </thead>
          <tbody>
            <tr><td>HTM (half-turn)</td><td className="num">18 (each face × 90°/180°/270°)</td><td className="num">20</td><td>superflip {`{}`}+ ~490M others</td></tr>
            <tr><td>QTM (quarter-turn)</td><td className="num">12 (each face × 90°/270°)</td><td className="num">26</td><td>superflip composed with a special 6-move op</td></tr>
            <tr><td>STM (slice-turn)</td><td className="num">27 (HTM + 9 slice moves)</td><td className="num">18</td><td>multiple known examples</td></tr>
            <tr><td>FTM (face-turn 90°)</td><td className="num">6 (each face × 90°)</td><td className="num">26 (= QTM)</td><td>same as QTM</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>不同度量对应不同的「比赛规则」 或不同的「物理代价」, 但底层群结构都是同一个 G。这是图论里「图的距离 ≠ 群的内在性质」 的典型例子。</>}
            en={<>Different metrics correspond to different "competition rules" or "physical costs," but the underlying group G is the same. This is a textbook illustration of "graph distance is not an intrinsic group property."</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.3  历史时间线" en="11.3  Historical timeline" />
        </h3>
        <table className="gt-compare">
          <thead>
            <tr><th>{lang === 'zh' ? '年' : 'Year'}</th><th>{lang === 'zh' ? '人' : 'Who'}</th><th>{lang === 'zh' ? '上界' : 'Upper'}</th><th>{lang === 'zh' ? '下界' : 'Lower'}</th></tr>
          </thead>
          <tbody>
            <tr><td>1981</td><td>Thistlethwaite</td><td className="num">52</td><td className="num">—</td></tr>
            <tr><td>1990</td><td>Kloosterman</td><td className="num">42</td><td className="num">—</td></tr>
            <tr><td>1992</td><td>Reid</td><td className="num">37</td><td className="num">18</td></tr>
            <tr><td>1995</td><td>Reid</td><td className="num">29</td><td className="num">20</td></tr>
            <tr><td>1995</td><td>Korf</td><td className="num">—</td><td className="num">20</td></tr>
            <tr><td>2007</td><td>Kunkle &amp; Cooperman</td><td className="num">26</td><td className="num">20</td></tr>
            <tr><td>2008</td><td>Rokicki</td><td className="num">22</td><td className="num">20</td></tr>
            <tr><td><strong>2010</strong></td><td><strong>Rokicki et al.</strong></td><td className="num"><strong>20</strong></td><td className="num"><strong>20</strong></td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>从 Thistlethwaite 的 52 步到 Rokicki 的 20 步, 经过 29 年, 上下界终于在 20 相遇 — 这个数字成为 God's number。</>}
            en={<>From Thistlethwaite's 52 to Rokicki's 20, the upper and lower bounds converged after 29 years to the value 20 — God's number.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §12 Beyond ═════════════════════════════════ */}
      <GTSec id="beyond" className="gt-sec">
        <div className="gt-sec-num">§12</div>
        <h2 className="gt-sec-title">
          <L zh="走得更远" en="Beyond the cube" />
        </h2>
        <p>
          <L
            zh={<>「魔方是群」并不是孤立的代数玩具。同一套语言适用于其它扭转拼图:</>}
            en={<>"Cube is a group" is not an isolated curiosity. The same algebraic language describes other twisting puzzles:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>2×2×2 口袋方块</strong> — 群阶 3,674,160,直径 11 (HTM)。整个 2×2 就是 G 的「角块部分」。</>}
              en={<><strong>2×2×2 Pocket Cube</strong> — order 3,674,160, diameter 11 (HTM). Essentially the corner sector of G.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>4×4×4 (Rubik's Revenge)</strong> — 没有固定中心,但仍是有限群,阶 ≈ 7.4 × 10⁴⁵。</>}
              en={<><strong>4×4×4 (Rubik's Revenge)</strong> — no fixed centres, but still a finite group of order ≈ 7.4 × 10⁴⁵.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>Megaminx</strong> — 十二面体,阶 ≈ 10⁶⁸。</>}
              en={<><strong>Megaminx</strong> — dodecahedral, order ≈ 10⁶⁸.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>Square-1</strong> — 不再是经典置换群:中间层有非平凡的几何约束 (双层切片)。</>}
              en={<><strong>Square-1</strong> — escapes classical permutation groups: nontrivial geometric constraint from the middle slice.</>}
            />
          </li>
        </ul>
        <p>
          <L
            zh={<>更深一点,Cayley 图、Burnside lemma、群表示、自动机 (string rewriting)、PSPACE-完备性证明 —— 都把魔方当作具体例子。魔方是「能在生活里摸得到的有限非阿贝尔群」, 这就是它在数学教育里独特的地位。</>}
            en={<>Going further, Cayley graphs, Burnside's lemma, group representations, automaton-based solvers, PSPACE-completeness proofs — all use the cube as a concrete instance. The cube is the most tactile non-Abelian finite group we have. That is why it endures in pedagogy.</>}
          />
        </p>
        <p>
          <L
            zh={<>本站还有几个具体工具供深入探索:<Link to="/scramble/solver">最短解求解器</Link>、<Link to="/alg/commutator">换位子分解工具</Link>、<Link to="/scramble/analyzer">分析器</Link>。</>}
            en={<>Within this site, dig deeper with the <Link to="/scramble/solver">optimal solver</Link>, the <Link to="/alg/commutator">commutator decomposer</Link>, and the <Link to="/scramble/analyzer">scramble analyzer</Link>.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §13 Famous patterns ═════════════════════════ */}
      <GTSec id="patterns" className="gt-sec">
        <div className="gt-sec-num">§13</div>
        <h2 className="gt-sec-title">
          <L zh="著名图案 — 群元素的具体面孔" en="Famous patterns — concrete faces of group elements" />
        </h2>
        <p>
          <L
            zh={<>群元素是抽象对象, 但每一个魔方状态 (= 群元素) 都可以视觉化。下面是一些「家喻户晓」的图案 — 每个都是 G 中的一个具体元素, 配有它的阶、定义公式、和群论意义。</>}
            en={<>A group element is abstract, but every cube state is visual. Below is a tour of celebrated patterns — each one a specific element of G, with its order, defining alg, and group-theoretic significance.</>}
          />
        </p>
        <PatternGallery />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="13.1  superflip 的特殊地位" en="13.1  The special status of superflip" />
        </h3>
        <p>
          <L
            zh={<>Superflip 是阶 2 的元素 (做两次回到原点),且它的 cp=identity, co=identity (角块完全归位), 只有 12 个棱块全部翻面。它有三个数学上的特殊性:</>}
            en={<>Superflip is an order-2 element (applying it twice gives identity), with cp = identity and co = identity (corners untouched) — only all 12 edges are flipped. It is mathematically special in three ways:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh="它是 Z(G) 的非平凡元 (跟所有 G 元素交换 — §9.4)" en="It is the non-trivial centre element (commutes with all of G — §9.4)" /></li>
          <li><L zh="它是 |g|_HTM = 20 的「极端状态」 之一 (最短解恰好需要 20 步)" en="It is among the extremal positions with optimal HTM length = 20" /></li>
          <li><L zh="它在所有 48 个魔方外部对称变换下不变 (即 superflip 是「最对称」 状态)" en="It is invariant under all 48 outer cube symmetries (the most symmetric state)" /></li>
        </ul>
        <div className="gt-pullquote">
          <L
            zh={<>「Superflip 是所有 4.3 × 10¹⁹ 状态中, 群论上 <em>最特殊</em> 的那一个。它不是巧合 — 它的特殊性来自它在群中的几何位置。」</>}
            en={<>"Superflip is, group-theoretically, the most singular position among 43 quintillion. Its uniqueness is not coincidence — it follows from its geometric place in G."</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="13.2  生成简单图案的代数学" en="13.2  Algebra of generating simple patterns" />
        </h3>
        <p>
          <L
            zh={<>有些图案有清晰的代数公式。例如 「checkerboard 棋盘」 = U² D² F² B² L² R²。 这是 6 个「半圈生成元」的乘积, 它们两两可交换 (U² 和 D² 在不同层但都是 U-D 轴), 所以总群是 ℤ/2 × ℤ/2 × ℤ/2 = 8 元阿贝尔群。Checkerboard 的阶因此必然为 1 或 2 (是 2)。</>}
            en={<>Some patterns have clean algebraic structure. Example: <strong>checkerboard</strong> = U² D² F² B² L² R². These six half-turns mutually commute (since each pair acts on disjoint cubies or is on the same axis); the subgroup they generate is the Abelian group ℤ/2 × ℤ/2 × ℤ/2 of order 8. Checkerboard's order is therefore at most 2 — and it is exactly 2.</>}
          />
        </p>
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
          <div className="gt-def-title">{lang === 'zh' ? '定义 14.1' : 'Definition 14.1'}</div>
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
            {lang === 'zh'
              ? '完整的 ⟨R, U⟩ Cayley 图有 73,483,200 个节点, 直径约 26 (HTM)。这里只画了前 15 个节点作示意。'
              : 'The full Cay(⟨R, U⟩, {R, U}) has 73,483,200 nodes and diameter ≈ 26 (HTM). Only 15 nodes shown here.'}
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
          <div className="gt-thm-title">{lang === 'zh' ? '直径 (Theorem 14.2)' : 'Diameter (Theorem 14.2)'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '混合时间' : 'Mixing time'}</div>
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
              <th>{lang === 'zh' ? '生成集 S' : 'Generators S'}</th>
              <th>{lang === 'zh' ? '|S|' : '|S|'}</th>
              <th>{lang === 'zh' ? '直径' : 'Diameter'}</th>
              <th>{lang === 'zh' ? '说明' : 'Notes'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>HTM = U U' U2 D D' D2 ...</td>
              <td className="num">18</td>
              <td className="num">20</td>
              <td>{lang === 'zh' ? 'WCA 标准, 半圈算一步' : 'WCA standard, half-turn metric'}</td>
            </tr>
            <tr>
              <td>QTM = U U' D D' ...</td>
              <td className="num">12</td>
              <td className="num">26</td>
              <td>{lang === 'zh' ? '只允许 90°, 半圈算两步' : 'quarter-turn only; U2 = 2 moves'}</td>
            </tr>
            <tr>
              <td>STM = HTM + M E S (切片)</td>
              <td className="num">27</td>
              <td className="num">18</td>
              <td>{lang === 'zh' ? '加 9 个切片转, 直径少 2' : '+ 9 slice moves; diameter drops by 2'}</td>
            </tr>
            <tr>
              <td>BTM (block turn)</td>
              <td className="num">36</td>
              <td className="num">≤ 16</td>
              <td>{lang === 'zh' ? '宽幅 + 切片; 进一步缩短' : 'wide + slice; shortens further'}</td>
            </tr>
            <tr>
              <td>{lang === 'zh' ? '只用 ⟨R, U⟩ 两个面' : 'only ⟨R, U⟩'}</td>
              <td className="num">2 (or 6 with inverses/dbl)</td>
              <td className="num">~26</td>
              <td>{lang === 'zh' ? '只能到达 73,483,200 个状态' : 'reaches just 73,483,200 states'}</td>
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
      </GTSec>

      {/* ═══════════════ §15 Other puzzles ═══════════════════════════ */}
      <GTSec id="other-puzzles" className="gt-sec">
        <div className="gt-sec-num">§15</div>
        <h2 className="gt-sec-title">
          <L zh="其它拼图 — 同一框架, 不同舞台" en="Other puzzles — same framework, different stages" />
        </h2>
        <p>
          <L
            zh={<>魔方的成功让群论成为研究所有「扭转拼图」的标准工具。每个拼图都有自己的群、自己的生成集、自己的直径。下面是几个例子的速览:</>}
            en={<>The cube's success made group theory the standard tool for studying all "twisting puzzles." Each puzzle has its own group, generators, and diameter:</>}
          />
        </p>
        <PuzzleComparison />
        <p>
          <L
            zh={<>注意 4×4×4 的群比 3×3×3 大 8 个数量级 — 但直径只是「至少 22, 至多 36」 的范围。原因是 4×4×4 缺乏 3×3×3 那种「中心固定」的对称, 状态空间增长远快于路径长度增长。</>}
            en={<>Note: the 4×4×4 group is 8 orders of magnitude larger than the 3×3×3, but the diameter sits in [22, 36]. The reason: the 4×4×4 lacks the 3×3×3's fixed-centre symmetry, so the state space explodes faster than the path length.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="15.1  超出经典置换群" en="15.1  Beyond classical permutation groups" />
        </h3>
        <p>
          <L
            zh={<>有些拼图的群「不是」标准置换群:</>}
            en={<>Some puzzles' groups are NOT standard permutation groups:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>Square-1</strong>: 顶层和底层可以不分整数倍地切, 加上 / (flip) 操作。它的「合法状态」依赖于几何拼接, 不能仅用置换描述。Square-1 群是研究「带几何约束的非群体置换 (semigroupoid)」的天然实验。</>}
              en={<><strong>Square-1</strong>: the top and bottom layers can be cut at non-integer multiples of 1/12, plus a / (flip) operation. Its legal states depend on geometric matching, not pure permutation. The Square-1 group is a natural example of a semigroup with geometric constraints.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>Bandaged cube</strong>: 某些块用胶带固定在一起, 导致部分面转被「禁掉」。结果群是 G 的真子群, 但生成集结构变化巨大 — solver 算法完全不同。</>}
              en={<><strong>Bandaged cubes</strong>: some cubies are glued together, forbidding certain face turns. The result is a proper subgroup of G, but with such drastically different generators that solver algorithms must be rebuilt from scratch.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>Helicopter cube</strong>: 转 60° 而非 90° 的「斜切」, 群结构更复杂。</>}
              en={<><strong>Helicopter cube</strong>: 60° "jumbling" cuts rather than 90° face turns; richer group structure with non-trivial "jumbling" submanifolds.</>}
            />
          </li>
        </ul>
        <p>
          <L
            zh={<>这些「奇异拼图」 揭示了群论的真正威力: 一旦你接受「群是描述对称的语言」, 几乎任何机械拼图都能拿来分析。</>}
            en={<>These "exotic puzzles" reveal the true power of group theory: once you accept "groups are the language of symmetry," nearly any mechanical puzzle becomes analysable.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §16 Open problems ═══════════════════════════ */}
      <GTSec id="open-problems" className="gt-sec">
        <div className="gt-sec-num">§16</div>
        <h2 className="gt-sec-title">
          <L zh="未解问题 — 群论的开放前线" en="Open problems — frontiers of group theory" />
        </h2>
        <p>
          <L
            zh={<>魔方群本身的 «基本量» (阶、直径、结构定理) 都已完全确定。但仍有一些有趣的开放问题:</>}
            en={<>The "basic invariants" of the cube group (order, diameter, structure theorem) are all settled. But several intriguing open questions remain:</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 24, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="16.1  4×4×4 的 God's Number" en="16.1  4×4×4's God's Number" />
        </h3>
        <p>
          <L
            zh={<>4×4×4 群的直径目前只知道在 [22, 36] 区间内 (WCA standard move metric)。给定群阶 7.4 × 10⁴⁵, 完整枚举是不可能的。但近年算法的进步 (基于深度学习引导的 IDA*) 让上界不断收紧, 也许下一个十年会有最终答案。</>}
            en={<>The 4×4×4's diameter is currently bounded only to [22, 36] in the standard WCA metric. With order 7.4 × 10⁴⁵, full enumeration is impossible. But algorithmic progress (deep-learning-guided IDA* search) is steadily tightening the upper bound; perhaps the next decade brings a definitive answer.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 24, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="16.2  n×n×n 的渐近行为" en="16.2  Asymptotics of n×n×n" />
        </h3>
        <p>
          <L
            zh={<>对一般 n × n × n 立方体, Demaine 等人 (2018) 证明了求解的复杂度是 NP-完备的。但 God's number 的渐近增长率仍是开放问题: 已知它至少是 Θ(n²/log n), 但精确常数未确定。</>}
            en={<>For general n × n × n, Demaine et al. (2018) proved the optimal solving problem is NP-complete. But the asymptotic growth rate of God's number is open: it is at least Θ(n²/log n), but the precise constant remains unknown.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 24, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="16.3  通过减法的解法" en="16.3  Solving by subtraction" />
        </h3>
        <p>
          <L
            zh={<>Thistlethwaite 和 Kociemba 算法都属于「子群链下降」类型, 都把状态空间切成查表的层次。但还有完全不同的解法: 比如 <em>Korf 的 IDA*</em> (iterative deepening A*) 用启发式直接搜索 Cayley 图; <em>Rokicki 的「symmetry-augmented BFS」</em> 利用对称对状态减半。哪种方法在「平均最短解长度」 上最优? 这跟群结构密切相关, 是个长期研究问题。</>}
            en={<>Thistlethwaite and Kociemba are both subgroup-chain descent algorithms, slicing the state space into table look-ups. But entirely different methods exist: <em>Korf's IDA*</em> directly searches the Cayley graph with heuristics; <em>Rokicki's symmetry-augmented BFS</em> halves the state space via cube symmetries. Which method gives the best <em>average</em> optimal solution length is a long-running research question, tightly coupled to group structure.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 24, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="16.4  量子算法?" en="16.4  Quantum algorithms?" />
        </h3>
        <p>
          <L
            zh={<>量子计算机能否在「亚指数时间」内解魔方? 这是「黑盒子群论」(black-box group theory) 与量子算法的接壤。已知 Shor 算法用于阿贝尔群 (整数因式分解); 非阿贝尔情形 (如魔方群) 的量子算法仍是开放领域 (Hidden Subgroup Problem 的特殊例子)。</>}
            en={<>Can a quantum computer solve the cube in subexponential time? This sits at the intersection of black-box group theory and quantum algorithms. Shor's algorithm handles Abelian groups (integer factorization); the non-Abelian case (cube group included) remains the Hidden Subgroup Problem — a genuine frontier.</>}
          />
        </p>
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
          <div className="gt-def-title">{lang === 'zh' ? '定义 17.1' : 'Definition 17.1'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '定理 17.2' : 'Theorem 17.2'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '定理 17.3' : 'Theorem 17.3'}</div>
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
          <div className="gt-def-title">{lang === 'zh' ? '定义 18.1 — 群作用' : 'Definition 18.1 — group action'}</div>
          <div className="gt-def-body">
            <L
              zh={<>群 <span className="gt-math">G</span> 在集合 <span className="gt-math">X</span> 上的 <strong>作用</strong> 是一个映射 <span className="gt-math">G × X → X</span>, <span className="gt-math">(g, x) ↦ g · x</span>, 满足:</>}
              en={<>An <strong>action</strong> of group G on a set X is a map <span className="gt-math">G × X → X</span>, <span className="gt-math">(g, x) ↦ g · x</span>, satisfying:</>}
            />
            <ul style={{ paddingLeft: 24, margin: '8px 0' }}>
              <li><span className="gt-math">e · x = x</span> {lang === 'zh' ? '(单位元固定一切)' : '(identity fixes everything)'}</li>
              <li><span className="gt-math">(g · h) · x = g · (h · x)</span> {lang === 'zh' ? '(乘法兼容)' : '(compatible with multiplication)'}</li>
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
          <div className="gt-thm-title">{lang === 'zh' ? '定理 18.2 — Burnside' : 'Theorem 18.2 — Burnside'}</div>
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
          <div className="gt-thm-title">{lang === 'zh' ? '定理 18.3 — Cayley' : 'Theorem 18.3 — Cayley'}</div>
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
      </GTSec>

      {/* ═══════════════ §19 Lagrange + cosets ═══════════════════════ */}
      <GTSec id="lagrange" className="gt-sec">
        <div className="gt-sec-num">§19</div>
        <h2 className="gt-sec-title">
          <L zh="拉格朗日定理与陪集" en="Lagrange's theorem & cosets" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>「子群有多大」是描述 G 内部结构最基础的问题之一。拉格朗日定理把这件事完全钉死:<strong>每个子群的阶 必须整除整个群的阶</strong>。这一条把 G 内可能的子群限制得非常严格。</>}
            en={<>"How big can a subgroup be?" is one of the most basic structural questions about G. Lagrange's theorem nails it down: <strong>the order of every subgroup must divide the order of the whole group</strong>. A single divisibility constraint that severely restricts what subgroups can exist.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 19.1 — 陪集' : 'Definition 19.1 — coset'}</div>
          <div className="gt-def-body">
            <L
              zh={<>令 <span className="gt-math">H</span> 是群 <span className="gt-math">G</span> 的子群。 对任意 <span className="gt-math">g ∈ G</span>,记<TeXBlock src={`gH \\;=\\; \\{\\, gh \\;:\\; h \\in H \\,\\}`} />为 <strong>g 的左陪集</strong>。 类似地有右陪集 <TeX src={`Hg`} />。 两个陪集要么 <em>完全相等</em> 要么 <em>不相交</em>。</>}
              en={<>Let <span className="gt-math">H</span> be a subgroup of <span className="gt-math">G</span>. For any <span className="gt-math">g ∈ G</span>, the <strong>left coset</strong> of g is<TeXBlock src={`gH \\;=\\; \\{\\, gh \\;:\\; h \\in H \\,\\}.`} />Right cosets <TeX src={`Hg`} /> are defined similarly. Any two cosets are either <em>identical</em> or <em>disjoint</em>.</>}
            />
          </div>
        </div>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定理 19.2 — 拉格朗日 (1771)' : 'Theorem 19.2 — Lagrange (1771)'}</div>
          <div className="gt-def-body">
            <L
              zh={<><TeXBlock src={`|G| \\;=\\; [G : H] \\cdot |H|`} />其中 <TeX src={`[G:H]`} /> 是 <em>陪集数</em> (也叫指数)。 推论:<TeX src={`|H| \\mid |G|`} />。 任何 H 的阶都整除 |G|。</>}
              en={<><TeXBlock src={`|G| \\;=\\; [G : H] \\cdot |H|`} />where <TeX src={`[G:H]`} /> is the <em>number of cosets</em> (the index). Corollary: <TeX src={`|H| \\mid |G|`} />. Any subgroup's order divides the order of the whole group.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="19.1  证明概要" en="19.1  Proof sketch" />
        </h3>
        <p>
          <L
            zh={<>定义 <span className="gt-math">a ∼ b ⇔ a⁻¹b ∈ H</span>。验证这是 G 上的等价关系 (自反、对称、传递)。等价类就是左陪集 <TeX src={`gH`} />。所以 G 被分成不相交的等价类。每个类大小都等于 |H|: 因为映射 <TeX src={`h \\mapsto gh`} /> 是从 H 到 gH 的双射。所以总元素数 = (类数) × (每类大小)。 ∎</>}
            en={<>Define <span className="gt-math">a ∼ b ⇔ a⁻¹b ∈ H</span>. This is an equivalence relation on G; its classes are the left cosets <TeX src={`gH`} />, so G partitions into disjoint classes. Each class has size |H| because the map <TeX src={`h \\mapsto gh`} /> is a bijection H → gH. Hence total = (# classes) × (size per class). ∎</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="19.2  互动:选一个子群,看陪集分布" en="19.2  Interactive: pick a subgroup, see its cosets" />
        </h3>
        <CosetVisualizer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="19.3  关键推论" en="19.3  Key corollaries" />
        </h3>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><strong>元素阶整除群阶</strong>: 因为 <TeX src={`\\langle g \\rangle`} /> 是子群,而它的阶就是 g 的阶。 故 <TeX src={`\\operatorname{ord}(g) \\mid |G|`} />。</>}
            en={<><strong>Element order divides group order</strong>: since <TeX src={`\\langle g \\rangle`} /> is a subgroup of order = ord(g), Lagrange gives <TeX src={`\\operatorname{ord}(g) \\mid |G|`} />.</>}
          /></li>
          <li><L
            zh={<><strong>魔方上元素阶最大 1260</strong>: 因为 |G| = 2²⁷ · 3¹⁴ · 5³ · 7² · 11,任何元素阶都必须整除 |G|;在这个约束下,1260 = 2² · 3² · 5 · 7 是实际能构造的最大阶。</>}
            en={<><strong>The max element order on the cube is 1260</strong>: because |G| = 2²⁷ · 3¹⁴ · 5³ · 7² · 11, every element order must divide |G|; subject to that constraint, 1260 = 2² · 3² · 5 · 7 is the largest constructible order.</>}
          /></li>
          <li><L
            zh={<><strong>素数阶群一定循环</strong>: 若 |G| = p (素),G 只有平凡子群和自身。任一非单位元 g 生成 G。所以 G ≅ ℤ/p。</>}
            en={<><strong>Groups of prime order are cyclic</strong>: if |G| = p (prime), the only subgroups are {'{e}'} and G; so any non-identity g generates G. Hence G ≅ ℤ/p.</>}
          /></li>
        </ul>
        <div className="gt-aside" style={{ marginTop: 16 }}>
          <L
            zh={<>注意拉格朗日定理是 <strong>必要不充分</strong> 的: 整除并不蕴含「存在该阶的子群」。 例如 A₄ (12 阶) 没有阶 6 的子群,虽然 6 | 12。 充分性需要的额外条件由 <strong>Sylow 定理</strong> 给出。</>}
            en={<>Lagrange is <strong>necessary but not sufficient</strong>: divisibility doesn't guarantee a subgroup of that order exists. For example, A₄ (order 12) has no subgroup of order 6, even though 6 | 12. The sufficient direction requires <strong>Sylow's theorems</strong>.</>}
          />
        </div>
      </GTSec>

      {/* ═══════════════ §20 Normal subgroups + quotient ═══════════════════════ */}
      <GTSec id="quotient" className="gt-sec">
        <div className="gt-sec-num">§20</div>
        <h2 className="gt-sec-title">
          <L zh="正规子群与商群" en="Normal subgroups & quotient groups" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>拉格朗日告诉我们 G 怎么被一个子群 <em>切片</em>;但一般 <strong>陪集本身不是群</strong>。 只有当子群是 <em>正规子群</em> 时,陪集的集合才能继承群的结构,我们得到 <strong>商群</strong> <TeX src={`G/N`} />。 这是整个抽象代数最深的几个想法之一。</>}
            en={<>Lagrange tells us how a subgroup slices G; but <strong>cosets generally don't form a group</strong>. Only when the subgroup is <em>normal</em> does the set of cosets inherit a group structure — giving the <strong>quotient group</strong> <TeX src={`G/N`} />. This is among the deepest ideas in abstract algebra.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 20.1 — 正规子群' : 'Definition 20.1 — normal subgroup'}</div>
          <div className="gt-def-body">
            <L
              zh={<>子群 <span className="gt-math">N ⊂ G</span> 叫 <strong>正规子群</strong> (记作 <TeX src={`N \\triangleleft G`} />),如果它在共轭下保持不变:<TeXBlock src={`\\forall g \\in G, \\;\\; gNg^{-1} = N`} />等价地:左陪集 = 右陪集,<TeX src={`gN = Ng`} />。</>}
              en={<>A subgroup <span className="gt-math">N ⊂ G</span> is <strong>normal</strong> (written <TeX src={`N \\triangleleft G`} />) if it is invariant under conjugation:<TeXBlock src={`\\forall g \\in G, \\;\\; gNg^{-1} = N.`} />Equivalently, left cosets and right cosets coincide: <TeX src={`gN = Ng`} />.</>}
            />
          </div>
        </div>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定理 20.2 — 商群' : 'Theorem 20.2 — quotient group'}</div>
          <div className="gt-def-body">
            <L
              zh={<>若 <TeX src={`N \\triangleleft G`} />,陪集集合 <TeX src={`G/N = \\{gN : g \\in G\\}`} /> 在乘法<TeXBlock src={`(g_1 N)(g_2 N) := (g_1 g_2) N`} />下构成群。 阶 <TeX src={`|G/N| = [G:N]`} />。</>}
              en={<>If <TeX src={`N \\triangleleft G`} />, the coset set <TeX src={`G/N = \\{gN : g \\in G\\}`} /> forms a group under<TeXBlock src={`(g_1 N)(g_2 N) := (g_1 g_2) N.`} />Its order is <TeX src={`|G/N| = [G:N]`} />.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="20.1  正规子群从哪儿来?同态的核" en="20.1  Where do normal subgroups come from? Kernels of homomorphisms" />
        </h3>
        <p>
          <L
            zh={<>每个群同态 <TeX src={`\\varphi : G \\to H`} /> 的核<TeXBlock src={`\\ker \\varphi := \\{g \\in G : \\varphi(g) = e_H\\}`} />都是 G 的正规子群。 反过来 <strong>(第一同构定理)</strong>,每个正规子群都是某个同态的核;并且<TeXBlock src={`G/\\ker\\varphi \\;\\cong\\; \\operatorname{im}\\varphi.`} /></>}
            en={<>Every group homomorphism <TeX src={`\\varphi : G \\to H`} /> has a kernel<TeXBlock src={`\\ker \\varphi := \\{g \\in G : \\varphi(g) = e_H\\}`} />which is automatically normal in G. Conversely <strong>(First Isomorphism Theorem)</strong>, every normal subgroup is the kernel of some homomorphism; moreover<TeXBlock src={`G/\\ker\\varphi \\;\\cong\\; \\operatorname{im}\\varphi.`} /></>}
          />
        </p>
        <p>
          <L
            zh={<>这就把 §17 的同态、§5 的守恒律、§20 的正规子群全部串起来:<strong>三大守恒律就是三个同态 G → 小阿贝尔群</strong>。它们的核是 G 的三个特殊正规子群:</>}
            en={<>This ties §17's homomorphisms, §5's invariants, and §20's normal subgroups together: <strong>the three conservation laws are three homomorphisms G → small Abelian groups</strong>. Their kernels are three special normal subgroups of G:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><TeX src={`\\Sigma_{co} : G \\to \\mathbb{Z}/3`} />, <L zh="核是 「角扭转和为 0」 的状态集" en="kernel = states with corner twist sum 0" /></li>
          <li><TeX src={`\\Sigma_{eo} : G \\to \\mathbb{Z}/2`} />, <L zh="核是 「棱翻面和为 0」 的状态集" en="kernel = states with edge flip sum 0" /></li>
          <li><TeX src={`\\operatorname{sgn} : G \\to \\mathbb{Z}/2`} />, <L zh="核是 「偶置换」 的状态集 (双偶)" en="kernel = states with even-permutation parity" /></li>
        </ul>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="20.2  互动:选一个正规子群,看商群" en="20.2  Interactive: pick N, see G/N" />
        </h3>
        <QuotientGroupBuilder />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="20.3  换位子群 [G,G] 与阿贝尔化" en="20.3  Commutator subgroup [G,G] and abelianization" />
        </h3>
        <p>
          <L
            zh={<><strong>换位子群</strong> <TeX src={`[G,G]`} /> 是所有换位子 <TeX src={`[a,b] = aba^{-1}b^{-1}`} /> 生成的子群。 它一定是 G 的正规子群。 商 <TeX src={`G^{\\mathrm{ab}} := G/[G,G]`} /> 叫 G 的 <strong>阿贝尔化</strong> —— 它是「最大阿贝尔商」。</>}
            en={<>The <strong>commutator subgroup</strong> <TeX src={`[G,G]`} /> is generated by all commutators <TeX src={`[a,b] = aba^{-1}b^{-1}`} />. It is always normal in G. The quotient <TeX src={`G^{\\mathrm{ab}} := G/[G,G]`} /> is called the <strong>abelianization</strong> — the "largest Abelian quotient" of G.</>}
          />
        </p>
        <p>
          <L
            zh={<>对魔方:已知 <TeX src={`G^{\\mathrm{ab}} \\cong \\mathbb{Z}/2`} />。 也就是说 G 唯一的「阿贝尔化身影」就是 sgn 同态。 它说明了 G 是极度非阿贝尔的群:换位子群 [G,G] 占了 G 的一半,只有 sgn 一条信息能「逃出」到 ℤ/2。</>}
            en={<>For the cube, it is known that <TeX src={`G^{\\mathrm{ab}} \\cong \\mathbb{Z}/2`} />. The only Abelian shadow of G is the sgn homomorphism — half of G dies in [G,G]; only one bit (sign) survives. G is extremely non-Abelian.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="20.4  合成列与单群" en="20.4  Composition series & simple groups" />
        </h3>
        <p>
          <L
            zh={<>把 G 反复「商掉一个正规子群」直到不能再商,得到 <strong>合成列</strong><TeXBlock src={`G = G_0 \\triangleright G_1 \\triangleright G_2 \\triangleright \\cdots \\triangleright G_n = \\{e\\}`} />其中每个商 <TeX src={`G_i/G_{i+1}`} /> 都是 <strong>单群</strong> (即没有非平凡正规子群)。 Jordan–Hölder 定理保证这个商序列在重排下唯一。</>}
            en={<>Iteratively factoring G by normal subgroups gives a <strong>composition series</strong><TeXBlock src={`G = G_0 \\triangleright G_1 \\triangleright G_2 \\triangleright \\cdots \\triangleright G_n = \\{e\\}`} />where each quotient <TeX src={`G_i/G_{i+1}`} /> is <strong>simple</strong> (no proper non-trivial normal subgroup). Jordan–Hölder guarantees that, up to reordering, this sequence is unique.</>}
          />
        </p>
        <p>
          <L
            zh={<>对魔方群 G,合成列的「单群因子」是<TeXBlock src={`A_8 \\;\\times\\; A_{12} \\;\\times\\; (\\mathbb{Z}/2)^4 \\;\\times\\; (\\mathbb{Z}/3)^7`} />本质上是 §6 的结构定理换了语言重述。 A₈ 和 A₁₂ 是无穷家族 <em>非阿贝尔有限单群</em> 的成员。</>}
            en={<>For the cube group, the simple factors are<TeXBlock src={`A_8 \\;\\times\\; A_{12} \\;\\times\\; (\\mathbb{Z}/2)^4 \\;\\times\\; (\\mathbb{Z}/3)^7`} />— essentially a restatement of the structure theorem from §6. A₈ and A₁₂ are members of an infinite family of <em>non-Abelian finite simple groups</em>.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §21 Sn and An ═══════════════════════ */}
      <GTSec id="permutation-groups" className="gt-sec">
        <div className="gt-sec-num">§21</div>
        <h2 className="gt-sec-title">
          <L zh="置换群 Sₙ 与交错群 Aₙ" en="Symmetric & alternating groups" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>置换群是群论里最古老、最具体、也最丰富的家族。 19 世纪 Cauchy、 Cayley、 Galois 创立群论时,「群」几乎就是「置换的集合」 的同义词。 魔方群本质上是两个置换群的乘积:<TeX src={`G \\subset S_8 \\times S_{12}`} />。 理解 <TeX src={`S_n`} /> 和 <TeX src={`A_n`} /> 就理解了魔方一半的代数。</>}
            en={<>Permutation groups are the oldest, most concrete, and most prolific family in group theory. When Cauchy, Cayley, and Galois founded the subject in the 19th century, "group" was essentially synonymous with "permutation set." The cube group lives inside <TeX src={`S_8 \\times S_{12}`} />. Understanding <TeX src={`S_n`} /> and <TeX src={`A_n`} /> is half of cube algebra.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 21.1 — 对称群 Sₙ' : 'Definition 21.1 — symmetric group Sₙ'}</div>
          <div className="gt-def-body">
            <L
              zh={<><TeX src={`S_n`} /> 是 n 元集 {'{1, 2, ..., n}'} 上所有双射的集合,合成是运算。 它有<TeXBlock src={`|S_n| = n!`} />阶。</>}
              en={<><TeX src={`S_n`} /> is the set of all bijections of {'{1, 2, ..., n}'} under composition. Its order is<TeXBlock src={`|S_n| = n!`} /></>}
            />
          </div>
        </div>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 21.2 — 交错群 Aₙ' : 'Definition 21.2 — alternating group Aₙ'}</div>
          <div className="gt-def-body">
            <L
              zh={<><TeX src={`A_n \\subset S_n`} /> 是所有 <em>偶置换</em> (即偶数个对换的乘积) 构成的子群,等价地<TeXBlock src={`A_n = \\ker(\\operatorname{sgn} : S_n \\to \\{\\pm 1\\}).`} /><TeX src={`A_n`} /> 是 <TeX src={`S_n`} /> 的正规子群,阶 <TeX src={`|A_n| = n!/2`} />。</>}
              en={<><TeX src={`A_n \\subset S_n`} /> consists of the <em>even permutations</em> (those decomposable into an even number of transpositions);<TeXBlock src={`A_n = \\ker(\\operatorname{sgn} : S_n \\to \\{\\pm 1\\}).`} /><TeX src={`A_n`} /> is normal in <TeX src={`S_n`} /> with <TeX src={`|A_n| = n!/2`} />.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.1  Aₙ 的单纯性 (n ≥ 5)" en="21.1  Simplicity of Aₙ (n ≥ 5)" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定理 21.3 — Galois' : 'Theorem 21.3 — Galois'}</div>
          <div className="gt-def-body">
            <L
              zh={<>对所有 <TeX src={`n \\geq 5`} />, <TeX src={`A_n`} /> 是 <strong>单群</strong>: 它没有任何非平凡正规子群。</>}
              en={<>For all <TeX src={`n \\geq 5`} />, <TeX src={`A_n`} /> is a <strong>simple group</strong>: it has no proper non-trivial normal subgroups.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这条定理是 Galois 证明「五次方程没有根式解」的核心。 简单证明思路:</>}
            en={<>This theorem is the heart of Galois's proof that the quintic has no radical solution. Brief proof outline:</>}
          />
        </p>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<>验证 Aₙ 由 3-循环生成 (因为 n ≥ 3 时,任意偶置换可写成 3-循环的乘积)。</>}
            en={<>Verify that Aₙ is generated by 3-cycles (for n ≥ 3, every even permutation is a product of 3-cycles).</>}
          /></li>
          <li><L
            zh={<>设 <TeX src={`N \\triangleleft A_n`} /> 是非平凡正规子群。 证明 N 必含一个 3-循环。</>}
            en={<>Let <TeX src={`N \\triangleleft A_n`} /> be non-trivial. Show N must contain a 3-cycle.</>}
          /></li>
          <li><L
            zh={<>用共轭把任意 3-循环搬进 N。 故 N 含所有 3-循环 = Aₙ 的生成元。 矛盾。</>}
            en={<>Using conjugation, transport every 3-cycle into N. Hence N contains all the generators of Aₙ, forcing N = Aₙ. Contradiction.</>}
          /></li>
        </ol>
        <p>
          <L
            zh={<><strong>A₅ 是阶数最小的非阿贝尔单群</strong> (|A₅| = 60),也是有限单群分类里最低层的代表。 A₆、 A₇、 …… 跟魔方紧密相关:角块置换 <TeX src={`A_8`} /> 和 棱块置换 <TeX src={`A_{12}`} /> 都是非阿贝尔单群。</>}
            en={<><strong>A₅ is the smallest non-Abelian simple group</strong> (|A₅| = 60), and the entry point to the classification of finite simple groups. The cube uses both <TeX src={`A_8`} /> (corner permutations) and <TeX src={`A_{12}`} /> (edges), both non-Abelian simple.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.2  互动:Parity Calculator" en="21.2  Interactive: parity calculator" />
        </h3>
        <p>
          <L
            zh={<>给定任意公式,马上算出 sgn(cp)、 sgn(ep) 和它们的乘积。 第三个守恒律说乘积必须是 +1; 公式输入「单棱翻转」之类的不可能状态时, 计算器会显示 −1 —— 这是「不可达」的代数证据。</>}
            en={<>Plug in any alg; the calculator instantly returns sgn(cp), sgn(ep), and their product. The third invariant forces the product to be +1; if you type in an impossible state like a single-edge flip, the calculator shows −1 — algebraic proof of unreachability.</>}
          />
        </p>
        <ParityCalculator />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.3  凯莱定理:每个群都是置换群" en="21.3  Cayley's theorem: every group is a permutation group" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定理 21.4 — Cayley (1854)' : 'Theorem 21.4 — Cayley (1854)'}</div>
          <div className="gt-def-body">
            <L
              zh={<>每个群 G 都嵌入对称群:<TeXBlock src={`G \\;\\hookrightarrow\\; S_{|G|}.`} />映射 <TeX src={`g \\mapsto L_g`} /> 把 g 看成 G 上的左乘置换 <TeX src={`L_g(x) = gx`} />。 这是单同态。</>}
              en={<>Every group G embeds into a symmetric group:<TeXBlock src={`G \\;\\hookrightarrow\\; S_{|G|}.`} />The map <TeX src={`g \\mapsto L_g`} /> sends g to the left-multiplication permutation <TeX src={`L_g(x) = gx`} />. This is an injection of groups.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方,这是「显然且无用」的:抽象上 <TeX src={`G \\hookrightarrow S_{|G|} = S_{4.3 \\times 10^{19}}`} />,维度比 G 大无穷倍。 实际上 G 嵌入 <TeX src={`S_{48}`} /> (48 个贴纸的置换),这是 <strong>低维表示</strong>。 一般「群在它本身上的左作用」是凯莱定理的灵感来源,但魔方提醒我们 <em>低维忠实表示</em> 才是真正有用的。</>}
            en={<>For the cube this is "obvious and useless": abstractly <TeX src={`G \\hookrightarrow S_{|G|} = S_{4.3 \\times 10^{19}}`} />, which is astronomically large. In practice G embeds into <TeX src={`S_{48}`} /> (permutations of 48 stickers), a much <strong>lower-dimensional representation</strong>. Cayley's theorem inspires the idea; finding minimal faithful representations is the real game.</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §22 Solving algorithms ═══════════════════════ */}
      <GTSec id="algorithms" className="gt-sec">
        <div className="gt-sec-num">§22</div>
        <h2 className="gt-sec-title">
          <L zh="解魔方的算法" en="Solving algorithms" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>从 §10 的 Thistlethwaite 子群链开始,到 Kociemba 两阶段、 Korf 最优 IDA*、 Rokicki 对称压缩枚举 —— 每一个 solver 都把不同的群论概念翻译成具体算法。 这是「群论的工程化」最干净的例子之一。</>}
            en={<>Starting from §10's Thistlethwaite subgroup chain, through Kociemba's two-phase, Korf's optimal IDA*, and Rokicki's coset enumeration — each solver translates a different group-theoretic idea into running code. Group theory rendered as engineering, in one of its cleanest forms.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.1  比较表" en="22.1  Comparison table" />
        </h3>
        <AlgorithmCompareTable />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.2  Thistlethwaite 算法:子群链 + 阶段搜索" en="22.2  Thistlethwaite: subgroup chain + per-stage search" />
        </h3>
        <p>
          <L
            zh={<>核心想法:把 G 的解分解为 <em>4 个独立子问题</em>,每个子问题在子群 <TeX src={`G_i/G_{i+1}`} /> 上做有限制的 BFS/IDA*。 因为每个商小很多 (最大约 10⁶),BFS 可以存全表。</>}
            en={<>Core idea: decompose the solve into <em>4 independent subproblems</em>, each a bounded BFS/IDA* on the quotient <TeX src={`G_i/G_{i+1}`} />. The quotients are small (≤ 10⁶), so each stage has a complete pruning table.</>}
          />
        </p>
        <TeXBlock src={`G_0 = G \\;\\supset\\; G_1 \\;\\supset\\; G_2 \\;\\supset\\; G_3 \\;\\supset\\; \\{e\\}`} />
        <ThistlethwaitePhaseChart />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.3  Kociemba 两阶段算法" en="22.3  Kociemba's two-phase algorithm" />
        </h3>
        <p>
          <L
            zh={<>Kociemba 把 4 阶段合并成 <strong>2 阶段</strong>:阶段 1 把状态搬进 <TeX src={`G_2 = \\langle U, D, L^2, R^2, F^2, B^2 \\rangle`} />,阶段 2 在 G₂ 内部解开。 两阶段都用 IDA* + 模式数据库。</>}
            en={<>Kociemba collapsed 4 stages into <strong>2</strong>: Phase 1 moves the state into <TeX src={`G_2 = \\langle U, D, L^2, R^2, F^2, B^2 \\rangle`} />, Phase 2 solves within G₂. Both phases run IDA* with pruning tables.</>}
          />
        </p>
        <div className="gt-algo-flow">
          <div className="gt-algo-flow-step">
            <div className="gt-algo-flow-num">Phase 1</div>
            <div className="gt-algo-flow-title">{lang === 'zh' ? 'G → G₂' : 'G → G₂'}</div>
            <div className="gt-algo-flow-body">
              {lang === 'zh' ? '坐标:(co, eo, slice). 表大小:2187 × 2048 × 495 ≈ 2.2 × 10⁹。 用 IDA*, 启发式 max(co-depth, eo-depth, slice-depth)。' : 'Coords: (co, eo, slice). Table sizes 2187 × 2048 × 495 ≈ 2.2 × 10⁹. IDA* with heuristic max(co, eo, slice).'}
            </div>
          </div>
          <div className="gt-algo-flow-arrow">→</div>
          <div className="gt-algo-flow-step">
            <div className="gt-algo-flow-num">Phase 2</div>
            <div className="gt-algo-flow-title">{lang === 'zh' ? 'G₂ → e' : 'G₂ → e'}</div>
            <div className="gt-algo-flow-body">
              {lang === 'zh' ? '坐标:(cp, ep_UD, ep_slice). 表大小 40320 × 40320 × 24 ≈ 4 × 10¹⁰. 但每个状态只有 10 个允许 generator (U, D, L², R², F², B²)。' : 'Coords: (cp, ep_UD, ep_slice). Table 40320 × 40320 × 24 ≈ 4 × 10¹⁰. Only 10 generators allowed in this phase.'}
            </div>
          </div>
        </div>
        <p style={{ marginTop: 16 }}>
          <L
            zh={<>2 阶段算法不一定最优 (会过冲一些步数),但 <strong>毫秒级 + 平均 ~21 HTM</strong>,工业用 solver 几乎都是它的变体 (cube20 用 Reid 优化版,kociemba.org 用 N=18 切换)。</>}
            en={<>Two-phase is not optimal (overshoots a few moves) but runs in <strong>milliseconds at ~21 HTM avg.</strong>; nearly every production solver is a variant (cube20 uses Reid's tweaks; kociemba.org uses Phase-2 lookup with N=18).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.4  Korf IDA*:第一个最优 solver" en="22.4  Korf's IDA*: the first optimal solver" />
        </h3>
        <p>
          <L
            zh={<>1997 年 Richard Korf 用 IDA* (Iterative Deepening A*) + 大小约 80 MB 的 <strong>pattern database</strong> 第一次得到了 Rubik's Cube 的 <em>最优解</em>。 关键想法:对单独子集 (8 角的 ep+eo, 或 6 棱) 预计算 <em>最短解</em>;启发式 h(s) = max(各子集的最短解距离)。这个 h 总是 admissible (不高估),保证 IDA* 找到最优。</>}
            en={<>In 1997 Richard Korf delivered the first <em>optimal</em> Rubik's Cube solver via IDA* (Iterative Deepening A*) plus an ~80 MB <strong>pattern database</strong>. Key idea: precompute exact distances on chosen subsets (8 corners, or 6 edges) and use h(s) = max of subset distances. The h is admissible (never overestimates), so IDA* yields the optimum.</>}
          />
        </p>
        <div className="gt-algo-pseudo">
{`function IDAstar(start):
    bound = h(start)
    while True:
        t = search(start, 0, bound)
        if t == FOUND: return path
        bound = t

function search(node, g, bound):
    f = g + h(node)
    if f > bound: return f
    if isGoal(node): return FOUND
    min = ∞
    for child in successors(node):
        t = search(child, g + 1, bound)
        if t == FOUND: return FOUND
        if t < min: min = t
    return min`}
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="22.5  Rokicki 对称压缩:20-步证明" en="22.5  Rokicki coset enumeration: the 20-move proof" />
        </h3>
        <p>
          <L
            zh={<>Tomas Rokicki 等人 (2010) 用了一个 <strong>不解魔方</strong> 的算法:把 G 划分为 G/H 的陪集 (H 是 Kociemba 的 G₂),对每个陪集证明「20 步内可解」。 关键:</>}
            en={<>Tomas Rokicki et al. (2010) used an algorithm that does <strong>not solve cubes</strong>: partition G into cosets G/H (H = Kociemba's G₂), and for each coset prove "solvable in ≤ 20 moves." Key ingredients:</>}
          />
        </p>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><strong>对称减:</strong> 用 48 阶 Oₕ 对称群把 |G/H| ≈ 2 × 10⁹ 个陪集压到 ~5 × 10⁷ 个对称等价类。</>}
            en={<><strong>Symmetry reduction:</strong> use the order-48 Oₕ symmetry group to collapse |G/H| ≈ 2 × 10⁹ cosets down to ~5 × 10⁷ equivalence classes.</>}
          /></li>
          <li><L
            zh={<><strong>每个陪集 ≤ 20 步:</strong> 对每个等价类的代表跑一次「19 步内可解吗?」 IDA*。 如果可以,这个陪集所有 (4 × 10¹⁰) 个元素都「19 步内解」。 如果不能,降到 20 步 ——必然成功。</>}
            en={<><strong>Each coset ≤ 20 moves:</strong> for each representative, IDA* asks "solvable in ≤ 19 moves?" If yes, all 4 × 10¹⁰ states in that coset are. If not, try 20 — must succeed.</>}
          /></li>
          <li><L
            zh={<><strong>总 CPU 时间:</strong> Google 捐了大约 35 CPU-年。 2010 年宣布:Rubik's Cube 直径 = 20 HTM。</>}
            en={<><strong>Total CPU time:</strong> Google donated ~35 CPU-years. Announced 2010: the cube's diameter is exactly 20 HTM.</>}
          /></li>
        </ol>
      </GTSec>

      {/* ═══════════════ §23 Distance distribution ═══════════════════════ */}
      <GTSec id="distance" className="gt-sec">
        <div className="gt-sec-num">§23</div>
        <h2 className="gt-sec-title">
          <L zh="距离分布与 20 步证明" en="Distance distribution & the 20-move proof" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>魔方 Cayley 图的 <strong>距离分布</strong> 是一个让人难忘的图表: 几乎所有 4.3 × 10¹⁹ 个状态都落在 d = 18 或 19 上,而 d = 20 的状态只有 4.9 × 10⁸ 个 (相对很少)。 这跟「上帝之数 = 20」 的证明直接相关。</>}
            en={<>The cube's Cayley-graph <strong>distance distribution</strong> is a striking diagram: nearly all 4.3 × 10¹⁹ states land at d = 18 or 19, while only 4.9 × 10⁸ states sit at d = 20. This distribution is exactly what the God's-number-20 proof produced.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="23.1  互动图表 (HTM)" en="23.1  Interactive chart (HTM)" />
        </h3>
        <DistanceDistributionChart />
        <p style={{ marginTop: 24 }}>
          <L
            zh={<>纵轴是 log₁₀(状态数)。 注意几个特征:</>}
            en={<>Vertical axis is log₁₀(count). A few features to notice:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<>d = 0 ~ 8: 几乎可解析地是 <TeX src={`18(15)^{d-1}`} /> 量级 (每步 18 个选择,部分会重叠,但增长保持指数)。</>}
            en={<>d = 0…8: roughly <TeX src={`\\sim 18 \\cdot 15^{d-1}`} /> (18 generators, with cancellations); near-exponential growth.</>}
          /></li>
          <li><L
            zh={<>d = 8 ~ 15: 指数增长开始饱和;每个状态的「未访问邻居」越来越少。</>}
            en={<>d = 8…15: exponential growth saturates; unvisited neighbors per state plateau.</>}
          /></li>
          <li><L
            zh={<>d = 15 ~ 18: <strong>峰值</strong> 在 18 或 19 (依论文版本)。 在峰值处, G 一半以上的元素都聚集。</>}
            en={<>d = 15…18: <strong>peak</strong> around 18 or 19. The bulk of G's elements live there.</>}
          /></li>
          <li><L
            zh={<>d = 20: 4.9 × 10⁸ 个 ——「上帝之数」 = 20 即由这一行存在 (非零) 而 d = 21 行不存在 (一定为零) 共同定义。</>}
            en={<>d = 20: 4.9 × 10⁸ states. "God's number = 20" is the joint fact that this row is non-zero and any d = 21 row would have to be empty.</>}
          /></li>
        </ul>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="23.2  HTM vs QTM" en="23.2  HTM vs QTM" />
        </h3>
        <table className="gt-distance-tbl">
          <thead>
            <tr>
              <th>{lang === 'zh' ? '度量' : 'Metric'}</th>
              <th>{lang === 'zh' ? '生成集' : 'Generators'}</th>
              <th>{lang === 'zh' ? '直径' : 'Diameter'}</th>
              <th>{lang === 'zh' ? '随机平均' : 'Random avg'}</th>
              <th>{lang === 'zh' ? '上限证明' : 'Bound proof'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>HTM</strong> ({lang === 'zh' ? '半圈' : 'half-turn'})</td>
              <td className="num">18</td>
              <td className="num">20</td>
              <td className="num">~18</td>
              <td className="num">{lang === 'zh' ? '2010 Rokicki et al.' : '2010 Rokicki et al.'}</td>
            </tr>
            <tr>
              <td><strong>QTM</strong> ({lang === 'zh' ? '四分一圈' : 'quarter-turn'})</td>
              <td className="num">12</td>
              <td className="num">26</td>
              <td className="num">~22</td>
              <td className="num">{lang === 'zh' ? '2014 Rokicki & Kociemba' : '2014 Rokicki & Kociemba'}</td>
            </tr>
            <tr>
              <td><strong>STM</strong> ({lang === 'zh' ? '加切片' : 'slice'})</td>
              <td className="num">27</td>
              <td className="num">{lang === 'zh' ? '≤ 20 (未严格)' : '≤ 20 (unproven)'}</td>
              <td className="num">~17</td>
              <td className="num">{lang === 'zh' ? '部分计算' : 'partial enumerations'}</td>
            </tr>
          </tbody>
        </table>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="23.3  Superflip 与「严格 20 步」状态" en={'23.3  Superflip & the "strict-20" club'} />
        </h3>
        <p>
          <L
            zh={<>四个状态曾经被认为是「最远」的: <strong>superflip</strong> (所有棱翻转, 1995 Reid 证明需要 20 HTM)、 <strong>superflip 复合 4-spot</strong>、 <strong>superflip 复合 6-spot</strong>。 2010 后, 已知共有 4.9 × 10⁸ 个状态距离严格 = 20。</>}
            en={<>Four states were once known as "the furthest": <strong>superflip</strong> (all edges flipped; Reid 1995 proved it requires 20 HTM), and superflip composed with the 4-spot or 6-spot patterns. After 2010, the full census reveals 4.9 × 10⁸ states at exactly distance 20.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>有趣的是, 这 4.9 × 10⁸ 个 「最远状态」 在 |G| 中只占 <strong>10⁻¹¹</strong>。 如果你随机生成一个 scramble, 期望距离是 18, 几乎从来碰不到 20。 「上帝之数」实际上是一个 <em>极值</em> 结果, 不代表魔方有多难解。</>}
            en={<>Interestingly, these 4.9 × 10⁸ "farthest" states make up <strong>10⁻¹¹</strong> of |G|. A random scramble has expected distance 18 and essentially never hits 20. The "God's number" is an extreme-value result, not a measure of difficulty.</>}
          />
        </div>
      </GTSec>

      {/* ═══════════════ §24 Random walks ═══════════════════════ */}
      <GTSec id="random-walks" className="gt-sec">
        <div className="gt-sec-num">§24</div>
        <h2 className="gt-sec-title">
          <L zh="群上的随机游走" en="Random walks on G" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>「随机打乱」其实是 G 上的一个 <strong>马尔可夫链</strong>:每一步从 18 个 HTM 生成元中均匀随机选一个。 经典的问题是: <em>多少步之后, 状态分布 「足够接近」 G 上的均匀分布</em>? 答案叫 <strong>混合时间</strong>, 它跟随机游走理论里的 cutoff 现象密切相关 (Diaconis–Shahshahani 1981 风格)。</>}
            en={<>"Random scrambling" is actually a <strong>Markov chain</strong> on G: each step uniformly picks one of 18 HTM generators. The natural question: after how many steps is the distribution "close enough" to uniform on G? The answer is the <strong>mixing time</strong>, deeply linked to the cutoff phenomenon in random-walk theory (Diaconis–Shahshahani 1981 style).</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 24.1 — 总变差距离' : 'Definition 24.1 — total variation distance'}</div>
          <div className="gt-def-body">
            <L
              zh={<>对 G 上两个概率分布 P 和 Q,定义<TeXBlock src={`d_{TV}(P, Q) \\;=\\; \\tfrac{1}{2} \\sum_{g \\in G} |P(g) - Q(g)|.`} />混合时间 <TeX src={`t_{\\mathrm{mix}}(\\varepsilon)`} /> 是「<TeX src={`d_{TV}(\\mu^t, \\mathrm{Unif}_G) \\leq \\varepsilon`} />」 所需的最小 t。</>}
              en={<>For two probability distributions P, Q on G, define<TeXBlock src={`d_{TV}(P, Q) \\;=\\; \\tfrac{1}{2} \\sum_{g \\in G} |P(g) - Q(g)|.`} />The mixing time <TeX src={`t_{\\mathrm{mix}}(\\varepsilon)`} /> is the smallest t such that <TeX src={`d_{TV}(\\mu^t, \\mathrm{Unif}_G) \\leq \\varepsilon`} />.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="24.1  互动:随机游走模拟" en="24.1  Interactive: random-walk simulator" />
        </h3>
        <p>
          <L
            zh={<>下面以 80 ms 一步的速度运行 G 上的随机游走。 灰色柱是 "代理距离" (位置 + 朝向错位数),你能直观看到它从 0 爬到 ~40 然后稳定。 三个守恒律在整条轨迹上保持恒等 ——「游走只在可达 coset 内移动」 的视觉证明。</>}
            en={<>The random walk below ticks at 80 ms per step. Bars show a "proxy distance" (mismatched positions + orientations); watch it climb from 0 to ~40 and plateau. The three invariants stay pinned along the trajectory — visual proof that the walk lives inside the reachable coset.</>}
          />
        </p>
        <RandomWalkSimulator />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="24.2  混合时间的渐进估计" en="24.2  Asymptotic estimate of mixing time" />
        </h3>
        <p>
          <L
            zh={<>对一般有限群 G 上的 k-生成简单随机游走, Diaconis–Shahshahani 给了一个用 <em>群表示论</em> 的精确公式:<TeXBlock src={`d_{TV}^2 \\;\\leq\\; \\tfrac{1}{4} \\sum_{\\rho \\neq \\text{triv}} d_\\rho^2 \\, \\|\\hat\\mu(\\rho)\\|^{2t}`} />其中 <TeX src={`\\hat\\mu(\\rho)`} /> 是测度 μ 在不可约表示 ρ 下的 Fourier 系数。 对魔方, 这个上界粗算给出<TeXBlock src={`t_{\\mathrm{mix}}(0.25) \\;\\sim\\; \\Theta(\\log_2 |G|) \\;\\sim\\; 20\\text{–}30.`} /></>}
            en={<>For a simple random walk on a general finite group with k generators, Diaconis–Shahshahani give an exact bound via <em>representation theory</em>:<TeXBlock src={`d_{TV}^2 \\;\\leq\\; \\tfrac{1}{4} \\sum_{\\rho \\neq \\text{triv}} d_\\rho^2 \\, \\|\\hat\\mu(\\rho)\\|^{2t}`} />where <TeX src={`\\hat\\mu(\\rho)`} /> is the Fourier coefficient of measure μ at irreducible representation ρ. For the cube, a back-of-envelope evaluation gives<TeXBlock src={`t_{\\mathrm{mix}}(0.25) \\;\\sim\\; \\Theta(\\log_2 |G|) \\;\\sim\\; 20\\text{–}30.`} /></>}
          />
        </p>
        <p>
          <L
            zh={<>WCA 用 <strong>25-步</strong> scramble 不是偶然: 25 步基本就处在 mixing time 上限附近, 同时 <em>不会触及 d = 20 上限</em> (有意义的 scramble 不应是已知最远状态)。 实际 generator 会用 <em>无连续同面</em> 约束 (即 <em>aperiodic restriction</em>),使分布更接近均匀 —— 这是 WCA 的 TNoodle 生成器的核心。</>}
            en={<>WCA's <strong>25-move</strong> scramble length is no accident: 25 sits near the mixing-time bound while staying away from the 20-move God's-number ceiling (meaningful scrambles shouldn't be known extremal states). In practice scramblers impose "no consecutive same-face" (aperiodic restrictions) to push the distribution closer to uniform — this is the heart of TNoodle, WCA's scramble generator.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="24.3  Cutoff 现象" en="24.3  The cutoff phenomenon" />
        </h3>
        <p>
          <L
            zh={<>Diaconis 1980s 发现的「 <strong>cutoff</strong> 」 现象: 对许多自然群上的随机游走, <TeX src={`d_{TV}(t)`} /> 在很长时间内接近 1, 然后在 <em>非常窄</em> 的 t 区间内突然降到接近 0。 比如 7 张牌的 riffle shuffle 需要 7 次才能 「彻底打乱」 —— Bayer–Diaconis 1992 著名的「3/2 log₂ n 牌」结果。 魔方上类似 cutoff 现象的精确临界值至今未严格证明。</>}
            en={<>Diaconis's <strong>cutoff</strong> phenomenon (1980s): for many natural random walks on groups, <TeX src={`d_{TV}(t)`} /> stays near 1 for a long time and then drops sharply to near 0 within a narrow window. Bayer–Diaconis (1992) famously proved 7 riffle shuffles suffice to mix a deck of 52 cards ("3/2 log₂ n" cards). A precise cutoff for the cube is open.</>}
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
          <div className="gt-def-title">{lang === 'zh' ? '定义 25.1 — 基与稳定子链' : 'Definition 25.1 — base & stabilizer chain'}</div>
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
          <strong>GAP code</strong> ({lang === 'zh' ? '验证 |G| = 4.3 × 10¹⁹' : 'verify |G| = 4.3 × 10¹⁹'}):
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
          <L zh="25.3  为什么这对魔方算法重要?" en="25.3  Why does this matter for cube algorithms?" />
        </h3>
        <p>
          <L
            zh={<>BSGS 是 「<strong>membership test</strong>」 的天然数据结构: 给定一个置换 g, 它属于 G 吗? 答: 逐层用 Schreier 表 反向把 g 分解; 若能完全归约就属于。 用 <TeX src={`O(k \\cdot n^2)`} /> 时间。 这个数据结构对求解器没直接用 (求解器需要短表示, BSGS 给的是长表示), 但对一些群论问题 (验证一个公式生成全 G, 或一个子群的指数) 非常有效。</>}
            en={<>BSGS is the natural data structure for the <strong>membership test</strong>: given a permutation g, is g ∈ G? Answer: decompose g layer-by-layer using Schreier transversals; if it fully reduces, yes. Takes <TeX src={`O(k \\cdot n^2)`} /> time. Not directly useful for solvers (solvers need short presentations; BSGS gives long ones), but it's essential for many group-theory questions (e.g. does this alg set generate all of G? what is the index of this subgroup?).</>}
          />
        </p>
      </GTSec>

      {/* ═══════════════ §26 Representation theory ═══════════════════════ */}
      <GTSec id="representations" className="gt-sec">
        <div className="gt-sec-num">§26</div>
        <h2 className="gt-sec-title">
          <L zh="表示论一瞥" en="A glimpse of representation theory" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>把一个有限群 G 「线性化」 —— 找一个忠实的群同态 <TeX src={`\\rho : G \\to GL_n(\\mathbb{C})`} /> —— 是表示论的入门。 把群论问题翻译成 <strong>线性代数问题</strong> 是 19 世纪以来代数学的核心发明之一 (Frobenius, Schur)。</>}
            en={<>To "linearize" a finite group G — find a faithful homomorphism <TeX src={`\\rho : G \\to GL_n(\\mathbb{C})`} /> — is the entrance to representation theory. Translating group questions into <strong>linear algebra</strong> is one of the great inventions of late-19th-century mathematics (Frobenius, Schur).</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 26.1 — 表示' : 'Definition 26.1 — representation'}</div>
          <div className="gt-def-body">
            <L
              zh={<>群 G 的一个 <strong>表示</strong> 是同态 <TeX src={`\\rho : G \\to GL_n(\\mathbb{C})`} />, 把 g 映为可逆 n × n 复矩阵。 n 称为 <strong>维数</strong>。 表示叫 <strong>不可约</strong> 如果只有平凡子空间在所有 ρ(g) 下不变。 有限群的每个表示都是不可约表示的 <em>直和</em> (Maschke 定理)。</>}
              en={<>A <strong>representation</strong> of G is a homomorphism <TeX src={`\\rho : G \\to GL_n(\\mathbb{C})`} /> sending g to an invertible complex matrix. n is the <strong>dimension</strong>. ρ is <strong>irreducible</strong> if no non-trivial subspace is invariant under all ρ(g). Every representation of a finite group is a <em>direct sum</em> of irreducibles (Maschke's theorem).</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="26.1  特征" en="26.1  Characters" />
        </h3>
        <p>
          <L
            zh={<>特征 <TeX src={`\\chi_\\rho(g) = \\operatorname{tr}\\rho(g)`} /> 是 G 上的类函数 (只依赖共轭类)。 不可约特征构成 G 上 <em>正交基</em>:<TeXBlock src={`\\langle \\chi_\\rho, \\chi_{\\rho'} \\rangle = \\tfrac{1}{|G|} \\sum_{g \\in G} \\chi_\\rho(g) \\overline{\\chi_{\\rho'}(g)} = \\delta_{\\rho \\rho'}.`} />这是 G 上的「Fourier 分析」, 完全类比于 <TeX src={`\\mathbb{R}/\\mathbb{Z}`} /> 上的 Fourier 级数。</>}
            en={<>The character <TeX src={`\\chi_\\rho(g) = \\operatorname{tr}\\rho(g)`} /> is a class function on G (depends only on conjugacy class). Irreducible characters form an <em>orthonormal basis</em>:<TeXBlock src={`\\langle \\chi_\\rho, \\chi_{\\rho'} \\rangle = \\tfrac{1}{|G|} \\sum_{g \\in G} \\chi_\\rho(g) \\overline{\\chi_{\\rho'}(g)} = \\delta_{\\rho \\rho'}.`} />This is "Fourier analysis on G", perfectly analogous to Fourier series on <TeX src={`\\mathbb{R}/\\mathbb{Z}`} />.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="26.2  魔方群的 1 维表示" en="26.2  1-dimensional representations of G" />
        </h3>
        <CharacterTableHint />
        <p style={{ marginTop: 16 }}>
          <L
            zh={<>1 维不可约表示 <TeX src={`\\rho : G \\to \\mathbb{C}^*`} /> 必然穿过 <TeX src={`G^{\\mathrm{ab}}`} />, 因为 <TeX src={`\\mathbb{C}^*`} /> 阿贝尔。 故 <strong>1 维不可约表示数 = |G^ab|</strong>。 对魔方 G^ab = ℤ/2, 所以恰好两个 1 维表示。</>}
            en={<>Any 1-dim irreducible <TeX src={`\\rho : G \\to \\mathbb{C}^*`} /> factors through <TeX src={`G^{\\mathrm{ab}}`} /> since <TeX src={`\\mathbb{C}^*`} /> is Abelian. So the <strong>number of 1-dim irreducibles = |G^ab|</strong>. For the cube, G^ab = ℤ/2, giving exactly two.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="26.3  Fourier 分析与随机游走" en="26.3  Fourier analysis & random walks" />
        </h3>
        <p>
          <L
            zh={<>§24 的随机游走上界<TeXBlock src={`d_{TV}^2(\\mu^t, \\mathrm{Unif}) \\leq \\tfrac{1}{4} \\sum_{\\rho \\neq \\mathrm{triv}} d_\\rho^2 \\, \\|\\hat\\mu(\\rho)\\|^{2t}`} />来自表示论:把测度 μ 展成「 G 上的 Fourier 级数 」 (即对每个不可约 ρ 取系数 <TeX src={`\\hat\\mu(\\rho)`} />), 然后用 Parseval 等式估计衰减。 这就是 Diaconis 在 1980s 革命的洗牌分析框架的群论核心。</>}
            en={<>The §24 random-walk bound<TeXBlock src={`d_{TV}^2(\\mu^t, \\mathrm{Unif}) \\leq \\tfrac{1}{4} \\sum_{\\rho \\neq \\mathrm{triv}} d_\\rho^2 \\, \\|\\hat\\mu(\\rho)\\|^{2t}`} />comes from representation theory: expand μ in the "G-Fourier" basis, then apply Parseval. This is the group-theoretic heart of Diaconis's 1980s shuffle revolution.</>}
          />
        </p>
        <div className="gt-aside">
          <L
            zh={<>魔方群 G 的完整不可约表示分类 (即所有不可约 ρ 的列表) 至今没有完全列出。 已知 <strong>不可约表示数 = 共轭类数 ≈ 81120</strong> (大约), 但具体维度和特征值需要大量计算。 这是一个对计算代数系统 (Sage, Magma) 都还有点吃力的对象。</>}
            en={<>The complete classification of irreducibles of G (a full list of all ρ) has never been written out. We know <strong># irreducibles = # conjugacy classes ≈ 81,120</strong>, but the exact dimensions and characters require massive computation. Even modern CAS (Sage, Magma) struggle with the full table.</>}
          />
        </div>
      </GTSec>

      {/* ═══════════════ References ══════════════════════════════════ */}
      <GTSec id="refs" className="gt-sec">
        <div className="gt-sec-num">REF</div>
        <h2 className="gt-sec-title">
          <L zh="参考文献" en="References" />
        </h2>
        <div className="gt-refs">
          <ol>
            <li id="ref-singmaster" className="gt-ref-cite">
              D. Singmaster, <em>Notes on Rubik's "Magic Cube"</em>, Enslow Publishers, 1981. The book that named the canonical move notation U, D, L, R, F, B and laid out the first algebraic study of the cube.
            </li>
            <li id="ref-chen">
              J. Chen, <em>Group Theory and the Rubik's Cube</em>, Harvard lecture notes, 2004. <a href="https://people.math.harvard.edu/~jjchen/docs/Group%20Theory%20and%20the%20Rubik's%20Cube.pdf" target="_blank" rel="noopener noreferrer">people.math.harvard.edu/~jjchen</a>
            </li>
            <li id="ref-provenza">
              H. Provenza, <em>Group Theory and the Rubik's Cube</em>, REU paper, U. Chicago, 2009. <a href="https://www.math.uchicago.edu/~may/VIGRE/VIGRE2009/REUPapers/Provenza.pdf" target="_blank" rel="noopener noreferrer">math.uchicago.edu/Provenza.pdf</a>
            </li>
            <li id="ref-travis">
              M. Travis, <em>The Mathematics of the Rubik's Cube</em>, REU paper, U. Chicago, 2007. <a href="https://www.math.uchicago.edu/~may/VIGRE/VIGRE2007/REUPapers/FINALAPP/Travis.pdf" target="_blank" rel="noopener noreferrer">math.uchicago.edu/Travis.pdf</a>
            </li>
            <li id="ref-thistlethwaite">
              M. Thistlethwaite, <em>The 45 move algorithm</em>, unpublished, 1981. Reproduced in Jaap's puzzle page: <a href="https://www.jaapsch.net/puzzles/thistle.htm" target="_blank" rel="noopener noreferrer">jaapsch.net/puzzles/thistle.htm</a>
            </li>
            <li id="ref-rokicki">
              T. Rokicki, H. Kociemba, M. Davidson, J. Dethridge, <em>The diameter of the Rubik's cube group is twenty</em>, SIAM J. Discrete Math. 27(2):1082–1105, 2013. <a href="https://tomas.rokicki.com/rubik20.pdf" target="_blank" rel="noopener noreferrer">tomas.rokicki.com/rubik20.pdf</a> · <a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">cube20.org</a>
            </li>
            <li id="ref-kociemba">
              H. Kociemba, <em>The two-phase algorithm</em>, technical notes, 1992–present. <a href="https://kociemba.org/" target="_blank" rel="noopener noreferrer">kociemba.org</a>
            </li>
            <li id="ref-joyner">
              D. Joyner, <em>Adventures in Group Theory: Rubik's Cube, Merlin's Machine, and Other Mathematical Toys</em>, 2nd ed., Johns Hopkins University Press, 2008. The definitive textbook on cube algebra.
            </li>
            <li id="ref-bandelow">
              C. Bandelow, <em>Inside Rubik's Cube and Beyond</em>, Birkhäuser, 1982. The earliest dedicated mathematical treatment.
            </li>
            <li id="ref-wiki">
              Wikipedia, <em>Rubik's Cube group</em>. <a href="https://en.wikipedia.org/wiki/Rubik's_Cube_group" target="_blank" rel="noopener noreferrer">en.wikipedia.org/wiki/Rubik's_Cube_group</a>
            </li>
            <li id="ref-daniels">
              L. Daniels, <em>Group Theory and the Rubik's Cube</em>, Senior thesis, 2013. <a href="http://math.fon.rs/files/DanielsProject58.pdf" target="_blank" rel="noopener noreferrer">math.fon.rs/files/DanielsProject58.pdf</a>
            </li>
            <li id="ref-minrep">
              <em>The Rubik's Cube and Minimal Representations of Split Group Extensions</em>, arXiv:2508.00687, 2025. <a href="https://arxiv.org/pdf/2508.00687" target="_blank" rel="noopener noreferrer">arxiv.org/pdf/2508.00687</a>
            </li>
            <li id="ref-mulhol">
              J. Mulholland, <em>Math 302: Rubik's Cube — Cubology</em>, Simon Fraser University course notes. <a href="https://www.sfu.ca/~jtmulhol/math302/puzzles-rc-cubology.html" target="_blank" rel="noopener noreferrer">sfu.ca/~jtmulhol/math302</a>
            </li>
            <li id="ref-demaine">
              E. Demaine, M. Demaine, S. Eisenstat, A. Lubiw, A. Winslow, <em>Algorithms for Solving Rubik's Cubes</em>, Algorithmica 80(8): 2229–2295, 2018. (Proves n×n×n Rubik's cube optimal solving is NP-complete and gives Θ(n²/log n) bounds.)
            </li>
            <li id="ref-demigod">
              R. Stein et al., <em>A Demigod's Number for the Rubik's Cube</em>, arXiv:2501.00144, 2025. <a href="https://arxiv.org/pdf/2501.00144" target="_blank" rel="noopener noreferrer">arxiv.org/pdf/2501.00144</a>
            </li>
            <li id="ref-rokicki-blog">
              T. Rokicki, <em>Twenty-Five Moves Suffice for Rubik's Cube</em>, technical report, 2008. Precursor to the 20-move final proof.
            </li>
            <li id="ref-mathworld">
              Wolfram MathWorld, <em>God's Number</em>. <a href="https://mathworld.wolfram.com/GodsNumber.html" target="_blank" rel="noopener noreferrer">mathworld.wolfram.com/GodsNumber</a>
            </li>
            <li id="ref-cube20">
              Cube20 project page. <a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">cube20.org</a> &nbsp;— official reference page for the 2010 result, with downloads of all source code and tables.
            </li>
            <li id="ref-jaap">
              Jaap Scherphuis, <em>Thistlethwaite's 52-move algorithm</em>. <a href="https://www.jaapsch.net/puzzles/thistle.htm" target="_blank" rel="noopener noreferrer">jaapsch.net/puzzles/thistle.htm</a>
            </li>
            <li id="ref-speedsolving">
              Speedsolving.com wiki, <em>Thistlethwaite's algorithm</em>. <a href="https://www.speedsolving.com/wiki/index.php?title=Thistlethwaite%27s_algorithm" target="_blank" rel="noopener noreferrer">speedsolving.com/wiki</a>
            </li>
            <li id="ref-frey-singmaster">
              A. Frey, D. Singmaster, <em>Handbook of Cubik Math</em>, Enslow Publishers, 1982. Companion to Singmaster's notes, with worked exercises.
            </li>
            <li id="ref-korf">
              R. Korf, <em>Finding optimal solutions to Rubik's Cube using pattern databases</em>, AAAI 1997. The original IDA* approach.
            </li>
            <li id="ref-diaconis">
              P. Diaconis & M. Shahshahani, <em>Generating a random permutation with random transpositions</em>, Z. Wahrscheinlichkeitstheorie verw. Geb. 57:159–179, 1981. The seminal paper introducing Fourier analysis on finite groups for random-walk mixing-time bounds.
            </li>
            <li id="ref-bayer-diaconis">
              D. Bayer & P. Diaconis, <em>Trailing the dovetail shuffle to its lair</em>, Ann. Appl. Probab. 2(2):294–313, 1992. The "seven shuffles suffice" theorem; framework directly applicable to random walks on the cube group.
            </li>
            <li id="ref-sims">
              C. C. Sims, <em>Computational methods in the study of permutation groups</em>, in Computational Problems in Abstract Algebra, Pergamon, 1970. The original Schreier–Sims algorithm; foundation of BSGS-based CAS work.
            </li>
            <li id="ref-bjorner">
              A. Björner & F. Brenti, <em>Combinatorics of Coxeter Groups</em>, Springer GTM 231, 2005. Modern reference for random-walk and length-function theory on groups generated by reflections — applicable framework for cube QTM analysis.
            </li>
            <li id="ref-galois">
              É. Galois, <em>Mémoire sur les conditions de résolubilité des équations par radicaux</em>, 1830 (posthumous). The original proof of A_n simplicity for n ≥ 5 and its application to the unsolvability of the quintic.
            </li>
            <li id="ref-gap">
              The GAP Group, <em>GAP — Groups, Algorithms, and Programming</em>, version 4.x. <a href="https://www.gap-system.org/" target="_blank" rel="noopener noreferrer">gap-system.org</a> — open-source CAS used to verify |G|, structure descriptions, and conjugacy classes.
            </li>
            <li id="ref-rokicki-qtm">
              T. Rokicki, H. Kociemba, M. Davidson, J. Dethridge, <em>God's Number is 26 in the Quarter-Turn Metric</em>, 2014. <a href="https://www.cube20.org/qtm/" target="_blank" rel="noopener noreferrer">cube20.org/qtm</a>
            </li>
            <li id="ref-reid-superflip">
              M. Reid, <em>Superflip requires 20 face turns</em>, online note, 1995. The first proof that the superflip pattern has Cayley-distance exactly 20.
            </li>
            <li id="ref-lagrange">
              J.-L. Lagrange, <em>Réflexions sur la résolution algébrique des équations</em>, 1771. Source of the original divisibility theorem (though stated in pre-group language; modern statement crystallized later by Cauchy, Cayley).
            </li>
            <li id="ref-frobenius">
              G. Frobenius, <em>Über Gruppencharaktere</em>, Sitzungsber. Berlin Akad. 985–1021, 1896. The founding paper of group representation theory (characters).
            </li>
            <li id="ref-serre">
              J.-P. Serre, <em>Linear Representations of Finite Groups</em>, Springer GTM 42, 1977. The canonical undergraduate-to-graduate text on character theory and Maschke's theorem — direct background for §26.
            </li>
            <li id="ref-isaacs">
              I. M. Isaacs, <em>Character Theory of Finite Groups</em>, Academic Press, 1976. Deeper reference for orthogonality and characters used in §26.
            </li>
            <li id="ref-rotman">
              J. Rotman, <em>An Introduction to the Theory of Groups</em>, 4th ed., Springer GTM 148, 1995. Standard graduate reference covering Lagrange, Sylow, composition series, and computational group theory in one volume.
            </li>
            <li id="ref-aschbacher">
              M. Aschbacher, <em>Finite Group Theory</em>, 2nd ed., Cambridge Studies in Advanced Mathematics 10, 2000. Reference for the classification of finite simple groups, into which A_8 and A_12 fit as members of the alternating family.
            </li>
            <li id="ref-saloff-coste">
              L. Saloff-Coste, <em>Random walks on finite groups</em>, in Probability on Discrete Structures, Springer, 263–346, 2004. A modern survey of mixing-time techniques for §24's framework.
            </li>
            <li id="ref-tnoodle">
              WCA Software Team, <em>TNoodle</em>: WCA's official scramble generator. <a href="https://github.com/thewca/tnoodle" target="_blank" rel="noopener noreferrer">github.com/thewca/tnoodle</a> — implements random-state scrambles and the 25-move HTM length used at competitions.
            </li>
          </ol>
          <div className="gt-aside" style={{ marginTop: 24 }}>
            <L
              zh={<>本网站还有几个具体工具供深入探索:<Link to="/scramble/solver">最短解求解器</Link>、<Link to="/alg/commutator">换位子分解工具</Link>、<Link to="/scramble/analyzer">分析器</Link>。学魔方的群论, 没有比拿真物试一试更直观的了。</>}
              en={<>Within this site, dig deeper with the <Link to="/scramble/solver">optimal solver</Link>, the <Link to="/alg/commutator">commutator decomposer</Link>, and the <Link to="/scramble/analyzer">scramble analyzer</Link>. Nothing teaches cube group theory faster than handling a real cube.</>}
            />
          </div>
        </div>
      </GTSec>

      {!isIndex && slugValid && <SectionNav slug={slug!} lang={lang} />}

      <div className="gt-end-mark">∎</div>

      <div className="gt-foot">cuberoot.me · {lang === 'zh' ? '魔方与群论' : 'Rubik\'s Cube as a Group'} · 2026</div>
    </div>
    </SlugContext.Provider>
  );
}

// ── Section-page navigation footer (prev / next / back to TOC) ────────────
function SectionNav({ slug, lang }: { slug: string; lang: Lang }) {
  const all = TOC;
  const idx = all.findIndex(s => s.id === slug);
  if (idx < 0) return null;
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;
  return (
    <nav className="gt-section-nav" aria-label="section navigation">
      <div className="gt-section-nav-cell gt-section-nav-prev">
        {prev ? (
          <Link to={`/theory/group/${prev.id}`}>
            <div className="gt-section-nav-dir">← {lang === 'zh' ? '上一节' : 'previous'}</div>
            <div className="gt-section-nav-num">§{prev.num}</div>
            <div className="gt-section-nav-title">{lang === 'zh' ? prev.zh : prev.en}</div>
          </Link>
        ) : <div className="gt-section-nav-empty" />}
      </div>
      <div className="gt-section-nav-cell gt-section-nav-toc">
        <Link to="/theory/group">
          <div className="gt-section-nav-dir">↑ {lang === 'zh' ? '回到目录' : 'contents'}</div>
        </Link>
      </div>
      <div className="gt-section-nav-cell gt-section-nav-next">
        {next ? (
          <Link to={`/theory/group/${next.id}`}>
            <div className="gt-section-nav-dir">{lang === 'zh' ? '下一节' : 'next'} →</div>
            <div className="gt-section-nav-num">§{next.num}</div>
            <div className="gt-section-nav-title">{lang === 'zh' ? next.zh : next.en}</div>
          </Link>
        ) : <div className="gt-section-nav-empty" />}
      </div>
    </nav>
  );
}

const TOC: { id: string; num: string; zh: string; en: string }[] = [
  { id: 'what-is-a-group',   num: '1',  zh: '什么是群',                 en: 'What is a group?' },
  { id: 'cube-group',         num: '2',  zh: '魔方群 G',                 en: 'The cube group G' },
  { id: 'state-vector',       num: '3',  zh: '状态向量 (cp, co, ep, eo)', en: 'State vector' },
  { id: 'order',              num: '4',  zh: 'G 的阶',                  en: 'The order |G|' },
  { id: 'invariants',         num: '5',  zh: '三个守恒律 + 证明',         en: 'Three invariants + proofs' },
  { id: 'structure',          num: '6',  zh: '结构定理',                 en: 'Structure theorem' },
  { id: 'order-of-element',   num: '7',  zh: '元素的阶',                 en: 'Order of an element' },
  { id: 'conjugation',        num: '8',  zh: '共轭与共轭类',              en: 'Conjugation' },
  { id: 'commutators',        num: '9',  zh: '换位子 + 中心',            en: 'Commutators + centre' },
  { id: 'thistlethwaite',     num: '10', zh: 'Thistlethwaite 子群链',    en: 'Subgroup chain' },
  { id: 'gods-number',        num: '11', zh: '上帝之数 = 20',           en: "God's number = 20" },
  { id: 'beyond',             num: '12', zh: '走得更远',                en: 'Beyond the cube' },
  { id: 'patterns',           num: '13', zh: '著名图案画廊',             en: 'Famous patterns' },
  { id: 'cayley',             num: '14', zh: 'Cayley 图',              en: 'Cayley graph' },
  { id: 'other-puzzles',      num: '15', zh: '其它扭转拼图',             en: 'Other twisting puzzles' },
  { id: 'open-problems',      num: '16', zh: '未解问题',                 en: 'Open problems' },
  { id: 'homomorphisms',      num: '17', zh: '同态与第一同构定理',        en: 'Homomorphisms' },
  { id: 'actions-burnside',   num: '18', zh: '群作用 + Burnside',         en: 'Group actions + Burnside' },
  { id: 'lagrange',           num: '19', zh: '拉格朗日定理 + 陪集',        en: 'Lagrange + cosets' },
  { id: 'quotient',           num: '20', zh: '正规子群 + 商群',            en: 'Normal subgroups + quotients' },
  { id: 'permutation-groups', num: '21', zh: '置换群 Sₙ 与交错群 Aₙ',       en: 'Symmetric & alternating groups' },
  { id: 'algorithms',         num: '22', zh: '解魔方的算法',               en: 'Solving algorithms' },
  { id: 'distance',           num: '23', zh: '距离分布与 20 步证明',       en: 'Distance distribution' },
  { id: 'random-walks',       num: '24', zh: '群上的随机游走',             en: 'Random walks on G' },
  { id: 'computational',      num: '25', zh: '计算群论:BSGS 与 Schreier–Sims', en: 'Computational group theory' },
  { id: 'representations',    num: '26', zh: '表示论一瞥',                en: 'A glimpse of representation theory' },
  { id: 'refs',               num: 'REF', zh: '参考文献',                   en: 'References' },
];
