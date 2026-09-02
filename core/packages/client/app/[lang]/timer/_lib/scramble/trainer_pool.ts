import { type TrainerSpec } from '@/lib/cross-trainer';
import { cubieToFacelet } from '@/lib/cube-facelet';
import { m2pScrambleForFacelets, prewarmM2p } from '@/lib/m2p-scramble';
import {
  createTimerRandomDifficultyPool,
  type TimerRandomDifficultyBatch,
  type TimerRandomDifficultyResult,
  type TimerRandomDifficultyStatus,
} from '@cuberoot/shared/timer';
import {
  createTimerWorkerRpc,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer/worker-rpc';
import type { CubieCube } from './kociemba/cube';

const REQ_TIMEOUT_MS = 90_000;

export type WebTrainerWorkerRequest =
  | Readonly<{ kind: 'generate'; spec: TrainerSpec; count: number; budgetMs: number }>
  | Readonly<{ kind: 'solve'; spec: TrainerSpec; state: CubieCube; isZh: boolean }>;

export type WebTrainerWorkerResult =
  | Readonly<{
    kind: 'generated';
    states: CubieCube[];
    depths: number[];
    verdict: 'ok' | 'empty' | 'budget';
  }>
  | Readonly<{ kind: 'solved'; notation: string | null; frame: string }>;

const createTrainerRpc = (label: string) => createTimerWorkerRpc<
  WebTrainerWorkerRequest,
  WebTrainerWorkerResult
>({
  createWorker: () => new Worker(
    new URL('./trainer.worker.ts', import.meta.url),
    { type: 'module' },
  ) as unknown as TimerWorkerPort,
  makeRequest: (id, request) => ({ id, request }),
  label,
});

// A cancelled prefetch must not destroy an answer request (or vice versa).
const generationRpc = createTrainerRpc('web trainer generation worker');
const solutionRpc = createTrainerRpc('web trainer solution worker');

export interface TrainerMeta {
  spec: TrainerSpec;
  depth: number;
  state: CubieCube;
}

export async function solveTrainerCase(
  meta: TrainerMeta,
  isZh: boolean,
  signal?: AbortSignal,
): Promise<{ notation: string; frame: string } | null> {
  const result = await solutionRpc.request({
    kind: 'solve',
    spec: meta.spec,
    state: meta.state,
    isZh,
  }, signal, REQ_TIMEOUT_MS).catch(() => null);
  if (!result || result.kind !== 'solved' || result.notation === null) return null;
  return { notation: result.notation, frame: result.frame ?? '' };
}

async function generateBatch(
  spec: TrainerSpec,
  count: number,
  budgetMs: number,
  signal: AbortSignal,
): Promise<TimerRandomDifficultyBatch> {
  const response = await generationRpc.request({
    kind: 'generate', spec, count, budgetMs,
  }, signal, REQ_TIMEOUT_MS);
  if (response.kind !== 'generated') throw new Error('unexpected web trainer response');
  if (response.states.length !== response.depths.length) {
    throw new Error('trainer worker returned mismatched states and depths');
  }
  const converted = await Promise.allSettled(
    response.states.map((state) => m2pScrambleForFacelets(cubieToFacelet(state))),
  );
  const items: TimerRandomDifficultyResult[] = [];
  converted.forEach((entry, index) => {
    if (entry.status !== 'fulfilled' || !entry.value.trim()) return;
    items.push({
      scramble: entry.value,
      spec,
      depth: response.depths[index]!,
      state: response.states[index]!,
    });
  });
  if (response.states.length && !items.length) {
    throw new Error('trainer state conversion failed');
  }
  return {
    verdict: response.verdict === 'empty'
      ? 'empty'
      : response.verdict === 'budget'
        ? 'budget'
        : 'ready',
    items,
  };
}

const pool = createTimerRandomDifficultyPool(generateBatch);

export type TrainerStatus = TimerRandomDifficultyStatus;
export const onTrainerChange = pool.onChange;
export const releaseTrainer = pool.release;
export const trainerStatus = pool.status;
export const awaitTrainer = pool.wait;
export const retryTrainer = pool.retry;

export function prefetchTrainer(spec: TrainerSpec): void {
  if (typeof window === 'undefined') return;
  prewarmM2p();
  pool.prefetch(spec);
}

export function peekTrainerResult(spec: TrainerSpec): TimerRandomDifficultyResult | null {
  return pool.peek(spec);
}

export function _resetTrainerPool(): void {
  pool.reset();
  generationRpc.reset();
  solutionRpc.reset();
}
