import { describe, expect, it } from 'vitest';
import {
  nativeStageSolverCandidateRow, nativeStageSolverFaceCells, nativeStageSolverFrame, nativeStageSolverPlayback,
} from '../src/lib/native-stage-solver';
import {
  STAGE_SOLVER_DEFAULT_CELLS, STAGE_SOLVER_DEFAULT_FACES, STAGE_SOLVER_NO_SOLUTION, STAGE_SOLVER_TOO_BROAD,
  sortStageSolverCandidates, stageSolverMoveRestriction, stageSolverToggleMoveCell,
} from '@cuberoot/shared/timer/scramble-variants';

describe('native stage solver presentation', () => {
  it('distinguishes empty, restricted and ready face results and resolves ties in face order', () => {
    const counts = [2, null, STAGE_SOLVER_NO_SOLUTION, STAGE_SOLVER_TOO_BROAD, 1, 1];
    const pending = nativeStageSolverFaceCells(counts);
    expect(pending.faces.map(cell => cell.text)).toEqual(['2', '·', '-', '⋯', '1', '1']);
    expect(pending.faces.some(cell => cell.best)).toBe(false);
    const filtered = nativeStageSolverFaceCells(counts, 5, 'YOBG');
    expect(filtered.bestFace).toBe(4);
    expect(filtered.faces.filter(cell => cell.best).map(cell => cell.face)).toEqual(['F', 'B']);
    expect(filtered.faces.find(cell => cell.selected)?.face).toBe('B');
  });

  it('sorts equal HTM candidates by QTM and folds the view into the playback setup', () => {
    const solutions = sortStageSolverCandidates([{ m: 'F2', c: 'FL' }, { m: "z F'", c: 'FR' }]);
    expect(solutions.map(candidate => candidate.c)).toEqual(['FR', 'FL']);
    const row = nativeStageSolverCandidateRow(solutions[0]!, 0);
    expect(row).toMatchObject({ c: 'FR', count: 1 });
    expect(row.body).toMatch(/^[RL]'$/);
    const playback = nativeStageSolverPlayback('R U', row.m);
    expect(playback.setup).toBe(`R U ${row.lead}`);
    expect(nativeStageSolverFrame(playback, 0)).toMatchObject({ frame: 0, total: 1, move: '' });
    expect(nativeStageSolverFrame(playback, 3)).toMatchObject({ frame: 1, total: 1, move: row.body });
    expect(nativeStageSolverFrame(playback, 0).image).not.toBe(nativeStageSolverFrame(playback, 1).image);
  });

  it('uses the face mask for outer turns and the extended solver only for wide, slice or rotation cells', () => {
    expect(stageSolverMoveRestriction('std', STAGE_SOLVER_DEFAULT_CELLS)).toEqual({ restricted: false });
    expect(stageSolverMoveRestriction('std', stageSolverToggleMoveCell(STAGE_SOLVER_DEFAULT_CELLS, 0)))
      .toEqual({ restricted: true, mask: 0x3fff8 });
    expect(stageSolverMoveRestriction('std', stageSolverToggleMoveCell(STAGE_SOLVER_DEFAULT_CELLS, 15)))
      .toEqual({ restricted: true, restriction: { lo: 0x3ffff, hi: 0xe000, maxRot: 2 } });
    const forbidden = stageSolverToggleMoveCell(STAGE_SOLVER_DEFAULT_FACES, 0, true);
    const replaced = stageSolverToggleMoveCell(forbidden, 1, true);
    expect(replaced).toEqual([true, false, true, true, true, true]);
    expect(stageSolverMoveRestriction('eo', replaced)).toEqual({ restricted: true, mask: 0x3ffc7 });
  });
});
