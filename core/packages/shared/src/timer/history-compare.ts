import { formatSolveResult } from './stats';
import { stageSegmentsFor } from './stage-segments-producer';
import type { StageSegments } from './stage-segments';
import type { Solve } from './types';

export type TimerHistoryCompareStageKey = 'cross' | 'f2l' | 'oll' | 'pll';

export interface TimerHistoryCompareStageValue {
  caseLabel: string | null;
  htm: number | null;
  ms: number | null;
  tps: number | null;
}

export interface TimerHistoryCompareStage {
  a: TimerHistoryCompareStageValue;
  b: TimerHistoryCompareStageValue;
  key: TimerHistoryCompareStageKey;
}

export interface TimerHistoryCompareSide {
  result: string;
  stageSegments: StageSegments | null;
  totalHtm: number | null;
  totalTps: number | null;
}

export interface TimerHistoryComparison {
  a: TimerHistoryCompareSide;
  b: TimerHistoryCompareSide;
  stages: readonly TimerHistoryCompareStage[];
}

/** Select/deselect a solve while retaining at most the two newest choices. */
export function toggleTimerHistoryCompareSelection(
  selectedIds: readonly string[],
  solveId: string,
): string[] {
  const unique = selectedIds.filter((id, index) => selectedIds.indexOf(id) === index);
  if (unique.includes(solveId)) return unique.filter((id) => id !== solveId);
  return [...unique.slice(-1), solveId];
}

/** Resolve only a complete, distinct pair. Filter-hidden solves remain valid. */
export function resolveTimerHistoryComparePair(
  solves: readonly Solve[],
  selectedIds: readonly string[],
): readonly [Solve, Solve] | null {
  if (selectedIds.length !== 2 || selectedIds[0] === selectedIds[1]) return null;
  const byId = new Map(solves.map((solve) => [solve.id, solve]));
  const a = byId.get(selectedIds[0]);
  const b = byId.get(selectedIds[1]);
  return a && b ? [a, b] : null;
}

/** Drop only solves that left the full history; filters must not clear selection. */
export function pruneTimerHistoryCompareSelection(
  solves: readonly Solve[],
  selectedIds: readonly string[],
): string[] {
  const existing = new Set(solves.map((solve) => solve.id));
  return selectedIds.filter((id) => existing.has(id));
}

function totalHtm(segments: StageSegments | null): number | null {
  if (!segments) return null;
  const values = [segments.crossHtm, segments.f2lHtm, segments.ollHtm, segments.pllHtm]
    .filter((value): value is number => value !== null);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function tps(ms: number | null, htm: number | null): number | null {
  return ms !== null && htm !== null && ms > 0 ? htm / (ms / 1000) : null;
}

function comparisonSide(solve: Solve): TimerHistoryCompareSide {
  const stageSegments = solve.stageSegments ?? stageSegmentsFor(solve);
  const htm = totalHtm(stageSegments);
  return {
    result: formatSolveResult(solve),
    stageSegments,
    totalHtm: htm,
    // TPS describes the physical solve, so penalties never change its denominator.
    totalTps: tps(solve.timeMs, htm),
  };
}

function stageValue(
  segments: StageSegments | null,
  key: TimerHistoryCompareStageKey,
): TimerHistoryCompareStageValue {
  if (!segments) return { caseLabel: null, htm: null, ms: null, tps: null };
  const ms = segments[`${key}Ms`];
  const htm = segments[`${key}Htm`];
  const caseLabel = key === 'cross'
    ? segments.crossSide
    : key === 'oll' ? segments.ollCase : key === 'pll' ? segments.pllCase : null;
  return { caseLabel, htm, ms, tps: tps(ms, htm) };
}

/** Canonical comparison model consumed by Web and every installed client. */
export function buildTimerHistoryComparison(
  solveA: Solve,
  solveB: Solve,
): TimerHistoryComparison {
  const a = comparisonSide(solveA);
  const b = comparisonSide(solveB);
  const keys: readonly TimerHistoryCompareStageKey[] = ['cross', 'f2l', 'oll', 'pll'];
  return {
    a,
    b,
    stages: keys.map((key) => ({
      a: stageValue(a.stageSegments, key),
      b: stageValue(b.stageSegments, key),
      key,
    })),
  };
}
