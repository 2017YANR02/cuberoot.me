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
  type SkewbMove, type SkewbState, CORNER_AXIS, CORNER_CYCLE, CENTER_CYCLE,
  solvedSkewb, applySkewbMove, isSolved, skewbMoveToString,
} from './skewbState';
import SkewbTwister from './SkewbTwister';
import CornerTurnCube from '../CornerTurnCube';
import type { PieceAnim } from '../pieceAnim';

export type { PieceAnim };

export interface PieceEntry {
  /** Stable piece id (= its solved slot). */
  pieceId: number;
  pivot: THREE.Object3D;
  group: THREE.Group;
}

export default class SkewbCube extends CornerTurnCube<SkewbMove> {
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
   *  moves from solved (applyMovesInstant), keeping orientations exact. */
  applyStateInstant(state: SkewbState): void {
    this.state = {
      cornerPerm: state.cornerPerm.slice(),
      cornerOri: state.cornerOri.slice(),
      centerPerm: state.centerPerm.slice(),
    };
    for (const p of this.corners) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    for (const c of this.centers) { c.pivot.quaternion.identity(); c.pivot.position.set(0, 0, 0); }
    this.dirty = true;
  }

  reset(): void { this.applyStateInstant(solvedSkewb()); }

  // The pivots a grip rotates: the grip corner (spins in place) + the 3 cycling
  // corners + the 3 cycling centres, read off the LIVE permutations.
  protected pivotsForMove(move: SkewbMove): THREE.Object3D[] {
    const g = move.corner;
    const out: THREE.Object3D[] = [this.cornerById(this.state.cornerPerm[g]).pivot];
    for (const slot of CORNER_CYCLE[g]) out.push(this.cornerById(this.state.cornerPerm[slot]).pivot);
    for (const slot of CENTER_CYCLE[g]) out.push(this.centerById(this.state.centerPerm[slot]).pivot);
    return out;
  }

  protected advanceState(move: SkewbMove): void {
    this.state = applySkewbMove(this.state, move);
  }

  protected moveToString(move: SkewbMove): string {
    return skewbMoveToString(move);
  }

  /** Debug: carve out (hide) the whole cap grip 0 rotates — its 4 corner pieces (by
   *  current perm) + 3 centre pieces — so the core + neighbours' inner faces show
   *  through, like lifting one cap off a real Skewb. OFF restores ALL pieces. */
  setCarveCorner(on: boolean): void {
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
