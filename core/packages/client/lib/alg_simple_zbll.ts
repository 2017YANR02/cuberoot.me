import type { AlgCase, AlgSticker } from '@cuberoot/shared';
import { optimalLength } from '@/lib/alg_case_optimal';

export const SIMPLE_ZBLL_MAX_HTM = 10;

function sideRows(sticker: AlgSticker): string[] {
  if (sticker.kind !== 'face') return [];
  return [sticker.ub, sticker.ur, sticker.uf, sticker.ul].map(face => face.slice(0, 3));
}

/**
 * Count adjacent same-colour pairs over the four visible LL side strips.
 * A full three-sticker bar contributes two; a two-sticker bar contributes one.
 * Requiring four pairs selects either two full bars, one full plus two short bars,
 * or four short bars — a compact, objective version of “many colour blocks”.
 */
export function zbllRecognitionScore(c: AlgCase): number {
  let score = 0;
  for (const row of sideRows(c.sticker)) {
    if (row.length !== 3) continue;
    if (row[0] === row[1]) score += 1;
    if (row[1] === row[2]) score += 1;
  }
  return score;
}

export function isSimpleZbllCase(c: AlgCase): boolean {
  const htm = optimalLength(c.meta, 'htm');
  return (htm !== null && htm <= SIMPLE_ZBLL_MAX_HTM) || zbllRecognitionScore(c) >= 4;
}
