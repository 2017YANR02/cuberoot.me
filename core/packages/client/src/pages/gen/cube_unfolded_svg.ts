/**
 * Render an NxN cube state as an unfolded WCA-net SVG (white-top / green-front).
 *
 * Pure string output, no DOM, no async, no shadow root, no styles. Every fill
 * is inlined as an attribute so svg2pdf.js renders perfectly. Fast: ~1ms per
 * scramble vs hundreds of ms for spinning up a TwistyPlayer 2D.
 *
 * Layout (in cell units, viewBox 0 0 4N 3N):
 *
 *           [U]
 *      [L] [F] [R] [B]
 *           [D]
 *
 * Sticker indexing follows visualcube's CubeData convention (verified: for
 * each face, `face[row*N+col]` is the sticker at (row, col) when looking at
 * that face from outside in standard orientation — U/D viewed with F at the
 * bottom/top of view respectively, L/F/R/B with U at top).
 */
import { CubeData, parseAlgorithm, Face, AllFaces } from '@cuberoot/visualcube';

// WCA colour scheme (white-top, green-front, red-right, blue-back, orange-left, yellow-bottom).
// Hexes match visualcube's existing palette so other parts of the app stay consistent.
const WCA_COLORS: Record<number, string> = {
  [Face.U]: '#FFFFFF',
  [Face.D]: '#FEFE00',
  [Face.F]: '#00D800',
  [Face.B]: '#0000F2',
  [Face.L]: '#FFA100',
  [Face.R]: '#EE0000',
};

const BG_COLOR = '#C0C0C0';      // matches tnoodle SCRAMBLE_BACKGROUND_COLOR
const STROKE_COLOR = '#000000';
const STROKE_W = 0.04;            // relative to 1×1 cell

const PUZZLE_TO_N: Record<string, number> = {
  '2x2x2': 2, '3x3x3': 3, '4x4x4': 4, '5x5x5': 5, '6x6x6': 6, '7x7x7': 7,
};

export function isUnfoldablePuzzle(puzzleId: string): boolean {
  return puzzleId in PUZZLE_TO_N;
}

const EVENT_TO_PUZZLE: Record<string, string> = {
  '222': '2x2x2',
  '333': '3x3x3', '333oh': '3x3x3', '333bf': '3x3x3', '333fm': '3x3x3', '333mbf': '3x3x3',
  '444': '4x4x4', '444bf': '4x4x4',
  '555': '5x5x5', '555bf': '5x5x5',
  '666': '6x6x6',
  '777': '7x7x7',
};

export function eventToCubeSize(event: string): number | null {
  const p = EVENT_TO_PUZZLE[event];
  if (!p) return null;
  return PUZZLE_TO_N[p] ?? null;
}

/** Parse a WCA scramble string and return the SVG unfolded-net for the resulting cube state. */
export function renderUnfoldedSvgForEvent(event: string, scramble: string): string | null {
  const N = eventToCubeSize(event);
  if (!N) return null;
  return renderUnfoldedSvg(N, scramble);
}

export function renderUnfoldedSvg(N: number, scramble: string): string {
  const cd = new CubeData(N);
  for (const f of AllFaces) {
    cd.faces[f] = Array(N * N).fill(WCA_COLORS[f]);
  }
  try {
    const turns = parseAlgorithm(scramble);
    for (const t of turns) cd.turn(t);
  } catch (e) {
    console.warn('[cube_unfolded_svg] parseAlgorithm failed', scramble, e);
  }

  const w = 4 * N;
  const h = 3 * N;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`);
  parts.push(`<rect width="${w}" height="${h}" fill="${BG_COLOR}"/>`);

  // [Face]: [offsetX, offsetY] in cell units within the 4N × 3N grid.
  const offsets: Record<number, [number, number]> = {
    [Face.U]: [N, 0],
    [Face.L]: [0, N],
    [Face.F]: [N, N],
    [Face.R]: [2 * N, N],
    [Face.B]: [3 * N, N],
    [Face.D]: [N, 2 * N],
  };

  for (const f of AllFaces) {
    const [ox, oy] = offsets[f];
    const stickers = cd.faces[f] as string[];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const color = stickers[r * N + c] ?? '#000000';
        const x = ox + c;
        const y = oy + r;
        parts.push(
          `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}" stroke="${STROKE_COLOR}" stroke-width="${STROKE_W}"/>`,
        );
      }
    }
  }
  parts.push('</svg>');
  return parts.join('');
}
