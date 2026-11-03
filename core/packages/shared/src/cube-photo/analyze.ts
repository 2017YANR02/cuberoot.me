import type { AlgFile } from '../alg';
import { detectCubePhoto, type PhotoPixels, type CubePhotoDetection } from './detect';
import type { CubeCorners } from './geometry';
import { recognizePhoto, type CubeColor, type PhotoRecognition } from './recognize';
import { findPhotoAlg, findPhotoAlternatives, photoRecognitionSets, photoRecognitionInput, photoAufOnly, type PhotoAlgResult, type PhotoAlgSet } from './lookup';

export interface PhotoAnalysisInput {
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
  emit: (message: PhotoAnalysisMessage) => void = () => {}): Promise<PhotoAnalysis> {
  const recognition = recognizePhoto(input.pixels, input.corners, input.corrections, input.front);
  emit({ type: 'state', recognition });
  const target = photoRecognitionInput(recognition);
  const sets = photoRecognitionSets(recognition).filter(set => !input.sets || input.sets.includes(set));
  const results = await Promise.all(sets.map(async set => {
    let result: PhotoAlgResult;
    try {
      const alignment = set === 'pll' && typeof target === 'string' && photoAufOnly(target);
      const file = alignment ? undefined : await load(set);
      const match = alignment || findPhotoAlg(target!, set, file!);
      result = match ? { set, status: 'found', match, alternatives: file ? findPhotoAlternatives(target!, match, file) : [] } : { set, status: 'missing' };
    } catch { result = { set, status: 'error' }; }
    emit({ type: 'alg', result });
    return result;
  }));
  emit({ type: 'done' });
  return { recognition, results: results.filter(r => recognition.status !== 'partial' || r.status !== 'missing') };
}

/** Use image geometry first; a legal completion is not proof of the image's colors. */
export function locateCubePhoto(pixels: PhotoPixels): { detection: CubePhotoDetection; corners?: CubeCorners } {
  const detection = detectCubePhoto(pixels);
  return { detection, corners: detection.candidates[0]?.corners };
}
