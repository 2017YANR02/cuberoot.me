import type { AlgPuzzle } from '@cuberoot/shared/alg';
import type { PhotoAlgMatch, PhotoAlgResult } from '@cuberoot/shared/cube-photo/lookup';

/** The card is also used by the browser-only non-NxN photo workflow. */
export interface PhotoCardMatch extends Omit<PhotoAlgMatch, 'puzzle' | 'set'> { puzzle?: AlgPuzzle; set: string }
export interface PhotoCardResult extends Omit<PhotoAlgResult, 'set' | 'match' | 'alternatives'> {
  set: string; match?: PhotoCardMatch; alternatives?: PhotoCardMatch[];
}
