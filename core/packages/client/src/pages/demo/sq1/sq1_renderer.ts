/**
 * Square-1 3D renderer — three.js port of cubedb.net's RenderSquare1.
 *
 * Coordinate convention (world):
 *   - Y vertical (up).
 *   - +X = right, +Z = front (toward viewer).
 *   - Cube has half-side W = 137.5 along X and Z.
 *
 * Piece geometry (pie-slice polygon extruded along Z):
 *   - Each CORNER piece is a 4-vertex polygon spanning 60° (axis →
 *     +X-side outer → cube corner → +Y-side outer → axis).
 *   - Each WEDGE piece is a 3-vertex triangle spanning 30° (axis →
 *     +X-side outer → +X-side outer mirror → axis).
 *   - All outer vertices live on the cube outline at distance W; the
 *     wedge-vs-corner tangential boundary is at ±W·tan(15°) ≈ ±36.84.
 *   - Pivot at the cube's central vertical axis; pivot Y rotation places the
 *     piece at its slot angle.
 *
 * Slot layout (top layer slots 0..11, bot slots 12..23):
 *   - Slot k corresponds to a 30° wedge starting at angle θ_k = k·30° around +Y
 *     (CCW from above looking down, but rotation around +Y in three.js is
 *      +X→-Z direction).
 *   - Corner pieces occupy 2 consecutive slots (60° span). Wedge pieces
 *     occupy 1 slot (30°).
 *
 * Animation:
 *   - (t, b) → top pivot rotates by -t·30°, bot pivot by -b·30° around +Y.
 *   - /      → "right half" (pieces with world x > 0) rotates 180° around +X.
 *   - Cubic.InOut easing. Pieces reparented to a temporary group during
 *     animation; snapped back to canonical transforms via applyState() after.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── geometry constants ───────────────────────────────────────────────────
// Cube top-down outline: 275×275 square, centered on the vertical axis.
//   W = half-side (137.5). Each layer has 12 slots × 30°. Corner spans 2 slots
//   (60°), wedge 1 slot (30°). Pieces are **pie-slice polygons** in the XY
//   plane, extruded along Z by LAYER_HEIGHT.
//
// The wedge-vs-corner angular boundary is at ±15° from each slot axis. At the
// cube face (distance W from axis), this gives a tangential boundary at
// ±W·tan(15°) ≈ ±36.84 — i.e. the wedge's flat outer face is ≈73.6 wide and
// the corner's adjacent flat face is ≈100.66 wide. These match cubedb's
// nominal "TILE=100 / WEDGE_W=75" but with the geometrically-correct values.
const W = 137.5;                                     // cube half-side
const WEDGE_HALF_CHORD = W * Math.tan(Math.PI / 12); // ≈36.84
const TILE_W = W - WEDGE_HALF_CHORD;                 // corner-face width ≈100.66
const WEDGE_FACE_W = 2 * WEDGE_HALF_CHORD;           // wedge-face width ≈73.68

// Layer heights match cubedb exactly: top=bot=W=100, mid=M=75, total=2W+M=275=2R
// → cube is cubic (X/Z extent = 275, Y extent = 275).
const LAYER_HEIGHT = 100;     // top/bot layer thickness (= cubedb's W)
const MID_HEIGHT = 75;        // equator slice thickness (= cubedb's M)
const HALF_MID = MID_HEIGHT / 2;
// Bevel from cubedb exactly: big bevelSize+inward bevelOffset = the body's
// top/bot cap is deeply inset from the shape outline (20 units), with a
// sloped bevel transitioning out to the outline. Combined with a TRANSLUCENT
// top sticker (opacity 0.75), this is what creates the visible piece division
// lines (black star pattern) on the U face in cubedb's render.
const BEVEL = {
  steps: 2, depth: LAYER_HEIGHT,
  bevelEnabled: true, bevelThickness: 5, bevelSize: 20,
  bevelOffset: -20, bevelSegments: 3,
};
// Sticker Z-offset above body cap: clear bevel extending bevelThickness past depth.
const STICKER_Z = LAYER_HEIGHT + BEVEL.bevelThickness + 0.5; // 105.5
// Side-sticker outward radial offset from cube face (W).
const SIDE_OFFSET = 0.5;
// Sticker raise depth — /stack-style "raised tile" extrusion thickness.
const STICKER_DEPTH = 2;
// Sticker material params: opaque, shiny phong (matches /stack feel).
const STICKER_SHININESS = 60;
const STICKER_SPECULAR = 0x444444;
// Top sticker inset toward centroid (in shape-local units) — leaves visible
// body-color gap between adjacent piece stickers on U/D faces (replaces the
// old transparent-sticker-over-bevel trick).
const TOP_STICKER_INSET = 18;

export const SQ1_COLORS = {
  L: 0x1f4dff,
  B: 0xff8000,
  R: 0x00b53d,
  F: 0xd0021b,
  U: 0x141414,
  D: 0xf0f0f0,
  BODY: 0x0a0a0a,
};

const FACE_ORDER = ['L', 'B', 'R', 'F'] as const;
type FaceKey = keyof typeof SQ1_COLORS;

const BG = 0x555555;

// ─── state model ──────────────────────────────────────────────────────────
export const SOLVED_PIECES: number[] = [
  0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7,
  8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15,
];

export interface Sq1State {
  pieces: number[];
  sliceSolved: boolean;
}

export function solvedState(): Sq1State {
  return { pieces: SOLVED_PIECES.slice(), sliceSolved: true };
}

const SQ1_TOKEN_RE = /(\/)|\(?\s*(-?\d+)\s*(?:,\s*|\s+|(?=-?\d))(-?\d+)\s*\)?/g;

export interface Sq1Move {
  kind: 'turn' | 'slice';
  top?: number;
  bot?: number;
}

export function parseSq1Scramble(scramble: string): Sq1Move[] {
  const out: Sq1Move[] = [];
  const re = new RegExp(SQ1_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(scramble)) !== null) {
    if (m[1] === '/') {
      out.push({ kind: 'slice' });
    } else if (m[2] !== undefined) {
      out.push({ kind: 'turn', top: parseInt(m[2], 10), bot: parseInt(m[3], 10) });
    }
  }
  return out;
}

function applyTurn(state: Sq1State, top: number, bot: number): Sq1State {
  const t = (((-top) % 12) + 12) % 12;
  const b = (((-bot) % 12) + 12) % 12;
  const next = state.pieces.slice();
  const oldTop = state.pieces.slice(0, 12);
  for (let i = 0; i < 12; i++) next[i] = oldTop[(t + i) % 12];
  const oldBot = state.pieces.slice(12, 24);
  for (let i = 0; i < 12; i++) next[i + 12] = oldBot[(b + i) % 12];
  return { pieces: next, sliceSolved: state.sliceSolved };
}

function applySlice(state: Sq1State): Sq1State {
  const next = state.pieces.slice();
  for (let i = 0; i < 6; i++) {
    const c = next[i + 12];
    next[i + 12] = next[i + 6];
    next[i + 6] = c;
  }
  return { pieces: next, sliceSolved: !state.sliceSolved };
}

export function applySq1Move(state: Sq1State, move: Sq1Move): Sq1State {
  if (move.kind === 'slice') return applySlice(state);
  return applyTurn(state, move.top ?? 0, move.bot ?? 0);
}

// ─── piece classification ─────────────────────────────────────────────────
export function isCornerPiece(piece: number): boolean {
  return ((piece + (piece <= 7 ? 0 : 1)) % 2) === 0;
}

function pieceFaces(piece: number): { top: FaceKey; sideA: FaceKey; sideB?: FaceKey } {
  // sideA = goes on the piece-local +Y wall (which becomes the "CCW" face
  // direction in world after group rotation -PI/2 around X).
  // sideB = goes on the piece-local +X wall (which becomes the "CW" face
  // direction in world).
  // The piece-local axis-to-face mapping is consistent between top and bot
  // layers (because pivot.scale.y = -1 on bot pieces reflects Y but the side
  // walls keep their X/Z-direction normals).
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

// ─── piece geometry (pie-slice polygon) ───────────────────────────────────
// All pieces built in PIECE-LOCAL (group) space, then group rotated -π/2
// around X so the extruded Z direction becomes world +Y (vertical).
//   - CORNER default: outer corner at (W, W) → after group rotation, pivot
//     (W, 0, -W). Default world angle = +45° (RB direction).
//   - WEDGE default: outer face centered at (W, 0) → pivot (W, 0, 0). Default
//     world angle = 0° (R direction).
// placementForSlot() returns the pivot Y rotation to swing the piece from
// its default angle to its target slot angle.

function cornerShape(): THREE.Shape {
  // Pie-slice corner: 4 vertices in XY plane.
  //   - (0, 0): axis vertex (at the cube central axis)
  //   - (W, WEDGE_HALF_CHORD): outer vertex on +X face, at boundary with adj wedge
  //   - (W, W): cube outline corner
  //   - (WEDGE_HALF_CHORD, W): outer vertex on +Y face, at boundary with adj wedge
  // CCW order (positive signed area) so ShapeGeometry normals face +Z.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(W, WEDGE_HALF_CHORD);
  s.lineTo(W, W);
  s.lineTo(WEDGE_HALF_CHORD, W);
  s.lineTo(0, 0);
  return s;
}

function wedgeShape(): THREE.Shape {
  // Pie-slice wedge: triangle in XY plane.
  //   - (0, 0): axis vertex
  //   - (W, -WEDGE_HALF_CHORD): outer-right
  //   - (W, +WEDGE_HALF_CHORD): outer-left
  // The chord between the two outer vertices is the wedge's flat outer face.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(W, -WEDGE_HALF_CHORD);
  s.lineTo(W, WEDGE_HALF_CHORD);
  s.lineTo(0, 0);
  return s;
}

interface BuildResult {
  pivot: THREE.Object3D;
  group: THREE.Group;
}

// Side-sticker insets so adjacent pieces show body color between their stickers.
const SIDE_INSET_H = 3;  // tangential inset on each side
const SIDE_INSET_V = 3;  // vertical inset on top/bottom

// Center of the corner's outer cube face (tangential coord). The corner's
// outer face on +X side spans Y from WEDGE_HALF_CHORD to W (length TILE_W);
// midpoint Y = (W + WEDGE_HALF_CHORD) / 2. Same for the +Y face's X center.
const CORNER_FACE_CENTER = (W + WEDGE_HALF_CHORD) / 2;

function buildPieceMesh(piece: number, isTopLayer: boolean): BuildResult {
  const faces = pieceFaces(piece);
  const corner = isCornerPiece(piece);

  const outline = corner ? cornerShape() : wedgeShape();
  const bodyGeom = new THREE.ExtrudeGeometry(outline, BEVEL);
  const bodyMat = new THREE.MeshPhongMaterial({
    color: SQ1_COLORS.BODY, specular: 0x222222, shininess: 25,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  group.add(body);

  // Top sticker: RAISED ExtrudeGeometry (/stack-style). Inset shape toward
  // centroid so adjacent pieces' stickers don't touch — visible body-color
  // gap between them produces the U/D face piece division lines. Sticker
  // extruded by STICKER_DEPTH for the "raised tile" 3D look.
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
  group.add(topSticker);

  // Side stickers — RAISED rounded-rect ExtrudeGeometry (/stack-style).
  // Sticker base sits at the cube face surface; the extrusion thickness
  // protrudes outward, making the sticker look like a physical raised tile.
  if (corner) {
    const matA = mkStickerMat(SQ1_COLORS[faces.sideA]);
    const matB = mkStickerMat(SQ1_COLORS[faces.sideB!]);

    // wallA on +Y face. Extrude direction +Z (in shape coords) → world +Y after rotation.
    const wallA = mkRaisedRectSticker(TILE_W - 2 * SIDE_INSET_H, LAYER_HEIGHT - 2 * SIDE_INSET_V, matA);
    wallA.position.set(CORNER_FACE_CENTER, W + SIDE_OFFSET, LAYER_HEIGHT / 2);
    wallA.rotation.set(-Math.PI / 2, 0, 0);
    group.add(wallA);

    // wallB on +X face.
    const wallB = mkRaisedRectSticker(TILE_W - 2 * SIDE_INSET_H, LAYER_HEIGHT - 2 * SIDE_INSET_V, matB);
    wallB.position.set(W + SIDE_OFFSET, CORNER_FACE_CENTER, LAYER_HEIGHT / 2);
    wallB.rotation.set(0, Math.PI / 2, Math.PI / 2);
    group.add(wallB);
  } else {
    // Wedge has 1 outer face on +X side.
    const matA = mkStickerMat(SQ1_COLORS[faces.sideA]);
    const wallA = mkRaisedRectSticker(WEDGE_FACE_W - 2 * SIDE_INSET_H, LAYER_HEIGHT - 2 * SIDE_INSET_V, matA);
    wallA.position.set(W + SIDE_OFFSET, 0, LAYER_HEIGHT / 2);
    wallA.rotation.set(0, Math.PI / 2, Math.PI / 2);
    group.add(wallA);
  }

  // Group transform: extrusion along +Z becomes world +Y for the top layer.
  // For BOT layer, scale.y=-1 on the pivot mirrors across the equator.
  // (With the increased sticker Z offset, the negative-scale ShapeGeometry
  //  lighting issue no longer matters because the sticker is now physically
  //  outside the bevel rather than occluded by it.)
  const pivot = new THREE.Object3D();
  group.rotation.x = -Math.PI / 2;
  pivot.add(group);

  if (!isTopLayer) {
    pivot.scale.y = -1;
  }

  return { group, pivot };
}

function mkStickerMat(color: number): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color, specular: STICKER_SPECULAR, shininess: STICKER_SHININESS,
    side: THREE.DoubleSide,
  });
}

/**
 * Rounded-rectangle Shape (technique copied from /stack's makeStickerShape).
 * Origin at center; w × h with corner radius r. Used for raised side stickers.
 */
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

/**
 * Raised rectangular sticker (rounded-rect extruded along +Z by STICKER_DEPTH).
 * Positioned at the body face with the FRONT (extruded +Z) facing outward.
 * Use `applyRotation` to orient the sticker on its destination cube face.
 */
function mkRaisedRectSticker(w: number, h: number, mat: THREE.MeshPhongMaterial): THREE.Mesh {
  const shape = roundedRectShape(w, h, Math.min(w, h) * 0.12);
  const geom = new THREE.ExtrudeGeometry(shape, {
    steps: 1, depth: STICKER_DEPTH,
    bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6,
    bevelOffset: 0, bevelSegments: 1,
  });
  return new THREE.Mesh(geom, mat);
}

/**
 * Inset a convex polygon shape uniformly by shrinking toward centroid.
 * Used to make the top sticker slightly smaller than its piece outline so
 * adjacent stickers show visible body-color gaps between them.
 */
function insetShape(verts: [number, number][], inset: number): THREE.Shape {
  let cx = 0, cy = 0;
  for (const [x, y] of verts) { cx += x; cy += y; }
  cx /= verts.length; cy /= verts.length;
  // Estimate scale factor: shrink so the FARTHEST vertex moves inward by `inset`.
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

// ─── piece slot placement ─────────────────────────────────────────────────
/** For each slot k (the FIRST slot occupied by a piece — corners span 2 slots,
 *  wedges 1), return the pivot Y-rotation needed to place that piece at its
 *  cube position.
 *
 *  Convention: world angle θ corresponds to position (cos θ, 0, -sin θ) — i.e.,
 *  positive Y rotation in three.js (+X → -Z). Cube faces:
 *    R = +X at angle 0°
 *    B = -Z at angle +90°
 *    L = -X at angle +180°
 *    F = +Z at angle -90° (or +270°)
 *
 *  Slot 8 = R wedge centered at 0°. Slot order goes CW (decreasing angle):
 *    slot k center angle = (8 - k) · 30°.
 *  A corner at slot k spans slots k and k+1; its center angle is the midpoint =
 *    (15 - 2k)/2 · 30° = (15 - 2k) · 15°.
 *
 *  Piece geometry's natural orientation:
 *    - WEDGE: outer face center at piece-local (W, 0, 0) → world angle 0°.
 *      Pivot rotation = target angle.
 *    - CORNER: outer corner at piece-local (W, W, 0) → world angle +45° after
 *      group rotation. Pivot rotation = target angle - 45°.
 */
function placementForSlot(slot: number, corner: boolean): { angleRad: number; isTop: boolean } {
  const isTop = slot < 12;
  const k = isTop ? slot : slot - 12;
  let angleDeg: number;
  if (isTop) {
    // Top slot order is CW (decreasing world angle as k increases).
    // Slot 8 = R wedge at 0°. Slot center = (8 - k) · 30°.
    if (corner) {
      // Corner center = midpoint of slot k and slot k+1 centers.
      // Subtract 45° because the corner geometry's own outer corner sits at
      // piece-local +45° (the cube's outer corner), not at the cube face axis.
      angleDeg = (15 - 2 * k) * 15 - 45;
    } else {
      angleDeg = (8 - k) * 30;
    }
  } else {
    // Bot slot order is CCW (increasing world angle as k increases) — sq1's
    // bot layer is "mirrored" in slot direction so the two layers stack
    // correctly in the solved state. Slot 12 = F wedge at -90°; slot 15 = R
    // wedge at 0°; etc.
    if (corner) {
      angleDeg = k * 30 - 120;
    } else {
      angleDeg = (k - 3) * 30;
    }
  }
  return { angleRad: (angleDeg * Math.PI) / 180, isTop };
}

// ─── renderer class ───────────────────────────────────────────────────────

export interface Sq1RendererOptions {
  width: number;
  height: number;
  dpr?: number;
}

interface PieceEntry {
  pieceId: number;
  pivot: THREE.Object3D;
  group: THREE.Group;
  layerSign: 1 | -1;
}

export class Sq1Renderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  cubeRoot: THREE.Object3D;
  pieces: PieceEntry[] = [];
  middle: { pivot: THREE.Object3D; side: 1 | -1 }[] = [];
  state: Sq1State = solvedState();
  durationPerMoveMs = 220;

  private rafId: number | null = null;
  private animQueue: Sq1Move[] = [];
  private active:
    | { move: Sq1Move; t: number; duration: number; topPivot: THREE.Object3D; botPivot: THREE.Object3D; topAngle: number; botAngle: number }
    | { move: Sq1Move; t: number; duration: number; slicePivot: THREE.Object3D; midSlicePivot: THREE.Object3D; midAxis: THREE.Vector3; angle: number }
    | null = null;
  private onIdle: (() => void) | null = null;
  private moveListeners: Array<(idx: number, total: number) => void> = [];
  private totalMoves = 0;
  private finishedMoves = 0;

  constructor(canvas: HTMLCanvasElement, opts: Sq1RendererOptions) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);

    const aspect = opts.width / Math.max(1, opts.height);
    this.camera = new THREE.PerspectiveCamera(30, aspect, 1, 5000);
    // Match cubedb's default: steep top-down angle from +X+Y+Z, ~45° above horizontal.
    // Distance ~1000 to leave breathing room for floating hint tiles.
    this.camera.position.set(400, 680, 600);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, preserveDrawingBuffer: true, alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(opts.dpr ?? window.devicePixelRatio, 2));
    this.renderer.setSize(opts.width, opts.height, false);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 250;
    this.controls.maxDistance = 1500;
    this.controls.update();

    this.cubeRoot = new THREE.Object3D();
    this.scene.add(this.cubeRoot);

    this.setupLighting();
    this.buildPieces();
    this.buildMiddle();
    this.buildHints();
    this.applyStateInstant(this.state);
    this.start();
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.55 * Math.PI);
    this.scene.add(ambient);
    const positions: [number, number, number][] = [
      [500, 500, 500], [-500, 500, 500], [500, 500, -500], [-500, 500, -500],
      [500, -500, 500], [-500, -500, 500], [500, -500, -500], [-500, -500, -500],
    ];
    for (const p of positions) {
      const dl = new THREE.DirectionalLight(0xffffff, 0.3 * Math.PI);
      dl.position.set(p[0], p[1], p[2]);
      this.scene.add(dl);
    }
  }

  private buildPieces(): void {
    for (let piece = 0; piece <= 15; piece++) {
      const isTop = piece <= 7;
      const { group, pivot } = buildPieceMesh(piece, isTop);
      this.cubeRoot.add(pivot);
      this.pieces.push({ pieceId: piece, pivot, group, layerSign: isTop ? 1 : -1 });
    }
  }

  /**
   * Equator slice — real Square-1 has 2 ASYMMETRIC trapezoidal middle pieces
   * split by a DIAGONAL chord through the center at 30° from the L/R axis
   * (the famous "long edge / short edge" geometry). Each piece is 4-vertex
   * trapezoid (chord + 3 cube-face edges). One piece carries the full F edge
   * + a short R + a long L. The other carries full B + long R + short L.
   *
   * Cut line equation (top-down XZ plane): z = x·tan(30°), passing through
   * Cut is a TILTED chord through the center of the middle layer.
   * Endpoints:
   *   • TOP edge (world z=-W, B-face direction): x = +WEDGE_HALF_CHORD
   *   • BOTTOM edge (world z=+W, F-face direction): x = -WEDGE_HALF_CHORD
   *
   * This places the seam on F face at world x = -W·tan(15°) (= IMAGE LEFT
   * when viewing F from +Z, aligned with top-layer LF-corner/F-wedge boundary)
   * AND on B face at world x = +W·tan(15°) (= IMAGE LEFT when viewing B from
   * -Z, since viewer is facing +Z so world +X maps to image LEFT — aligned
   * with top-layer RB-corner/B-wedge boundary on that face's image-left side).
   *
   * Chord passes through the cube's central axis → both pieces have EQUAL
   * area (each = 2W²). They're mirror-reflective trapezoids.
   *
   * After a `/` slice, both pieces participate in slice rotation (180° around
   * X axis as approximation of the true slice axis). F and B colors visible
   * on the cube swap.
   */
  private buildMiddle(): void {
    const CUT_TOP_X = +WEDGE_HALF_CHORD;   // top-edge endpoint x (≈ +36.84, B face direction)
    const CUT_BOT_X = -WEDGE_HALF_CHORD;   // bottom-edge endpoint x (≈ -36.84, F face direction)
    // In SHAPE coords (Y=−worldZ after rotateX(-π/2)), top of world becomes
    // shape Y=+W and bottom of world becomes shape Y=-W. So:
    const cutTopShape: [number, number] = [CUT_TOP_X, +W];  // shape: cut endpoint at top-of-world
    const cutBotShape: [number, number] = [CUT_BOT_X, -W];  // shape: cut endpoint at bottom-of-world

    const bodyMat = new THREE.MeshPhongMaterial({
      color: SQ1_COLORS.BODY, specular: 0x222222, shininess: 25,
      side: THREE.DoubleSide,
    });
    // kind === 'big': right-of-cut piece, has full R (+X) edge.
    // kind === 'small': left-of-cut piece, has full L (-X) edge.
    const mkHalf = (kind: 'big' | 'small'): THREE.Object3D => {
      const shape = new THREE.Shape();
      if (kind === 'big') {
        // CCW (in shape coords): start at cut-bot, walk along bottom edge to
        // bot-right corner, up right edge to top-right corner, along top edge
        // to cut-top, then along cut back to cut-bot.
        shape.moveTo(cutBotShape[0], cutBotShape[1]);
        shape.lineTo(W, -W);
        shape.lineTo(W, W);
        shape.lineTo(cutTopShape[0], cutTopShape[1]);
        shape.lineTo(cutBotShape[0], cutBotShape[1]);
      } else {
        // CCW for small: top-left corner, down left edge to bot-left, along
        // bottom edge to cut-bot, along cut up to cut-top, along top edge
        // back to top-left.
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
      pivot.add(new THREE.Mesh(geom, bodyMat));

      // Each piece has 3 outer-face stickers (the 4th edge is the internal cut chord).
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
        pivot.add(mesh);
      };

      if (kind === 'big') {
        // Big piece outer edges (world coords) — CUT_TOP_X=+WHC, CUT_BOT_X=-WHC:
        //   • R (+X): full z range [-W, +W], length 2W (LONG)
        //   • F (+Z): x ∈ [-WHC, +W], length W + WHC ≈ 174 (medium-long)
        //   • B (-Z): x ∈ [+WHC, +W], length W − WHC ≈ 101 (medium)
        addSticker(SQ1_COLORS.R, 'R', -W, W, 0, 0);
        addSticker(SQ1_COLORS.F, 'F', 0, 0, CUT_BOT_X, W);
        addSticker(SQ1_COLORS.B, 'B', 0, 0, CUT_TOP_X, W);
      } else {
        // Small piece outer edges:
        //   • L (-X): full z range [-W, +W], length 2W (LONG)
        //   • F (+Z): x ∈ [-W, -WHC], length W − WHC ≈ 101 (medium)
        //   • B (-Z): x ∈ [-W, +WHC], length W + WHC ≈ 174 (medium-long)
        addSticker(SQ1_COLORS.L, 'L', -W, W, 0, 0);
        addSticker(SQ1_COLORS.F, 'F', 0, 0, -W, CUT_BOT_X);
        addSticker(SQ1_COLORS.B, 'B', 0, 0, -W, CUT_TOP_X);
      }

      this.cubeRoot.add(pivot);
      return pivot;
    };
    this.middle.push({ pivot: mkHalf('big'), side: 1 });
    this.middle.push({ pivot: mkHalf('small'), side: -1 });
  }

  /**
   * Per-face hint tiles (one per cube face = 6 total) — translucent floating
   * quads at face_normal × HINT_OFFSET, sized like a full cube face. Cubedb
   * shows these as visual references for the away-facing sides.
   */
  private buildHints(): void {
    const HINT_OFFSET = 240;
    const HINT_SIZE = 0.7 * 2 * W; // ~190px per face
    const faces: { color: number; dir: [number, number, number] }[] = [
      { color: SQ1_COLORS.U, dir: [0, 1, 0] },
      { color: SQ1_COLORS.D, dir: [0, -1, 0] },
      { color: SQ1_COLORS.R, dir: [1, 0, 0] },
      { color: SQ1_COLORS.L, dir: [-1, 0, 0] },
      { color: SQ1_COLORS.F, dir: [0, 0, 1] },
      { color: SQ1_COLORS.B, dir: [0, 0, -1] },
    ];
    for (const f of faces) {
      const mat = new THREE.MeshPhongMaterial({
        color: f.color, specular: STICKER_SPECULAR, shininess: STICKER_SHININESS,
        side: THREE.DoubleSide, transparent: true, opacity: 0.65,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(HINT_SIZE, HINT_SIZE), mat);
      const n = new THREE.Vector3(...f.dir);
      mesh.position.copy(n).multiplyScalar(W + HINT_OFFSET);
      mesh.lookAt(0, 0, 0);
      this.cubeRoot.add(mesh);
    }
  }

  applyStateInstant(state: Sq1State): void {
    this.state = state;
    const pieceSlot = new Map<number, number>();
    for (let s = 0; s < 24; s++) {
      if (!pieceSlot.has(state.pieces[s])) pieceSlot.set(state.pieces[s], s);
    }
    for (const p of this.pieces) {
      const slot = pieceSlot.get(p.pieceId);
      if (slot === undefined) continue;
      const { angleRad, isTop } = placementForSlot(slot, isCornerPiece(p.pieceId));
      p.pivot.position.set(0, isTop ? HALF_MID : -HALF_MID, 0);
      p.pivot.rotation.set(0, angleRad, 0);
      p.pivot.quaternion.setFromEuler(p.pivot.rotation);
      p.pivot.scale.x = 1;
      p.pivot.scale.z = 1;
      p.pivot.scale.y = isTop ? 1 : -1;
      p.layerSign = isTop ? 1 : -1;
    }
    // Reset middle pieces — sliceSolved=true means BIG/SMALL are at their
    // canonical (built) positions. sliceSolved=false means BIG is flipped
    // around chord-perp axis (state after an odd number of / slices).
    const midAxis = new THREE.Vector3(W, 0, WEDGE_HALF_CHORD).normalize();
    for (const m of this.middle) {
      m.pivot.position.set(0, 0, 0);
      if (m.side === 1 && !state.sliceSolved) {
        m.pivot.quaternion.setFromAxisAngle(midAxis, Math.PI);
      } else {
        m.pivot.quaternion.identity();
      }
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  onMoveProgress(cb: (idx: number, total: number) => void): () => void {
    this.moveListeners.push(cb);
    return () => { this.moveListeners = this.moveListeners.filter(x => x !== cb); };
  }

  resetTo(state: Sq1State): void {
    this.animQueue = [];
    this.active = null;
    this.totalMoves = 0;
    this.finishedMoves = 0;
    this.applyStateInstant(state);
  }

  playScramble(moves: Sq1Move[]): Promise<void> {
    return new Promise(resolve => {
      this.animQueue.push(...moves);
      this.totalMoves = moves.length;
      this.finishedMoves = 0;
      this.notify();
      this.onIdle = () => resolve();
    });
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.renderer.dispose();
  }

  private notify(): void {
    for (const cb of this.moveListeners) cb(this.finishedMoves, this.totalMoves);
  }

  private start(): void {
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      this.tick(dt);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private tick(dt: number): void {
    if (!this.active) {
      const next = this.animQueue.shift();
      if (!next) {
        if (this.onIdle) { const cb = this.onIdle; this.onIdle = null; cb(); }
        return;
      }
      this.beginMove(next);
      return;
    }
    this.active.t += dt;
    const tFrac = Math.min(1, this.active.t / this.active.duration);
    const e = tFrac < 0.5 ? 4 * tFrac * tFrac * tFrac : 1 - Math.pow(-2 * tFrac + 2, 3) / 2;
    if ('topPivot' in this.active) {
      this.active.topPivot.rotation.y = this.active.topAngle * e;
      this.active.botPivot.rotation.y = this.active.botAngle * e;
    } else {
      this.active.slicePivot.quaternion.setFromAxisAngle(this.active.midAxis, this.active.angle * e);
      this.active.midSlicePivot.quaternion.setFromAxisAngle(this.active.midAxis, this.active.angle * e);
    }
    if (tFrac >= 1) this.finishMove();
  }

  private beginMove(move: Sq1Move): void {
    const probe = new THREE.Vector3();
    if (move.kind === 'turn') {
      const topPivot = new THREE.Object3D();
      const botPivot = new THREE.Object3D();
      this.cubeRoot.add(topPivot);
      this.cubeRoot.add(botPivot);
      // Select layer by CURRENT world Y, not original layerSign — / slice
      // physically moves east pieces between top↔bot, so subsequent (t,b)
      // turns must follow what's actually in each layer right now.
      for (const p of this.pieces) {
        p.pivot.updateWorldMatrix(true, false);
        p.pivot.getWorldPosition(probe);
        const target = probe.y > 0 ? topPivot : botPivot;
        this.attach(p.pivot, target);
      }
      const topAngle = -(move.top ?? 0) * (Math.PI / 6);
      const botAngle = -(move.bot ?? 0) * (Math.PI / 6);
      this.active = { move, t: 0, duration: this.durationPerMoveMs, topPivot, botPivot, topAngle, botAngle };
    } else {
      // / slice: east-of-chord pieces (top + bot + BIG middle) rotate 180°
      // around chord-perp axis (W, 0, WHC)/d. East stays east; top↔bot flips;
      // each piece's own R-ish direction stays mostly on R, F↔B swap. The
      // SMALL west middle piece does not move (per cubedb animation).
      const sliceAxis = new THREE.Vector3(W, 0, WEDGE_HALF_CHORD).normalize();
      const slicePivot = new THREE.Object3D();
      const midSlicePivot = new THREE.Object3D();
      this.cubeRoot.add(slicePivot);
      this.cubeRoot.add(midSlicePivot);
      // Probe at the piece's outer point (corner extreme / wedge outer face
      // center) so X/Z are non-zero. The pivot itself sits on the central
      // axis (0, ±HALF_MID, 0) and would always test 0.
      for (const p of this.pieces) {
        p.pivot.updateWorldMatrix(true, false);
        const isCorner = isCornerPiece(p.pieceId);
        probe.set(W, 0, isCorner ? -W : 0);
        probe.applyMatrix4(p.pivot.matrixWorld);
        if (probe.x * W + probe.z * WEDGE_HALF_CHORD > 0.5) this.attach(p.pivot, slicePivot);
      }
      for (const m of this.middle) if (m.side === 1) this.attach(m.pivot, midSlicePivot);
      this.active = {
        move, t: 0, duration: this.durationPerMoveMs,
        slicePivot, midSlicePivot, midAxis: sliceAxis, angle: Math.PI,
      };
    }
  }

  private finishMove(): void {
    if (!this.active) return;
    const move = this.active.move;
    if ('slicePivot' in this.active) {
      const pv = this.active.slicePivot;
      pv.quaternion.setFromAxisAngle(this.active.midAxis, this.active.angle);
      pv.updateMatrixWorld(true);
      for (const p of this.pieces) {
        if (p.pivot.parent === pv) this.attach(p.pivot, this.cubeRoot);
      }
      const midPv = this.active.midSlicePivot;
      midPv.quaternion.setFromAxisAngle(this.active.midAxis, this.active.angle);
      midPv.updateMatrixWorld(true);
      for (const m of this.middle) {
        if (m.pivot.parent === midPv) this.attach(m.pivot, this.cubeRoot);
      }
      this.cubeRoot.remove(pv);
      this.cubeRoot.remove(midPv);
    } else {
      const tp = this.active.topPivot;
      const bp = this.active.botPivot;
      tp.rotation.y = this.active.topAngle;
      bp.rotation.y = this.active.botAngle;
      tp.updateMatrixWorld(true);
      bp.updateMatrixWorld(true);
      for (const p of this.pieces) {
        if (p.pivot.parent === tp || p.pivot.parent === bp) {
          this.attach(p.pivot, this.cubeRoot);
        }
      }
      this.cubeRoot.remove(tp);
      this.cubeRoot.remove(bp);
    }
    this.active = null;
    this.state = applySq1Move(this.state, move);
    // Snap to canonical placements after each move. Without this, slice
    // rotations and (t,b) turns produce slightly non-canonical orientations
    // that accumulate over a long scramble, leaving the cube misaligned at
    // the end. The snap is visually small because chord-perp 180° already
    // lands pieces near their canonical slot positions.
    this.applyStateInstant(this.state);
    this.finishedMoves += 1;
    this.notify();
  }

  private attach(child: THREE.Object3D, parent: THREE.Object3D): void {
    if (child.parent === parent) return;
    parent.attach(child);
  }
}
