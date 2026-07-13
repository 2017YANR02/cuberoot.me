/**
 * The 3x3 net PAINT editor renders HTML `<button>` stickers, not an `<svg>` — so
 * scraping the preview DOM for an `<svg>` returns nothing and SVG/PNG export
 * silently produced an empty blob on `?pzl=3&view=net` (the one view where the
 * user's own painted state IS the picture).
 *
 * This turns the 54-char URFDLB facelet into the same 4x3 unfolded cross the
 * editor draws (identical FACE_BASE layout, identical palette), so export has
 * something real to hand out. Preview is untouched — export only.
 */

import { COLOR_HEX, EMPTY_COLOR_HEX, FACES, faceletIdx, type FaceLetter } from '@/app/[lang]/scramble/solver/_paint-shared';

/** [row, col] of each face's top-left 3x3 block in the 4 wide x 3 tall cross. */
const FACE_BASE: Record<FaceLetter, [number, number]> = {
  U: [0, 1],
  L: [1, 0],
  F: [1, 1],
  R: [1, 2],
  B: [1, 3],
  D: [2, 1],
};

const STROKE_COLOR = '#000000';
const STROKE_W = 0.02;

/** Painted 3x3 facelet (54 chars, URFDLB) → unfolded-net SVG string. */
export function renderPaintedNetSvg(facelet: string): string {
  const parts: string[] = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 9" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">',
  ];
  for (const face of FACES) {
    const [baseR, baseC] = FACE_BASE[face];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const ch = facelet[faceletIdx(face, r, c)];
        const color = COLOR_HEX[ch as FaceLetter] ?? EMPTY_COLOR_HEX;
        parts.push(
          `<rect x="${baseC * 3 + c}" y="${baseR * 3 + r}" width="1" height="1" fill="${color}"`
          + ` stroke="${STROKE_COLOR}" stroke-width="${STROKE_W}"/>`,
        );
      }
    }
  }
  parts.push('</svg>');
  return parts.join('');
}
