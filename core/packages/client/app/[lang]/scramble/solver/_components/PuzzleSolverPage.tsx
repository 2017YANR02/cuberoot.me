'use client';

// Config-driven base for the "puzzle-optimal" solver family — 15 near-identical
// pages that each wrap a puzzle's lib/*-solver module in the same single-line
// solve UI (preview → spinner/error/solved/done → metric + solution box →
// caveat). Per-puzzle differences (sync/async engine, tuple-notation gating,
// offline-table error mode, metric badge, all the long bilingual prose) live in
// SolverSpec (see the ~15 sibling _*Solver.tsx files, each a spec literal + a
// one-line `<PuzzleSolverPage spec={SPEC} />`).
//
// Deliberately NOT merged into one shared spec table (unlike the scramble/stats
// EnumeratedDistView consolidation): page.tsx dynamic-imports each _*Solver.tsx
// separately for code-splitting, so every puzzle's spec + lib import must stay
// in its own file — only the render skeleton and the solve-state hook are
// shared (hooks/useSingleLineSolve.ts).

import { useEffect, useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { useSingleLineSolve, type SolverResultBase, type SolveInvocation } from '@/hooks/useSingleLineSolve';
import SolveTabs, { type SolvePuzzle } from '../../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../../_components/BatchSolvePanel';
import '../../_components/puzzle_optimal_solver.css';
import '../ivy_solver.css';

export interface TrText { zh: string; en: string }

/** Tuple-notation puzzles (bsq/sq2/ssq1) require a digit or `/` before the
 *  input counts as "has content" — plain letter tokens alone don't gate. */
const HAS_TOKENS = /[\d/]/;

export interface SolverSpec<R extends SolverResultBase> {
  event: SolvePuzzle;                // batchSpec.event / SolveTabs puzzle / ScramblePreview2D event
  titleZh: string;
  titleEn: string;
  previewSize: number;

  invocation: SolveInvocation<R>;
  /** true for bsq/sq2/ssq1 — extra gate via the shared HAS_TOKENS regex. */
  hasTokensGate?: boolean;

  leadText: TrText;
  placeholder: TrText;
  solvingText: TrText;
  errorNotationText: TrText;
  /** only rendered when invocation is async + tableErrorMode */
  errorTableText?: TrText;

  metricLabel: (result: R) => TrText;
  badge?: (result: R) => TrText | null;

  caveatTitle: TrText;
  caveatBody: TrText;

  validate: (line: string) => string | null;
  randomOne: () => Promise<string | null>;
  /** Sync table-lookup engines (ivy/gear/heli/…) lazily build their in-memory
   *  graph on first solve; call this once on mount (deferred 200ms) so the first
   *  real solve is instant. Errors are swallowed. */
  prewarm?: () => void;
}

// ---- shared metricLabel / badge / caveatTitle building blocks ----
// Every puzzle's metric text falls into one of these four shapes; reuse the
// closure instead of hand-rolling the singular/plural + optimal/near/bounded
// ternary in each spec.

const moveNoun = (n: number) => (n === 1 ? 'move' : 'moves');

export const METRIC_FIXED_OPTIMAL = <R extends SolverResultBase>(r: R): TrText => ({
  zh: '步 最优解', en: `${moveNoun(r.length)} (optimal)`,
});
export const METRIC_FIXED_NEAR_OPTIMAL = <R extends SolverResultBase>(r: R): TrText => ({
  zh: '步 近最优解', en: `${moveNoun(r.length)} (near-optimal)`,
});
export const METRIC_FIXED_BOUNDED = <R extends SolverResultBase>(r: R): TrText => ({
  zh: '步 (有界, 非最优)', en: `${moveNoun(r.length)} (bounded, not optimal)`,
});
export const METRIC_TERNARY_OPTIMAL_NEAR = <R extends SolverResultBase & { optimal: boolean }>(r: R): TrText => (
  r.optimal ? METRIC_FIXED_OPTIMAL(r) : METRIC_FIXED_NEAR_OPTIMAL(r)
);
export const METRIC_TERNARY_OPTIMAL_BOUNDED = <R extends SolverResultBase & { optimal: boolean }>(r: R): TrText => (
  r.optimal ? METRIC_FIXED_OPTIMAL(r) : { zh: '步 有界解', en: `${moveNoun(r.length)} (bounded)` }
);

export const badgeGodsNumber = (n: number) => (): TrText => ({
  zh: `上帝之数 ${n}`, en: `God's number ${n}`,
});
export const badgeCap = (n: number) => (): TrText => ({
  zh: `上界 ${n}`, en: `cap ${n}`,
});
export const badgeHalfLengths = <R extends SolverResultBase>(r: R): TrText | null => (
  r.halfLengths ? { zh: `A ${r.halfLengths[0]} + B ${r.halfLengths[1]}`, en: `A ${r.halfLengths[0]} + B ${r.halfLengths[1]}` } : null
);

export const CAVEAT_TITLE_OPTIMAL: TrText = { zh: '关于「最优」', en: 'About "optimal"' };
export const CAVEAT_TITLE_NEAR_OPTIMAL: TrText = { zh: '关于「近最优」', en: 'About "near-optimal"' };
export const CAVEAT_TITLE_BOUNDED: TrText = { zh: '关于「有界」', en: 'About "bounded"' };

export default function PuzzleSolverPage<R extends SolverResultBase>({ spec }: { spec: SolverSpec<R> }) {
  useDocumentTitle(spec.titleZh, spec.titleEn);

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';
  const gateOk = !spec.hasTokensGate || HAS_TOKENS.test(trimmed);

  const state = useSingleLineSolve(trimmed, lineCount, gateOk, spec.invocation);

  // Warm the sync engine's lazy graph so the first real solve is instant.
  useEffect(() => {
    const warm = spec.prewarm;
    if (!warm) return;
    const id = window.setTimeout(() => { try { warm(); } catch { /* noop */ } }, 200);
    return () => window.clearTimeout(id);
    // spec identity is stable (module-scope literal in each _*Solver.tsx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: spec.event,
    metricLabel: 'moves',
    placeholder: spec.placeholder,
    validate: spec.validate,
    solveOne: async (s) => {
      const o = spec.invocation.async ? await spec.invocation.solve(s) : spec.invocation.solve(s);
      return { len: o.length, solution: o.solution };
    },
    randomOne: spec.randomOne,
    concurrency: 1,
    // spec identity is stable (module-scope literal in each _*Solver.tsx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [spec.event]);

  return (
    <div className="pos-page">
      <SolveTabs puzzle={spec.event} mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">{tr(spec.leadText)}</p>

            {trimmed && gateOk && (
              <div className="pos-result" aria-live="polite">
                {state.kind !== 'error' && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event={spec.event} scramble={trimmed} size={spec.previewSize} />
                  </div>
                )}
                {state.kind === 'solving' && (
                  <p className="pos-result-solved">
                    <LoaderCircle size={16} className="pos-spin" aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
                    {tr(spec.solvingText)}
                  </p>
                )}
                {state.kind === 'error' && (!spec.errorTableText || !state.tableError) && (
                  <p className="pos-error">
                    {tr(spec.errorNotationText)}: <code>{state.message}</code>
                  </p>
                )}
                {state.kind === 'error' && spec.errorTableText && state.tableError && (
                  <p className="pos-error">
                    {tr(spec.errorTableText)}: <code>{state.message}</code>
                  </p>
                )}
                {state.kind === 'done' && state.result.length === 0 && (
                  <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved' })}</p>
                )}
                {state.kind === 'done' && state.result.length > 0 && (
                  <>
                    <div className="ivy-metric">
                      <span className="ivy-metric-num">{state.result.length}</span>
                      <span className="ivy-metric-label">{tr(spec.metricLabel(state.result))}</span>
                      {spec.badge && spec.badge(state.result) && (
                        <span className="ivy-metric-god">{tr(spec.badge(state.result)!)}</span>
                      )}
                    </div>
                    <div className="ivy-solbox">{state.result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr(spec.caveatTitle)}</strong>{' '}
              {tr(spec.caveatBody)}
            </div>
          </>
        )}
      />
    </div>
  );
}
