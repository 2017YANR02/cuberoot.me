/**
 * 8-Puzzle state preview SVG — a 3×3 digit-tile grid (NOT a cube net). Tile labels + positions
 * come straight from the solver's grid state (slide8Apply), so the solved puzzle renders the
 * canonical 1..8 ordering with the blank at the bottom-right — a self-proving preview, no external
 * truth.
 *
 * The solver stores tiles 0..7 (value 8 = blank). We display them as 1..8 (tile value + 1) to
 * match the conventional 8-puzzle face; the blank cell renders empty.
 */

import { slide8Apply } from '@/lib/slide8-solver';

const S = 30;           // cell size
const GAP = 2;          // gap between tiles
const BLANK = 8;        // blank tile value in the solver grid

// Tile fill + the empty (blank) cell background. These are puzzle data colors, not UI theme tokens
// (the grid is a deterministic state diagram, identical in light/dark).
const TILE_FILL = '#3a86ff';   // tile body (cuboid/data blue, matches dist view)
const TILE_TEXT = '#ffffff';
const BLANK_FILL = '#e7ecf3';  // empty slot
const STROKE = '#1b2a4a';

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

function tile(col: number, row: number, label: string | null): string {
  const x = col * (S + GAP);
  const y = row * (S + GAP);
  if (label === null) {
    return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(S)}" height="${fmt(S)}" rx="3" fill="${BLANK_FILL}" stroke="${STROKE}" stroke-width="0.75"/>`;
  }
  const cx = x + S / 2;
  const cy = y + S / 2;
  return (
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(S)}" height="${fmt(S)}" rx="3" fill="${TILE_FILL}" stroke="${STROKE}" stroke-width="0.75"/>` +
    `<text x="${fmt(cx)}" y="${fmt(cy)}" fill="${TILE_TEXT}" font-size="${fmt(S * 0.5)}" font-family="system-ui,sans-serif" font-weight="600" text-anchor="middle" dominant-baseline="central">${label}</text>`
  );
}

export function renderSlide8ScrambleSvg(scramble: string): string {
  let grid = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  try {
    grid = slide8Apply(scramble).grid;
  } catch (e) {
    console.warn('[slide8_svg] apply failed', scramble, e);
  }

  const totalW = 3 * S + 2 * GAP;
  const totalH = 3 * S + 2 * GAP;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
  ];
  for (let pos = 0; pos < 9; pos++) {
    const row = Math.floor(pos / 3);
    const col = pos % 3;
    const v = grid[pos];
    out.push(tile(col, row, v === BLANK ? null : String(v + 1)));
  }
  out.push('</svg>');
  return out.join('');
}
