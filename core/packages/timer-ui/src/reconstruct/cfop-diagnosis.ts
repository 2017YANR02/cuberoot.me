import { replayFingerprint } from '@cuberoot/shared/timer/replay-verified';
import type { Solve, SolveMove } from '@cuberoot/shared/timer/types';
import { OLL_NAME_BY_NUMBER } from '@cuberoot/shared/recon/alg-case-display';
import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { ReplayZbll } from './replay-zbll';
import { countHtm } from '@cuberoot/shared/timer/reconstruct/htm';
import type { Col } from './report-columns';

export type CfopReplayGoal = 'stepMs' | 'recognitionMs' | 'executionMs' | 'turns';
export type CfopFormulaTarget = { set: 'oll' | 'pll' | 'zbll'; caseName: string };
export type CfopFormulaFocus = 'recognition' | 'execution';

export function cfopFormulaTarget(set: 'oll' | 'pll', label: string | null | undefined, notationLabel?: string | null): CfopFormulaTarget | undefined {
  // The final notation identifies the case from the reconstructed playing frame.
  // A null label means the displayed notation has no confirmed case yet.
  if (notationLabel === null) return;
  if (notationLabel !== undefined) {
    if (set === 'pll') label = notationLabel.replace(/^E?PLL[- ]/, 'PLL ');
    else {
      const alias = notationLabel.replace(/^OLL[- ]/, '');
      const match = Object.entries(OLL_NAME_BY_NUMBER).find(([, name]) => name === alias);
      label = match ? `OLL ${match[0]}` : notationLabel;
    }
  }
  if (set === 'oll') {
    const number = /^OLL (\d{1,2})(?: \([^()\r\n]+\))?$/.exec(label ?? '')?.[1];
    if (number && +number >= 1 && +number <= 57) return { set, caseName: `OLL ${+number}` };
  } else {
    const name = /^PLL ([A-Za-z][A-Za-z]?[+-]?)$/.exec(label ?? '')?.[1];
    if (name) return { set, caseName: name };
  }
}

export interface CfopReplayRange {
  startMs: number;
  endMs: number;
  firstMoveIndex: number;
  endMoveIndex: number;
}

type CfopDiagnosisColumn = Pick<Col, 'key' | 'label' | 'stepMs' | 'recognitionMs' | 'executionMs'
  | 'cumulativeMs' | 'turns' | 'endIdx' | 'skipped' | 'refTurns' | 'refUserTurns'> & Partial<Pick<Col, 'refSolution' | 'caseFingerprint'>>;

export interface CfopReplayStage extends CfopReplayRange {
  column: CfopDiagnosisColumn;
  longestGap?: CfopReplayRange;
  training: 'cross' | 'f2l' | 'oll' | 'pll' | 'zbll';
  zbll?: ReplayZbll;
  finalAdjustmentOnly: boolean;
  formula?: CfopFormulaTarget;
}

export type CfopDataIssue = 'incomplete' | 'clock' | 'boundary' | 'after-timer' | 'shared-timestamp' | 'marked-incorrect';

interface CfopLimitedStage {
  label: string;
  issues: CfopDataIssue[];
  replay: CfopReplayRange | null;
}

export function buildCfopDiagnosis(
  columns: readonly CfopDiagnosisColumn[],
  moves: readonly SolveMove[],
  timeMs: number,
  solvedEndIndex: number | null,
  cases: { pllCase?: string | null; ollCase?: string | null } = {},
  reconOk?: boolean,
  notation?: readonly Pick<ReconTextLine, 'key' | 'label'>[] | null,
  zbll?: ReplayZbll,
) {
  if (zbll && zbll.disposition !== 'opportunity') {
    const oll = columns.find(c => c.key === 'oll' && !c.skipped);
    const pll = columns.find(c => c.key === 'pll' && !c.skipped);
    const last = pll ?? oll;
    if (oll && last && oll.recognitionMs != null && oll.stepMs != null && (!pll || pll.stepMs != null)) {
      const stepMs = oll.stepMs + (pll?.stepMs ?? 0);
      const turns = (alg: string) => countHtm(alg.split(/\s+/).map((m,ts) => ({m, ts})));
      columns = [...columns.filter(c => c.key !== 'oll' && c.key !== 'pll'), {
        ...oll, key:'zbll', label:zbll.disposition === 'executed' ? 'ZBLL' : 'LL', endIdx:last.endIdx,
        cumulativeMs:last.cumulativeMs, stepMs, executionMs:stepMs - oll.recognitionMs,
        turns:turns(zbll.original), refUserTurns:turns(zbll.original), refTurns:turns(zbll.reference), refSolution:zbll.reference,
      }];
    }
  }
  const stages: CfopReplayStage[] = [];
  const limited: CfopLimitedStage[] = [];
  const freePairs = columns.filter(column => column.skipped && column.key.startsWith('slot-')).length;
  const skipped = columns.filter(column => column.skipped && !column.key.startsWith('slot-')).map(column => column.label);
  const result = { stages, limited, freePairs, skipped };
  if (reconOk === false) return { ...result, issue: 'marked-incorrect' as const };
  if (!moves.length || solvedEndIndex !== moves.length - 1) {
    return { ...result, issue: 'incomplete' as const, freePairs: 0, skipped: [] };
  }
  // The player needs a monotonic clock. Without a verified finish or explicit
  // packet provenance we cannot localize a lost move from the final state alone.
  if (!Number.isFinite(timeMs) || timeMs <= 0 || moves.some(({ ts }, index) =>
    !Number.isFinite(ts) || ts < 0 || (index > 0 && moves[index - 1].ts > ts))) {
    return { ...result, issue: 'clock' as const };
  }
  let firstMoveIndex = 0;
  const activeColumns = columns.filter(column => !column.skipped);
  for (const [index, column] of activeColumns.entries()) {
    const { endIdx, cumulativeMs, stepMs, key, label } = column;
    // Two pairs can finish on the same move. The first column already owns
    // the shared interval; the second has no separate turns to replay.
    if (key.startsWith('slot-') && firstMoveIndex > 0 && endIdx === firstMoveIndex - 1
      && stepMs === 0 && cumulativeMs === moves[endIdx].ts) continue;

    if (endIdx === null || !Number.isInteger(endIdx) || endIdx < firstMoveIndex || endIdx >= moves.length) {
      // With no end index we do not know where the next stage begins.
      for (const rest of activeColumns.slice(index)) limited.push({ label: rest.label, issues: ['boundary'], replay: null });
      firstMoveIndex = moves.length;
      break;
    }

    const startIndex = Math.max(0, firstMoveIndex - 1);
    const startMs = moves[startIndex].ts;
    const endMs = moves[endIdx].ts;
    const sharesEnd = moves[endIdx + 1]?.ts === endMs;
    const sharesStart = firstMoveIndex > 0 && moves[firstMoveIndex].ts === startMs;
    const range = { startMs, endMs, firstMoveIndex, endMoveIndex: endIdx };
    const issues: CfopDataIssue[] = [];
    if (endMs > timeMs) issues.push('after-timer');
    // Recovered untimed moves and genuine batched timestamps look alike in
    // old logs. Withhold timing for the interval and any boundary it touches.
    const clockStart = Math.max(0, startIndex - 1);
    if (sharesEnd || moves.slice(clockStart, endIdx + 1)
      .some(({ ts }, offset) => offset > 0 && moves[clockStart + offset - 1].ts === ts)) {
      issues.push('shared-timestamp');
    }
    if (cumulativeMs === null || stepMs === null || !Number.isFinite(cumulativeMs) || !Number.isFinite(stepMs)
      || Math.abs(endMs - cumulativeMs) > 1 || Math.abs(endMs - startMs - stepMs) > 1) {
      issues.push('boundary');
    }
    if (issues.length) {
      limited.push({ label, issues, replay: endMs > startMs && !sharesStart && !sharesEnd && !issues.includes('boundary') ? range : null });
    } else if (endMs > startMs) {
      // If OLL and PLL finish together, the timing could include a combined
      // last-layer solution. Keep the stage, without assigning its time to an OLL case.
      const notationLabel = notation === undefined ? undefined : notation?.find(line => line.key === key)?.label ?? null;
      const formula = key === 'zbll' && zbll ? {set:'zbll' as const, caseName:zbll.caseName} : key === 'pll' ? cfopFormulaTarget('pll', cases.pllCase, notationLabel)
        : key === 'oll' && !skipped.includes('PLL') ? cfopFormulaTarget('oll', cases.ollCase, notationLabel) : undefined;
      // Both moves must belong to this stage. The incoming transition is scored separately.
      let longestGap: CfopReplayRange | undefined;
      for (let i = firstMoveIndex + 1; i <= endIdx; i++) {
        const start = moves[i - 1].ts;
        const end = moves[i].ts;
        if (!longestGap || end - start > longestGap.endMs - longestGap.startMs) {
          longestGap = {startMs: start, endMs: end, firstMoveIndex: i - 1, endMoveIndex: i};
        }
      }
      stages.push({
        ...range, column, longestGap, zbll: key === 'zbll' || (key === 'oll' && zbll?.disposition === 'opportunity') ? zbll : undefined,
        training: key === 'cross' || key === 'oll' || key === 'pll' || key === 'zbll' ? key : 'f2l',
        finalAdjustmentOnly: key === 'pll' && cases.pllCase === 'PLL skip' && column.turns === 1,
        formula,
      });
    }
    firstMoveIndex = endIdx + 1;
  }
  if (firstMoveIndex !== moves.length || (!stages.length && !limited.length)) {
    // The remaining turns cannot be assigned to a stage.
    if (!stages.length) return { ...result, issue: 'boundary' as const };
    limited.push({ label: 'CFOP', issues: ['boundary'], replay: null });
  }
  return { ...result, issue: null };
}

export type CfopDiagnosis = ReturnType<typeof buildCfopDiagnosis>;

export function selectCfopReplayStage(stages: readonly CfopReplayStage[], goal: CfopReplayGoal) {
  const ranked = stages.filter(stage => Number.isFinite(stage.column[goal]));
  const winner = ranked.reduce<CfopReplayStage | undefined>((best, stage) =>
    !best || stage.column[goal]! > best.column[goal]! ? stage : best, undefined);
  if (!winner || (goal === 'recognitionMs' && winner.column.recognitionMs === 0)) return null;
  return {
    stage: winner,
    tied: ranked.filter(stage => stage.column[goal] === winner.column[goal]).length > 1,
  };
}

export function cfopPracticeSolveId(solve: Solve) {
  return solve.id.startsWith('replay-') ? replayFingerprint({
    event: solve.event, scramble: solve.scramble, moves: solve.moves ?? [], totalMs: solve.timeMs,
  }) : solve.id;
}

export function cfopTrainingHref(training: CfopReplayStage['training']) {
  return training === 'cross' ? '/alg/3x3/cross' : `/alg/3x3/${training}/select`;
}
