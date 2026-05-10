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

// Tnoodle CubePuzzle.java defaultColorScheme — pure WCA hexes.
// (Java Color.WHITE/RED/GREEN/etc are #ffffff/#ff0000/#00ff00 etc, plus
//  L = new Color(255, 128, 0) "orange heraldic tincture".)
const WCA_COLORS: Record<number, string> = {
  [Face.U]: '#FFFFFF',
  [Face.D]: '#FFFF00',
  [Face.F]: '#00FF00',
  [Face.B]: '#0000FF',
  [Face.L]: '#FF8000',
  [Face.R]: '#FF0000',
};

// Tnoodle CubePuzzle: cubieSize=10, gap=2 → gap-as-fraction-of-cubie = 0.2.
// Stickers stroke is svglite default (1px on cubieSize=10) → 0.1 of a cubie.
const STROKE_COLOR = '#000000';
const GAP = 0.2;                  // gap between faces, in cell units (matches tnoodle 2/10)
const STROKE_W = 0.1;             // sticker outline, relative to 1×1 cell (matches tnoodle 1/10)

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

  // Tnoodle CubePuzzle layout (CubePuzzle.java getCubeViewWidth/Height):
  //   total width  = (size*cubie + gap)*4 + gap = 4*N + 5*GAP   (cell units)
  //   total height = (size*cubie + gap)*3 + gap = 3*N + 4*GAP
  // Face origins (in cell units):
  //   L = (gap, 2*gap + N)
  //   U = (2*gap + N, gap)
  //   F = (2*gap + N, 2*gap + N)
  //   R = (3*gap + 2N, 2*gap + N)
  //   B = (4*gap + 3N, 2*gap + N)
  //   D = (2*gap + N, 3*gap + 2N)
  const w = 4 * N + 5 * GAP;
  const h = 3 * N + 4 * GAP;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`);
  // Tnoodle's puzzle SVG is transparent; the gray cell background is drawn by
  // the PDF renderer behind the image, and shows through the face gaps.

  const offsets: Record<number, [number, number]> = {
    [Face.U]: [2 * GAP + N, GAP],
    [Face.L]: [GAP, 2 * GAP + N],
    [Face.F]: [2 * GAP + N, 2 * GAP + N],
    [Face.R]: [3 * GAP + 2 * N, 2 * GAP + N],
    [Face.B]: [4 * GAP + 3 * N, 2 * GAP + N],
    [Face.D]: [2 * GAP + N, 3 * GAP + 2 * N],
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
