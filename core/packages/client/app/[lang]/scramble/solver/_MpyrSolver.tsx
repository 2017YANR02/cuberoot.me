'use client';

/**
 * /scramble/solver?event=mpyrso — Master Pyraminx (大金字塔 / 随态) NEAR-OPTIMAL solver.
 *
 * The Master Pyraminx is a random-STATE puzzle with ~4.6×10¹¹ reachable states — far too many to BFS or
 * tabulate. Unlike the TIER A/B puzzles in this loop, this is NOT solved optimally: we WRAP cstimer's own
 * two-phase solver (tools/cstimer-scramble/scramble/pyraminx.js) as a near-optimal engine, driven through
 * the cstimer worker bridge (lib/cstimer-scramble → cstimerSolve). The solution is cstimer's near-optimal
 * two-phase output (phase-1 to a coset, phase-2 to solved) plus the trivial corner tips. Validity
 * (scramble∘solution = solved) is the contract — cross-checked against the real cstimer engine in tests.
 *
 * Solving is ASYNC (worker round-trip + a one-time prune-table build on the first call), so the UI shows a
 * "solving" spinner. Notation matches cstimer exactly: U Uw B Bw R Rw L Lw (+ tips u r l b), each with an
 * optional prime. Preview is a 4-face triangular net derived from the true state (solved = single color
 * per face). Metric = each token = 1 move (cstimer face-turn count); the result is near-optimal, NOT
 * provably shortest.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveMpyr, type MpyrSolution } from '@/lib/mpyr-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

// body moves U/Uw/B/Bw/R/Rw/L/Lw + tips u/r/l/b, each with optional prime/2.
const MPYR_TOKEN_RE = /^([URBL]w?|[urlb])(2?'?)$/;

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: MpyrSolution }
  | { kind: 'error'; message: string };

export default function MpyrSolverPage() {
  useDocumentTitle('大金字塔求解器', 'Master Pyraminx Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  // Async solve via the cstimer worker. Guard with a request counter so a stale
  // resolve from a previous scramble can't overwrite a newer one. Only single (<=1 line);
  // >=2 lines go through SolvePanel's batch solve.
  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed || lineCount > 1) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    let cancelled = false;
    solveMpyr(trimmed).then(
      (result) => { if (!cancelled && reqRef.current === myReq) setState({ kind: 'done', result }); },
      (e) => { if (!cancelled && reqRef.current === myReq) setState({ kind: 'error', message: String((e as Error)?.message ?? e) }); },
    );
    return () => { cancelled = true; };
  }, [trimmed, lineCount]);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'mpyrso',
    metricLabel: 'moves',
    placeholder: {
      zh: '每行一条打乱,如 U Rw B Lw R',
      en: 'one scramble per line, e.g. U Rw B Lw R',
    },
    validate: (line) => {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok && !MPYR_TOKEN_RE.test(tok)) return tok;
      }
      return null;
    },
    solveOne: async (s) => {
      const o = await solveMpyr(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: () => cstimerScramble('mpyrso'),
    concurrency: 1, // single shared worker
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="mpyrso" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: '大金字塔(随态)在线求解:状态空间约 4.6×10¹¹,太大无法整图枚举,所以直接复用 cstimer 自带的两阶段求解器作为近最优引擎(可证 打乱∘解=还原,长度接近最优但非可证最短)。记号 U Uw B Bw R Rw L Lw 加四个角尖 u r l b,与 cstimer 一致。',
                en: 'Master Pyraminx (random-state) online solver: the state space is ≈ 4.6×10¹¹, far too many to enumerate, so we reuse cstimer\'s own two-phase solver as a near-optimal engine (provably scramble∘solution = solved; length is near-optimal, not provably shortest). Notation U Uw B Bw R Rw L Lw + the four tips u r l b, matching cstimer.',
              })}
            </p>

            {trimmed && (
              <div className="pos-result" aria-live="polite">
                {state.kind !== 'error' && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="mpyrso" scramble={trimmed} size={72} />
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
                    {tr({ zh: '打乱记号无法识别(应为 U Uw B Bw R Rw L Lw 加角尖 u r l b)', en: 'Unrecognized notation (expected U Uw B Bw R Rw L Lw + tips u r l b)' })}: <code>{state.message}</code>
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
                zh: '大金字塔状态空间约 4.6×10¹¹,无法像小魔方那样整图 BFS 求可证最优。这里把 cstimer 自带的两阶段求解器当引擎:先把状态归约到一个陪集(阶段一),再求解到还原态(阶段二)。结果保证能把打乱解开(打乱∘解=还原),长度接近最优但不保证是最短解。角尖独立处理。',
                en: 'The Master Pyraminx state space is ≈ 4.6×10¹¹, too large to BFS for a provably optimal solution like the small puzzles. We use cstimer\'s own two-phase solver as the engine: reduce the state to a coset (phase 1), then solve to the solved state (phase 2). The result is guaranteed to solve the scramble (scramble∘solution = solved); its length is near-optimal but not guaranteed shortest. Tips are handled trivially.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
