/**
 * Square-1 2D SVG renderer — TS port of tnoodle-lib `SquareOnePuzzle.java`
 * drawing code. Notation + state application live in
 * `@cuberoot/shared/sq1-notation` (single source); this file only draws.
 *
 * Drawing logic verbatim from tnoodle: 2 stacked hex faces, 8 pieces each
 * (4 corners + 4 wedges per face), corners drawn as 60° pie-slice + 2 side
 * stickers, wedges as 30° pie-slice + 1 side sticker. Equator strip rendered
 * between the two faces; mid-rect color depends on sliceSolved (front color
 * when slice is solved, back color otherwise).
 */
import { applySq1Scramble, type Sq1State } from '@cuberoot/shared/sq1-notation';
import type { MaskRenderOptions } from '@/lib/puzzle-image/mask-core';

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

/**
 * Canonical sticker id for a piece's drawn poly index (mask-core sq1 空间,
 * piece 本位:面 U0-7 / D8-15 / SA0-15 / SB{corner} / M0-5,单一源 = 引擎
 * `sq1Geometry.pieceFaces()` 的 sideA/sideB 命名)。
 *
 * poly[0] = 顶/底面贴纸 → `U{p}`(top 层)/ `D{p}`(bottom 层,index=全局 piece id)。
 * 侧贴纸:getPieceColors 在 bottom 层交换过 a/b(视觉镜像),而引擎 pieceFaces
 * 不换(几何靠 pivot.scale.y=−1 镜像)—— 所以 top 层 poly[1]↔SA poly[2]↔SB,
 * bottom 层 poly[1]↔SB poly[2]↔SA(edge 无 swap,两层 poly[1] 都是 SA)。
 * equator 两矩形不发 id(tnoodle 2D 本就不逐贴纸画中层;M0-5 走引擎伴图)。
 */
function pieceStickerSid(piece: number, polyIdx: number): string {
  if (polyIdx === 0) return piece <= 7 ? `U${piece}` : `D${piece}`;
  if (!isCornerPiece(piece) || piece <= 7) return polyIdx === 1 ? `SA${piece}` : `SB${piece}`;
  return polyIdx === 1 ? `SB${piece}` : `SA${piece}`; // bottom corner: swapped
}

/** Walk the 12-slot face array, drawing each piece + advancing rotation by piece span. */
function drawFace(
  parts: string[], face: number[], cx: number, cy: number,
  startAngle: number, scheme: string[], opts?: MaskRenderOptions,
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
      // Mask 语义 = piece-following 免费获得:face 数组携带 piece id 随打乱走,
      // sid 是 solved 帧命名,灰化自动跟块。
      const sid = pieceStickerSid(piece, i);
      const fill = opts?.mask?.ids.has(sid) ? opts.mask.color : colors[i];
      const sidAttr = opts?.stickerIds ? ` data-sid="${sid}"` : '';
      parts.push(
        `<path d="${polys[i]}"${sidAttr} fill="${fill}" stroke="#000" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round" transform="translate(${cx},${cy}) rotate(${angle})" />`,
      );
    }
    angle += 30 * (corner ? 2 : 1);
    ch++;
  }
}

export function renderSq1Svg(state: Sq1State, colors: Record<string, string>, opts?: MaskRenderOptions): string {
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
  drawFace(parts, pieces.slice(0, 12), W / 2, H / 4, 90 + 15, scheme, opts);
  // Bottom face — mirrored angle.
  drawFace(parts, pieces.slice(12, 24), W / 2, 3 * H / 4, -(90 + 15), scheme, opts);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" stroke-linecap="round" style="width:100%;height:100%">${parts.join('')}</svg>`;
}

/** Convenience: scramble string + colors → final SVG. */
export function renderSq1ScrambleSvg(scramble: string, colors: Record<string, string>, opts?: MaskRenderOptions): string {
  return renderSq1Svg(applySq1Scramble(scramble), colors, opts);
}
