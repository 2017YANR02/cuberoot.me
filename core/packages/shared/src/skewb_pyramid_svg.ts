/**
 * Skewb fan / pyramid view (5-face exploded layout) — port of the static
 * 25-polygon SVG layout used by mihlefeld/Alg-Trainers Skewb-NS2-Trainer.
 *
 * Layout shows U as a top diamond + 4 side faces fanning out below it. D face
 * center and D-face-corner stickers are hidden; only the 20 visible corner
 * stickers (3 around each upper corner, 2 around each lower corner from the
 * neighboring sides) plus 5 face centers are drawn.
 *
 * Geometry copied from https://github.com/mihlefeld/ALLG-ImageGen (GPL-3.0):
 *   - 27 vertex coords from cubevis/colorizer.py SkewbColorizer
 *   - 25 polygon → vertex-index lookup from get_polygons()
 *
 * State engine is local (`SkewbStateWCA` below) implementing WCA Regulations
 * #12h: R=DRB, U=ULB, L=DLF, B=DLB — each 120° CW from outside the named
 * corner. This differs from tnoodle's `SkewbState` in `skewb_svg.ts` (which
 * is needed for ScramblePreview2D since tnoodle's printed scramble images
 * must match its own internal state). The two share the same image[face][sticker]
 * layout so the polygon → (face, idx) map below is reused.
 */

/**
 * Polygon dictionary copied from upstream `SkewbColorizer.get_polygons()`.
 * Sticker keys follow upstream's `face + sorted(other_corner_faces)` convention:
 *   - "U", "F", "R", "B", "L"        → 5 face centers (4-vertex quads). No "D" — D-center is hidden.
 *   - "UFL", "UFR", "UBR", "UBL"     → U-face stickers at the 4 U-layer corners
 *   - "FLU", "FRU", "FDL", "FDR"     → F-face stickers (upper 2 + lower 2 = 4 corners visible on F)
 *   - "RFU", "RBU", "RDF", "RBD"     → ditto for R face
 *   - "BLU", "BRU", "BDL", "BDR"     → ditto for B face
 *   - "LBU", "LFU", "LBD", "LDF"     → ditto for L face
 * Total = 5 + 20 = 25 polygons.
 */
const POLYGONS: ReadonlyArray<readonly [string, ReadonlyArray<number>]> = [
  ['U', [1, 3, 5, 25]],
  ['F', [1, 9, 13, 8]],
  ['R', [3, 10, 15, 9]],
  ['B', [20, 22, 23, 10]],
  ['L', [7, 8, 19, 11]],
  ['RFU', [2, 3, 9]],
  ['RBU', [3, 4, 10]],
  ['RBD', [10, 15, 16]],
  ['RDF', [9, 14, 15]],
  ['UFL', [25, 0, 1]],
  ['UFR', [1, 2, 3]],
  ['UBR', [3, 4, 5]],
  ['UBL', [5, 24, 25]],
  ['FLU', [0, 1, 8]],
  ['FRU', [1, 2, 9]],
  ['FDR', [9, 13, 14]],
  ['FDL', [8, 12, 13]],
  ['BRU', [4, 20, 10]],
  ['BLU', [20, 21, 22]],
  ['BDL', [22, 23, 26]],
  ['BDR', [10, 23, 16]],
  ['LBU', [6, 7, 11]],
  ['LFU', [7, 0, 8]],
  ['LDF', [8, 19, 12]],
  ['LBD', [11, 18, 19]],
];

// Face index in our SkewbState: 0=U, 1=R, 2=F, 3=D, 4=L, 5=B.
// Sticker idx within each face: 0=center, 1=TL, 2=TR, 3=BL, 4=BR
// (per tnoodle/sr-puzzlegen, with face local frame: U above, "right" toward the
// face's clockwise neighbor when viewed from outside).
//
// Sticker idx → cube corner per face:
//   U: 1=ULB 2=URB 3=ULF 4=URF
//   D: 1=DLF 2=DRF 3=DLB 4=DRB
//   F: 1=ULF 2=URF 3=DLF 4=DRF
//   B: 1=URB 2=ULB 3=DRB 4=DLB
//   L: 1=ULB 2=ULF 3=DLB 4=DLF
//   R: 1=URF 2=URB 3=DRF 4=DRB
//
// Below: upstream-sticker-key → [myFaceIdx, myStickerIdx]
const STICKER_TO_MY_INDEX: Record<string, readonly [number, number]> = {
  U: [0, 0], R: [1, 0], F: [2, 0], L: [4, 0], B: [5, 0],
  // U face corners
  UBL: [0, 1], UBR: [0, 2], UFL: [0, 3], UFR: [0, 4],
  // R face corners
  RFU: [1, 1], RBU: [1, 2], RDF: [1, 3], RBD: [1, 4],
  // F face corners
  FLU: [2, 1], FRU: [2, 2], FDL: [2, 3], FDR: [2, 4],
  // L face corners
  LBU: [4, 1], LFU: [4, 2], LBD: [4, 3], LDF: [4, 4],
  // B face corners
  BRU: [5, 1], BLU: [5, 2], BDR: [5, 3], BDL: [5, 4],
};

/** WCA Regulations 3h1 official color hexes — matches the 3x3 cube renderer
 *  used in /visualcube. Indexed by my face index (0=U, 1=R, 2=F, 3=D, 4=L, 5=B). */
const COLORS: readonly string[] = [
  '#FFFFFF', // U white
  '#EE0000', // R red
  '#00D800', // F green
  '#FEFE00', // D yellow
  '#FFA100', // L orange
  '#0000F2', // B blue
];

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

/**
 * WCA Regulations #12h skewb state engine. image[face][sticker] indexing matches
 * tnoodle's SkewbState (URFDLB face order, 0=center, 1=TL, 2=TR, 3=BL, 4=BR
 * per face's local frame), but the move semantics use WCA-corner naming.
 */
class SkewbStateWCA {
  image: number[][] = Array.from({ length: 6 }, (_, i) => Array(5).fill(i));

  private static swap3(a: number[][], f1: number, s1: number, f2: number, s2: number, f3: number, s3: number) {
    const t = a[f1][s1]; a[f1][s1] = a[f2][s2]; a[f2][s2] = a[f3][s3]; a[f3][s3] = t;
  }

  private turnOnce(axis: number) {
    const im = this.image;
    const sw = SkewbStateWCA.swap3;
    switch (axis) {
      case 0: // R: CW around DRB. Centers R→B→D→R. Half = {DRB, DRF, URB, DLB}.
        sw(im, 1, 0, 3, 0, 5, 0);
        sw(im, 1, 4, 3, 4, 5, 3); // DRB self
        sw(im, 1, 2, 3, 2, 5, 4);
        sw(im, 5, 1, 1, 3, 3, 3);
        sw(im, 0, 2, 2, 4, 4, 3);
        break;
      case 1: // U: CW around ULB. Centers U→L→B→U. Half = {ULB, ULF, URB, DLB}.
        sw(im, 4, 0, 0, 0, 5, 0);
        sw(im, 4, 1, 0, 1, 5, 2); // ULB self
        sw(im, 4, 3, 0, 3, 5, 1);
        sw(im, 5, 4, 4, 2, 0, 2);
        sw(im, 3, 3, 2, 1, 1, 2);
        break;
      case 2: // L: CW around DLF. Centers D→L→F→D. Half = {DLF, DLB, DRF, ULF}.
        sw(im, 4, 0, 3, 0, 2, 0);
        sw(im, 4, 4, 3, 1, 2, 3); // DLF self
        sw(im, 4, 3, 3, 2, 2, 1);
        sw(im, 5, 4, 1, 3, 0, 3);
        sw(im, 3, 3, 2, 4, 4, 2);
        break;
      case 3: // B: CW around DLB. Centers D→B→L→D. Half = {DLB, DLF, DRB, ULB}.
        sw(im, 5, 0, 3, 0, 4, 0);
        sw(im, 5, 4, 3, 3, 4, 3); // DLB self
        sw(im, 5, 3, 3, 1, 4, 1);
        sw(im, 3, 4, 4, 4, 5, 2);
        sw(im, 1, 4, 2, 3, 0, 1);
        break;
    }
  }

  applyMove(token: string) {
    if (!token) return;
    const m = /^([RULBrulb])(['2]?)$/.exec(token.trim());
    if (!m) return;
    const ch = m[1].toUpperCase();
    const dir = m[2] === "'" ? 2 : 1;
    const axis = 'RULB'.indexOf(ch);
    if (axis < 0) return;
    for (let i = 0; i < dir; i++) this.turnOnce(axis);
  }

  applyAlgorithm(scramble: string) {
    for (const tok of scramble.split(/\s+/).filter(Boolean)) this.applyMove(tok);
  }
}

/** Original 27 vertices in 3D, before mihlefeld's `Rz(45°) ∘ Rx(30°)` projection.
 *  Copied verbatim from upstream `cubevis/colorizer.py SkewbColorizer`. */
const VERTICES_3D: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 2, 0],
  [1, 2, 0], [-2, 0, 0], [-1, 0, 0], [0, 0, 1], [2, 0, 1],
  [2, 2, 1], [-2, 0, 1], [0, 0, 2], [1, 0, 2], [2, 0, 2],
  [2, 1, 2], [2, 2, 2], [1, 2, 2], [-2, 0, 2], [-1, 0, 2],
  [2, 3, 0], [2, 4, 0], [2, 4, 1], [2, 3, 2], [0, 2, 0],
  [0, 1, 0], [2, 4, 2],
];

/** Default rotations matching upstream's fixed pose: Rz(45°) then Rx(30°). */
const DEFAULT_PYRAMID_ROTATIONS: ReadonlyArray<{ x?: number; y?: number; z?: number }> = [
  { z: 45 }, { x: 30 },
];

/** Apply Euler rotations to a 3D point in row-vector convention (matches scipy
 *  `coords @ R_z @ R_x` composition that mihlefeld used). */
function rotateRowVec(
  px: number, py: number, pz: number,
  rots: ReadonlyArray<{ x?: number; y?: number; z?: number }>,
): [number, number, number] {
  let x = px, y = py, z = pz;
  for (const r of rots) {
    if (r.x !== undefined) {
      const t = (r.x * Math.PI) / 180;
      const c = Math.cos(t), s = Math.sin(t);
      [x, y, z] = [x, y * c + z * s, -y * s + z * c];
    }
    if (r.y !== undefined) {
      const t = (r.y * Math.PI) / 180;
      const c = Math.cos(t), s = Math.sin(t);
      [x, y, z] = [x * c - z * s, y, x * s + z * c];
    }
    if (r.z !== undefined) {
      const t = (r.z * Math.PI) / 180;
      const c = Math.cos(t), s = Math.sin(t);
      [x, y, z] = [x * c + y * s, -x * s + y * c, z];
    }
  }
  return [x, y, z];
}

/** 5px viewBox padding around the polygons — matches the look of upstream's
 *  `normalize_vertices` so the layout doesn't touch the edge. */
const VIEWBOX_PADDING = 5;

/** Render a skewb fan/pyramid SVG. `rotations` is a sequence of Euler steps
 *  (same format as sr-puzzlegen `puzzle.rotations`). When omitted/empty,
 *  applies the upstream default pose `Rz(45°) ∘ Rx(30°)`. */
export function renderSkewbPyramidSvgParametric(
  scramble: string,
  rotations?: ReadonlyArray<{ x?: number; y?: number; z?: number }>,
): string {
  const state = new SkewbStateWCA();
  try { state.applyAlgorithm(scramble); } catch (e) {
    console.warn('[skewb_pyramid_svg] applyAlgorithm failed', scramble, e);
  }
  const rots = rotations && rotations.length > 0 ? rotations : DEFAULT_PYRAMID_ROTATIONS;
  // Project: drop y-component of rotated 3D coord, keep (x, z) for screen.
  const projected = VERTICES_3D.map((v) => {
    const [x, , z] = rotateRowVec(v[0], v[1], v[2], rots);
    return [x, z] as [number, number];
  });
  // Normalize to fit (100 - 2·padding) wide while preserving aspect, then offset
  // by `padding` so polygons don't touch the viewBox edge.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of projected) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const w = maxX - minX, h = maxY - minY;
  const innerW = 100 - 2 * VIEWBOX_PADDING;
  const scale = w === 0 ? 1 : innerW / w;
  const vw = innerW + 2 * VIEWBOX_PADDING;
  const vh = h * scale + 2 * VIEWBOX_PADDING;
  const norm = projected.map(([x, y]) => [
    (x - minX) * scale + VIEWBOX_PADDING,
    (y - minY) * scale + VIEWBOX_PADDING,
  ] as [number, number]);

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(vw)} ${fmt(vh)}">`);
  out.push('<style>polygon{stroke:#000;stroke-width:0.5;stroke-linejoin:round}</style>');
  for (const [stickerKey, vertexIdx] of POLYGONS) {
    const idx = STICKER_TO_MY_INDEX[stickerKey];
    if (!idx) continue;
    const [fi, si] = idx;
    const colorIdx = state.image[fi][si] ?? 0;
    const color = COLORS[colorIdx] ?? '#888';
    const points = vertexIdx.map((i) => {
      const [x, y] = norm[i];
      return `${fmt(x)},${fmt(y)}`;
    }).join(' ');
    out.push(`<polygon fill="${color}" points="${points}"/>`);
  }
  out.push('</svg>');
  return out.join('');
}
