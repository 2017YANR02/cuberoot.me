import type { SolveMove } from '@cuberoot/shared/timer/types';
import type { Col } from './report-columns';

export type CfopReplayGoal = 'stepMs' | 'recognitionMs' | 'executionMs' | 'turns';
export type CfopFormulaTarget = { set: 'oll' | 'pll'; caseName: string };
export type CfopFormulaFocus = 'recognition' | 'execution';

export function cfopFormulaTarget(set: 'oll' | 'pll', label: string | null | undefined): CfopFormulaTarget | undefined {
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
  | 'cumulativeMs' | 'turns' | 'endIdx' | 'skipped' | 'refTurns' | 'refUserTurns'>;

export interface CfopReplayStage extends CfopReplayRange {
  column: CfopDiagnosisColumn;
  training: 'cross' | 'f2l' | 'oll' | 'pll';
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
) {
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
      const formula = key === 'pll' ? cfopFormulaTarget('pll', cases.pllCase)
        : key === 'oll' && !skipped.includes('PLL') ? cfopFormulaTarget('oll', cases.ollCase) : undefined;
      stages.push({
        ...range, column,
        training: key === 'cross' || key === 'oll' || key === 'pll' ? key : 'f2l',
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

export function cfopTrainingHref(training: CfopReplayStage['training']) {
  return training === 'cross' ? '/alg/3x3/cross' : `/alg/3x3/${training}/select`;
}
