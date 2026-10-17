import { describe, expect, it } from 'vitest';
import type { Solve } from '@cuberoot/shared/timer';
import { trainingRepetitionMetrics, trainingCaseHistory, trainingCaseStatistics } from '@cuberoot/timer-ui/reconstruct/report-presentation';
import { initialReportUI, reportComposition, reportTrainingSummary, resolveReportSlots } from '@cuberoot/timer-ui/reconstruct/report-content';

const solve: Solve = { id: 'current', event: 'pll', caseId: 'T', scramble: '', ts: 100, timeMs: 2_100,
  penalty: 'ok', trainingStartMode: 'scrambled', moves: [{ m: 'U', ts: 500 }, { m: 'R', ts: 800 }, { m: 'U', ts: 1_000 }, { m: "R'", ts: 2_100 }] };
const tr = <T>(copy: { en: T; zh: T }) => copy.en;

describe('training observation and execution', () => {
  it('shares the AUF boundary, includes waiting and partitions total exactly', () => {
    expect(trainingRepetitionMetrics(solve, solve.moves!)).toEqual({ observationMs: 800, executionMs: 1_300, totalMs: 2_100 });
    const firstTurn = { ...solve, timeMs: 1_600, trainingStartMode: 'first-turn' as const };
    const moves = solve.moves!.map(move => ({ ...move, ts: move.ts - 500 }));
    expect(trainingRepetitionMetrics(firstTurn, moves)).toEqual({ observationMs: 300, executionMs: 1_300, totalMs: 1_600 });
    expect(trainingRepetitionMetrics({ ...firstTurn, timeMs: 1_300 }, [{ m: 'R', ts: 0 }, { m: 'U', ts: 1_300 }])?.observationMs).toBe(0);
    // Same fallback as the stage analysis: an AUF-only solve begins execution on its first turn.
    expect(trainingRepetitionMetrics(solve, [{ m: 'U', ts: 500 }, { m: 'U', ts: 2_100 }])?.observationMs).toBe(500);
  });
  it('compares only prior successful attempts of the same case, event and start mode', () => {
    const prior = { ...solve, id: 'prior', ts: 50 };
    const records = [solve, prior, { ...prior, id: 'other-case', caseId: 'J' },
      { ...prior, id: 'other-mode', trainingStartMode: 'manual' as const },
      { ...prior, id: 'dnf', penalty: 'DNF' as const }, { ...prior, id: 'future', ts: 200 },
      { ...prior, id: 'other-event', event: 'oll' as const }];
    expect(trainingCaseHistory(records, solve).map(item => item.id)).toEqual(['prior']);
    expect(trainingCaseHistory(records, { ...solve, caseId: undefined })).toEqual([]);
    expect(trainingCaseHistory([{ ...prior, trainingStartMode: undefined }], { ...solve, trainingStartMode: 'first-turn' }).length).toBe(1);
    expect(trainingCaseStatistics([{ observationMs: 200, executionMs: 1_000, totalMs: 1_200 },
      { observationMs: 400, executionMs: 1_400, totalMs: 1_800 }])).toEqual({ count: 2, observationMs: 300,
      executionMs: 1_200, totalMs: 1_500, bestExecutionMs: 1_000 });
  });
  it('puts training metrics first and keeps the complete report behind one disclosure', () => {
    const report = reportComposition({ solve, recon: null, analysis: null, hasAnalysis: false, scoreable: false,
      state: initialReportUI(), tr, hasTable: true, hasMeta: false, autoMemoMs: null, hasBldMemo: false, trainingSummary: true });
    expect(report.children!.map(node => node.id)).toEqual(['training-summary', 'actions', 'training-details']);
    const metrics = trainingRepetitionMetrics(solve, solve.moves!)!;
    const document = resolveReportSlots(report, { 'training-summary': reportTrainingSummary(solve, metrics, null, tr) })!;
    expect(document.children!.at(-1)!.children).toEqual([]);
    expect(JSON.stringify(document)).toContain('Observation');
    expect(JSON.stringify(document)).toContain('Execution');
  });
});
