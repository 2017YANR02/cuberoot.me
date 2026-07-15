'use client';

/**
 * /scramble/solver?event=dino — Dino Cube (恐龙魔方) NEAR-OPTIMAL solver.
 *
 * The Dino Cube is a random-STATE, edge-only puzzle: its reachable state space is A12 = 12!/2 =
 * 239,500,800 — beyond TIER A full BFS (~2×10⁶) and TIER B packed table (~5×10⁷). Unlike the TIER A/B
 * puzzles in this loop, this is NOT solved optimally: we WRAP cstimer's own dino solver
 * (tools/cstimer-scramble/scramble/redi.js, an IDA* over 3 edge-comb prune tables) as a near-optimal
 * engine, driven through the cstimer worker bridge (lib/cstimer-scramble → cstimerSolve). Validity
 * (scramble∘solution = solved) is the contract — cross-checked against the real cstimer engine in tests.
 *
 * Solving is ASYNC (worker round-trip + a one-time prune-table build on the first call), so the UI shows a
 * "solving" spinner. Notation matches cstimer exactly: F L B R f l b r (the 8 corners), each with an
 * optional prime. Preview is a 6-face unfolded cube net derived from the true state (solved = single color
 * per face). Metric = each token = 1 move (cstimer face-turn count); the result is near-optimal (the dino
 * God's number is 10 in this metric), NOT a provable-optimality guarantee.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveDino, DINO_TOKEN_RE, type DinoSolution } from '@/lib/dino-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: DinoSolution }
  | { kind: 'error'; message: string };

export default function DinoSolverPage() {
  useDocumentTitle('恐龙魔方求解器', 'Dino Cube Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  // Async solve via the cstimer worker. Guard with a request counter so a stale
  // resolve from a previous scramble can't overwrite a newer one. Only runs for single
  // (<=1 line); >=2 lines go through SolvePanel's batch solve.
  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed || lineCount > 1) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    let cancelled = false;
    solveDino(trimmed).then(
      (result) => { if (!cancelled && reqRef.current === myReq) setState({ kind: 'done', result }); },
      (e) => { if (!cancelled && reqRef.current === myReq) setState({ kind: 'error', message: String((e as Error)?.message ?? e) }); },
    );
    return () => { cancelled = true; };
  }, [trimmed, lineCount]);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'dino',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 F L B r f',
      en: 'one scramble per line, e.g. F L B r f',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !DINO_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = await solveDino(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('dino'),
    concurrency: 1, // single shared worker
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="dino" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: '恐龙魔方在线求解:状态空间约 2.4×10⁸(A12 = 12!/2,只有棱),太大无法整图枚举,所以直接复用 cstimer 自带的求解器作为近最优引擎(可证 打乱∘解=还原,长度接近最优但非可证最短;恐龙魔方上帝之数为 10)。记号 F L B R f l b r(八个角),与 cstimer 一致。',
                en: 'Dino Cube online solver: the state space is ≈ 2.4×10⁸ (A12 = 12!/2, edges only), far too many to enumerate, so we reuse cstimer\'s own solver as a near-optimal engine (provably scramble∘solution = solved; length is near-optimal, not provably shortest — the Dino God\'s number is 10). Notation F L B R f l b r (the 8 corners), matching cstimer.',
              })}
            </p>

            {trimmed && (
              <div className="pos-result" aria-live="polite">
                {state.kind !== 'error' && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="dino" scramble={trimmed} size={72} />
                  </div>
                )}
                {state.kind === 'solving' && (
                  <p className="pos-result-solved">
                    <LoaderCircle size={16} className="pos-spin" aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
                    {tr({ zh: '求解中(首次会构建剪枝表)…', en: 'Solving (the first call builds prune tables)…' })}
                  </p>
                )}
                {state.kind === 'error' && (
                  <p className="pos-error">
                    {tr({ zh: '打乱记号无法识别(应为 F L B R f l b r,可带 \')', en: 'Unrecognized notation (expected F L B R f l b r, optionally primed)' })}: <code>{state.message}</code>
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
                        {tr({ zh: '步 近最优解', en: state.result.length === 1 ? 'move (near-optimal)' : 'moves (near-optimal)' })}
                      </span>
                    </div>
                    <div className="ivy-solbox">{state.result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr({ zh: '关于「近最优」', en: 'About "near-optimal"' })}</strong>{' '}
              {tr({
                zh: '恐龙魔方只有 12 条棱,可达状态约 2.4×10⁸(交错群 A12),太大无法像小魔方那样整图 BFS 求可证最优。这里把 cstimer 自带的求解器当引擎(IDA* 配三张棱组合剪枝表)。结果保证能把打乱解开(打乱∘解=还原),长度接近最优(恐龙魔方上帝之数为 10),但本工具不对每条解断言一定是最短。',
                en: 'The Dino Cube has only 12 edges; ≈ 2.4×10⁸ reachable states (the alternating group A12), too large to BFS for a provably optimal solution like the small puzzles. We use cstimer\'s own solver as the engine (an IDA* over three edge-combination prune tables). The result is guaranteed to solve the scramble (scramble∘solution = solved); its length is near-optimal (the Dino God\'s number is 10), but this tool does not assert each solution is the shortest.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
