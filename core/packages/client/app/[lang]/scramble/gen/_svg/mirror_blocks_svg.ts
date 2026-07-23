/**
 * Mirror Blocks (3x3 shape mod) — port of cstimer `mrblImage`
 * (D:\cube\cstimer\src\js\tools\image.js).
 *
 * Each sticker drawn as a quad whose edges are offset by the *original* face
 * of the neighboring sticker → reflects the mirror cube's per-axis layer
 * thickness (3 distinct thicknesses summing to cube side). After a scramble
 * the displaced cubies show up at new positions with their original sizes —
 * that's the puzzle's defining visual.
 *
 * State sim is the shared `nnn_sim.ts` (also from cstimer's `nnnImage`); only
 * the polygon-offset rendering is mirror-blocks-specific. Colors are standard
 * WCA (pure-silver render would be unreadable for scramble verification).
 */
import { simulateNxN } from '@cuberoot/shared/nnn-sim';

const SIZE = 3;
const S2 = SIZE * SIZE;

/** Layer thickness offset keyed by ORIGINAL face id. Sum to 0 along each axis
 *  pair (D+U=L+R=F+B=0). 0.45/0.30/0.15 are the 3 mirror-cube layer offsets. */
const HEIGHTS = [0.45, 0.15, 0.3, -0.45, -0.15, -0.3];

/** WCA colors in cstimer face order D L B U R F. */
const COLORS = ['#FFFF00', '#FF8000', '#0000FF', '#FFFFFF', '#FF0000', '#00FF00'];

/** neighbor[face][edge_dir] = neighbor_face*4 + neighbor_edge. Edge dirs:
 *  0=top, 1=bottom, 2=left, 3=right. Verbatim cstimer table. */
const NEIGHBOR_TABLE: number[][] = [
  [5 * 4 + 1, 2 * 4 + 1, 1 * 4 + 1, 4 * 4 + 1], // D
  [3 * 4 + 2, 0 * 4 + 2, 2 * 4 + 3, 5 * 4 + 2], // L
  [3 * 4 + 0, 0 * 4 + 1, 4 * 4 + 3, 1 * 4 + 2], // B
  [2 * 4 + 0, 5 * 4 + 0, 1 * 4 + 0, 4 * 4 + 0], // U
  [3 * 4 + 3, 0 * 4 + 3, 5 * 4 + 3, 2 * 4 + 2], // R
  [3 * 4 + 1, 0 * 4 + 0, 1 * 4 + 3, 4 * 4 + 2], // F
];

/** Face origin in cell units (NW corner of each face's 3x3 grid). Cross layout
 *  with 1-cell gap between faces, +0.6 inner margin added at draw time. */
const FACE_ORIGINS: [number, number][] = [
  [SIZE + 1,     2 * (SIZE + 1)], // D (bottom)
  [0,            SIZE + 1],       // L
  [3 * (SIZE + 1), SIZE + 1],     // B (rightmost)
  [SIZE + 1,     0],              // U (top)
  [2 * (SIZE + 1), SIZE + 1],     // R
  [SIZE + 1,     SIZE + 1],       // F (center)
];

function getBoundOffset(f: number, i: number, j: number, posit: Uint8Array): number[] {
  if (i !== 0 && i !== SIZE - 1 && j !== 0 && j !== SIZE - 1) {
    return [-1, -1, -1, -1];
  }
  const neighbor = NEIGHBOR_TABLE[f];
  const isBound = [i === 0, i === SIZE - 1, j === 0, j === SIZE - 1];
  const ret = [-1, -1, -1, -1];
  for (let i1 = 0; i1 < 4; i1++) {
    if (!isBound[i1]) continue;
    const idx = [SIZE - 1 - j, j, i, SIZE - 1 - i][i1];
    const rij = [[0, idx], [SIZE - 1, SIZE - 1 - idx], [SIZE - 1 - idx, 0], [idx, SIZE - 1]][neighbor[i1] & 3].slice();
    const fidx = neighbor[i1] >> 2;
    if (fidx === 1 || fidx === 2) rij[1] = SIZE - 1 - rij[1];
    if (fidx === 0) rij[0] = SIZE - 1 - rij[0];
    ret[i1] = posit[fidx * S2 + rij[0] * SIZE + rij[1]];
  }
  return ret;
}

function drawFace(parts: string[], f: number, posit: Uint8Array): void {
  const [offx, offy] = FACE_ORIGINS[f];
  for (let i = 0; i < SIZE; i++) {
    const x = (f === 1 || f === 2) ? SIZE - 1 - i : i;
    for (let j = 0; j < SIZE; j++) {
      const y = (f === 0) ? SIZE - 1 - j : j;
      // cstimer 调 getBoundOffset(f, size, j, i) — 入参 i/j 颠倒,这里保持原样
      const off = getBoundOffset(f, j, i, posit);
      const h0 = off[0] === -1 ? 0 : HEIGHTS[off[0]];
      const h1 = off[1] === -1 ? 0 : HEIGHTS[off[1]];
      const h2 = off[2] === -1 ? 0 : HEIGHTS[off[2]];
      const h3 = off[3] === -1 ? 0 : HEIGHTS[off[3]];
      const colorIdx = posit[(f * SIZE + y) * SIZE + x];
      const color = COLORS[colorIdx];
      const xl = (i - h2 + offx + 0.6).toFixed(3);
      const xr = (i + 1 + h3 + offx + 0.6).toFixed(3);
      const yt = (j - h0 + offy + 0.6).toFixed(3);
      const yb = (j + 1 + h1 + offy + 0.6).toFixed(3);
      parts.push(
        `<polygon points="${xl},${yt} ${xl},${yb} ${xr},${yb} ${xr},${yt}" fill="${color}" stroke="#000" stroke-width="0.05" stroke-linejoin="round" />`,
      );
    }
  }
}

/** Render a 3x3 scramble as the mirror-blocks unfolded SVG. Accepts standard
 *  WCA 333 scramble tokens (U/D/L/R/F/B + optional 2/'). Unknown tokens skipped. */
export function renderMirrorBlocksScrambleSvg(scramble: string): string {
  const posit = simulateNxN(SIZE, scramble);
  // viewBox: 4*N+4+0.2 wide, 3*N+3+0.2 tall (cstimer formula at size=3 → 16.2 × 12.2)
  const w = 4 * SIZE + 4 + 0.2;
  const h = 3 * SIZE + 3 + 0.2;
  const parts: string[] = [];
  for (let f = 0; f < 6; f++) drawFace(parts, f, posit);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">${parts.join('')}</svg>`;
}
