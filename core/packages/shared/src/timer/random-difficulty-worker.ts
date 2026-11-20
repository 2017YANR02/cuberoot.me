import { formatMoves, type CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { buildMoveTables, type MoveTables } from '@cuberoot/puzzle-solvers/kociemba/movetables';
import { buildPruneTables, type PruneTables } from '@cuberoot/puzzle-solvers/kociemba/prune';
import { scrambleFromState } from '@cuberoot/puzzle-solvers/kociemba/search';
import { frameLabel, trainerSolution, type TrainerSpec } from '@cuberoot/puzzle-solvers/cross-trainer';
import { createTrainerStateBatchSampler } from '@cuberoot/puzzle-solvers/cross-trainer/batch';
import type { TimerRandomDifficultyBatch } from './random-difficulty-pool';
import type { TimerWorkerRpcResponse } from './worker-rpc';

export type TrainerWorkerRequest =
  | Readonly<{ kind: 'solve-state'; state: CubieCube }>
  | Readonly<{ kind: 'difficulty-batch'; spec: TrainerSpec; count: number; budgetMs: number }>
  | Readonly<{ kind: 'trainer-solution'; spec: TrainerSpec; state: CubieCube; isZh: boolean }>;

export type TrainerWorkerResult =
  | Readonly<{ kind: 'scramble'; scramble: string }>
  | Readonly<{ kind: 'difficulty-batch'; batch: TimerRandomDifficultyBatch }>
  | Readonly<{ kind: 'trainer-solution'; notation: string; frame: string }>;

/** Share the complete worker computation while each host owns its message transport. */
export function createTimerTrainerWorkerHandler() {
  let moveTables: MoveTables | null = null;
  let pruneTables: PruneTables | null = null;
  const sampleTrainerBatch = createTrainerStateBatchSampler();

  const ensureKociemba = (): { move: MoveTables; prune: PruneTables } => {
    moveTables ??= buildMoveTables();
    pruneTables ??= buildPruneTables(moveTables);
    return { move: moveTables, prune: pruneTables };
  };

  const handleRequest = (request: TrainerWorkerRequest): TrainerWorkerResult => {
    if (request.kind === 'trainer-solution') {
      const solved = trainerSolution(request.spec, request.state);
      if (!solved) throw new Error('trainer solution unavailable');
      return { kind: 'trainer-solution', notation: solved.notation, frame: frameLabel(solved.frame, request.isZh) };
    }
    const { move, prune } = ensureKociemba();
    if (request.kind === 'solve-state') {
      return { kind: 'scramble', scramble: formatMoves(scrambleFromState(request.state, move, prune)) };
    }
    const batch = sampleTrainerBatch(request.spec, request.count, request.budgetMs);
    return {
      kind: 'difficulty-batch',
      batch: {
        verdict: batch.verdict === 'ok' ? 'ready' : batch.verdict,
        items: batch.items.map(({ state, depth }) => ({
          scramble: formatMoves(scrambleFromState(state, move, prune)),
          spec: request.spec,
          depth,
          state,
        })),
      },
    };
  };

  return ({ id, request }: { id: number; request: TrainerWorkerRequest }): TimerWorkerRpcResponse<TrainerWorkerResult> => {
    try {
      return { id, ok: true, value: handleRequest(request) };
    } catch (error: unknown) {
      return { id, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}
