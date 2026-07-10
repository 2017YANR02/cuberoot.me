/**
 * SkewbCube — three.js Group rendering a Skewb (deep-cut corner-turning: 8 corner
 * pieces that permute + twist, 6 centre pieces that permute).
 *
 * A twist about grip g rotates the cap on g's side by ±120° about g's body diagonal:
 * the grip corner spins in place, 3 other corners 3-cycle, 3 centres 3-cycle. Every
 * piece is a pivot at the origin — position stays put, only the quaternion changes —
 * with a discrete state (corner perm + corner orientation + centre perm) tracking
 * identity for `complete` + history.
 *
 * The animation/state machinery lives in the shared CornerTurnCube base; SkewbCube
 * supplies the geometry, the discrete state, and the three hooks (pivotsForMove /
 * advanceState / moveToString).
 */
import * as THREE from 'three';
import { buildCornerMesh, buildCenterMesh, buildCore } from './skewbGeometry';
import {
  type SkewbMove, type SkewbRotMove, type SkewbState, CORNER_AXIS, CORNER_CYCLE,
  CENTER_CYCLE, solvedSkewb, applySkewbMove, isSolved, isSkewbRot, skewbMoveToString,
} from './skewbState';
import SkewbTwister from './SkewbTwister';
import CornerTurnCube from '../CornerTurnCube';
import type { CornerMove } from '../cornerNotation';
import { makeAnim, type PieceAnim } from '../pieceAnim';

export type { PieceAnim };

/** World rotation axes for x / y / z. */
const ROT_AXIS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
] as const;

/** Signed angle of a rotation move: bare (dir 1) = −90° (clockwise about the axis = the
 *  WCA / cubing.js x·y·z convention), prime = +90°, double = 180°. */
function rotAngle(dir: 1 | -1 | 2): number {
  return dir === 2 ? Math.PI : -dir * (Math.PI / 2);
}

const _rotQuat = new THREE.Quaternion();
const _invQuat = new THREE.Quaternion();

export interface PieceEntry {
  /** Stable piece id (= its solved slot). */
  pieceId: number;
  pivot: THREE.Object3D;
  group: THREE.Group;
}

// The shared base drives corner GRIP twists (CornerMove). Skewb layers whole-cube
// rotations on top: the four public move methods widen to accept SkewbMove (grip ∪
// rotation), delegating grips to the base and folding rotations into the group.
export default class SkewbCube extends CornerTurnCube<CornerMove> {
  corners: PieceEntry[] = [];
  centers: PieceEntry[] = [];
  /** Discrete state: corner perm + corner orientation + centre perm. */
  state: SkewbState = solvedSkewb();
  readonly puzzleType = 'skewb' as const;
  twister: SkewbTwister;

  constructor() {
    super(CORNER_AXIS);
    this.add(buildCore());
    for (let slot = 0; slot < 8; slot++) {
      const { pivot, group } = buildCornerMesh(slot);
      this.add(pivot);
      this.corners.push({ pieceId: slot, pivot, group });
    }
    for (let slot = 0; slot < 6; slot++) {
      const { pivot, group } = buildCenterMesh(slot);
      this.add(pivot);
      this.centers.push({ pieceId: slot, pivot, group });
    }
    this.applyStateInstant(solvedSkewb());
    this.twister = new SkewbTwister(this);
  }

  private cornerById(id: number): PieceEntry { return this.corners[id]; }
  private centerById(id: number): PieceEntry { return this.centers[id]; }

  /** Snap every pivot to solved (identity). Canonical snapshots (reset / scramble
   *  setup) only need the solved identity; non-solved states are reached by replaying
   *  moves from solved (applyMovesInstant), keeping orientations exact. Also clears any
   *  whole-cube reorientation (x/y/z) carried on the group's own quaternion. */
  applyStateInstant(state: SkewbState): void {
    this.state = {
      cornerPerm: state.cornerPerm.slice(),
      cornerOri: state.cornerOri.slice(),
      centerPerm: state.centerPerm.slice(),
    };
    this.quaternion.identity();
    for (const p of this.corners) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    for (const c of this.centers) { c.pivot.quaternion.identity(); c.pivot.position.set(0, 0, 0); }
    this.dirty = true;
  }

  reset(): void { this.applyStateInstant(solvedSkewb()); }

  // The pivots a grip rotates: the grip corner (spins in place) + the 3 cycling
  // corners + the 3 cycling centres, read off the LIVE permutations.
  protected pivotsForMove(move: CornerMove): THREE.Object3D[] {
    const g = move.corner;
    const out: THREE.Object3D[] = [this.cornerById(this.state.cornerPerm[g]).pivot];
    for (const slot of CORNER_CYCLE[g]) out.push(this.cornerById(this.state.cornerPerm[slot]).pivot);
    for (const slot of CENTER_CYCLE[g]) out.push(this.centerById(this.state.centerPerm[slot]).pivot);
    return out;
  }

  protected advanceState(move: CornerMove): void {
    this.state = applySkewbMove(this.state, move);
  }

  protected moveToString(move: CornerMove): string {
    return skewbMoveToString(move);
  }

  // ── Whole-cube rotations (x / y / z) ─────────────────────────────────────────
  // A rotation re-holds the cube: it permutes no piece, so the discrete state is left
  // alone and the reorientation rides on the group's OWN quaternion (animated as every
  // pivot spinning about the world axis, then folded into the group at finish).
  //
  // But grip LETTERS are world-fixed, not cube-fixed — after `x`, a typed `R` must turn
  // whatever grip is now on the right, exactly like a WCA / Sarah alg. So every grip is
  // remapped through the live orientation before it drives the engine: we pick the LOCAL
  // grip whose world axis currently points where the typed letter points. With the group
  // rotated by O, local grip `g` (axis Oa) shows at world Oa, so `remapGrip` returns the
  // g with a ≈ O⁻¹·(letter axis) — turning the right pieces on screen and in the state,
  // while history still records the letter the user typed (so replay re-derives it).

  private allPivots(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const p of this.corners) out.push(p.pivot);
    for (const c of this.centers) out.push(c.pivot);
    return out;
  }

  /** The local grip a world-fixed letter turns under the current reorientation. Home
   *  orientation (no rotation yet) → the letter's own grip, bit-for-bit unchanged. */
  private remapGrip(move: CornerMove): CornerMove {
    const q = this.quaternion;
    if (q.x === 0 && q.y === 0 && q.z === 0 && q.w === 1) return move;
    const localDir = this.axes[move.corner].clone().applyQuaternion(_invQuat.copy(q).invert());
    let best = move.corner, bestDot = -Infinity;
    for (let g = 0; g < 8; g++) {
      const d = this.axes[g].dot(localDir);
      if (d > bestDot) { bestDot = d; best = g; }
    }
    return { corner: best, dir: move.dir };
  }

  /** Fold a rotation into the group's quaternion (world-frame premultiply). */
  private bakeRotation(move: SkewbRotMove): void {
    this.quaternion.premultiply(_rotQuat.setFromAxisAngle(ROT_AXIS[move.rot], rotAngle(move.dir)));
  }

  beginMove(move: SkewbMove): PieceAnim[] {
    if (!isSkewbRot(move)) return super.beginMove(this.remapGrip(move));
    const angle = rotAngle(move.dir);
    // Express the world axis in the group's CURRENT local frame so the animated spin
    // stays visually correct even when earlier rotations have already reoriented it.
    const localAxis = ROT_AXIS[move.rot].clone()
      .applyQuaternion(_invQuat.copy(this.quaternion).invert());
    const delta = _rotQuat.setFromAxisAngle(localAxis, angle);
    return this.allPivots().map((pivot) => makeAnim(pivot, delta, localAxis, angle));
  }

  finishMove(anims: PieceAnim[], move: SkewbMove): void {
    if (isSkewbRot(move)) {
      for (const a of anims) a.pivot.quaternion.copy(a.startQuat); // undo the animated spin
      this.bakeRotation(move);
      this.history.record(skewbMoveToString(move));
    } else {
      for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
      this.advanceState(this.remapGrip(move));    // state turns the remapped local grip…
      this.history.record(this.moveToString(move)); // …but history keeps the typed letter.
    }
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: SkewbMove): void {
    this.finishMove(this.beginMove(move), move);
  }

  applyMoveSilent(move: SkewbMove): void {
    if (isSkewbRot(move)) { this.bakeRotation(move); this.dirty = true; return; }
    const local = this.remapGrip(move);
    for (const a of super.beginMove(local)) a.pivot.quaternion.copy(a.endQuat);
    this.advanceState(local);
    this.dirty = true;
  }

  /** Debug: carve out (hide) the whole cap grip 0 rotates — its 4 corner pieces (by
   *  current perm) + 3 centre pieces — so the core + neighbours' inner faces show
   *  through, like lifting one cap off a real Skewb. OFF restores ALL pieces. */
  setCarve(on: boolean): void {
    if (on) {
      this.cornerById(this.state.cornerPerm[0]).pivot.visible = false;
      for (const slot of CORNER_CYCLE[0]) this.cornerById(this.state.cornerPerm[slot]).pivot.visible = false;
      for (const slot of CENTER_CYCLE[0]) this.centerById(this.state.centerPerm[slot]).pivot.visible = false;
    } else {
      for (const p of this.corners) p.pivot.visible = true;
      for (const c of this.centers) c.pivot.visible = true;
    }
    this.dirty = true;
  }

  get complete(): boolean { return isSolved(this.state); }

  dispose(): void {
    super.dispose();
    this.corners.length = 0;
    this.centers.length = 0;
  }
}
