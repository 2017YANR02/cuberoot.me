'use client';

/**
 * /scramble/solver?event=335 — 3×3×5 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。3×3×5 可达状态 156,067,430,400(≈1.56×10¹¹,Schreier-Sims 实算),太大无法
 * 整图 BFS,也没有浏览器可建的强启发让 IDA* 在交互时间内跑到上帝之数。策略 = **两阶段约简**:阶段一把所有
 * 块归约进全 180° 子群(每轨道「进入子群」距离作可采纳启发,只有角轨道 / 顶底棱轨道需要约简);阶段二只用
 * 6 个 180° 转还原(轨道对精确 joint PDB,IDA* 几毫秒收敛)。任何打乱都返回一条有界的**近最优**解
 *(`optimal:false`);很浅的态另用可采纳启发式给出**可证最优**解(`optimal:true`)。不存在「太深」。
 *
 * 记号 = 物理 3×3×5 的 10 个刚体转(U U' U2 D D' D2 R2 L2 F2 B2)。cstimer 的 `335 = <cuboid> / ${333}`
 * 后半段 333 的 90° 侧转在 3×3×5 上几何不可行(侧面是 3×5 长方形,90° 会把块转出盒外),是 cstimer 的
 * 人类速记、无刚体实现 —— 解析到 " / " 即止,只解前半段刚体打乱。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { randomCuboid335Scramble, solveCuboid335, CUBOID335_STATE_COUNT_STR, CUBOID335_ORBIT_PRODUCT_STR, type Cuboid335Solution } from '@/lib/cuboid335-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

// accepts the rigid cuboid alphabet plus the cstimer " / " separator and the trailing 333 part (ignored).
const CUBOID335_TOKEN_RE = /^(U['2]?|D['2]?|[RLFB]2|\/|[RLFBUD]['2]?)$/;

// random-scramble length for the buttons (cstimer 335 cuboid part default is long; mirror a real scramble).
const RANDOM_LEN = 40;

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: Cuboid335Solution }
  | { kind: 'error'; message: string };

export default function Cuboid335SolverPage() {
  useDocumentTitle('3×3×5 求解器', '3×3×5 Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed || lineCount > 1) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    const id = window.setTimeout(() => {
      let next: SolveState;
      try {
        next = { kind: 'done', result: solveCuboid335(trimmed) };
      } catch (e) {
        next = { kind: 'error', message: String((e as Error)?.message ?? e) };
      }
      if (reqRef.current === myReq) setState(next);
    }, 16);
    return () => window.clearTimeout(id);
  }, [trimmed, lineCount]);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: '335',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 U D2 R2 F2 U2',
      en: 'one scramble per line, e.g. U D2 R2 F2 U2',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !CUBOID335_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveCuboid335(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => Promise.resolve(randomCuboid335Scramble(RANDOM_LEN)),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="335" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: '3×3×5 在线求解:两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何打乱都能解出一条有界的近最优解;很浅的打乱另用可采纳启发式给出可证最优解。记号 U U’ U2 D D’ D2 R2 L2 F2 B2(物理 3×3×5 的刚体转);cstimer 的 / 333 速记无刚体实现,会被忽略。',
                en: '3×3×5 online solver: a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only) returns a bounded near-optimal solution for ANY scramble; very shallow scrambles additionally get a provably optimal solution. Notation U U’ U2 D D’ D2 R2 L2 F2 B2 (the rigid 3×3×5 moves); cstimer’s “/ 333” shorthand has no rigid realisation and is ignored.',
              })}
            </p>

            {trimmed && (
              <div className="pos-result" aria-live="polite">
                {state.kind !== 'error' && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="335" scramble={trimmed} size={64} />
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
                    {tr({ zh: '打乱记号无法识别(应为 U U’ U2 D D’ D2 R2 L2 F2 B2)', en: 'Unrecognized notation (expected U U’ U2 D D’ D2 R2 L2 F2 B2)' })}: <code>{state.message}</code>
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
                zh: `3×3×5 有 ${CUBOID335_STATE_COUNT_STR} 个可达状态(轨道乘积 ${CUBOID335_ORBIT_PRODUCT_STR} 因 144× 奇偶耦合而过计,实际由 Schreier-Sims 实算),太大无法整图 BFS,浏览器里也建不出足够强的可采纳启发去逼近上帝之数,所以**不是**每条解都最优。采用两阶段约简:先把每个轨道归约进全 180° 子群,再只用 180° 转还原;两阶段各自在自己的小坐标里最优,合起来就是有界的**近最优**解(任何打乱都能解)。很浅的打乱会额外尝试可采纳启发的可证最优解,标为「最优」;其余标为「近最优」。`,
                en: `The 3×3×5 has ${CUBOID335_STATE_COUNT_STR} reachable states (the orbit product ${CUBOID335_ORBIT_PRODUCT_STR} over-counts it by a 144× parity coupling; the true count is from Schreier-Sims) — far too many to BFS, and no admissible heuristic strong enough to reach God's number is buildable in the browser, so NOT every solution is optimal. The solver uses a two-phase reduction: first reduce every orbit into the all-180° subgroup, then finish with 180° turns only. Each phase is optimal over its own small coordinate, so the total is a bounded NEAR-OPTIMAL solution (every scramble solves). Very shallow scrambles additionally try an admissible-heuristic optimal solve, labeled "optimal"; the rest are labeled "near-optimal".`,
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
