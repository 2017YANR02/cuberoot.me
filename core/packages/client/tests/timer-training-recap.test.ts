// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { correctReconFromLibrary } from '@cuberoot/shared/timer/reconstruct/library-correction';
import { reconCommentCaseIndex } from '@cuberoot/shared/recon/comment-links';
import * as algLibrary from '@cuberoot/shared/alg';
import type { AlgFile } from '@cuberoot/shared/alg';
import type { Solve } from '@cuberoot/shared/timer';
import { prepareTrainingReconstruction, trainingSolveMetrics } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { notationQuaternion } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { reconstructionTimeline, timelineExecutionAt, timelineTooltipOffset } from '@cuberoot/timer-ui/reconstruct/timeline-model';
import { reconstructedTrack } from '@cuberoot/timer-ui/reconstruct/playback-track';
import ReconstructReport from '@cuberoot/timer-ui/reconstruct-report';
import { detectSolveMethod } from '@cuberoot/shared/timer/reconstruct/method-walk';
import { trainingRepetitionMetrics, trainingCaseHistory, trainingCaseStatistics } from '@cuberoot/timer-ui/reconstruct/report-presentation';
import { initialReportUI, reportComposition, reportTrainingSummary, resolveReportSlots } from '@cuberoot/timer-ui/reconstruct/report-content';
import { reportNotation } from '@cuberoot/timer-ui/reconstruct/report-notation';

const solve: Solve = { id: 'current', event: 'pll', caseId: 'T', scramble: '', ts: 100, timeMs: 2_100,
  penalty: 'ok', trainingStartMode: 'scrambled', moves: [{ m: 'U', ts: 500 }, { m: 'R', ts: 800 }, { m: 'U', ts: 1_000 }, { m: "R'", ts: 2_100 }] };
const tr = <T>(copy: { en: T; zh: T }) => copy.en;
it('keeps the timeline formula within the viewport while preserving centered placement when it fits', () => {
  expect(timelineTooltipOffset(100, 300, 400)).toBe(0);
  expect(timelineTooltipOffset(250, 430, 400)).toBe(-38);
  expect(timelineTooltipOffset(-20, 160, 400)).toBe(28);
});
vi.mock('@cuberoot/shared/timer/reconstruct/method-walk', async original => ({
  ...await original<typeof import('@cuberoot/shared/timer/reconstruct/method-walk')>(),
  detectSolveMethod: vi.fn(() => { throw new Error('Training must never classify a full solve'); }),
}));
vi.mock('@cuberoot/timer-ui/SimCubeView', () => ({ default: () => null }));
const algorithm = "U R U R' U' R' F R2 U' R' U' R U R' F'";
const repetition: Solve = { ...solve, scramble: invertAlg(algorithm), timeMs: 2_100,
  moves: algorithm.split(' ').map((m, i) => ({ m, ts: 500 + i * 100 })) };

describe('training observation and execution', () => {
  it.each(['', 'z2'])('splits CFZB at completed ZBLS in grip %s and shares metrics with notation', async grip => {
    const alg = "R U R' U R U R' U R U2 R' U";
    const times = [500, 600, 700, 1000, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200];
    const record: Solve = { ...solve, event: 'cfzb', caseId: undefined,
      scramble: normalizeWcaScramble(`${grip} ${invertAlg(alg)}`)!, timeMs: 2200,
      moves: alg.split(' ').map((m, i) => ({ m: normalizeWcaScramble(`${grip} ${m}`)!, ts: times[i] })) };
    const prepared = prepareTrainingReconstruction(record, 'en');
    expect(prepared.recon.lines.map(line => line.label)).toEqual(['ZBLS', 'ZBLL']);
    expect(prepared.recon.lines.map(line => [line.fromIdx, line.toIdx])).toEqual([[0, 2], [3, 11]]);
    expect(prepared.stages.map(stage => [stage.observationMs, stage.executionMs, stage.turns])).toEqual([[500, 200, 3], [800, 700, 9]]);
    expect(prepared.stages[0].tps).toBe(15);
    expect(prepared.stages[1].tps).toBe(9 / 0.7);
    expect(prepared.metrics).toEqual({ observationMs: 1300, executionMs: 900, totalMs: 2200 });
    expect(trainingSolveMetrics(record)).toEqual(prepared.metrics);
    const files = new Map<string, AlgFile>([
      ['zbls', { cases: [{ id: 1, name: 'A1', algs: [[{ alg: "R U R'" }]] }] } as AlgFile],
      ['zbll', { cases: [{ id: 2, name: 'S1', algs: [[{ alg: "R U R' U R U2 R'" }]] }] } as AlgFile],
    ]);
    const matched = await correctReconFromLibrary(prepared.recon, async set => files.get(set)!);
    expect(matched.lines.map(line => line.label)).toEqual(['ZBLS-A1', 'ZBLL-S1']);
    expect(matched.lines.map(line => line.libraryCorrection?.algorithm)).toEqual(["R U R'", "R U R' U R U2 R'"]);
    expect(prepared.recon.lines.map(line => line.label)).toEqual(['ZBLS', 'ZBLL']);
    expect(matched.lines.map(line => [line.fromIdx, line.toIdx, line.recognitionMs, line.executionMs]))
      .toEqual(prepared.recon.lines.map(line => [line.fromIdx, line.toIdx, line.recognitionMs, line.executionMs]));
    const cases = new Map([...files].map(([set, file]) => [set, reconCommentCaseIndex(set, file.cases)]));
    const notation = reportNotation(matched, 'training', initialReportUI(), tr, { cases }).node!;
    const rows = notation.children!.flatMap(group => group.children ?? []).filter(row => row.notation?.links.length);
    expect(rows.map(row => row.notation!.links[0].href)).toEqual(['/alg/3x3/zbls/a1', '/alg/3x3/zbll/s1']);
    expect(rows.every(row => row.notation!.diagramId?.startsWith('diagram:'))).toBe(true);
    const matchedTrack = reconstructedTrack(matched.lines, record.moves!)!;
    expect(smartCubeTargetFacelets(record.scramble + ' ' + matched.inspection + ' ' + matchedTrack.map(move => move.m).join(' ')))
      .toBe(smartCubeTargetFacelets(''));
    const summary = reportTrainingSummary(record, prepared.metrics, null, tr, prepared.stages);
    const table = summary.children!.find(node => node.id === 'training-stages')!;
    expect(table.columns!.map(column => column.text)).toEqual(['Observation', 'Execution', 'Moves', 'TPS']);
    expect(table.rows!.map(row => row.label)).toEqual(['ZBLS', 'ZBLL']);
    const track = reconstructedTrack(prepared.recon.lines, record.moves!)!;
    expect(smartCubeTargetFacelets(record.scramble + ' ' + prepared.recon.inspection + ' ' + track.map(move => move.m).join(' ')))
      .toBe(smartCubeTargetFacelets(''));
    const partial = prepareTrainingReconstruction({ ...record, moves: record.moves!.slice(0, 2), timeMs: 900 }, 'en', undefined, true);
    expect(partial.metrics.observationMs + partial.metrics.executionMs).toBe(900);
    expect(partial.stages[1].executionMs).toBe(0);
    expect(partial.stages[1].observationMs).toBe(0);
    expect(partial.recon.currentStage?.key).toBe('zbls');
  });

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
  it('shows training metrics and playback directly, without a full-solve table', () => {
    const report = reportComposition({ solve, recon: null, analysis: null, hasAnalysis: false, scoreable: false,
      state: initialReportUI(), tr, hasTable: true, hasMeta: false, autoMemoMs: null, hasBldMemo: false, trainingSummary: true });
    expect(report.children!.map(node => node.id)).toEqual(['training-summary', 'actions', 'playback', 'raw']);
    const metrics = trainingRepetitionMetrics(solve, solve.moves!)!;
    const document = resolveReportSlots(report, { 'training-summary': reportTrainingSummary(solve, metrics, null, tr) })!;
    expect(document.children!.at(-1)!.children).toEqual([]);
    expect(JSON.stringify(document)).toContain('Observation');
    expect(JSON.stringify(document)).toContain('Execution');
  });

  it('shares exact observation/execution boundaries with notation and playback', () => {
    const { type, recon, metrics } = prepareTrainingReconstruction(repetition, 'en');
    expect(type).toBe('training');
    expect(trainingSolveMetrics(repetition)).toEqual(metrics);
    expect(metrics).toEqual({ observationMs: 600, executionMs: 1_500, totalMs: 2_100 });
    expect(recon.lines.map(line => [line.key, line.fromIdx, line.toIdx, line.fromMs, line.toMs])).toEqual([
      ['observation', 0, 0, 0, 600], ['training', 1, 14, 600, 2_100],
    ]);
    const timeline = reconstructionTimeline(recon.lines, repetition.moves!, 'training', tr);
    expect(timeline.stages.map(stage => [stage.label, stage.fromMs, stage.toMs])).toEqual([
      ['Observation', 0, 600], ['PLL', 600, 2_100],
    ]);
    expect(timeline.segs.map(segment => [segment.label, segment.moves])).toEqual(
      recon.lines.map(line => [line.label ?? line.key, line.moves.join(' ')]),
    );
    expect(timelineExecutionAt(timeline.segs, 300)).toBeUndefined();
    expect(timelineExecutionAt(timeline.segs, 900)?.moves).toBe(recon.lines[1].moves.join(' '));
    const track = reconstructedTrack(recon.lines, repetition.moves!)!;
    expect(track).not.toBeNull();
    expect(smartCubeTargetFacelets(`${repetition.scramble} ${recon.inspection} ${track.map(move => move.m).join(' ')}`))
      .toBe(smartCubeTargetFacelets(''));
  });

  it('retains zero-move observation, initial waiting, AUF-only fallback and live observation', () => {
    const withoutAuf = { ...repetition, scramble: invertAlg(algorithm.slice(2)),
      moves: repetition.moves!.slice(1).map(move => ({ ...move, ts: move.ts - 600 })), timeMs: 1_300 };
    const instant = prepareTrainingReconstruction(withoutAuf, 'en');
    expect(instant.metrics.observationMs).toBe(0);
    expect(instant.recon.lines[0].moves).toEqual([]);
    expect(instant.recon.lines[0].toIdx).toBe(-1);
    const delayed = prepareTrainingReconstruction({ ...withoutAuf, timeMs: 2_300,
      moves: withoutAuf.moves.map(move => ({ ...move, ts: move.ts + 1_000 })) }, 'en');
    expect(delayed.metrics.observationMs).toBe(1_000);
    expect(delayed.recon.lines[0].toMs).toBe(1_000);
    const aufOnly = { ...solve, scramble: "U'", moves: [{ m: 'U', ts: 500 }], timeMs: 500 };
    expect(prepareTrainingReconstruction(aufOnly, 'en').metrics).toEqual({ observationMs: 500, executionMs: 0, totalMs: 500 });
    const live = prepareTrainingReconstruction({ ...aufOnly, timeMs: 800 }, 'en', undefined, true);
    expect(live.metrics.observationMs).toBe(800);
    expect(live.recon.currentStage?.key).toBe('observation');
  });

  it('recognizes leading AUF in the training grip, including physical D turns', () => {
    const physical = { ...repetition, scramble: normalizeWcaScramble(`z2 ${repetition.scramble}`)!,
      moves: repetition.moves!.map(move => ({ ...move, m: normalizeWcaScramble(`z2 ${move.m}`)! })) };
    const prepared = prepareTrainingReconstruction(physical, 'en');
    expect(prepared.metrics.observationMs).toBe(600);
    expect(trainingSolveMetrics(physical)).toEqual(prepared.metrics);
    expect(prepared.recon.lines[0].moves).toEqual(['U']);
    const track = reconstructedTrack(prepared.recon.lines, physical.moves!)!;
    expect(smartCubeTargetFacelets(`${physical.scramble} ${prepared.recon.inspection} ${track.map(move => move.m).join(' ')}`))
      .toBe(smartCubeTargetFacelets(''));
  });

  it.each([true, false])('keeps initial yellow-up grip out of observed actions (leading AUF: %s)', leadingAuf => {
    const moves = leadingAuf ? repetition.moves! : repetition.moves!.slice(1);
    const physical = { ...repetition,
      scramble: normalizeWcaScramble(`z2 ${invertAlg(moves.map(move => move.m).join(' '))}`)!,
      moves: moves.map(move => ({ ...move, m: normalizeWcaScramble(`z2 ${move.m}`)! })),
    };
    const { recon } = prepareTrainingReconstruction(physical, 'en', [
      { tMs: 0, q: notationQuaternion('z2'), frame: 'scramble' },
    ]);
    expect(recon.inspection).toBe('z2');
    const report = reportNotation(recon, 'training', initialReportUI(), tr);
    const observation = report.node!.children!.find(node => node.stage === 'inspection')!;
    expect(JSON.stringify(observation)).not.toContain('z2');
    expect(recon.lines[0].moves).toEqual(leadingAuf ? ['U'] : []);
    // The setup is still required for a lossless exported reconstruction and replay.
    expect(report.clipboard).toContain('z2 // insp');
    const track = reconstructedTrack(recon.lines, physical.moves)!;
    expect(smartCubeTargetFacelets(`${physical.scramble} ${recon.inspection} ${track.map(move => move.m).join(' ')}`))
      .toBe(smartCubeTargetFacelets(''));
  });

  it('publishes matched CFZB case links and enables the shared diagram provider', async () => {
    const load = vi.spyOn(algLibrary, 'loadAlg').mockImplementation(async (_puzzle, set) => ({ cases: [
      { id: set === 'zbls' ? 1 : 2, name: set === 'zbls' ? 'A1' : 'S1',
        algs: [[{ alg: set === 'zbls' ? "R U R'" : "R U R' U R U2 R'" }]] },
    ] }) as AlgFile);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const algorithm = "R U R' U R U R' U R U2 R' U";
    const record: Solve = { ...solve, event: 'cfzb', caseId: undefined, scramble: invertAlg(algorithm),
      moves: algorithm.split(' ').map((m, i) => ({ m, ts: 100 + i * 100 })) };
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(ReconstructReport, { solve: record, isZh: false,
        host: { localize: tr, writeClipboardText: async () => {}, replayUrl: () => '', recordGyro: false,
          LineDiagramProvider: ({ enabled, text, children }) => createElement('div', { 'data-library-enabled': enabled },
            children(index => createElement('span', { 'data-stage-diagram': index, 'data-source': text }), () => undefined)),
        },
      })));
      await vi.waitFor(async () => {
        await act(async () => {});
        expect(container.querySelector('a[href="/alg/3x3/zbls/a1"]')?.textContent).toBe('ZBLS-A1');
        expect(container.querySelector('a[href="/alg/3x3/zbll/s1"]')?.textContent).toBe('ZBLL-S1');
      });
      expect(container.querySelector('a[href="/alg/3x3/zbll/s1"]')?.textContent).toBe('ZBLL-S1');
      expect(container.querySelector('[data-library-enabled="true"]')).not.toBeNull();
      expect(container.querySelectorAll('[data-stage-diagram]')).toHaveLength(2);
      expect(detectSolveMethod).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount()); container.remove(); load.mockRestore(); vi.unstubAllGlobals();
    }
  });

  it.each(['pll', 'cfzb'] as const)('mounts %s report and history without invoking automatic method detection', async event => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(ReconstructReport, { solve: { ...repetition, event }, isZh: false,
        history: [{ ...repetition, event, id: 'previous', ts: 50 }],
        host: { localize: tr, writeClipboardText: async () => {}, replayUrl: () => '', recordGyro: false } })));
      expect(detectSolveMethod).not.toHaveBeenCalled();
      expect(container.querySelectorAll('.sml-group[data-stage]')).toHaveLength(2);
      expect(container.querySelectorAll('.sa-table tbody tr')).toHaveLength(event === 'cfzb' ? 2 : 1);
      expect([...container.querySelectorAll('.sa-table thead th')].map(cell => cell.textContent))
        .toEqual(['', 'Observation', 'Execution', 'Moves', 'TPS']);
      expect(container.textContent).toContain('Observation');
      expect(container.textContent).toContain(event === 'cfzb' ? 'ZBLL' : 'PLL');
      expect(container.textContent).not.toContain('CMLL');
      const end = container.querySelector<HTMLButtonElement>('button[aria-label="To end"]')!;
      await act(async () => end.click());
      expect(container.querySelector('.reconstruct-playback-counter')?.textContent).toBe('2.10 / 2.10');
    } finally {
      await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
    }
  });
});
