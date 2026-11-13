import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { checkReconCompletion } from '@cuberoot/shared/recon-completion';
import seven from './fixtures/recon-completion-2967.json';

const cubeRotations = ['', 'x', 'x2', "x'", 'z', "z'"]
  .flatMap(tilt => ['', 'y', 'y2', "y'"].map(spin => `${tilt} ${spin}`.trim()));

describe('visual reconstruction completion', () => {
  it('accepts the complete seven-layer reconstruction #2967, but rejects a missing PLL turn', async () => {
    expect(await checkReconCompletion(seven)).toEqual({ status: 'solved' });
    expect(await checkReconCompletion({ ...seven, solution: seven.solution.replace('D D R2 // PLL', 'D D // PLL') }))
      .toEqual({ status: 'unsolved' });
  });

  it.each([2, 3, 4, 5, 6, 7])('ignores same-color centers and global orientation on %s layers', async n => {
    // This sequence restores corners/edges while permuting/rotating centers.
    const solution = "R' (R U R' U)5";
    for (const rotation of cubeRotations) {
      expect(await checkReconCompletion({ event: `${n}x${n}`, scramble: 'R', solution: `${solution} ${rotation}` }))
        .toEqual({ status: 'solved' });
      expect(await checkReconCompletion({ event: `${n}x${n}`, scramble: 'R', solution: `${solution} U ${rotation}` }))
        .toEqual({ status: 'unsolved' });
    }
  });

  it.each([4, 5, 6, 7])('still detects misplaced inner-layer stickers on %s layers', async n => {
    expect(await checkReconCompletion({ event: `${n}x${n}`, scramble: 'Rw', solution: "R'" }))
      .toEqual({ status: 'unsolved' });
  });

  it('accepts Megaminx center twists in all 60 whole-puzzle orientations', async () => {
    const kpuzzle = await puzzles.megaminx.kpuzzle();
    const rotations = [''];
    const seen = new Set([JSON.stringify(kpuzzle.defaultPattern().patternData)]);
    for (let i = 0; i < rotations.length; i++) {
      for (const move of ['y', 'Rv']) {
        const rotation = `${rotations[i]} ${move}`.trim();
        const key = JSON.stringify(kpuzzle.defaultPattern().applyAlg(rotation).patternData);
        if (seen.has(key)) continue;
        seen.add(key);
        rotations.push(rotation);
        expect(rotations.length).toBeLessThanOrEqual(60);
      }
    }
    expect(rotations).toHaveLength(60);
    for (const rotation of rotations) {
      expect(await checkReconCompletion({ event: 'mega', scramble: 'R', solution: `R' (R U R' U2)4 ${rotation}` }))
        .toEqual({ status: 'solved' });
      expect(await checkReconCompletion({ event: 'mega', scramble: 'R', solution: `R' (R U R' U2)4 U ${rotation}` }))
        .toEqual({ status: 'unsolved' });
    }
  });

  it.each(['', 'y2', 'z', 'z2', "z'", 'z y2', 'z2 y2', "z' y2"])(
    'checks Clock hands against hour marks after regrip %s', async rotation => {
      expect(await checkReconCompletion({ event: 'clock', scramble: 'UR3+', solution: `UR3- ${rotation} UR DL` }))
        .toEqual({ status: 'solved' });
      expect(await checkReconCompletion({ event: 'clock', scramble: 'UR3+', solution: `UR2- ${rotation}` }))
        .toEqual({ status: 'unsolved' });
    },
  );

  it.each(['pyra', 'skewb'])('keeps the %s regrip frame across scramble and solution', async event => {
    expect(await checkReconCompletion({ event, scramble: 'y R', solution: "R' y'" })).toEqual({ status: 'solved' });
    expect(await checkReconCompletion({ event, scramble: 'y R', solution: "y'" })).toEqual({ status: 'unsolved' });
  });

  it('does not ignore Pyraminx tips or Skewb center positions', async () => {
    expect(await checkReconCompletion({ event: 'pyra', scramble: 'u', solution: '' })).toEqual({ status: 'unsolved' });
    expect(await checkReconCompletion({ event: 'skewb', scramble: 'R', solution: "R' (R U R' U)9" }))
      .toEqual({ status: 'unsolved' });
  });

  it.each(['Rt', 'Lt', 'Ft', 'Rt Lt Ft'])('accepts FTO regrip %s but not an extra face turn', async rotation => {
    expect(await checkReconCompletion({ event: 'fto', scramble: 'R', solution: `R' ${rotation}` })).toEqual({ status: 'solved' });
    expect(await checkReconCompletion({ event: 'fto', scramble: 'R', solution: `R' U ${rotation}` })).toEqual({ status: 'unsolved' });
  });

  it.each(['', 'x2', 'y2', 'z2'])('checks Square-1 layers and middle slab after %s', async rotation => {
    expect(await checkReconCompletion({ event: 'sq1', scramble: '(1,0)', solution: `(-1,0) ${rotation}` })).toEqual({ status: 'solved' });
    expect(await checkReconCompletion({ event: 'sq1', scramble: '/', solution: rotation })).toEqual({ status: 'unsolved' });
    expect(await checkReconCompletion({ event: 'sq1', scramble: '(3,0)', solution: rotation })).toEqual({ status: 'unsolved' });
  });

  it.each(['2x2', '3x3', '3x3 robot', '3x3 smart', 'mirror', '4x4', '5x5', '6x6', '7x7', '3bld', '4bld', '5bld', 'oh', 'fmc', 'mbld', 'pyra', 'pyraminx', 'skewb', 'mega'])(
    'preserves inverse and incomplete-solve checks for %s', async event => {
      const scramble = "R U R' U'";
      expect(await checkReconCompletion({ event, scramble, solution: new Alg(scramble).invert().toString() }))
        .toEqual({ status: 'solved' });
      expect(await checkReconCompletion({ event, scramble: 'R', solution: '' })).toEqual({ status: 'unsolved' });
    },
  );
});
