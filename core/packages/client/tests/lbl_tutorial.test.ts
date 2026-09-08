import { describe, expect, it } from 'vitest';
import { cube3x3x3 } from 'cubing/puzzles';
import { LBL_STEPS } from '@/app/[lang]/tutorial/lbl/content';
import { resolvePlayerSetup, resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';

const kp = await cube3x3x3.kpuzzle();
const solved = kp.defaultPattern();
describe('LBL teaching examples', () => {
  for (const step of LBL_STEPS) for (const demo of step.examples) {
    it(`${step.id}: ${demo.title.en} is playable`, () => {
      const setup = resolvePlayerSetup('3x3', demo.alg, demo.setup, demo.startSolved ?? false);
      const start = solved.applyAlg(setup);
      const end = start.applyAlg(demo.alg);
      expect(resolveSimPreviewMoves('3x3', demo.alg).length).toBeGreaterThan(0);
      if (!demo.setup && !demo.startSolved) expect(end.isIdentical(solved)).toBe(true);
      if (step.id === 'yellow-face') {
        const expected = [3, 3, 2, 4][step.examples.indexOf(demo)];
        expect(start.patternData.CORNERS.orientation.filter(o => o !== 0).length).toBe(expected);
        expect(end.patternData.EDGES.orientation.every(o => o === 0)).toBe(true);
        expect(end.patternData.CORNERS.pieces.slice(4)).toEqual([4, 5, 6, 7]);
        if (demo.setup) expect(end.patternData.CORNERS.orientation.filter(o => o !== 0).length).toBe(3);
      }
      if (step.id === 'edge-position') {
        expect(start.patternData.CORNERS).toEqual(solved.patternData.CORNERS);
        expect(start.patternData.EDGES.pieces[2]).toBe(2);
        expect(start.patternData.EDGES.pieces.filter((p, i) => p !== i).length).toBe(3);
      }
      if (step.id === 'yellow-cross') {
        expect(start.patternData.EDGES.orientation.filter(o => o !== 0).length).toBe(demo.title.en === 'Dot' ? 4 : 2);
      }
      if (step.id === 'cross') {
        expect(end.patternData.EDGES).toEqual(solved.patternData.EDGES);
      }
      if (step.id === 'corner-position') {
        const p = start.patternData.CORNERS.pieces.slice(0, 4);
        const pairs = p.filter((piece, i) => (p[(i + 1) % 4] - piece + 4) % 4 === 1).length;
        expect(pairs).toBe(demo.setup ? 0 : 1);
      }
    });
  }
});
