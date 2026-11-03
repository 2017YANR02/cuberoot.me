import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { AlgFile } from '@cuberoot/shared/alg';
import { SOLVED_FACELET } from '@cuberoot/shared/cube-facelet';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { applyMoves, fromFaceletString, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { classifyPhotoColors, completeLastLayer, recognizePhoto, standardColorFrames } from '@/lib/cube-photo/recognize';
import type { RGB } from '@/lib/cube-photo';
import { findPhotoAlg, photoAlgGoal, photoAlgSets, photoAufOnly, type PhotoAlgSet } from '@/lib/cube-photo/lookup';
import type { CubeCorners } from '@/lib/cube-photo/geometry';
import { cubePhotoFixture } from './fixtures/cube-photo';
import fixture from './fixtures/cube-photo-algs.json';
import { analyzeCubePhoto } from '@cuberoot/shared/cube-photo/analyze';

const visible = (s: string) => ({ U: s.slice(0, 9), F: s.slice(18, 21), R: s.slice(9, 12) });
const libraries = fixture.libraries as Record<PhotoAlgSet, AlgFile>;
// Median patches from a handheld photo: reflected orange was nearly tied with
// the generic red reference. Store colors only, not the private source photo.
const reflectedOrangePhoto: RGB[] = [
  [213, 49, 47], [218, 220, 12], [222, 221, 12],
  [231, 233, 14], [228, 229, 12], [224, 225, 13],
  [236, 62, 58], [232, 234, 13], [229, 230, 13],
  [22, 97, 202], [216, 48, 41], [2, 182, 8],
  [231, 90, 31], [229, 88, 30], [228, 97, 49],
  [218, 178, 151], [240, 100, 31], // occluded F center, visible R center
];

describe('photo last-layer state and formulas', () => {
  it('uses independent photo references to separate reflected orange from red', () => {
    const samples = classifyPhotoColors(reflectedOrangePhoto);
    expect(samples.slice(0, 15).map(s => s.color)).toEqual([
      'red', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'red', 'yellow', 'yellow',
      'blue', 'red', 'green', 'orange', 'orange', 'orange',
    ]);
    expect(samples.slice(0, 15).every(s => s.reliable)).toBe(true);
    expect(samples.slice(13, 15).map(s => s.calibrated)).toEqual([true, true]);
    expect(samples[15].reliable).toBe(false); // skin must not become a white-center anchor
  });
  it('does not let an uncertain color certify itself or use a near-tie as evidence', () => {
    expect(classifyPhotoColors([reflectedOrangePhoto[14]])[0].reliable).toBe(false);
    expect(classifyPhotoColors([...reflectedOrangePhoto, [228, 75, 39]]).at(-1)?.reliable).toBe(false);
  });
  it('routes the three stages to exactly the requested sets; solved/invalid states have none', () => {
    expect(photoAlgSets(fixture.states.oll)).toEqual(['ollcp', '1lll', 'oll']);
    expect(photoAlgSets(fixture.states.cross)).toEqual(['zbll', 'oll', 'coll']);
    expect(photoAlgSets(fixture.states.pll)).toEqual(['pll']);
    expect(photoAlgSets(SOLVED_FACELET)).toEqual([]);
    expect(photoAlgSets('U'.repeat(54))).toEqual([]);
  });
  it('uniquely completes all three representative states in all four U positions', () => {
    for (const facelet of Object.values(fixture.states)) for (const auf of ['', 'U', 'U2', "U'"]) {
      const state = toFaceletString(applyMoves(fromFaceletString(facelet)!, 3, parseScramble(auf)));
      expect(completeLastLayer(visible(state))).toEqual([state]);
    }
  });
  it('rejects contradictory measured stickers instead of repairing them', () => {
    const observed = visible(fixture.states.oll);
    expect(completeLastLayer({ ...observed, R: `U${observed.R.slice(1)}` })).toEqual([]);
    expect(completeLastLayer({ ...observed, U: 'U' })).toEqual([]);
  });
  it('validates actual output including both AUFs for each eligible set', () => {
    for (const facelet of Object.values(fixture.states)) for (const auf of ['', 'U', 'U2', "U'"]) {
      const state = applyMoves(fromFaceletString(facelet)!, 3, parseScramble(auf));
      const rotated = toFaceletString(state);
      for (const set of photoAlgSets(rotated)) {
        const match = findPhotoAlg(rotated, set, libraries[set]);
        expect(match, `${set}: ${auf}`).not.toBeNull();
        expect(photoAlgGoal(set, applyMoves(state, 3, parseScramble(match!.alg)))).toBe(true);
      }
    }
    expect(findPhotoAlg(fixture.states.oll, 'pll', libraries.pll)).toBeNull();
  });
  it('rejects a library candidate that matches a label but does not reach the goal', () => {
    const file: AlgFile = { ...libraries['1lll'], cases: libraries['1lll'].cases.map(c => ({ ...c, algs: [[{ alg: 'R U' }]] })) };
    expect(findPhotoAlg(fixture.states.oll, '1lll', file)).toBeNull();
  });
  it('handles PLL skip as an exact U adjustment without needing a library case', () => {
    for (const auf of ['U', 'U2', "U'"]) {
      const state = applyMoves(fromFaceletString(SOLVED_FACELET)!, 3, parseScramble(auf));
      const match = photoAufOnly(toFaceletString(state));
      expect(match?.caseName).toBe('PLL skip');
      expect(toFaceletString(applyMoves(state, 3, parseScramble(match!.alg)))).toBe(SOLVED_FACELET);
    }
    expect(photoAufOnly(fixture.states.pll)).toBeNull();
    expect(photoAufOnly(SOLVED_FACELET)).toBeNull();
  });
  it('reads ordered pixels and completes the state using the standard center frame', async () => {
    expect(standardColorFrames()).toHaveLength(24);
    const image = cubePhotoFixture(false, .1, fixture.states.oll);
    const { data, info } = await sharp(Buffer.from(image.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = recognizePhoto({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) }, image.corners as CubeCorners);
    expect(result.status).toBe('ok');
    expect(result.candidates).toEqual([{ facelet: fixture.states.oll, frame: { U: 'yellow', R: 'red', F: 'blue', D: 'white', L: 'orange', B: 'green' } }]);
    const invalid = recognizePhoto({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) }, image.corners as CubeCorners, { 12: 'yellow' });
    expect(invalid.status).toBe('invalid');
  });
  it('shares the analysis pipeline while preserving successful sets when one catalog fails', async () => {
    const image = cubePhotoFixture(false, .1, fixture.states.cross);
    const { data, info } = await sharp(Buffer.from(image.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const input = { pixels: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) }, corners: image.corners as CubeCorners, corrections: {} };
    const result = await analyzeCubePhoto(input, async set => {
      if (set === 'coll') throw new Error('unavailable');
      return libraries[set];
    });
    expect(result.recognition.status).toBe('ok');
    expect(result.results.map(r => [r.set, r.status])).toEqual([['zbll', 'found'], ['oll', 'found'], ['coll', 'error']]);
    const subset = await analyzeCubePhoto({ ...input, sets: ['oll', 'pll'] }, async set => libraries[set]);
    expect(subset.results.map(r => r.set)).toEqual(['oll']);
  });
});
