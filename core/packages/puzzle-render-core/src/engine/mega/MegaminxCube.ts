/**
 * MegaminxCube — three.js Group rendering a megaminx (face-turning dodecahedron: 20
 * corners, 30 edges, 12 centers). Ordinary face turns keep centers fixed; WCA deep
 * turns rotate every layer except one outer face and therefore move centers too.
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
  FACE_NORMAL, CORNER_DIR, EDGE_DIR, FACE_CORNERS,
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
  /** Deep WCA turns permute centers, which the compact face-turn state omits. */
  private stateKnown = true;

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
    this.turnSign = FACE_CORNERS.map((ring, f) => {
      const a = new THREE.Vector3(...CORNER_DIR[ring[0]]);
      const b = new THREE.Vector3(...CORNER_DIR[ring[1]]);
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

  private rankPieceIds(
    directions: ReadonlyArray<readonly [number, number, number]>,
    pieces: PieceEntry[],
    face: number,
    count: number,
  ): number[] {
    const axis = this.axes[face];
    return pieces
      .map(piece => ({
        id: piece.pieceId,
        score: new THREE.Vector3(...directions[piece.pieceId])
          .applyQuaternion(piece.pivot.quaternion)
          .dot(axis),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(entry => entry.id);
  }

  /** Current face slots occupied by a stable piece id. Used by the shared `/sim`
   *  picker after deep turns, when the fixed-center discrete state is intentionally
   *  unavailable. */
  cornerFaces(pieceId: number): number[] {
    const direction = new THREE.Vector3(...CORNER_DIR[pieceId])
      .applyQuaternion(this.corners[pieceId].pivot.quaternion);
    return this.axes
      .map((axis, face) => ({ face, score: direction.dot(axis) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(entry => entry.face);
  }

  edgeFaces(pieceId: number): number[] {
    const direction = new THREE.Vector3(...EDGE_DIR[pieceId])
      .applyQuaternion(this.edges[pieceId].pivot.quaternion);
    return this.axes
      .map((axis, face) => ({ face, score: direction.dot(axis) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(entry => entry.face);
  }

  centerFace(pieceId: number): number {
    const direction = new THREE.Vector3(...FACE_NORMAL[pieceId])
      .applyQuaternion(this.centers[pieceId].pivot.quaternion);
    return this.axes
      .map((axis, face) => ({ face, score: direction.dot(axis) }))
      .sort((a, b) => b.score - a.score)[0].face;
  }

  /** The 11 pivots of a shallow face turn, or their complement for a WCA deep turn.
   *  Geometry is the source of truth so selection remains correct after centers move. */
  private pivotsForMove(move: MegaMove): THREE.Object3D[] {
    const f = move.face;
    const shallow = new Set<THREE.Object3D>();
    shallow.add(this.centers[this.rankPieceIds(FACE_NORMAL, this.centers, f, 1)[0]].pivot);
    for (const id of this.rankPieceIds(CORNER_DIR, this.corners, f, 5)) shallow.add(this.corners[id].pivot);
    for (const id of this.rankPieceIds(EDGE_DIR, this.edges, f, 5)) shallow.add(this.edges[id].pivot);
    if (!move.deep) return [...shallow];
    return [...this.centers, ...this.corners, ...this.edges]
      .map(piece => piece.pivot)
      .filter(pivot => !shallow.has(pivot));
  }

  beginMove(move: MegaMove): PieceAnim[] {
    const axis = this.axes[move.face];
    const angle = move.dir * this.turnSign[move.face] * TURN * (move.deep ? 2 : 1);
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return this.pivotsForMove(move).map((pivot) => makeAnim(pivot, delta, axis, angle));
  }

  finishMove(anims: PieceAnim[], move: MegaMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    if (this.stateKnown && !move.deep) this.state = applyMegaMove(this.state, move);
    else if (move.deep) this.stateKnown = false;
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
    if (this.stateKnown && !move.deep) this.state = applyMegaMove(this.state, move);
    else if (move.deep) this.stateKnown = false;
    this.dirty = true;
  }

  /** Snap every pivot to solved (identity). Non-solved states are reached by replaying
   *  moves from solved (applyMovesInstant), keeping orientations exact. */
  applyStateInstant(state: MegaState): void {
    this.state = { cp: state.cp.slice(), co: state.co.slice(), ep: state.ep.slice(), eo: state.eo.slice() };
    this.stateKnown = true;
    for (const p of this.corners) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    for (const p of this.edges) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    for (const p of this.centers) { p.pivot.quaternion.identity(); p.pivot.position.set(0, 0, 0); }
    this.dirty = true;
  }

  reset(): void { this.applyStateInstant(solvedMega()); }

  /** Debug: carve out (hide) the 11 pieces currently on face 0 — exactly the group a
   *  turn of that face rotates (its center + the 5 corners + 5 edges in its live slots) —
   *  so the core and the neighbours' inner walls show through, like lifting one cap off a
   *  real megaminx. The face-turn analog of the corner-turners' carve-corner. OFF restores
   *  ALL pieces (correct even if the state permuted while carved). */
  setCarve(on: boolean): void {
    if (on) {
      for (const pivot of this.pivotsForMove({ face: 0, dir: 1 })) pivot.visible = false;
    } else {
      for (const p of this.corners) p.pivot.visible = true;
      for (const p of this.edges) p.pivot.visible = true;
      for (const p of this.centers) p.pivot.visible = true;
    }
    this.dirty = true;
  }

  get complete(): boolean {
    if (this.stateKnown) return isSolved(this.state);
    return [...this.corners, ...this.edges, ...this.centers].every(({ pivot }) => (
      Math.abs(pivot.quaternion.w) > 1 - 1e-8
    ));
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
    this.corners.length = 0;
    this.edges.length = 0;
    this.centers.length = 0;
  }
}
