import { describe, expect, it } from 'vitest';
import { Alg, Move } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { rotateAlg } from '@/lib/cube3';
import { manipulateAlg } from '@/app/[lang]/sim/alg-manipulation';

describe('sim algorithm translator', () => {
  it('rotates every family using physical cube conjugation', async () => {
    const cube = await cube3x3x3.kpuzzle();
    for (const axis of ['x', 'y', 'z'] as const) {
      for (const turns of [1, 2, -1]) {
        const rotation = new Move(axis, turns);
        for (const family of 'R U F D L B r u f d l b M E S x y z Rw Uw Fw'.split(' ')) {
          const input = family + "'";
          const output = rotateAlg(input, axis, turns);
          expect(cube.algToTransformation(output).isIdentical(cube.algToTransformation(`${rotation.invert()} ${input} ${rotation}`)), `${axis}: ${input}`).toBe(true);
        }
      }
    }
  });

  it('preserves groups, comments, pauses and layer widths', () => {
    expect(rotateAlg('FS', 'y')).toBe('L M');
    expect(manipulateAlg('FS', 0, 'x')).toBe("F x E'");
    expect(rotateAlg('[R, U] (3Rw . F)2 // note\n2-3Uw', 'y')).toBe('[F, U] (3Fw . L)2 // note\n2-3Uw');
    expect(() => rotateAlg('R @ U', 'x')).toThrow();
    expect(() => rotateAlg('R Q U', 'y')).toThrow();
  });

  it('inserts and removes rotations with only the documented final orientation change', async () => {
    const cube = await cube3x3x3.kpuzzle();
    for (const rotation of ['x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'"]) {
      const input = "R U M' Fw";
      const output = manipulateAlg(input, 1, rotation);
      expect(cube.algToTransformation(output).isIdentical(cube.algToTransformation(`${input} ${rotation}`))).toBe(true);
      const removed = manipulateAlg(output, 2, 'remove');
      expect(cube.algToTransformation(removed).isIdentical(cube.algToTransformation(input))).toBe(true);
    }
  });

  it('switches all single and wide face turns, in both directions', async () => {
    const cube = await cube3x3x3.kpuzzle();
    for (const family of 'R U F D L B r u f d l b Rw Uw Fw Dw Lw Bw'.split(' ')) {
      for (const suffix of ['', '2', "'"]) {
        const move = new Move(family + suffix);
        const input = `B ${move} [R, U] M'`;
        const output = manipulateAlg(input, 1, 'opposite');
        const face = family[0].toUpperCase();
        const axis = 'RL'.includes(face) ? 'x' : 'UD'.includes(face) ? 'y' : 'z';
        const endRotation = new Move(axis, ('RUF'.includes(face) ? -1 : 1) * move.amount);
        expect(cube.algToTransformation(output).isIdentical(cube.algToTransformation(`${input} ${endRotation}`)), input).toBe(true);
        expect(cube.algToTransformation(manipulateAlg(output, 1, 'opposite')).isIdentical(cube.algToTransformation(new Alg(input)))).toBe(true);
      }
    }
  });
});
