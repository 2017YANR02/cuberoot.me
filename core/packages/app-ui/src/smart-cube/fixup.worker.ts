/// <reference lib="webworker" />

import { formatMoves, type CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { buildMoveTables, type MoveTables } from '@cuberoot/puzzle-solvers/kociemba/movetables';
import { buildPruneTables, type PruneTables } from '@cuberoot/puzzle-solvers/kociemba/prune';
import { scrambleFromState } from '@cuberoot/puzzle-solvers/kociemba/search';
import { frameLabel, trainerSolution } from '@cuberoot/puzzle-solvers/cross-trainer';
import { createTrainerStateBatchSampler } from '@cuberoot/puzzle-solvers/cross-trainer/batch';
import type { TimerWorkerRpcResponse } from '@cuberoot/shared/timer/worker-rpc';
import type { TimerRandomDifficultyBatch } from '@cuberoot/shared/timer';
import type {
  Mobile333WorkerRequest,
  Mobile333WorkerResult,
} from './fixup';

let moveTables: MoveTables | null = null;
let pruneTables: PruneTables | null = null;

const scope = self as unknown as DedicatedWorkerGlobalScope;
const sampleTrainerBatch = createTrainerStateBatchSampler();

function ensureKociemba(): { move: MoveTables; prune: PruneTables } {
  moveTables ??= buildMoveTables();
  pruneTables ??= buildPruneTables(moveTables);
  return { move: moveTables, prune: pruneTables };
}

function difficultyBatch(
  request: Extract<Mobile333WorkerRequest, { kind: 'difficulty-batch' }>,
): TimerRandomDifficultyBatch {
  const { move, prune } = ensureKociemba();
  const batch = sampleTrainerBatch(request.spec, request.count, request.budgetMs);
  return {
    verdict: batch.verdict === 'ok' ? 'ready' : batch.verdict,
    items: batch.items.map(({ state, depth }) => ({
      scramble: formatMoves(scrambleFromState(state, move, prune)),
      spec: request.spec,
      depth,
      state,
    })),
  };
}

scope.addEventListener('message', (event: MessageEvent<{
  id: number;
  request: Mobile333WorkerRequest;
}>) => {
  const { id, request } = event.data;
  try {
    let value: Mobile333WorkerResult;
    if (request.kind === 'solve-state') {
      const { move, prune } = ensureKociemba();
      value = {
        kind: 'scramble',
        scramble: formatMoves(scrambleFromState(request.state, move, prune)),
      };
    } else if (request.kind === 'difficulty-batch') {
      value = { kind: 'difficulty-batch', batch: difficultyBatch(request) };
    } else {
      const solved = trainerSolution(request.spec, request.state);
      if (!solved) throw new Error('trainer solution unavailable');
      value = {
        kind: 'trainer-solution',
        notation: solved.notation,
        frame: frameLabel(solved.frame, request.isZh),
      };
    }
    scope.postMessage({
      id,
      ok: true,
      value,
    } satisfies TimerWorkerRpcResponse<Mobile333WorkerResult>);
  } catch (error: unknown) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies TimerWorkerRpcResponse<Mobile333WorkerResult>);
  }
});

export {};
