/**
 * FtoCube — three.js Group rendering a Face-Turning Octahedron (8 faces, 120° turns,
 * 42 visible pieces + 9 black internal/core cells).
 *
 * Every cell is a pivot at the origin; a turn of face f rotates the pivots whose CURRENT
 * centre is on f's cap side (n_f · centre > CUT) by ±120° about the face normal — position
 * fixed at the origin, only the quaternion changes. No discrete permutation/orientation
 * state: the pivot quaternion is the source of truth (geometry baked in home coords, turns
 * are pure SO(3)). `complete` is COLOUR-aware (every sticker shows its face's colour), which
 * is exact even for the indistinguishable centres — stricter than "pivots at identity" would
 * allow a swapped pair of same-colour centres to read solved, which is the correct answer.
 *
 * FTO is the only face-turning octahedron engine, so the begin/finish machinery is inlined
 * here (cf. MegaminxCube for the dodecahedron analog). Conforms to
 * TweenCube<FtoAnimationMove>; ordinary `/sim` face moves remain unchanged while the
 * algorithm player can also animate EIF slices, wide turns and whole-puzzle rotations.
 */
import * as THREE from 'three';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import type { TweenCube } from '../TweenTwister';
import FtoTwister from './FtoTwister';
import {
  ftoAnimationMoveToString,
  type FtoAnimationMove,
} from './ftoAnimation';
import { FACE_NORMAL } from './ftoState';
import { buildFtoPieces, faceAxisVec, R_IN, FTO_COLORS } from './ftoGeometry';

export type { PieceAnim };

const TURN = (2 * Math.PI) / 3; // 120°
const CUT = R_IN / 3;           // cap-membership threshold (matches ftoGeometry)

interface FtoPiece {
  pivot: THREE.Object3D;
  center: THREE.Vector3;
  /** Home face indices this piece shows a sticker on (empty = black internal cell). */
  stickerFaces: number[];
}

export default class FtoCube extends THREE.Group implements TweenCube<FtoAnimationMove> {
  callbacks: (() => void)[] = [];
  dirty = true;
  order = 0;
  history = new MoveHistory();
  readonly puzzleType = 'fto' as const;
  twister: FtoTwister;

  /** All cells (42 visible + 9 black). Pivots in scene; never reordered. */
  pieces: FtoPiece[] = [];
  private readonly axes: THREE.Vector3[] = FACE_NORMAL.map((_, f) => faceAxisVec(f));

  constructor() {
    super();
    for (const b of buildFtoPieces()) {
      this.add(b.pivot);
      this.pieces.push({ pivot: b.pivot, center: b.center.clone(), stickerFaces: b.stickerFaces });
    }
    this.twister = new FtoTwister(this);
  }

  /** Current world centre of a piece (home centre carried by its pivot quaternion). */
  private liveCenter(p: FtoPiece): THREE.Vector3 {
    return p.center.clone().applyQuaternion(p.pivot.quaternion);
  }

  /** Faces whose current cap contains `pivot`'s piece (the turns that would carry it) — the
   *  drag's candidate faces. Empty (the immovable core) → all 8. */
  capFacesOf(pivot: THREE.Object3D): number[] {
    const home = pivot.userData.ftoCenter as THREE.Vector3 | undefined;
    if (!home) return [0, 1, 2, 3, 4, 5, 6, 7];
    const c = home.clone().applyQuaternion(pivot.quaternion);
    const out: number[] = [];
    for (let f = 0; f < 8; f++) if (this.axes[f].dot(c) > CUT) out.push(f);
    return out.length ? out : [0, 1, 2, 3, 4, 5, 6, 7];
  }

  /** Pivots selected by a face, middle-slice, wide or whole-puzzle turn. */
  private pivotsForMove(move: FtoAnimationMove): THREE.Object3D[] {
    if ('kind' in move && (move.kind === 'vertex-rotation' || move.layer === 'whole')) {
      return this.pieces.map(piece => piece.pivot);
    }
    const n = this.axes[move.face];
    const out: THREE.Object3D[] = [];
    for (const p of this.pieces) {
      const distance = n.dot(this.liveCenter(p));
      const selected = !('kind' in move)
        ? distance > CUT
        : move.layer === 'slice'
          ? distance > -CUT && distance < CUT
          : distance > -CUT;
      if (selected) out.push(p.pivot);
    }
    return out;
  }

  beginMove(move: FtoAnimationMove): PieceAnim[] {
    let axis: THREE.Vector3;
    let angle: number;
    if ('kind' in move && move.kind === 'vertex-rotation') {
      axis = new THREE.Vector3(...move.axis);
      angle = move.quarterTurns * Math.PI / 2;
    } else {
      axis = this.axes[move.face];
      angle = move.dir * TURN; // dir −1 = −120° = clockwise from outside (bare token)
    }
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return this.pivotsForMove(move).map((pivot) => makeAnim(pivot, delta, axis, angle));
  }

  finishMove(anims: PieceAnim[], move: FtoAnimationMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.history.record(ftoAnimationMoveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: FtoAnimationMove): void {
    const anims = this.beginMove(move);
    this.finishMove(anims, move);
  }

  applyMoveSilent(move: FtoAnimationMove): void {
    const anims = this.beginMove(move);
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.dirty = true;
  }

  applyMovesInstant(moves: FtoAnimationMove[]): void {
    this.reset();
    for (const m of moves) this.applyMoveInstant(m);
  }

  reset(): void {
    for (const p of this.pieces) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    this.dirty = true;
  }

  /** Nearest face index to a (unit) world direction. */
  private nearestFace(dir: THREE.Vector3): number {
    let best = -1, bestDot = -Infinity;
    for (let g = 0; g < 8; g++) { const d = this.axes[g].dot(dir); if (d > bestDot) { bestDot = d; best = g; } }
    return best;
  }

  /** Colour-aware: every sticker must lie on a face whose solved colour equals its own.
   *  Handles the indistinguishable centres (a sticker pointing back at any same-colour face
   *  is solved). */
  get complete(): boolean {
    const v = new THREE.Vector3();
    for (const p of this.pieces) {
      if (p.stickerFaces.length === 0) continue;
      for (const f of p.stickerFaces) {
        v.copy(this.axes[f]).applyQuaternion(p.pivot.quaternion);
        if (FTO_COLORS[this.nearestFace(v)] !== FTO_COLORS[f]) return false;
      }
    }
    return true;
  }

  /** Debug: hide face 0's whole turning cap (exactly the group a turn of that face lifts)
   *  so the core + neighbours' inner walls show, like lifting one cap off a real FTO. OFF
   *  restores ALL pieces (correct even if the pose changed while carved). */
  setCarve(on: boolean): void {
    if (on) {
      for (const pivot of this.pivotsForMove({ face: 0, dir: 1 })) pivot.visible = false;
    } else {
      for (const p of this.pieces) p.pivot.visible = true;
    }
    this.dirty = true;
  }

  dispose(): void {
    this.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) for (const m of mat) m.dispose();
        else mat?.dispose();
      }
    });
    this.callbacks.length = 0;
    this.pieces.length = 0;
  }
}
