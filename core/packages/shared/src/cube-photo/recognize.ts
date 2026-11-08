import { CORNER_FACELET, EDGE_FACELET, cubieToFacelet, validateFacelet, type CubieCube } from '../cube_facelet';
import { applyScramble } from '../timer/reconstruct/state';
import { CANONICAL_RGB, linearToLab, sampleGridColors, srgbToLab, srgbToLinear, type Lab, type PhotoFace, type RGB } from './scan';
import { faceQuad, homography, project, type CubeCorners, type FaceName } from './geometry';
import type { PhotoPixels } from './detect';
import { expandReducedFour } from './four';

export const COLOR_NAMES = {
  white: { zh: '白', en: 'White' }, red: { zh: '红', en: 'Red' }, green: { zh: '绿', en: 'Green' },
  yellow: { zh: '黄', en: 'Yellow' }, orange: { zh: '橙', en: 'Orange' }, blue: { zh: '蓝', en: 'Blue' },
};
export type CubeColor = keyof typeof COLOR_NAMES;
export const COLOR_ORDER = Object.keys(COLOR_NAMES) as CubeColor[];
const STANDARD: Record<PhotoFace, CubeColor> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
export const COLOR_RGB = Object.fromEntries(Object.entries(STANDARD).map(([face, color]) => [color, CANONICAL_RGB[face as PhotoFace]])) as Record<CubeColor, RGB>;
export type ColorFrame = Record<PhotoFace, CubeColor>;
export interface StickerSample { rgb: RGB; color: CubeColor; margin: number; distance: number; reliable: boolean; corrected: boolean; calibrated: boolean; inferred?: boolean; observedColor?: CubeColor; possibleColors?: CubeColor[] }
export interface VisibleLastLayer { U: string; F: string; R: string }
export interface RecoveredState { facelet: string; frame: ColorFrame }
/** Only corner coordinates are known; no edge or complete-cube state is claimed. */
export interface RecoveredCorners { cp: number[]; co: number[]; frame: ColorFrame }
export interface PhotoRecognition {
  puzzle?: '2x2' | '3x3' | '4x4';
  /** U row-major (back to front), then F top row, then R top row. */
  samples: StickerSample[];
  centers?: { F: StickerSample; R: StickerSample };
  candidates: RecoveredState[];
  cornerCandidates?: RecoveredCorners[];
  /** partial contains ALL compatible F2L completions, never a truncated sample. */
  status: 'ok' | 'partial' | 'corners-only' | 'uncertain-colors' | 'ambiguous' | 'invalid';
}

const REFERENCES = COLOR_ORDER.map(color => ({ color, lab: srgbToLab(COLOR_RGB[color]) }));
function hue(rgb: RGB): number {
  const [r, g, b] = rgb, hi = Math.max(...rgb), span = hi - Math.min(...rgb);
  if (!span) return NaN;
  return (60 * (hi === r ? (g - b) / span : hi === g ? 2 + (b - r) / span : 4 + (r - g) / span) + 360) % 360;
}
function rankColors(lab: Lab, references = REFERENCES) {
  return references.map(ref => ({ color: ref.color, distance: Math.hypot(
    .4 * (lab[0] - ref.lab[0]), lab[1] - ref.lab[1], lab[2] - ref.lab[2],
  ) })).sort((a, b) => a.distance - b.distance);
}
function saturation(rgb: RGB): number {
  return (Math.max(...rgb) - Math.min(...rgb)) / Math.max(1, ...rgb);
}
function classify(rgb: RGB, references = REFERENCES, lab = srgbToLab(rgb)): StickerSample {
  const ranked = rankColors(lab, references);
  const best = ranked[0], margin = ranked[1].distance - best.distance;
  // Skin/shadows may be nearest to white without being a white sticker. These
  // are rejection gates, not calibrated probabilities; corrections stay explicit.
  const plausibleWhite = best.color !== 'white' || (Math.max(...rgb) > 80 && Math.hypot(lab[1], lab[2]) < 18);
  // Shaded orange can be closer to canonical red in Lab. Such a narrow
  // red/orange margin is evidence of uncertainty, not a hard cube constraint.
  const warmPair = ranked.slice(0, 2).every(r => r.color === 'red' || r.color === 'orange');
  // A neutral reflection can pull orange toward the red Lab reference while
  // leaving a deceptively large margin. A washed-out warm patch is not a
  // trustworthy fixed observation unless it is close to a measured reference.
  const plausibleWarm = !warmPair || saturation(rgb) >= .65 || best.distance <= 12;
  // A saturated warm patch can be ambiguous between red and orange without
  // being compatible with blue/green/white. Preserve that bounded evidence;
  // it does not certify either warm color or train a calibration reference.
  const boundedWarm = warmPair && best.distance < 36 && ranked[2].distance - ranked[1].distance >= 20
    && Math.max(...rgb) >= 100 && (Math.max(...rgb) - Math.min(...rgb)) / Math.max(...rgb) >= .65;
  return { rgb, color: best.color, margin, distance: best.distance,
    ...(boundedWarm ? { possibleColors: ['red', 'orange'] as CubeColor[] } : {}),
    reliable: margin >= (warmPair ? 12 : 8) && best.distance < 48 && plausibleWhite && plausibleWarm, corrected: false, calibrated: false };
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
    let anchors = initial.filter(s => s.color === color && s.reliable && s.margin >= 12);
    // A photographed blue/green/yellow can differ from the canonical palette
    // enough that no single cell clears the stronger anchor threshold. Two
    // independently reliable, closely matching cells can corroborate that
    // reference. Uncertain cells never participate in their own calibration,
    // and red/orange retain their stricter separation requirement.
    if (!anchors.length && ['blue', 'green', 'yellow'].includes(color)) {
      const supported = initial.filter(s => s.color === color && s.reliable);
      if (supported.length >= 2 && supported.every(a => supported.every(b =>
        Math.hypot(...srgbToLab(a.rgb).map((v, i) => v - srgbToLab(b.rgb)[i])) <= 8))) anchors = supported;
    }
    if (!anchors.length) continue;
    const median = (channel: number) => {
      const values = anchors.map(s => s.rgb[channel]).sort((a, b) => a - b), mid = values.length >> 1;
      return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    };
    photoRefs.set(color, [median(0), median(1), median(2)]);
  }
  const references = REFERENCES.map(ref => ({ ...ref, lab: photoRefs.has(ref.color) ? srgbToLab(photoRefs.get(ref.color)!) : ref.lab }));
  const classifyShade = (sample: StickerSample): StickerSample => {
    const lab = srgbToLab(sample.rgb), chroma = Math.hypot(lab[1], lab[2]);
    // Shade/reflection can contract a colored sticker's chroma toward white.
    // Compare hue at the measured chroma, but only with independent photo
    // evidence and substantial remaining color. Never normalize a gray patch.
    if (chroma < 24 || Math.max(...sample.rgb) < 40) return sample;
    const shadedRefs = references.map(ref => {
      const scale = Math.min(1, chroma / Math.max(1, Math.hypot(ref.lab[1], ref.lab[2])));
      return { color: ref.color, lab: [ref.lab[0], ref.lab[1] * scale, ref.lab[2] * scale] as Lab };
    });
    const shaded = classify(sample.rgb, shadedRefs, lab);
    const ref = references.find(r => r.color === shaded.color)!;
    const refChroma = Math.hypot(ref.lab[1], ref.lab[2]), ratio = chroma / refChroma;
    const hueCosine = (lab[1] * ref.lab[1] + lab[2] * ref.lab[2]) / (chroma * refChroma);
    const plausible = rankColors(lab).slice(0, 2).some(r => r.color === shaded.color);
    // Warm colors remain subject to the stricter red/orange calibration above.
    return ['blue', 'green', 'yellow'].includes(shaded.color) && photoRefs.has(shaded.color)
      && plausible && ratio >= .35 && ratio <= .85 && hueCosine >= Math.cos(Math.PI / 18)
      && shaded.reliable && shaded.margin >= 12 && shaded.distance <= 24
      ? { ...shaded, calibrated: true } : sample;
  };
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
      && (!['red', 'orange'].includes(adjusted.color) || saturation(sample.rgb) >= .65 || adjusted.distance <= 12)
      && adjusted.distance <= .65 * (adjusted.distance + adjusted.margin));
    // Lab distances contract under shade/reflection. A red anchor must not
    // absorb orange merely because the orange reference is brighter.
    const ref = photoRefs.get(adjusted.color);
    const gap = ref ? Math.abs(hue(sample.rgb) - hue(ref)) : Infinity;
    const hueAgrees = !['red', 'orange'].includes(adjusted.color) || Math.min(gap, 360 - gap) <= 8;
    return separated && adjusted.distance <= 24 && ref && plausible && hueAgrees
      ? { ...adjusted, reliable: true, calibrated: true } : classifyShade(sample);
  });
}

export function sampleFace(image: PhotoPixels, corners: CubeCorners, face: FaceName, gridSize: 2 | 3 | 4 = 3): RGB[] {
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
  // Pocket stickers are large enough for a wider interior patch: a printed
  // center logo must not outweigh the surrounding sticker. Keep a margin to
  // exclude rounded corners and seams; 3x3 retains its tighter sampling area.
  return sampleGridColors(rectified, size, gridSize, gridSize === 2 ? .65 : .35);
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

function lastLayerPieces(observed: VisibleLastLayer, allowOddFlips = false): { corners: CubieCube[]; edges: CubieCube[] } {
  if (!/^[URFDLB?]{9}$/.test(observed.U) || !/^[URFDLB?]{3}$/.test(observed.F) || !/^[URFDLB?]{3}$/.test(observed.R) || observed.U[4] !== 'U') return { corners: [], edges: [] };
  const measured = new Map<number, string>();
  for (const [start, colors] of [[0, observed.U], [18, observed.F], [9, observed.R]] as const) {
    [...colors].forEach((color, i) => { if (color !== '?') measured.set(start + i, color); });
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
    for (let code = 0; code < (allowOddFlips ? 16 : 8); code++) {
      const c = solved(), first = [code & 1, (code >> 1) & 1, (code >> 2) & 1];
      c.ep.splice(0, 4, ...perm); c.eo.splice(0, 4, ...first, allowOddFlips ? (code >> 3) & 1 : first.reduce((a, b) => a ^ b, 0));
      if (matches(cubieToFacelet(c), EDGE_FACELET)) edges.push(c);
    }
  }
  return { corners, edges };
}

/** Exact completion under solved F2L. Only explicit '?' cells are unconstrained. */
export function completeLastLayer(observed: VisibleLastLayer, limit = Infinity, fourParity = false): string[] {
  const { corners, edges } = lastLayerPieces(observed, fourParity), results: string[] = [];
  for (const c of corners) for (const e of edges) {
    if ((parity(c.cp) !== parity(e.ep)) !== fourParity) continue;
    const facelet = cubieToFacelet({ cp: c.cp, co: c.co, ep: e.ep, eo: e.eo });
    if (fourParity || validateFacelet(facelet) === null) results.push(facelet);
    if (results.length >= limit) return results;
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
  // A side center can be occluded or reflected. Use the same stronger threshold
  // as calibration anchors before letting it constrain the entire color frame.
  const anchor = (s: StickerSample) => s.reliable && (s.margin >= 12 || (s.calibrated && s.distance <= 12));
  if (!samples[4].reliable) return { samples, centers, candidates: [], status: 'uncertain-colors' };
  const possibleFrames = standardColorFrames().filter(frame => frame.U === samples[4].color && (front
    ? frame.F === front
    : (!anchor(centers.F) || frame.F === centers.F.color) && (!anchor(centers.R) || frame.R === centers.R.color)));
  const cornerIndices = new Set([0, 2, 6, 8, 9, 11, 12, 14]);
  const opposite = standardColorFrames().find(frame => frame.U === samples[4].color)!.D;
  // Opposite-color edges are valid in Roux/LSE. Only an automatic corner reading
  // can be discarded; a user's explicit correction always remains a constraint.
  const impossible = samples.flatMap((s, i) => cornerIndices.has(i) && !s.corrected && s.color === opposite ? [i] : []);
  // Multiple such corners can mean an M-rotated center, not multiple bad pixels.
  // Do not erase that evidence to manufacture a full last-layer completion.
  const measured = samples.map((s, i) => impossible.length === 1 && impossible[0] === i ? { ...s, reliable: false } : s);
  const observed = (frame: ColorFrame, cells: StickerSample[], cornersOnly = false): VisibleLastLayer => {
    const toFace = (start: number, end: number) => cells.slice(start, end).map((s, j) => {
      const i = start + j;
      if (i === 4) return 'U';
      if (!s.reliable || (cornersOnly && !cornerIndices.has(i))) return '?';
      return Object.keys(frame).find(f => frame[f as PhotoFace] === s.color)!;
    }).join('');
    return { U: toFace(0, 9), F: toFace(9, 12), R: toFace(12, 15) };
  };
  // A category such as OLL can be determined even when permutation is not.
  // Bound the work, but never present a truncated candidate list as exhaustive.
  const candidateLimit = 128;
  const completions = possibleFrames.flatMap(frame =>
    completeLastLayer(observed(frame, measured), candidateLimit + 1).map(facelet => ({ facelet, frame })));
  const overflow = completions.length > candidateLimit;
  const candidates = overflow ? [] : completions;
  const infer = (facelet: string, frame: ColorFrame, cells: StickerSample[], cornersOnly = false) => cells.map((s, i) => {
    if (s.reliable || (cornersOnly && !cornerIndices.has(i))) return s;
    const index = i < 9 ? i : i < 12 ? i + 9 : i - 3;
    return { ...s, observedColor: s.color, color: frame[facelet[index] as PhotoFace], inferred: true };
  });
  if (candidates.length === 1) return { samples: infer(candidates[0].facelet, candidates[0].frame, measured), centers, candidates, status: 'ok' };
  if (candidates.length > 1) return { samples: measured, centers, candidates, status: 'partial' };

  // CMLL needs the four corners, not a fabricated F2L edge state. M turns can
  // move U/F centers, so only the R center (or an explicit F choice) anchors it.
  const cornerCandidates = standardColorFrames().filter(frame => (!front || frame.F === front)
    && (!anchor(centers.R) || frame.R === centers.R.color)).flatMap(frame => {
      const cells = frame.U === samples[4].color ? measured : samples;
      return lastLayerPieces(observed(frame, cells, true)).corners.map(c => ({ cp: c.cp.slice(0, 4), co: c.co.slice(0, 4), frame }));
    });
  if (cornerCandidates.length === 1) {
    const c = cornerCandidates[0], cube = solved();
    cube.cp.splice(0, 4, ...c.cp); cube.co.splice(0, 4, ...c.co);
    return { samples: infer(cubieToFacelet(cube), c.frame, c.frame.U === samples[4].color ? measured : samples, true), centers,
      candidates: [], cornerCandidates, status: 'corners-only' };
  }
  return { samples: measured, centers, candidates, status: measured.some(s => !s.reliable) ? 'uncertain-colors' : overflow || cornerCandidates.length ? 'ambiguous' : 'invalid' };
}

/** Reduced 4x4 last layer, under the explicit PPLL (odd permutation) premise. */
export function recognizeFour(image: PhotoPixels, corners: CubeCorners, corrections: Record<number, CubeColor> = {}, front?: CubeColor): PhotoRecognition {
  const top = sampleFace(image, corners, 'top', 4), left = sampleFace(image, corners, 'left', 4), right = sampleFace(image, corners, 'right', 4);
  const classified = classifyPhotoColors([...top, ...left.slice(0, 4), ...right.slice(0, 4), left[5], right[5]]);
  const samples = classified.slice(0, 24).map((sample, i) => corrections[i]
    ? { ...sample, color: corrections[i], reliable: true, corrected: true } : sample);
  const centers = { F: classified[24], R: classified[25] };
  const groups = [[0], [1, 2], [3], [4, 8], [5, 6, 9, 10], [7, 11], [12], [13, 14], [15], [16], [17, 18], [19], [20], [21, 22], [23]];
  const grouped = groups.map(indices => [...new Set(indices.filter(i => samples[i].reliable).map(i => samples[i].color))]);
  if (grouped.some(colors => colors.length > 1)) return { puzzle: '4x4', samples, centers, candidates: [], status: 'invalid' };
  if (!grouped[4].length) return { puzzle: '4x4', samples, centers, candidates: [], status: 'uncertain-colors' };
  const anchor = (s: StickerSample) => s.reliable && (s.margin >= 12 || (s.calibrated && s.distance <= 12));
  const frames = standardColorFrames().filter(frame => frame.U === grouped[4][0]
    && (front ? frame.F === front : (!anchor(centers.F) || frame.F === centers.F.color) && (!anchor(centers.R) || frame.R === centers.R.color)));
  const candidates: RecoveredState[] = [];
  for (const frame of frames) {
    const observed = grouped.map(colors => colors.length ? Object.keys(frame).find(f => frame[f as PhotoFace] === colors[0])! : '?');
    const completions = completeLastLayer({ U: observed.slice(0, 9).join(''), F: observed.slice(9, 12).join(''), R: observed.slice(12).join('') }, 129, true);
    if (completions.length > 128) return { puzzle: '4x4', samples, centers, candidates: [], status: 'ambiguous' };
    for (const reduced of completions) {
      const facelet = expandReducedFour(reduced);
      const visible = facelet.slice(0, 16) + facelet.slice(32, 36) + facelet.slice(16, 20);
      // Bounded warm-color evidence remains a constraint even when a pair's
      // other wing or center is uncertain. Explicit corrections always win.
      if (samples.some((s, i) => !s.reliable && s.possibleColors && !s.possibleColors.includes(frame[visible[i] as PhotoFace]))) continue;
      candidates.push({ facelet, frame });
      if (candidates.length > 128) return { puzzle: '4x4', samples, centers, candidates: [], status: 'ambiguous' };
    }
  }
  const unique = candidates.length === 1 ? candidates[0] : undefined;
  const visible = unique && unique.facelet.slice(0, 16) + unique.facelet.slice(32, 36) + unique.facelet.slice(16, 20);
  return { puzzle: '4x4', centers, candidates,
    samples: unique && visible ? samples.map((s, i) => s.reliable ? s : { ...s, observedColor: s.color, color: unique.frame[visible[i] as PhotoFace], inferred: true }) : samples,
    status: unique ? 'ok' : candidates.length ? 'partial' : samples.some(s => !s.reliable) ? 'uncertain-colors' : 'invalid' };
}
