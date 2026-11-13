import { recognizePocket } from './pocket';
import type { AlgFile } from '../alg_types';
import { detectCubePhoto, type PhotoPixels, type CubePhotoDetection } from './detect';
import type { CubeCorners } from './geometry';
import { recognizePhoto, recognizeFour, type CubeColor, type PhotoRecognition } from './recognize';
import { findPhotoAlg, findPhotoAlternatives, photoRecognitionSets, photoRecognitionInput, photoAufOnly, type PhotoAlgResult, type PhotoAlgSet } from './lookup';

export interface PhotoAnalysisInput {
  puzzleSize?: 2 | 3 | 4;
  pocketStage?: 'eg' | 'last-slot';
  up?: CubeColor;
  pixels: PhotoPixels;
  corners: CubeCorners;
  corrections: Record<number, CubeColor>;
  front?: CubeColor;
  sets?: PhotoAlgSet[];
}
export type PhotoAnalysisMessage = { type: 'state'; recognition: PhotoRecognition }
  | { type: 'alg'; result: PhotoAlgResult } | { type: 'done' } | { type: 'error' };
export interface PhotoAnalysis {
  recognition: PhotoRecognition;
  results: PhotoAlgResult[];
}

/** Same pure state/goal checks on both hosts. Only the catalog loader is injected. */
export async function analyzeCubePhoto(input: PhotoAnalysisInput, load: (set: PhotoAlgSet) => Promise<AlgFile>,
  emit: (message: PhotoAnalysisMessage) => void = () => {}, signal?: AbortSignal): Promise<PhotoAnalysis> {
  signal?.throwIfAborted();
  const recognition = input.puzzleSize === 2 ? recognizePocket(input.pixels, input.corners, input.corrections, input.up, input.pocketStage === 'last-slot' ? 3 : 4)
    : input.puzzleSize === 4 ? recognizeFour(input.pixels, input.corners, input.corrections, input.front) : recognizePhoto(input.pixels, input.corners, input.corrections, input.front);
  emit({ type: 'state', recognition });
  const target = photoRecognitionInput(recognition);
  const sets = photoRecognitionSets(recognition).filter(set => !input.sets || input.sets.includes(set));
  const results = await Promise.all(sets.map(async set => {
    let result: PhotoAlgResult;
    try {
      const alignment = set === 'pll' && typeof target === 'string' && photoAufOnly(target);
      const file = alignment ? undefined : await load(set);
      signal?.throwIfAborted();
      const match = alignment || findPhotoAlg(target!, set, file!);
      result = match ? { set, status: 'found', match, alternatives: file ? findPhotoAlternatives(target!, match, file) : [] } : { set, status: 'missing' };
    } catch { result = { set, status: 'error' }; }
    signal?.throwIfAborted();
    emit({ type: 'alg', result });
    return result;
  }));
  signal?.throwIfAborted();
  emit({ type: 'done' });
  return { recognition, results: results.filter(r => (recognition.status !== 'partial' && recognition.puzzle !== '2x2') || r.status !== 'missing') };
}

/** Use image geometry first; a legal completion is not proof of the image's colors. */
export function locateCubePhoto(pixels: PhotoPixels): { detection: CubePhotoDetection; corners?: CubeCorners } {
  const detection = detectCubePhoto(pixels);
  return { detection, corners: detection.candidates[0]?.corners };
}

/** Try the previous size first, but never require users to choose before taking
 * a photo. A grid alone is insufficient: the observed state must also recover.
 * No catalog/network lookup is needed to select the size. */
export function locateCubePhotoAuto(pixels: PhotoPixels, preferredSize: 2 | 3 | 4 = 3): { detection: CubePhotoDetection; puzzleSize: 2 | 3 | 4 } {
  const attempt = (puzzleSize: 2 | 3 | 4) => {
    const detection = detectCubePhoto(pixels, puzzleSize);
    const corners = detection.candidates[0]?.corners;
    const recognition = corners ? (puzzleSize === 2 ? recognizePocket(pixels, corners, {}) : puzzleSize === 4 ? recognizeFour(pixels, corners) : recognizePhoto(pixels, corners)) : undefined;
    const usable = recognition?.status === 'ok' || recognition?.status === 'partial' || recognition?.status === 'corners-only';
    return { detection, puzzleSize, usable };
  };
  const first = attempt(preferredSize);
  if (first.usable) return first;
  const others: ReturnType<typeof attempt>[] = [];
  for (const size of [3, 2, 4] as const) {
    if (size === preferredSize) continue;
    const result = attempt(size);
    if (result.usable) return result;
    others.push(result);
  }
  const pocket = [first, ...others].find(result => result.puzzleSize === 2)!;
  const corners = pocket.detection.candidates[0]?.corners;
  if (corners && recognizePocket(pixels, corners, {}, undefined, 3).candidates.length) return pocket;
  return first.detection.candidates.length ? first : others.find(result => result.detection.candidates.length) ?? first;
}
