'use client';

/**
 * /scramble/solver?event=233 — 2×3×3 Domino (233) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。2×3×3 多米诺状态空间 = 1,625,702,400(8!·8!,角棱奇偶独立),太大无法整图 BFS,
 * 所以每条打乱用 IDA*(迭代加深 A*)+ max(角距离, 棱距离) 可采纳启发式现场求解,得到可证最短解(非近似)。
 * 两张完整模式库(8! 角、8! 棱,各一次 ~0.5s BFS,memoized)给出精确子距离,其 max 是真实距离的下界,
 * 故 IDA* 返回的是真正最短解。随机态平均约 13.7 步,样本最长 16,深态在毫秒到数百毫秒内解出;为防深态
 * 阻塞 UI,求解放进 setTimeout 异步执行,期间显示「求解中」spinner。打乱来源复用 /scramble/gen 的 cstimer
 * 桥(cstimerScramble('233')),记号与 cstimer 完全一致(U U' U2 R2 L2 F2 B2),保证它生成的打乱被正确求解。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCuboid233, type Cuboid233Solution } from '@/lib/cuboid233-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

const CUBOID233_TOKEN_RE = /^(U['2]?|[RLFB]2)$/;

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: Cuboid233Solution }
  | { kind: 'error'; message: string };

export default function Cuboid233SolverPage() {
  useDocumentTitle('2×3×3 多米诺求解器', '2×3×3 Domino Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  // Solve off the render path: deep states can cost a few hundred ms (and the first call builds the two
  // pattern databases), so defer to a macrotask and show a "solving" spinner so the UI never freezes.
  // Only runs for single (<=1 line); >=2 lines go through SolvePanel's batch solve.
  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed || lineCount > 1) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    const id = window.setTimeout(() => {
      let next: SolveState;
      try {
        next = { kind: 'done', result: solveCuboid233(trimmed) };
      } catch (e) {
        next = { kind: 'error', message: String((e as Error)?.message ?? e) };
      }
      if (reqRef.current === myReq) setState(next);
    }, 16);
    return () => window.clearTimeout(id);
  }, [trimmed, lineCount]);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: '233',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 U R2 U2 F2 U',
      en: 'one scramble per line, e.g. U R2 U2 F2 U',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !CUBOID233_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = solveCuboid233(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('233'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="233" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: '2×3×3 多米诺在线求解:每条打乱用 IDA* + max(角距离, 棱距离) 可采纳启发式现场算出整解最优解(可证最短,非近似)。记号 U U’ U2 R2 L2 F2 B2,与 cstimer 一致。',
                en: "2×3×3 Domino online solver: each scramble is solved on demand by IDA* with the admissible max(corner-distance, edge-distance) heuristic, giving the provably shortest solution (not an approximation). Notation U U’ U2 R2 L2 F2 B2, matching cstimer.",
              })}
            </p>

            {trimmed && (
              <div className="pos-result" aria-live="polite">
                {state.kind !== 'error' && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="233" scramble={trimmed} size={64} />
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
                    {tr({ zh: '打乱记号无法识别(应为 U U’ U2 R2 L2 F2 B2)', en: 'Unrecognized notation (expected U U’ U2 R2 L2 F2 B2)' })}: <code>{state.message}</code>
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
                        {tr({ zh: '步 最优解', en: state.result.length === 1 ? 'move (optimal)' : 'moves (optimal)' })}
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
                zh: '2×3×3 多米诺有 1,625,702,400 个状态(8 角 × 8 棱,各自由排列,角棱奇偶独立),太大无法整图 BFS,所以这里用 IDA* + max(角距离, 棱距离) 可采纳启发式逐条求解 —— 角、棱各自的精确距离都不超过真实距离,故返回的依然是可证的最短解,不是近似。随机态平均约 13.7 步,样本中最长 16 步。',
                en: 'The 2×3×3 Domino has 1,625,702,400 states (8 corners × 8 edges, each freely permuted, parities independent) — far too many to BFS — so it is solved per-instance by IDA* with the admissible max(corner-distance, edge-distance) heuristic. Since each sub-distance never overestimates the true distance, the returned solution is still a provably shortest path, not an approximation. Random states average ~13.7 moves; the longest seen in a large sample is 16.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
