import { describe, expect, it } from 'vitest';
import { decodeReplayParam } from '@cuberoot/shared/timer/replay-decode';
import type { Solve } from '@cuberoot/shared/timer/types';
import { analyzeCfopHistory, cfopBaselineCandidates } from '@cuberoot/timer-ui/reconstruct/cfop-personal-baseline';
import snapshot from './fixtures/recon-ground-truth.json';

const replay = decodeReplayParam(snapshot.fixtures.find(row => row.id === '2464')!.replay)!;
const device = { model: 'gan-v4', name: 'Fixture cube' };
const current: Solve = { id: 'current', event: '333', ts: 100, timeMs: replay.totalMs,
  penalty: 'ok', scramble: replay.scramble, moves: replay.moves, device };

function attempt(ts: number, pauseMs = 0, shorterGap = false): Solve {
  // Keep all moves and timings except the gap after Cross (4689 ms), or the
  // single OLL execution gap. The underlying solve stays physically valid.
  const cutMs = shorterGap ? 14036 : 4689;
  return { ...current, id: String(ts), ts, timeMs: replay.totalMs + pauseMs,
    moves: replay.moves.map(move => ({ ...move, ts: move.ts + (move.ts > cutMs ? pauseMs : 0) })) };
}

function all(history: Solve[]) { return new Set(history.map(solve => solve.id)); }

describe('CFOP personal baseline', () => {
  it('limits candidates to distinct recorded attempts on the same known device', () => {
    const first = attempt(1);
    const history: Solve[] = [
      current, first, first, attempt(6), { ...attempt(3), penalty: '+2' },
      { ...attempt(4), device: { ...device, name: 'Other cube' } }, { ...attempt(5), device: undefined },
      { ...attempt(7), device: { ...device, model: 'moyu32' } }, { ...attempt(8), event: '333oh' },
      { ...attempt(9), penalty: 'DNF' }, { ...attempt(10), reconOk: false }, attempt(101),
    ];
    expect(cfopBaselineCandidates(history, current).map(solve => solve.id)).toEqual(['101', 'current', '10', '6', '3', '1']);
    expect(cfopBaselineCandidates(history, { ...current, device: undefined })).toEqual([]);
    expect(cfopBaselineCandidates(Array.from({ length: 30 }, (_, i) => attempt(i)), current)
      .map(solve => solve.id)).toEqual(Array.from({ length: 24 }, (_, i) => String(29 - i)));
  });

  it('requires an explicit choice and withholds diagnosis with too few usable solves', () => {
    const history = Array.from({ length: 8 }, (_, i) => attempt(i));
    expect(analyzeCfopHistory(history, current, new Set()).selected).toBe(0);
    expect(analyzeCfopHistory(history, current, all(history.slice(1))))
      .toMatchObject({ selected: 7, recentCount: 0, priorities: [] });
    history[6] = { ...history[6], moves: replay.moves.filter((_, index) => index !== 20) };
    history[7] = { ...history[7], moves: replay.moves.map((move, index) =>
      index === 20 ? { ...move, ts: replay.moves[index - 1].ts } : move) };
    expect(analyzeCfopHistory(history, current, all(history)))
      .toMatchObject({ selected: 8, usable: 7, partial: 1, excluded: 1, recentCount: 0, priorities: [],
        issueCounts: { incomplete: { partial: 0, excluded: 1 }, 'shared-timestamp': { partial: 1, excluded: 0 } },
      });
  });

  it('counts partial and excluded reasons per solve and withholds affected stage timing', () => {
    const history = Array.from({ length: 9 }, (_, i) => attempt(i));
    history[5] = { ...history[5], timeMs: replay.moves.at(-1)!.ts - 40 };
    history[6] = { ...history[6], reconOk: false };
    // Even a selection too small for a baseline should explain exclusions.
    const result = analyzeCfopHistory(history, current, all(history.slice(5, 7)));
    expect(result).toMatchObject({
      selected: 2, usable: 1, partial: 1, excluded: 1, comparableGroups: 0, priorities: [],
      issueCounts: { 'after-timer': { partial: 1, excluded: 0 }, 'marked-incorrect': { partial: 0, excluded: 1 } },
    });
  });

  it('uses only selected solves, separates old from new, and ranks recurring delays with explicit evidence', () => {
    const history = Array.from({ length: 8 }, (_, i) => attempt(i, i < 5 ? 0 : 850));
    const assessment = analyzeCfopHistory([attempt(10, 5000), ...history].reverse(), current, all(history));
    expect(assessment).toMatchObject({
      selected: 8, usable: 8, baselineCount: 5, recentCount: 3, comparableGroups: 4,
      priorities: [{
        situation: { stage: 'f2l', start: 'corner-slotted' }, signal: 'recognitionMs',
        baselineMs: 1687, recentMs: 2537, thresholdMs: 338, baselineCount: 5, recentCount: 3,
        slowerCount: 3, excessPerSolveMs: 850,
      }],
    });
  });

  it('does not pool windows with different layouts, skips, and last-layer cases', () => {
    // An inverse of Cross + T perm leaves all F2L pairs and OLL solved at
    // the end of Cross. None of these three newer situations match 2464.
    const solution = "D' R' D U2 R U R' U' R' F R2 U' R' U' R U R' F'".split(' ');
    const scramble = solution.slice().reverse().map(move =>
      move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : move + "'").join(' ');
    const history = Array.from({ length: 8 }, (_, i) => i < 5 ? attempt(i) : {
      ...attempt(i), scramble, moves: solution.map((m, index) => ({ m, ts: index * 180 })), timeMs: 4000,
    });
    expect(analyzeCfopHistory(history, current, all(history)))
      .toMatchObject({ selected: 8, usable: 8, baselineCount: 5, recentCount: 3, comparableGroups: 0, priorities: [] });
  });

  it('requires repeated slowdowns across distinct solves and ranks bigger recurring losses first', () => {
    const history = Array.from({ length: 10 }, (_, i) => attempt(i, i === 9 ? 4000 : 0));
    expect(analyzeCfopHistory(history, current, all(history)).priorities).toEqual([]);

    const repeat = Array.from({ length: 10 }, (_, i) => {
      const solve = attempt(i, i < 5 ? 0 : 850);
      if (i < 5 || i > 7) return solve;
      const shifted = attempt(i, 2700, true);
      return { ...solve, timeMs: solve.timeMs + 2700,
        moves: solve.moves!.map((move, index) => ({
          ...move, ts: move.ts + shifted.moves![index].ts - replay.moves[index].ts,
        })) };
    });
    const { priorities } = analyzeCfopHistory(repeat, current, all(repeat));
    expect(priorities.map(priority =>
      [priority.situation.stage, priority.signal, priority.slowerCount, priority.excessPerSolveMs]))
      .toEqual([['oll', 'executionMs', 3, 1620], ['f2l', 'recognitionMs', 5, 850]]);
    expect(priorities[0].replay).toMatchObject({
      solveId: '7', target: { set: 'oll', caseName: 'OLL 22' }, range: { startMs: 14134, endMs: 25248 },
    });
    expect(priorities[1].replay).toMatchObject({ solveId: '9', range: { startMs: 4689, endMs: 8982 } });
    expect(priorities[1].replay?.target).toBeUndefined();
  });
});
