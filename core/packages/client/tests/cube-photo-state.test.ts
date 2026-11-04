import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { AlgFile } from '@cuberoot/shared/alg';
import { SOLVED_FACELET } from '@cuberoot/shared/cube-facelet';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { applyMoves, fromFaceletString, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { classifyPhotoColors, completeLastLayer, recognizePhoto, standardColorFrames } from '@/lib/cube-photo/recognize';
import type { RGB } from '@/lib/cube-photo';
import { findPhotoAlg, findPhotoAlternatives, photoAlgGoal, photoAlgSets, photoRecognitionSets, photoRecognitionInput, photoAufOnly, type PhotoAlgSet } from '@/lib/cube-photo/lookup';
import type { CubeCorners } from '@/lib/cube-photo/geometry';
import { cubePhotoFixture } from '@cuberoot/shared/testing/cube-photo';
import fixture from '@cuberoot/shared/testing/cube-photo-algs';
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

// Independent center patches from the reported photo, including its shadowed
// blue corner and low-confidence reflected side center. No source image retained.
const grayBluePhoto: RGB[] = [
  [35, 176, 30], [232, 233, 17], [252, 122, 30], [236, 239, 17], [234, 238, 18],
  [23, 188, 18], [50, 108, 182], [80, 134, 198], [233, 240, 16],
  [215, 218, 15], [211, 217, 15], [193, 63, 38], [53, 81, 40], [140, 146, 46], [84, 91, 102],
  [44, 144, 29], [172, 91, 68],
];
// Center-patch medians from the reported Sune screenshot. The shaded R edge
// retains blue hue but has about half the chroma of the independent U corner.
const shadedSunePhoto: RGB[] = [
  [0, 165, 19], [223, 219, 1], [0, 77, 167], [227, 226, 0], [222, 204, 20],
  [229, 230, 0], [239, 237, 1], [232, 233, 0], [255, 100, 0],
  [230, 54, 47], [35, 169, 34], [226, 221, 1], [50, 114, 25], [53, 61, 103], [177, 186, 48],
  [173, 77, 55], [45, 116, 27],
];
async function sampledPhoto(colors: RGB[]) {
  const image = cubePhotoFixture(false, .1, fixture.states.oll);
  const patches = new Map<number, RGB>([[15, colors[15]], [25, colors[16]]]);
  for (let i = 0; i < 9; i++) patches.set(i + 1, colors[i]);
  for (let i = 0; i < 3; i++) { patches.set(11 + i, colors[9 + i]); patches.set(21 + i, colors[12 + i]); }
  let polygon = 0;
  const svg = image.svg.replace(/<polygon[^>]+>/g, tag => {
    const rgb = patches.get(polygon++);
    return rgb ? tag.replace(/fill="[^"]+"/, `fill="rgb(${rgb.join(',')})"`) : tag;
  });
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { pixels: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) }, corners: image.corners as CubeCorners };
}

describe('photo last-layer state and formulas', () => {
  it('recovers the shaded Sune edge from independent color evidence and returns ZBLL', async () => {
    expect(classifyPhotoColors([shadedSunePhoto[13]])[0].reliable).toBe(false);
    const { pixels, corners } = await sampledPhoto(shadedSunePhoto);
    const zbll: AlgFile = { ...libraries.zbll, cases: [{ ...libraries.zbll.cases[0], name: 'S+L2',
      algs: [[{ alg: "L U2' L F L' U' L' U L F' U2 L'" }]] }] };
    const result = await analyzeCubePhoto({ pixels, corners, corrections: {} }, async set => set === 'zbll' ? zbll : libraries[set]);
    expect(result.recognition.status).toBe('ok');
    expect(result.recognition.candidates.map(c => c.facelet)).toEqual([
      'RULUUUUUBRLURRRRRRFRUFFFFFFDDDDDDDDDFFLLLLLLLBBUBBBBBB',
    ]);
    expect(result.recognition.samples[13]).toMatchObject({ rgb: shadedSunePhoto[13], color: 'blue', reliable: true, calibrated: true, corrected: false });
    expect(result.recognition.samples[13].inferred).toBeUndefined();
    expect(photoRecognitionSets(result.recognition)).toEqual(['oll', 'cmll', 'coll', 'zbll']);
    const zbllResult = result.results.find(r => r.set === 'zbll')!;
    expect(zbllResult.status).toBe('found');
    expect(zbllResult.match?.caseName).toBe('S+L2');
    expect(photoAlgGoal('zbll', applyMoves(fromFaceletString(result.recognition.candidates[0].facelet)!, 3,
      parseScramble(zbllResult.match!.alg)))).toBe(true);
    // A gray edge still admits three permutations; never pick one for ZBLL.
    const unknown = await sampledPhoto(shadedSunePhoto.map((rgb, i) => i === 13 ? [46, 50, 57] : rgb));
    const partial = recognizePhoto(unknown.pixels, unknown.corners);
    expect(partial.status).toBe('partial');
    expect(partial.candidates.map(c => c.facelet)).toEqual([
      'RULUUUUUBRFURRRRRRFRUFFFFFFDDDDDDDDDFBLLLLLLLBLUBBBBBB',
      'RULUUUUUBRLURRRRRRFRUFFFFFFDDDDDDDDDFFLLLLLLLBBUBBBBBB',
      'RULUUUUUBRBURRRRRRFRUFFFFFFDDDDDDDDDFLLLLLLLLBFUBBBBBB',
    ]);
    expect(photoRecognitionSets(partial)).toEqual(['oll', 'cmll', 'coll']);
    expect(findPhotoAlg(photoRecognitionInput(partial)!, 'zbll', zbll)).toBeNull();
    const explicit = recognizePhoto(pixels, corners, { 13: 'red' });
    expect(explicit.status).toBe('ok');
    expect(explicit.samples[13]).toMatchObject({ color: 'red', reliable: true, corrected: true });
    expect(explicit.candidates[0].facelet).toBe(partial.candidates[0].facelet);
  });
  it('infers two shaded orange corners without letting red calibration certify them', async () => {
    const colors: RGB[] = [
      [3, 203, 54], [0, 197, 50], [31, 204, 68], [252, 252, 0], [251, 251, 0], [245, 246, 1],
      [0, 117, 225], [0, 121, 223], [22, 122, 222], [187, 171, 0], [164, 160, 0], [155, 155, 0],
      [173, 85, 57], [137, 9, 23], [159, 48, 2], [91, 127, 59], [168, 81, 54],
    ];
    const { pixels, corners } = await sampledPhoto(colors);
    const result = recognizePhoto(pixels, corners);
    expect(result.status).toBe('ok');
    expect(result.candidates[0].facelet).toBe('FFFUUUBBBRLRRRRRRRUUUFFFFFFDDDDDDDDDLRLLLLLLLUUUBBBBBB');
    for (const i of [12, 14]) expect(result.samples[i]).toMatchObject({ color: 'orange', inferred: true, reliable: false });
    const explicit = recognizePhoto(pixels, corners, { 12: 'red' });
    expect(explicit.status).toBe('uncertain-colors'); // the other corner is still uncertain
    expect(explicit.candidates).toEqual([]);
    expect(explicit.samples[12]).toMatchObject({ color: 'red', corrected: true, reliable: true });
    expect(explicit.samples[12].inferred).toBeUndefined();
  });
  it('returns only formulas that work for every completion of uncertain reflected stickers', async () => {
    const colors: RGB[] = [
      [245, 254, 10], [255, 107, 5], [245, 254, 9], [0, 100, 201], [249, 254, 9], [7, 171, 53],
      [254, 255, 11], [242, 47, 39], [252, 255, 10], [227, 68, 2], [190, 168, 3], [219, 69, 1],
      [52, 78, 117], [153, 161, 54], [82, 100, 130], [23, 69, 26], [201, 103, 73],
    ];
    const { pixels, corners } = await sampledPhoto(colors);
    const alg = "S R' U' R U R U R U' R' S'";
    const file: AlgFile = { ...libraries.oll, cases: [{ ...libraries.oll.cases[0], name: 'X (20)',
      algs: [[{ alg }, { alg: `${alg} R L R' L'` }]] }] };
    const result = await analyzeCubePhoto({ pixels, corners, corrections: {} }, async set => set === 'oll' ? file : libraries[set]);
    expect(result.recognition.status).toBe('partial');
    expect(result.recognition.candidates.map(c => c.facelet)).toEqual([
      'URUBUFULUBUBRRRRRRRURFFFFFFDDDDDDDDDFUFLLLLLLLULBBBBBB',
      'URUBUFULUBUFRRRRRRFURFFFFFFDDDDDDDDDLULLLLLLLRUBBBBBBB',
      'URUBUFULUBULRRRRRRLURFFFFFFDDDDDDDDDRUBLLLLLLFUFBBBBBB',
    ]);
    expect(result.recognition.samples.some(s => s.inferred)).toBe(false);
    expect(result.results.map(r => [r.set, r.status])).toEqual([['oll', 'found']]);
    expect(photoRecognitionSets(result.recognition)).toEqual(['oll', 'ollcp']);
    expect(result.results[0].alternatives).toHaveLength(1);
    for (const candidate of result.recognition.candidates) for (const match of [result.results[0].match!, ...result.results[0].alternatives!]) {
      expect(photoAlgGoal('oll', applyMoves(fromFaceletString(candidate.facelet)!, 3, parseScramble(match.alg)))).toBe(true);
    }
    const input = photoRecognitionInput(result.recognition)!;
    expect(findPhotoAlg(input, '1lll', libraries['1lll'])).toBeNull();
    // Agreeing on one candidate cannot certify a formula for another OLL shape.
    const conflicting = { candidates: [...result.recognition.candidates, { ...result.recognition.candidates[0], facelet: fixture.states.oll }] };
    expect(findPhotoAlg(conflicting, 'oll', file)).toBeNull();
  });
  it('uniquely infers the impossible opposite-color corner while retaining its measured evidence', async () => {
    const { pixels, corners } = await sampledPhoto(grayBluePhoto);
    expect(classifyPhotoColors(grayBluePhoto)[14]).toMatchObject({ color: 'white', reliable: true });
    const recognized = recognizePhoto(pixels, corners);
    expect(recognized.status).toBe('ok');
    expect(recognized.candidates[0].facelet).toBe('FURUUFBBUFUBRRRRRRUULFFFFFFDDDDDDDDDULLLLLLLLURRBBBBBB');
    expect(recognized.samples[14]).toMatchObject({ rgb: grayBluePhoto[14], color: 'blue', observedColor: 'white', inferred: true, reliable: false, corrected: false });
    expect(recognized.samples.slice(0, 14).some(s => s.inferred)).toBe(false);
    const explicit = recognizePhoto(pixels, corners, { 14: 'white' });
    expect(explicit.status).toBe('invalid');
    expect(explicit.samples[14].inferred).toBeUndefined();
  });
  it('does not select a completion when the visible evidence admits multiple corner states', async () => {
    const observed = { U: '????U????', F: '???', R: '???' };
    expect(completeLastLayer(observed, 2)).toHaveLength(2);
    const colors = grayBluePhoto.map((rgb, i) => [0, 2, 6, 8, 9, 11, 12, 14].includes(i) ? [12, 12, 12] as RGB : rgb);
    const { pixels, corners } = await sampledPhoto(colors);
    const recognized = recognizePhoto(pixels, corners);
    expect(recognized.status).toBe('uncertain-colors');
    expect(photoRecognitionSets(recognized)).toEqual([]);
    expect(recognized.samples.some(s => s.inferred)).toBe(false);
  });
  it('keeps opposite-color edges and recognizes only CMLL corners with an unsolved M slice', async () => {
    for (const moves of ['M', 'M2', "M'"]) {
      const actual = applyMoves(fromFaceletString(fixture.states.cross)!, 3, parseScramble(moves));
      const image = cubePhotoFixture(false, .1, toFaceletString(actual));
      const { data, info } = await sharp(Buffer.from(image.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const result = await analyzeCubePhoto({ pixels: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) }, corners: image.corners as CubeCorners, corrections: {} }, async set => libraries[set]);
      expect(result.recognition.status, moves).toBe('corners-only');
      expect(result.recognition.candidates).toEqual([]);
      expect(result.recognition.cornerCandidates).toHaveLength(1);
      expect(result.results.map(r => r.set)).toEqual(['cmll']);
      expect(result.results[0].status).toBe('found');
      expect(result.recognition.samples.filter((_, i) => [1, 3, 5, 7, 10, 13].includes(i)).some(s => s.inferred)).toBe(false);
      if (moves === 'M2') expect(result.recognition.samples[1]).toMatchObject({ color: 'white', reliable: true });
      for (const match of [result.results[0].match!, ...result.results[0].alternatives!]) {
        expect(photoAlgGoal('cmll', applyMoves(actual, 3, parseScramble(match.alg))), moves).toBe(true);
      }
      expect(findPhotoAlg(result.recognition.cornerCandidates![0], 'oll', libraries.oll)).toBeNull();
    }
  });
  it('recognizes a shadowed blue patch without inventing colors in dark neutral pixels', () => {
    // Measured patch only; do not commit the private handheld source photo.
    const rgb: RGB = [10, 29, 57];
    const sample = classifyPhotoColors([rgb])[0];
    expect(sample.color).toBe('blue');
    expect(sample.reliable).toBe(true);
    expect(sample.rgb).toEqual(rgb);
    expect(sample.corrected).toBe(false);
    for (const dark of [[12, 12, 12], [46, 50, 57], [3, 9, 18]] as RGB[]) {
      expect(classifyPhotoColors([dark])[0].reliable).toBe(false);
    }
  });
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
    expect(photoAlgSets(fixture.states.oll)).toEqual(['oll', 'cmll', 'ollcp', '1lll']);
    expect(photoAlgSets(fixture.states.cross)).toEqual(['oll', 'cmll', 'coll', 'zbll']);
    expect(photoAlgSets(fixture.states.pll)).toEqual(['pll', 'cmll']);
    expect(photoAlgSets(SOLVED_FACELET)).toEqual([]);
    expect(photoAlgSets('U'.repeat(54))).toEqual([]);
  });
  it('uses the Roux CMLL finish line, allowing M-slice changes but rejecting broken blocks', () => {
    const solved = fromFaceletString(SOLVED_FACELET)!;
    for (const moves of ['M', 'M2', "M' U", 'M U2 M\' U']) {
      expect(photoAlgGoal('cmll', applyMoves(solved, 3, parseScramble(moves)))).toBe(true);
      expect(photoAlgGoal('coll', applyMoves(solved, 3, parseScramble(moves)))).toBe(false);
    }
    expect(photoAlgGoal('cmll', applyMoves(solved, 3, parseScramble('R')))).toBe(false);
    const first = findPhotoAlg(fixture.states.cross, 'cmll', libraries.cmll)!;
    const selected = libraries.cmll.cases.find(c => c.id === first.caseId)!;
    const file = { ...libraries.cmll, cases: [{ ...selected, algs: [[{ alg: `${first.body} M` }]] }] };
    expect(findPhotoAlg(fixture.states.cross, 'cmll', file)).not.toBeNull();
  });
  it('requires both corner orientation and permutation for ELL, handles AUF, and keeps EPLL in PLL', () => {
    expect(photoAlgSets(fixture.states.pll)).not.toContain('ell'); // oriented corners, wrong permutation
    for (const auf of ['', 'U', 'U2', "U'"]) {
      const state = applyMoves(fromFaceletString(fixture.extraStates.ell)!, 3, parseScramble(auf));
      const facelet = toFaceletString(state);
      expect(photoAlgSets(facelet)).toEqual(['oll', 'ell', 'ollcp', '1lll']);
      const match = findPhotoAlg(facelet, 'ell', libraries.ell)!;
      expect(match).not.toBeNull();
      expect(photoAlgGoal('ell', applyMoves(state, 3, parseScramble(match.alg)))).toBe(true);
      for (const alternative of findPhotoAlternatives(facelet, match, libraries.ell)) {
        expect(photoAlgGoal('ell', applyMoves(state, 3, parseScramble(alternative.alg)))).toBe(true);
      }
    }
    const epll = toFaceletString(applyMoves(fromFaceletString(SOLVED_FACELET)!, 3, parseScramble('M2 U M2 U2 M2 U M2')));
    expect(photoAlgSets(epll)).toEqual(['pll']);
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
  it('returns distinct alternatives from the matched case with independently verified AUFs', () => {
    for (const facelet of Object.values(fixture.states)) for (const auf of ['', 'U', 'U2', "U'"]) {
      const state = applyMoves(fromFaceletString(facelet)!, 3, parseScramble(auf));
      const rotated = toFaceletString(state);
      for (const set of photoAlgSets(rotated)) {
        const first = findPhotoAlg(rotated, set, libraries[set])!;
        const selected = libraries[set].cases.find(c => first.caseId != null ? c.id === first.caseId : c.name === first.caseName)!;
        // Opposite faces commute, giving a distinct but equivalent test entry.
        const otherBody = `${first.body} R L R' L'`;
        const file: AlgFile = { ...libraries[set], cases: [
          { ...selected, algs: [[{ alg: first.body! }, { alg: otherBody }, { alg: otherBody }, { alg: 'R U' }, { alg: 'invalid' }]] },
          { ...selected, id: -1, name: 'Unrelated case', meta: undefined, algs: [[{ alg: `${first.body} F B F' B'` }]] },
        ] };
        expect(findPhotoAlg(rotated, set, file)).toEqual(first);
        const alternatives = findPhotoAlternatives(rotated, first, file);
        expect(alternatives).toHaveLength(1);
        expect(alternatives[0].body).toBe(otherBody);
        expect(alternatives[0].href).toBe(first.href);
        expect(alternatives[0].alg).not.toBe(first.alg);
        expect(photoAlgGoal(set, applyMoves(state, 3, parseScramble(alternatives[0].alg)))).toBe(true);
      }
    }
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
  it('invalidates prepared moves if a catalog entry changes without replacing its object', () => {
    const file = structuredClone(libraries.oll);
    const first = findPhotoAlg(fixture.states.oll, 'oll', file)!;
    const selected = file.cases.find(c => c.name === first.caseName)!;
    const entry = { alg: first.body! };
    file.cases = [{ ...selected, algs: [[entry]] }];
    expect(findPhotoAlg(fixture.states.oll, 'oll', file)?.alg).toBe(first.alg);
    entry.alg = 'invalid';
    expect(findPhotoAlg(fixture.states.oll, 'oll', file)).toBeNull();
    entry.alg = first.body!;
    expect(findPhotoAlg(fixture.states.oll, 'oll', file)?.alg).toBe(first.alg);
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
    expect(result.results.map(r => [r.set, r.status])).toEqual([['oll', 'found'], ['cmll', 'found'], ['coll', 'error'], ['zbll', 'found']]);
    for (const item of result.results.filter(r => r.status === 'found')) {
      expect(item.alternatives).toEqual(findPhotoAlternatives(fixture.states.cross, item.match!, libraries[item.set]));
    }
    const subset = await analyzeCubePhoto({ ...input, sets: ['oll', 'pll'] }, async set => libraries[set]);
    expect(subset.results.map(r => r.set)).toEqual(['oll']);
  });
  it('cancels obsolete analysis after catalog loading without emitting stale algorithms', async () => {
    const image = cubePhotoFixture(false, .1, fixture.states.oll);
    const { data, info } = await sharp(Buffer.from(image.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const controller = new AbortController();
    const messages: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const analysis = analyzeCubePhoto({ pixels: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) }, corners: image.corners as CubeCorners, corrections: {} },
      async set => { await gate; return libraries[set]; }, message => messages.push(message.type), controller.signal);
    controller.abort(); release();
    await expect(analysis).rejects.toMatchObject({ name: 'AbortError' });
    expect(messages).toEqual(['state']);
  });
});
