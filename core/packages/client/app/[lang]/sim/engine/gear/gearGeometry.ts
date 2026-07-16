/**
 * Gear Cube geometry — pure three.js + CSG builders. No scene/camera concerns.
 *
 * A cube [-H, H]³ with layer cut planes at ±CUT (fat outer layers like the real
 * puzzle, not 3x3 thirds). Pieces:
 *  - 12 EDGE GEARS: a toothed wheel whose axis is the slot's outward RADIAL direction
 *    (through the cube edge midpoint) and whose plane contains the edge direction —
 *    teeth march along the edge, poking slightly proud of the two adjacent faces
 *    (the real Gear Cube is not a perfect cube at rest; its arris is replaced by the
 *    gear zigzag). Two tooth-contoured splat stickers per gear, diametrically
 *    opposite, one per adjacent face (colored fingers over the ~4 front-visible teeth).
 *  - 8 CORNERS: rounded blocks with three concave channel bites (CSG: box − three
 *    tori). The bite torus for a ring = the tube swept by that ring's gears (wheel ⊂
 *    ball of radius R_BALL around its center, orbit+spin ⊂ tube around the ring
 *    circle), so a turning gear NEVER penetrates a corner — constructive, with
 *    R_BITE − R_BALL clearance. One splat-crown sticker per face (outer plate with
 *    concave inner arcs where the bites cross the surface).
 *  - 6 CENTERS: rounded cap + square sticker + 4 C-shaped spider arms (one toward
 *    each adjacent gear, stickered — the reference front view's brackets). The arms
 *    live entirely inside the equator ring's bite tube, so the corner bites that
 *    protect the gears protect the arms too; their radial reach is capped by the
 *    face-layer wheels' sweep curve (see GEAR_FRONT_SPEC.md §3).
 *  - CORE: a dark sphere riding the middle slab.
 *
 * Clearance invariants (locked by tests/gear_geometry.test.ts):
 *  - corner/center/core bodies stay inside their move slabs (|coord| ≶ CUT ∓ SEAM);
 *  - gears are protected by the bite tubes (R_BITE ≥ R_BALL + GAP) instead of slabs;
 *  - face-riding wheels vs equator wheels + wheels vs middle caps/axles/core are
 *    verified by a numeric sweep with real tooth profiles over the whole turn and
 *    all 3×3 spin-phase combos (ball bounds cannot clear wheels this large).
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

// ── dimensions (all verified in .tmp/gear/derive.mjs + locked by the geometry test) ──
/** Layer cut planes at ±CUT — fat outer layers (photo-matched), NOT 3x3 thirds. */
export const CUT = 0.25 * H;
/** Half-seam between plane-separated slabs. */
export const SEAM = 2.5;
/** Gear wheel center = GEAR_B on each of its two nonzero coordinates. 2·GEAR_B − H
 *  is where the wheel's inner teeth pierce the face plane in the front view (the
 *  reference SVG's floating "bridge" fragments near the center). */
export const GEAR_B = 0.72 * H;
/** Wheel thickness along its (radial) axis. */
export const WHEEL_T = 0.22 * H;
/** Tooth tip / root radii + tooth count (12 fat teeth like the real puzzle ⇒ one
 *  60° spin = exactly 2 pitches). R_OUT is at the free-phase clearance ceiling:
 *  face-layer and equator wheels cross mid-turn at ~53u joint radius, and tooth
 *  phases are independent state, so tips must stay below the crossing —
 *  .tmp/gear/derive2.mjs bisects the max clearing radius (0.362H @ margin 1). */
export const R_OUT = 0.345 * H;
export const R_ROOT = 0.215 * H;
export const TEETH = 12;
/** Splat sticker lift + thickness above the tooth contour (rim band). */
export const SPLAT_LIFT = 1.2;
export const SPLAT_THICK = 2.6;
/** Splat cap on the wheel's OUTER disc face (the 45°-outward side — the dominant
 *  visible surface at the arris channel): lift off the face + plate thickness. */
export const SPLAT_SIDE_LIFT = 0.6;
export const SPLAT_SIDE_DEPTH = 2.4;
/** Ball bound of a whole gear (wheel + splat rim band + side cap) around its center. */
export const R_BALL = Math.hypot(
  R_OUT + SPLAT_LIFT + SPLAT_THICK,
  WHEEL_T / 2 + SPLAT_SIDE_LIFT + SPLAT_SIDE_DEPTH,
);
/** Corner bite tube radius (≥ R_BALL + clearance; test-locked). */
export const R_BITE = 0.425 * H;
/** Ring circle radius (gear centers' distance from their ring's axis). */
export const RING_R = GEAR_B * Math.SQRT2;
/** Core sphere + center cap sizes (inside the middle slab). */
export const CORE_R = 0.21 * H;
export const CAP_HALF = 0.19 * H;
const CAP_T = 12;
/** Center spider arms — the reference front view's C-brackets between the cap and
 *  each gear. They belong to the CENTER piece (an edge-mounted plate would sweep
 *  through the equator wheels' bulge mid-turn — refuted numerically in
 *  .tmp/gear/derive3.mjs; the center-arm reading clears every relative motion,
 *  see .tmp/gear/GEAR_FRONT_SPEC.md §3). The whole arm sits inside the equator
 *  ring's bite tube, so the same tori that protect the gears protect the arms
 *  from the corners — constructive, test-locked. */
export const ARM_R0 = 0.30 * H;   // feet inner edge (radial, from face center)
export const ARM_R1 = 0.375 * H;  // bar outer edge — capped by the face-layer
                                  // wheels' sweep reach curve (derive3b check C)
export const ARM_S = 24;          // tangent half-width (corner-tab shell clearance)
export const ARM_SFOOT = 12;      // feet span |s| ∈ [ARM_SFOOT, ARM_S]
export const ARM_BAR = 44;        // feet→bar radial boundary
export const ARM_D = 5;           // plate depth below the surface

const BODY_COLOR = 0x141414;
const STICKER_LIFT = 0.5;
const STICKER_DEPTH = 2.6;

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

/** Outward radial unit axis of gear slot (r,s) — the wheel's spin axis. */
export function gearSlotAxis(r: number, s: number): THREE.Vector3 {
  return V(RING_SLOT_POS[r][s]).normalize();
}

/** Wheel center of gear slot (r,s). */
export function gearSlotCenter(r: number, s: number): THREE.Vector3 {
  return V(RING_SLOT_POS[r][s]).multiplyScalar(GEAR_B);
}

/** The 2 face indices a gear slot touches (dot > 0). */
export function gearSlotFaces(r: number, s: number): number[] {
  const p = RING_SLOT_POS[r][s];
  return FACE_AXIS.map((_, f) => f).filter((f) =>
    FACE_AXIS[f][0] * p[0] + FACE_AXIS[f][1] * p[1] + FACE_AXIS[f][2] * p[2] > 0);
}

// ── gear wheel profile (2D polar, teeth) ────────────────────────────────────────────
/** Wheel radius at polar angle θ: trapezoid teeth between R_ROOT and R_OUT. The
 *  profile is rotated so a tooth is centered at 90° (toward each face window; 12
 *  teeth ⇒ 90°+180° is also a tooth center, and one 60° move = exactly 2 pitches). */
export function wheelRadiusAt(theta: number): number {
  const pitch = (2 * Math.PI) / TEETH;
  // offset so θ = 90° is a tooth center
  let t = ((theta - Math.PI / 2) % pitch + pitch) % pitch; // 0..pitch, 0 = tooth center
  if (t > pitch / 2) t = pitch - t;                         // fold: 0 = tooth center
  const tipHalf = pitch * 0.20;   // flat tip arc
  const flank = pitch * 0.15;     // linear flank
  if (t <= tipHalf) return R_OUT;
  if (t >= tipHalf + flank) return R_ROOT;
  return R_OUT - (R_OUT - R_ROOT) * (t - tipHalf) / flank;
}

const WHEEL_SAMPLES = TEETH * 16;

function wheelProfilePts(lift: number): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < WHEEL_SAMPLES; i++) {
    const a = (i / WHEEL_SAMPLES) * 2 * Math.PI;
    const r = wheelRadiusAt(a) + lift;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/** In-plane basis of gear slot (r,s): ê = edge direction (the slot's zero axis),
 *  t̂ = r̂ × ê. Wheel-plane polar angle 0 = ê, 90° = t̂. */
export function gearSlotBasis(r: number, s: number): { e: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3 } {
  const p = RING_SLOT_POS[r][s];
  const n = gearSlotAxis(r, s);
  const freeAxis = p[0] === 0 ? 0 : p[1] === 0 ? 1 : 2;
  const e = new THREE.Vector3().setComponent(freeAxis, 1);
  const t = new THREE.Vector3().crossVectors(n, e);
  return { e, t, n };
}

/** Polar angle (in the wheel plane) of face f's window on gear slot (r,s) — where
 *  that face's outward axis projects into the wheel plane. */
export function gearWindowAngle(r: number, s: number, face: number): number {
  const { e, t, n } = gearSlotBasis(r, s);
  const fn = V(FACE_AXIS[face]);
  const inPlane = fn.clone().sub(n.clone().multiplyScalar(fn.dot(n)));
  return Math.atan2(inPlane.dot(t), inPlane.dot(e));
}

export interface GearPieceHandle {
  /** Orbit pivot (origin) — rotated by face/middle turns. */
  pivot: THREE.Object3D;
  /** Spin pivot (origin, child of pivot) — rotated about the slot's radial axis. */
  spin: THREE.Object3D;
  group: THREE.Group;
}

/** Build gear piece for HOME slot (r,s): black toothed wheel + 2 colored splats. */
export function buildGearPiece(r: number, s: number): GearPieceHandle {
  const pivot = new THREE.Object3D();
  const spin = new THREE.Object3D();
  const group = new THREE.Group();
  group.userData.gearPiece = { type: 'gear', ring: r, id: s };
  pivot.add(spin);
  spin.add(group);

  const { e, t, n } = gearSlotBasis(r, s);
  const center = gearSlotCenter(r, s);
  const place = (geo: THREE.BufferGeometry, halfDepth: number): void => {
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(e, t, n)
      .setPosition(center.clone().sub(n.clone().multiplyScalar(halfDepth))));
  };

  // wheel body
  const shape = new THREE.Shape(wheelProfilePts(0).map(([x, y]) => new THREE.Vector2(x, y)));
  const wheelGeo = new THREE.ExtrudeGeometry(shape, { depth: WHEEL_T, bevelEnabled: false });
  place(wheelGeo, WHEEL_T / 2);
  const wheel = new THREE.Mesh(wheelGeo, bodyMat);
  wheel.userData.simRole = 'body';
  group.add(wheel);

  // 2 splat stickers per gear, one per face window, colored by the slot's home
  // faces. Each splat = a rim band draped over ~3 teeth (the colored tooth tops)
  // + a flat cap on the wheel's OUTER disc face over the same arc (the dominant
  // visible surface — the photo's "fingers" wrap over the gear onto this side).
  const SPAN = (2 * Math.PI / TEETH) * 4.0; // ~4 teeth — the whole front-visible fan
  const SPLAT_T = WHEEL_T - 9;              // rim band inset from both wheel sides
  const CAP_IN_R = R_ROOT * 0.45;           // side cap reaches down toward the hub
  for (const face of gearSlotFaces(r, s)) {
    const cAng = gearWindowAngle(r, s, face);
    const SEG = 64;
    const mat = stickerMat(GEAR_FACE_NAMES[face]);
    const tag = { simStickerNormal: V(FACE_AXIS[face]) };
    // rim band: between the tooth contour (+lift) and (+lift+thick)
    const outer: V2[] = [];
    const inner: V2[] = [];
    for (let i = 0; i <= SEG; i++) {
      const a = cAng - SPAN / 2 + (i / SEG) * SPAN;
      outer.push([(wheelRadiusAt(a) + SPLAT_LIFT + SPLAT_THICK) * Math.cos(a), (wheelRadiusAt(a) + SPLAT_LIFT + SPLAT_THICK) * Math.sin(a)]);
      inner.push([(wheelRadiusAt(a) + SPLAT_LIFT) * Math.cos(a), (wheelRadiusAt(a) + SPLAT_LIFT) * Math.sin(a)]);
    }
    const bandShape = new THREE.Shape([...outer, ...inner.reverse()].map(([x, y]) => new THREE.Vector2(x, y)));
    const bandGeo = new THREE.ExtrudeGeometry(bandShape, { depth: SPLAT_T, bevelEnabled: false });
    place(bandGeo, SPLAT_T / 2);
    group.add(makeSticker(bandGeo, mat, bodyMat, tag));
    // side cap: toothed outer edge + inner arc, on the outer disc face
    const capPts: V2[] = [];
    for (let i = 0; i <= SEG; i++) {
      const a = cAng - SPAN / 2 + (i / SEG) * SPAN;
      const rr = wheelRadiusAt(a) + SPLAT_LIFT;
      capPts.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
    for (let i = SEG; i >= 0; i--) {
      const a = cAng - SPAN / 2 + (i / SEG) * SPAN;
      capPts.push([CAP_IN_R * Math.cos(a), CAP_IN_R * Math.sin(a)]);
    }
    const capShape = new THREE.Shape(capPts.map(([x, y]) => new THREE.Vector2(x, y)));
    const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: SPLAT_SIDE_DEPTH, bevelEnabled: false });
    // origin on the outer disc face (+W/2 along the axis) + a small lift
    place(capGeo, -(WHEEL_T / 2 + SPLAT_SIDE_LIFT));
    group.add(makeSticker(capGeo, mat, bodyMat, tag));
  }
  return { pivot, spin, group };
}

// ── corners (CSG: rounded box − 3 bite tori) ────────────────────────────────────────
let toriBrushes: Brush[] | null = null;
function biteTori(): Brush[] {
  if (toriBrushes) return toriBrushes;
  toriBrushes = [0, 1, 2].map((axis) => {
    // TorusGeometry lies in the XY plane (axis = z); rotate onto the ring's axis.
    const geo = new THREE.TorusGeometry(RING_R, R_BITE, 48, 128);
    if (axis === 0) geo.rotateX(Math.PI / 2);        // ring about y
    else if (axis === 1) geo.rotateY(Math.PI / 2);   // ring about x
    const b = new Brush(geo);
    b.updateMatrixWorld();
    return b;
  });
  return toriBrushes;
}

/** Distance from a point to ring circle of `axis` (0=y,1=x,2=z — RING_AXIS order). */
export function ringCircleDist(p: THREE.Vector3, axis: number): number {
  const along = axis === 0 ? p.y : axis === 1 ? p.x : p.z;
  const rad = axis === 0 ? Math.hypot(p.x, p.z) : axis === 1 ? Math.hypot(p.y, p.z) : Math.hypot(p.x, p.y);
  return Math.hypot(rad - RING_R, along);
}

const BITE_INSET = 3;      // sticker stays this far outside the carved bite
const STICKER_EDGE_IN = 4; // sticker inset from block borders

/** Splat-crown sticker outline for corner `ci` on face `face`, by star-shaped ray
 *  marching from the block's outer vertex (the bites are the only concavities).
 *  Returned in cubeFaceBasis(face) (u,v) coordinates, CCW. Exported for the
 *  max-turn-angle regression test (needle spikes = 120–180° reversals that a
 *  visual check misses — see tests/gear_geometry.test.ts). */
export function cornerStickerOutline(ci: number, face: number): { outline: V2[]; basis: { u: THREE.Vector3; v: THREE.Vector3; n: THREE.Vector3; origin: THREE.Vector3 } } {
  const signs = CORNER_POS[ci];
  const n = V(FACE_AXIS[face]);
  const { u, v } = cubeFaceBasis(FACE_AXIS[face] as unknown as number[]);
  const lift = H + STICKER_LIFT;
  const p3 = new THREE.Vector3();
  const at = (a: number, b: number): THREE.Vector3 =>
    p3.copy(n).multiplyScalar(lift).addScaledVector(u, a).addScaledVector(v, b);
  const inPlaneAxes = [0, 1, 2].filter((ax) => FACE_AXIS[face][ax] === 0);
  const inside = (a: number, b: number): boolean => {
    const p = at(a, b);
    for (const ax of inPlaneAxes) {
      const c = ax === 0 ? p.x : ax === 1 ? p.y : p.z;
      const sc = c * signs[ax]; // toward this corner = positive
      if (sc < CUT + SEAM + STICKER_EDGE_IN || sc > H - STICKER_EDGE_IN) return false;
      // bite from the ring about this in-plane axis
      const ringAxis = ax === 1 ? 0 : ax === 0 ? 1 : 2; // coord axis → RING_AXIS index
      if (ringCircleDist(p, ringAxis) < R_BITE + BITE_INSET) return false;
    }
    return true;
  };
  // anchor at the outer vertex corner of the plate
  const vert = new THREE.Vector3(signs[0], signs[1], signs[2]).multiplyScalar(H - STICKER_EDGE_IN - 6);
  const a0 = vert.dot(u);
  const b0 = vert.dot(v);
  if (!inside(a0, b0)) {
    // dimensions that carve the anchor away would break the march — test-locked
    throw new Error('gear corner sticker anchor carved away');
  }
  const RAYS = 220;
  const outline: V2[] = [];
  for (let i = 0; i < RAYS; i++) {
    const ang = (i / RAYS) * 2 * Math.PI;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let lo = 0, hi = 4;
    while (hi < 3 * H && inside(a0 + dx * hi, b0 + dy * hi)) { lo = hi; hi *= 1.5; }
    for (let k = 0; k < 28; k++) {
      const mid = (lo + hi) / 2;
      if (inside(a0 + dx * mid, b0 + dy * mid)) lo = mid; else hi = mid;
    }
    outline.push([a0 + dx * lo, b0 + dy * lo]);
  }
  const ccw = polyArea2(outline) > 0 ? outline : outline.slice().reverse();
  return {
    outline: chaikinClosed(resampleClosed(ccw, 5), 2),
    basis: { u, v, n, origin: n.clone().multiplyScalar(lift) },
  };
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
  for (const torus of biteTori()) brush = ev.evaluate(brush, torus, SUBTRACTION);
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
