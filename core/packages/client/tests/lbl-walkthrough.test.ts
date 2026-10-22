import { expect, it } from 'vitest';
import { cube3x3x3 } from 'cubing/puzzles';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS, lessonFrame } from '@/app/[lang]/tutorial/lbl/lesson-runs';

it.each(LBL_LESSON_RUNS)('keeps every stage continuous and solves $scramble', async run => {
  const puzzle = await cube3x3x3.kpuzzle();
  let pattern = puzzle.defaultPattern().applyAlg(run.scramble);
  for (const [index, stage] of LBL_LESSON_STAGE_IDS.entries()) {
    const frame = lessonFrame(run, stage);
    expect(puzzle.defaultPattern().applyAlg(frame.setup).isIdentical(pattern)).toBe(true);
    pattern = pattern.applyAlg(frame.alg);
    const { EDGES: edges, CORNERS: corners } = pattern.patternData;
    if (index === 0) {
      expect([...edges.pieces.slice(0, 4)].sort()).toEqual([4, 5, 6, 7]);
      expect(edges.orientation.slice(0, 4)).toEqual([0, 0, 0, 0]);
    }
    if (index >= 1) {
      expect(edges.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);
      expect(edges.orientation.slice(4, 8)).toEqual([0, 0, 0, 0]);
    }
    if (index >= 2) {
      expect(corners.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);
      expect(corners.orientation.slice(4, 8)).toEqual([0, 0, 0, 0]);
    }
    if (index >= 3) {
      expect(edges.pieces.slice(8, 12)).toEqual([8, 9, 10, 11]);
      expect(edges.orientation.slice(8, 12)).toEqual([0, 0, 0, 0]);
    }
    if (index >= 4) expect(edges.orientation.slice(0, 4)).toEqual([0, 0, 0, 0]);
    if (index >= 5) expect(corners.orientation.slice(0, 4)).toEqual([0, 0, 0, 0]);
    if (index >= 6) expect(corners.pieces.slice(0, 4)).toEqual([0, 1, 2, 3]);
  }
  expect(pattern.experimentalIsSolved({ ignorePuzzleOrientation: false, ignoreCenterOrientation: true })).toBe(true);
  const full = lessonFrame(run, 'all');
  expect(puzzle.defaultPattern().applyAlg(`${full.setup} ${full.alg}`).isIdentical(pattern)).toBe(true);
});
