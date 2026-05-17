/**
 * Sq1Cube — three.js Group that visualizes a Square-1 puzzle as a cube.
 *
 * Each piece is a vertical prism whose top-down footprint extends to the cube
 * boundary. Corners are pentagons with a tip at the cube corner; edges are
 * trapezoids flush against a cube face. Solved state therefore looks like a
 * 2-cube-half × 2-cube-half × cube_full prism (i.e. a cube).
 *
 * State machine maps slot indices to angles via slotCenterAngle. Geometry maps
 * each piece's LOCAL +X to its wedge midline; the actual cube-corner / cube-face
 * feature sits at LOCAL -15° (corner) or LOCAL +15° (edge) due to the SQ1's
 * 30°-slot grid being offset by 15° from cube-face/diagonal directions.
 */
import * as THREE from 'three';
import {
  SQ1_CUBE_HALF,
  SQ1_LAYER_H,
  SQ1_EQUATOR_H,
  SQ1_LAYER_Y,
  SQ1_GAP,
  SQ1_STICKER_LIFT,
  SQ1_STICKER_BORDER,
  SQ1_BODY_MAT,
  stickerMaterial,
  buildCornerBody,
  buildEdgeBody,
  buildSquareSticker,
  buildRectSticker,
  buildEquatorSlabBox,
} from './geometry';
import {
  DEFAULT_SQ1_COLORS,
  SQ1_FACE_KEYS,
  pieceColors,
  pieceInfo,
} from './state';

const DEG = Math.PI / 180;
const SLOT_DEG = 30;
const SLOT_0_START_DEG = 90;

/** Slot center offset (in slot units) for a given piece id (0..15). */
function pieceSlotCenter(pieceId: number): number {
  const local = pieceId <= 7 ? pieceId : pieceId - 8;
  const isCorner = local % 2 === 0;
  const base = Math.floor(local / 2) * 3;
  return base + (isCorner ? 1 : 2.5);
}

/** Map (slot center, layer) → rotY (three.js Y-axis rotation in radians). */
export function slotCenterAngle(slotCenter: number, layer: 'top' | 'bottom'): number {
  const baseDeg = SLOT_0_START_DEG + slotCenter * SLOT_DEG;
  const deg = layer === 'top' ? baseDeg : -baseDeg;
  return deg * DEG;
}

// ─── shared piece geometries (built once) ────────────────────────────────
let _cornerBody: THREE.BufferGeometry | null = null;
let _edgeBody: THREE.BufferGeometry | null = null;
let _cornerTopSticker: THREE.BufferGeometry | null = null;
let _edgeTopSticker: THREE.BufferGeometry | null = null;
let _cornerSideSticker: THREE.BufferGeometry | null = null;
let _edgeSideSticker: THREE.BufferGeometry | null = null;

function cornerBody(): THREE.BufferGeometry {
  if (!_cornerBody) _cornerBody = buildCornerBody();
  return _cornerBody;
}
function edgeBody(): THREE.BufferGeometry {
  if (!_edgeBody) _edgeBody = buildEdgeBody();
  return _edgeBody;
}
/** Square sticker for a corner-piece top: side ≈ 2/3 cube-half (the corner cell of 3×3). */
function cornerTopSticker(): THREE.BufferGeometry {
  if (!_cornerTopSticker) {
    const side = (SQ1_CUBE_HALF * 2) / 3;
    _cornerTopSticker = buildSquareSticker(side, SQ1_STICKER_BORDER);
  }
  return _cornerTopSticker;
}
/** Square sticker for an edge-piece top: same size as corner cell (cubed grid). */
function edgeTopSticker(): THREE.BufferGeometry {
  if (!_edgeTopSticker) {
    const side = (SQ1_CUBE_HALF * 2) / 3;
    _edgeTopSticker = buildSquareSticker(side, SQ1_STICKER_BORDER);
  }
  return _edgeTopSticker;
}
/** Side sticker rectangle for corner / edge — sized to a 3×3-grid cell. */
function cornerSideSticker(): THREE.BufferGeometry {
  if (!_cornerSideSticker) {
    const side = (SQ1_CUBE_HALF * 2) / 3;
    _cornerSideSticker = buildRectSticker(side, SQ1_LAYER_H, SQ1_STICKER_BORDER);
  }
  return _cornerSideSticker;
}
function edgeSideSticker(): THREE.BufferGeometry {
  if (!_edgeSideSticker) {
    const side = (SQ1_CUBE_HALF * 2) / 3;
    _edgeSideSticker = buildRectSticker(side, SQ1_LAYER_H, SQ1_STICKER_BORDER);
  }
  return _edgeSideSticker;
}

// ─── Sq1Piece ──────────────────────────────────────────────────────────────
export class Sq1Piece extends THREE.Group {
  pieceId: number;
  isCorner: boolean;
  initialLayer: 'top' | 'bottom';
  currentLayer: 'top' | 'bottom';
  rotY: number = 0;
  slashCount: number = 0;
  body: THREE.Mesh;
  topSticker: THREE.Mesh;
  outerStickers: THREE.Mesh[];

  constructor(pieceId: number, layer: 'top' | 'bottom', stickerColors: { top: string; sides: string[] }) {
    super();
    this.pieceId = pieceId;
    this.isCorner = pieceInfo(pieceId).isCorner;
    this.initialLayer = layer;
    this.currentLayer = layer;

    const layerY = layer === 'top' ? +SQ1_LAYER_Y : -SQ1_LAYER_Y;
    const layerSign = layer === 'top' ? +1 : -1;

    // Solved-state rotY — used to counter-rotate stickers so they appear
    // axis-aligned in world space (not as diamonds).
    const ang0 = slotCenterAngle(pieceSlotCenter(pieceId), layer);

    // ─── body ───────────────────────────────────────────────────────────
    const bodyGeom = this.isCorner ? cornerBody() : edgeBody();
    this.body = new THREE.Mesh(bodyGeom, SQ1_BODY_MAT);
    this.body.position.y = layerY;
    this.add(this.body);

    // ─── top sticker (or "bottom" sticker for bottom-layer pieces) ──────
    // Position: at the top of the piece body (for top layer) or bottom (for bottom layer).
    // The cube corner is at LOCAL -15° (for corner) or LOCAL +15° (for edge).
    // Sticker sits at the 3×3-grid cell center. For corner, cell center is at distance
    // 2/3 cubeHalf along cube-corner direction = local -15°. For edge, cell center is
    // along cube-face direction = local +15°.
    const cellOff = (SQ1_CUBE_HALF * 2) / 3;
    // For ALL top stickers we counter-rotate by -ang0 around piece-local Y so
    // the sticker appears world-axis-aligned (sides along world X / Z) after
    // the piece's own rotY rotation. This makes the top face look like a clean
    // 3×3 grid of axis-aligned squares (per cubedb).
    if (this.isCorner) {
      const cornerOffsetAng = -15 * DEG;  // cube corner direction in piece local
      const dist = cellOff * Math.SQRT2;
      const stickerGeom = cornerTopSticker();
      this.topSticker = new THREE.Mesh(stickerGeom, stickerMaterial(stickerColors.top));
      this.topSticker.position.set(
        dist * Math.cos(cornerOffsetAng),
        layerY + layerSign * (SQ1_LAYER_H / 2 - SQ1_GAP / 2 + SQ1_STICKER_LIFT),
        dist * Math.sin(cornerOffsetAng),
      );
      this.topSticker.rotation.x = layerSign > 0 ? -Math.PI / 2 : +Math.PI / 2;
      this.topSticker.rotation.z = -ang0;  // counter-rotate so sticker is world-axis-aligned
    } else {
      const edgeOffsetAng = -15 * DEG;
      const dist = cellOff;  // cell center is exactly 2/3 s from origin
      const stickerGeom = edgeTopSticker();
      this.topSticker = new THREE.Mesh(stickerGeom, stickerMaterial(stickerColors.top));
      this.topSticker.position.set(
        dist * Math.cos(edgeOffsetAng),
        layerY + layerSign * (SQ1_LAYER_H / 2 - SQ1_GAP / 2 + SQ1_STICKER_LIFT),
        dist * Math.sin(edgeOffsetAng),
      );
      this.topSticker.rotation.x = layerSign > 0 ? -Math.PI / 2 : +Math.PI / 2;
      this.topSticker.rotation.z = -ang0;
    }
    this.add(this.topSticker);

    // ─── outer side stickers ────────────────────────────────────────────
    // Corner: 2 stickers (one per cube face meeting at the corner).
    // Cube face A normal (local angle -60° for corner): plane 0.5 x - 0.866 z = s.
    //   Sticker center on this face at the 3×3-cell middle.
    // Cube face B normal (local +30° for corner): plane 0.866 x + 0.5 z = s.
    this.outerStickers = [];
    if (this.isCorner) {
      // Cell centers on each face, in WORLD, are at:
      //   Face A (was world x=s for NE corner): (s, +y_mid, 2/3 s)
      //   Face B (was world z=s for NE corner): (2/3 s, +y_mid, s)
      // Generic: at face-center cell, which is at distance 2/3 s along the face's
      // perpendicular direction (along the cube's face plane).
      // In LOCAL frame:
      //   Face A normal at local -60°. Cell center on face A: at the face's "inward"
      //     middle, offset by 2/3 s along the face plane (perpendicular to local -60°).
      //     The "face A in-plane direction" is local angle -60° + 90° = 30°.
      //     Center position = (project onto face A) + (offset along face).
      //     Face A passes through cube corner at local (1.366 s, -0.366 s).
      //     From corner, walk 2/3 s along face A in the direction of cube center (away
      //     from the corner along the face). The direction from corner toward the
      //     inside of cube along face A: tangent of face A is at local angle -60°+90° = 30°.
      //     Walk in -30°-angle direction (away from corner toward face center).
      //   Compute: center = corner + (-2/3 s) * (cos 30°, sin 30°)
      //          = (1.366 - 2/3 * 0.866, -0.366 - 2/3 * 0.5) s
      //          = (1.366 - 0.577, -0.366 - 0.333) s
      //          = (0.789, -0.699) s
      // Hmm but we want the sticker on the OUTSIDE of the face, slightly extruded.
      // Place center at the cell middle (on the face plane), then offset by SQ1_STICKER_LIFT
      // along the outward normal.
      const halfDeg = 30;  // half-angle from cube corner direction to face normal
      const cornerLocalAng = -15 * DEG;
      // Face A normal at cornerLocalAng - halfDeg, Face B at cornerLocalAng + halfDeg.
      // Walking from cube corner toward the next-inner cell on each face:
      //   Face A (lower normal angle): tangent = nAng - π/2 (CW perpendicular).
      //   Face B (higher normal angle): tangent = nAng + π/2 (CCW perpendicular).
      const faceNormalAngs = [
        cornerLocalAng - halfDeg * DEG,
        cornerLocalAng + halfDeg * DEG,
      ];
      const cornerX = SQ1_CUBE_HALF * Math.SQRT2 * Math.cos(cornerLocalAng);
      const cornerZ = SQ1_CUBE_HALF * Math.SQRT2 * Math.sin(cornerLocalAng);
      for (let i = 0; i < 2; i++) {
        const nAng = faceNormalAngs[i];
        const tangAng = nAng + (i === 0 ? -Math.PI / 2 : +Math.PI / 2);
        // Offset from cube corner to corner-cell center on this face = cubeHalf / 3
        // (cell side is 2/3 cubeHalf; corner cell center is half a cell from the cube
        // corner along the face tangent).
        const offset = SQ1_CUBE_HALF / 3;
        const centerX = cornerX + offset * Math.cos(tangAng);
        const centerZ = cornerZ + offset * Math.sin(tangAng);
        // Push outward by SQ1_STICKER_LIFT along normal
        const liftX = SQ1_STICKER_LIFT * Math.cos(nAng);
        const liftZ = SQ1_STICKER_LIFT * Math.sin(nAng);
        const sticker = new THREE.Mesh(cornerSideSticker(), stickerMaterial(stickerColors.sides[i]));
        sticker.position.set(centerX + liftX, layerY, centerZ + liftZ);
        // Orient: default normal +Z. Want normal at angle nAng around Y.
        // Default extrude is +Z. To make extrude direction = (cos nAng, 0, sin nAng) at Y axis,
        // we apply Ry such that local +Z → desired direction.
        // Ry(θ): +Z → (sin θ, 0, cos θ). Want = (cos nAng, 0, sin nAng).
        // → sin θ = cos nAng, cos θ = sin nAng → θ = π/2 - nAng.
        sticker.rotation.y = Math.PI / 2 - nAng;
        this.outerStickers.push(sticker);
        this.add(sticker);
      }
    } else {
      // Edge: 1 sticker on its single cube face. Face normal at local -15°.
      const faceNormalAng = -15 * DEG;
      // Face plane: x cos(15°) + z sin(15°) = s. Cell center on face at the middle (where
      // the face meets the edge piece's "axis" extension), located at distance s along
      // the normal direction.
      const centerX = SQ1_CUBE_HALF * Math.cos(faceNormalAng);
      const centerZ = SQ1_CUBE_HALF * Math.sin(faceNormalAng);
      const liftX = SQ1_STICKER_LIFT * Math.cos(faceNormalAng);
      const liftZ = SQ1_STICKER_LIFT * Math.sin(faceNormalAng);
      const sticker = new THREE.Mesh(edgeSideSticker(), stickerMaterial(stickerColors.sides[0]));
      sticker.position.set(centerX + liftX, layerY, centerZ + liftZ);
      sticker.rotation.y = Math.PI / 2 - faceNormalAng;
      this.outerStickers.push(sticker);
      this.add(sticker);
    }

    // Initial rotation: place piece at its solved slot.
    const ang = slotCenterAngle(pieceSlotCenter(pieceId), layer);
    this.rotY = ang;
    this.applyTransform();

    this.matrixAutoUpdate = false;
  }

  applyTransform(): void {
    const qY = new THREE.Quaternion().setFromAxisAngle(_AXIS_Y, this.rotY);
    const q = new THREE.Quaternion().copy(qY);
    for (let i = 0; i < this.slashCount; i++) {
      q.premultiply(_QUAT_X_PI);
    }
    this.quaternion.copy(q);
    this.position.set(0, 0, 0);
    this.updateMatrix();
  }
}

const _AXIS_Y = new THREE.Vector3(0, 1, 0);
const _AXIS_X = new THREE.Vector3(1, 0, 0);
const _QUAT_X_PI = new THREE.Quaternion().setFromAxisAngle(_AXIS_X, Math.PI);
void _AXIS_X;  // keep imported

// ─── Sq1Cube ──────────────────────────────────────────────────────────────
import Sq1Twister from './Sq1Twister';

export default class Sq1Cube extends THREE.Group {
  pieces: Sq1Piece[];
  equator: THREE.Mesh[];
  twister: Sq1Twister;
  callbacks: (() => void)[] = [];
  dirty = true;
  readonly puzzleType = 'sq1' as const;
  order: number = 0;
  history = new Sq1History();

  constructor() {
    super();
    this.matrixAutoUpdate = false;

    this.pieces = [];
    const scheme = SQ1_FACE_KEYS.map((k) => DEFAULT_SQ1_COLORS[k]);
    for (let id = 0; id <= 7; id++) {
      const colors = pieceColors(id, scheme);
      const p = new Sq1Piece(id, 'top', colors);
      this.pieces.push(p);
      this.add(p);
    }
    for (let id = 8; id <= 15; id++) {
      const colors = pieceColors(id, scheme);
      const p = new Sq1Piece(id, 'bottom', colors);
      this.pieces.push(p);
      this.add(p);
    }

    this.equator = buildEquator(scheme);
    for (const e of this.equator) this.add(e);

    this.twister = new Sq1Twister(this);
    this.updateMatrix();
  }

  pieceById(id: number): Sq1Piece {
    return this.pieces[id];
  }

  reset(): void {
    for (const p of this.pieces) {
      p.rotY = slotCenterAngle(pieceSlotCenter(p.pieceId), p.initialLayer);
      p.slashCount = 0;
      p.currentLayer = p.initialLayer;
      p.applyTransform();
    }
    for (const e of this.equator) {
      const initial = (e.userData as { initialRotY: number; initialPos: THREE.Vector3 });
      e.rotation.set(0, initial.initialRotY, 0);
      e.position.copy(initial.initialPos);
      e.updateMatrix();
    }
    this.dirty = true;
  }

  get complete(): boolean {
    for (const p of this.pieces) {
      const expected = slotCenterAngle(pieceSlotCenter(p.pieceId), p.initialLayer);
      const delta = ((p.rotY - expected) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      if (Math.min(delta, 2 * Math.PI - delta) > 0.05) return false;
      if (p.slashCount % 2 !== 0) return false;
      if (p.currentLayer !== p.initialLayer) return false;
    }
    return true;
  }

  dispose(): void {
    this.pieces.length = 0;
    this.equator.length = 0;
    this.callbacks.length = 0;
  }
}

/** Two equator slabs (left/right halves) sized to fit inside the cube. */
function buildEquator(scheme: string[]): THREE.Mesh[] {
  const slabW = SQ1_CUBE_HALF - SQ1_GAP / 2; // each slab spans half cube width along X
  const slabD = SQ1_CUBE_HALF * 2 - SQ1_GAP; // full cube depth along Z
  const slabH = SQ1_EQUATOR_H - SQ1_GAP;
  const cellOff = (SQ1_CUBE_HALF * 2) / 3;
  const slabs: THREE.Mesh[] = [];

  for (const side of ['left', 'right'] as const) {
    const sign = side === 'right' ? +1 : -1;
    const slab = new THREE.Mesh(buildEquatorSlabBox(slabW, slabH, slabD), SQ1_BODY_MAT);
    slab.position.set(sign * slabW / 2, 0, 0);
    slab.matrixAutoUpdate = false;
    slab.userData = { initialRotY: 0, initialPos: slab.position.clone(), side };
    slab.updateMatrix();
    // F sticker on +Z face (1 sticker for each slab covering middle of front face)
    const fGeom = buildRectSticker(cellOff, SQ1_EQUATOR_H * 0.85, SQ1_STICKER_BORDER);
    const fSticker = new THREE.Mesh(fGeom, stickerMaterial(scheme[3])); // F = red
    fSticker.position.set(sign * cellOff / 2 - sign * slabW / 2, 0, slabD / 2 + SQ1_STICKER_LIFT);
    slab.add(fSticker);
    // B sticker on -Z face
    const bSticker = new THREE.Mesh(fGeom, stickerMaterial(scheme[1])); // B = orange
    bSticker.position.set(sign * cellOff / 2 - sign * slabW / 2, 0, -slabD / 2 - SQ1_STICKER_LIFT);
    bSticker.rotation.y = Math.PI;
    slab.add(bSticker);
    // Outer side sticker (R on right slab, L on left slab)
    const sideGeom = buildRectSticker(cellOff, SQ1_EQUATOR_H * 0.85, SQ1_STICKER_BORDER);
    const sideSticker = new THREE.Mesh(sideGeom, stickerMaterial(scheme[side === 'right' ? 2 : 0]));
    sideSticker.position.set(sign * slabW / 2 + sign * SQ1_STICKER_LIFT, 0, 0);
    sideSticker.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    slab.add(sideSticker);
    slabs.push(slab);
  }
  return slabs;
}

export class Sq1History {
  moves: string[] = [];
  redoStack: string[] = [];
  init = '';
  get length(): number {
    return this.moves.length;
  }
  clear(): void {
    this.moves.length = 0;
    this.redoStack.length = 0;
  }
}

export { pieceSlotCenter };
