import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { applyScramble, applyMoves, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { invertMoveString, toMoveStringStrict } from '@cuberoot/shared/alg-notation';
import { COLOR_RGB, classifyPhotoColors, sampleFace, standardColorFrames, type StickerSample } from '@cuberoot/shared/cube-photo/recognize';
import { recoverPocket, pocketFaces, pocketSolved, recognizePocket } from '@cuberoot/shared/cube-photo/pocket';
import { detectCubePhoto } from '@cuberoot/shared/cube-photo/detect';
import { faceGrid, faceQuad } from '@cuberoot/shared/cube-photo/geometry';
import { analyzeCubePhoto, locateCubePhotoAuto } from '@cuberoot/shared/cube-photo/analyze';
import { findPhotoAlg, photoAlgGoal, photoRecognitionInput, photoRecognitionSets } from '@cuberoot/shared/cube-photo/lookup';
import { cubePhotoFixture } from '@cuberoot/shared/testing/cube-photo';
import threeByThree from '@cuberoot/shared/testing/cube-photo-algs';
import type { AlgFile } from '@cuberoot/shared/alg';
import catalogs from './fixtures/cube-photo-2x2-algs.json';
import extendedCatalogs from './fixtures/cube-photo-2x2-extended-algs.json';

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
  it('passes the last-slot stage through pixel recognition and catalog verification', async () => {
    const file = extendedCatalogs.ls4 as AlgFile;
    const state = toFaceletString(applyScramble(2, invertMoveString(toMoveStringStrict(file.cases[0].algs.flat()[0].alg))));
    const fixture = cubePhotoFixture(false, .1, state, 2);
    const { data, info } = await sharp(Buffer.from(fixture.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
    const located = locateCubePhotoAuto(pixels, 3);
    expect(located.puzzleSize).toBe(2);
    const result = await analyzeCubePhoto({ puzzleSize: 2, pocketStage: 'last-slot', pixels, corners: located.detection.candidates[0].corners, corrections: {} },
      async set => extendedCatalogs[set as keyof typeof extendedCatalogs] as AlgFile);
    expect(result.recognition.status).toBe('ok');
    const match = result.results.find(r => r.set === 'ls4')?.match;
    expect(match).toBeDefined();
    expect(photoAlgGoal('ls4', applyMoves(pocketFaces(result.recognition.candidates[0].facelet)!, 2, parseScramble(match!.alg)))).toBe(true);
  });

  for (const [set, expected] of Object.entries({
    'tcll-plus': [1, 4, 2, 2], 'tcll-minus': [1, 2, 3, 2], 'teg2-plus': [1, 1, 2, 2],
    ls1: [2, 1, 4, 1], ls2: [2, 1, 1, 1], ls3: [2, 1, 1, 1],
    ls4: [1, 1, 1, 1], ls5: [1, 1, 2, 1], ls6: [1, 1, 3, 2],
    ls7: [1, 1, 3, 2], ls8: [1, 1, 3, 1], ls9: [1, 1, 1, 3],
  })) it(`recovers ${set} from sufficient views and rejects ambiguous full-solve formulas`, () => {
    const slug = set as keyof typeof extendedCatalogs;
    const file = extendedCatalogs[slug] as AlgFile;
    const state = applyScramble(2, invertMoveString(toMoveStringStrict(file.cases[0].algs.flat()[0].alg)));
    ['', 'y', 'y2', "y'"].forEach((rotation, i) => {
      const facelet = toFaceletString(applyMoves(state, 2, parseScramble(rotation)));
      const recognition = recoverPocket(samplesFor(facelet), undefined, 3);
      expect(recognition.candidates).toHaveLength(expected[i]);
      expect(photoRecognitionSets(recognition)).toContain(slug);
      const match = findPhotoAlg(photoRecognitionInput(recognition)!, slug, file);
      if (expected[i] === 1) {
        expect(match).not.toBeNull();
        expect(photoAlgGoal(slug, applyMoves(pocketFaces(recognition.candidates[0].facelet)!, 2, parseScramble(match!.alg)))).toBe(true);
      } else expect(match).toBeNull();
    });
  });

  it('uses two independent blue patches to recover a borderline bottom corner and its CLL', () => {
    // Patch medians after compression; retain no private source image.
    const colors: Parameters<typeof classifyPhotoColors>[0] = [
      [246, 75, 28], [165, 2, 18], [198, 190, 184], [188, 181, 170],
      [41, 129, 27], [28, 92, 15], [116, 28, 28], [104, 21, 26],
      [233, 3, 32], [30, 150, 218], [38, 143, 208], [41, 146, 210],
    ];
    expect(classifyPhotoColors([colors[11]])[0].reliable).toBe(false);
    expect(classifyPhotoColors([colors[9], colors[11]])[1].reliable).toBe(false);
    const samples = classifyPhotoColors(colors);
    expect(samples[11]).toMatchObject({ color: 'blue', reliable: true, calibrated: true, corrected: false });
    const recognition = recoverPocket(samples);
    expect(recognition.status).toBe('ok');
    expect(recognition.candidates.map(c => c.facelet)).toEqual(['LRUURBBBFFRRDDDDBLFFUULL']);
    // Pin the matching public-library entry; the small shared catalog fixture
    // only contains representative cases and does not include CLL U 2.
    const cll: AlgFile = { ...catalogs.cll, cases: [{
      name: 'CLL U 2', subgroup: 'U', setup: "R' U R' F R2' U2' R' U' R' F2' R2'",
      sticker: { ub: 'yybb', uf: 'rrgg', ul: 'obrr', ur: 'gooo', us: 'bgyy', kind: 'face' },
      algs: [[{ alg: "R2 F2 R U R U2 R2 F' R U' R" }]],
    }] };
    const match = findPhotoAlg(photoRecognitionInput(recognition)!, 'cll', cll);
    expect(match).not.toBeNull();
    expect(photoAlgGoal('cll', applyMoves(pocketFaces(recognition.candidates[0].facelet)!, 2, parseScramble(match!.alg)))).toBe(true);
  });

  it.each([2, 3] as const)('automatically selects size %i even when the other size was selected', async size => {
    const source = cubePhotoFixture(false, .1, size === 2 ? startingState('cll') : threeByThree.states.oll, size);
    const { data, info } = await sharp(Buffer.from(source.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
    const result = locateCubePhotoAuto(pixels, size === 2 ? 3 : 2);
    expect(result.puzzleSize).toBe(size);
    expect(result.detection.reason).toBe('ok');
  });

  it('keeps both side rows when both faces repeat the same upper-row colors', async () => {
    const fixture = cubePhotoFixture(false, .2, 'RFULBURRBUFFDDDDFRLLLUBB', 2);
    const { data, info } = await sharp(Buffer.from(fixture.svg)).blur(.8).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
    const detection = detectCubePhoto(pixels, 2);
    expect(detection.reason).toBe('ok');
    const corners = detection.candidates[0].corners;
    for (const i of [4, 5, 6]) expect(Math.hypot(corners[i].x - fixture.corners[i].x, corners[i].y - fixture.corners[i].y)).toBeLessThan(14);
    const recognition = recognizePocket(pixels, corners, {});
    expect(recognition.status).toBe('ok');
    // The two lower rows must not repeat the sampled upper-row colors.
    expect(recognition.samples.slice(6, 8).map(s => s.color)).not.toEqual(recognition.samples.slice(4, 6).map(s => s.color));
    expect(recognition.samples.slice(10, 12).map(s => s.color)).not.toEqual(recognition.samples.slice(8, 10).map(s => s.color));
  });

  it('samples the sticker surrounding a central blue logo', () => {
    const size = 180, data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const logo = x >= 118 && x < 152 && y >= 118 && y < 152;
      data.set([...(logo ? COLOR_RGB.blue : COLOR_RGB.white), 255], (y * size + x) * 4);
    }
    const colors = sampleFace({ width: size, height: size, data }, [
      { x: 0, y: 0 }, { x: 0, y: 179 }, { x: 179, y: 179 }, { x: 179, y: 0 },
      { x: 0, y: 179 }, { x: 179, y: 179 }, { x: 179, y: 0 },
    ], 'top', 2);
    expect(classifyPhotoColors(colors)[3]).toMatchObject({ color: 'white', reliable: true });
  });

  it('retains red/orange ambiguity without allowing an unrelated blue completion', () => {
    // Anonymous measured patches; the private source photo stays outside Git.
    const samples = classifyPhotoColors([
      [17, 160, 7], [240, 64, 17], [169, 11, 21], [188, 188, 180],
      [32, 169, 16], [156, 10, 20], [250, 81, 28], [237, 67, 24],
      [25, 129, 200], [243, 240, 235], [46, 223, 31], [46, 218, 35],
    ]);
    for (const i of [1, 6, 7]) expect(samples[i]).toMatchObject({ reliable: false, possibleColors: ['red', 'orange'] });
    expect(recoverPocket(samples.map(({ possibleColors, ...s }) => s)).candidates).toHaveLength(2);
    const result = recoverPocket(samples);
    expect(result.status).toBe('ok');
    expect(result.candidates).toHaveLength(1);
    expect(result.samples.map(s => s.color)).toEqual([
      'green', 'orange', 'red', 'white', 'green', 'red', 'orange', 'orange', 'blue', 'white', 'green', 'green',
    ]);
    for (const i of [1, 6, 7]) expect(result.samples[i]).toMatchObject({ inferred: true, corrected: false, reliable: false });
    expect(classifyPhotoColors([[30, 30, 30], [180, 160, 140]]).every(s => !s.possibleColors)).toBe(true);
    const corrected = samples.map(s => ({ ...s }));
    corrected[7] = { ...corrected[7], color: 'blue', corrected: true, reliable: true };
    expect(recoverPocket(corrected).samples[7]).toMatchObject({ color: 'blue', corrected: true });
  });

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
