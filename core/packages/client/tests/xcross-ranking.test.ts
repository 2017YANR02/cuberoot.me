import { describe, expect, it } from 'vitest';
import { applySequence, solvedCubie, parseMoves, invertSequence, formatMoves, CORNER_FACELET, EDGE_FACELET } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { connectedPair, rankXCrossSolutions, xcrossEffort } from '@cuberoot/timer-ui/stage-solver/xcross-ranking';
import { rotateMovesToFrame } from '@cuberoot/timer-ui/stage-solver/rotate-solution';
import World from '@/app/[lang]/sim/engine/world';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import examples from '@/app/[lang]/dev/solvers/xcross-ranking/examples.json';

const inverse = (alg: string) => formatMoves(invertSequence(parseMoves(alg)));
const slots = ['FR', 'FL', 'BL', 'BR'];
const rotations = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap(a => ['', 'y', 'y2', "y'"].map(b => [a, b].filter(Boolean).join(' ')));
const invertRotation = (alg: string) => alg.split(' ').filter(Boolean).reverse().map(t =>
  t.endsWith('2') ? t : t.endsWith("'") ? t[0] : `${t}'`).join(' ');

describe('inspection ranking geometry', () => {
  it('recognises physical bonds against the independent simulator on varied states', () => {
    let seed = 0x42e1;
    for (let sample = 0; sample < 24; sample++) {
      const moves = Array.from({ length: sample }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % 18;
      });
      const scramble = formatMoves(moves), state = applySequence(solvedCubie(), moves);
      const world = new World(), cube = world.cube as Cube;
      cube.twister.setup(scramble);
      const stickers = cube.serialize(), color = (i: number) => 'URFDLB'[Math.floor(i / 9)];
      for (let corner = 4; corner < 8; corner++) for (let edge = 4; edge < 12; edge++) {
        const cc = CORNER_FACELET[corner].map(color).sort().join('');
        const ec = EDGE_FACELET[edge].map(color).sort().join('');
        const cs = CORNER_FACELET.find(fs => fs.map(i => stickers[i]).sort().join('') === cc)!;
        const es = EDGE_FACELET.find(fs => fs.map(i => stickers[i]).sort().join('') === ec)!;
        const actual = es.every(e => cs.some(c => Math.floor(c / 9) === Math.floor(e / 9) && stickers[c] === stickers[e]));
        expect(connectedPair(state, corner, edge), `${scramble}: ${corner}/${edge}`).toBe(actual);
      }
    }
  });

  it('gives identical effort under all 24 inspection frames', () => {
    const solution = { m: "R U' F2 D L B' R2", c: 'FR BL' }, scramble = inverse(solution.m);
    const expected = xcrossEffort(scramble, solution);
    expect(expected.valid).toBe(true);
    for (const lead of rotations) {
      const rotated = rotateMovesToFrame(scramble, invertRotation(lead));
      expect(xcrossEffort(rotated, { m: `${lead} ${solution.m}`.trim(), c: solution.c })).toEqual(expected);
    }
  });

  it('has no front-slot bias and accepts familiar temporary insertions', () => {
    const scramble = "R U R'", solution = { m: "R U' R'", c: 'FR' };
    const effort = xcrossEffort(scramble, solution);
    expect(effort.anchorDelay).toBe(0);
    expect(effort.pairRework).toBe(0);
    expect(effort.crossRework).toBe(0.25);
    for (const rot of ['', 'y', 'y2', "y'"]) {
      const faces = rotateMovesToFrame('F R', rot).split(' ');
      const c = slots.find(s => faces.every(f => s.includes(f)))!;
      expect(xcrossEffort(rotateMovesToFrame(scramble, rot), { m: rotateMovesToFrame(solution.m, rot), c })).toEqual(effort);
    }
  });

  it('prefers an available starting structure to a shorter scattered route, independently of arrival order', () => {
    const scramble = examples[0].scramble;
    const shortest = { m: "U2 F' U' B2 L2 R D'", c: 'BL' }, structured = { m: "R' B2 U F' R B2 L2 D'", c: 'BR' };
    expect(xcrossEffort(scramble, shortest).anchorDelay).toBe(3);
    expect(xcrossEffort(scramble, structured).anchorDelay).toBe(0);
    expect(rankXCrossSolutions(scramble, [shortest, structured], 1)).toEqual([structured]);
    expect(rankXCrossSolutions(scramble, [structured, shortest, structured], 0)).toEqual([structured, shortest]);
    expect(rankXCrossSolutions(scramble, [{ m: 'R', c: 'FR' }, { m: 'invalid', c: 'FR' }], 10)).toEqual([]);
  });
});
