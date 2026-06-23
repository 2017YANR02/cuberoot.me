/**
 * Sq1Cube — three.js Group rendering a Square-1 puzzle.
 *
 * 16 piece pivots (8 top / 8 bot) + 2 middle slabs (asymmetric trapezoids) +
 * 6 floating hint tiles, all children of `this`.
 *
 * Piece pivot is the unit of identity: its quaternion + position is the truth
 * for "where is this piece right now in world space". scale.y = -1 on bot
 * pivots is set once at build and never touched again — quaternion composition
 * stays in SO(3), no decompose ambiguity. (See /demo/sq1 refactor commit
 * 6b13fca6c for the root cause analysis.)
 *
 * Move semantics:
 *   - turn(t,b): rotate top pivots by -t·30° / bot pivots by +b·30° around +Y.
 *   - slice    : rotate all east-of-chord pivots + BIG mid 180° around chord-perp axis.
 *
 * Sq1Cube exposes `beginMove` / `finishMove` for the Sq1Twister to drive
 * animations via the global tweener. `applyStateInstant` / `applyMovesInstant`
 * are the fast paths used for reset/caret-jump.
 */
import * as THREE from 'three';
import {
  buildPieceMesh,
  buildMiddlePair,
  placementForSlot,
  isCornerPiece,
  HALF_MID,
  W,
  WEDGE_HALF_CHORD,
  SLICE_AXIS,
} from './sq1Geometry';
import {
  type Sq1State,
  type Sq1Move,
  solvedSq1,
  applySq1Move,
  SOLVED_PIECES,
  moveToString,
} from './sq1State';
import Sq1Twister from './Sq1Twister';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import type { TweenCube } from '../TweenTwister';

export type { PieceAnim };

export interface PieceEntry {
  pieceId: number;
  pivot: THREE.Object3D;
  group: THREE.Group;
  layerSign: 1 | -1;
}

export interface MiddleEntry {
  pivot: THREE.Object3D;
  side: 1 | -1;
}

export default class Sq1Cube extends THREE.Group implements TweenCube<Sq1Move> {
  pieces: PieceEntry[] = [];
  middle: MiddleEntry[] = [];
  state: Sq1State = solvedSq1();
  callbacks: (() => void)[] = [];
  dirty = true;
  readonly puzzleType = 'sq1' as const;
  order: number = 0;
  history = new MoveHistory();
  twister: Sq1Twister;

  constructor() {
    super();

    for (let piece = 0; piece <= 15; piece++) {
      const isTop = piece <= 7;
      const { group, pivot } = buildPieceMesh(piece, isTop);
      this.add(pivot);
      this.pieces.push({ pieceId: piece, pivot, group, layerSign: isTop ? 1 : -1 });
    }

    const { big, small } = buildMiddlePair();
    this.add(big);
    this.add(small);
    this.middle.push({ pivot: big, side: 1 });
    this.middle.push({ pivot: small, side: -1 });

    this.applyStateInstant(this.state);
    this.twister = new Sq1Twister(this);
  }

  pieceById(id: number): PieceEntry | undefined {
    return this.pieces.find((p) => p.pieceId === id);
  }

  /** Snap every piece to its canonical slot pose given the discrete state. */
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
    for (const m of this.middle) {
      m.pivot.position.set(0, 0, 0);
      if (m.side === 1 && !state.sliceSolved) {
        m.pivot.quaternion.setFromAxisAngle(SLICE_AXIS, Math.PI);
      } else {
        m.pivot.quaternion.identity();
      }
    }
    this.dirty = true;
  }

  reset(): void {
    this.applyStateInstant(solvedSq1());
  }

  /** Compute the per-piece animation plan for a move. Caller (Sq1Twister)
   *  tweens between startQuat/Pos → endQuat/Pos and then calls finishMove.
   *
   *  `sliceDir` (slice only): +1 = default arc (east half flips top→back),
   *  -1 = reversed arc (east half flips top→front, "向上拖" 手感). 180° 在
   *  state 上等价,只是 axis-angle tween 走反弧。 */
  beginMove(move: Sq1Move, sliceDir: 1 | -1 = 1): PieceAnim[] {
    const anims: PieceAnim[] = [];
    if (move.kind === 'turn') {
      const Y = new THREE.Vector3(0, 1, 0);
      const topAngle = -(move.top ?? 0) * (Math.PI / 6);
      const botAngle = (move.bot ?? 0) * (Math.PI / 6);
      const topDelta = new THREE.Quaternion().setFromAxisAngle(Y, topAngle);
      const botDelta = new THREE.Quaternion().setFromAxisAngle(Y, botAngle);
      for (const p of this.pieces) {
        if (p.pivot.position.y > 0) {
          anims.push(this._makeAnim(p.pivot, topDelta, Y, topAngle));
        } else {
          anims.push(this._makeAnim(p.pivot, botDelta, Y, botAngle));
        }
      }
    } else {
      const sliceAngle = sliceDir * Math.PI;
      const sliceDelta = new THREE.Quaternion().setFromAxisAngle(SLICE_AXIS, sliceAngle);
      const probe = new THREE.Vector3();
      for (const p of this.pieces) {
        // pivot.matrix is the piece's transform IN CUBE-LOCAL frame
        // (Sq1Cube is rotated by world.scene; matrixWorld would include that
        // rotation and break the east/west chord test).
        p.pivot.updateMatrix();
        const isCorner = isCornerPiece(p.pieceId);
        probe.set(W, 0, isCorner ? -W : 0);
        probe.applyMatrix4(p.pivot.matrix);
        if (probe.x * W + probe.z * WEDGE_HALF_CHORD > 0.5) {
          anims.push(this._makeAnim(p.pivot, sliceDelta, SLICE_AXIS, sliceAngle));
        }
      }
      for (const m of this.middle) {
        if (m.side === 1) anims.push(this._makeAnim(m.pivot, sliceDelta, SLICE_AXIS, sliceAngle));
      }
    }
    return anims;
  }

  /** Snap pivots to end pose, update discrete state, record history. */
  finishMove(anims: PieceAnim[], move: Sq1Move): void {
    for (const a of anims) {
      a.pivot.quaternion.copy(a.endQuat);
      if (a.endPos) a.pivot.position.copy(a.endPos);
    }
    this.state = applySq1Move(this.state, move);
    this.history.record(moveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  /** Snap a move into place without recording history (undo/redo replay). */
  applyMoveSilent(move: Sq1Move): void {
    const anims = this.beginMove(move);
    for (const a of anims) {
      a.pivot.quaternion.copy(a.endQuat);
      if (a.endPos) a.pivot.position.copy(a.endPos);
    }
    this.state = applySq1Move(this.state, move);
    this.dirty = true;
  }

  /** Instant version: snap end pose without animating. */
  applyMoveInstant(move: Sq1Move): void {
    const anims = this.beginMove(move);
    this.finishMove(anims, move);
  }

  /** Reset to solved and replay moves at once (no animation). */
  applyMovesInstant(moves: Sq1Move[]): void {
    this.applyStateInstant(solvedSq1());
    for (const move of moves) this.applyMoveInstant(move);
  }

  get complete(): boolean {
    if (!this.state.sliceSolved) return false;
    for (let i = 0; i < 24; i++) {
      if (this.state.pieces[i] !== SOLVED_PIECES[i]) return false;
    }
    return true;
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
    this.pieces.length = 0;
    this.middle.length = 0;
    this.callbacks.length = 0;
  }

  /** SQ1 pieces translate (layer turns swing the pivot off-axis), so every anim
   *  carries the position arc (withPos=true). */
  private _makeAnim(
    pivot: THREE.Object3D, delta: THREE.Quaternion,
    axis: THREE.Vector3, angle: number,
  ): PieceAnim {
    return makeAnim(pivot, delta, axis, angle, true);
  }
}
