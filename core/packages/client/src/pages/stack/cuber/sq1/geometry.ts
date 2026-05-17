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

/** Sticker bevel parameters (cubedb-style pillow). Total thickness =
 *  2 × BEVEL_THICKNESS. With negative offset + matching size the silhouette
 *  equals the inset shape; bevel just rounds the edges. */
export const SQ1_STICKER_BEVEL_SIZE = 3.2;       // ≈ SIZE * 0.05
export const SQ1_STICKER_BEVEL_THICKNESS = 2.4;  // ≈ SIZE * 0.038
export const SQ1_STICKER_BEVEL_OFFSET = -3.2;
export const SQ1_STICKER_BEVEL_SEGMENTS = 3;

/** Distance from body face to sticker MIDplane. Set = BEVEL_THICKNESS + ε
 *  so the inner-half of the pillow sits flush with the body, outer-half
 *  pillows outward (and no part of the sticker buries inside the body). */
export const SQ1_STICKER_LIFT = SQ1_STICKER_BEVEL_THICKNESS + 0.6;

/** Sticker inset from cell edge (black plastic hairline showing between stickers). */
export const SQ1_STICKER_BORDER = 1.6;

/** Black plastic color (body). */
export const SQ1_BODY_COLOR = '#0a0a0a';

// ─── materials ────────────────────────────────────────────────────────────
/** Plastic body — matte-ish dark grey with subdued highlights. */
export const SQ1_BODY_MAT = new THREE.MeshPhongMaterial({
  color: SQ1_BODY_COLOR,
  specular: '#1a1a1a',
  shininess: 30,
});

/** Sticker material — strong specular for glossy "decal" highlights
 *  (matches cubedb's specular=0x222222, shininess=40 spec, slightly bumped
 *  to compensate for our smaller world scale and renderer linear lighting). */
const _STICKER_MAT_CACHE = new Map<string, THREE.MeshPhongMaterial>();
export function stickerMaterial(hex: string): THREE.MeshPhongMaterial {
  let m = _STICKER_MAT_CACHE.get(hex);
  if (!m) {
    m = new THREE.MeshPhongMaterial({
      color: hex,
      specular: '#222222',
      shininess: 40,
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

/** Corner piece body — quadrilateral footprint with apex at the rotation axis,
 *  asymmetric cube-corner at local -15° from wedge midline +X. Faces meeting
 *  at the cube corner have outward normals at local -60° and +30°. */
export function buildCornerBody(): THREE.BufferGeometry {
  const s = SQ1_CUBE_HALF;
  const halfSpan = 30 * DEG;
  const tanGap = SQ1_GAP / (s * Math.SQRT2);
  const hs = halfSpan - tanGap;
  const cornerLocalAng = -15 * DEG;
  const faceA_ang = -60 * DEG;   // cube face normal (cubeCorner − 45° in local)
  const faceB_ang = +30 * DEG;   // cube face normal (cubeCorner + 45°)
  // At ray angle θ, intersection with face plane (passing through cube corner
  // with outward normal at α, distance s from origin) is r = s / cos(θ − α).
  const r_outer_minus = s / Math.cos(-hs - faceA_ang);
  const r_outer_plus = s / Math.cos(+hs - faceB_ang);
  const cornerX = s * Math.SQRT2 * Math.cos(cornerLocalAng);
  const cornerZ = s * Math.SQRT2 * Math.sin(cornerLocalAng);

  // CCW from +Y: apex at origin → outer ribbon at -hs → cube-corner → outer ribbon at +hs.
  const verts: [number, number][] = [
    [0, 0],
    [r_outer_minus * Math.cos(-hs), r_outer_minus * Math.sin(-hs)],
    [cornerX, cornerZ],
    [r_outer_plus * Math.cos(+hs), r_outer_plus * Math.sin(+hs)],
  ];
  return buildPrism(verts, SQ1_LAYER_H - SQ1_GAP);
}

/** Edge piece body — triangular footprint with apex at the rotation axis,
 *  cube-face flush at local -15° from wedge midline. */
export function buildEdgeBody(): THREE.BufferGeometry {
  const s = SQ1_CUBE_HALF;
  const halfSpan = 15 * DEG;
  const tanGap = SQ1_GAP / s;
  const hs = halfSpan - tanGap;
  const faceNormalAng = -15 * DEG;
  const r_outer_minus = s / Math.cos(-hs - faceNormalAng);
  const r_outer_plus = s / Math.cos(+hs - faceNormalAng);
  const verts: [number, number][] = [
    [0, 0],
    [r_outer_minus * Math.cos(-hs), r_outer_minus * Math.sin(-hs)],
    [r_outer_plus * Math.cos(+hs), r_outer_plus * Math.sin(+hs)],
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

/** Common extrude params: cubedb's "pillow" trick. depth=0 + negative
 *  bevelOffset cancels the bevelSize, so the silhouette equals the input
 *  shape; the bevel rounds the edges and gives 2× bevelThickness of total
 *  Z extent. The result reads as a glossy molded sticker, not a flat decal. */
const PILLOW_EXTRUDE: THREE.ExtrudeGeometryOptions = {
  steps: 1,
  depth: 0,
  bevelEnabled: true,
  bevelThickness: SQ1_STICKER_BEVEL_THICKNESS,
  bevelSize: SQ1_STICKER_BEVEL_SIZE,
  bevelOffset: SQ1_STICKER_BEVEL_OFFSET,
  bevelSegments: SQ1_STICKER_BEVEL_SEGMENTS,
};

/** A rounded-square sticker (lies in default XY plane, extrudes along ±Z). */
export function buildSquareSticker(side: number, border: number = SQ1_STICKER_BORDER): THREE.BufferGeometry {
  const inner = Math.max(2, side - 2 * border);
  const radius = inner * 0.16;
  const shape = roundedRectShape(inner, inner, radius);
  return new THREE.ExtrudeGeometry(shape, PILLOW_EXTRUDE);
}

/** Rectangular sticker (used for outer faces). Default XY plane, extrudes along ±Z. */
export function buildRectSticker(width: number, height: number, border: number = SQ1_STICKER_BORDER): THREE.BufferGeometry {
  const w = Math.max(2, width - 2 * border);
  const h = Math.max(2, height - 2 * border);
  const radius = Math.min(w, h) * 0.16;
  const shape = roundedRectShape(w, h, radius);
  return new THREE.ExtrudeGeometry(shape, PILLOW_EXTRUDE);
}

// ─── equator slab geometry ────────────────────────────────────────────────
/** One half of the equator. Solved SQ1 has the equator split asymmetrically;
 *  we use equal halves for simplicity. Each slab is a box-prism. */
export function buildEquatorSlabBox(width: number, height: number, depth: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(width, height, depth);
}
