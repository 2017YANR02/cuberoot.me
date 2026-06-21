'use client';

/**
 * /scramble/solver?event=337 — 3×3×7 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。3×3×7 可达状态 126,859,598,081,556,480,000(≈1.27×10²⁰,Schreier-Sims 实算,
 * 用同一套代码复现已知 335 计数自证),太大无法整图 BFS,也没有浏览器可建的强启发让 IDA* 在交互时间内跑到
 * 上帝之数。策略 = **两阶段约简**:阶段一把所有块归约进全 180° 子群(intoH 约简天然解耦成 U/D 组 {角,顶底棱}
 * 与 u/d 组 {切片角,切片棱} 两套不相交的转动预算,跨组求和即可采纳又强);阶段二只用 8 个 180° 转还原(轨道对
 * 精确 joint PDB,IDA* 几毫秒收敛)。任何打乱都返回一条有界的**近最优**解(`optimal:false`);很浅的态另用
 * 可采纳启发式给出**可证最优**解(`optimal:true`)。不存在「太深」。
 *
 * 记号 = 物理 3×3×7 的 16 个刚体转(U U' U2 u u' u2 d d' d2 D D' D2 R2 L2 F2 B2:顶底盖 + 紧邻的内层切片各
 * 90°,四个侧面是 3×7 长方形只能 180°)。cstimer 的 `337 = <cuboid> / ${333}` 后半段 333 的 90° 侧转在
 * 3×3×7 上几何不可行(侧面是 3×7 长方形,90° 会把块转出盒外),是 cstimer 的人类速记、无刚体实现 —— 解析到
 * " / " 即止,只解前半段刚体打乱。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { SearchInput } from '@/components/SearchInput';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { randomCuboid337Scramble, solveCuboid337, CUBOID337_STATE_COUNT_STR, CUBOID337_ORBIT_PRODUCT_STR, type Cuboid337Solution } from '@/lib/cuboid337-solver';
import SolveTabs from '../_components/SolveTabs';
import { BatchSolvePanel, SolveModeToggle, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

// accepts the rigid cuboid alphabet plus the cstimer " / " separator and the trailing 333 part (ignored).
const CUBOID337_TOKEN_RE = /^(U['2]?|u['2]?|d['2]?|D['2]?|[RLFB]2|\/|[RLFBUD]['2]?|[ud]['2]?)$/;

// random-scramble length for the buttons (cstimer 337 cuboid part default is long; mirror a real scramble).
const RANDOM_LEN = 40;

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: Cuboid337Solution }
  | { kind: 'error'; message: string };

export default function Cuboid337SolverPage() {
  useDocumentTitle('3×3×7 求解器', '3×3×7 Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum(['single', 'batch'] as const).withDefault('single'),
  );
  const [generating, setGenerating] = useState(false);
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const trimmed = scramble.trim();

  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    const id = window.setTimeout(() => {
      let next: SolveState;
      try {
        next = { kind: 'done', result: solveCuboid337(trimmed) };
      } catch (e) {
        next = { kind: 'error', message: String((e as Error)?.message ?? e) };
      }
      if (reqRef.current === myReq) setState(next);
    }, 16);
    return () => window.clearTimeout(id);
  }, [trimmed]);

  const randomScramble = () => {
    if (generating) return;
    setGenerating(true);
    try {
      void setScramble(randomCuboid337Scramble(RANDOM_LEN));
    } finally {
      setGenerating(false);
    }
  };

  const batchSpec: BatchSpec = useMemo(() => ({
    event: '337',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 U u2 D2 R2 F2 d',
      en: 'one scramble per line, e.g. U u2 D2 R2 F2 d',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !CUBOID337_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveCuboid337(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => Promise.resolve(randomCuboid337Scramble(RANDOM_LEN)),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="337" mode="solve" />
      <SolveModeToggle value={mode} onChange={(v) => void setMode(v)} />

      {mode === 'batch' ? (
        <BatchSolvePanel spec={batchSpec} />
      ) : (
        <>
          <p className="pos-lead">
            {tr({
              zh: '3×3×7 在线求解:两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何打乱都能解出一条有界的近最优解;很浅的打乱另用可采纳启发式给出可证最优解。记号 U U’ U2 u u’ u2 d d’ d2 D D’ D2 R2 L2 F2 B2(物理 3×3×7 的刚体转);cstimer 的 / 333 速记无刚体实现,会被忽略。',
              en: '3×3×7 online solver: a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only) returns a bounded near-optimal solution for ANY scramble; very shallow scrambles additionally get a provably optimal solution. Notation U U’ U2 u u’ u2 d d’ d2 D D’ D2 R2 L2 F2 B2 (the rigid 3×3×7 moves); cstimer’s “/ 333” shorthand has no rigid realisation and is ignored.',
            })}
          </p>

          <div className="pos-input-row">
            <SearchInput
              className="pos-input-wrap"
              inputClassName="pos-input"
              value={scramble}
              onChange={(v) => void setScramble(v)}
              placeholder={tr({ zh: '输入打乱,如 U u2 D2 R2 F2 d', en: 'Enter a scramble, e.g. U u2 D2 R2 F2 d' })}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
            <button type="button" className="pos-random-btn" onClick={randomScramble} disabled={generating}>
              {generating ? <LoaderCircle size={16} className="pos-spin" aria-hidden /> : <Dices size={16} aria-hidden />}
              {tr({ zh: '随机打乱', en: 'Random' })}
            </button>
          </div>

          {trimmed && (
            <div className="pos-result" aria-live="polite">
              {state.kind !== 'error' && (
                <div className="ivy-preview">
                  <ScramblePreview2D event="337" scramble={trimmed} size={64} />
                </div>
              )}
              {state.kind === 'solving' && (
                <p className="pos-result-solved">
                  <LoaderCircle size={16} className="pos-spin" aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  {tr({ zh: '求解中…', en: 'Solving…' })}
                </p>
              )}
              {state.kind === 'error' && (
                <p className="pos-error">
                  {tr({ zh: '打乱记号无法识别(应为 U U’ U2 u u’ u2 d d’ d2 D D’ D2 R2 L2 F2 B2)', en: 'Unrecognized notation (expected U U’ U2 u u’ u2 d d’ d2 D D’ D2 R2 L2 F2 B2)' })}: <code>{state.message}</code>
                </p>
              )}
              {state.kind === 'done' && state.result.length === 0 && (
                <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved' })}</p>
              )}
              {state.kind === 'done' && state.result.length > 0 && (
                <>
                  <div className="ivy-metric">
                    <span className="ivy-metric-num">{state.result.length}</span>
                    <span className="ivy-metric-label">
                      {state.result.optimal
                        ? tr({ zh: '步 最优解', en: state.result.length === 1 ? 'move (optimal)' : 'moves (optimal)' })
                        : tr({ zh: '步 近最优解', en: state.result.length === 1 ? 'move (near-optimal)' : 'moves (near-optimal)' })}
                    </span>
                  </div>
                  <div className="ivy-solbox">{state.result.solution}</div>
                </>
              )}
            </div>
          )}

          <div className="ivy-caveat">
            <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
            {tr({
              zh: `3×3×7 有 ${CUBOID337_STATE_COUNT_STR} 个可达状态(轨道乘积 ${CUBOID337_ORBIT_PRODUCT_STR} 因 18× 奇偶耦合而过计,实际由 Schreier-Sims 实算),太大无法整图 BFS,浏览器里也建不出足够强的可采纳启发去逼近上帝之数,所以**不是**每条解都最优。采用两阶段约简:先把每个轨道归约进全 180° 子群,再只用 180° 转还原;两阶段各自在自己的小坐标里最优,合起来就是有界的**近最优**解(任何打乱都能解)。很浅的打乱会额外尝试可采纳启发的可证最优解,标为「最优」;其余标为「近最优」。`,
              en: `The 3×3×7 has ${CUBOID337_STATE_COUNT_STR} reachable states (the orbit product ${CUBOID337_ORBIT_PRODUCT_STR} over-counts it by an 18× parity coupling; the true count is from Schreier-Sims) — far too many to BFS, and no admissible heuristic strong enough to reach God's number is buildable in the browser, so NOT every solution is optimal. The solver uses a two-phase reduction: first reduce every orbit into the all-180° subgroup, then finish with 180° turns only. Each phase is optimal over its own small coordinate, so the total is a bounded NEAR-OPTIMAL solution (every scramble solves). Very shallow scrambles additionally try an admissible-heuristic optimal solve, labeled "optimal"; the rest are labeled "near-optimal".`,
            })}
          </div>
        </>
      )}
    </div>
  );
}
