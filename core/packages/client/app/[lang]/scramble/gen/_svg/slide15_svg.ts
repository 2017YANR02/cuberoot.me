/**
 * 15-Puzzle state preview SVG — a 4×4 digit-tile grid (NOT a cube net). Tile labels + positions come
 * straight from the solver's grid state (slide15Apply), so the solved puzzle renders the canonical
 * 1..15 ordering with the blank at the bottom-right — a self-proving preview, no external truth.
 *
 * The solver stores tiles 0..14 (value 15 = blank). We display them as 1..15 (tile value + 1) to match
 * the conventional 15-puzzle face; the blank cell renders empty. Mirrors gen/_svg/slide8_svg.ts (3×3),
 * parameterized to 4×4.
 */

import { slide15Apply } from '@/lib/slide15-solver';

const W = 4;            // grid width
const S = 26;           // cell size
const GAP = 2;          // gap between tiles
const BLANK = 15;       // blank tile value in the solver grid

// Tile fill + the empty (blank) cell background. These are puzzle data colors, not UI theme tokens
// (the grid is a deterministic state diagram, identical in light/dark).
const TILE_FILL = '#3a86ff';   // tile body (cuboid/data blue, matches dist view + 8-puzzle)
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
  // Two-digit labels (10..15) need a smaller font to fit.
  const fs = label.length >= 2 ? S * 0.38 : S * 0.5;
  return (
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(S)}" height="${fmt(S)}" rx="3" fill="${TILE_FILL}" stroke="${STROKE}" stroke-width="0.75"/>` +
    `<text x="${fmt(cx)}" y="${fmt(cy)}" fill="${TILE_TEXT}" font-size="${fmt(fs)}" font-family="system-ui,sans-serif" font-weight="600" text-anchor="middle" dominant-baseline="central">${label}</text>`
  );
}

export function renderSlide15ScrambleSvg(scramble: string): string {
  let grid = Array.from({ length: 16 }, (_, i) => i);
  try {
    grid = slide15Apply(scramble).grid;
  } catch (e) {
    console.warn('[slide15_svg] apply failed', scramble, e);
  }

  const totalW = W * S + (W - 1) * GAP;
  const totalH = W * S + (W - 1) * GAP;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
  ];
  for (let pos = 0; pos < 16; pos++) {
    const row = Math.floor(pos / W);
    const col = pos % W;
    const v = grid[pos];
    out.push(tile(col, row, v === BLANK ? null : String(v + 1)));
  }
  out.push('</svg>');
  return out.join('');
}
