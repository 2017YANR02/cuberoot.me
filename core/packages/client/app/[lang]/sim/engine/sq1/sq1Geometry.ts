/**
 * Square-1 geometry builders, ported from /demo/sq1.
 *
 * Pure three.js — no scene/camera/renderer concerns. Used by Sq1Cube to assemble
 * 16 piece pivots + 2 middle pivots; animation lives in Sq1Twister.
 *
 * Coordinate convention (world):
 *   - Y vertical (up), +X right, +Z toward viewer.
 *   - Cube half-side W along X and Z. Top layer height LAYER_HEIGHT above
 *     equator midpoint, bot LAYER_HEIGHT below. Equator MID_HEIGHT thick.
 *
 * Piece pivot conventions:
 *   - Top piece pivots: pos.y = +HALF_MID, identity quaternion before placement
 *     (then rotated around +Y by `angleRad`).
 *   - Bot piece pivots: pos.y = -HALF_MID, scale.y = -1 (reflection across XZ
 *     plane). scale.y is set ONCE here and never touched again — it's
 *     decoupled from rotation, so quaternion composition stays in SO(3).
 */
import * as THREE from 'three';

// ─── constants ────────────────────────────────────────────────────────────
export const W = 137.5;                                     // cube half-side
export const WEDGE_HALF_CHORD = W * Math.tan(Math.PI / 12); // ≈36.84
export const TILE_W = W - WEDGE_HALF_CHORD;                 // corner-face width ≈100.66
export const WEDGE_FACE_W = 2 * WEDGE_HALF_CHORD;           // wedge-face width ≈73.68
export const LAYER_HEIGHT = 100;
export const MID_HEIGHT = 75;
export const HALF_MID = MID_HEIGHT / 2;

const BEVEL = {
  steps: 2, depth: LAYER_HEIGHT,
  bevelEnabled: true, bevelThickness: 5, bevelSize: 20,
  bevelOffset: -20, bevelSegments: 3,
};
const STICKER_Z = LAYER_HEIGHT + BEVEL.bevelThickness + 0.5;
const SIDE_OFFSET = 0.5;
const STICKER_DEPTH = 2;
const STICKER_SHININESS = 60;
const STICKER_SPECULAR = 0x444444;
const TOP_STICKER_INSET = 18;
const SIDE_INSET_H = 3;
const SIDE_INSET_V = 3;
const CORNER_FACE_CENTER = (W + WEDGE_HALF_CHORD) / 2;

export const SQ1_COLORS = {
  L: 0x1f4dff,
  B: 0xff8000,
  R: 0x00b53d,
  F: 0xd0021b,
  U: 0x141414,
  D: 0xf0f0f0,
  BODY: 0x0a0a0a,
};

export const FACE_ORDER = ['L', 'B', 'R', 'F'] as const;
type FaceKey = keyof typeof SQ1_COLORS;

/** Slice axis (chord-perp). 180° around this swaps F/B walls of the BIG mid
 *  piece and the east half of top+bot layers. */
export const SLICE_AXIS = new THREE.Vector3(W, 0, WEDGE_HALF_CHORD).normalize();

// ─── piece classification ─────────────────────────────────────────────────
export function isCornerPiece(piece: number): boolean {
  return ((piece + (piece <= 7 ? 0 : 1)) % 2) === 0;
}

export function pieceFaces(piece: number): { top: FaceKey; sideA: FaceKey; sideB?: FaceKey } {
  const up = piece <= 7;
  const top: FaceKey = up ? 'U' : 'D';
  if (isCornerPiece(piece)) {
    const p = up ? piece : 15 - piece;
    const a = FACE_ORDER[(Math.floor(p / 2) + 3) % 4];
    const b = FACE_ORDER[Math.floor(p / 2)];
    return { top, sideA: a, sideB: b };
  } else {
    const p = up ? piece : 14 - piece;
    return { top, sideA: FACE_ORDER[Math.floor(p / 2)] };
  }
}

// ─── shape helpers ────────────────────────────────────────────────────────
function cornerShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(W, WEDGE_HALF_CHORD);
  s.lineTo(W, W);
  s.lineTo(WEDGE_HALF_CHORD, W);
  s.lineTo(0, 0);
  return s;
}

function wedgeShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(W, -WEDGE_HALF_CHORD);
  s.lineTo(W, WEDGE_HALF_CHORD);
  s.lineTo(0, 0);
  return s;
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const halfW = w / 2, halfH = h / 2;
  const rr = Math.min(r, halfW, halfH);
  const s = new THREE.Shape();
  s.moveTo(-halfW, -halfH + rr);
  s.lineTo(-halfW, halfH - rr);
  s.quadraticCurveTo(-halfW, halfH, -halfW + rr, halfH);
  s.lineTo(halfW - rr, halfH);
  s.quadraticCurveTo(halfW, halfH, halfW, halfH - rr);
  s.lineTo(halfW, -halfH + rr);
  s.quadraticCurveTo(halfW, -halfH, halfW - rr, -halfH);
  s.lineTo(-halfW + rr, -halfH);
  s.quadraticCurveTo(-halfW, -halfH, -halfW, -halfH + rr);
  s.closePath();
  return s;
}

function insetShape(verts: [number, number][], inset: number): THREE.Shape {
  let cx = 0, cy = 0;
  for (const [x, y] of verts) { cx += x; cy += y; }
  cx /= verts.length; cy /= verts.length;
  let maxD = 0;
  for (const [x, y] of verts) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > maxD) maxD = d;
  }
  const scale = Math.max(0.1, 1 - inset / maxD);
  const s = new THREE.Shape();
  const insetVerts = verts.map(([x, y]): [number, number] => [
    cx + (x - cx) * scale,
    cy + (y - cy) * scale,
  ]);
  s.moveTo(insetVerts[0][0], insetVerts[0][1]);
  for (let i = 1; i < insetVerts.length; i++) s.lineTo(insetVerts[i][0], insetVerts[i][1]);
  s.closePath();
  return s;
}

function mkStickerMat(color: number): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color, specular: STICKER_SPECULAR, shininess: STICKER_SHININESS,
    side: THREE.DoubleSide,
  });
}

function mkRaisedRectSticker(w: number, h: number, mat: THREE.MeshPhongMaterial): THREE.Mesh {
  const shape = roundedRectShape(w, h, Math.min(w, h) * 0.12);
  const geom = new THREE.ExtrudeGeometry(shape, {
    steps: 1, depth: STICKER_DEPTH,
    bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6,
    bevelOffset: 0, bevelSegments: 1,
  });
  const mesh = new THREE.Mesh(geom, mat);
  // 立体贴片 toggle: extruded along mesh-local +z, flatten via mesh.scale.z (stickerThickness.ts).
  mesh.userData.simRole = 'sticker';
  mesh.userData.simFlatten = 'scaleZ';
  return mesh;
}

// ─── piece builder ────────────────────────────────────────────────────────
export interface PieceBuild {
  pivot: THREE.Object3D;
  group: THREE.Group;
}

export function buildPieceMesh(piece: number, isTopLayer: boolean): PieceBuild {
  const faces = pieceFaces(piece);
  const corner = isCornerPiece(piece);

  const outline = corner ? cornerShape() : wedgeShape();
  const bodyGeom = new THREE.ExtrudeGeometry(outline, BEVEL);
  const bodyMat = new THREE.MeshPhongMaterial({
    color: SQ1_COLORS.BODY, specular: 0x222222, shininess: 25,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
  bodyMesh.userData.simRole = 'body'; // structure-coloring debug overlay (debugColors.ts)
  group.add(bodyMesh);

  // Top sticker (raised ExtrudeGeometry, inset toward centroid for body-color seams).
  const topInsetVerts: [number, number][] = corner
    ? [[0, 0], [W, WEDGE_HALF_CHORD], [W, W], [WEDGE_HALF_CHORD, W]]
    : [[0, 0], [W, -WEDGE_HALF_CHORD], [W, WEDGE_HALF_CHORD]];
  const topStickerShape = insetShape(topInsetVerts, TOP_STICKER_INSET);
  const topStickerGeom = new THREE.ExtrudeGeometry(topStickerShape, {
    steps: 1, depth: STICKER_DEPTH,
    bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6,
    bevelOffset: 0, bevelSegments: 1,
  });
  const topSticker = new THREE.Mesh(topStickerGeom, mkStickerMat(SQ1_COLORS[faces.top]));
  topSticker.position.z = STICKER_Z;
  topSticker.userData.simRole = 'sticker'; // 立体贴片: flatten via mesh.scale.z (stickerThickness.ts)
  topSticker.userData.simFlatten = 'scaleZ';
  topSticker.userData.simStickerNormal = new THREE.Vector3(0, 0, 1); // 原核: body +z cap (rawBody.ts)
  group.add(topSticker);

  if (corner) {
    const matA = mkStickerMat(SQ1_COLORS[faces.sideA]);
    const matB = mkStickerMat(SQ1_COLORS[faces.sideB!]);

    const wallA = mkRaisedRectSticker(TILE_W - 2 * SIDE_INSET_H, LAYER_HEIGHT - 2 * SIDE_INSET_V, matA);
    wallA.position.set(CORNER_FACE_CENTER, W + SIDE_OFFSET, LAYER_HEIGHT / 2);
    wallA.rotation.set(-Math.PI / 2, 0, 0);
    wallA.userData.simStickerNormal = new THREE.Vector3(0, 1, 0); // 原核: body +y face (rawBody.ts)
    group.add(wallA);

    const wallB = mkRaisedRectSticker(TILE_W - 2 * SIDE_INSET_H, LAYER_HEIGHT - 2 * SIDE_INSET_V, matB);
    wallB.position.set(W + SIDE_OFFSET, CORNER_FACE_CENTER, LAYER_HEIGHT / 2);
    wallB.rotation.set(0, Math.PI / 2, Math.PI / 2);
    wallB.userData.simStickerNormal = new THREE.Vector3(1, 0, 0); // 原核: body +x face
    group.add(wallB);
  } else {
    const matA = mkStickerMat(SQ1_COLORS[faces.sideA]);
    const wallA = mkRaisedRectSticker(WEDGE_FACE_W - 2 * SIDE_INSET_H, LAYER_HEIGHT - 2 * SIDE_INSET_V, matA);
    wallA.position.set(W + SIDE_OFFSET, 0, LAYER_HEIGHT / 2);
    wallA.rotation.set(0, Math.PI / 2, Math.PI / 2);
    wallA.userData.simStickerNormal = new THREE.Vector3(1, 0, 0); // 原核: body +x face (rawBody.ts)
    group.add(wallA);
  }

  const pivot = new THREE.Object3D();
  group.rotation.x = -Math.PI / 2;
  pivot.add(group);
  if (!isTopLayer) pivot.scale.y = -1;

  return { group, pivot };
}

// ─── middle slabs (2 asymmetric trapezoids split by chord-perp cut) ───────
export interface MiddlePair {
  big: THREE.Object3D;   // side=+1, rides the slice
  small: THREE.Object3D; // side=-1, stays put
}

export function buildMiddlePair(): MiddlePair {
  const CUT_TOP_X = +WEDGE_HALF_CHORD;
  const CUT_BOT_X = -WEDGE_HALF_CHORD;
  const cutTopShape: [number, number] = [CUT_TOP_X, +W];
  const cutBotShape: [number, number] = [CUT_BOT_X, -W];

  const bodyMat = new THREE.MeshPhongMaterial({
    color: SQ1_COLORS.BODY, specular: 0x222222, shininess: 25,
    side: THREE.DoubleSide,
  });

  const mkHalf = (kind: 'big' | 'small'): THREE.Object3D => {
    const shape = new THREE.Shape();
    if (kind === 'big') {
      shape.moveTo(cutBotShape[0], cutBotShape[1]);
      shape.lineTo(W, -W);
      shape.lineTo(W, W);
      shape.lineTo(cutTopShape[0], cutTopShape[1]);
      shape.lineTo(cutBotShape[0], cutBotShape[1]);
    } else {
      shape.moveTo(-W, W);
      shape.lineTo(-W, -W);
      shape.lineTo(cutBotShape[0], cutBotShape[1]);
      shape.lineTo(cutTopShape[0], cutTopShape[1]);
      shape.lineTo(-W, W);
    }
    const geom = new THREE.ExtrudeGeometry(shape, {
      steps: 1, depth: MID_HEIGHT,
      bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5,
      bevelOffset: -1.5, bevelSegments: 1,
    });
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, -HALF_MID, 0);
    const pivot = new THREE.Object3D();
    const bodyMesh = new THREE.Mesh(geom, bodyMat);
    bodyMesh.userData.simRole = 'body'; // structure-coloring debug overlay (debugColors.ts)
    pivot.add(bodyMesh);

    const stickerH = MID_HEIGHT - 2 * SIDE_INSET_V;
    const addSticker = (color: number, axisFace: 'L' | 'R' | 'F' | 'B', zFrom: number, zTo: number, xFrom: number, xTo: number): void => {
      let posX: number, posZ: number, rotY: number, tangentialLen: number;
      if (axisFace === 'L' || axisFace === 'R') {
        posX = (axisFace === 'R' ? +1 : -1) * (W + SIDE_OFFSET);
        posZ = (zFrom + zTo) / 2;
        rotY = axisFace === 'R' ? Math.PI / 2 : -Math.PI / 2;
        tangentialLen = Math.abs(zTo - zFrom);
      } else {
        posX = (xFrom + xTo) / 2;
        posZ = (axisFace === 'F' ? +1 : -1) * (W + SIDE_OFFSET);
        rotY = axisFace === 'F' ? 0 : Math.PI;
        tangentialLen = Math.abs(xTo - xFrom);
      }
      const w = Math.max(1, tangentialLen - 2 * SIDE_INSET_H);
      const mesh = mkRaisedRectSticker(w, stickerH, mkStickerMat(color));
      mesh.position.set(posX, 0, posZ);
      mesh.rotation.set(0, rotY, 0);
      // 原核: body wall normal in the (rotateX-baked) middle frame (rawBody.ts).
      mesh.userData.simStickerNormal = new THREE.Vector3(
        axisFace === 'R' ? 1 : axisFace === 'L' ? -1 : 0,
        0,
        axisFace === 'F' ? 1 : axisFace === 'B' ? -1 : 0,
      );
      pivot.add(mesh);
    };

    if (kind === 'big') {
      addSticker(SQ1_COLORS.R, 'R', -W, W, 0, 0);
      addSticker(SQ1_COLORS.F, 'F', 0, 0, CUT_BOT_X, W);
      addSticker(SQ1_COLORS.B, 'B', 0, 0, CUT_TOP_X, W);
    } else {
      addSticker(SQ1_COLORS.L, 'L', -W, W, 0, 0);
      addSticker(SQ1_COLORS.F, 'F', 0, 0, -W, CUT_BOT_X);
      addSticker(SQ1_COLORS.B, 'B', 0, 0, -W, CUT_TOP_X);
    }
    return pivot;
  };

  return { big: mkHalf('big'), small: mkHalf('small') };
}

// ─── slot placement ───────────────────────────────────────────────────────
export function placementForSlot(slot: number, corner: boolean): { angleRad: number; isTop: boolean } {
  const isTop = slot < 12;
  const k = isTop ? slot : slot - 12;
  let angleDeg: number;
  if (isTop) {
    if (corner) angleDeg = (15 - 2 * k) * 15 - 45;
    else angleDeg = (8 - k) * 30;
  } else {
    if (corner) angleDeg = k * 30 - 120;
    else angleDeg = (k - 3) * 30;
  }
  return { angleRad: (angleDeg * Math.PI) / 180, isTop };
}
