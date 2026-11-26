import { replayFingerprint } from '@cuberoot/shared/timer/replay-verified';
import type { Solve } from '@cuberoot/shared/timer/types';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { computeStepMetrics } from '@cuberoot/shared/timer/reconstruct/step-metrics';
import { computeF2lSlots, type F2lStart } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { detectSolveMethod } from '@cuberoot/shared/timer/reconstruct/method-walk';
import { buildCfopDiagnosis, type CfopDataIssue, type CfopFormulaTarget, type CfopReplayRange } from './cfop-diagnosis';
import { identifyReplayZbll, type ReplayZbll } from './replay-zbll';
import type { AlgFile } from '@cuberoot/shared/alg';
import { buildCfopColumns } from './report-columns';

export const CFOP_BASELINE_LIMIT = 24;
const MIN_BASELINE = 5;
const MIN_REVIEW = 3;
export const CFOP_BASELINE_MIN = MIN_BASELINE + MIN_REVIEW;

type Situation =
  | { stage: 'cross'; side: string; freePairs: number }
  | { stage: 'f2l'; start: Exclude<F2lStart, 'solved' | 'unknown'> }
  | { stage: 'oll' | 'pll' | 'zbll'; caseName: string };

type Signal = 'recognitionMs' | 'executionMs';
const SIGNALS: Signal[] = ['recognitionMs', 'executionMs'];

interface Observation {
  label: string;
  situation: Situation;
  recognitionMs: number | null;
  executionMs: number | null;
  replay: CfopStageReplay;
}

export type CfopHistoryIssue = CfopDataIssue | 'other-method' | 'no-comparable-stage';

export interface CfopStageReplay {
  solveId: string;
  target?: CfopFormulaTarget;
  pairFingerprint?: string;
  slot?: string;
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

export type CfopHistoryAnalysis = ReturnType<typeof analyzeCfopHistory>;

function eligibleSolve(solve: Solve) {
  return solve.event === '333' && Number.isFinite(solve.ts) && Math.abs(solve.ts) <= 8.64e15
    && solve.penalty !== 'DNF' && solve.penalty !== 'DNS'
    && Number.isFinite(solve.timeMs) && solve.timeMs > 0 && !!solve.moves?.length;
}

export function cfopBaselineCandidates(history: readonly Solve[], current: Solve) {
  if (current.event !== '333') return [];
  const seen = new Set<string>();
  return history.filter(solve => {
    if (seen.has(solve.id) || !eligibleSolve(solve)) return false;
    seen.add(solve.id);
    return true;
  }).sort((left, right) => right.ts - left.ts || right.id.localeCompare(left.id)).slice(0, CFOP_BASELINE_LIMIT);
}

function assessSolve(solve: Solve, segments = computeStageSegments(solve.scramble, solve.moves ?? [], solve.timeMs), zbll?: ReplayZbll): { observations: Observation[]; issues: CfopHistoryIssue[] } {
  if (solve.reconOk === false) return { observations: [], issues: ['marked-incorrect'] };
  const { scramble, timeMs } = solve;
  const moves = solve.moves ?? [];
  if (!segments || segments.solvedEndIdx !== moves.length - 1) return { observations: [], issues: ['incomplete'] };
  if (detectSolveMethod(scramble, moves.map(({ m }, ts) => ({ m, ts })), 0) !== 'cfop') {
    return { observations: [], issues: ['other-method'] };
  }
  const metrics = computeStepMetrics(scramble, moves, timeMs);
  const slots = computeF2lSlots(scramble, moves, timeMs, segments);
  const columns = buildCfopColumns(segments, metrics, slots, null, null, null);
  const diagnosis = buildCfopDiagnosis(columns, moves, timeMs, segments.solvedEndIdx, segments, solve.reconOk, undefined, zbll);
  if (diagnosis.issue) return { observations: [], issues: [diagnosis.issue] };

  const observations = diagnosis.stages.flatMap(({ column, training, formula, startMs, endMs, firstMoveIndex, endMoveIndex }) => {
    let situation: Situation | undefined;
    if (training === 'cross' && segments.crossSide && slots) {
      situation = { stage: 'cross', side: segments.crossSide, freePairs: slots.freeCount };
    } else if (training === 'f2l') {
      const slot = slots?.slots.find(pair => column.key === `slot-${pair.slot}`);
      if (slot && slot.start !== 'unknown' && slot.start !== 'solved') situation = { stage: 'f2l', start: slot.start };
    } else if (training === 'zbll' && zbll?.disposition === 'executed') {
      situation = {stage:'zbll',caseName:zbll.caseName};
    } else if (training === 'oll' && formula && segments.ollCase) {
      situation = { stage: 'oll', caseName: segments.ollCase };
    } else if (training === 'pll' && formula && segments.pllCase) {
      situation = { stage: 'pll', caseName: segments.pllCase };
    }
    return situation ? [{ label: column.label, situation, recognitionMs: column.recognitionMs, executionMs: column.executionMs,
      replay: { solveId: solve.id, target: formula, pairFingerprint: column.caseFingerprint, slot: training === 'f2l' ? column.key.slice(5) : undefined, range: { startMs, endMs, firstMoveIndex, endMoveIndex } },
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
  newerMaxima: Measurements;
};

export function analyzeCfopHistory(history: readonly Solve[], current: Solve, selectedIds: ReadonlySet<string>) {
  const selected = cfopBaselineCandidates(history, current).filter(solve => selectedIds.has(solve.id));
  const assessed = selected.slice().reverse().map(solve => assessSolve(solve));
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
  const comparisons: Array<{ situation: Situation; signal: Signal; baselineMs: number; thresholdMs: number; recentMs: number; baselineCount: number; recentCount: number; slowerCount: number; otherRecentCount: number; otherSlowerCount: number; repeated: boolean }> = [];
  const fingerprint = (solve: Solve) => replayFingerprint({event: solve.event, scramble: solve.scramble, totalMs: solve.timeMs, moves: solve.moves ?? []});
  const identity = fingerprint(current);
  const currentIndex = selected.findIndex(solve => solve.id === current.id || (solve.scramble === current.scramble && fingerprint(solve) === identity));
  const currentId = selected[currentIndex]?.id ?? current.id;
  const observations = currentIndex < 0 ? assessSolve(current).observations : assessed[selected.length - 1 - currentIndex].observations;
  const coverage = { comparisons, observations, selected: selected.length, usable: samples.length, partial,
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
        newerReplays: { recognitionMs: [], executionMs: [] }, newerMaxima: { recognitionMs: [], executionMs: [] },
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
          group.newerMaxima[signal].push(Math.max(...measured.map(sample => sample.value)));
        }
        side[signal].push(middle);
      }
      groups.set(key, group);
    }
  });

  const priorities: CfopTrainingPriority[] = [];
  let comparableGroups = 0;
  for (const { situation, older, newer, newerReplays, newerMaxima } of groups.values()) {
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
      const repeated = slower.length >= Math.max(MIN_REVIEW, Math.ceil(review.length / 2));
      const isOther = (index: number) => newerReplays[signal][index].solveId !== currentId;
      comparisons.push({ situation, signal, baselineMs, thresholdMs, recentMs: median(review), baselineCount: baseline.length,
        recentCount: review.length, slowerCount: slower.length, otherRecentCount: review.filter((_, index) => isOther(index)).length,
        otherSlowerCount: newerMaxima[signal].filter((max, index) => isOther(index) && max - baselineMs >= thresholdMs).length, repeated });
      if (!repeated) continue;
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

export interface F2lTransferHit {
  solveId: string;
  recordingKey: string;
  timeMs: number;
  ts: number;
  label: string;
  slot: string;
  recognitionMs: number;
  executionMs: number;
  range: CfopReplayRange;
}

export interface F2lTransferPeriod {
  reviewed: number;
  count: number;
  recognitionMs: number | null;
  executionMs: number | null;
  hits: F2lTransferHit[];
}

export interface F2lTransferComparison {
  before: F2lTransferPeriod;
  after: F2lTransferPeriod;
}

type TrainingWindow = {start:number; end:number; previousEnd?:number; nextStart?:number};
export type TrainingInterval = {start:number; end:number; caseKey:string};

function independentSolves(history:readonly Solve[], current:Solve) {
  const normalize=(value:string)=>value.trim().replace(/\s+/g,' ');
  const scrambles=new Set([normalize(current.scramble)]), ids=new Set([current.id]);
  return history.filter(s=>eligibleSolve(s) && s.scramble && s.reconOk!==false
    && !s.caseId && !s.trainingStartMode && !s.pllChain && s.scrambleSource?.kind!=='manual'
    && (!s.device || !current.device || s.device.model===current.device.model))
    .sort((a,b)=>a.ts-b.ts).filter(s=>{
      const scramble=normalize(s.scramble);
      if(scrambles.has(scramble) || ids.has(s.id))return false;
      scrambles.add(scramble);ids.add(s.id);return true;
    });
}

/** A new training round starts when an independent solve fits between two linked drills. */
export function trainingRounds(history:readonly Solve[], current:Solve, attempts:TrainingInterval[]) {
  const solves=independentSolves(history,current);
  const rounds:(TrainingWindow & {cases:Set<string>})[]=[];
  let i=0;
  for(const attempt of [...attempts].sort((a,b)=>a.start-b.start)){
    const previous=rounds.at(-1);
    let between=false;
    while(i<solves.length && solves[i].ts<attempt.start){
      const s=solves[i++];
      if(previous && s.ts-s.timeMs>previous.end)between=true;
    }
    if(!previous || between){
      if(previous)previous.nextStart=attempt.start;
      rounds.push({start:attempt.start,end:attempt.end,previousEnd:previous?.end,cases:new Set([attempt.caseKey])});
    }else{
      previous.end=Math.max(previous.end,attempt.end);
      previous.cases.add(attempt.caseKey);
    }
  }
  return rounds;
}

function summarizeHits(hits: F2lTransferHit[], reviewed: number): F2lTransferPeriod {
  const bySolve = new Map<string, F2lTransferHit[]>();
  for (const hit of hits) {
    const group = bySolve.get(hit.solveId) ?? [];
    group.push(hit);
    bySolve.set(hit.solveId, group);
  }
  const middle = (signal: Signal) => bySolve.size
    ? median([...bySolve.values()].map(group => median(group.map(hit => hit[signal])))) : null;
  return { reviewed, count: bySolve.size, recognitionMs: middle('recognitionMs'), executionMs: middle('executionMs'), hits };
}

/** Assess each independent scramble once across all cases. A solve spanning training belongs to neither period. */
export async function compareF2lTraining(history: readonly Solve[], current: Solve,
  targets: { fingerprints: ReadonlySet<string>; window: TrainingWindow }[]): Promise<F2lTransferComparison[]> {
  const reviewed = targets.map(() => ({before: 0, after: 0}));
  const periods = targets.map(() => ({ before: [] as F2lTransferHit[], after: [] as F2lTransferHit[] }));
  if (targets.length && current.event === '333') {
    let lastYield = performance.now();
    for (const solve of independentSolves(history,current)) {
      const periodsForSolve = targets.map(({window}) => solve.ts < window.start && solve.ts-solve.timeMs > (window.previousEnd ?? -Infinity) ? 'before'
        : solve.ts - solve.timeMs > window.end && solve.ts < (window.nextStart ?? Infinity) ? 'after' : null);
      if (!periodsForSolve.some(Boolean)) continue;
      if (performance.now() - lastYield > 16) {
        await new Promise(resolve => setTimeout(resolve, 0));
        lastYield = performance.now();
      }
      periodsForSolve.forEach((period, i) => { if (period) reviewed[i][period]++; });
      const { observations } = assessSolve(solve);
      for (const {label, replay, recognitionMs, executionMs} of observations) {
        if (!replay.slot || !replay.pairFingerprint || recognitionMs == null || executionMs == null) continue;
        const hit = { solveId: solve.id, timeMs: solve.timeMs, ts: solve.ts, label, slot: replay.slot,
          recognitionMs, executionMs, range: replay.range };
        targets.forEach(({fingerprints}, i) => {
          const period = periodsForSolve[i];
          if (period && fingerprints.has(replay.pairFingerprint!)) periods[i][period].push({...hit,
            recordingKey: replayFingerprint({event: solve.event, scramble: solve.scramble, totalMs: solve.timeMs, moves: solve.moves!})});
        });
      }
    }
  }
  return periods.map(({before, after}, i) => ({before: summarizeHits(before, reviewed[i].before), after: summarizeHits(after, reviewed[i].after)}));
}

export interface TransferTarget {
  since:number;
  fingerprints?: ReadonlySet<string>;
  formula?: CfopFormulaTarget;
  signal:Signal;
}

/** One vote per independent full solve, even if a matching pair occurs several times. */
export async function practiceTransfer(history:readonly Solve[], current:Solve, targets:TransferTarget[], load:(set:string)=>Promise<AlgFile>) {
  const values = targets.map(() => [] as number[]);
  const opportunities = targets.map(() => 0);
  const eligible = history.filter(s => s.id!==current.id && s.scramble.trim()!==current.scramble.trim()
    && !s.caseId && !s.trainingStartMode && !s.pllChain && s.reconOk!==false && s.scrambleSource?.kind!=='manual'
    && (!s.device || !current.device || s.device.model===current.device.model));
  const seen = new Set<string>();
  for (const solve of cfopBaselineCandidates(eligible,current)) {
    const active = targets.map(target=>solve.ts - solve.timeMs > target.since);
    if (!active.some(Boolean) || seen.has(solve.scramble.trim())) continue;
    const moves = solve.moves!;
    const segs = computeStageSegments(solve.scramble,moves,solve.timeMs);
    if (!segs || segs.solvedEndIdx!==moves.length-1) continue;
    const needZbll = targets.some((t,i)=>active[i] && t.formula != null);
    const zbll = needZbll ? await identifyReplayZbll({scramble:solve.scramble,moves,segs},load) : undefined;
    const {observations} = assessSolve(solve,segs,zbll);
    if (!observations.length) continue;
    seen.add(solve.scramble.trim());
    targets.forEach((target,i)=>{
      if (!active[i]) return;
      if (target.formula?.set==='zbll' && zbll?.caseName===target.formula.caseName) opportunities[i]++;
      const times = observations.flatMap(row=>{
        const formula = row.replay.target, fp = row.replay.pairFingerprint;
        const matches = (fp && target.fingerprints?.has(fp)) || (formula && target.formula?.set === formula.set && target.formula.caseName===formula.caseName);
        const ms = row[target.signal];
        return matches && ms!=null && Number.isFinite(ms) ? [ms] : [];
      });
      if (times.length) values[i].push(median(times));
    });
  }
  return values.map((times,i)=>({count:times.length, medianMs:times.length ? median(times) : null,
    opportunities:targets[i].formula?.set==='zbll' ? opportunities[i] : undefined}));
}
