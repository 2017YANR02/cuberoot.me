import { CORNER_FACELET, EDGE_FACELET, cubieToFacelet, validateFacelet, type CubieCube } from '../cube_facelet';
import { applyScramble } from '../timer/reconstruct/state';
import { CANONICAL_RGB, linearToLab, sampleGridColors, srgbToLab, srgbToLinear, type Lab, type PhotoFace, type RGB } from './scan';
import { faceQuad, homography, project, type CubeCorners, type FaceName } from './geometry';
import type { PhotoPixels } from './detect';

export const COLOR_NAMES = {
  white: { zh: '白', en: 'White' }, red: { zh: '红', en: 'Red' }, green: { zh: '绿', en: 'Green' },
  yellow: { zh: '黄', en: 'Yellow' }, orange: { zh: '橙', en: 'Orange' }, blue: { zh: '蓝', en: 'Blue' },
};
export type CubeColor = keyof typeof COLOR_NAMES;
export const COLOR_ORDER = Object.keys(COLOR_NAMES) as CubeColor[];
const STANDARD: Record<PhotoFace, CubeColor> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
export const COLOR_RGB = Object.fromEntries(Object.entries(STANDARD).map(([face, color]) => [color, CANONICAL_RGB[face as PhotoFace]])) as Record<CubeColor, RGB>;
export type ColorFrame = Record<PhotoFace, CubeColor>;
export interface StickerSample { rgb: RGB; color: CubeColor; margin: number; distance: number; reliable: boolean; corrected: boolean; calibrated: boolean }
export interface VisibleLastLayer { U: string; F: string; R: string }
export interface RecoveredState { facelet: string; frame: ColorFrame }
export interface PhotoRecognition {
  /** U row-major (back to front), then F top row, then R top row. */
  samples: StickerSample[];
  centers: { F: StickerSample; R: StickerSample };
  candidates: RecoveredState[];
  status: 'ok' | 'uncertain-colors' | 'ambiguous' | 'invalid';
}

const REFERENCES = COLOR_ORDER.map(color => ({ color, lab: srgbToLab(COLOR_RGB[color]) }));
function rankColors(lab: Lab, references = REFERENCES) {
  return references.map(ref => ({ color: ref.color, distance: Math.hypot(
    .4 * (lab[0] - ref.lab[0]), lab[1] - ref.lab[1], lab[2] - ref.lab[2],
  ) })).sort((a, b) => a.distance - b.distance);
}
function classify(rgb: RGB, references = REFERENCES, lab = srgbToLab(rgb)): StickerSample {
  const ranked = rankColors(lab, references);
  const best = ranked[0], margin = ranked[1].distance - best.distance;
  // Skin/shadows may be nearest to white without being a white sticker. These
  // are rejection gates, not calibrated probabilities; corrections stay explicit.
  const plausibleWhite = best.color !== 'white' || (Math.max(...rgb) > 80 && Math.hypot(lab[1], lab[2]) < 18);
  return { rgb, color: best.color, margin, distance: best.distance,
    reliable: margin >= 8 && best.distance < 48 && plausibleWhite, corrected: false, calibrated: false };
}

/** Dark blue loses Lab chroma and can be nearer white than a lit blue reference.
 * For an otherwise uncertain, visibly chromatic patch, try a bounded neutral
 * exposure lift in linear RGB. Preserve the measured RGB and reject near-black,
 * neutral, or still ambiguous patches; cube legality never participates.
 */
function classifyExposure(rgb: RGB): StickerSample {
  const initial = classify(rgb), hi = Math.max(...rgb), lo = Math.min(...rgb);
  if (initial.reliable || hi < 40 || hi >= 100 || (hi - lo) / hi < 0.5) return initial;
  const linear = srgbToLinear(rgb);
  const gain = Math.min(12, srgbToLinear([180, 180, 180])[0] / Math.max(...linear));
  const lifted = classify(rgb, REFERENCES, linearToLab(linear.map(c => c * gain)));
  return lifted.color !== 'white' && lifted.reliable && lifted.margin >= 12 && lifted.distance <= 24 ? lifted : initial;
}

/** One calibration pass from independent, confidently labeled cells in THIS photo.
 * Uncertain cells never train their own reference and strong readings never move.
 * Cube legality is deliberately not used to choose a pixel's color.
 */
export function classifyPhotoColors(colors: readonly RGB[]): StickerSample[] {
  const initial = colors.map(classifyExposure);
  const photoRefs = new Map<CubeColor, RGB>();
  for (const color of COLOR_ORDER) {
    const anchors = initial.filter(s => s.color === color && s.reliable && s.margin >= 12);
    if (!anchors.length) continue;
    const median = (channel: number) => {
      const values = anchors.map(s => s.rgb[channel]).sort((a, b) => a - b), mid = values.length >> 1;
      return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    };
    photoRefs.set(color, [median(0), median(1), median(2)]);
  }
  const references = REFERENCES.map(ref => ({ ...ref, lab: photoRefs.has(ref.color) ? srgbToLab(photoRefs.get(ref.color)!) : ref.lab }));
  return initial.map(sample => {
    if (sample.reliable) return sample;
    const adjusted = classify(sample.rgb, references);
    // Require actual photo support, bounded distance, and one of the original
    // two plausible colors. Do not turn a background/occlusion into a sticker.
    const plausible = rankColors(srgbToLab(sample.rgb)).slice(0, 2).some(r => r.color === adjusted.color);
    // Reflections can reduce chroma and compress absolute Lab gaps. With an
    // independent photo reference, require a clear relative gap as well as a
    // minimum absolute gap; an almost tied red/orange reading still fails.
    const separated = adjusted.reliable || (adjusted.color !== 'white' && adjusted.margin >= 4
      && adjusted.distance <= .65 * (adjusted.distance + adjusted.margin));
    return separated && adjusted.distance <= 24 && photoRefs.has(adjusted.color) && plausible
      ? { ...adjusted, reliable: true, calibrated: true } : sample;
  });
}

function sampleFace(image: PhotoPixels, corners: CubeCorners, face: FaceName): RGB[] {
  const h = homography(faceQuad(corners, face));
  if (!h) throw new Error('invalid-grid');
  const size = 90, rectified = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = project(h, (x + .5) / size, (y + .5) / size);
    const sx = Math.max(0, Math.min(image.width - 1, Math.round(p.x)));
    const sy = Math.max(0, Math.min(image.height - 1, Math.round(p.y)));
    const offset = (sy * image.width + sx) * 4;
    rectified.set(image.data.subarray(offset, offset + 4), (y * size + x) * 4);
  }
  return sampleGridColors(rectified, size, 3, .35);
}

let frames: ColorFrame[] | undefined;
export function standardColorFrames(): readonly ColorFrame[] {
  if (frames) return frames;
  frames = [];
  const seen = new Set<string>(), queue = [''];
  for (let i = 0; i < queue.length; i++) {
    const rotation = queue[i], state = applyScramble(3, rotation);
    const frame = Object.fromEntries(Object.keys(STANDARD).map(face => [face, STANDARD[state[face as PhotoFace][4]]])) as ColorFrame;
    const key = Object.values(frame).join();
    if (seen.has(key)) continue;
    seen.add(key); frames.push(frame);
    for (const move of ['x', 'y', 'z']) queue.push(`${rotation} ${move}`);
  }
  return frames;
}

function permutations(values: number[]): number[][] {
  return values.length ? values.flatMap((v, i) => permutations(values.filter((_, j) => i !== j)).map(p => [v, ...p])) : [[]];
}
const PERMUTATIONS = permutations([0, 1, 2, 3]);
const parity = (p: number[]) => p.reduce((sum, v, i) => sum + p.slice(i + 1).filter(w => v > w).length, 0) % 2;
const solved = (): CubieCube => ({ cp: [0, 1, 2, 3, 4, 5, 6, 7], co: Array(8).fill(0), ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: Array(12).fill(0) });

/** Exact completion under solved F2L. Never fixes a measured sticker to force a match. */
export function completeLastLayer(observed: VisibleLastLayer): string[] {
  if (!/^[URFDLB]{9}$/.test(observed.U) || !/^[URFDLB]{3}$/.test(observed.F) || !/^[URFDLB]{3}$/.test(observed.R) || observed.U[4] !== 'U') return [];
  const measured = new Map<number, string>();
  for (const [start, colors] of [[0, observed.U], [18, observed.F], [9, observed.R]] as const) {
    [...colors].forEach((color, i) => measured.set(start + i, color));
  }
  const matches = (facelet: string, indices: readonly (readonly number[])[]) => indices.slice(0, 4).flat().every(i => !measured.has(i) || facelet[i] === measured.get(i));
  const corners: CubieCube[] = [], edges: CubieCube[] = [];
  // Factor the 62,208 legal states into 648 corner and 192 edge candidates,
  // then enforce matching permutation parity when joining the survivors.
  for (const perm of PERMUTATIONS) {
    for (let code = 0; code < 27; code++) {
      const c = solved(), first = [code % 3, Math.floor(code / 3) % 3, Math.floor(code / 9)];
      c.cp.splice(0, 4, ...perm); c.co.splice(0, 4, ...first, (3 - first.reduce((a, b) => a + b, 0) % 3) % 3);
      if (matches(cubieToFacelet(c), CORNER_FACELET)) corners.push(c);
    }
    for (let code = 0; code < 8; code++) {
      const c = solved(), first = [code & 1, (code >> 1) & 1, (code >> 2) & 1];
      c.ep.splice(0, 4, ...perm); c.eo.splice(0, 4, ...first, first.reduce((a, b) => a ^ b, 0));
      if (matches(cubieToFacelet(c), EDGE_FACELET)) edges.push(c);
    }
  }
  const results: string[] = [];
  for (const c of corners) for (const e of edges) {
    if (parity(c.cp) !== parity(e.ep)) continue;
    const facelet = cubieToFacelet({ cp: c.cp, co: c.co, ep: e.ep, eo: e.eo });
    if (validateFacelet(facelet) === null) results.push(facelet);
  }
  return results;
}

export function recognizePhoto(image: PhotoPixels, corners: CubeCorners, corrections: Record<number, CubeColor> = {}, front?: CubeColor): PhotoRecognition {
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || image.data.length !== image.width * image.height * 4) throw new Error('invalid-pixels');
  const top = sampleFace(image, corners, 'top'), left = sampleFace(image, corners, 'left'), right = sampleFace(image, corners, 'right');
  // Lower side rows are extrapolated and can contain a hand. Only the center
  // patches supplement the 15 measured last-layer cells as possible references.
  const classified = classifyPhotoColors([...top, ...left.slice(0, 3), ...right.slice(0, 3), left[4], right[4]]);
  const samples = classified.slice(0, 15).map((sample, i) => corrections[i]
    ? { ...sample, color: corrections[i], reliable: true, corrected: true } : sample);
  const centers = { F: classified[15], R: classified[16] };
  if (samples.some(s => !s.reliable)) return { samples, centers, candidates: [], status: 'uncertain-colors' };
  const possibleFrames = standardColorFrames().filter(frame => frame.U === samples[4].color && (front
    ? frame.F === front
    : (!centers.F.reliable || frame.F === centers.F.color) && (!centers.R.reliable || frame.R === centers.R.color)));
  const candidates = possibleFrames.flatMap(frame => {
    const toFace = (start: number, end: number) => samples.slice(start, end).map(s => Object.keys(frame).find(f => frame[f as PhotoFace] === s.color)).join('');
    return completeLastLayer({ U: toFace(0, 9), F: toFace(9, 12), R: toFace(12, 15) }).map(facelet => ({ facelet, frame }));
  });
  return { samples, centers, candidates, status: candidates.length === 1 ? 'ok' : candidates.length ? 'ambiguous' : 'invalid' };
}
