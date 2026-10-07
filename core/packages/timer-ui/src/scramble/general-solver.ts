import { applySequence, solvedCubie, parseMoves, formatMoves, invertSequence } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { createTimerWorkerRpc } from '@cuberoot/shared/timer/worker-rpc';
import type { TrainerWorkerRequest, TrainerWorkerResult } from './trainer';

/** A tool owns its transport: closing it never cancels a trainer or cube correction. */
export function createGeneralSolver() {
  const rpc = createTimerWorkerRpc<TrainerWorkerRequest, TrainerWorkerResult>({
    createWorker: () => new Worker(new URL('./trainer.worker.ts', import.meta.url), { type: 'module' }),
    makeRequest: (id, request) => ({ id, request }), label: 'General solver',
  });
  return {
    async solve(scramble: string, signal?: AbortSignal) {
      const state = applySequence(solvedCubie(), parseMoves(scramble));
      const result = await rpc.request({ kind: 'solve-state', state }, signal, 90_000);
      if (result.kind !== 'scramble') throw new Error('Unexpected solver response');
      // scrambleFromState builds the supplied state; the solution is its inverse.
      return { solution: formatMoves(invertSequence(parseMoves(result.scramble))), inverse: result.scramble };
    },
    reset: () => rpc.reset(),
  };
}
