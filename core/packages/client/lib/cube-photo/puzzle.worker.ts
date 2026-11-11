/// <reference lib="webworker" />
import { loadAlg } from '@cuberoot/shared/alg';
import { PUZZLE_PHOTO_SETS, type PhotoPuzzle } from './puzzle-geometry';
import { findPuzzlePhotoAlgs, photoPuzzleSolved, puzzlePhotoAdjustment, type PuzzlePhotoColors } from './puzzle-lookup';
import type { PhotoCardResult } from './card-types';
import { PhotoCatalogCache } from './catalog-cache';

export interface PuzzlePhotoRequest { puzzle: PhotoPuzzle; colors: PuzzlePhotoColors }
export type PuzzlePhotoReply = { type: 'result'; result: PhotoCardResult } | { type: 'done'; solved: boolean };
const catalogs = new Map<PhotoPuzzle, PhotoCatalogCache<string>>();

self.onmessage = async (event: MessageEvent<PuzzlePhotoRequest>) => {
  const { puzzle, colors } = event.data;
  if (photoPuzzleSolved(puzzle, colors)) {
    self.postMessage({ type: 'done', solved: true } satisfies PuzzlePhotoReply); return;
  }
  const adjustment = puzzlePhotoAdjustment(puzzle, colors);
  if (adjustment) {
    for (const set of PUZZLE_PHOTO_SETS[puzzle]) self.postMessage({ type: 'result', result: set === adjustment.set ? adjustment : { set, status: 'missing' } } satisfies PuzzlePhotoReply);
    self.postMessage({ type: 'done', solved: false } satisfies PuzzlePhotoReply); return;
  }
  let catalog = catalogs.get(puzzle);
  if (!catalog) { catalog = new PhotoCatalogCache<string>((set, fresh) => loadAlg(puzzle, set, { fresh })); catalogs.set(puzzle, catalog); }
  const files = await Promise.allSettled(PUZZLE_PHOTO_SETS[puzzle].map(set => catalog.load(set)));
  for (const [index, file] of files.entries()) {
    const set = PUZZLE_PHOTO_SETS[puzzle][index];
    let result: PhotoCardResult;
    try { result = file.status === 'fulfilled' ? findPuzzlePhotoAlgs(puzzle, colors, file.value) : { set, status: 'error' }; }
    catch { result = { set, status: 'error' }; }
    self.postMessage({ type: 'result', result } satisfies PuzzlePhotoReply);
  }
  self.postMessage({ type: 'done', solved: false } satisfies PuzzlePhotoReply);
};
