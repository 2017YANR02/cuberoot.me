/**
 * RexCube — three.js Group rendering a Rex Cube (corner-turning: 6 centres + 24
 * petals + 12 edges, all permutation-only). A twist about corner c rotates the 15
 * pivots in c's cap (3 centres + 3 edges + 9 petals, by the LIVE permutation) ±120°
 * about the corner's body diagonal — position stays at the origin, only the
 * quaternion changes. A discrete state (3 permutation arrays) tracks identity for
 * `complete` + history.
 *
 * The animation/state machinery lives in the shared CornerTurnCube base; RexCube
 * supplies the CSG geometry, the discrete state, and the three hooks (pivotsForMove /
 * advanceState / moveToString).
 */
import * as THREE from 'three';
import { buildRexPieces, buildCore, type RexPieceBuild, type RexPieceType } from './rexGeometry';
import {
  type RexMove, type RexState, CORNER_AXIS,
  CENTER_CYCLE, EDGE_CYCLE, PETAL_CYCLE,
  solvedRex, applyRexMove, isSolved, rexMoveToString,
} from './rexState';
import RexTwister from './RexTwister';
import CornerTurnCube from '../CornerTurnCube';
import type { PieceAnim } from '../pieceAnim';

export type { PieceAnim };

/** Flattened cap slot-lists per corner per type (3 / 3 / 9 slots). */
const CENTER_CAP = CENTER_CYCLE.map((cs) => cs.flat());
const EDGE_CAP = EDGE_CYCLE.map((cs) => cs.flat());
const PETAL_CAP = PETAL_CYCLE.map((cs) => cs.flat());

export default class RexCube extends CornerTurnCube<RexMove> {
  /** Pieces indexed by stable pieceId (never change array index). */
  centers: RexPieceBuild[] = [];
  petals: RexPieceBuild[] = [];
  edges: RexPieceBuild[] = [];
  /** Discrete state: independent permutations of centres / petals / edges. */
  state: RexState = solvedRex();
  readonly puzzleType = 'rex' as const;
  twister: RexTwister;

  constructor() {
    super(CORNER_AXIS);
    this.add(buildCore());
    const built = buildRexPieces();
    this.centers = built.centers;
    this.petals = built.petals;
    this.edges = built.edges;
    for (const p of [...this.centers, ...this.petals, ...this.edges]) this.add(p.pivot);
    this.applyStateInstant(solvedRex());
    this.twister = new RexTwister(this);
  }

  private stateOf(type: RexPieceType): number[] {
    return type === 'center' ? this.state.centers : type === 'petal' ? this.state.petals : this.state.edges;
  }

  /** Snap every pivot to its solved (identity) orientation. Like Dino/Redi, canonical
   *  snapshots (reset / scramble setup) only need the solved identity; non-solved
   *  states are reached by replaying moves from solved, keeping orientations exact. */
  applyStateInstant(state: RexState): void {
    this.state = { centers: state.centers.slice(), petals: state.petals.slice(), edges: state.edges.slice() };
    for (const p of [...this.centers, ...this.petals, ...this.edges]) {
      p.pivot.quaternion.identity();
      p.pivot.position.set(0, 0, 0);
    }
    this.dirty = true;
  }

  reset(): void { this.applyStateInstant(solvedRex()); }

  /** The 15 pivots whose pieceId currently sits in the corner's cap slots. */
  protected pivotsForMove(move: RexMove): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const slot of CENTER_CAP[move.corner]) out.push(this.centers[this.state.centers[slot]].pivot);
    for (const slot of EDGE_CAP[move.corner]) out.push(this.edges[this.state.edges[slot]].pivot);
    for (const slot of PETAL_CAP[move.corner]) out.push(this.petals[this.state.petals[slot]].pivot);
    return out;
  }

  protected advanceState(move: RexMove): void {
    this.state = applyRexMove(this.state, move);
  }

  protected moveToString(move: RexMove): string {
    return rexMoveToString(move);
  }

  /** Drag helper: the corners that can currently turn the given piece (the corners
   *  whose cap includes the piece's CURRENT slot — pieces permute, so resolve live). */
  candidateCornersForPiece(type: RexPieceType, pieceId: number): number[] {
    const slot = this.stateOf(type).indexOf(pieceId);
    if (slot < 0) return [];
    const cap = type === 'center' ? CENTER_CAP : type === 'petal' ? PETAL_CAP : EDGE_CAP;
    const out: number[] = [];
    for (let c = 0; c < 8; c++) if (cap[c].includes(slot)) out.push(c);
    return out;
  }

  /** Debug: hide the whole cap corner 0 rotates (its 15 pieces by current perm), so
   *  the core + neighbours' inner faces show through. OFF restores ALL pieces. */
  setCarveCorner(on: boolean): void {
    if (on) {
      for (const slot of CENTER_CAP[0]) this.centers[this.state.centers[slot]].pivot.visible = false;
      for (const slot of EDGE_CAP[0]) this.edges[this.state.edges[slot]].pivot.visible = false;
      for (const slot of PETAL_CAP[0]) this.petals[this.state.petals[slot]].pivot.visible = false;
    } else {
      for (const p of [...this.centers, ...this.petals, ...this.edges]) p.pivot.visible = true;
    }
    this.dirty = true;
  }

  get complete(): boolean { return isSolved(this.state); }

  dispose(): void {
    super.dispose();
    this.centers.length = 0;
    this.petals.length = 0;
    this.edges.length = 0;
  }
}
