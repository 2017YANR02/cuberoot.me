/**
 * GearCube — three.js Group rendering a Gear Cube (geared 3×3: 180° face flips).
 *
 * 8 corners + 6 centers + core, each one pivot at the origin (quaternion = truth).
 * The 12 edge GEARS get a NESTED pivot pair: an orbit pivot (face/middle turns) with
 * a spin pivot inside (the gear's own rotation about its slot's radial axis). The
 * compound motion R_axis(α·v)·R_radial(β·v) factors exactly into two fixed-axis
 * PieceAnims — the orbit anim premultiplies in world space, the spin anim
 * premultiplies the child's LOCAL quaternion about axis (outerQuat₀⁻¹ · r̂_slot),
 * constant for the whole tween — so the shared applyAnimFrame drives both untouched.
 * The creased crown is a RIGID child of the spin pivot (v12): its fold is baked
 * once at build, so a scrambled gear rests TILTED off the faces like the real
 * puzzle — no per-frame vertex work anywhere.
 *
 * One move (face f, amt): face layer −amt·180° about the face axis, middle slab
 * (4 centers + core + the equator ring's 4 gears) −amt·90°, equator gears ALSO spin
 * +amt·300° about their outward radials (net −amt·60°, consistent with the mod-3 spin
 * phase — issue #32); the opposite layer holds still. The face's own 4 riding gears
 * do NOT spin (verified vs cstimer's facelet maps — see gearState). A discrete
 * piece state advances in finishMove for `complete`/history.
 */
import * as THREE from 'three';
import { Evaluator } from 'three-bvh-csg';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import type { TweenCube } from '../TweenTwister';
import {
  type GearMove, type GearPieceState,
  solvedGear, applyGearMove, isSolvedGear, gearMoveToString,
  FACE_AXIS, FACE_CORNER_SLOTS, FACE_GEAR_SLOTS, FACE_EQUATOR_RING, MIDDLE_CENTER_SLOTS,
} from './gearState';
import {
  buildGearPiece, buildCornerPiece, buildCenterPiece, buildCore,
  gearSlotAxis, type GearPieceHandle,
} from './gearGeometry';
import GearTwister from './GearTwister';

export type { PieceAnim };

/** Debug "isolate" piece kinds — keep one, hide the rest. `edge` = the 12 edge
 *  GEARS; `core` = the skeleton/core. Mirrors the corner/edge/center/core cube
 *  taxonomy the UI dropdown offers. */
export type GearIsolateKind = 'corner' | 'edge' | 'center' | 'core';

interface PieceEntry { pivot: THREE.Object3D; group: THREE.Group; }

const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();

export default class GearCube extends THREE.Group implements TweenCube<GearMove> {
  readonly puzzleType = 'gear' as const;
  order = 0;
  dirty = true;
  callbacks: (() => void)[] = [];
  history = new MoveHistory();
  twister: GearTwister;

  /** Pivots indexed by stable pieceId (pieces never change array index). */
  private cornerPieces: PieceEntry[] = [];
  private centerPieces: PieceEntry[] = [];
  /** gearPieces[r][id] — nested orbit+spin pivots. */
  private gearPieces: GearPieceHandle[][] = [];
  private corePiece: PieceEntry;
  /** Discrete state (slot → pieceId + per-ring spin phase). */
  private state: GearPieceState = solvedGear();

  constructor() {
    super();
    const ev = new Evaluator();
    ev.useGroups = false;
    for (let ci = 0; ci < 8; ci++) {
      const p = buildCornerPiece(ci, ev);
      this.add(p.pivot);
      this.cornerPieces.push(p);
    }
    for (let f = 0; f < 6; f++) {
      const p = buildCenterPiece(f);
      this.add(p.pivot);
      this.centerPieces.push(p);
    }
    for (let r = 0; r < 3; r++) {
      const ring: GearPieceHandle[] = [];
      for (let s = 0; s < 4; s++) {
        const p = buildGearPiece(r, s);
        this.add(p.pivot);
        ring.push(p);
      }
      this.gearPieces.push(ring);
    }
    this.corePiece = buildCore();
    this.add(this.corePiece.pivot);
    this.twister = new GearTwister(this);
  }

  /** Current slot of a corner / gear piece — for drag candidate lookup. */
  cornerSlotOf(pieceId: number): number { return this.state.cp.indexOf(pieceId); }
  gearSlotOf(ring: number, pieceId: number): number { return this.state.ring[ring].indexOf(pieceId); }
  centerSlotOf(pieceId: number): number { return this.state.cent.indexOf(pieceId); }

  /** Animation plan for one move: three fixed-axis groups (face −amt·π, middle
   *  −amt·π/2, equator-gear spins +amt·8π/3), pieces read off the LIVE state. */
  beginMove(move: GearMove): PieceAnim[] {
    const f = move.face;
    const n = _axis.set(FACE_AXIS[f][0], FACE_AXIS[f][1], FACE_AXIS[f][2]);
    const anims: PieceAnim[] = [];
    const faceAngle = -move.amt * Math.PI;
    const midAngle = -move.amt * (Math.PI / 2);
    // 300° per 180° flip (GT: Jaap's official sheet, .tmp/gear/Gear Cube.pdf —
    // "each adjoining edge piece turns 300°"; his "two complete rounds ...
    // twists them by 120°" cross-checks: 4·300 ≡ 120 (mod 360°)). Net −60° per
    // flip does NOT desync the Z3 discrete phase: a gear returns to its slot
    // only after 4k flips, and 4k·300 ≡ 120k — at a fixed slot only 3
    // orientations are reachable (Jaap/cstimer's mod-3 phase); the extra ±60°
    // parity is slaved to the ring position (net flips mod 2), so the
    // accumulated spin pivot always agrees with the discrete state.
    // applyAnimFrame interpolates axis·angle, so any magnitude animates fully.
    const spinAngle = move.amt * (5 * Math.PI / 3);
    const faceDelta = _q.setFromAxisAngle(n, faceAngle).clone();
    // face layer: corners + riding gears (orbit pivots only) + the face's center
    for (const s of FACE_CORNER_SLOTS[f]) {
      anims.push(makeAnim(this.cornerPieces[this.state.cp[s]].pivot, faceDelta, n.clone(), faceAngle));
    }
    for (const [r, s] of FACE_GEAR_SLOTS[f]) {
      anims.push(makeAnim(this.gearPieces[r][this.state.ring[r][s]].pivot, faceDelta, n.clone(), faceAngle));
    }
    anims.push(makeAnim(this.centerPieces[this.state.cent[f]].pivot, faceDelta, n.clone(), faceAngle));
    // middle slab: 4 side centers + core + equator gears (orbit + spin)
    const midDelta = new THREE.Quaternion().setFromAxisAngle(n, midAngle);
    for (const s of MIDDLE_CENTER_SLOTS[f]) {
      anims.push(makeAnim(this.centerPieces[this.state.cent[s]].pivot, midDelta, n.clone(), midAngle));
    }
    anims.push(makeAnim(this.corePiece.pivot, midDelta, n.clone(), midAngle));
    const er = FACE_EQUATOR_RING[f];
    for (let s = 0; s < 4; s++) {
      const piece = this.gearPieces[er][this.state.ring[er][s]];
      anims.push(makeAnim(piece.pivot, midDelta, n.clone(), midAngle));
      // spin about the slot's outward radial, expressed in the orbit pivot's local
      // frame at move start (constant through the tween — see class doc).
      const radial = gearSlotAxis(er, s);
      const local = radial.applyQuaternion(piece.pivot.quaternion.clone().invert());
      const spinDelta = new THREE.Quaternion().setFromAxisAngle(local, spinAngle);
      anims.push(makeAnim(piece.spin, spinDelta, local, spinAngle));
    }
    return anims;
  }

  /** Snap pivots to end pose, advance discrete state, record history. */
  finishMove(anims: PieceAnim[], move: GearMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.state = applyGearMove(this.state, move);
    this.history.record(gearMoveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: GearMove): void {
    this.finishMove(this.beginMove(move), move);
  }

  /** Snap a move into place without recording history (undo/redo replay). */
  applyMoveSilent(move: GearMove): void {
    const anims = this.beginMove(move);
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.state = applyGearMove(this.state, move);
    this.dirty = true;
  }

  reset(): void {
    this.state = solvedGear();
    for (const p of this.cornerPieces) p.pivot.quaternion.identity();
    for (const p of this.centerPieces) p.pivot.quaternion.identity();
    for (const ring of this.gearPieces) for (const p of ring) {
      p.pivot.quaternion.identity();
      p.spin.quaternion.identity();
    }
    this.corePiece.pivot.quaternion.identity();
    this.dirty = true;
  }

  get complete(): boolean {
    return isSolvedGear(this.state);
  }

  /** Debug "carve face": hide the U-face layer's moving group (4 corners + 4 riding
   *  gears + the U center) to reveal the middle slab + core. */
  private _carve = false;
  /** Debug "isolate": show ONLY this piece kind, hide all others (inverse of carve).
   *  null = show every kind. */
  private _isolate: GearIsolateKind | null = null;
  /** Which piece of the isolated kind: −1 = all of the kind, else that index only. */
  private _isolateIndex = -1;

  setCarve(on: boolean): void {
    this._carve = on;
    this._applyDebugVisibility();
  }

  /** Isolate one piece kind (corner / edge gear / center) — the user's "keep one
   *  block, carve the rest" view. `index` −1 shows the whole kind; 0…n−1 shows just
   *  that one piece (indexed by stable pieceId — in solved state pieceId k sits at
   *  slot k). Carve and isolate both drive pivot.visible, so BOTH funnel through
   *  _applyDebugVisibility as a union (start all-visible, isolate hides the other
   *  kinds + the non-picked pieces, carve then hides the U-layer group on top) —
   *  neither stomps the other's state. */
  setIsolate(kind: GearIsolateKind | null, index = -1): void {
    this._isolate = kind;
    this._isolateIndex = index;
    this._applyDebugVisibility();
  }

  private _applyDebugVisibility(): void {
    const iso = this._isolate;
    const idx = this._isolateIndex;
    // per-kind "is piece i visible": the kind must match (or no isolation), AND
    // when a single index is picked only that piece of the kind shows.
    const show = (kind: GearIsolateKind, i: number): boolean =>
      iso === null || (iso === kind && (idx < 0 || idx === i));
    // 中心块 isolates the whole center-and-core assembly: the 6 center pieces
    // (each with an axle stub reaching inward) PLUS the core. A lone center cap
    // or a bare core reads as nothing on its own — together they are the
    // recognizable internal skeleton (user-merged 中心块 + 骨架 into one option).
    // With a single center index the core stays hidden (one clean center block).
    this.cornerPieces.forEach((p, i) => { p.pivot.visible = show('corner', i); });
    this.centerPieces.forEach((p, i) => { p.pivot.visible = show('center', i); });
    // edge gears are gearPieces[ring][id] (id 0…3 per ring, NOT unique) — flatten to
    // a stable 0…11 index (ring·4 + id) so "第 N 个棱块" picks exactly one of the 12.
    let e = 0;
    for (const ring of this.gearPieces) for (const p of ring) { p.pivot.visible = show('edge', e); e++; }
    this.corePiece.pivot.visible = iso === null || (iso === 'center' && idx < 0) || iso === 'core';
    if (this._carve) {
      for (const s of FACE_CORNER_SLOTS[0]) this.cornerPieces[this.state.cp[s]].pivot.visible = false;
      for (const [r, s] of FACE_GEAR_SLOTS[0]) this.gearPieces[r][this.state.ring[r][s]].pivot.visible = false;
      this.centerPieces[this.state.cent[0]].pivot.visible = false;
    }
    this.dirty = true;
  }

  /** Dispose piece geometries + drop callbacks. Materials are module singletons. */
  dispose(): void {
    this.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry?.dispose();
    });
    this.callbacks.length = 0;
    this.cornerPieces.length = 0;
    this.centerPieces.length = 0;
    this.gearPieces.length = 0;
  }
}
