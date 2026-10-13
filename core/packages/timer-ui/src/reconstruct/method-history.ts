import { useEffect, useState } from 'react';
import type { Solve } from '@cuberoot/shared/timer';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { initialPoseRotation } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { buildCoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { methodFrame, type MethodStageMetric } from '@cuberoot/shared/timer/reconstruct/method-walk';
import { METHODS, type MethodId } from '@cuberoot/shared/timer/reconstruct/methods';
import { reconstructionAnalyzer } from './analysis-client';

const STORAGE = 'cuberoot.reconstruction.stage-cache.v1';
interface Entry { source: string; stages: MethodStageMetric[] }
type Cache = Record<string, Entry>;
function source(solve: Solve, method: MethodId) {
  return JSON.stringify([method, solve.event, solve.scramble, solve.moves, solve.timeMs, solve.gyro, solve.device?.model]);
}
function readCache(): Cache {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
export function cachedMethodStages(solve: Solve, method: MethodId): MethodStageMetric[] | null {
  const entry = readCache()[`${method}:${solve.id}`];
  if (!entry || entry.source !== source(solve, method) || !Array.isArray(entry.stages)) return null;
  if (entry.stages.length !== METHODS[method].stages.length || entry.stages.some((stage, i) =>
    !stage || stage.key !== METHODS[method].stages[i].key ||
    (stage.stepMs !== null && (typeof stage.stepMs !== 'number' || !Number.isFinite(stage.stepMs) || stage.stepMs < 0)))) return null;
  return entry.stages;
}
export function rememberMethodStages(solve: Solve, method: MethodId, stages: MethodStageMetric[]) {
  const cache = readCache();
  const key = `${method}:${solve.id}`;
  delete cache[key];
  cache[key] = { source: source(solve, method), stages };
  // Derived data only: bound storage, and reanalyse evicted records when needed.
  while (Object.keys(cache).length > 100 || JSON.stringify(cache).length > 2_000_000) {
    delete cache[Object.keys(cache)[0]];
  }
  try { localStorage.setItem(STORAGE, JSON.stringify(cache)); } catch { /* Quota/private mode: recompute next time. */ }
}
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

/** Backfill one worker job at a time, cancelled when the report/method changes. */
export function useMethodHistory(method: MethodId, solve: Solve, history: Solve[] | undefined, enabled: boolean) {
  const [state, setState] = useState<{ key: string; averages: Record<string, number> } | null>(null);
  const window = methodHistoryWindow(history ?? [], solve);
  const key = JSON.stringify([method, window.map(value => [value.id, source(value, method)])]);
  useEffect(() => {
    if (!enabled || method === 'cfop' || window.length < 5) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let cancelPending: (() => void) | undefined;
    const samples: MethodStageMetric[][] = [];
    const run = async () => {
      for (const item of window) {
        if (cancelled) return;
        let stages = cachedMethodStages(item, method);
        if (!stages) {
          const moves = item.moves!;
          const gyro = decodeGyroTrack(item.gyro);
          const view = methodFrame(method, item.scramble, moves, initialPoseRotation(gyro, item.device?.model));
          const segs = computeStageSegments(item.scramble, moves, item.timeMs);
          if (!segs) continue;
          stages = await new Promise<MethodStageMetric[] | null>(resolve => {
            cancelPending = () => resolve(null);
            unsubscribe = reconstructionAnalyzer.subscribe({ scoreable: false, text: {
              method, language: 'en', scramble: view.scramble, moves: view.moves, totalMs: item.timeMs,
              segs, metrics: null, slots: null, viewRotation: view.rotation,
              physical: { scramble: item.scramble, moves }, core: buildCoreTrack(gyro, { brand: item.device?.model, moves }),
            } }, snapshot => {
              if (snapshot.status !== 'pending') resolve(snapshot.text?.methodStages ?? null);
            });
          });
          unsubscribe?.();
          cancelPending = undefined;
          if (cancelled) return;
          if (stages) rememberMethodStages(item, method, stages);
        }
        if (stages?.at(-1)?.endIdx != null) samples.push(stages);
      }
      if (!cancelled) setState({ key, averages: methodStageAverages(samples) });
    };
    void run().catch(error => { if (!cancelled) console.warn('[reconstruct] history analysis failed:', error); });
    return () => { cancelled = true; unsubscribe?.(); cancelPending?.(); };
    // The key includes every physical input; array identity changes need no restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return enabled && state?.key === key ? state.averages : undefined;
}
