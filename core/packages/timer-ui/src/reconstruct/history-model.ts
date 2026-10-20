import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { initialPoseRotation } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { buildCoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { methodFrame } from '@cuberoot/shared/timer/reconstruct/method-walk';
import type { MethodId } from '@cuberoot/shared/timer/reconstruct/methods';
import type { AnalysisInput } from './analysis-protocol';
import type { Solve } from '@cuberoot/shared/timer';
import type { MethodStageMetric } from '@cuberoot/shared/timer/reconstruct/method-walk';
export function methodHistoryWindow(history: Solve[], current: Solve): Solve[] {
  return history.filter(solve => solve.id !== current.id && solve.event === current.event && solve.ts <= current.ts
    && solve.penalty !== 'DNF' && solve.moves?.length)
    .sort((a, b) => b.ts - a.ts).slice(0, 12);
}
export function methodStageAverages(samples: MethodStageMetric[][]): Record<string, number> {
  if (samples.length < 5) return {};
  const sums: Record<string, number[]> = {};
  for (const stages of samples) for (const stage of stages) {
    if (stage.stepMs !== null) (sums[stage.key] ??= []).push(stage.stepMs);
  }
  return Object.fromEntries(Object.entries(sums).filter(([, values]) => values.length >= 5)
    .map(([key, values]) => [key, values.reduce((sum, value) => sum + value, 0) / values.length]));
}


export function methodHistorySource(solve: Solve, method: MethodId) {
  return JSON.stringify([method, solve.event, solve.scramble, solve.moves, solve.timeMs, solve.gyro, solve.device?.model]);
}
export function historyAnalysisInput(item: Solve, method: MethodId): AnalysisInput | null {
  const moves = item.moves ?? [];
  const gyro = decodeGyroTrack(item.gyro);
  const view = methodFrame(method, item.scramble, moves, initialPoseRotation(gyro, item.device?.model));
  const segs = computeStageSegments(item.scramble, moves, item.timeMs);
  if (!segs) return null;
  return { scoreable: false, text: {
    method, language: 'en', scramble: view.scramble, moves: view.moves, totalMs: item.timeMs,
    segs, metrics: null, slots: null, viewRotation: view.rotation,
    physical: { scramble: item.scramble, moves }, core: buildCoreTrack(gyro, { brand: item.device?.model, moves }),
  }};
}
