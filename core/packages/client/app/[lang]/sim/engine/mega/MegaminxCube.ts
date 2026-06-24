/**
 * MegaminxCube — three.js Group rendering a megaminx (face-turning dodecahedron: 20
 * corners, 30 edges, 12 fixed centers).
 *
 * Each piece is a pivot at the origin; a turn of face f rotates that face's 11 pivots
 * (its center + the 5 corners + 5 edges currently on it) by ±72° about the face normal —
 * position stays at the origin, only the quaternion changes. A discrete state (corner/edge
 * perm + orientation) tracks identity for `complete` + history. megaminx is the only
 * face-turning /sim engine, so the begin/finish machinery is inlined here (no shared base
 * — see the corner-turners' CornerTurnCube for the 120° analog).
 *
 * Conforms to TweenCube<MegaMove> so the shared TweenTwister drives it.
 */
import * as THREE from 'three';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import type { TweenCube } from '../TweenTwister';
import MegaminxTwister from './MegaminxTwister';
import {
  FACE_NORMAL, CORNER_DIR, FACE_CORNERS, FACE_EDGES,
  solvedMega, applyMegaMove, isSolved, megaMoveToString,
  type MegaMove, type MegaState,
} from './megaState';
import { buildCornerPiece, buildEdgePiece, buildCenterPiece, buildCore } from './megaGeometry';

export type { PieceAnim };

const TURN = (2 * Math.PI) / 5; // 72°

interface PieceEntry { pieceId: number; pivot: THREE.Object3D; group: THREE.Group; }

export default class MegaminxCube extends THREE.Group implements TweenCube<MegaMove> {
  callbacks: (() => void)[] = [];
  dirty = true;
  order = 0;
  history = new MoveHistory();
  readonly puzzleType = 'megaminx' as const;
  twister: MegaminxTwister;

  /** Pieces, indexed by stable pieceId (= solved slot); never reordered. */
  corners: PieceEntry[] = [];
  edges: PieceEntry[] = [];
  centers: PieceEntry[] = [];
  /** Discrete state: corner perm+twist (cp/co), edge perm+flip (ep/eo). */
  state: MegaState = solvedMega();

  private readonly axes: THREE.Vector3[];
  /** Per-face rotation sense for dir +1 (about +faceNormal), auto-aligned to the state
   *  cycle. Public so the drag can map a screen-tangent direction to the right move.dir. */
  readonly turnSign: number[];

  constructor() {
    super();
    this.axes = FACE_NORMAL.map((nrm) => new THREE.Vector3(nrm[0], nrm[1], nrm[2]).normalize());
    // Pick the rotation sense (about +normal) whose +72° carries the piece at ring slot 0
    // to ring slot 1 — so the visual turn matches the discrete cycle (skill: auto-determine
    // the sign, don't hand-guess).
    this.turnSign = FACE_CORNERS.map((r, f) => {
      const a = new THREE.Vector3(...CORNER_DIR[r[0]]);
      const b = new THREE.Vector3(...CORNER_DIR[r[1]]);
      const plus = a.clone().applyAxisAngle(this.axes[f], TURN).distanceTo(b);
      const minus = a.clone().applyAxisAngle(this.axes[f], -TURN).distanceTo(b);
      return plus < minus ? 1 : -1;
    });

    this.add(buildCore());
    for (let i = 0; i < 12; i++) { const { pivot, group } = buildCenterPiece(i); this.add(pivot); this.centers.push({ pieceId: i, pivot, group }); }
    for (let i = 0; i < 30; i++) { const { pivot, group } = buildEdgePiece(i); this.add(pivot); this.edges.push({ pieceId: i, pivot, group }); }
    for (let i = 0; i < 20; i++) { const { pivot, group } = buildCornerPiece(i); this.add(pivot); this.corners.push({ pieceId: i, pivot, group }); }
    this.applyStateInstant(solvedMega());
    this.twister = new MegaminxTwister(this);
  }

  /** The 11 pivots a face turn rotates: the face's center + the corner/edge pieces
   *  CURRENTLY in its 5 corner slots and 5 edge slots (read off the live perm). */
  private pivotsForMove(move: MegaMove): THREE.Object3D[] {
    const f = move.face;
    const out: THREE.Object3D[] = [this.centers[f].pivot];
    for (const s of FACE_CORNERS[f]) out.push(this.corners[this.state.cp[s]].pivot);
    for (const s of FACE_EDGES[f]) out.push(this.edges[this.state.ep[s]].pivot);
    return out;
  }

  beginMove(move: MegaMove): PieceAnim[] {
    const axis = this.axes[move.face];
    const angle = move.dir * this.turnSign[move.face] * TURN;
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return this.pivotsForMove(move).map((pivot) => makeAnim(pivot, delta, axis, angle));
  }

  finishMove(anims: PieceAnim[], move: MegaMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.state = applyMegaMove(this.state, move);
    this.history.record(megaMoveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: MegaMove): void {
    const anims = this.beginMove(move);
    this.finishMove(anims, move);
  }

  applyMovesInstant(moves: MegaMove[]): void {
    this.reset();
    for (const move of moves) this.applyMoveInstant(move);
  }

  applyMoveSilent(move: MegaMove): void {
    const anims = this.beginMove(move);
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.state = applyMegaMove(this.state, move);
    this.dirty = true;
  }

  /** Snap every pivot to solved (identity). Non-solved states are reached by replaying
   *  moves from solved (applyMovesInstant), keeping orientations exact. */
  applyStateInstant(state: MegaState): void {
    this.state = { cp: state.cp.slice(), co: state.co.slice(), ep: state.ep.slice(), eo: state.eo.slice() };
    for (const p of this.corners) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    for (const p of this.edges) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    for (const p of this.centers) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    this.dirty = true;
  }

  reset(): void { this.applyStateInstant(solvedMega()); }

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
    this.callbacks.length = 0;
    this.corners.length = 0;
    this.edges.length = 0;
    this.centers.length = 0;
  }
}
