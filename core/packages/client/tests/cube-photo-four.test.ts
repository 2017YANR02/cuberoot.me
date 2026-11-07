import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { AlgFile } from '@cuberoot/shared/alg';
import { applyMoves, applyScramble, solved } from '@cuberoot/shared/timer/reconstruct/state';
import { expandAllInnerSlices, invertMoveString, toMoveStringStrict } from '@cuberoot/shared/alg-notation';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { cubePhotoFixture } from '@cuberoot/shared/testing/cube-photo';
import { recognizeFour } from '@cuberoot/shared/cube-photo/recognize';
import { findPhotoAlg, photoAlgSets, photoAlgGoal } from '@cuberoot/shared/cube-photo/lookup';
import { locateCubePhotoAuto } from '@cuberoot/shared/cube-photo/analyze';
import type { CubeCorners } from '@cuberoot/shared/cube-photo/geometry';
import { parseAlgorithm } from '@cuberoot/visualcube';
import catalogs from './fixtures/cube-photo-4x4-algs.json';

const files = catalogs as Record<'oll-parity' | 'pll-parity', AlgFile>;
const expanded = (alg: string) => expandAllInnerSlices(toMoveStringStrict(alg)).replace(/\b2([RL])(2'?|')?(?=\s|$)/g,
  (_, face: string, suffix = '') => face + 'w' + suffix + ' ' + invertMoveString(face + suffix));
const text = (state: ReturnType<typeof solved>) => (['U','R','F','D','L','B'] as const).map(f => state[f].join('')).join('');
const opp = expanded(files['pll-parity'].cases[0].algs.flat()[0].alg);
const makeState = (set: 'oll-parity' | 'pll-parity', alg: string) => applyScramble(4,
  (set === 'oll-parity' ? opp + ' ' : '') + invertMoveString(expanded(alg)));

describe('four-layer photo lookup', () => {
  for (const set of ['oll-parity', 'pll-parity'] as const) for (const c of files[set].cases) {
    it('recovers and verifies ' + set + '/' + c.name, async () => {
      const state = makeState(set, c.algs.flat()[0].alg);
      const facelet = text(state);
      expect(photoAlgSets(facelet)).toContain(set);
      const fixture = cubePhotoFixture(false, .1, facelet, 4);
      const { data, info } = await sharp(Buffer.from(fixture.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const image = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
      const recognition = recognizeFour(image, fixture.corners as CubeCorners);
      expect(recognition.status).toBe('ok');
      expect(recognition.candidates[0].facelet).toBe(facelet);
      const match = findPhotoAlg(facelet, set, files[set]);
      expect(match).not.toBeNull();
      expect(photoAlgGoal(set, applyMoves(state, 4, parseScramble(expanded(match!.alg))))).toBe(true);
    });
  }
  it('automatically detects four layers when three layers were selected', async () => {
    const fixture = cubePhotoFixture(false, .1, text(makeState('pll-parity', files['pll-parity'].cases[0].algs.flat()[0].alg)), 4);
    const { data, info } = await sharp(Buffer.from(fixture.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = locateCubePhotoAuto({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) }, 3);
    expect(result.puzzleSize).toBe(4);
  });
  it('does not treat a normal solved cube as a PPLL case', () => {
    expect(photoAlgSets(text(solved(4)))).toEqual([]);
  });
  it('draws the M case with all-inner slices, including inverse and half turns', () => {
    expect(parseAlgorithm('m')).toEqual(parseAlgorithm("R L' x'"));
    expect(parseAlgorithm("m'")).toEqual(parseAlgorithm("x L R'"));
    for (const alg of ["m", "m'", 'm2', "e s' m2"]) {
      expect(parseAlgorithm(alg)).toEqual(parseAlgorithm(expandAllInnerSlices(alg)));
      expect(parseAlgorithm(alg).length).toBeGreaterThan(0);
    }
  });
});
