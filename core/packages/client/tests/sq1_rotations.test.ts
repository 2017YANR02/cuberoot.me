import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applySq1Scramble, canonicalSq1Alg, compactSq1Alg, compactSq1Solution,
  invertSq1Alg, isSq1Solved, parseSq1Tokens, simplifySq1Alg,
} from '@cuberoot/shared/sq1-notation';
import { checkReconCompletion } from '@cuberoot/shared/recon-completion';
import Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import { applyAnimFrame } from '@cuberoot/puzzle-render-core/engine/pieceAnim';
import { sq1MoveCounts } from '@/lib/sq1-metrics';

function poses(cube: Sq1Cube) {
  cube.updateMatrixWorld(true);
  return [...cube.pieces, ...cube.middle].map(({ pivot }) => pivot.matrixWorld.clone());
}

function expectMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4) {
  actual.elements.forEach((value, i) => expect(value).toBeCloseTo(expected.elements[i], 8));
}

describe('SQ1 reconstruction rotations', () => {
  it('keeps rotations through parsing, saving, simplification and inversion', () => {
    const alg = "x2(3,-3)/Y2' (0,3)z2 // annotation";
    const tokens = parseSq1Tokens(alg);
    expect(tokens).toEqual([
      { kind: 'rotation', axis: 'x' }, { kind: 'turn', top: 3, bot: -3 },
      { kind: 'slice' }, { kind: 'rotation', axis: 'y' },
      { kind: 'turn', top: 0, bot: 3 }, { kind: 'rotation', axis: 'z' },
    ]);
    for (const format of [canonicalSq1Alg, compactSq1Alg, compactSq1Solution, simplifySq1Alg]) {
      expect(parseSq1Tokens(format(alg))).toEqual(tokens);
    }
    expect(parseSq1Tokens(invertSq1Alg(invertSq1Alg(alg)))).toEqual(tokens);
    expect(simplifySq1Alg('x2 x2 y2 y2 z2 z2')).toBe('');
    expect(sq1MoveCounts('x2 y2 z2 (3,-3) /')).toEqual({
      twist: 1, wca: 2, face: 3, slices: 1, turns: 1, nonIdentityTurns: 1, doubleTurns: 1,
    });
  });

  for (const [axis, vector] of [
    ['x', new THREE.Vector3(1, 0, 0)],
    ['y', new THREE.Vector3(0, 1, 0)],
    ['z', new THREE.Vector3(0, 0, 1)],
  ] as const) {
    it(`${axis}2 rotates every piece and middle slab, including the animation midpoint`, () => {
      const cube = new Sq1Cube();
      const before = poses(cube);
      const move = { kind: 'rotation', axis } as const;
      const anims = cube.beginMove(move);
      for (const progress of [0.5, 1]) {
        applyAnimFrame(anims, progress);
        const rotation = new THREE.Matrix4().makeRotationAxis(vector, -Math.PI * progress);
        poses(cube).forEach((pose, i) => expectMatrix(pose, rotation.clone().multiply(before[i])));
      }
      cube.finishMove(anims, move);
      expect(cube.complete).toBe(true);
      expect(cube.state.pieces).toEqual(applySq1Scramble('').pieces);
      cube.applyMoveInstant(move);
      poses(cube).forEach((pose, i) => expectMatrix(pose, before[i]));
      expect(cube.state).toEqual(applySq1Scramble(''));
      cube.dispose();
    });

    it(`${axis}2 remaps subsequent layer turns and slices and can rewind`, () => {
      const cube = new Sq1Cube();
      const before = poses(cube);
      const alg = `${axis}2 (3,0) / (0,3)`;
      const moves = parseSq1Tokens(alg);
      cube.applyMovesInstant(moves);
      expect(cube.state).toEqual(applySq1Scramble(alg));
      const prefixPose = poses(cube);
      cube.applyMovesInstant(moves);
      poses(cube).forEach((pose, i) => expectMatrix(pose, prefixPose[i]));
      for (const move of parseSq1Tokens(invertSq1Alg(alg))) cube.applyMoveInstant(move);
      expect(cube.complete).toBe(true);
      poses(cube).forEach((pose, i) => expectMatrix(pose, before[i]));
      cube.dispose();
    });
  }

  it('maps the new top to the old bottom after x2 and z2', () => {
    for (const axis of ['x', 'z']) {
      expect(applySq1Scramble(`${axis}2 (3,0)`).pieces).toEqual(applySq1Scramble('(0,3)').pieces);
    }
    expect(applySq1Scramble('y2 (3,0)').pieces).toEqual(applySq1Scramble('(3,0)').pieces);
  });

  it('moves the small middle slab with the left slice after y2 or z2', () => {
    for (const axis of ['y', 'z']) {
      const cube = new Sq1Cube();
      cube.applyMovesInstant(parseSq1Tokens(`${axis}2`));
      const anims = cube.beginMove({ kind: 'slice' });
      expect(anims.some(anim => anim.pivot === cube.middle.find(mid => mid.side === -1)!.pivot)).toBe(true);
      expect(anims.some(anim => anim.pivot === cube.middle.find(mid => mid.side === 1)!.pivot)).toBe(false);
      cube.finishMove(anims, { kind: 'slice' });
      expect(cube.state.smallSliceFlipped).toBe(true);
      expect(cube.state.pieces.slice(6, 18)).toEqual(applySq1Scramble('').pieces.slice(6, 18));
      cube.dispose();
    }
    expect(isSq1Solved(applySq1Scramble('/ y2 /'))).toBe(true);
  });

  it('checks completion with rotations without treating them as layer turns', async () => {
    for (const solution of ['-3 x2', '-3 x2 x2']) {
      expect(await checkReconCompletion({ event: 'sq1', scramble: '3', solution })).toEqual({ status: 'solved' });
    }
    expect(await checkReconCompletion({
      event: 'sq1', scramble: '(3,0) // scramble', solution: 'x2 (0,-3)',
    })).toEqual({ status: 'solved' });
    for (const solution of ['x2 (0,-3)', 'y2 (-3,0)', 'z2 (0,-3)']) {
      expect(await checkReconCompletion({ event: 'sq1', scramble: '(3,0)', solution })).toEqual({ status: 'solved' });
    }
    expect(await checkReconCompletion({ event: 'sq1', scramble: '(3,0)', solution: 'x2' })).toEqual({ status: 'unsolved' });
    expect(await checkReconCompletion({ event: 'sq1', scramble: '(3,0)', solution: 'x3' })).toEqual({ status: 'invalid' });
  });
});
