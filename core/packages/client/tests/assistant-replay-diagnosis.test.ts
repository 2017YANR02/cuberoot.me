import { describe, expect, it } from 'vitest';
import { decodeReplayParam } from '@cuberoot/shared/timer/replay-decode';
import { prepareReconstruction } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { buildCfopDiagnosis, cfopTrainingHref, selectCfopReplayStage } from '@cuberoot/timer-ui/reconstruct/cfop-diagnosis';
import { buildCfopColumns } from '@cuberoot/timer-ui/reconstruct/report-columns';
import { playbackFrame, playbackTrack } from '@cuberoot/timer-ui/reconstruct/playback-track';
import { reportPlayerAction } from '@cuberoot/timer-ui/reconstruct/report-player';
import snapshot from './fixtures/recon-ground-truth.json';

const sample = [
  ['Cross', 'cross', 1475, 0, 11],
  ['F2', 'slot-FR', 2467, 698, 8],
  ['F3', 'slot-BR', 4145, 537, 7],
  ['F4', 'slot-BL', 4827, 405, 7],
  ['OLL', 'oll', 6105, 529, 10],
  ['PLL', 'pll', 7718, 377, 17],
] as const;

function recordedXCross() {
  return decodeReplayParam(snapshot.fixtures.find(row => row.id === '2464')!.replay)!;
}

function report(replay: ReturnType<typeof recordedXCross>) {
  const { stageSegs, stepMx, slots } = prepareReconstruction({ ...replay, timeMs: replay.totalMs }, 'cfop', 'en');
  const columns = stageSegs ? buildCfopColumns(stageSegs, stepMx, slots, null, null, null) : [];
  return buildCfopDiagnosis(columns, replay.moves, replay.totalMs, stageSegs?.solvedEndIdx ?? null, stageSegs ?? undefined);
}

describe('selected CFOP solve diagnosis', () => {
  it('finds the stage and range for each goal in the 7.718 s summary', () => {
    // The screenshot has stage boundaries and splits, not the encoder log.
    // Only the synthetic intervening moves support a player seek in this fixture.
    const moves = [{ m: 'R', ts: 0 }, ...sample.map(([, , ts]) => ({ m: 'U', ts }))];
    const columns = sample.map(([label, key, cumulativeMs, recognitionMs, turns], index) => {
      const stepMs = cumulativeMs - (sample[index - 1]?.[2] ?? 0);
      return { label, key, cumulativeMs, recognitionMs, executionMs: stepMs - recognitionMs,
        stepMs, turns, endIdx: index + 1, skipped: false, refTurns: null, refUserTurns: null };
    });
    const diagnosis = buildCfopDiagnosis(columns, moves, 7718, 6);
    expect(diagnosis.issue).toBeNull();
    const stageTime = selectCfopReplayStage(diagnosis.stages, 'stepMs')!;
    expect(stageTime.stage).toMatchObject({ column: { label: 'F3', stepMs: 1678 }, startMs: 2467, endMs: 4145 });
    const preparation = selectCfopReplayStage(diagnosis.stages, 'recognitionMs')!;
    expect(preparation.stage).toMatchObject({ column: { label: 'F2', recognitionMs: 698 }, startMs: 1475, endMs: 2467 });
    expect(cfopTrainingHref(preparation.stage.training)).toBe('/alg/3x3/f2l/select');
    expect(selectCfopReplayStage(diagnosis.stages, 'executionMs')?.stage.column.label).toBe('Cross');
    expect(selectCfopReplayStage(diagnosis.stages, 'turns')?.stage.column.label).toBe('PLL');

    const track = playbackTrack(moves, undefined, false).moves;
    const start = reportPlayerAction({ index: 0, timeMs: 0, playing: false, speed: 1, posed: false, run: 0 },
      { type: 'play-from', value: preparation.stage.firstMoveIndex, timeMs: 1475, endMs: 2467 }, track, moves, 7718, false).state;
    expect(start).toMatchObject({ index: 2, timeMs: 1475, rangeEndMs: 2467, playing: true });
    expect(playbackFrame(track, start.rangeEndMs!, 2750)).toEqual({ index: 3, timeMs: 2467, playing: false });
  });

  it('keeps a recorded X-Cross pair attached to Cross and excludes it from the ranking', () => {
    const diagnosis = report(recordedXCross());
    expect(diagnosis.issue).toBeNull();
    expect(diagnosis.freePairs).toBe(1);
    expect(diagnosis.stages.some(stage => stage.column.label === 'F1')).toBe(false);
    const [cross, next] = diagnosis.stages;
    expect(next.column.label).toBe('F2');
    expect(next.startMs).toBe(cross.endMs);
    expect(next.firstMoveIndex).toBe(cross.endMoveIndex + 1);
    expect(diagnosis.stages.find(stage => stage.training === 'oll')?.formula).toEqual({ set: 'oll', caseName: 'OLL 22' });
    expect(diagnosis.stages.at(-1)).toMatchObject({ column: { label: 'PLL' }, finalAdjustmentOnly: true, formula: undefined });
    expect(cfopTrainingHref(cross.training)).toBe('/alg/3x3/cross');
  });

  it('withholds phase claims when a missing move cannot be localized', () => {
    const replay = recordedXCross();
    const missing = report({ ...replay, moves: replay.moves.filter((_, index) => index !== 20) });
    expect(missing).toMatchObject({ issue: 'incomplete', stages: [], limited: [], skipped: [] });
  });

  it('keeps clean phases when the final move extends past the timer result', () => {
    const replay = recordedXCross();
    const clean = report(replay);
    const finish = replay.moves.at(-1)!.ts;
    const diagnosis = report({ ...replay, totalMs: finish - 30 });
    expect(diagnosis.issue).toBeNull();
    expect(diagnosis.stages).toEqual(clean.stages.slice(0, -1));
    expect(diagnosis.limited).toEqual([{
      label: 'PLL', issues: ['after-timer'],
      replay: { startMs: clean.stages.at(-1)!.startMs, endMs: finish,
        firstMoveIndex: clean.stages.at(-1)!.firstMoveIndex, endMoveIndex: replay.moves.length - 1 },
    }]);
  });

  it('preserves other phases with a shared timestamp and protects both sides of a shared boundary', () => {
    const replay = recordedXCross();
    const clean = report(replay);
    const duplicate = (at: number) => report({ ...replay, moves: replay.moves.map((move, index) =>
      index === at ? { ...move, ts: replay.moves[index - 1].ts } : move) });
    const inside = clean.stages.find(stage => stage.firstMoveIndex < 20 && stage.endMoveIndex >= 20)!;
    const recovered = duplicate(20);
    expect(recovered.issue).toBeNull();
    expect(recovered.stages).toEqual(clean.stages.filter(stage => stage !== inside));
    expect(recovered.limited).toMatchObject([{ label: inside.column.label, issues: ['shared-timestamp'] }]);
    expect(recovered.limited[0].replay).not.toBeNull();

    const [first, second, ...rest] = clean.stages;
    const sharedBoundary = duplicate(second.firstMoveIndex);
    expect(sharedBoundary.limited).toEqual([first, second].map(stage =>
      ({ label: stage.column.label, issues: ['shared-timestamp'], replay: null })));
    expect(sharedBoundary.stages).toEqual(rest);
  });

  it('rejects backwards timestamps rather than seeking on a nonmonotonic track', () => {
    const replay = recordedXCross();
    const badClock = report({ ...replay, moves: replay.moves.map((move, index) =>
      index === 20 ? { ...move, ts: replay.moves[index - 1].ts - 1 } : move) });
    expect(badClock).toMatchObject({ issue: 'clock', stages: [], limited: [] });
  });

  it('omits OLL after an OLL skip and starts PLL at the end of F2L', () => {
    const solution = "D' R' D U R U' R' U2 R U R' U' R' F R2 U' R' U' R U R' F'".split(' ');
    const scramble = solution.slice().reverse().map(move =>
      move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : move + "'").join(' ');
    const moves = solution.map((m, index) => ({ m, ts: index * 180 }));
    const diagnosis = report({ event: '333', scramble, moves, totalMs: 3900 });
    expect(diagnosis.issue).toBeNull();
    expect(diagnosis.skipped).toEqual(['OLL']);
    expect(diagnosis.stages.at(-2)?.column.label).toBe('F4');
    expect(diagnosis.stages.at(-1)).toMatchObject({ column: { label: 'PLL' }, startMs: 1080, endMs: 3780 });
    expect(diagnosis.stages.at(-1)?.formula).toEqual({ set: 'pll', caseName: 'T' });
    expect(cfopTrainingHref('pll')).toBe('/alg/3x3/pll/select');
  });

  it('keeps a shared OLL and solve finish at stage level', () => {
    const solution = "D' R' D U R U' R' U F R U R' U' F'".split(' ');
    const scramble = solution.slice().reverse().map(move => move.endsWith("'") ? move.slice(0, -1) : move + "'").join(' ');
    const diagnosis = report({ event: '333', scramble, moves: solution.map((m, index) => ({ m, ts: index * 180 })), totalMs: 2600 });
    expect(diagnosis.issue).toBeNull();
    expect(diagnosis.skipped).toEqual(['PLL']);
    expect(diagnosis.stages.at(-1)).toMatchObject({ training: 'oll', endMs: 2340, formula: undefined });
  });
});
