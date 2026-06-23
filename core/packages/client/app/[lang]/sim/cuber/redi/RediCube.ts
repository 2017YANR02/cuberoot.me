/**
 * RediCube — three.js Group rendering a Redi Cube (corner-turning: 12 edge pieces
 * + 8 in-place-twisting corner pieces).
 *
 * Each piece is a pivot at the origin; its quaternion is the truth for "where this
 * piece is now". A twist about corner c rotates the 3 edge pivots in c's cycle AND
 * c's own corner pivot by ±120° about the corner's body diagonal (through the
 * origin) — position stays at the origin, only the quaternion changes (pure SO(3)).
 * A discrete state (edge perm + corner orientations) tracks identity for `complete`
 * + history. Corner pieces never permute (each stays at its vertex), so corner
 * pivots are indexed directly by corner id.
 *
 * Mirrors the DinoCube / Sq1Cube contract (beginMove / finishMove /
 * applyMoveInstant / applyMovesInstant / reset / complete / dispose) so the shared
 * PlayerControls + twister wiring drives it the same way.
 */
import * as THREE from 'three';
import { buildEdgeMesh, buildCornerMesh, buildCore, cornerAxis } from './rediGeometry';
import {
  type RediMove, type RediState, CORNER_AXIS, CORNER_CYCLE,
  solvedRedi, applyRediMove, isSolved, rediMoveToString,
} from './rediState';
import RediTwister from './RediTwister';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import type { TweenCube } from '../TweenTwister';

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


/** Precomputed unit axis per corner. */
const AXES: THREE.Vector3[] = CORNER_AXIS.map(([x, y, z]) => cornerAxis(x, y, z));

export default class RediCube extends THREE.Group implements TweenCube<RediMove> {
  edges: EdgeEntry[] = [];
  corners: CornerEntry[] = [];
  /** Discrete state: edge perm + corner orientations. */
  state: RediState = solvedRedi();
  callbacks: (() => void)[] = [];
  dirty = true;
  readonly puzzleType = 'redi' as const;
  order = 0;
  history = new MoveHistory();
  twister: RediTwister;

  constructor() {
    super();
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
   * Snap every pivot to its solved (identity) orientation. Like the Dino, we don't
   * read absolute orientation from a slot — canonical snapshots (reset / scramble
   * setup) only need the solved identity; non-solved states are reached by
   * replaying moves from solved (see applyMovesInstant), keeping orientations exact.
   */
  applyStateInstant(state: RediState): void {
    this.state = { edges: state.edges.slice(), corners: state.corners.slice() };
    for (const p of this.edges) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    for (const c of this.corners) { c.pivot.quaternion.identity(); c.pivot.position.set(0, 0, 0); }
    this.dirty = true;
  }

  reset(): void { this.applyStateInstant(solvedRedi()); }

  /**
   * Animation plan for a move: the 3 edge pivots whose pieceId currently sits in the
   * corner's 3 slots, plus the corner's own pivot, rotate by ±120° about the corner
   * axis.
   */
  beginMove(move: RediMove): PieceAnim[] {
    const axis = AXES[move.corner];
    const angle = move.dir * (2 * Math.PI / 3);
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const anims: PieceAnim[] = [];
    for (const slot of CORNER_CYCLE[move.corner]) {
      const entry = this.edgeById(this.state.edges[slot]);
      anims.push(makeAnim(entry.pivot, delta, axis, angle));
    }
    anims.push(makeAnim(this.corners[move.corner].pivot, delta, axis, angle));
    return anims;
  }

  /** Snap pivots to end pose, update discrete state, record history. */
  finishMove(anims: PieceAnim[], move: RediMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.state = applyRediMove(this.state, move);
    this.history.record(rediMoveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: RediMove): void {
    const anims = this.beginMove(move);
    this.finishMove(anims, move);
  }

  applyMovesInstant(moves: RediMove[]): void {
    this.applyStateInstant(solvedRedi());
    for (const move of moves) this.applyMoveInstant(move);
  }

  /** Snap a move into place without recording history (undo/redo replay). */
  applyMoveSilent(move: RediMove): void {
    const anims = this.beginMove(move);
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.state = applyRediMove(this.state, move);
    this.dirty = true;
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
    this.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) for (const m of mat) m.dispose();
        else mat?.dispose();
      }
    });
    this.edges.length = 0;
    this.corners.length = 0;
    this.callbacks.length = 0;
  }
}
