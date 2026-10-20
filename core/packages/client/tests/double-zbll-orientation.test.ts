import { describe, expect, it } from 'vitest';
import { cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { bestErgonomicOrientationIndex, rotateMovesToFrame } from '@/lib/rotate-solution';
import { orientDoubleZbllScramble } from '@/lib/double-zbll';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { applyScramble, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import statistics from '@/app/[lang]/alg/double-zbll-about/statistics.json';
import manifest from '../public/data/double-zbll/manifest.json';
const kp = await cube3x3x3.kpuzzle();
const state = (alg: string) => JSON.stringify(kp.defaultPattern().applyAlg(alg).patternData);
const frames = ['', 'y', 'y2', "y'", 'z2', 'z2 y', 'z2 y2', "z2 y'"];
const score = (alg: string) => {
  const moves = alg.split(' ');
  const count = (face: string) => moves.filter(m => m[0] === face).length;
  return [count('R') + count('L'), count('F') - count('B'), count('R') - count('L')];
};
const compare = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
describe('Double ZBLL axis-preserving frames', () => {
  it('keeps the help statistics tied to the corpus and every extreme in the training frame', () => {
    expect(statistics.version).toBe(manifest.version);
    expect(statistics.dataSha256).toBe(manifest.dataSha256);
    expect(statistics.groups.all.histogram).toEqual(manifest.histogram);
    expect(statistics.groups.pure.shortest.length).toBe(2);
    expect(statistics.groups.all.shortest.length).toBe(2);
    expect(statistics.groups.pure.longest.length).toBe(4);
    expect(statistics.groups.all.longest.length).toBe(4);
    for (const group of Object.values(statistics.groups)) {
      expect(group.histogram.reduce((sum, n) => sum + n, 0)).toBe(group.count);
      expect(group.qtmHistogram.reduce((sum, n) => sum + n, 0)).toBe(group.count);
      expect(group.generators.reduce((sum, n) => sum + n, 0)).toBe(group.count);
      expect(group.histogram.reduce((sum, n, i) => sum + n * i, 0)).toBe(group.totalHtm);
      expect(group.qtmHistogram.reduce((sum, n, i) => sum + n * i, 0)).toBe(group.totalQtm);
      for (const example of [...group.shortest, ...group.longest]) {
        const oriented = orientDoubleZbllScramble(example.scramble);
        const moves = oriented.scramble.split(' ');
        expect(moves.length).toBe(example.htm);
        expect(moves.reduce((sum, move) => sum + (move.endsWith('2') ? 2 : 1), 0)).toBe(example.qtm);
        expect(new Set(moves.map(move => move[0])).size).toBe(example.generators);
        expect(state(oriented.scramble)).toBe(state(`${new Alg(oriented.rotation).invert()} ${example.scramble} ${oriented.rotation}`));
      }
    }
  });
  it('shares the Timer priorities, treating half turns once and U/D as neutral', () => {
    expect(bestErgonomicOrientationIndex(['R F F', 'L2 R B B'])).toBe(1);
    expect(bestErgonomicOrientationIndex(['R B', 'L F'])).toBe(1);
    expect(bestErgonomicOrientationIndex(['L F', 'R F'])).toBe(1);
    expect(bestErgonomicOrientationIndex(['z2 R2 U D D2', 'y R'])).toBe(0);
    expect(bestErgonomicOrientationIndex(['', 'y U D'])).toBe(0);
  });
  it('maps every face turn exactly under all eight frames, including z2', () => {
    for (const frame of frames) for (const face of 'URFDLB') for (const suffix of ['', '2', "'"]) {
      const move = face + suffix;
      const transformed = rotateMovesToFrame(move, frame);
      expect(transformed).toMatch(/^[URFDLB](?:2|')?$/);
      expect(transformed.slice(1)).toBe(suffix);
      expect(state(transformed)).toBe(state(`${new Alg(frame).invert()} ${move} ${frame}`));
    }
    expect(rotateMovesToFrame('U R F', 'z2')).toBe('D L F');
    for (const frame of frames) {
      expect(new Set(rotateMovesToFrame('U R F D L B', frame).split(' ')).size).toBe(6);
    }
  });
  it('chooses the lexicographic maximum and keeps device targets in the same frame', () => {
    for (const input of ["B L2 U B U' L U2 L U2 B2 L B L' B' L' B", 'D L B D2 L2 B2', "R U F R' U' F'", 'L F L', "F U F' U' F' U2 F2 U F2 R2 D R2 F D2 F'"]) {
      const best = orientDoubleZbllScramble(input);
      const variants = frames.map(frame => rotateMovesToFrame(input, frame));
      expect(score(best.scramble)).toEqual(variants.map(score).sort((a, b) => compare(b, a))[0]);
      expect(state(best.scramble)).toBe(state(`${new Alg(best.rotation).invert()} ${input} ${best.rotation}`));
      expect(best.swapped).toBe(best.rotation.includes('z2'));
      expect(smartCubeTargetFacelets(best.scramble)).toBe(toFaceletString(applyScramble(3, best.scramble)));
    }
    expect(orientDoubleZbllScramble('L F L').swapped).toBe(true);
    expect(orientDoubleZbllScramble('R U F')).toEqual({ scramble: 'R U F', swapped: false, rotation: '' });
    expect(orientDoubleZbllScramble("F U F'").scramble).toBe("R U R'");
    expect(score(orientDoubleZbllScramble("F U F' U' F' U2 F2 U F2 R2 D R2 F D2 F'").scramble)).toEqual([7, 2, 7]);
  });
});
