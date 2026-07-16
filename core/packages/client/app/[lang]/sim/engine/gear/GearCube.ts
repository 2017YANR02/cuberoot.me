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
 *
 * One move (face f, amt): face layer −amt·180° about the face axis, middle slab
 * (4 centers + core + the equator ring's 4 gears) −amt·90°, equator gears ALSO spin
 * +amt·480° about their outward radials (net +amt·120°, matching the mod-3 spin
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
   *  −amt·π/2, equator-gear spins +amt·π/3), pieces read off the LIVE state. */
  beginMove(move: GearMove): PieceAnim[] {
    const f = move.face;
    const n = _axis.set(FACE_AXIS[f][0], FACE_AXIS[f][1], FACE_AXIS[f][2]);
    const anims: PieceAnim[] = [];
    const faceAngle = -move.amt * Math.PI;
    const midAngle = -move.amt * (Math.PI / 2);
    // 480° per 180° flip (issue #32): the real puzzle's gearing whirls the
    // equator gears a full extra revolution — net 120° (mod 360°), which is
    // what the mod-3 spin phase renders (3 flips → 360° → visually solved;
    // a 60°-per-flip render desyncs from the discrete state at phase 0).
    // applyAnimFrame interpolates axis·angle, so angles > 2π animate fully.
    const spinAngle = move.amt * (8 * Math.PI / 3);
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
   *  gears + the U center) to reveal the middle slab + core. OFF restores all. */
  setCarve(on: boolean): void {
    if (on) {
      for (const s of FACE_CORNER_SLOTS[0]) this.cornerPieces[this.state.cp[s]].pivot.visible = false;
      for (const [r, s] of FACE_GEAR_SLOTS[0]) this.gearPieces[r][this.state.ring[r][s]].pivot.visible = false;
      this.centerPieces[this.state.cent[0]].pivot.visible = false;
    } else {
      for (const p of this.cornerPieces) p.pivot.visible = true;
      for (const p of this.centerPieces) p.pivot.visible = true;
      for (const ring of this.gearPieces) for (const p of ring) p.pivot.visible = true;
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
