/**
 * DinoCube — three.js Group rendering a Dino Cube (corner-turning, 12 edge pieces).
 *
 * Each of the 12 edge pieces is a pivot at the origin; a twist about corner c
 * rotates the 3 pivots of that corner by ±120° about the corner's body diagonal — so
 * position stays at the origin and only the quaternion changes. A discrete
 * permutation (`perm[slot]=pieceId`) tracks identity for `complete` + history.
 *
 * The animation/state machinery lives in the shared CornerTurnCube base; DinoCube
 * supplies the geometry, the edge permutation, and the three hooks (pivotsForMove /
 * advanceState / moveToString).
 */
import * as THREE from 'three';
import { buildPieceMesh, buildCore } from './dinoGeometry';
import {
  type DinoMove, CORNER_AXIS, CORNER_CYCLE,
  solvedDino, applyDinoMove, isSolved, dinoMoveToString,
} from './dinoState';
import DinoTwister from './DinoTwister';
import CornerTurnCube from '../CornerTurnCube';
import type { PieceAnim } from '../pieceAnim';

export type { PieceAnim };

export interface PieceEntry {
  /** Stable piece id (= its solved slot). */
  pieceId: number;
  pivot: THREE.Object3D;
  group: THREE.Group;
}

export default class DinoCube extends CornerTurnCube<DinoMove> {
  pieces: PieceEntry[] = [];
  /** perm[slot] = pieceId currently in that slot. */
  perm: number[] = solvedDino();
  readonly puzzleType = 'dino' as const;
  twister: DinoTwister;

  constructor() {
    super(CORNER_AXIS);
    this.add(buildCore());
    for (let slot = 0; slot < 12; slot++) {
      const { pivot, group } = buildPieceMesh(slot);
      this.add(pivot);
      this.pieces.push({ pieceId: slot, pivot, group });
    }
    this.applyStateInstant(solvedDino());
    this.twister = new DinoTwister(this);
  }

  /** pieceId → its PieceEntry (pieces never change array index). */
  private pieceById(id: number): PieceEntry {
    return this.pieces[id];
  }

  /**
   * Snap every piece pivot to its solved (identity) orientation. We can't read an
   * absolute orientation from a slot alone, but for a canonical state snapshot
   * (reset / scramble setup) only the solved identity is needed — non-solved states
   * are reached by replaying moves from solved (applyMovesInstant), keeping
   * orientations exact.
   */
  applyStateInstant(perm: number[]): void {
    this.perm = perm.slice();
    for (const p of this.pieces) {
      p.pivot.quaternion.identity();
      p.pivot.position.set(0, 0, 0);
    }
    this.dirty = true;
  }

  reset(): void {
    this.applyStateInstant(solvedDino());
  }

  // The 3 pivots whose pieceId currently sits in the corner's 3 cycle slots.
  protected pivotsForMove(move: DinoMove): THREE.Object3D[] {
    return CORNER_CYCLE[move.corner].map((slot) => this.pieceById(this.perm[slot]).pivot);
  }

  protected advanceState(move: DinoMove): void {
    this.perm = applyDinoMove(this.perm, move);
  }

  protected moveToString(move: DinoMove): string {
    return dinoMoveToString(move);
  }

  /** Debug: carve out (hide) the 3 edge pieces currently occupying corner 0's slots
   *  — exactly the group `beginMove({ corner: 0 })` rotates — so the core sphere and
   *  the neighbors' inner faces show through, like lifting one corner's tripod off a
   *  real Dino. OFF restores ALL pieces (correct even if the state permuted while
   *  carved). */
  setCarveCorner(on: boolean): void {
    if (on) {
      for (const slot of CORNER_CYCLE[0]) this.pieceById(this.perm[slot]).pivot.visible = false;
    } else {
      for (const p of this.pieces) p.pivot.visible = true;
    }
    this.dirty = true;
  }

  get complete(): boolean {
    return isSolved(this.perm);
  }

  dispose(): void {
    super.dispose();
    this.pieces.length = 0;
  }
}
