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
 * Skewb state engine — 8 corner-turns + 3 whole-cube rotations.
 *
 * Move semantics: each corner X (one of the 8 cube corners) names a 120° CW
 * rotation (viewed from outside X) of the half-cube containing X. The 4 corners
 * in the half + 3 face-centers adjacent to X cycle; the opposite half stays put.
 *
 * WCA Regulations #12h covers 4 of the 8 corners (R=DRB, U=ULB, L=DLF, B=DLB);
 * cubing.js's skewb notation mapper additionally defines F=UFR, D=DFR, and names
 * the remaining two corners with two-letter grips: UL=ULF, UR=URB (what the
 * Sarah-notation translator emits for Sarah L/R).
 *
 * image[face][sticker] indexing matches tnoodle's SkewbState (URFDLB face order,
 * 0=center, 1-4=corners in face-local TL/TR/BL/BR positions).
 *
 * Implementation: rotation matrices for all 8 corners (precomputed) drive a
 * generic permutation: face-normals and corner-positions are mapped through R,
 * stickers reseated accordingly. Whole-cube x/y/z rotations follow the same
 * permutation kernel but apply to all 8 corners + 6 centers.
 */

type Vec3 = readonly [number, number, number];
type Mat3 = ReadonlyArray<ReadonlyArray<number>>;

// 6 face normals (URFDLB face order, axis-aligned unit vectors).
const FACE_NORMALS: ReadonlyArray<Vec3> = [
  [0, 1, 0],   // 0: U
  [1, 0, 0],   // 1: R
  [0, 0, 1],   // 2: F
  [0, -1, 0],  // 3: D
  [-1, 0, 0],  // 4: L
  [0, 0, -1],  // 5: B
];

// 8 corner positions in cube vertex coords (±1, ±1, ±1).
const CORNERS: ReadonlyArray<Vec3> = [
  [-1, 1, 1],   // 0: ULF
  [1, 1, 1],    // 1: URF (= Sarah F)
  [1, 1, -1],   // 2: URB
  [-1, 1, -1],  // 3: ULB (= WCA U)
  [-1, -1, 1],  // 4: DLF (= WCA L)
  [1, -1, 1],   // 5: DRF (= cubing.js D)
  [1, -1, -1],  // 6: DRB (= WCA R)
  [-1, -1, -1], // 7: DLB (= WCA B)
];

/** "CW from outside corner" 120° rotation matrices, one per corner. Hand-derived
 *  to match the WCA convention for the 4 named corners (R/U/L/B) and cubing.js's
 *  skewb mapper for F/D, then carried through to the remaining ULF/URB via the
 *  same construction (xyz=+1 corners use Pattern A, xyz=-1 corners use A^T). */
const CORNER_TURN_MATS: ReadonlyArray<Mat3> = [
  // 0 ULF (xyz=-1)
  [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  // 1 URF (xyz=+1, Sarah F)
  [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  // 2 URB (xyz=-1, Sarah R)
  [[0, 0, -1], [1, 0, 0], [0, -1, 0]],
  // 3 ULB (xyz=+1, WCA U)
  [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
  // 4 DLF (xyz=+1, WCA L)
  [[0, 1, 0], [0, 0, -1], [-1, 0, 0]],
  // 5 DRF (xyz=-1, cubing.js D / Sarah d|f)
  [[0, 0, 1], [-1, 0, 0], [0, -1, 0]],
  // 6 DRB (xyz=+1, WCA R)
  [[0, -1, 0], [0, 0, 1], [-1, 0, 0]],
  // 7 DLB (xyz=-1, WCA B)
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
];

/** [face][cornerIdx] → sticker idx (1-4), or -1 if corner is not on that face.
 *  Encodes the face-local TL/TR/BL/BR layout (matches tnoodle's SkewbState). */
const FACE_CORNER_STICKER: ReadonlyArray<ReadonlyArray<number>> = [
  // 0 U: 1=ULB(3), 2=URB(2), 3=ULF(0), 4=URF(1)
  [3, 4, 2, 1, -1, -1, -1, -1],
  // 1 R: 1=URF(1), 2=URB(2), 3=DRF(5), 4=DRB(6)
  [-1, 1, 2, -1, -1, 3, 4, -1],
  // 2 F: 1=ULF(0), 2=URF(1), 3=DLF(4), 4=DRF(5)
  [1, 2, -1, -1, 3, 4, -1, -1],
  // 3 D: 1=DLF(4), 2=DRF(5), 3=DLB(7), 4=DRB(6)
  [-1, -1, -1, -1, 1, 2, 4, 3],
  // 4 L: 1=ULB(3), 2=ULF(0), 3=DLB(7), 4=DLF(4)
  [2, -1, -1, 1, 4, -1, -1, 3],
  // 5 B: 1=URB(2), 2=ULB(3), 3=DRB(6), 4=DLB(7)
  [-1, -1, 1, 2, -1, -1, 3, 4],
];

const WCA_LETTER_TO_CORNER: Record<string, number> = {
  R: 6, U: 3, L: 4, B: 7, F: 1, D: 5,
  // cubing.js's two-letter grips for the remaining corners (UL=ULF, UR=URB) —
  // the Sarah translator emits these for Sarah L/R. Verified UL ≡ y' F y and
  // UR ≡ y F y' render byte-identical SVGs.
  UL: 0, UR: 2,
};

// 90° rotation matrices in WCA x/y/z convention (x: F→U, y: F→L, z: U→R) for
// column-vector matVec application. Verified against the 6 letter corners via
// conjugate identities: y U y' ≡ UL, z F z' ≡ UL, x F x' ≡ D (cubing.js truth).
const X_ROT: Mat3 = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
const Y_ROT: Mat3 = [[0, 0, -1], [0, 1, 0], [1, 0, 0]];
const Z_ROT: Mat3 = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];

function matVec(M: Mat3, v: Vec3): Vec3 {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

function findFace(n: Vec3): number {
  for (let i = 0; i < 6; i++) {
    const f = FACE_NORMALS[i];
    if (f[0] === n[0] && f[1] === n[1] && f[2] === n[2]) return i;
  }
  return -1;
}

function findCorner(p: Vec3): number {
  for (let i = 0; i < 8; i++) {
    const c = CORNERS[i];
    if (c[0] === p[0] && c[1] === p[1] && c[2] === p[2]) return i;
  }
  return -1;
}

class SkewbStateWCA {
  image: number[][] = Array.from({ length: 6 }, (_, i) => Array(5).fill(i));

  private cornerTurnOnce(cornerIdx: number) {
    const X = CORNERS[cornerIdx];
    const R = CORNER_TURN_MATS[cornerIdx];
    const old = this.image.map((row) => [...row]);

    // 1) Face centers on X's half (3 faces adjacent to X).
    for (let face = 0; face < 6; face++) {
      const n = FACE_NORMALS[face];
      if (n[0] * X[0] + n[1] * X[1] + n[2] * X[2] <= 0) continue;
      const destFace = findFace(matVec(R, n));
      this.image[destFace][0] = old[face][0];
    }

    // 2) Corners in X's half (X + 3 edge-neighbors). Their stickers cycle.
    for (let c = 0; c < 8; c++) {
      const C = CORNERS[c];
      if (C[0] * X[0] + C[1] * X[1] + C[2] * X[2] <= 0) continue;
      const newCornerIdx = findCorner(matVec(R, C));
      for (let face = 0; face < 6; face++) {
        const srcSticker = FACE_CORNER_STICKER[face][c];
        if (srcSticker < 0) continue;
        const destFace = findFace(matVec(R, FACE_NORMALS[face]));
        const destSticker = FACE_CORNER_STICKER[destFace][newCornerIdx];
        this.image[destFace][destSticker] = old[face][srcSticker];
      }
    }
  }

  private rotationOnce(M: Mat3) {
    const old = this.image.map((row) => [...row]);
    for (let face = 0; face < 6; face++) {
      const destFace = findFace(matVec(M, FACE_NORMALS[face]));
      this.image[destFace][0] = old[face][0];
      for (let c = 0; c < 8; c++) {
        const srcSticker = FACE_CORNER_STICKER[face][c];
        if (srcSticker < 0) continue;
        const newCornerIdx = findCorner(matVec(M, CORNERS[c]));
        const destSticker = FACE_CORNER_STICKER[destFace][newCornerIdx];
        this.image[destFace][destSticker] = old[face][srcSticker];
      }
    }
  }

  applyMove(token: string) {
    if (!token) return;
    // Full token grammar `X`, `X'`, `X2`, `X2'`, ... — skewb-notation invert()
    // emits `X2'` (the exact inverse of X², = X on order-3 corners), so net
    // turns are computed mod the move order rather than pattern-matched.
    const m = /^(UL|UR|[RULBFDxyz])(\d*)('?)$/.exec(token.trim());
    if (!m) return;
    const ch = m[1];
    const amount = m[2] ? parseInt(m[2], 10) : 1;
    const prime = m[3] === "'";

    if (ch === 'x' || ch === 'y' || ch === 'z') {
      const M = ch === 'x' ? X_ROT : ch === 'y' ? Y_ROT : Z_ROT;
      const n = ((prime ? -amount : amount) % 4 + 4) % 4;
      for (let i = 0; i < n; i++) this.rotationOnce(M);
      return;
    }

    const cornerIdx = WCA_LETTER_TO_CORNER[ch];
    if (cornerIdx === undefined) return;
    // Corner twists are order 3: X2 ≡ X' (2 CW turns), X2' ≡ X, 3X = identity.
    const turns = ((prime ? -amount : amount) % 3 + 3) % 3;
    for (let i = 0; i < turns; i++) this.cornerTurnOnce(cornerIdx);
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
