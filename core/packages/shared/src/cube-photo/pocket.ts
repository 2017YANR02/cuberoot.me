import { CORNER_FACELET } from '../cube_facelet';
import { solved, type CubeFaces, type FaceArr } from '../timer/reconstruct/state';
import { classifyPhotoColors, sampleFace, standardColorFrames, type CubeColor, type PhotoRecognition, type RecoveredState, type StickerSample } from './recognize';
import type { CubeCorners } from './geometry';
import type { PhotoPixels } from './detect';

const FACES = 'URFDLB';
const CORNERS = CORNER_FACELET.map(piece => piece.map(i => Math.floor(i / 9) * 4 + [0, 2, 6, 8].indexOf(i % 9)));
const PIECES = CORNER_FACELET.map(piece => piece.map(i => FACES[Math.floor(i / 9)]));
// Same ordering as the overlay: U, F, R, each row-major, all four cells.
const VISIBLE = [0, 1, 2, 3, 8, 9, 10, 11, 4, 5, 6, 7];

export function pocketFaces(facelet: string): CubeFaces | null {
  if (!/^[URFDLB]{24}$/.test(facelet) || [...FACES].some(f => [...facelet].filter(c => c === f).length !== 4)) return null;
  const state = solved(2);
  [...FACES].forEach((face, i) => { state[face as keyof CubeFaces] = facelet.slice(i * 4, i * 4 + 4).split('') as FaceArr; });
  return state;
}

/** Exact corner constraints, with a monochrome D face; no edge parity on 2x2.
 * A bound is a rejection boundary, never permission to keep only likely states.
 * Y-equivalent color frames describe the same physical state: use one per U.
 */
export function recoverPocket(samples: StickerSample[], up?: CubeColor): PhotoRecognition {
  if (samples.length !== 12) throw new Error('invalid-pocket-samples');
  const candidates: RecoveredState[] = [], limit = 128;
  const frames = standardColorFrames().filter((frame, index, all) => (!up || frame.U === up)
    && all.findIndex(other => other.U === frame.U) === index);
  for (const frame of frames) {
    const observed = new Map(VISIBLE.flatMap((index, i) => samples[i].reliable || samples[i].corrected
      ? [[index, Object.keys(frame).find(f => frame[f as keyof typeof frame] === samples[i].color)!] as const] : []));
    const options = CORNERS.map((indices, position) => PIECES.flatMap((colors, piece) => {
      if ((position < 4) !== (piece < 4)) return [];
      return [0, 1, 2].flatMap(orientation => {
        if (position >= 4 && orientation !== 0) return [];
        const stickers = indices.map((_, j) => colors[(j - orientation + 3) % 3]);
        return indices.every((index, j) => !observed.has(index) || observed.get(index) === stickers[j])
          ? [{ piece, orientation, stickers }] : [];
      });
    }));
    if (options.some(values => !values.length)) continue;
    const order = options.map((_, i) => i).sort((a, b) => options[a].length - options[b].length);
    const facelet = Array<string>(24);
    const visit = (depth: number, used: number, twist: number) => {
      if (candidates.length > limit) return;
      if (depth === 8) {
        if (twist % 3 === 0) candidates.push({ facelet: facelet.join(''), frame });
        return;
      }
      const position = order[depth];
      for (const option of options[position]) {
        if (used & (1 << option.piece)) continue;
        CORNERS[position].forEach((index, j) => { facelet[index] = option.stickers[j]; });
        visit(depth + 1, used | (1 << option.piece), twist + option.orientation);
      }
    };
    visit(0, 0, 0);
    if (candidates.length > limit) return { puzzle: '2x2', samples, candidates: [], status: 'ambiguous' };
  }
  const unique = candidates.length === 1 ? candidates[0] : undefined;
  return { puzzle: '2x2', candidates,
    samples: unique ? samples.map((sample, i) => sample.reliable || sample.corrected ? sample : {
      ...sample, observedColor: sample.color, color: unique.frame[unique.facelet[VISIBLE[i]] as keyof typeof unique.frame], inferred: true,
    }) : samples,
    status: unique ? 'ok' : candidates.length ? 'partial' : samples.some(s => !s.reliable) ? 'uncertain-colors' : 'invalid',
  };
}

export function recognizePocket(image: PhotoPixels, corners: CubeCorners, corrections: Record<number, CubeColor>, up?: CubeColor): PhotoRecognition {
  const colors = (['top', 'left', 'right'] as const).flatMap(face => sampleFace(image, corners, face, 2));
  const samples = classifyPhotoColors(colors).map((sample, i) => corrections[i]
    ? { ...sample, color: corrections[i], corrected: true, reliable: true } : sample);
  return recoverPocket(samples, up);
}

export function pocketSolved(state: CubeFaces): boolean {
  return (Object.values(state) as FaceArr[]).every(face => face.every(color => color === face[0]));
}

export function pocketOriented(state: CubeFaces): boolean {
  return state.U.every(color => color === state.U[0]) && state.D.every(color => color === state.D[0]);
}
