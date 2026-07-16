/**
 * Gear Cube geometry — pure three.js + CSG builders. No scene/camera concerns.
 *
 * A cube [-H, H]³ with layer cut planes at ±CUT (fat outer layers like the real
 * puzzle, not 3x3 thirds). Pieces:
 *  - 12 EDGE GEARS: an UMBRELLA CROWN folded over the arris (user-verified against
 *    the real puzzle): 6 flat tooth plates, each tangent to the 45° cone whose apex
 *    is the edge midpoint E and whose axis is the slot's outward radial n̂. The two
 *    face-pointing plates (φ = ±90°) lie EXACTLY in the two adjacent face planes —
 *    at rest each half of the gear is a flat half-gear coplanar with its face
 *    (green half with the green corners, white half with the white corners), the
 *    hub dome bulging on the arris. Adjacent plates fold ~41° at the gullet
 *    valleys — a fully-flat half cannot exist: the shape must be invariant under
 *    the 60° spin (one move = one tooth pitch), and only the tangent-plane
 *    umbrella is. One flat decal per tooth plate (3 per face color); decals ride
 *    the spinning teeth, so a scrambled fan shows mixed colors like the real cube.
 *  - 8 CORNERS: rounded blocks carved by (a) three CROWN-SWEEP LATHES — tight
 *    solids of revolution around the axes containing every crown's whole orbit
 *    sweep (each half-fan is a face-flush disc-slab; see crownSweepInnerRadius) —
 *    and (b) three thin WASHER rings that carve exactly the center-arms' swept
 *    shell. Both constructive: a turning crown/arm can never touch a corner.
 *    One splat-crown sticker per face.
 *  - 6 CENTERS: rounded cap + square sticker + 4 C-shaped spider arms (one toward
 *    each adjacent gear, stickered — the reference front view's brackets). The
 *    arms live entirely inside the washer rings; their radial reach is capped by
 *    the corner-tab shell (see .tmp/gear/GEAR_FRONT_SPEC.md §3/§6).
 *  - CORE: a dark sphere riding the middle slab.
 *
 * Clearance invariants (locked by tests/gear_geometry.test.ts):
 *  - corner/center/core bodies stay inside their move slabs (|coord| ≶ CUT ∓ SEAM);
 *  - crowns ⊂ ball(CROWN_BALL) at their edge midpoint AND ⊂ their sweep lathe;
 *    face-layer and equator crown orbit circles pass ≥ 2·CROWN_BALL + 2 apart
 *    (ball-to-ball suffices — unlike the abandoned 45°-disc wheel model, crowns
 *    hug the arris);
 *  - crowns vs middle caps/arms/axles/core verified by a numeric sweep over the
 *    whole turn (the crown shape is 60°-spin invariant, so no phase scan needed).
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
/** Fan tip / gullet radii measured from the apex ALONG the facet plates, and the
 *  tooth count (6 fat teeth ⇒ one 60° spin = exactly 1 pitch — required for the
 *  crown shape to rest identically after every move). */
export const FAN_R = 0.43 * H;
export const FAN_ROOT = 0.30 * H;
export const TEETH = 6;
/** Facet inner arc (hub hole) + the hub dome on the arris + plate thickness. */
export const HUB_R = 15;
export const HUB_DOME_R = 13;
export const PLATE_T = 6;
/** Ball bound of a whole crown around its edge midpoint E. */
export const CROWN_BALL = Math.hypot(FAN_R, PLATE_T) + 1.5;
/** Crown sweep lathe: the crown is a thin face-hugging shell, so the solid it
 *  sweeps when its layer turns is a tight solid of revolution — NOT the fat
 *  ball tube. Each half-fan is a disc-slab flush at a face (in-plane radius
 *  ≤ SWEEP_HALF around the apex, depth down to H − PLATE_T); revolving that
 *  about the turn axis gives, at height `along`, an annulus starting at
 *  crownSweepInnerRadius(along). Corners are carved by exactly this lathe
 *  (constructive: a turning crown can never touch a corner), which keeps the
 *  corner plates fuller than a ball tube would (reference-matched). */
export const SWEEP_HALF = FAN_R + 1;
export function crownSweepInnerRadius(along: number): number {
  const reach = Math.sqrt(Math.max(0, SWEEP_HALF * SWEEP_HALF - along * along));
  return Math.hypot(H - reach, H - PLATE_T - 1) - 1;
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

// ── crown fan profile (per-tooth, fan-polar around the apex) ────────────────────────
/** Fan radius at angle β from the tooth center (one 60° sector per tooth plate):
 *  trapezoid tooth between FAN_ROOT and FAN_R. */
export function fanRadiusAt(beta: number): number {
  const pitch = (2 * Math.PI) / TEETH;
  let b = Math.abs(beta) % pitch;
  if (b > pitch / 2) b = pitch - b;
  const tipHalf = pitch * 0.20;
  const flank = pitch * 0.15;
  if (b <= tipHalf) return FAN_R;
  if (b >= tipHalf + flank) return FAN_ROOT;
  return FAN_R - (FAN_R - FAN_ROOT) * (b - tipHalf) / flank;
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

  const { n } = gearSlotBasis(r, s);
  const E = gearSlotApex(r, s);
  const pitch = (2 * Math.PI) / TEETH;

  // which face colors the sin>0 / sin<0 tooth plates
  const faces = gearSlotFaces(r, s);
  const facePlus = faces.find((f) => Math.sin(gearWindowAngle(r, s, f)) > 0)!;
  const faceMinus = faces.find((f) => f !== facePlus)!;

  const SEG = 48;
  for (let k = 0; k < TEETH; k++) {
    const { m, g, w } = gearFacetFrame(r, s, k);
    // tooth plate polygon in (ŵ, ĝ) facet coords: toothed outer contour + hub arc
    const poly: V2[] = [];
    for (let i = 0; i <= SEG; i++) {
      const beta = -pitch / 2 + (i / SEG) * pitch;
      const rr = fanRadiusAt(beta);
      poly.push([rr * Math.sin(beta), rr * Math.cos(beta)]);
    }
    for (let i = SEG; i >= 0; i--) {
      const beta = -pitch / 2 + (i / SEG) * pitch;
      poly.push([HUB_R * Math.sin(beta), HUB_R * Math.cos(beta)]);
    }
    const ccw = polyArea2(poly) > 0 ? poly : poly.slice().reverse();
    const shape = new THREE.Shape(ccw.map(([a, b]) => new THREE.Vector2(a, b)));
    const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: PLATE_T, bevelEnabled: false });
    plateGeo.applyMatrix4(new THREE.Matrix4().makeBasis(w, g, m)
      .setPosition(E.clone().sub(m.clone().multiplyScalar(PLATE_T))));
    const plate = new THREE.Mesh(plateGeo, bodyMat);
    plate.userData.simRole = 'body';
    group.add(plate);

    // per-tooth decal (rides the spinning tooth — scrambled fans mix colors)
    const face = Math.sin(Math.PI / 2 + k * pitch) > 0 ? facePlus : faceMinus;
    const decal = offsetInward(roundCorners(ccw, 5), 2.2);
    const decalGeo = extrudeOntoFace(decal,
      { u: w, v: g, n: m, origin: E.clone().add(m.clone().multiplyScalar(STICKER_LIFT)) },
      STICKER_DEPTH);
    group.add(makeSticker(decalGeo, stickerMat(GEAR_FACE_NAMES[face]), bodyMat, {
      simStickerNormal: V(FACE_AXIS[face]),
    }));
  }

  // hub dome on the arris + a backing cone filling the gullet undersides
  const dome = new THREE.Mesh(new THREE.SphereGeometry(HUB_DOME_R, 24, 16), bodyMat);
  dome.position.copy(E.clone().sub(n.clone().multiplyScalar(HUB_DOME_R * 0.35)));
  dome.userData.simRole = 'body';
  group.add(dome);

  const coneL = (FAN_ROOT + 6) * Math.SQRT1_2;
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
  const SWEEP_TOP = SWEEP_HALF + 2;
  for (const axis of [0, 1, 2]) {
    // crown sweep lathe: closed profile loop (inner edge follows
    // crownSweepInnerRadius, outer edge safely outside the cube), revolved
    // about this axis. LatheGeometry revolves about local Y.
    const profile: THREE.Vector2[] = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = -SWEEP_TOP + (2 * SWEEP_TOP * i) / N;
      profile.push(new THREE.Vector2(crownSweepInnerRadius(Math.abs(t)), t));
    }
    profile.push(new THREE.Vector2(200, SWEEP_TOP), new THREE.Vector2(200, -SWEEP_TOP), profile[0].clone());
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
  if (along > SWEEP_HALF + 2 + m) return false;
  const rad = axis === 0 ? Math.hypot(p.y, p.z) : axis === 1 ? Math.hypot(p.x, p.z) : Math.hypot(p.x, p.y);
  return rad > crownSweepInnerRadius(Math.min(along, SWEEP_HALF)) - m;
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
