import type { Solve } from '@cuberoot/shared/timer/types';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { computeStepMetrics } from '@cuberoot/shared/timer/reconstruct/step-metrics';
import { computeF2lSlots, type F2lStart } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { detectSolveMethod } from '@cuberoot/shared/timer/reconstruct/method-walk';
import { buildCfopDiagnosis, type CfopDataIssue, type CfopFormulaTarget, type CfopReplayRange } from './cfop-diagnosis';
import { buildCfopColumns } from './report-columns';

export const CFOP_BASELINE_LIMIT = 24;
const MIN_BASELINE = 5;
const MIN_REVIEW = 3;
export const CFOP_BASELINE_MIN = MIN_BASELINE + MIN_REVIEW;

type Situation =
  | { stage: 'cross'; side: string; freePairs: number }
  | { stage: 'f2l'; start: Exclude<F2lStart, 'solved' | 'unknown'> }
  | { stage: 'oll' | 'pll'; caseName: string };

type Signal = 'recognitionMs' | 'executionMs';
const SIGNALS: Signal[] = ['recognitionMs', 'executionMs'];

interface Observation {
  situation: Situation;
  recognitionMs: number | null;
  executionMs: number | null;
  replay: CfopStageReplay;
}

export type CfopHistoryIssue = CfopDataIssue | 'other-method' | 'no-comparable-stage';

export interface CfopStageReplay {
  solveId: string;
  target?: CfopFormulaTarget;
  range: CfopReplayRange;
}

export interface CfopTrainingPriority {
  situation: Situation;
  signal: Signal;
  baselineMs: number;
  recentMs: number;
  thresholdMs: number;
  baselineCount: number;
  recentCount: number;
  slowerCount: number;
  excessPerSolveMs: number;
  replay?: CfopStageReplay;
}

export function cfopBaselineCandidates(history: readonly Solve[], current: Solve) {
  // Older imports may lack device provenance. Two unknown clocks do not match.
  if (!current.device?.model || !current.device.name) return [];
  const seen = new Set<string>();
  return history.filter(solve => {
    if (seen.has(solve.id) || solve.event !== '333' || !Number.isFinite(solve.ts) || Math.abs(solve.ts) > 8.64e15
      || solve.penalty === 'DNF' || solve.penalty === 'DNS'
      || !Number.isFinite(solve.timeMs) || solve.timeMs <= 0 || !solve.moves?.length
      || solve.device?.model !== current.device?.model || solve.device?.name !== current.device?.name) return false;
    seen.add(solve.id);
    return true;
  }).sort((left, right) => right.ts - left.ts || right.id.localeCompare(left.id)).slice(0, CFOP_BASELINE_LIMIT);
}

function assessSolve(solve: Solve): { observations: Observation[]; issues: CfopHistoryIssue[] } {
  if (solve.reconOk === false) return { observations: [], issues: ['marked-incorrect'] };
  const { scramble, timeMs } = solve;
  const moves = solve.moves ?? [];
  const segments = computeStageSegments(scramble, moves, timeMs);
  if (!segments || segments.solvedEndIdx !== moves.length - 1) return { observations: [], issues: ['incomplete'] };
  if (detectSolveMethod(scramble, moves.map(({ m }, ts) => ({ m, ts })), 0) !== 'cfop') {
    return { observations: [], issues: ['other-method'] };
  }
  const metrics = computeStepMetrics(scramble, moves, timeMs);
  const slots = computeF2lSlots(scramble, moves, timeMs, segments);
  const columns = buildCfopColumns(segments, metrics, slots, null, null, null);
  const diagnosis = buildCfopDiagnosis(columns, moves, timeMs, segments.solvedEndIdx, segments);
  if (diagnosis.issue) return { observations: [], issues: [diagnosis.issue] };

  const observations = diagnosis.stages.flatMap(({ column, training, formula, startMs, endMs, firstMoveIndex, endMoveIndex }) => {
    let situation: Situation | undefined;
    if (training === 'cross' && segments.crossSide && slots) {
      situation = { stage: 'cross', side: segments.crossSide, freePairs: slots.freeCount };
    } else if (training === 'f2l') {
      const slot = slots?.slots.find(pair => column.key === `slot-${pair.slot}`);
      if (slot && slot.start !== 'unknown' && slot.start !== 'solved') situation = { stage: 'f2l', start: slot.start };
    } else if (training === 'oll' && formula && segments.ollCase) {
      situation = { stage: 'oll', caseName: segments.ollCase };
    } else if (training === 'pll' && formula && segments.pllCase) {
      situation = { stage: 'pll', caseName: segments.pllCase };
    }
    return situation ? [{ situation, recognitionMs: column.recognitionMs, executionMs: column.executionMs,
      replay: { solveId: solve.id, target: formula, range: { startMs, endMs, firstMoveIndex, endMoveIndex } },
    }] : [];
  });
  const issues = [...new Set<CfopHistoryIssue>(diagnosis.limited.flatMap(stage => stage.issues))];
  if (!observations.length && !issues.length) issues.push('no-comparable-stage');
  return { observations, issues };
}

function median(values: number[]) {
  const sorted = values.slice().sort((left, right) => left - right);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
}

type Measurements = Record<Signal, number[]>;
type Group = {
  situation: Situation;
  older: Measurements;
  newer: Measurements;
  newerReplays: Record<Signal, CfopStageReplay[]>;
};

export function analyzeCfopHistory(history: readonly Solve[], current: Solve, selectedIds: ReadonlySet<string>) {
  const selected = cfopBaselineCandidates(history, current).filter(solve => selectedIds.has(solve.id));
  const assessed = selected.slice().reverse().map(assessSolve);
  const samples = assessed.filter(sample => sample.observations.length > 0).map(sample => sample.observations);
  const issueCounts: Partial<Record<CfopHistoryIssue, { partial: number; excluded: number }>> = {};
  let partial = 0;
  for (const { observations, issues } of assessed) {
    const usable = observations.length > 0;
    if (usable && issues.length) partial++;
    for (const issue of issues) {
      const count = issueCounts[issue] ??= { partial: 0, excluded: 0 };
      if (usable) count.partial++;
      else count.excluded++;
    }
  }
  const coverage = { selected: selected.length, usable: samples.length, partial,
    excluded: selected.length - samples.length, issueCounts };
  const baselineCount = Math.max(MIN_BASELINE, Math.ceil(samples.length / 2));
  const recentCount = samples.length - baselineCount;
  if (recentCount < MIN_REVIEW) {
    return { ...coverage, baselineCount: 0, recentCount: 0, comparableGroups: 0, priorities: [] as CfopTrainingPriority[] };
  }

  const groups = new Map<string, Group>();
  samples.forEach((observations, index) => {
    // Multiple pairs of the same type in one solve contribute one median
    // per signal, so a slow solve cannot count as multiple recurrences.
    const withinSolve = new Map<string, Observation[]>();
    for (const observation of observations) {
      const key = JSON.stringify(observation.situation);
      const sameSituation = withinSolve.get(key) ?? [];
      sameSituation.push(observation);
      withinSolve.set(key, sameSituation);
    }
    for (const [key, sameSituation] of withinSolve) {
      const group: Group = groups.get(key) ?? { situation: sameSituation[0].situation,
        older: { recognitionMs: [], executionMs: [] }, newer: { recognitionMs: [], executionMs: [] },
        newerReplays: { recognitionMs: [], executionMs: [] },
      };
      const side = index < baselineCount ? group.older : group.newer;
      for (const signal of SIGNALS) {
        const measured = sameSituation.flatMap(observation => {
          const value = observation[signal];
          return value !== null && Number.isFinite(value) && value >= 0 ? [{ value, replay: observation.replay }] : [];
        });
        if (!measured.length) continue;
        const middle = median(measured.map(sample => sample.value));
        if (side === group.newer) {
          // When several pairs share the same layout, replay the pair closest to this solve's median.
          const example = measured.reduce((best, sample) =>
            Math.abs(sample.value - middle) < Math.abs(best.value - middle) ? sample : best);
          group.newerReplays[signal].push(example.replay);
        }
        side[signal].push(middle);
      }
      groups.set(key, group);
    }
  });

  const priorities: CfopTrainingPriority[] = [];
  let comparableGroups = 0;
  for (const { situation, older, newer, newerReplays } of groups.values()) {
    let best: CfopTrainingPriority | undefined;
    let comparable = false;
    for (const signal of SIGNALS) {
      const baseline = older[signal];
      const review = newer[signal];
      if (baseline.length < MIN_BASELINE || review.length < MIN_REVIEW) continue;
      comparable = true;
      const baselineMs = median(baseline);
      const spread = median(baseline.map(value => Math.abs(value - baselineMs)));
      const thresholdMs = Math.ceil(Math.max(150, baselineMs * 0.20, spread * 2));
      const slower = review.flatMap((value, index) => value - baselineMs >= thresholdMs ? [{ value, index }] : []);
      if (slower.length < Math.max(MIN_REVIEW, Math.ceil(review.length / 2))) continue;
      const excessPerSolveMs = slower.reduce((sum, sample) => sum + sample.value - baselineMs, 0) / recentCount;
      const latestSlowSample = slower[slower.length - 1];
      const candidate = { situation, signal, baselineMs, recentMs: median(review), thresholdMs,
        baselineCount: baseline.length, recentCount: review.length, slowerCount: slower.length, excessPerSolveMs,
        replay: newerReplays[signal][latestSlowSample.index],
      };
      if (!best || candidate.excessPerSolveMs > best.excessPerSolveMs) best = candidate;
    }
    if (comparable) comparableGroups++;
    if (best) priorities.push(best);
  }
  priorities.sort((a, b) => b.excessPerSolveMs - a.excessPerSolveMs || b.slowerCount - a.slowerCount);
  return { ...coverage, baselineCount, recentCount, comparableGroups, priorities };
}
