/**
 * SQ1 geometry — cube-shaped pieces.
 *
 * Each piece's body is a vertical prism whose top-down 2D footprint matches
 * its share of the solved-state cube outline. Corners extend to the cube
 * corner (pentagonal footprint), edges sit flush against one cube face
 * (trapezoidal footprint). In solved state the 8 pieces of one layer tile
 * into a square, so the puzzle looks like a 2x3x3.
 *
 * Local frame convention: each piece is built with its center direction along
 * +X (local). The piece's rotY (world Y rotation) then places it at its NE /
 * NW / SE / SW corner (for corner pieces) or N / E / S / W (for edge pieces).
 *
 * For a corner piece in local:
 *   - cube corner is at (s√2, 0) in local XZ
 *   - cube faces meeting at the corner: local planes x-z=s√2 and x+z=s√2
 *
 * For an edge piece in local:
 *   - cube face is local plane x=s
 */
import * as THREE from 'three';

// ─── constants ────────────────────────────────────────────────────────────
/** Cubelet unit (matches stack/cuber's Cubelet.SIZE). Full cube side = 3 × SIZE. */
export const SQ1_SIZE = 64;

/** Cube half-side. SQ1 visually matches a 3×3 NxN cube. */
export const SQ1_CUBE_HALF = SQ1_SIZE * 1.5;

/** Half the diagonal of the cube top face, i.e. how far the corner of a corner
 *  piece extends from the center in its local frame. */
export const SQ1_OUTER_R = SQ1_CUBE_HALF * Math.SQRT2;

/** Height of one main layer (top or bottom). Set to 2/3 of cube side so that
 *  layer + equator + layer exactly fill the cube vertically and each layer's
 *  side face matches the 3×3 grid cell height (2s/3). */
export const SQ1_LAYER_H = (SQ1_CUBE_HALF * 2) / 3;

/** Height of the equator (mid-slice). Same as a layer (each = 1/3 cube). */
export const SQ1_EQUATOR_H = (SQ1_CUBE_HALF * 2) / 3;

/** Distance from cube center to the center of a layer. */
export const SQ1_LAYER_Y = (SQ1_EQUATOR_H + SQ1_LAYER_H) / 2;

/** Inner radius (spindle hole) of each piece — purely cosmetic, hides the seam at
 *  the rotation axis. */
export const SQ1_INNER_R = SQ1_SIZE * 0.18;

/** Gap between pieces (hairline). */
export const SQ1_GAP = 0.4;

/** Sticker outward offset from body face. */
export const SQ1_STICKER_LIFT = 0.4;

/** Sticker thickness. */
export const SQ1_STICKER_DEPTH = 0.4;

/** Sticker inset (border around each sticker). Small → stickers fill the 3×3
 *  cell with only a thin black border, matching cubedb. */
export const SQ1_STICKER_BORDER = 1.6;

/** Black plastic color. */
export const SQ1_BODY_COLOR = '#0E0E0E';

// ─── materials ────────────────────────────────────────────────────────────
export const SQ1_BODY_MAT = new THREE.MeshPhongMaterial({
  color: SQ1_BODY_COLOR,
  specular: '#3a3a3a',
  shininess: 24,
});

const _STICKER_MAT_CACHE = new Map<string, THREE.MeshPhongMaterial>();
export function stickerMaterial(hex: string): THREE.MeshPhongMaterial {
  let m = _STICKER_MAT_CACHE.get(hex);
  if (!m) {
    m = new THREE.MeshPhongMaterial({
      color: hex,
      specular: '#2a2a2a',
      shininess: 22,
    });
    _STICKER_MAT_CACHE.set(hex, m);
  }
  return m;
}

// ─── prism builder (custom — no ExtrudeGeometry coord dance) ──────────────
/**
 * Build a vertical prism from a 2D polygon (in XZ plane) extruded along Y.
 * Vertices should be in CCW order viewed from +Y above.
 * Result is centered on Y=0 with height `height`.
 */
function buildPrism(vertices2D: readonly (readonly [number, number])[], height: number): THREE.BufferGeometry {
  const n = vertices2D.length;
  const half = height / 2;
  const positions = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const [x, z] = vertices2D[i];
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = -half;
    positions[i * 3 + 2] = z;
    positions[(n + i) * 3 + 0] = x;
    positions[(n + i) * 3 + 1] = +half;
    positions[(n + i) * 3 + 2] = z;
  }
  const indices: number[] = [];
  // Top face (CCW from +Y): fan from top vertex 0
  for (let i = 1; i < n - 1; i++) indices.push(n, n + i, n + i + 1);
  // Bottom face (CCW from -Y = CW from +Y)
  for (let i = 1; i < n - 1; i++) indices.push(0, i + 1, i);
  // Side faces (outward normals)
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    indices.push(i, next, n + next);
    indices.push(i, n + next, n + i);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// ─── body geometries ──────────────────────────────────────────────────────
const DEG = Math.PI / 180;

/** Corner piece body — pentagonal footprint, asymmetric (cube corner at local
 *  -15° from wedge midline +X). Faces meeting at the cube corner have outward
 *  normals at local -60° and +30°. */
export function buildCornerBody(): THREE.BufferGeometry {
  const s = SQ1_CUBE_HALF;
  const halfSpan = 30 * DEG;
  const tanGap = SQ1_GAP / (s * Math.SQRT2);
  const hs = halfSpan - tanGap;
  const r_in = SQ1_INNER_R;
  const cornerLocalAng = -15 * DEG;
  const faceA_ang = -60 * DEG;   // cube face normal (cubeCorner − 45° in local)
  const faceB_ang = +30 * DEG;   // cube face normal (cubeCorner + 45°)
  // At ray angle θ, intersection with face plane (passing through cube corner
  // with outward normal at α, distance s from origin) is r = s / cos(θ − α).
  const r_outer_minus = s / Math.cos(-hs - faceA_ang);
  const r_outer_plus = s / Math.cos(+hs - faceB_ang);
  const cornerX = s * Math.SQRT2 * Math.cos(cornerLocalAng);
  const cornerZ = s * Math.SQRT2 * Math.sin(cornerLocalAng);

  const verts: [number, number][] = [
    [r_in * Math.cos(-hs), r_in * Math.sin(-hs)],
    [r_outer_minus * Math.cos(-hs), r_outer_minus * Math.sin(-hs)],
    [cornerX, cornerZ],
    [r_outer_plus * Math.cos(+hs), r_outer_plus * Math.sin(+hs)],
    [r_in * Math.cos(+hs), r_in * Math.sin(+hs)],
  ];
  return buildPrism(verts, SQ1_LAYER_H - SQ1_GAP);
}

/** Edge piece body — trapezoidal footprint (cube face normal at local -15°
 *  from wedge midline). */
export function buildEdgeBody(): THREE.BufferGeometry {
  const s = SQ1_CUBE_HALF;
  const halfSpan = 15 * DEG;
  const tanGap = SQ1_GAP / s;
  const hs = halfSpan - tanGap;
  const r_in = SQ1_INNER_R;
  const faceNormalAng = -15 * DEG;
  const r_outer_minus = s / Math.cos(-hs - faceNormalAng);
  const r_outer_plus = s / Math.cos(+hs - faceNormalAng);
  const verts: [number, number][] = [
    [r_in * Math.cos(-hs), r_in * Math.sin(-hs)],
    [r_outer_minus * Math.cos(-hs), r_outer_minus * Math.sin(-hs)],
    [r_outer_plus * Math.cos(+hs), r_outer_plus * Math.sin(+hs)],
    [r_in * Math.cos(+hs), r_in * Math.sin(+hs)],
  ];
  return buildPrism(verts, SQ1_LAYER_H - SQ1_GAP);
}

// ─── sticker shapes (rounded squares, extruded) ───────────────────────────
function roundedRectShape(w: number, h: number, radius: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(radius, hw, hh);
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(+hw - r, -hh);
  s.quadraticCurveTo(+hw, -hh, +hw, -hh + r);
  s.lineTo(+hw, +hh - r);
  s.quadraticCurveTo(+hw, +hh, +hw - r, +hh);
  s.lineTo(-hw + r, +hh);
  s.quadraticCurveTo(-hw, +hh, -hw, +hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  s.closePath();
  return s;
}

/** A rounded-square sticker (lies in default XY plane, extrudes along +Z). */
export function buildSquareSticker(side: number, border: number = SQ1_STICKER_BORDER): THREE.BufferGeometry {
  const inner = Math.max(2, side - 2 * border);
  const radius = inner * 0.18;
  const shape = roundedRectShape(inner, inner, radius);
  return new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.8,
    bevelThickness: 0.8,
    depth: SQ1_STICKER_DEPTH,
  });
}

/** Rectangular sticker (used for outer faces). Default XY plane, extrudes along +Z. */
export function buildRectSticker(width: number, height: number, border: number = SQ1_STICKER_BORDER): THREE.BufferGeometry {
  const w = Math.max(2, width - 2 * border);
  const h = Math.max(2, height - 2 * border);
  const radius = Math.min(w, h) * 0.18;
  const shape = roundedRectShape(w, h, radius);
  return new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.8,
    bevelThickness: 0.8,
    depth: SQ1_STICKER_DEPTH,
  });
}

// ─── equator slab geometry ────────────────────────────────────────────────
/** One half of the equator. Solved SQ1 has the equator split asymmetrically;
 *  we use equal halves for simplicity. Each slab is a box-prism. */
export function buildEquatorSlabBox(width: number, height: number, depth: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(width, height, depth);
}
