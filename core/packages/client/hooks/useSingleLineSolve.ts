import { useEffect, useRef, useState } from 'react';

// Shared solve-state machine for the /scramble/solver "puzzle-optimal" family
// (15 near-identical solvers). A puzzle's lib module returns either a value
// (sync engines: BFS/IDA* running on the main thread, deferred one macrotask
// so a "solving…" spinner can paint first) or a Promise (async engines: an
// offline table fetch+inflate, or a heavier reused solver like kociemba).

export interface SolverResultBase {
  solution: string;
  length: number;
  optimal?: boolean;
  /** Direct-product puzzles (sia123/sia222): per-half optimal lengths [A, B]. */
  halfLengths?: [number, number];
}

export type SolveState<R extends SolverResultBase> =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: R }
  /** tableError set only for invocations with tableErrorMode: true — see below. */
  | { kind: 'error'; message: string; tableError?: boolean };

export type SolveInvocation<R extends SolverResultBase> =
  | { async: false; solve: (trimmed: string) => R }
  | {
      async: true;
      solve: (trimmed: string) => Promise<R>;
      /**
       * Puzzles that lazily fetch+inflate an offline distance/pattern table
       * (bic/sia123/sia222): a thrown message starting with "bad:" is a
       * notation parse failure, anything else is a table fetch/inflate
       * failure — surfaced as a separate `tableError` UI branch.
       */
      tableErrorMode?: boolean;
    };

/**
 * Drives the single-line (<=1 input row) solve lifecycle: gate on non-empty
 * input (plus an optional extra `gateOk`, used by tuple-notation puzzles that
 * require a digit/slash before treating the input as "has content"), guard
 * stale resolutions with a request counter, and run the engine either via a
 * deferred macrotask (sync) or a cancellable Promise (async). Multi-line
 * (batch) input is handled entirely by <SolvePanel>, not this hook.
 */
export function useSingleLineSolve<R extends SolverResultBase>(
  trimmed: string,
  lineCount: number,
  gateOk: boolean,
  invocation: SolveInvocation<R>,
): SolveState<R> {
  const [state, setState] = useState<SolveState<R>>({ kind: 'idle' });
  const reqRef = useRef(0);

  useEffect(() => {
    if (!trimmed || !gateOk || lineCount > 1) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });

    if (invocation.async) {
      let cancelled = false;
      invocation.solve(trimmed).then(
        (result) => { if (!cancelled && reqRef.current === myReq) setState({ kind: 'done', result }); },
        (e) => {
          if (cancelled || reqRef.current !== myReq) return;
          const message = String((e as Error)?.message ?? e);
          setState({
            kind: 'error',
            message,
            tableError: invocation.tableErrorMode ? !message.startsWith('bad:') : undefined,
          });
        },
      );
      return () => { cancelled = true; };
    }

    const id = window.setTimeout(() => {
      let next: SolveState<R>;
      try {
        next = { kind: 'done', result: invocation.solve(trimmed) };
      } catch (e) {
        next = { kind: 'error', message: String((e as Error)?.message ?? e) };
      }
      if (reqRef.current === myReq) setState(next);
    }, 16);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, gateOk, lineCount]);

  return state;
}
