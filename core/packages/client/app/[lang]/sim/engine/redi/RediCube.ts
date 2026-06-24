/**
 * RediCube — three.js Group rendering a Redi Cube (corner-turning: 12 edge pieces
 * + 8 in-place-twisting corner pieces).
 *
 * A twist about corner c rotates the 3 edge pivots in c's cycle AND c's own corner
 * pivot by ±120° about the corner's body diagonal — position stays at the origin,
 * only the quaternion changes. A discrete state (edge perm + corner orientations)
 * tracks identity for `complete` + history. Corner pieces never permute (each stays
 * at its vertex), so corner pivots are indexed directly by corner id.
 *
 * The animation/state machinery lives in the shared CornerTurnCube base; RediCube
 * supplies the geometry, the discrete state, and the three hooks (pivotsForMove /
 * advanceState / moveToString).
 */
import * as THREE from 'three';
import { buildEdgeMesh, buildCornerMesh, buildCore } from './rediGeometry';
import {
  type RediMove, type RediState, CORNER_AXIS, CORNER_CYCLE,
  solvedRedi, applyRediMove, isSolved, rediMoveToString,
} from './rediState';
import RediTwister from './RediTwister';
import CornerTurnCube from '../CornerTurnCube';
import type { PieceAnim } from '../pieceAnim';

export type { PieceAnim };

export interface EdgeEntry {
  /** Stable piece id (= its solved slot). */
  pieceId: number;
  pivot: THREE.Object3D;
  group: THREE.Group;
}

export interface CornerEntry {
  /** Corner id 0..7 (never changes — corners don't permute). */
  cornerId: number;
  pivot: THREE.Object3D;
  group: THREE.Group;
}

export default class RediCube extends CornerTurnCube<RediMove> {
  edges: EdgeEntry[] = [];
  corners: CornerEntry[] = [];
  /** Discrete state: edge perm + corner orientations. */
  state: RediState = solvedRedi();
  readonly puzzleType = 'redi' as const;
  twister: RediTwister;

  constructor() {
    super(CORNER_AXIS);
    this.add(buildCore());
    for (let slot = 0; slot < 12; slot++) {
      const { pivot, group } = buildEdgeMesh(slot);
      this.add(pivot);
      this.edges.push({ pieceId: slot, pivot, group });
    }
    for (let corner = 0; corner < 8; corner++) {
      const { pivot, group } = buildCornerMesh(corner);
      this.add(pivot);
      this.corners.push({ cornerId: corner, pivot, group });
    }
    this.applyStateInstant(solvedRedi());
    this.twister = new RediTwister(this);
  }

  /** edge pieceId → its EdgeEntry (pieces never change array index). */
  private edgeById(id: number): EdgeEntry { return this.edges[id]; }

  /**
   * Snap every pivot to its solved (identity) orientation. Like the Dino, canonical
   * snapshots (reset / scramble setup) only need the solved identity; non-solved
   * states are reached by replaying moves from solved, keeping orientations exact.
   */
  applyStateInstant(state: RediState): void {
    this.state = { edges: state.edges.slice(), corners: state.corners.slice() };
    for (const p of this.edges) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    for (const c of this.corners) { c.pivot.quaternion.identity(); c.pivot.position.set(0, 0, 0); }
    this.dirty = true;
  }

  reset(): void { this.applyStateInstant(solvedRedi()); }

  // The 3 edge pivots whose pieceId currently sits in the corner's cycle, plus the
  // corner's own (never-permuting) pivot.
  protected pivotsForMove(move: RediMove): THREE.Object3D[] {
    const pivots: THREE.Object3D[] = CORNER_CYCLE[move.corner]
      .map((slot) => this.edgeById(this.state.edges[slot]).pivot);
    pivots.push(this.corners[move.corner].pivot);
    return pivots;
  }

  protected advanceState(move: RediMove): void {
    this.state = applyRediMove(this.state, move);
  }

  protected moveToString(move: RediMove): string {
    return rediMoveToString(move);
  }

  /** Debug: carve out (hide) the whole cap that corner 0 rotates — its 3 edge
   *  pieces (by current perm) + its corner piece — so the core and neighbors' inner
   *  faces show through, like lifting one tripod off a real Redi. OFF restores ALL
   *  pieces (correct even if the state permuted while carved). */
  setCarveCorner(on: boolean): void {
    if (on) {
      for (const slot of CORNER_CYCLE[0]) this.edgeById(this.state.edges[slot]).pivot.visible = false;
      this.corners[0].pivot.visible = false;
    } else {
      for (const p of this.edges) p.pivot.visible = true;
      for (const c of this.corners) c.pivot.visible = true;
    }
    this.dirty = true;
  }

  get complete(): boolean { return isSolved(this.state); }

  dispose(): void {
    super.dispose();
    this.edges.length = 0;
    this.corners.length = 0;
  }
}
