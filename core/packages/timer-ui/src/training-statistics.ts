import type { EventId, Solve } from '@cuberoot/shared/timer';
import { summarize } from '@cuberoot/shared/timer';
import { timerSupportsTrainingTiming, type TrainingStartMode } from '@cuberoot/shared/timer';
import { trainingSolveMetrics } from '@cuberoot/shared/timer/reconstruct/recon-text';

/** Observation/execution/total use one population; penalties apply to total only. */
export function timerTrainingSummaries(solves: Solve[], event: EventId, mode: TrainingStartMode) {
  if (!timerSupportsTrainingTiming(event)) return undefined;
  const samples = solves.filter(solve => solve.moves?.length
    && (solve.trainingStartMode ?? 'first-turn') === mode)
    .map(solve => ({ solve, metrics: trainingSolveMetrics(solve) }));
  return (['observationMs', 'executionMs', 'totalMs'] as const).map(key => summarize(
    samples.map(({ solve, metrics }) => ({ ...solve, timeMs: metrics[key],
      penalty: key === 'totalMs' ? solve.penalty : solve.penalty === '+2' ? 'ok' as const : solve.penalty,
    })), event));
}
