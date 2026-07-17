/**
 * Gear Cube geometry — pure three.js + CSG builders. No scene/camera concerns.
 *
 * A cube [-H, H]³ with layer cut planes at ±CUT (fat outer layers like the real
 * puzzle, not 3x3 thirds). Pieces:
 *  - 12 EDGE GEARS, two nested parts (photo matched, user-locked):
 *    (a) SPINNING CROWN — 6 ISOSCELES-TRAPEZOID tooth plates (straight radial
 *    legs through the gear center, chord bases, 38° gullets wider than the
 *    22° teeth) tangent to the 45° cone of apex E (edge midpoint) and axis n̂
 *    (outward radial), every plate lifted D0 along its cone normal (plateau
 *    PLATEAU/√2 ≈ 8.5 proud of both faces), plus a palm web filling the
 *    middle. Mod-3 spin phases force this plastic to be 120°-invariant about
 *    n̂; 120° = 2 pitches, so the crown rests identically after every move.
 *    At rest one tooth lies flat over each face (φ = ±90°) and four splay
 *    through the trench openings — 3 TENTACLE TIPS per face half poke out
 *    from under the cap rim, and the per-tooth decals mix colors when
 *    scrambled.
 *    (b) BENT-COIN CAP on the ORBIT pivot — the fat disc "folded 90° over the
 *    edge": two half-discs of radius COIN_R, one parallel to each face,
 *    meeting in a V-groove fold on the arris. It must NOT spin: the fold hugs
 *    the arris at every rest state, but a folded disc is only 180°-symmetric,
 *    so on the real puzzle it is an axle cap the crown whirls under. It
 *    floats COIN_GAP above the teeth's sticker ceiling D_MAX — wholly outside
 *    the cube surface — hence touches nothing, constructively.
 *  - 8 CORNERS: rounded blocks carved by (a) three CROWN-SWEEP LATHES — tight
 *    solids of revolution around the axes containing every crown's whole
 *    spin ∪ orbit sweep (see crownSweepInnerRadius) — and (b) three thin WASHER
 *    rings that carve exactly the center-arms' swept shell. Both constructive:
 *    a turning crown/arm can never touch a corner. One splat sticker per face.
 *  - 6 CENTERS: rounded cap + square sticker + 4 C-shaped spider arms (one toward
 *    each adjacent gear, stickered — the reference front view's brackets). The
 *    arms live entirely inside the washer rings; their radial reach is capped by
 *    the corner-tab shell (see .tmp/gear/GEAR_FRONT_SPEC.md §3/§6).
 *  - CORE: a dark sphere riding the middle slab.
 *
 * Clearance invariants (locked by tests/gear_geometry.test.ts):
 *  - corner/center/core bodies stay inside their move slabs (|coord| ≶ CUT ∓ SEAM);
 *  - crowns + coin caps ⊂ ball(CROWN_BALL) at their edge midpoint, crowns ⊂
 *    their sweep lathe; coin caps float above the D_MAX teeth ceiling and
 *    keep their fold ends radially clear of the corner diagonal;
 *    face-layer and equator crown orbit circles pass ≥ 2·CROWN_BALL + 2 apart
 *    (ball-to-ball suffices — unlike the abandoned 45°-disc wheel model, crowns
 *    hug the arris);
 *  - crowns vs middle caps/arms/axles/core verified by a numeric sweep over the
 *    whole turn with a spin-phase scan (short/long teeth are only 60°-invariant).
 */
import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SIZE } from '../define';
import { CUBE_FILL } from '@/lib/cube-colors';
import { makeSticker, cubeFaceBasis, extrudeOntoFace, roundCorners, offsetInward, polyArea2, type V2 } from '../stickerGeom';

/** Uniform arc-length resample of a closed outline (spacing `s`). */
function resampleClosed(pts: V2[], s: number): V2[] {
  const out: V2[] = [];
  let carry = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = carry;
    while (t < len) {
      out.push([a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]);
      t += s;
    }
    carry = t - len;
  }
  return out;
}

/** Chaikin corner-cutting (¼–¾), `iters` rounds. A convex combination of the
 *  input, so it can never create the needle reversals a setback fillet can —
 *  used for the ray-marched corner outlines (dense, noisy input). */
function chaikinClosed(pts: V2[], iters: number): V2[] {
  let cur = pts;
  for (let k = 0; k < iters; k++) {
    const next: V2[] = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i];
      const b = cur[(i + 1) % cur.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    cur = next;
  }
  return cur;
}
import {
  FACE_AXIS, GEAR_FACE_NAMES, CORNER_POS, CENTER_POS, RING_SLOT_POS,
} from './gearState';

/** Cube half-side (world units). Frames like the other engine cubes (Dino/Heli). */
export const H = SIZE * 2; // 128

// ── dimensions (derived + verified in .tmp/gear/derive4.mjs; spec §6) ──────────────
/** Layer cut planes at ±CUT — fat outer layers (photo-matched), NOT 3x3 thirds. */
export const CUT = 0.25 * H;
/** Half-seam between plane-separated slabs. */
export const SEAM = 2.5;
/** Edge-midpoint distance from the cube center — the crown apex E sits there. */
export const EDGE_R = H * Math.SQRT2;
/** 6 teeth (60° pitch, 3 per face half — user-locked), uniform slant tip
 *  measured from the apex along the facet plates. One spin step (120°) =
 *  2 pitches, so the crown rests identically after every move. */
export const TEETH = 6;
export const TOOTH_TIP = 62;
/** Palm web slant radius (teeth spring from under its rim at TOOTH_ROOT). */
export const WEB_R = 36;
/** Plateau intercept: every crown surface rides the 45° cone t = PLATEAU − rad
 *  (t along n̂, rad ⊥ n̂), i.e. all plates are lifted D0 = PLATEAU/√2 along
 *  their cone normals and the crown sits PLATEAU/√2 ≈ 8.5 proud of each face. */
export const PLATEAU = 12;
export const D0 = PLATEAU / Math.SQRT2;
/** Plate thickness (below the plateau surface, along the facet normal). */
export const PLATE_T = 7;
const STICKER_LIFT = 0.5;
const STICKER_DEPTH = 2.6;
/** Depth window of the whole crown slab along its facet normals. */
const D_MIN = D0 - PLATE_T;
const D_MAX = D0 + STICKER_LIFT + STICKER_DEPTH;
/** Bent-coin cap: hover gap above the teeth ceiling D_MAX, slab thickness,
 *  half-disc radius (= fold half-length; face reach is COIN_R − cap top). */
export const COIN_GAP = 0.6;
export const COIN_T = 4;
export const COIN_R = 59;
/** Ball bound of a whole crown around its edge midpoint E. */
export const CROWN_BALL = Math.hypot(TOOTH_TIP, Math.max(Math.abs(D_MIN), D_MAX)) + 1.5;
/** Crown sweep lathe. During a turn the crown both orbits (any angle) and spins
 *  (any phase), so the swept solid about the turn axis is the revolve of the
 *  crown's own SPIN-swept shell. That shell is axisymmetric about the spin axis
 *  n̂: points E + a·ĝ(φ) + d·m̂(φ) with a ∈ [0, TOOTH_TIP], d ∈ [D_MIN, D_MAX].
 *  In (ρ = dist from n̂, h = depth along −n̂ from E) that is ρ = (a+d)/√2,
 *  h = (a−d)/√2 — a 45° cone shell. Revolved about the turn axis (E sits at
 *  horizontal radius EDGE_R, |along| = ρ·|sinφ| ≤ ρ):
 *    min rad(along) = EDGE_R − h_max         while along ≤ (TOOTH_TIP + D_MIN)/√2
 *                   = EDGE_R − (TOOTH_TIP·√2 − along)  beyond (the d > D_MIN lid)
 *  Corners are carved by exactly this lathe + 1u margin (constructive: a
 *  turning crown can never touch a corner) — far tighter than a ball tube,
 *  which is what keeps the corner plates reference-matched full. */
export const SWEEP_RHO = (TOOTH_TIP + D_MAX) / Math.SQRT2;  // max |along|
const SWEEP_H = (TOOTH_TIP - D_MIN) / Math.SQRT2;           // deepest reach from the arris
const SWEEP_RHO0 = (TOOTH_TIP + D_MIN) / Math.SQRT2;        // where the deep flat ends
export const SWEEP_WALL = 1.5;                              // side margin of the carve
export function crownSweepInnerRadius(along: number): number {
  const a = Math.min(Math.abs(along), SWEEP_RHO);
  const h = a <= SWEEP_RHO0 ? SWEEP_H : TOOTH_TIP * Math.SQRT2 - a;
  return EDGE_R - h - 1;
}
/** Core sphere + center cap sizes (inside the middle slab). */
export const CORE_R = 0.21 * H;
export const CAP_HALF = 0.19 * H;
const CAP_T = 12;
/** Center spider arms — the reference front view's C-brackets between the cap and
 *  each gear. They belong to the CENTER piece (an edge-mounted plate would sweep
 *  through other pieces mid-turn — refuted numerically in .tmp/gear/derive3.mjs).
 *  Their whole swept shell is carved out of the corners by the washer rings. */
export const ARM_R0 = 0.30 * H;   // feet inner edge (radial, from face center)
export const ARM_R1 = 0.375 * H;  // bar outer edge — capped by the corner tab shell
export const ARM_S = 24;          // tangent half-width
export const ARM_SFOOT = 12;      // feet span |s| ∈ [ARM_SFOOT, ARM_S]
export const ARM_BAR = 44;        // feet→bar radial boundary
export const ARM_D = 5;           // plate depth below the surface
const ARM_LIFT = 3.5;             // sticker top above the surface
/** Washer rings (one per axis) that carve the arms' swept shell out of the corners:
 *  revolve of the rectangle {radius ∈ [WASHER_IN, WASHER_OUT], |along| ≤ WASHER_Y}. */
export const WASHER_IN = 120;
export const WASHER_OUT = 135;
export const WASHER_Y = ARM_R1 + ARM_LIFT + 2.5;

const BODY_COLOR = 0x141414;

const bodyMat = new THREE.MeshPhongMaterial({
  color: BODY_COLOR, specular: 0x222222, shininess: 25, side: THREE.DoubleSide,
});
const coreMat = new THREE.MeshPhongMaterial({ color: 0x0d0d0d, specular: 0x111111, shininess: 10 });

const stickerMats = new Map<string, THREE.MeshPhongMaterial>();
function stickerMat(face: string): THREE.MeshPhongMaterial {
  let m = stickerMats.get(face);
  if (!m) {
    m = new THREE.MeshPhongMaterial({
      color: parseInt(CUBE_FILL[face as keyof typeof CUBE_FILL].replace('#', ''), 16),
      specular: 0x444444, shininess: 60, side: THREE.DoubleSide,
    });
    stickerMats.set(face, m);
  }
  return m;
}

const V = (a: readonly [number, number, number]): THREE.Vector3 => new THREE.Vector3(a[0], a[1], a[2]);

/** Outward radial unit axis of gear slot (r,s) — the crown's spin axis. */
export function gearSlotAxis(r: number, s: number): THREE.Vector3 {
  return V(RING_SLOT_POS[r][s]).normalize();
}

/** Crown apex = the edge midpoint of gear slot (r,s). */
export function gearSlotApex(r: number, s: number): THREE.Vector3 {
  return V(RING_SLOT_POS[r][s]).multiplyScalar(H);
}

/** The 2 face indices a gear slot touches (dot > 0). */
export function gearSlotFaces(r: number, s: number): number[] {
  const p = RING_SLOT_POS[r][s];
  return FACE_AXIS.map((_, f) => f).filter((f) =>
    FACE_AXIS[f][0] * p[0] + FACE_AXIS[f][1] * p[1] + FACE_AXIS[f][2] * p[2] > 0);
}

// ── crown tooth shape (per-tooth, in facet-plane coords around the apex) ────────────
/** Each tooth is an ISOSCELES TRAPEZOID (user-locked): straight radial legs whose
 *  extensions pass through the gear center, straight chord bases at TOOTH_ROOT and
 *  the tip. Teeth are 22° wide with 38° gullets, so the gap between neighbours is
 *  wider than either base at every radius (gap chord 2r·sin19° > base 2r·sin11°). */
export const TOOTH_HALF_ANG = (11 * Math.PI) / 180;
export const TOOTH_ROOT = 30;
/** The 4 trapezoid corners in (ŵ, ĝ) facet coords, CCW. */
export function toothTrapezoid(tip: number): V2[] {
  const s = Math.sin(TOOTH_HALF_ANG), c = Math.cos(TOOTH_HALF_ANG);
  return [
    [-tip * s, tip * c],
    [-TOOTH_ROOT * s, TOOTH_ROOT * c],
    [TOOTH_ROOT * s, TOOTH_ROOT * c],
    [tip * s, tip * c],
  ];
}

/** In-plane basis of gear slot (r,s): ê = edge direction (the slot's zero axis),
 *  t̂ = r̂ × ê. Crown polar angle 0 = ê, 90° = t̂. */
export function gearSlotBasis(r: number, s: number): { e: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3 } {
  const p = RING_SLOT_POS[r][s];
  const n = gearSlotAxis(r, s);
  const freeAxis = p[0] === 0 ? 0 : p[1] === 0 ? 1 : 2;
  const e = new THREE.Vector3().setComponent(freeAxis, 1);
  const t = new THREE.Vector3().crossVectors(n, e);
  return { e, t, n };
}

/** Polar angle of face f's window on gear slot (r,s) — where that face's outward
 *  axis projects into the crown plane (always ±90°). */
export function gearWindowAngle(r: number, s: number, face: number): number {
  const { e, t, n } = gearSlotBasis(r, s);
  const fn = V(FACE_AXIS[face]);
  const inPlane = fn.clone().sub(n.clone().multiplyScalar(fn.dot(n)));
  return Math.atan2(inPlane.dot(t), inPlane.dot(e));
}

/** Facet frame of tooth k (k = 0..5, tooth center at φ = 90° + k·60°): m̂ = outer
 *  plate normal (tangent to the 45° cone), ĝ = down-the-facet from the apex,
 *  ŵ = m̂ × ĝ. For k = 0 and k = 3, m̂ is exactly the two face normals. */
export function gearFacetFrame(r: number, s: number, k: number): { m: THREE.Vector3; g: THREE.Vector3; w: THREE.Vector3 } {
  const { e, t, n } = gearSlotBasis(r, s);
  const phi = Math.PI / 2 + k * ((2 * Math.PI) / TEETH);
  const u = e.clone().multiplyScalar(Math.cos(phi)).addScaledVector(t, Math.sin(phi));
  const m = u.clone().add(n).normalize();
  const g = u.clone().sub(n).normalize();
  const w = new THREE.Vector3().crossVectors(m, g);
  return { m, g, w };
}

export interface GearPieceHandle {
  /** Orbit pivot (origin) — rotated by face/middle turns. */
  pivot: THREE.Object3D;
  /** Spin pivot (origin, child of pivot) — rotated about the slot's radial axis
   *  (which passes through the apex E, so the crown spins in place). */
  spin: THREE.Object3D;
  group: THREE.Group;
}

/** Build gear piece for HOME slot (r,s): umbrella crown + per-tooth decals. */
export function buildGearPiece(r: number, s: number): GearPieceHandle {
  const pivot = new THREE.Object3D();
  const spin = new THREE.Object3D();
  const group = new THREE.Group();
  group.userData.gearPiece = { type: 'gear', ring: r, id: s };
  pivot.add(spin);
  spin.add(group);

  const { e, t, n } = gearSlotBasis(r, s);
  const E = gearSlotApex(r, s);
  const pitch = (2 * Math.PI) / TEETH;

  // which face colors the sin>0 / sin<0 teeth and palm sectors (no tooth ever
  // sits at φ = 0/180°: centers are 90° + k·60°, so sin never vanishes)
  const faces = gearSlotFaces(r, s);
  const facePlus = faces.find((f) => Math.sin(gearWindowAngle(r, s, f)) > 0)!;
  const faceMinus = faces.find((f) => f !== facePlus)!;
  const toothFace = (k: number): number =>
    Math.sin(Math.PI / 2 + k * pitch) > 0 ? facePlus : faceMinus;

  for (let k = 0; k < TEETH; k++) {
    const { m, g, w } = gearFacetFrame(r, s, k);
    // tooth plate = the isosceles trapezoid in (ŵ, ĝ) facet coords, lifted D0
    // along the cone normal so the whole crown rides the plateau cone
    const poly = toothTrapezoid(TOOTH_TIP);
    const ccw = polyArea2(poly) > 0 ? poly : poly.slice().reverse();
    const shape = new THREE.Shape(ccw.map(([a, b]) => new THREE.Vector2(a, b)));
    const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: PLATE_T, bevelEnabled: false });
    plateGeo.applyMatrix4(new THREE.Matrix4().makeBasis(w, g, m)
      .setPosition(E.clone().add(m.clone().multiplyScalar(D0 - PLATE_T))));
    const plate = new THREE.Mesh(plateGeo, bodyMat);
    plate.userData.simRole = 'body';
    group.add(plate);

    // per-tooth decal (rides the spinning tooth — scrambled fans mix colors);
    // small round then inset keeps the narrow root end positive-radius
    const face = toothFace(k);
    const decal = offsetInward(roundCorners(ccw, 1.2), 0.8);
    const decalGeo = extrudeOntoFace(decal,
      { u: w, v: g, n: m, origin: E.clone().add(m.clone().multiplyScalar(D0 + STICKER_LIFT)) },
      STICKER_DEPTH);
    group.add(makeSticker(decalGeo, stickerMat(GEAR_FACE_NAMES[face]), bodyMat, {
      simStickerNormal: V(FACE_AXIS[face]),
    }));
  }

  // palm web: full-revolution frustum of the plateau cone out to WEB_R (the
  // teeth spring from under its rim), PLATE_T·√2 thick along n̂. Lathe profile
  // in (rad ⊥ n̂, y ∥ n̂) — CCW loop (see cornerCarves for the winding gotcha).
  const rimRad = (WEB_R + D0) / Math.SQRT2;
  const webTop = (rad: number): number => PLATEAU - rad;
  const webBot = (rad: number): number => PLATEAU - PLATE_T * Math.SQRT2 - rad;
  const latheBasis = new THREE.Matrix4().makeBasis(t, n, e).setPosition(E);
  const webProfile = [
    new THREE.Vector2(0.01, webBot(0.01)),
    new THREE.Vector2(rimRad, webBot(rimRad)),
    new THREE.Vector2(rimRad, webTop(rimRad)),
    new THREE.Vector2(0.01, webTop(0.01)),
  ];
  webProfile.push(webProfile[0].clone());
  const webGeo = new THREE.LatheGeometry(webProfile, 48);
  webGeo.applyMatrix4(latheBasis);
  const web = new THREE.Mesh(webGeo, bodyMat);
  web.userData.simRole = 'body';
  group.add(web);

  // BENT-COIN CAP — the real puzzle's fat disc "folded 90° over the edge": two
  // half-discs, one parallel to each face, meeting in a V-groove fold on the
  // arris. Mounted on the ORBIT pivot, NOT the spin pivot: the fold must hug
  // the arris at every rest state, but a folded disc is only 180°-symmetric
  // while spin phases are mod 3 — on the real puzzle it is an axle cap the
  // crown whirls under. Clearance is constructive: every cap point floats
  // COIN_GAP above the teeth's sticker ceiling D_MAX along its own face
  // normal (wholly outside the cube surface), so the spinning crown — whose
  // points all sit ≤ D_MAX proud of both faces — can never touch it. The
  // tooth tips poke out from under the rim: 3 tentacles per face half.
  const coinGroup = new THREE.Group();
  coinGroup.userData.gearPiece = { type: 'gear', ring: r, id: s };
  const coinBot = D_MAX + COIN_GAP;
  const coinTop = coinBot + COIN_T;
  const FOLD_IN = 0.45; // halves stop short of the diameter — the walls tuck
                        // inside each other's slab (no coplanar z-fighting)
                        // leaving a thin V-groove that reads as the fold line
  const psiM = Math.acos(FOLD_IN / COIN_R);
  const halfDisc: V2[] = [];
  for (let i = 0; i <= 40; i++) {
    const psi = -psiM + (2 * psiM * i) / 40;
    halfDisc.push([COIN_R * Math.sin(psi), COIN_R * Math.cos(psi)]);
  }
  const ccwDisc = polyArea2(halfDisc) > 0 ? halfDisc : halfDisc.slice().reverse();
  for (const face of [facePlus, faceMinus]) {
    const other = face === facePlus ? faceMinus : facePlus;
    const fHat = V(FACE_AXIS[face]);   // this half's face normal
    const hHat = V(FACE_AXIS[other]);  // toward the fold ridge (in-plane)
    const vDown = hHat.clone().negate();
    const uHat = face === facePlus ? e.clone() : e.clone().negate(); // keep right-handed
    const shape = new THREE.Shape(ccwDisc.map(([a, b]) => new THREE.Vector2(a, b)));
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: COIN_T, bevelEnabled: false });
    slabGeo.applyMatrix4(new THREE.Matrix4().makeBasis(uHat, vDown, fHat)
      .setPosition(E.clone().addScaledVector(fHat, coinBot).addScaledVector(hHat, coinTop)));
    const slab = new THREE.Mesh(slabGeo, bodyMat);
    slab.userData.simRole = 'body';
    coinGroup.add(slab);
    const stGeo = extrudeOntoFace(offsetInward(ccwDisc, 0.9),
      { u: uHat, v: vDown, n: fHat, origin: E.clone().addScaledVector(fHat, coinTop + STICKER_LIFT).addScaledVector(hHat, coinTop) },
      STICKER_DEPTH);
    coinGroup.add(makeSticker(stGeo, stickerMat(GEAR_FACE_NAMES[face]), bodyMat, {
      simStickerNormal: fHat.clone(),
    }));
  }
  pivot.add(coinGroup);

  // backing cone filling the slot throat behind the web
  const coneL = 34;
  const coneGeo = new THREE.ConeGeometry(coneL, coneL, 24, 1, false);
  coneGeo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
  const cone = new THREE.Mesh(coneGeo, bodyMat);
  cone.position.copy(E.clone().sub(n.clone().multiplyScalar(2 + coneL / 2)));
  cone.userData.simRole = 'body';
  group.add(cone);

  return { pivot, spin, group };
}

// ── corners (CSG: rounded box − 3 edge tori − 3 arm washers) ────────────────────────
let carveBrushes: Brush[] | null = null;
function cornerCarves(ev: Evaluator): Brush[] {
  if (carveBrushes) return carveBrushes;
  const brushes: Brush[] = [];
  const SWEEP_TOP = SWEEP_RHO + SWEEP_WALL;
  for (const axis of [0, 1, 2]) {
    // crown sweep lathe: closed profile loop (inner edge follows
    // crownSweepInnerRadius, outer edge safely outside the cube), revolved
    // about this axis. LatheGeometry revolves about local Y. The loop MUST
    // wind CCW in the (r, y) half-plane — bottom out, up the outer wall, top
    // in, down the inner wall — or the brush is inside-out and the CSG
    // subtraction sprays sliver shards over the corner.
    const profile: THREE.Vector2[] = [];
    const N = 24;
    profile.push(new THREE.Vector2(200, -SWEEP_TOP), new THREE.Vector2(200, SWEEP_TOP));
    for (let i = 0; i <= N; i++) {
      const t = SWEEP_TOP - (2 * SWEEP_TOP * i) / N;
      profile.push(new THREE.Vector2(crownSweepInnerRadius(t), t));
    }
    profile.push(profile[0].clone());
    const latheGeo = new THREE.LatheGeometry(profile, 96);
    if (axis === 0) latheGeo.rotateZ(Math.PI / 2);       // revolve axis y → x
    else if (axis === 2) latheGeo.rotateX(Math.PI / 2);  // → z
    const lathe = new Brush(latheGeo);
    lathe.updateMatrixWorld();
    brushes.push(lathe);
    // washer ring: revolve of the arm-sweep rectangle about this axis
    const outer = new Brush(new THREE.CylinderGeometry(WASHER_OUT, WASHER_OUT, 2 * WASHER_Y, 48));
    outer.updateMatrixWorld();
    const inner = new Brush(new THREE.CylinderGeometry(WASHER_IN, WASHER_IN, 2 * WASHER_Y + 4, 48));
    inner.updateMatrixWorld();
    let ring = ev.evaluate(outer, inner, SUBTRACTION);
    const ringGeo = ring.geometry;
    if (axis === 0) ringGeo.rotateZ(Math.PI / 2);        // cylinder axis y → x
    else if (axis === 2) ringGeo.rotateX(Math.PI / 2);   // → z
    ring = new Brush(ringGeo);
    ring.updateMatrixWorld();
    brushes.push(ring);
  }
  carveBrushes = brushes;
  return brushes;
}

/** Is `p` inside the crown-sweep lathe about `axis` (0=x,1=y,2=z), inflated m? */
export function inCrownSweep(p: THREE.Vector3, axis: number, m: number): boolean {
  const along = Math.abs(axis === 0 ? p.x : axis === 1 ? p.y : p.z);
  if (along > SWEEP_RHO + SWEEP_WALL + m) return false;
  const rad = axis === 0 ? Math.hypot(p.y, p.z) : axis === 1 ? Math.hypot(p.x, p.z) : Math.hypot(p.x, p.y);
  return rad > crownSweepInnerRadius(along) - m;
}

const BITE_INSET = 3;      // sticker stays this far outside the carved bite
const STICKER_EDGE_IN = 4; // sticker inset from block borders

/** FISH corner sticker (the real cube's die-cut sticker shape, traced from the
 *  site icon `unofficial/gear.svg`): head block hugging the cube corner, two
 *  tail prongs pointing at the face center with a notch between, symmetric
 *  about the quadrant diagonal. Coordinates are (inward-a, inward-b) distances
 *  from the cube corner, in world units (icon × 256/440). */
const FISH_REL: V2[] = [
  [0, 36.7], [0, 0], [36.7, 0],
  [41, 9], [52.4, 19.8], [78.3, 39],
  [59.4, 46], [51.8, 51.8], [46, 59.4],
  [39, 78.3], [19.8, 52.4], [9, 41],
];

/** Fish sticker outline for corner `ci` on face `face` — the FISH_REL polygon
 *  anchored at the block's outer vertex, auto-shrunk until every vertex clears
 *  the carve bites (probed with the same predicate that bounds the plastic).
 *  Returned in cubeFaceBasis(face) (u,v) coordinates, CCW. Exported for the
 *  max-turn-angle regression test (needle spikes = 120–180° reversals that a
 *  visual check misses — see tests/gear_geometry.test.ts). */
export function cornerStickerOutline(ci: number, face: number): { outline: V2[]; basis: { u: THREE.Vector3; v: THREE.Vector3; n: THREE.Vector3; origin: THREE.Vector3 } } {
  const signs = CORNER_POS[ci];
  const n = V(FACE_AXIS[face]);
  const { u, v } = cubeFaceBasis(FACE_AXIS[face] as unknown as number[]);
  const lift = H + STICKER_LIFT;
  const p3 = new THREE.Vector3();
  const at = (a: number, b: number, h: number): THREE.Vector3 =>
    p3.copy(n).multiplyScalar(h).addScaledVector(u, a).addScaledVector(v, b);
  const inPlaneAxes = [0, 1, 2].filter((ax) => FACE_AXIS[face][ax] === 0);
  const inside = (a: number, b: number): boolean => {
    for (const h of [lift, H - 6]) { // sticker plane + a body probe (washers carve deeper)
      const p = at(a, b, h);
      for (const ax of inPlaneAxes) {
        const c = ax === 0 ? p.x : ax === 1 ? p.y : p.z;
        const sc = c * signs[ax]; // toward this corner = positive
        if (sc < CUT + SEAM + STICKER_EDGE_IN || sc > H - STICKER_EDGE_IN) return false;
        if (inCrownSweep(p, ax, BITE_INSET)) return false;
        const rad = ax === 0 ? Math.hypot(p.y, p.z) : ax === 1 ? Math.hypot(p.x, p.z) : Math.hypot(p.x, p.y);
        if (rad > WASHER_IN - BITE_INSET && rad < WASHER_OUT + BITE_INSET && Math.abs(c) < WASHER_Y + BITE_INSET) return false;
      }
    }
    return true;
  };
  // anchor at the outer vertex corner of the plate
  const vert = new THREE.Vector3(signs[0], signs[1], signs[2]).multiplyScalar(H - STICKER_EDGE_IN - 3);
  const a0 = vert.dot(u);
  const b0 = vert.dot(v);
  const sgnA = Math.sign(a0), sgnB = Math.sign(b0);
  // shrink until the whole fish clears the bites (vertices + edge midpoints)
  for (const s of [0.8, 0.74, 0.68, 0.62, 0.56, 0.5]) {
    const poly: V2[] = FISH_REL.map(([ra, rb]) => [a0 - sgnA * ra * s, b0 - sgnB * rb * s]);
    const ccw = polyArea2(poly) > 0 ? poly : poly.slice().reverse();
    const outline = resampleClosed(roundCorners(ccw, 4), 4);
    if (outline.every(([a, b]) => inside(a, b))) {
      return {
        outline: chaikinClosed(outline, 1),
        basis: { u, v, n, origin: n.clone().multiplyScalar(lift) },
      };
    }
  }
  // dimensions that swallow even the smallest fish are a layout bug — test-locked
  throw new Error('gear corner fish sticker does not fit');
}

export function buildCornerPiece(ci: number, ev: Evaluator): { pivot: THREE.Object3D; group: THREE.Group } {
  const pivot = new THREE.Object3D();
  const group = new THREE.Group();
  group.userData.gearPiece = { type: 'corner', id: ci };
  pivot.add(group);

  const signs = CORNER_POS[ci];
  const lo = CUT + SEAM;
  const L = H - lo;
  const boxGeo = new RoundedBoxGeometry(L, L, L, 3, 7);
  boxGeo.translate(signs[0] * (lo + L / 2), signs[1] * (lo + L / 2), signs[2] * (lo + L / 2));
  let brush: Brush = new Brush(boxGeo);
  brush.updateMatrixWorld();
  for (const carve of cornerCarves(ev)) brush = ev.evaluate(brush, carve, SUBTRACTION);
  const body = new THREE.Mesh(brush.geometry.clone(), bodyMat);
  body.userData.simRole = 'body';
  group.add(body);

  for (const face of FACE_AXIS.map((_, f) => f).filter((f) =>
    FACE_AXIS[f][0] * signs[0] + FACE_AXIS[f][1] * signs[1] + FACE_AXIS[f][2] * signs[2] > 0)) {
    const { outline, basis } = cornerStickerOutline(ci, face);
    const geo = extrudeOntoFace(outline, basis, STICKER_DEPTH);
    group.add(makeSticker(geo, stickerMat(GEAR_FACE_NAMES[face]), bodyMat, {
      simStickerNormal: V(FACE_AXIS[face]),
    }));
  }
  return { pivot, group };
}

// ── centers ─────────────────────────────────────────────────────────────────────────
export function buildCenterPiece(f: number): { pivot: THREE.Object3D; group: THREE.Group } {
  const pivot = new THREE.Object3D();
  const group = new THREE.Group();
  group.userData.gearPiece = { type: 'center', id: f };
  pivot.add(group);

  const n = V(FACE_AXIS[f]);
  const { u, v } = cubeFaceBasis(FACE_AXIS[f] as unknown as number[]);
  const capGeo = new RoundedBoxGeometry(CAP_HALF * 2, CAP_HALF * 2, CAP_T, 2, 4);
  capGeo.applyMatrix4(new THREE.Matrix4().makeBasis(u, v, n)
    .setPosition(n.clone().multiplyScalar(H - CAP_T / 2)));
  const cap = new THREE.Mesh(capGeo, bodyMat);
  cap.userData.simRole = 'body';
  group.add(cap);

  // axle stub from just outside the core out to the cap (the spider arm — visible
  // through the carve view + the face gaps). Penetration-free by construction: the
  // core SPHERE is invariant under every rotation about the origin, the axle is
  // symmetric about its own axis, its cross-section stays deep inside the middle
  // slab, and perpendicular axles' sweeps never reach each other's |coord| ≥ start.
  const axleStart = CORE_R + 1;
  const axleLen = H - CAP_T - axleStart + 4;
  const axleGeo = new THREE.CylinderGeometry(5.5, 5.5, axleLen, 16);
  axleGeo.translate(0, axleStart + axleLen / 2, 0);
  axleGeo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
  const axle = new THREE.Mesh(axleGeo, coreMat);
  axle.userData.simRole = 'core';
  group.add(axle);

  const inset = CAP_HALF - 4;
  const sq: V2[] = [[inset, inset], [-inset, inset], [-inset, -inset], [inset, -inset]];
  const outline = roundCorners(polyArea2(sq) > 0 ? sq : sq.reverse(), 8);
  const geo = extrudeOntoFace(outline, { u, v, n, origin: n.clone().multiplyScalar(H + STICKER_LIFT) }, STICKER_DEPTH);
  group.add(makeSticker(geo, stickerMat(GEAR_FACE_NAMES[f]), bodyMat, {
    simStickerNormal: n.clone(),
  }));

  // 4 spider arms, one toward each adjacent gear: C-shaped plate (outer bar + two
  // feet) opening toward the cap, plus a matching sticker. (r, s) = (radial from
  // face center toward the gear, tangent along the edge).
  const armPoly: V2[] = [
    [ARM_R1, -ARM_S], [ARM_R1, ARM_S], [ARM_R0, ARM_S], [ARM_R0, ARM_SFOOT],
    [ARM_BAR, ARM_SFOOT], [ARM_BAR, -ARM_SFOOT], [ARM_R0, -ARM_SFOOT], [ARM_R0, -ARM_S],
  ];
  for (const [ru, rv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rHat = u.clone().multiplyScalar(ru).add(v.clone().multiplyScalar(rv));
    const eHat = new THREE.Vector3().crossVectors(n, rHat);
    const mapped: V2[] = armPoly.map(([r, s]) => {
      const p = rHat.clone().multiplyScalar(r).addScaledVector(eHat, s);
      return [p.dot(u), p.dot(v)];
    });
    const ccw = polyArea2(mapped) > 0 ? mapped : mapped.slice().reverse();
    const rounded = roundCorners(ccw, 4);
    const bodyShape = new THREE.Shape(rounded.map(([a, b]) => new THREE.Vector2(a, b)));
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: ARM_D, bevelEnabled: false });
    bodyGeo.applyMatrix4(new THREE.Matrix4().makeBasis(u, v, n)
      .setPosition(n.clone().multiplyScalar(H - ARM_D)));
    const armBody = new THREE.Mesh(bodyGeo, bodyMat);
    armBody.userData.simRole = 'body';
    group.add(armBody);
    const stickerOutline = offsetInward(roundCorners(ccw, 5), 2);
    const armSticker = extrudeOntoFace(stickerOutline,
      { u, v, n, origin: n.clone().multiplyScalar(H + STICKER_LIFT) }, STICKER_DEPTH);
    group.add(makeSticker(armSticker, stickerMat(GEAR_FACE_NAMES[f]), bodyMat, {
      simStickerNormal: n.clone(),
    }));
  }
  return { pivot, group };
}

// ── core ────────────────────────────────────────────────────────────────────────────
export function buildCore(): { pivot: THREE.Object3D; group: THREE.Group } {
  const pivot = new THREE.Object3D();
  const group = new THREE.Group();
  group.userData.gearPiece = { type: 'core', id: 0 };
  pivot.add(group);
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(CORE_R, 3), coreMat);
  mesh.userData.simRole = 'core';
  group.add(mesh);
  return { pivot, group };
}

export { CENTER_POS };
