/**
 * Square-1 3D renderer — three.js port of cubedb.net's RenderSquare1.
 *
 * Coordinate convention (world):
 *   - Y vertical (up).
 *   - +X = right, +Z = front (toward viewer).
 *   - Cube has half-side W = TILE + WEDGE_W/2 = 137.5 along X and Z.
 *
 * Piece geometry (cube-corner approach, verbatim from cubedb):
 *   - Each CORNER piece is a TILE × TILE square (100×100) in XZ, extruded
 *     LAYER_HEIGHT along Y. 4 corners per layer, positioned at the 4 cube
 *     corners (±W, ±W) and rotated by Y multiples of 90°.
 *   - Each WEDGE piece is a TILE × WEDGE_W rectangle (100×75), extruded
 *     LAYER_HEIGHT along Y. 4 wedges per layer, positioned at the centers
 *     of the 4 cube faces (±W, 0) / (0, ±W).
 *   - Pivot at the cube's central vertical axis; piece geometry is built in
 *     piece-local space with origin at the cube center, then translated
 *     outward by W and rotated around +Y by the slot angle.
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

// ─── geometry constants (verbatim from cubedb) ─────────────────────────────
const TILE = 100;            // corner side length (and outer-radial extent)
const WEDGE_W = 75;          // wedge tangential width
const HALF_W = TILE / 2 + WEDGE_W / 2 + TILE / 2 - TILE / 2; // see below
// The cube's half-side W: from center axis, the OUTER edge of a corner is at
// distance W. A corner is TILE × TILE in XZ, with its inner edge at W - TILE.
// A wedge is centered on a face, so its outer face is at distance W and
// tangential edges at ±WEDGE_W/2 from the face center.
const W = TILE + WEDGE_W / 2;  // 100 + 37.5 = 137.5

const LAYER_HEIGHT = 100;     // thickness of one layer (top or bot)
const LAYER_GAP = 4;          // equator gap between layers
const HALF_GAP = LAYER_GAP / 2;
const BEVEL = {
  steps: 1, depth: LAYER_HEIGHT,
  bevelEnabled: true, bevelThickness: 3, bevelSize: 3,
  bevelOffset: -3, bevelSegments: 2,
};

void HALF_W;

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

// ─── piece geometry (cube-corner approach) ─────────────────────────────────
// All pieces built in PIECE-LOCAL space:
//   - The piece sits at its solved-slot-0 position by default.
//   - For a CORNER: outer corner at (TILE, 0, TILE), inner corner at (0,0,0),
//                   extruded along +Y from y=0 to y=LAYER_HEIGHT.
//   - For a WEDGE: outer edge midpoint at (TILE, 0, 0), wedge tangential extent
//                  is along ±Z from -WEDGE_W/2 to +WEDGE_W/2.
//
// Top/side stickers are placed on the OUTER faces of these cuboids. Corners
// have 2 side stickers (one on each of the two cube faces it spans), wedges
// have 1 side sticker (centered on its cube face).

function cornerShape(): THREE.Shape {
  // A square in XY plane (we extrude along Z later, then rotate the group to
  // make Z become Y vertical). Corner is at (0,0); outer at (TILE, TILE).
  // We round the outer-corner only.
  const r = 18;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(TILE, 0);
  s.lineTo(TILE, TILE - r);
  s.absarc(TILE - r, TILE - r, r, 0, Math.PI / 2, false);
  s.lineTo(0, TILE);
  s.lineTo(0, 0);
  return s;
}

function wedgeShape(): THREE.Shape {
  // Rectangle: outer in +X direction (length TILE), tangential extent ±WEDGE_W/2 in Y.
  const s = new THREE.Shape();
  s.moveTo(0, -WEDGE_W / 2);
  s.lineTo(TILE, -WEDGE_W / 2);
  s.lineTo(TILE, WEDGE_W / 2);
  s.lineTo(0, WEDGE_W / 2);
  s.lineTo(0, -WEDGE_W / 2);
  return s;
}

interface BuildResult {
  pivot: THREE.Object3D;
  group: THREE.Group;
}

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

  // Top sticker: flat colored ShapeGeometry sitting on the body's top face.
  // Sticker is inset 3px from the outline so a thin black border shows.
  const stickerOutline = corner ? cornerShapeInset(3.5) : wedgeShapeInset(3.5);
  const stickerGeom = new THREE.ShapeGeometry(stickerOutline);
  const topMat = new THREE.MeshPhongMaterial({
    color: SQ1_COLORS[faces.top], specular: 0x222222, shininess: 50,
    side: THREE.DoubleSide,
  });
  const topSticker = new THREE.Mesh(stickerGeom, topMat);
  topSticker.position.z = LAYER_HEIGHT + 0.05;
  group.add(topSticker);

  // Side stickers — on the OUTER cube-face walls of the piece.
  if (corner) {
    const matA = new THREE.MeshPhongMaterial({
      color: SQ1_COLORS[faces.sideA], specular: 0x222222, shininess: 50,
      side: THREE.DoubleSide,
    });
    const matB = new THREE.MeshPhongMaterial({
      color: SQ1_COLORS[faces.sideB!], specular: 0x222222, shininess: 50,
      side: THREE.DoubleSide,
    });
    const wallA = mkRectMesh(TILE - 6, LAYER_HEIGHT - 6, matA);
    wallA.position.set(TILE / 2, TILE + 0.2, LAYER_HEIGHT / 2);
    wallA.rotation.set(-Math.PI / 2, 0, 0);
    group.add(wallA);
    const wallB = mkRectMesh(TILE - 6, LAYER_HEIGHT - 6, matB);
    wallB.position.set(TILE + 0.2, TILE / 2, LAYER_HEIGHT / 2);
    wallB.rotation.set(0, Math.PI / 2, Math.PI / 2);
    group.add(wallB);

    // Hidden-face hint tiles: duplicate of each side sticker pushed ~OFFSET units
    // outward in the OPPOSITE direction (so you can see "what's on the back").
    // Cubedb shows hidden stickers as semi-transparent floating quads.
    const HINT_OFFSET = 220;
    const hintMatA = matA.clone();
    hintMatA.transparent = true; hintMatA.opacity = 0.78;
    const hintA = mkRectMesh((TILE - 6) * 0.55, (LAYER_HEIGHT - 6) * 0.55, hintMatA);
    hintA.position.set(TILE / 2, TILE + 0.2 + HINT_OFFSET, LAYER_HEIGHT / 2);
    hintA.rotation.set(-Math.PI / 2, 0, 0);
    group.add(hintA);
    const hintMatB = matB.clone();
    hintMatB.transparent = true; hintMatB.opacity = 0.78;
    const hintB = mkRectMesh((TILE - 6) * 0.55, (LAYER_HEIGHT - 6) * 0.55, hintMatB);
    hintB.position.set(TILE + 0.2 + HINT_OFFSET, TILE / 2, LAYER_HEIGHT / 2);
    hintB.rotation.set(0, Math.PI / 2, Math.PI / 2);
    group.add(hintB);
  } else {
    // Wedge has 1 outer wall at x=TILE, spans Y=-WEDGE_W/2..+WEDGE_W/2, Z=0..LAYER_HEIGHT.
    const matA = new THREE.MeshPhongMaterial({
      color: SQ1_COLORS[faces.sideA], specular: 0x222222, shininess: 50,
      side: THREE.DoubleSide,
    });
    const wallA = mkRectMesh(WEDGE_W - 6, LAYER_HEIGHT - 6, matA);
    wallA.position.set(TILE + 0.2, 0, LAYER_HEIGHT / 2);
    wallA.rotation.set(0, Math.PI / 2, Math.PI / 2);
    group.add(wallA);

    const HINT_OFFSET = 220;
    const hintMat = matA.clone();
    hintMat.transparent = true; hintMat.opacity = 0.78;
    const hintA = mkRectMesh((WEDGE_W - 6) * 0.55, (LAYER_HEIGHT - 6) * 0.55, hintMat);
    hintA.position.set(TILE + 0.2 + HINT_OFFSET, 0, LAYER_HEIGHT / 2);
    hintA.rotation.set(0, Math.PI / 2, Math.PI / 2);
    group.add(hintA);
  }

  // Group transform: extrusion along +Z becomes world +Y for the top layer.
  // For BOT layer, we use scale.y=-1 on the pivot (after rotation) to mirror
  // across the equator.
  const pivot = new THREE.Object3D();
  group.rotation.x = -Math.PI / 2;
  pivot.add(group);

  if (!isTopLayer) {
    pivot.scale.y = -1;
  }

  return { group, pivot };
}

function cornerShapeInset(gap: number): THREE.Shape {
  const r = 18 - gap;
  const s = new THREE.Shape();
  s.moveTo(gap, gap);
  s.lineTo(TILE - gap, gap);
  s.lineTo(TILE - gap, TILE - gap - r);
  s.absarc(TILE - gap - r, TILE - gap - r, r, 0, Math.PI / 2, false);
  s.lineTo(gap, TILE - gap);
  s.lineTo(gap, gap);
  return s;
}

function wedgeShapeInset(gap: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(gap, -WEDGE_W / 2 + gap);
  s.lineTo(TILE - gap, -WEDGE_W / 2 + gap);
  s.lineTo(TILE - gap, WEDGE_W / 2 - gap);
  s.lineTo(gap, WEDGE_W / 2 - gap);
  s.lineTo(gap, -WEDGE_W / 2 + gap);
  return s;
}

function mkRectMesh(w: number, h: number, mat: THREE.MeshPhongMaterial): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
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
 *    - WEDGE: outer face center at piece-local (TILE, 0, 0) → world angle 0°.
 *      Pivot rotation = target angle.
 *    - CORNER: outer corner at piece-local (TILE, TILE, 0) → world angle +45°
 *      after group rotation. Pivot rotation = target angle - 45°.
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
  state: Sq1State = solvedState();
  durationPerMoveMs = 220;

  private rafId: number | null = null;
  private animQueue: Sq1Move[] = [];
  private active:
    | { move: Sq1Move; t: number; duration: number; topPivot: THREE.Object3D; botPivot: THREE.Object3D; topAngle: number; botAngle: number }
    | { move: Sq1Move; t: number; duration: number; slicePivot: THREE.Object3D; angle: number }
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
    this.camera.position.set(420, 360, 500);
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
      p.pivot.position.set(0, isTop ? HALF_GAP : -HALF_GAP, 0);
      p.pivot.rotation.set(0, angleRad, 0);
      p.pivot.quaternion.setFromEuler(p.pivot.rotation);
      p.pivot.scale.x = 1;
      p.pivot.scale.z = 1;
      p.pivot.scale.y = isTop ? 1 : -1;
      p.layerSign = isTop ? 1 : -1;
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
      this.active.slicePivot.rotation.x = this.active.angle * e;
    }
    if (tFrac >= 1) this.finishMove();
  }

  private beginMove(move: Sq1Move): void {
    if (move.kind === 'turn') {
      const topPivot = new THREE.Object3D();
      const botPivot = new THREE.Object3D();
      this.cubeRoot.add(topPivot);
      this.cubeRoot.add(botPivot);
      for (const p of this.pieces) {
        const target = p.layerSign === 1 ? topPivot : botPivot;
        this.attach(p.pivot, target);
      }
      const topAngle = -(move.top ?? 0) * (Math.PI / 6);
      const botAngle = -(move.bot ?? 0) * (Math.PI / 6);
      this.active = { move, t: 0, duration: this.durationPerMoveMs, topPivot, botPivot, topAngle, botAngle };
    } else {
      const slicePivot = new THREE.Object3D();
      this.cubeRoot.add(slicePivot);
      for (const p of this.pieces) {
        p.pivot.updateWorldMatrix(true, false);
        const wpos = new THREE.Vector3().setFromMatrixPosition(p.pivot.matrixWorld);
        if (wpos.x > 0.5) this.attach(p.pivot, slicePivot);
      }
      this.active = { move, t: 0, duration: this.durationPerMoveMs, slicePivot, angle: Math.PI };
    }
  }

  private finishMove(): void {
    if (!this.active) return;
    const move = this.active.move;
    if ('slicePivot' in this.active) {
      const pv = this.active.slicePivot;
      pv.rotation.x = Math.PI;
      pv.updateMatrixWorld(true);
      for (const p of this.pieces) {
        if (p.pivot.parent === pv) this.attach(p.pivot, this.cubeRoot);
      }
      this.cubeRoot.remove(pv);
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
    this.applyStateInstant(this.state);
    this.finishedMoves += 1;
    this.notify();
  }

  private attach(child: THREE.Object3D, parent: THREE.Object3D): void {
    if (child.parent === parent) return;
    parent.attach(child);
  }
}
