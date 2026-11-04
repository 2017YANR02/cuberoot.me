import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { applyScramble, applyMoves, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { invertMoveString, toMoveStringStrict } from '@cuberoot/shared/alg-notation';
import { COLOR_RGB, standardColorFrames, type StickerSample } from '@cuberoot/shared/cube-photo/recognize';
import { recoverPocket, pocketFaces, pocketSolved, recognizePocket } from '@cuberoot/shared/cube-photo/pocket';
import { detectCubePhoto } from '@cuberoot/shared/cube-photo/detect';
import { faceGrid, faceQuad } from '@cuberoot/shared/cube-photo/geometry';
import { analyzeCubePhoto } from '@cuberoot/shared/cube-photo/analyze';
import { findPhotoAlg, photoAlgGoal, photoRecognitionInput, photoRecognitionSets } from '@cuberoot/shared/cube-photo/lookup';
import { cubePhotoFixture } from '@cuberoot/shared/testing/cube-photo';
import type { AlgFile } from '@cuberoot/shared/alg';
import catalogs from './fixtures/cube-photo-2x2-algs.json';

const frame = standardColorFrames().find(f => f.U === 'yellow' && f.F === 'blue')!;
function samplesFor(facelet: string): StickerSample[] {
  return [...facelet.slice(0, 4), ...facelet.slice(8, 12), ...facelet.slice(4, 8)].map(face => {
    const color = frame[face as keyof typeof frame];
    return { color, rgb: COLOR_RGB[color], margin: 30, distance: 0, reliable: true, corrected: false, calibrated: false };
  });
}
// Real library entries, pinned locally so CI never depends on a mutable catalog.
function startingState(set: keyof typeof catalogs) {
  for (const c of catalogs[set].cases) for (const entry of c.algs.flat()) {
    const state = applyScramble(2, invertMoveString(toMoveStringStrict(entry.alg)));
    if (state.D.every(color => color === 'D') && !pocketSolved(state)) return toFaceletString(state);
  }
  throw new Error(`No monochrome-bottom fixture for ${set}`);
}

describe('2x2 photo lookup', () => {
  for (const set of ['ortega-oll', 'cll', 'eg1', 'eg2', 'ortega-pbl'] as const) {
    it(`recovers all corners and verifies a real ${set} formula from the photographed orientation`, () => {
      const input = startingState(set);
      for (const rotation of ['', 'y U', "y2 U'", "y' U2"]) {
        const facelet = toFaceletString(applyMoves(pocketFaces(input)!, 2, parseScramble(rotation)));
        const recognition = recoverPocket(samplesFor(facelet));
        expect(recognition.status).toBe('ok');
        expect(recognition.candidates).toHaveLength(1);
        const recovered = recognition.candidates[0];
        expect([...recovered.facelet].map(f => recovered.frame[f as keyof typeof frame])).toEqual([...facelet].map(f => frame[f as keyof typeof frame]));
        expect(photoRecognitionSets(recognition)).toContain(set);
        const match = findPhotoAlg(photoRecognitionInput(recognition)!, set, catalogs[set] as AlgFile);
        expect(match?.puzzle).toBe('2x2');
        expect(match?.href).toContain(`/alg/2x2/${set}/`);
        expect(photoAlgGoal(set, applyMoves(pocketFaces(recovered.facelet)!, 2, parseScramble(match!.alg)))).toBe(true);
      }
    });
  }

  it('infers a missing sticker only from a unique physical completion', () => {
    const samples = samplesFor(startingState('eg1'));
    samples[5] = { ...samples[5], color: 'white', reliable: false };
    const recognition = recoverPocket(samples, 'yellow');
    expect(recognition.status).toBe('ok');
    expect(recognition.samples[5].inferred).toBe(true);
    expect(recognition.samples[5].color).toBe(samplesFor(startingState('eg1'))[5].color);
    const missingBottom = samplesFor(startingState('eg1'));
    missingBottom[11] = { ...missingBottom[11], reliable: false };
    const ambiguous = recoverPocket(missingBottom, 'yellow');
    expect(ambiguous.status).toBe('partial');
    expect(ambiguous.candidates).toHaveLength(2);
  });

  it('does not fabricate a solved bottom permutation when its side stickers are missing', () => {
    const samples = samplesFor(startingState('cll'));
    for (const i of [6, 7, 10, 11]) samples[i] = { ...samples[i], reliable: false };
    const recognition = recoverPocket(samples, 'yellow');
    expect(recognition.status).toBe('partial');
    expect(recognition.candidates).toHaveLength(24);
    expect(findPhotoAlg(photoRecognitionInput(recognition)!, 'cll', catalogs.cll as AlgFile)).toBeNull();
    expect(findPhotoAlg(photoRecognitionInput(recognition)!, 'ortega-oll', catalogs['ortega-oll'] as AlgFile)).not.toBeNull();
  });

  it('rejects contradictory explicit corrections and bounded ambiguous searches', () => {
    const samples = samplesFor(startingState('cll'));
    samples[5] = { ...samples[5], color: samples[8].color, corrected: true };
    expect(recoverPocket(samples).status).toBe('invalid');
    const uncertain = samples.map(s => ({ ...s, reliable: false, corrected: false }));
    expect(recoverPocket(uncertain).status).toBe('ambiguous');
    expect(recoverPocket(uncertain).candidates).toHaveLength(0);
  });

  it.each(['ortega-oll', 'cll', 'eg1', 'eg2', 'ortega-pbl'] as const)('detects a 2x2 %s photo, samples both side rows and verifies the result', async set => {
    const fixture = cubePhotoFixture(false, .1, startingState(set), 2);
    const { data, info } = await sharp(Buffer.from(fixture.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
    const detection = detectCubePhoto(pixels, 2);
    expect(detection.reason).toBe('ok');
    const corners = detection.candidates[0].corners;
    expect(corners.every((p, i) => Math.hypot(p.x - fixture.corners[i].x, p.y - fixture.corners[i].y) < 14), JSON.stringify({ corners, expected: fixture.corners })).toBe(true);
    expect(faceGrid(faceQuad(corners, 'left'), 'left', 2)).toHaveLength(6);
    expect(faceGrid(faceQuad(corners, 'left'), 'left', 2).some(line => line.inferred)).toBe(false);
    const recognized = recognizePocket(pixels, corners, {});
    expect(recognized.samples).toHaveLength(12);
    expect(recognized.status).toBe('ok');
    const result = await analyzeCubePhoto({ puzzleSize: 2, pixels, corners, corrections: {} },
      async set => catalogs[set as keyof typeof catalogs] as AlgFile);
    expect(result.results.find(r => r.set === set)?.status).toBe('found');
    expect(result.results.some(r => r.status === 'missing')).toBe(false);
  });
});
