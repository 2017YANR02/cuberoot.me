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
import { useEffect, useState, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import {
  identity, applyAlg, orderOf, invariants, invertAlg, conjugate, commutator,
  tokenize, isSolved, thistlethwaiteStage, cycleStructure, type CubieState,
} from './cube_state';
import './group_theory.css';

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
            zh={<>任何两个魔方操作 <span className="gt-math">a, b</span> 复合后,仍然是一个有效操作。<span className="gt-mono">R</span> 接着 <span className="gt-mono">U</span> 还是合法操作。</>}
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
            zh={<>不动魔方 = 单位元 <span className="gt-math">e</span>。空操作。它跟任何操作复合都等于该操作。</>}
            en={<>Doing nothing is the identity element <span className="gt-math">e</span>. The empty alg. Composing it with any move <span className="gt-math">a</span> gives back <span className="gt-math">a</span>.</>}
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

// ── Main page ──────────────────────────────────────────────────────────────
export default function GroupTheoryPage() {
  const lang = useLang();

  return (
    <div className="gt-page">
      <div className="gt-topbar">
        <Link to="/" className="gt-back">← {lang === 'zh' ? '返回' : 'home'}</Link>
        <div className="gt-topbar-right">
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>

      <section className="gt-hero">
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
          {lang === 'zh' ? 'cuberoot · 2026 · 16 节 · 12 个互动 & 视觉面板' : 'cuberoot · 2026 · 16 sections · 12 interactive & visual panels'}
        </div>
      </section>

      <nav className="gt-toc" aria-label="Table of contents">
        <div className="gt-toc-title">{lang === 'zh' ? '目录' : 'Contents'}</div>
        <ul className="gt-toc-list">
          {TOC.map(item => (
            <li key={item.id}>
              <a href={`#${item.id}`}>
                <span className="gt-toc-num">§{item.num}</span>
                <span>{lang === 'zh' ? item.zh : item.en}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ═══════════════ §1 What is a group ═════════════════════════ */}
      <section id="what-is-a-group" className="gt-sec">
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
              zh={<>一个 <strong>群</strong> 是一个集合 <span className="gt-math">G</span>,配上一个二元运算 <span className="gt-math">· : G × G → G</span>,满足上面四条公理。如果同时还满足 <em>交换律</em> <span className="gt-math">a · b = b · a</span>,我们称之为 <strong>阿贝尔群 (Abelian group)</strong>。</>}
              en={<>A <strong>group</strong> is a set <span className="gt-math">G</span> equipped with a binary operation <span className="gt-math">· : G × G → G</span> satisfying the four axioms above. If additionally <span className="gt-math">a · b = b · a</span> (the <em>commutative law</em>) holds, we call it an <strong>Abelian group</strong>.</>}
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
            zh={<>注意 <span className="gt-math">|G| = 4.3 × 10¹⁹</span> —— 介于「物理可观察」(地球总人口) 和「物理不可观察」(可观宇宙原子) 之间。这个尺度是魔方让群论既具体又惊人的关键原因。</>}
            en={<>Notice <span className="gt-math">|G| = 4.3 × 10¹⁹</span> sits between "physically observable" (humanity's population) and "physically unimaginable" (atoms in the universe). That scale is exactly why the cube is such a compelling concrete example.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="1.2  阿贝尔 vs 非阿贝尔" en="1.2  Abelian vs non-Abelian" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 1.2' : 'Definition 1.2'}</div>
          <div className="gt-def-body">
            <L
              zh={<>一个群 <span className="gt-math">G</span> 叫 <strong>阿贝尔群</strong>(Abelian)如果它的运算可交换:对所有 <span className="gt-math">a, b ∈ G</span>, <span className="gt-math">ab = ba</span>。否则是非阿贝尔的。</>}
              en={<>A group <span className="gt-math">G</span> is <strong>Abelian</strong> if its operation commutes: <span className="gt-math">ab = ba</span> for all <span className="gt-math">a, b ∈ G</span>. Otherwise it is <em>non-Abelian</em>.</>}
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
      </section>

      {/* ═══════════════ §2 The cube group ═══════════════════════════ */}
      <section id="cube-group" className="gt-sec">
        <div className="gt-sec-num">§2</div>
        <h2 className="gt-sec-title">
          <L zh="魔方群 G" en="The cube group G" />
        </h2>
        <p>
          <L
            zh={<>把还原状态记作 <span className="gt-math">e</span>。把每一次「转一个面 90° 或 180°」记作一个置换,作用在 26 个小块的位置和朝向上。所有可由这些转面组合得到的置换 (state) 构成集合 <strong>G</strong>。</>}
            en={<>Write the solved state as <span className="gt-math">e</span>. Each "turn a face 90° or 180°" is a permutation acting on the positions and orientations of the 26 cubies. The set <strong>G</strong> consists of all permutations producible by composing such turns.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 2.1 — 魔方群' : 'Definition 2.1 — the cube group'}</div>
          <div className="gt-def-body">
            <span className="gt-math-display">
              G = ⟨ U, D, L, R, F, B ⟩
            </span>
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
              zh={<>给定生成集 <span className="gt-math">S</span>,对任意 <span className="gt-math">g ∈ G</span>,定义 <span className="gt-math">|g|_S</span> 为「<em>用 S 的元素表示 g 所需的最少 token 数</em>」。HTM 用 18-生成集,QTM 用 12-生成集。「最短解」是 <span className="gt-math">|g|_S</span> 的别名。</>}
              en={<>Given a generating set <span className="gt-math">S</span>, for any <span className="gt-math">g ∈ G</span>, define <span className="gt-math">|g|_S</span> as the <em>minimum number of S-tokens whose product equals g</em>. HTM uses the 18-generator set; QTM the 12-generator set. The "optimal solution length" is simply <span className="gt-math">|g|_S</span>.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="2.2  群的呈现 (Presentation)" en="2.2  Group presentation" />
        </h3>
        <p>
          <L
            zh={<>群也可以用「生成元 + 关系」抽象描述。例如 <span className="gt-math">ℤ/4 = ⟨a | a⁴ = e⟩</span>,意为「一个元素 a,自乘 4 次为单位元」。对魔方群:</>}
            en={<>A group can also be presented abstractly as "generators with relations." For instance <span className="gt-math">ℤ/4 = ⟨a | a⁴ = e⟩</span> means "one element a, which when raised to the 4th power gives e." For the cube:</>}
          />
        </p>
        <div className="gt-math-display" style={{ fontSize: '1em', textAlign: 'left', paddingLeft: 16 }}>
          G = ⟨ U, D, L, R, F, B | <br />
          &nbsp;&nbsp;U⁴ = D⁴ = L⁴ = R⁴ = F⁴ = B⁴ = e, <br />
          &nbsp;&nbsp;(parallel face commutativity) UD = DU, &nbsp;LR = RL, &nbsp;FB = BF, <br />
          &nbsp;&nbsp;(plus dozens of opaque longer relators) <br />
          ⟩
        </div>
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
            <span className="gt-math">⟨U⟩</span> &nbsp; — <L zh="只允许 U 转动:同构于 ℤ/4 (4 个元素)" en="only U-turns allowed: isomorphic to ℤ/4 (4 elements)" />
          </li>
          <li>
            <span className="gt-math">⟨U, D⟩</span> &nbsp; — <L zh="只允许上下面:同构于 ℤ/4 × ℤ/4 = 16 元素" en="up & down faces: isomorphic to ℤ/4 × ℤ/4 = 16 elements" />
          </li>
          <li>
            <span className="gt-math">⟨R, U⟩</span> &nbsp; — <L zh={<>R 和 U 生成的子群,73,483,200 个元素 = 2⁷ · 3³ · 5² · 17 · 37 · 19 (大概)。算 Cayley 图的常见对象。</>} en={<>The subgroup generated by R and U: order ≈ 73 million. A classic Cayley-graph subject.</>} />
          </li>
          <li>
            <span className="gt-math">⟨U², D², L², R², F², B²⟩ = G₃</span> &nbsp; — <L zh={`只允许半圈,663,552 个元素 ("多米诺群")`} en={`half-turns only, 663,552 elements (the "domino group")`} />
          </li>
        </ul>
      </section>

      {/* ═══════════════ §3 Cube state vector ════════════════════════ */}
      <section id="state-vector" className="gt-sec">
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
        <div className="gt-math-display" style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', marginBottom: 4 }}>cp ∈ S₈ &nbsp;—&nbsp; <span style={{ fontStyle: 'normal', fontSize: '.92em', color: 'var(--ink-dim)' }}>{lang === 'zh' ? '8 个角块的位置 (置换)' : 'positions of the 8 corners (permutation)'}</span></span>
          <span style={{ display: 'block', marginBottom: 4 }}>co ∈ (ℤ/3)⁸ &nbsp;—&nbsp; <span style={{ fontStyle: 'normal', fontSize: '.92em', color: 'var(--ink-dim)' }}>{lang === 'zh' ? '每个角块的方向 (拧角)' : 'orientation of each corner (twist)'}</span></span>
          <span style={{ display: 'block', marginBottom: 4 }}>ep ∈ S₁₂ &nbsp;—&nbsp; <span style={{ fontStyle: 'normal', fontSize: '.92em', color: 'var(--ink-dim)' }}>{lang === 'zh' ? '12 个棱块的位置' : 'positions of the 12 edges'}</span></span>
          <span style={{ display: 'block' }}>eo ∈ (ℤ/2)¹² &nbsp;—&nbsp; <span style={{ fontStyle: 'normal', fontSize: '.92em', color: 'var(--ink-dim)' }}>{lang === 'zh' ? '每个棱块的翻面 (好/坏)' : 'orientation of each edge (flip)'}</span></span>
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
        <div className="gt-math-display" style={{ textAlign: 'left', fontSize: '.95em' }}>
          <span style={{ display: 'block', marginBottom: 4 }}>R<sub>cp</sub> = (0 4 7 3) &nbsp;&nbsp; <span style={{ fontSize: 12, color: 'var(--ink-dim)', fontStyle: 'normal' }}>{lang === 'zh' ? '4-循环角块' : '4-cycle on corners'}</span></span>
          <span style={{ display: 'block', marginBottom: 4 }}>R<sub>co</sub> = (+2, 0, 0, +1, +1, 0, 0, +2) &nbsp;&nbsp; <span style={{ fontSize: 12, color: 'var(--ink-dim)', fontStyle: 'normal' }}>{lang === 'zh' ? '角块拧角偏移' : 'corner twist deltas'}</span></span>
          <span style={{ display: 'block', marginBottom: 4 }}>R<sub>ep</sub> = (0 8 11 4) &nbsp;&nbsp; <span style={{ fontSize: 12, color: 'var(--ink-dim)', fontStyle: 'normal' }}>{lang === 'zh' ? '4-循环棱块' : '4-cycle on edges'}</span></span>
          <span style={{ display: 'block' }}>R<sub>eo</sub> = 0 &nbsp;&nbsp; <span style={{ fontSize: 12, color: 'var(--ink-dim)', fontStyle: 'normal' }}>{lang === 'zh' ? 'R 不改变 EO (因 R 是 RL-轴)' : 'R does not affect EO (since R is on the RL-axis)'}</span></span>
        </div>
        <p>
          <L
            zh={<>类似地:F 转面会翻转 4 个棱块的 EO (UF, DF, FR, FL 各 +1 mod 2)。U/D 转面 既不改 CO 也不改 EO,只置换位置。这种「细分一面到底改什么」的清晰结构,使得状态压缩与解法搜索都极其高效:</>}
            en={<>Similarly: F flips the EO of 4 edges (UF, DF, FR, FL each +1 mod 2). U/D turns change neither CO nor EO — only positions. This clear axis-specific structure makes both state compression and solver search highly efficient:</>}
          />
        </p>
        <div className="gt-math-display" style={{ fontSize: '.95em' }}>
          state size in bytes &nbsp;≈&nbsp; (8 perm + 8 ori bits) + (12 perm + 12 ori bits) &nbsp;≈&nbsp; <span className="gt-mono">10 bytes</span>
        </div>
        <p>
          <L
            zh={<>对比一下: 直接存 54 个色块的颜色,需要 54 × 3 = 162 bit ≈ 21 字节,且没有压缩。结构化编码省一半内存,还自动剔除非法状态。</>}
            en={<>Compare: naively storing colours for all 54 stickers takes 162 bits ≈ 21 bytes, with no compression. The structured encoding halves memory and intrinsically excludes illegal states.</>}
          />
        </p>
        <CubeStateInspector />
      </section>

      {/* ═══════════════ §4 Order of G ═════════════════════════════ */}
      <section id="order" className="gt-sec">
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
        <div className="gt-math-display">
          |free cube| = 8! · 12! · 3⁸ · 2¹² = 519,024,039,293,878,272,000
        </div>
        <p>
          <L
            zh={<>但 <em>没有</em> 拆装,只能转面 —— 这样会损失三条独立约束 (下一节细讲),每条砍掉一半状态:</>}
            en={<>But without disassembly, three independent constraints kick in (§5), each halving the state count:</>}
          />
        </p>
        <div className="gt-math-display">
          |G| = (8! · 12! · 3⁸ · 2¹²) / (3 · 2 · 2)
        </div>
        <div className="gt-big-number">
          <div className="gt-big-number-val">43,252,003,274,489,856,000</div>
          <div className="gt-big-number-label">|G| — order of the Rubik's cube group</div>
          <div className="gt-big-number-factor">
            = 2<sup>27</sup> · 3<sup>14</sup> · 5<sup>3</sup> · 7<sup>2</sup> · 11
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
        <div className="gt-math-display">
          |G| = 2<sup>27</sup> · 3<sup>14</sup> · 5<sup>3</sup> · 7<sup>2</sup> · 11
        </div>
        <p>
          <L
            zh={<>这个分解告诉我们 G 的 <strong>Sylow 子群</strong> 结构 —— 群论里最强的「显微镜」之一。每个 <em>p</em>-Sylow 子群对应 |G| 中 <em>p</em>-部分:</>}
            en={<>This factorization determines the <strong>Sylow subgroups</strong> of G — one of group theory's sharpest microscopes. For each prime <em>p</em>, the <em>p</em>-Sylow subgroup captures the <em>p</em>-part of |G|:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><span className="gt-math">P₂</span>: <L zh="2-Sylow 子群,阶 2²⁷ = 134,217,728。包含所有半圈方块" en="2-Sylow, order 2²⁷ = 134,217,728. Contains all half-turn squares" /></li>
          <li><span className="gt-math">P₃</span>: <L zh="3-Sylow 子群,阶 3¹⁴ = 4,782,969。包含所有 3-循环" en="3-Sylow, order 3¹⁴ = 4,782,969. Contains all 3-cycles" /></li>
          <li><span className="gt-math">P₅</span>: <L zh="5-Sylow 子群,阶 5³ = 125" en="5-Sylow, order 5³ = 125" /></li>
          <li><span className="gt-math">P₇</span>: <L zh="7-Sylow 子群,阶 7² = 49" en="7-Sylow, order 7² = 49" /></li>
          <li><span className="gt-math">P₁₁</span>: <L zh="11-Sylow 子群,阶 11" en="11-Sylow, order 11" /></li>
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
      </section>

      {/* ═══════════════ §5 Three invariants ═════════════════════════ */}
      <section id="invariants" className="gt-sec">
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
              zh={<>一个状态 <span className="gt-math">(cp, co, ep, eo)</span> 可达 (即位于 G 中),当且仅当下面三件事同时成立:</>}
              en={<>A state <span className="gt-math">(cp, co, ep, eo)</span> is reachable (i.e. lies in G) if and only if all three hold:</>}
            />
            <div className="gt-math-display" style={{ fontSize: '1em', marginTop: 16 }}>
              <span style={{ display: 'block', marginBottom: 6 }}>
                (1) &nbsp; Σ<sub>i</sub> co<sub>i</sub> ≡ 0 (mod 3) &nbsp;&nbsp;
                <span style={{ fontStyle: 'normal', color: 'var(--ink-dim)', fontSize: '.85em' }}>
                  {lang === 'zh' ? '总角块拧角守恒' : 'total corner twist'}
                </span>
              </span>
              <span style={{ display: 'block', marginBottom: 6 }}>
                (2) &nbsp; Σ<sub>i</sub> eo<sub>i</sub> ≡ 0 (mod 2) &nbsp;&nbsp;
                <span style={{ fontStyle: 'normal', color: 'var(--ink-dim)', fontSize: '.85em' }}>
                  {lang === 'zh' ? '总棱块翻面守恒' : 'total edge flip'}
                </span>
              </span>
              <span style={{ display: 'block' }}>
                (3) &nbsp; sgn(cp) = sgn(ep) &nbsp;&nbsp;
                <span style={{ fontStyle: 'normal', color: 'var(--ink-dim)', fontSize: '.85em' }}>
                  {lang === 'zh' ? '角棱奇偶联动' : 'corner-edge parity coupling'}
                </span>
              </span>
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
              <p style={{ margin: '0 0 12px' }}>要证: 任何面转 X 应用后, 角块的 CO 总和模 3 不变 ⇔ Σ co<sub>i</sub> ≡ 0 (mod 3) 在 G 中保持。</p>
              <p style={{ margin: '0 0 12px' }}>逐个验证 6 个生成元:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li><strong>U, D</strong>: 这两个面转把每个 U/D 层角块的「U/D 色块」继续保持在 U/D 面 (U-cubie 转到下一个 U-位置,色块仍朝上)。所以 co 全部不变。Σ Δco = 0。✓</li>
                <li><strong>R, L</strong>: 这两个面转把 4 个角块每个角度旋转,看 R: cube 0 (URF) → 位置 3 (UBR) 时,它的 U-色块从向上 → 向前,即 +1 mod 3 (顺时针拧)。而 cube 3 (UBR) → 位置 7 (DRB) 时,它的 U-色块从向上 → 向 R,即 +2 mod 3。同理 cube 7 → 4 (DFR) 是 +1, cube 4 → 0 是 +2。合计 +1 +2 +1 +2 = 6 ≡ 0 mod 3。✓</li>
                <li><strong>F, B</strong>: 类似地, F 转的 4 个角块 CO 偏移之和也是 6 ≡ 0 mod 3。✓</li>
              </ul>
              <p style={{ margin: '0 0 12px' }}>结论: 每个生成元都让 Σ co<sub>i</sub> mod 3 不变, 因此其有限乘积 (即 G 中任意元素) 也保持这一不变量。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Claim: applying any generator X preserves Σ co<sub>i</sub> mod 3.</p>
              <p style={{ margin: '0 0 12px' }}>Verify on the 6 generators:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li><strong>U, D</strong>: these cycle the four U-layer (or D-layer) corners while keeping the U-coloured sticker on the U/D face. So all four Δco = 0. ✓</li>
                <li><strong>R, L</strong>: R cycles four corners. The cubie at URF moves to UBR — its U sticker rotates from "up" to "front-up", i.e. +1 mod 3. UBR → DRB rotates from "up" to "right", +2 mod 3. By symmetry DRB → DFR = +1 and DFR → URF = +2. Total: 1 + 2 + 1 + 2 = 6 ≡ 0 mod 3. ✓</li>
                <li><strong>F, B</strong>: similarly each contributes Δco = 6 ≡ 0 mod 3. ✓</li>
              </ul>
              <p style={{ margin: '0 0 12px' }}>So every generator preserves Σ co<sub>i</sub> mod 3, and so does any finite product.</p>
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
              <p style={{ margin: '0 0 12px' }}>要证: Σ eo<sub>i</sub> mod 2 在 G 中保持。</p>
              <p style={{ margin: '0 0 12px' }}>U, D, R, L 不影响任何棱块的 EO (它们的「F/B 色块」位置不进入 F/B-轴)。F 和 B 各翻转 4 个棱块的 EO,总变化 = 4 ≡ 0 mod 2。✓</p>
              <p style={{ margin: '0 0 8px' }}>每个生成元 Δ(Σ eo) ≡ 0 mod 2, 故 Σ eo mod 2 是 G 不变量。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Claim: Σ eo<sub>i</sub> mod 2 is preserved.</p>
              <p style={{ margin: '0 0 12px' }}>U, D, R, L do not affect any edge's EO (their stickers stay on the same {`{U/D, L/R}`} pair). F and B each flip 4 edges, contributing Δ(Σ eo) = 4 ≡ 0 mod 2. ✓</p>
              <p style={{ margin: '0 0 8px' }}>Every generator gives ≡ 0 mod 2, so Σ eo is a G-invariant.</p>
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
              <p style={{ margin: '0 0 12px' }}>要证: sgn(cp) = sgn(ep) 在 G 中保持 ⇔ 角块置换和棱块置换的奇偶性绑定。</p>
              <p style={{ margin: '0 0 12px' }}>每个面转的角块置换是一个 4-循环 (cp 上的 4 个元素轮换)。4-循环 = 3 个相邻 2-循环的乘积, sgn = (−1)³ = −1。同理棱块置换也是 4-循环, sgn = −1。</p>
              <p style={{ margin: '0 0 12px' }}>所以每个生成元同时把 sgn(cp) 和 sgn(ep) 都翻号。其乘积保持 sgn(cp) / sgn(ep) = 1。等价地, sgn(cp) = sgn(ep)。✓</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Claim: sgn(cp) = sgn(ep) is preserved.</p>
              <p style={{ margin: '0 0 12px' }}>Each face turn cycles 4 corners (a 4-cycle in cp) and 4 edges (a 4-cycle in ep). A 4-cycle factors into 3 transpositions, so it has sign (−1)³ = −1.</p>
              <p style={{ margin: '0 0 12px' }}>Therefore every generator flips sgn(cp) and sgn(ep) <em>simultaneously</em>. Their product, sgn(cp) · sgn(ep)⁻¹ = sgn(cp)/sgn(ep), stays constant at +1. ✓</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <p>
          <L
            zh={<>这三个证明加起来,完全刻画了 G 在「自由组装空间」 <span className="gt-math">S₈ × S₁₂ × (ℤ/3)⁸ × (ℤ/2)¹²</span> 里的位置。剩下要证的是 <strong>反方向</strong>:满足这三条的状态都是可达的。这部分通常由具体构造性算法 (即一个 solver) 直接给出 —— 任何能解魔方的程序,本身就是「可达性」的证明。</>}
            en={<>Together these three proofs pin G's location inside the free assembly group <span className="gt-math">S₈ × S₁₂ × (ℤ/3)⁸ × (ℤ/2)¹²</span>. The converse — that every state satisfying these three constraints is reachable — is usually established constructively: any working solver is itself a proof of reachability.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{lang === 'zh' ? '推论 5.4' : 'Corollary 5.4'}</div>
          <div className="gt-thm-body">
            <L
              zh={<>「自由组装空间」/ G 是一个 12 元商群:</>}
              en={<>The "free assembly space" / G is a 12-element quotient group:</>}
            />
            <span className="gt-math-display">
              (S₈ × S₁₂ × (ℤ/3)⁸ × (ℤ/2)¹²) / G &nbsp;≅&nbsp; ℤ/3 × ℤ/2 × ℤ/2
            </span>
            <L
              zh={<>每个商代表一种「拆装才能产生的状态」:角块多余的拧角 (ℤ/3)、棱块多余的翻面 (ℤ/2)、奇置换 (ℤ/2)。这就是为什么撬下来重装的魔方有 12 个不同的「平行宇宙」, 大多数无法用面转还原。</>}
              en={<>Each cell of the quotient is one "disassembly-only" anomaly: extra CO twist (ℤ/3), extra EO flip (ℤ/2), wrong parity (ℤ/2). That is precisely why a popped-and-rebuilt cube falls into one of 12 "parallel universes", most of which cannot be solved by face turns.</>}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════ §6 Structure theorem ════════════════════════ */}
      <section id="structure" className="gt-sec">
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
            <span className="gt-math-display" style={{ fontSize: '1em' }}>
              G ≅ &nbsp;{`{ (σ, x, τ, y) ∈ S₈ × (ℤ/3)⁸ × S₁₂ × (ℤ/2)¹² : Σxᵢ ≡ 0, Σyᵢ ≡ 0, sgn(σ) = sgn(τ) }`}
            </span>
            <L
              zh={<>更精炼地:G 包含两个 <strong>半直积</strong> ("圈积") 作为子群:</>}
              en={<>More compactly, G contains two <strong>semidirect products</strong> ("wreath products") as subgroups:</>}
            />
            <span className="gt-math-display" style={{ fontSize: '1em', marginTop: 16 }}>
              ℤ/3 ≀ S₈ &nbsp; (corner sector) &nbsp;&nbsp;×&nbsp;&nbsp; ℤ/2 ≀ S₁₂ &nbsp; (edge sector)
            </span>
            <span style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
              {lang === 'zh'
                ? '角块部分 ≅ 81 万 7,920,且与棱块部分通过 sgn(cp)=sgn(ep) 这一条「相位锁」耦合。'
                : 'The corner sector has 88,179,840 elements; it is coupled to the edge sector by the single parity lock sgn(cp) = sgn(ep).'}
            </span>
          </div>
        </div>
        <div className="gt-aside">
          <L
            zh={<>圈积 <span className="gt-math">A ≀ B</span> 直观理解:你有 B 个「位置」,每个位置上挂一份 A 的副本。B 在外部置换位置 (打乱角块位置),A 在每个位置内部独立旋转 (拧那个角块)。在魔方上,B = S₈, A = ℤ/3。</>}
            en={<>The wreath product <span className="gt-math">A ≀ B</span>: B "positions" each carrying their own copy of A. B permutes positions (shuffles corners around), A independently rotates within each (twists each corner). For the cube, B = S₈ and A = ℤ/3.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="6.1  短正合列" en="6.1  Short exact sequence" />
        </h3>
        <p>
          <L
            zh={<>魔方群可以用 <em>短正合列</em> 精确表述。设 <span className="gt-math">N = (ℤ/3)⁷ × (ℤ/2)¹¹</span> 是「方向自由度」(去掉两个 dependent 之后), <span className="gt-math">P</span> 是「奇偶联动的角棱置换对」(S₈ × S₁₂ 的指数 2 子群):</>}
            en={<>The cube group can be captured in a <em>short exact sequence</em>. Let <span className="gt-math">N = (ℤ/3)⁷ × (ℤ/2)¹¹</span> (orientations with the two dependent ones removed), and <span className="gt-math">P</span> the parity-linked permutation pair (the index-2 subgroup of S₈ × S₁₂):</>}
          />
        </p>
        <div className="gt-math-display">
          1 &nbsp; → &nbsp; N &nbsp; → &nbsp; G &nbsp; → &nbsp; P &nbsp; → &nbsp; 1
        </div>
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
        <div className="gt-math-display">
          G &nbsp; ≅ &nbsp; N ⋊ P
        </div>
        <p>
          <L
            zh={<>这正是物理上「先置换, 再扭」的代数化:任何 G 中的元素都能唯一写成 (扭法) · (置换)的乘积。这是 cube state 4-tuple 编码的代数基础。</>}
            en={<>This is the algebraic counterpart of "first permute, then twist": every element of G factors uniquely as (orientation) · (permutation). This is the algebraic foundation of the (cp, co, ep, eo) state encoding.</>}
          />
        </p>
      </section>

      {/* ═══════════════ §7 Order of an element ═════════════════════ */}
      <section id="order-of-element" className="gt-sec">
        <div className="gt-sec-num">§7</div>
        <h2 className="gt-sec-title">
          <L zh="元素的阶" en="Order of an element" />
        </h2>
        <p>
          <L
            zh={<>对任何 <span className="gt-math">g ∈ G</span>,存在最小正整数 <span className="gt-math">n</span> 使 <span className="gt-math">gⁿ = e</span>。这个 <span className="gt-math">n</span> 称为 <strong>g 的阶 (order)</strong>。换句话说:不停重复同一公式,多久回到原点?</>}
            en={<>For any <span className="gt-math">g ∈ G</span>, there is a smallest positive integer <span className="gt-math">n</span> with <span className="gt-math">gⁿ = e</span>. This <span className="gt-math">n</span> is the <strong>order</strong> of <span className="gt-math">g</span>. Repeat the same alg until you come home — that count is its order.</>}
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
              zh={<>每个元素的阶必须整除 |G|。所以 <span className="gt-math">n | 43,252,003,274,489,856,000</span>。魔方群中实际出现的元素阶,最大是 <strong>1260</strong>(由两个不交圈乘出来的 LCM,需要 7-cycle × 9-cycle × …)。</>}
              en={<>Every element's order divides |G|. So <span className="gt-math">n | 43,252,003,274,489,856,000</span>. The maximum order attained by any cube element is <strong>1260</strong> (the LCM of disjoint cycle lengths in optimal combination).</>}
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
            zh={<>哪些阶达不到?例如 <span className="gt-math">|G|</span> 本身 (4.3 × 10¹⁹) 不可能是元素阶 — 因为这要求一个循环子群 等于整个 G,而 G 不是循环群 (它非阿贝尔)。同样大部分大的整除数也达不到 — 它们要求一个「全局极长循环」,而 G 中没有那么长的循环结构。</>}
            en={<>Which divisors are missed? For instance |G| itself (4.3 × 10¹⁹) cannot be an element's order — that would force a cyclic subgroup equal to G, but G is non-Abelian, hence not cyclic. Most large divisors are similarly out of reach, since no element has all the "long-cycle structure" required to attain them.</>}
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
      </section>

      {/* ═══════════════ §8 Conjugation ══════════════════════════════ */}
      <section id="conjugation" className="gt-sec">
        <div className="gt-sec-num">§8</div>
        <h2 className="gt-sec-title">
          <L zh="共轭 — 把操作搬到别的位置" en="Conjugation — relocating operations" />
        </h2>
        <p>
          <L
            zh={<>已知一招 <span className="gt-math">B</span> 能搞定 <em>某一块</em>,但你想让它作用在 <em>别的位置</em>。最优雅的办法是 <strong>共轭</strong>:</>}
            en={<>You know an alg <span className="gt-math">B</span> that fixes <em>this</em> spot, but the piece you want is <em>there</em>. The elegant fix is <strong>conjugation</strong>:</>}
          />
        </p>
        <div className="gt-math-display">
          A &nbsp; B &nbsp; A⁻¹
        </div>
        <p>
          <L
            zh={<>先用 <span className="gt-math">A</span> 把目标块「带过来」,执行 <span className="gt-math">B</span>(B 作用在它熟悉的位置),再 <span className="gt-math">A⁻¹</span> 把所有别的东西放回原位 —— 但被 B 改过的部分,被「带回去」到 A 之前对应的另一个位置。这是高级解法 (BLD, FMC, ZBLL setup) 的核心技巧。</>}
            en={<>First <span className="gt-math">A</span> "brings" the target piece to where B works. Then <span className="gt-math">B</span> acts in its native location. Finally <span className="gt-math">A⁻¹</span> puts everything else back — but the part B touched gets carried <em>back</em> to where it really wanted to go. This is the bread and butter of advanced solving (BLD, FMC, ZBLL setups).</>}
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
              zh={<>共轭操作满足: <span className="gt-math">(aba⁻¹)ⁿ = a · bⁿ · a⁻¹</span>。所以 b 和 aba⁻¹ 阶相同。在魔方上的意义:你可以把任意操作 (PLL、F2L 步骤、commutator) 搬到任何「等价位置」上,它的次数、还原性、所有内在性质都不变 — 只是「在哪做」变了。</>}
              en={<>Conjugation respects powers: <span className="gt-math">(aba⁻¹)ⁿ = a · bⁿ · a⁻¹</span>. So b and aba⁻¹ share the same order. On the cube: you can relocate any operation (a PLL, an F2L insertion, a commutator) to an equivalent location — its order, structure, and all internal properties are preserved.</>}
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
        <div className="gt-aside">
          <L
            zh={<>魔方还有 48 个外部对称变换 (24 个旋转 × 2 个镜像)。Burnside lemma 在 G 与对称群联合作用下计算「真正不同的」状态数,这是更精细的等价化。</>}
            en={<>The cube also has 48 outer symmetries (24 rotations × 2 mirror reflections). Burnside's lemma applied jointly with G gives the count of "truly distinct" states up to symmetry.</>}
          />
        </div>
      </section>

      {/* ═══════════════ §9 Commutators ══════════════════════════════ */}
      <section id="commutators" className="gt-sec">
        <div className="gt-sec-num">§9</div>
        <h2 className="gt-sec-title">
          <L zh="换位子 [A, B] — 高级解法的灵魂" en="Commutators [A, B] — the soul of advanced solving" />
        </h2>
        <p>
          <L
            zh={<>对两个操作 <span className="gt-math">A, B</span>,我们定义它们的 <strong>换位子</strong> 为:</>}
            en={<>For two operations <span className="gt-math">A, B</span>, their <strong>commutator</strong> is defined as:</>}
          />
        </p>
        <div className="gt-math-display">
          [A, B] := A · B · A⁻¹ · B⁻¹
        </div>
        <p>
          <L
            zh={<>如果 <span className="gt-math">A</span> 和 <span className="gt-math">B</span> 互换 (<span className="gt-math">AB = BA</span>),那么 <span className="gt-math">[A, B] = e</span>。所以换位子衡量「A 和 B 互不交换的程度」。在阿贝尔群里所有换位子都是单位元 —— 魔方群当然不是。</>}
            en={<>If <span className="gt-math">A</span> and <span className="gt-math">B</span> commute, <span className="gt-math">[A, B] = e</span>. The commutator measures how far they fail to commute. In an Abelian group all commutators are trivial — but the cube group is decisively non-Abelian.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{lang === 'zh' ? '为什么换位子如此有用?' : 'Why commutators are so powerful'}</div>
          <div className="gt-thm-body">
            <L
              zh={<>当 <span className="gt-math">A</span> 和 <span className="gt-math">B</span> 的「影响区域」<em>大体不重叠</em> 但 <em>有一处接触</em> 时,换位子 [A, B] 把接触点附近一两个块循环,其他全部完整保留。这就是 <strong>3-循环</strong>:盲拧、还原 (FMC) 的核心积木。<br /><br />例如 [R U R', D] 是个干净的 3-循环棱块。从一个 8! · 12! · 3⁸ · 2¹² 这么大的群中,提取出只动 3 个块的操作 —— 这是换位子做到的几乎魔法般的事。</>}
              en={<>When <span className="gt-math">A</span> and <span className="gt-math">B</span> <em>nearly</em> overlap — affecting mostly disjoint pieces but sharing one or two — [A, B] cycles those few pieces while leaving everything else untouched. This is the <strong>3-cycle</strong>: the elementary atom of blindsolving and FMC.<br /><br />For example, [R U R', D] is a clean edge 3-cycle. Extracting an operation that moves only 3 pieces out of a group of size 8! · 12! · 3⁸ · 2¹² is the near-magical thing commutators do.</>}
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
              zh={<>群 <span className="gt-math">G</span> 的 <strong>换位子子群</strong>(又叫 <em>derived subgroup</em>)是:</>}
              en={<>The <strong>commutator subgroup</strong> (also called <em>derived subgroup</em>) of G is:</>}
            />
            <span className="gt-math-display">
              [G, G] = ⟨ {`{[a, b] : a, b ∈ G}`} ⟩
            </span>
            <L
              zh={<>由所有换位子生成的子群。商群 <span className="gt-math">G / [G, G]</span> 是 G 「最大的阿贝尔商」 — 把所有非阿贝尔性都抹去后剩下的部分。</>}
              en={<>The subgroup generated by all commutators. The quotient <span className="gt-math">G / [G, G]</span> is G's <em>largest Abelian quotient</em> — what remains after stripping out all non-commutativity.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方群: <span className="gt-math">G / [G, G] ≅ ℤ/2</span>。这告诉我们 G 的 <em>非阿贝尔性几乎是「全部」</em> —— 唯一的阿贝尔信息是「角棱奇偶性」(一个 ℤ/2 比特)。换言之, [G, G] 本身阶为 |G| / 2 ≈ 2.16 × 10¹⁹。</>}
            en={<>For the cube group: <span className="gt-math">G / [G, G] ≅ ℤ/2</span>. This means G's <em>non-Abelian structure is almost everything</em> — the only Abelian information is the parity bit. Equivalently, [G, G] itself has order |G| / 2 ≈ 2.16 × 10¹⁹.</>}
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
              zh={<>群的 <strong>中心</strong>: <span className="gt-math">Z(G) = {`{ z ∈ G : zg = gz ∀ g ∈ G }`}</span>。即跟所有元素都交换的子集。</>}
              en={<>The <strong>centre</strong> of a group: <span className="gt-math">Z(G) = {`{ z ∈ G : zg = gz ∀ g ∈ G }`}</span>. The elements that commute with everything.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对阿贝尔群: <span className="gt-math">Z(G) = G</span>。对极端非阿贝尔群: <span className="gt-math">Z(G) = {`{e}`}</span> (只有单位元)。</>}
            en={<>For Abelian groups: <span className="gt-math">Z(G) = G</span>. For sharply non-Abelian groups: <span className="gt-math">Z(G) = {`{e}`}</span> only.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{lang === 'zh' ? '定理 9.4' : 'Theorem 9.4'}</div>
          <div className="gt-thm-body">
            <L
              zh={<>魔方群的中心 <span className="gt-math">Z(G) = {`{e, superflip}`}</span>, 阶为 2。即 <strong>仅有 superflip 和 identity 跟所有面转都交换</strong>。 superflip 是 「12 个棱全翻」 那个状态,它本身是阶 2 元素。</>}
              en={<>The cube group's centre is <span className="gt-math">Z(G) = {`{e, superflip}`}</span>, of order 2. Only the identity and superflip commute with every face turn.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个事实有点不可思议:在 4.3 × 10¹⁹ 个状态里,只有 <strong>两个</strong> 状态跟所有人都「和气共处」, 而其中之一是大家熟悉的 superflip(也是著名的 20 步极限状态之一)。</>}
            en={<>This is a striking fact: among 4.3 × 10¹⁹ states, exactly <strong>two</strong> commute with all face turns — one being the celebrated superflip (also among the famous 20-step extremal positions).</>}
          />
        </p>
      </section>

      {/* ═══════════════ §10 Thistlethwaite ══════════════════════════ */}
      <section id="thistlethwaite" className="gt-sec">
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
            zh={<>Thistlethwaite 链中, 每一级 <span className="gt-math">[G_i : G_{`{i+1}`}]</span> 就是「这一阶段需要查表的状态数」。这些数直接决定了 solver 的内存开销:</>}
            en={<>Each Thistlethwaite step's quotient size <span className="gt-math">[G_i : G_{`{i+1}`}]</span> equals the number of states to look up at that phase. These numbers directly drive a solver's memory footprint:</>}
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
              zh={<>设 <span className="gt-math">H ⊆ G</span> 是子群, <span className="gt-math">g ∈ G</span>。 <strong>左陪集</strong>: <span className="gt-math">gH = {`{gh : h ∈ H}`}</span>。陪集大小都等于 |H|, 且 G 被陪集划分为 [G:H] 个互不相交的集合。</>}
              en={<>Let <span className="gt-math">H ⊆ G</span> be a subgroup, <span className="gt-math">g ∈ G</span>. The <strong>left coset</strong> is <span className="gt-math">gH = {`{gh : h ∈ H}`}</span>. All cosets have size |H|, and G partitions into [G:H] disjoint cosets.</>}
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
              zh={<>设 <span className="gt-math">H ⊆ G</span> 是有限群的子群, 则 <span className="gt-math">|H| | |G|</span> (即 |H| 整除 |G|), 且 <span className="gt-math">|G| = |H| · [G:H]</span>。</>}
              en={<>Let <span className="gt-math">H ⊆ G</span> be a subgroup of a finite group. Then <span className="gt-math">|H| | |G|</span> (i.e. |H| divides |G|), and <span className="gt-math">|G| = |H| · [G:H]</span>.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个最基本的群论定理在魔方上的意义:任何子群的阶都必须整除 4.3 × 10¹⁹。所以 ⟨R, U⟩ 的阶 73,483,200 整除 |G|, ⟨U⟩ 阶 4 整除, |G_3| = 663,552 整除 — 都自动成立。</>}
            en={<>The most basic theorem in group theory says: any subgroup's order must divide 4.3 × 10¹⁹. So ⟨R, U⟩ has order 73,483,200 | |G|, ⟨U⟩ has order 4 | |G|, |G_3| = 663,552 | |G| — all automatic.</>}
          />
        </p>
      </section>

      {/* ═══════════════ §11 God's number ════════════════════════════ */}
      <section id="gods-number" className="gt-sec">
        <div className="gt-sec-num">§11</div>
        <h2 className="gt-sec-title">
          <L zh="上帝之数 = 20" en="God's number = 20" />
        </h2>
        <p>
          <L
            zh={<>G 是一个有 4.3 × 10¹⁹ 个元素的有限群。把 <span className="gt-math">G</span> 看成图(顶点 = 状态,边 = 一次面转),它的 <strong>直径</strong> 是多少?</>}
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
      </section>

      {/* ═══════════════ §12 Beyond ═════════════════════════════════ */}
      <section id="beyond" className="gt-sec">
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
      </section>

      {/* ═══════════════ §13 Famous patterns ═════════════════════════ */}
      <section id="patterns" className="gt-sec">
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
      </section>

      {/* ═══════════════ §14 Cayley graph ════════════════════════════ */}
      <section id="cayley" className="gt-sec">
        <div className="gt-sec-num">§14</div>
        <h2 className="gt-sec-title">
          <L zh="Cayley 图 — 群的几何" en="The Cayley graph — geometry of a group" />
        </h2>
        <p>
          <L
            zh={<>每个群可以画成一张图: 节点 = 群元素, 边 = 应用一个生成元。这张图叫做 <strong>Cayley 图</strong>, 它把抽象群变成具体的几何对象, 让群论的「直径」「球壳」「测地线」等概念有了字面意义。</>}
            en={<>Every group draws as a graph: nodes = elements, edges = applying one generator. This is the <strong>Cayley graph</strong>. It turns an abstract group into a concrete geometric object — giving literal meaning to "diameter," "ball of radius r," "geodesic."</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{lang === 'zh' ? '定义 14.1' : 'Definition 14.1'}</div>
          <div className="gt-def-body">
            <L
              zh={<>设群 <span className="gt-math">G</span> 有生成集 <span className="gt-math">S</span>。 <strong>Cayley 图</strong> <span className="gt-math">Cay(G, S)</span> 是一个有向多重图: 节点为 G 中每个元素, 每对 (g, s) 给出一条从 g 到 gs 的边 (色彩按 s 编码)。</>}
              en={<>Let G be a group with generating set S. The <strong>Cayley graph</strong> Cay(G, S) is the directed multigraph with one node per element and, for every pair (g, s), an edge g → gs (coloured by s).</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方 (G, S=18 generators), Cay 图有 4.3 × 10¹⁹ 节点和 4.3 × 10¹⁹ × 18 / 2 ≈ 3.9 × 10²⁰ 条边 (每条边的方向是无关的, 因为 s 和 s⁻¹ 都在 S 里, 形成无向图)。一个看不全的图。</>}
            en={<>For the cube with S = the 18 generators, Cay has 4.3 × 10¹⁹ nodes and roughly 3.9 × 10²⁰ edges (since each generator and its inverse both lie in S, the graph is effectively undirected). Far too large to draw.</>}
          />
        </p>
        <p>
          <L
            zh={<>但我们可以画 <strong>小子群</strong> 的 Cayley 图。下面是 ⟨R, U⟩ 的前两层 BFS — 从 identity 开始, 一步可达的所有节点, 两步可达的部分节点。已经能看出非阿贝尔群图特有的「不对称扇形」:</>}
            en={<>But we can draw the Cayley graph of a <strong>small subgroup</strong>. Below: the first two BFS layers of ⟨R, U⟩ — starting from identity, all nodes reachable in 1 step, and selected ones reachable in 2 steps. Already the characteristic "asymmetric fan" of non-Abelian groups emerges:</>}
          />
        </p>
        <div className="gt-panel">
          <CayleyMini />
          <div className="gt-aside" style={{ marginTop: 12 }}>
            {lang === 'zh'
              ? '完整的 ⟨R, U⟩ Cayley 图有 73,483,200 个节点, 直径约 26 (HTM)。这里只画了前 15 个节点作为示意。'
              : 'The full Cay(⟨R, U⟩, {R, U}) has 73,483,200 nodes and diameter about 26 in HTM. Only 15 nodes shown here as illustration.'}
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="14.1  几何直觉" en="14.1  Geometric intuition" />
        </h3>
        <p>
          <L
            zh={<>魔方的 Cayley 图是有限但「胖」的图 — 每个节点 18 邻居, 直径只 20。这意味着图非常「四通八达」 (expander-like)。打乱 5 步, 你可能在 18⁵ = 1.9 × 10⁶ 个相邻节点的某一个; 5 步 BFS 实际状态数 ≈ 5.7 × 10⁵ (有重复, 比理论上界小)。但 10 步以内已经能覆盖 G 的 5% 以上。这就是为什么「Kociemba 的 24 步上界」感觉那么紧 — Cayley 图本质上没有「长尾」。</>}
            en={<>The cube's Cayley graph is finite but "fat" — every node has 18 neighbours, with diameter only 20. The graph is highly expander-like. After 5 random moves, you might be at any of up to 18⁵ ≈ 1.9 × 10⁶ nodes; actual BFS-reachable count at depth 5 is 5.7 × 10⁵ (due to overlaps). By depth 10, more than 5% of G is reached. This is why Kociemba's 24-move upper bound feels so tight — the graph has no long tail.</>}
          />
        </p>
      </section>

      {/* ═══════════════ §15 Other puzzles ═══════════════════════════ */}
      <section id="other-puzzles" className="gt-sec">
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
      </section>

      {/* ═══════════════ §16 Open problems ═══════════════════════════ */}
      <section id="open-problems" className="gt-sec">
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
      </section>

      {/* ═══════════════ References ══════════════════════════════════ */}
      <section id="refs" className="gt-sec">
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
          </ol>
          <div className="gt-aside" style={{ marginTop: 24 }}>
            <L
              zh={<>本网站还有几个具体工具供深入探索:<Link to="/scramble/solver">最短解求解器</Link>、<Link to="/alg/commutator">换位子分解工具</Link>、<Link to="/scramble/analyzer">分析器</Link>。学魔方的群论, 没有比拿真物试一试更直观的了。</>}
              en={<>Within this site, dig deeper with the <Link to="/scramble/solver">optimal solver</Link>, the <Link to="/alg/commutator">commutator decomposer</Link>, and the <Link to="/scramble/analyzer">scramble analyzer</Link>. Nothing teaches cube group theory faster than handling a real cube.</>}
            />
          </div>
        </div>
      </section>

      <div className="gt-end-mark">∎</div>

      <div className="gt-foot">cuberoot.me · {lang === 'zh' ? '魔方与群论' : 'Rubik\'s Cube as a Group'} · 2026</div>
    </div>
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
];
