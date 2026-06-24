/**
 * HeliCube — three.js Group rendering a Helicopter Cube (edge-turning, 180° involutions).
 *
 * 8 corner pieces + 24 wing pieces, each a pivot at the origin whose quaternion is the
 * source of truth for its orientation. A move twists about edge `e` by 180° about that
 * edge's axis, rotating the pivots currently in the edge's affected slots (2 corners + 4
 * wings). A discrete state (cp/co/wp, from heliState's verified generators) tracks
 * identity for `complete` + history; the physical stickers ride the pivots so colors are
 * never recomputed.
 *
 * There is only one edge-turning puzzle, so the (otherwise CornerTurnCube-shaped)
 * begin/finish/apply machinery is inlined here rather than factored into a base class.
 * Conforms to TweenCube<HeliMove> so the shared TweenTwister drives it.
 */
import * as THREE from 'three';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import type { TweenCube } from '../TweenTwister';
import {
  type HeliMove, type HeliPieceState,
  solvedHeli, applyHeliMove, isSolvedHeli, heliMoveToString,
  CORNER_SLOTS, WING_SLOTS,
} from './heliState';
import { buildCornerPiece, buildWingPiece, buildCore, edgeAxisVec } from './heliGeometry';
import HeliTwister from './HeliTwister';

export type { PieceAnim };

const TWIST_ANGLE = Math.PI; // 180°

interface PieceEntry { pivot: THREE.Object3D; group: THREE.Group; }

export default class HeliCube extends THREE.Group implements TweenCube<HeliMove> {
  readonly puzzleType = 'heli' as const;
  order = 0;
  dirty = true;
  callbacks: (() => void)[] = [];
  history = new MoveHistory();
  twister: HeliTwister;

  /** Pivots indexed by stable pieceId (pieces never change array index). */
  private cornerPieces: PieceEntry[] = [];
  private wingPieces: PieceEntry[] = [];
  /** Discrete state: cp/co[slot] = corner+orientation, wp[slot] = wing in that slot. */
  private state: HeliPieceState = solvedHeli();
  /** Per-edge unit twist axis (world, home frame). */
  private readonly axes: THREE.Vector3[];

  constructor() {
    super();
    this.axes = Array.from({ length: 12 }, (_, e) => edgeAxisVec(e));
    this.add(buildCore());
    for (let ci = 0; ci < 8; ci++) {
      const { pivot, group } = buildCornerPiece(ci);
      this.add(pivot);
      this.cornerPieces.push({ pivot, group });
    }
    for (let wi = 0; wi < 24; wi++) {
      const { pivot, group } = buildWingPiece(wi);
      this.add(pivot);
      this.wingPieces.push({ pivot, group });
    }
    this.twister = new HeliTwister(this);
  }

  /** The pivots a move rotates: the pieces currently in edge e's 2 corner + 4 wing
   *  slots, read off the LIVE discrete state. */
  private pivotsForMove(move: HeliMove): THREE.Object3D[] {
    const e = move.edge;
    const out: THREE.Object3D[] = [];
    for (const s of CORNER_SLOTS[e]) out.push(this.cornerPieces[this.state.cp[s]].pivot);
    for (const s of WING_SLOTS[e]) out.push(this.wingPieces[this.state.wp[s]].pivot);
    return out;
  }

  /** Animation plan: the move's pivots rotate 180° about the edge axis. The sweep sign
   *  only chooses which way the mid-turn animation swings (±π are the SAME 180° rotation,
   *  so the baked end pose is identical). `move.dir` (baked in by a drag for the discrete-
   *  fire path) wins over the explicit `sweepDir` arg (the live hold-partial path); both
   *  carry the same drag sign, so the turn follows the finger either way. */
  beginMove(move: HeliMove, sweepDir: 1 | -1 = 1): PieceAnim[] {
    const axis = this.axes[move.edge];
    const angle = (move.dir ?? sweepDir) * TWIST_ANGLE;
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return this.pivotsForMove(move).map((pivot) => makeAnim(pivot, delta, axis, angle));
  }

  /** Current corner slot (position) of corner pieceId — for drag candidate-edge lookup. */
  cornerSlotOf(pieceId: number): number { return this.state.cp.indexOf(pieceId); }
  /** Current wing slot (position) of wing pieceId. */
  wingSlotOf(pieceId: number): number { return this.state.wp.indexOf(pieceId); }

  /** Snap pivots to end pose, advance discrete state, record history. */
  finishMove(anims: PieceAnim[], move: HeliMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.state = applyHeliMove(this.state, move);
    this.history.record(heliMoveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: HeliMove): void {
    this.finishMove(this.beginMove(move), move);
  }

  /** Snap a move into place without recording history (undo/redo replay). */
  applyMoveSilent(move: HeliMove): void {
    const anims = this.beginMove(move);
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.state = applyHeliMove(this.state, move);
    this.dirty = true;
  }

  /** Snap every piece pivot to solved (identity) + reset the discrete state. Non-solved
   *  states are reached by replaying moves from here, keeping orientations exact. */
  reset(): void {
    this.state = solvedHeli();
    for (const p of this.cornerPieces) p.pivot.quaternion.identity();
    for (const p of this.wingPieces) p.pivot.quaternion.identity();
    this.dirty = true;
  }

  get complete(): boolean {
    return isSolvedHeli(this.state);
  }

  /** Debug "carve": hide the pieces edge 0's twist rotates (2 corners + 4 wings) so the
   *  core + neighbors' inner faces show through, like lifting one edge's flap off a real
   *  Helicopter. OFF restores ALL pieces (correct even if the state permuted while
   *  carved). Named setCarveCorner to match the shared debug toggle across cuber engines. */
  setCarveCorner(on: boolean): void {
    if (on) {
      for (const s of CORNER_SLOTS[0]) this.cornerPieces[this.state.cp[s]].pivot.visible = false;
      for (const s of WING_SLOTS[0]) this.wingPieces[this.state.wp[s]].pivot.visible = false;
    } else {
      for (const p of this.cornerPieces) p.pivot.visible = true;
      for (const p of this.wingPieces) p.pivot.visible = true;
    }
    this.dirty = true;
  }

  /** Dispose piece geometries + drop callbacks. Materials are module singletons (shared
   *  across pieces + reused if the cube is rebuilt), so they are NOT disposed here. */
  dispose(): void {
    this.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry?.dispose();
    });
    this.callbacks.length = 0;
    this.cornerPieces.length = 0;
    this.wingPieces.length = 0;
  }
}
