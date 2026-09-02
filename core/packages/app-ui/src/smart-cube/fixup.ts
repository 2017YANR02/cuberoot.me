import type { CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import type { TrainerSpec } from '@cuberoot/puzzle-solvers/cross-trainer';
import {
  parseHintableSmartCubeScramble,
  smartCubeFixupState,
} from '@cuberoot/shared/smart-cube/scramble-hint';
import {
  createTimerWorkerRpc,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer/worker-rpc';
import type {
  TimerRandomDifficultyBatch,
} from '@cuberoot/shared/timer';

export type Mobile333WorkerRequest =
  | Readonly<{ kind: 'solve-state'; state: CubieCube }>
  | Readonly<{
    kind: 'difficulty-batch';
    spec: TrainerSpec;
    count: number;
    budgetMs: number;
  }>
  | Readonly<{ kind: 'trainer-solution'; spec: TrainerSpec; state: CubieCube; isZh: boolean }>;

export type Mobile333WorkerResult =
  | Readonly<{ kind: 'scramble'; scramble: string }>
  | Readonly<{ kind: 'difficulty-batch'; batch: TimerRandomDifficultyBatch }>
  | Readonly<{ kind: 'trainer-solution'; notation: string; frame: string }>;

const createMobile333Rpc = (label: string) => (
  createTimerWorkerRpc<Mobile333WorkerRequest, Mobile333WorkerResult>({
    createWorker: () => new Worker(
      new URL('./fixup.worker.ts', import.meta.url),
      { type: 'module' },
    ) as unknown as TimerWorkerPort,
    makeRequest: (id, request) => ({ id, request }),
    label,
  })
);

// Cancelling one CPU-bound operation terminates its Worker transport. Keep the
// three independent flows isolated even though they reuse one worker module.
const smartCubeRpc = createMobile333Rpc('mobile smart-cube worker');
const trainerGenerationRpc = createMobile333Rpc('mobile trainer generation worker');
const trainerSolutionRpc = createMobile333Rpc('mobile trainer solution worker');

export async function solveMobileSmartCubeFixup(
  fromFacelets: string,
  targetFacelets: string,
): Promise<string | null> {
  const state = smartCubeFixupState(fromFacelets, targetFacelets);
  if (!state) return null;
  try {
    const result = await smartCubeRpc.request({ kind: 'solve-state', state }, undefined, 12_000);
    if (result.kind !== 'scramble') return null;
    return parseHintableSmartCubeScramble(result.scramble) ? result.scramble : null;
  } catch {
    return null;
  }
}

export async function generateMobileRandomDifficultyBatch(
  spec: TrainerSpec,
  count: number,
  budgetMs: number,
  signal: AbortSignal,
): Promise<TimerRandomDifficultyBatch> {
  const result = await trainerGenerationRpc.request({
    kind: 'difficulty-batch',
    spec,
    count,
    budgetMs,
  }, signal, 90_000);
  if (result.kind !== 'difficulty-batch') throw new Error('unexpected mobile 3x3 response');
  return result.batch;
}

export async function solveMobileRandomDifficultyCase(
  spec: TrainerSpec,
  state: CubieCube,
  isZh: boolean,
  signal?: AbortSignal,
): Promise<{ notation: string; frame: string }> {
  const result = await trainerSolutionRpc.request({
    kind: 'trainer-solution',
    spec,
    state,
    isZh,
  }, signal, 90_000);
  if (result.kind !== 'trainer-solution') throw new Error('unexpected mobile 3x3 response');
  return result;
}
