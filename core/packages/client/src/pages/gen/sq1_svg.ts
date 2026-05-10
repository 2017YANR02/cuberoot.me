/**
 * Square-1 puzzle — TS port of tnoodle-lib `SquareOnePuzzle.java`
 * (D:\cube\tnoodle-lib\scrambles\src\main\java\.../puzzle/SquareOnePuzzle.java).
 *
 * Provides:
 *   - DEFAULT_SQ1_COLORS / SQ1_FACE_KEYS — 6 face colors (L/B/R/F/U/D)
 *   - applySq1Scramble(scramble) → 24-position state + sliceSolved flag
 *   - renderSq1Svg(state, colors) → flat SVG string
 *
 * State / drawing logic verbatim from tnoodle: 2 stacked hex faces,
 * 8 pieces each (4 corners + 4 wedges per face), corners drawn as 60°
 * pie-slice + 2 side stickers, wedges as 30° pie-slice + 1 side sticker.
 * Equator strip rendered between the two faces; mid-rect color depends on
 * sliceSolved (front color when slice is solved, back color otherwise).
 */

export const SQ1_FACE_KEYS = ['L', 'B', 'R', 'F', 'U', 'D'] as const;
export type Sq1FaceKey = typeof SQ1_FACE_KEYS[number];

/** Verbatim from tnoodle SquareOnePuzzle.java defaultColorScheme. */
export const DEFAULT_SQ1_COLORS: Record<Sq1FaceKey, string> = {
  L: '#0000FF', // BLUE
  B: '#FF8000', // ORANGE (heraldic tincture)
  R: '#00FF00', // GREEN
  F: '#FF0000', // RED
  U: '#FFFF00', // YELLOW
  D: '#FFFFFF', // WHITE
};

/**
 * 24-position piece array (12 top + 12 bottom). Pieces are stored at the
 * 30° wedge positions; corner pieces occupy 2 consecutive slots with the
 * same id (60° span). Solved id range: top 0..7, bottom 8..15.
 */
export interface Sq1State {
  sliceSolved: boolean;
  pieces: number[];
}

const SOLVED_PIECES: number[] = [
  0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7,
  8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15,
];

/** Parse + apply a WCA-spec sq1 scramble. Accepts both `(t,b)/...` and `t,b /...` forms. */
export function applySq1Scramble(scramble: string): Sq1State {
  let pieces = SOLVED_PIECES.slice();
  let sliceSolved = true;

  // Match either a slash or a (top, bottom) pair (with or without parens).
  const re = /(\/)|\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scramble)) !== null) {
    if (m[1] === '/') {
      const next = pieces.slice();
      // Swap [6..11] with [12..17] — same as tnoodle doSlash().
      for (let i = 0; i < 6; i++) {
        const c = next[i + 12];
        next[i + 12] = next[i + 6];
        next[i + 6] = c;
      }
      pieces = next;
      sliceSolved = !sliceSolved;
    } else if (m[2] !== undefined) {
      const top = parseInt(m[2], 10);
      const bottom = parseInt(m[3], 10);
      const t = ((-top % 12) + 12) % 12;
      const b = ((-bottom % 12) + 12) % 12;
      const next = pieces.slice();
      const oldTop = pieces.slice(0, 12);
      for (let i = 0; i < 12; i++) next[i] = oldTop[(t + i) % 12];
      const oldBot = pieces.slice(12, 24);
      for (let i = 0; i < 12; i++) next[i + 12] = oldBot[(b + i) % 12];
      pieces = next;
    }
  }
  return { pieces, sliceSolved };
}

// ─── SVG renderer ─────────────────────────────────────────────────────────
// All constants verbatim from SquareOnePuzzle.java.
const RADIUS = 32;
const RADIUS_MULTIPLIER = Math.sqrt(2) * Math.cos(Math.PI * 15 / 180);
const MULTIPLIER = 1.4;
const STROKE_WIDTH = 2;

const W = 2 * RADIUS_MULTIPLIER * MULTIPLIER * RADIUS;
const H = 4 * RADIUS_MULTIPLIER * MULTIPLIER * RADIUS;

function isCornerPiece(piece: number): boolean {
  return ((piece + (piece <= 7 ? 0 : 1)) % 2) === 0;
}

/** Returns [topFace, sideA, sideB?] colors for a given piece. */
function getPieceColors(piece: number, scheme: string[]): string[] {
  const up = piece <= 7;
  const top = up ? scheme[4] : scheme[5]; // U or D
  if (isCornerPiece(piece)) {
    let p = up ? piece : 15 - piece;
    let a = scheme[(Math.floor(p / 2) + 3) % 4];
    let b = scheme[Math.floor(p / 2)];
    if (!up) { const tmp = a; a = b; b = tmp; }
    return [top, a, b];
  } else {
    const p = up ? piece : 14 - piece;
    return [top, scheme[Math.floor(p / 2)]];
  }
}

function wedgePolys(r: number): string[] {
  const tx = Math.sqrt(3) * r / 2;
  const ty = r / 2;
  return [
    `M 0 0 L ${r} 0 L ${tx} ${ty} Z`,
    `M ${r} 0 L ${MULTIPLIER * r} 0 L ${MULTIPLIER * tx} ${MULTIPLIER * ty} L ${tx} ${ty} Z`,
  ];
}

function cornerPolys(r: number): string[] {
  const tx = r * (1 + Math.cos(Math.PI * 75 / 180) / Math.sqrt(2));
  const ty = r * Math.sin(Math.PI * 75 / 180) / Math.sqrt(2);
  const tX = r / 2;
  const tY = Math.sqrt(3) * r / 2;
  return [
    `M 0 0 L ${r} 0 L ${tx} ${ty} L ${tX} ${tY} Z`,
    `M ${r} 0 L ${MULTIPLIER * r} 0 L ${MULTIPLIER * tx} ${MULTIPLIER * ty} L ${tx} ${ty} Z`,
    `M ${MULTIPLIER * tx} ${MULTIPLIER * ty} L ${tx} ${ty} L ${tX} ${tY} L ${MULTIPLIER * tX} ${MULTIPLIER * tY} Z`,
  ];
}

/** Walk the 12-slot face array, drawing each piece + advancing rotation by piece span. */
function drawFace(
  parts: string[], face: number[], cx: number, cy: number,
  startAngle: number, scheme: string[],
): void {
  let angle = startAngle;
  let ch = 0;
  while (ch < 12) {
    // Corner pieces span 2 wedge slots — skip the first to keep face[ch] = piece id.
    if (ch < 11 && face[ch] === face[ch + 1]) ch++;
    const piece = face[ch];
    const corner = isCornerPiece(piece);
    const polys = corner ? cornerPolys(RADIUS) : wedgePolys(RADIUS);
    const colors = getPieceColors(piece, scheme);
    // Tnoodle iterates colors high-index → low so side2/side1 paint before main.
    for (let i = colors.length - 1; i >= 0; i--) {
      parts.push(
        `<path d="${polys[i]}" fill="${colors[i]}" stroke="#000" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round" transform="translate(${cx},${cy}) rotate(${angle})" />`,
      );
    }
    angle += 30 * (corner ? 2 : 1);
    ch++;
  }
}

export function renderSq1Svg(state: Sq1State, colors: Record<string, string>): string {
  const { pieces, sliceSolved } = state;
  const scheme: string[] = SQ1_FACE_KEYS.map(
    (k) => colors[k] ?? DEFAULT_SQ1_COLORS[k],
  );

  const halfSquareWidth = (RADIUS * RADIUS_MULTIPLIER * MULTIPLIER) / Math.sqrt(2);
  const edgeWidth = 2 * RADIUS * MULTIPLIER * Math.sin(Math.PI * 15 / 180);
  const cornerWidth = halfSquareWidth - edgeWidth / 2;
  const equatorH = RADIUS * (MULTIPLIER - 1);

  const leftX = W / 2 - halfSquareWidth;
  const midY = H / 2 - equatorH / 2;
  const rightW = sliceSolved
    ? 2 * cornerWidth + edgeWidth
    : cornerWidth + edgeWidth;
  const rightFill = sliceSolved ? scheme[3] /* F */ : scheme[1] /* B */;

  const parts: string[] = [];
  // Equator: right rect first, left rect on top (clobbers part), then both outlines.
  parts.push(`<rect x="${leftX}" y="${midY}" width="${rightW}" height="${equatorH}" fill="${rightFill}" />`);
  parts.push(`<rect x="${leftX}" y="${midY}" width="${cornerWidth}" height="${equatorH}" fill="${scheme[3]}" />`);
  parts.push(`<rect x="${leftX}" y="${midY}" width="${rightW}" height="${equatorH}" fill="none" stroke="#000" stroke-width="${STROKE_WIDTH}" />`);
  parts.push(`<rect x="${leftX}" y="${midY}" width="${cornerWidth}" height="${equatorH}" fill="none" stroke="#000" stroke-width="${STROKE_WIDTH}" />`);

  // Top face — initial rotation 90+15° puts piece 0 at the bottom-left going CW.
  drawFace(parts, pieces.slice(0, 12), W / 2, H / 4, 90 + 15, scheme);
  // Bottom face — mirrored angle.
  drawFace(parts, pieces.slice(12, 24), W / 2, 3 * H / 4, -(90 + 15), scheme);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" stroke-linecap="round" style="width:100%;height:100%">${parts.join('')}</svg>`;
}

/** Convenience: scramble string + colors → final SVG. */
export function renderSq1ScrambleSvg(scramble: string, colors: Record<string, string>): string {
  return renderSq1Svg(applySq1Scramble(scramble), colors);
}
