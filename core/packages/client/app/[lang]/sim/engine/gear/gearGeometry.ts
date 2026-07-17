/**
 * Gear Cube geometry — pure three.js + CSG builders. No scene/camera concerns.
 *
 * A cube [-H, H]³ with layer cut planes at ±CUT (fat outer layers like the real
 * puzzle, not 3x3 thirds). Pieces:
 *  - 12 EDGE GEARS, two nested parts (photo matched, user-locked):
 *    (a) FOLD-GLIDE CROWN — 6 ISOSCELES-TRAPEZOID teeth (straight radial legs
 *    through the gear center, chord bases, 38° gullets wider than the 22°
 *    teeth) defined in the DEVELOPED disc plane: the bent coin unrolled flat,
 *    fold line = the arris direction. HARD REQUIREMENT (spec §0, user-locked):
 *    at every rest phase the half-disc and its 3 tentacles must lie IN the
 *    face sticker planes. A rigid spinning crown can NEVER satisfy that —
 *    R(n̂, 120°) maps no face normal onto a face normal — so the teeth are NOT
 *    rigid children of the spin pivot: the spin angle θ (read off the spin
 *    pivot's quaternion each frame) rotates the teeth in developed coords
 *    only, then foldPoint() bends the developed plane 90° over the arris
 *    (a tiny FOLD_R arc at the crease). At rest (θ ≡ 0 mod 120°; teeth sit
 *    19° clear of the fold) every tooth lies FLAT on one face, its top and
 *    decal exactly coplanar with the disc slab and every block sticker; mid-
 *    turn the teeth glide around the static disc like a tank tread, creasing
 *    over the edge — the real puzzle's bent teeth rolling over the arris.
 *    120° = 2 pitches, so the crown rests identically after every move, and
 *    the decals ride their teeth, so scrambled fans mix colors. A small palm
 *    hub + backing cone (axisymmetric about n̂) stay on the spin pivot proper.
 *    (b) BENT-COIN CAP on the ORBIT pivot — the fat disc "folded 90° over the
 *    edge": two half-discs of radius COIN_R, one parallel to each face,
 *    meeting in a V-groove fold on the arris. It must NOT spin: the fold hugs
 *    the arris at every rest state, but a folded disc is only 180°-symmetric,
 *    so on the real puzzle it is an axle cap the crown whirls around. Its slab
 *    top rides exactly ON the face planes, SHARING the surface band with the
 *    tooth plates — disc + tentacles read as ONE flush gear, stickers level
 *    with every block sticker (unified skyline). Separation from its own
 *    crown is purely in-plane: tooth roots stay outside COIN_R + COIN_GAP at
 *    every spin phase (a bearing — the crown whirls around the static disc),
 *    and it spans |edge| ≤ COIN_R < CUT + SEAM, so every relative edge-axis
 *    rotation keeps it clear of the corner walls, constructively.
 *  - 8 CORNERS: rounded blocks carved by (a) three CROWN-SWEEP LATHES — tight
 *    solids of revolution around the axes containing every crown's whole
 *    spin ∪ orbit sweep (see crownSweepInnerRadius) — and (b) three thin WASHER
 *    rings that carve exactly the center-arms' swept shell. Both constructive:
 *    a turning crown/arm can never touch a corner. One splat sticker per face.
 *  - 6 CENTERS: rounded cap + square sticker + 4 C-shaped spider arms (one toward
 *    each adjacent gear; bare black plastic — colored feet read as stray dots,
 *    user-rejected). The arms live entirely inside the washer rings; their
 *    radial reach is capped by the corner-tab shell (spec §3/§6).
 *  - CORE: a dark sphere riding the middle slab.
 *
 * Clearance invariants (locked by tests/gear_geometry.test.ts):
 *  - corner/center/core bodies stay inside their move slabs (|coord| ≶ CUT ∓ SEAM);
 *  - HARD (spec §0): at every rest phase every tooth lies flat on ONE face,
 *    its decal top exactly IN that face's sticker plane — coplanar with the
 *    disc sticker (verified per-vertex through an independently re-derived
 *    fold map);
 *  - crowns + coin caps ⊂ ball(CROWN_BALL) at their edge midpoint; the gliding
 *    teeth ⊂ the glide shelf (the two face-plane slabs) at EVERY spin angle,
 *    so the shelf lathe carved out of the corners is constructive; coin caps
 *    keep an in-plane ring gap to the tooth roots at every spin angle (the
 *    crown whirls around the static disc like a bearing) and stay inside
 *    |edge| ≤ COIN_R < CUT + SEAM (clear of the corner walls under every
 *    relative edge-axis rotation);
 *    face-layer and equator crown orbit circles pass ≥ 2·CROWN_BALL + 2 apart
 *    (ball-to-ball suffices — crowns hug the arris);
 *  - crowns vs middle caps/arms/axles/core verified by a numeric sweep over the
 *    whole turn with a spin-angle scan (the glide repeats each 60° pitch).
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
/** Palm hub rim radius (⊥ n̂) — a small black hub fully under the disc slab;
 *  it rides the lower cone t = HUB_T − rad and even its bottom rim's in-face
 *  reach hides inside the disc footprint (test-locked). */
export const WEB_R = 13;
const STICKER_LIFT = 0.5;
const STICKER_DEPTH = 2.6;
/** Bent-coin cap slab: in-plane ring gap to the tooth roots + slab thickness. */
export const COIN_GAP = 0.6;
export const COIN_T = 4;
/** Tooth plate thickness (below the face planes). */
export const PLATE_T = 7;
/** Hub cone intercept along n̂: hub top proud = HUB_T/√2 = −COIN_T − COIN_GAP,
 *  a hover gap under the disc slab. */
const HUB_T = -(COIN_T + COIN_GAP) * Math.SQRT2;
/** Half-disc radius — user-locked: the disc radius EQUALS the visible tentacle
 *  length. The disc center sits ON the arris (cap top on the face plane), its
 *  in-face reach is exactly COIN_R, and the flat tooth's tip chord reaches
 *  TOOTH_TIP·cos11° ≈ 60.9 — so COIN_R = tipReach/2 (test-locked). */
export const COIN_R = 30.4;
/** Fold-glide bend radius: mid-crossing teeth wrap this tiny arc at the crease
 *  instead of tearing (the map stays continuous through the fold). Rest teeth
 *  never enter |q| < FOLD_R (they sit 19° clear of the fold), so the rest
 *  geometry is EXACTLY flat — the spec §0 hard requirement. */
export const FOLD_R = 1.2;
/** Ball bound of a whole crown around its edge midpoint E. */
export const CROWN_BALL = Math.hypot(TOOTH_TIP, STICKER_LIFT + STICKER_DEPTH) + 1.5;
/** Glide-shelf lathe. The gliding teeth stay inside the two face-plane slabs
 *  (depth ∈ [−PLATE_T, sticker top], in-plane radius ≤ TOOTH_TIP around E) at
 *  EVERY spin angle — flat teeth never dive below the slabs, unlike the old
 *  tilted 45°-cone plates. Revolved about a turn axis (the gear's edge
 *  direction ê ∥ that axis; along = the ê coordinate), the swept solid is a
 *  shallow SHELF hugging the arris: at |along| = a the slab still reaches
 *  in-plane b ≤ √(SWEEP_RHO² − a²), so its closest approach to the axis is
 *  hypot(H − PLATE_T, H − bMax). Corners are carved by exactly this lathe +
 *  margin (constructive: a gliding crown can never touch a corner) — far
 *  shallower than the old cone trench, so the corners keep more plastic and
 *  the carve reads as the real cube's scalloped arc around each gear. The
 *  hub/cone stay at |along| < CUT + SEAM (never inside a corner slab), so
 *  they need no carve at all. */
export const SWEEP_RHO = TOOTH_TIP + 0.75;  // max |along| of the glide shelf
export const SWEEP_WALL = 1.5;              // side margin of the carve
export function crownSweepInnerRadius(along: number): number {
  const a = Math.min(Math.abs(along), SWEEP_RHO);
  const bMax = Math.sqrt(Math.max(0, SWEEP_RHO * SWEEP_RHO - a * a));
  return Math.hypot(H - PLATE_T - 1, H - bMax) - 1;
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
export const TOOTH_ROOT = 32;
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

/** Fold frame of gear slot (r,s) — everything foldPoint() needs, in piece-local
 *  (= home world) coords. Developed q > 0 lies on facePlus. */
export interface FoldFrame {
  E: THREE.Vector3; e: THREE.Vector3; n: THREE.Vector3;
  /** (f̂₊ − f̂₋)/√2 — the crease arc's tangent direction. */
  h: THREE.Vector3;
  vPlus: THREE.Vector3; fPlus: THREE.Vector3;
  vMinus: THREE.Vector3; fMinus: THREE.Vector3;
}

export function slotFoldFrame(r: number, s: number): FoldFrame {
  const { e, n } = gearSlotBasis(r, s);
  const faces = gearSlotFaces(r, s);
  const facePlus = faces.find((f) => Math.sin(gearWindowAngle(r, s, f)) > 0)!;
  const faceMinus = faces.find((f) => f !== facePlus)!;
  const fPlus = V(FACE_AXIS[facePlus]);
  const fMinus = V(FACE_AXIS[faceMinus]);
  return {
    E: gearSlotApex(r, s), e, n,
    h: fPlus.clone().sub(fMinus).multiplyScalar(Math.SQRT1_2),
    vPlus: fMinus.clone().negate(), fPlus,
    vMinus: fPlus.clone().negate(), fMinus,
  };
}

/** FOLD-GLIDE MAP (spec §0). Developed disc coords → piece-local 3D: p = along
 *  the fold line ê, q = across it (arc length over the surface, q > 0 on
 *  facePlus), d = height above the surface. |q| ≥ FOLD_R lies flat ON a face
 *  plane; |q| < FOLD_R wraps a FOLD_R-radius arc around the arris (center
 *  E − FOLD_R·√2·n̂ — continuous and C¹ at both tangent points, constant
 *  thickness). Rest teeth never enter the arc zone, so the rest geometry is
 *  EXACTLY flat and coplanar with the disc slab. */
export function foldPoint(F: FoldFrame, p: number, q: number, d: number, out: THREE.Vector3): THREE.Vector3 {
  out.copy(F.E).addScaledVector(F.e, p);
  if (q >= FOLD_R) return out.addScaledVector(F.vPlus, q).addScaledVector(F.fPlus, d);
  if (q <= -FOLD_R) return out.addScaledVector(F.vMinus, -q).addScaledVector(F.fMinus, d);
  const a = (q / FOLD_R) * (Math.PI / 4);
  return out
    .addScaledVector(F.n, (FOLD_R + d) * Math.cos(a) - FOLD_R * Math.SQRT2)
    .addScaledVector(F.h, (FOLD_R + d) * Math.sin(a));
}

/** Grid-subdivided prism over a CONVEX developed outline: the caps are cut into
 *  ~cell² tiles so the fold-glide crease can pass ANYWHERE through the middle
 *  (a coarse cap would chord straight across the arris mid-crossing). Fixed
 *  topology — positions start at zero and are (re)written from the returned
 *  developed (p,q,d) triples by foldPoint() on every spin-angle change.
 *  Groups follow the makeSticker convention: [0] caps, [1] side walls. */
function gridPrism(outline: V2[], dTop: number, dBot: number, cell: number): { geo: THREE.BufferGeometry; dev: Float32Array } {
  const ccw = polyArea2(outline) > 0 ? outline : outline.slice().reverse();
  const dev: number[] = [];
  const tri = (a: V2, b: V2, c: V2, d: number): void => {
    dev.push(a[0], a[1], d, b[0], b[1], d, c[0], c[1], d);
  };
  // clip one grid cell (rect) against the convex outline — Sutherland–Hodgman
  const clipCell = (x0: number, y0: number, x1: number, y1: number): V2[] => {
    let poly: V2[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    for (let i = 0; i < ccw.length && poly.length; i++) {
      const A = ccw[i], B = ccw[(i + 1) % ccw.length];
      const ex = B[0] - A[0], ey = B[1] - A[1];
      const side = (P: V2): number => ex * (P[1] - A[1]) - ey * (P[0] - A[0]);
      const next: V2[] = [];
      for (let j = 0; j < poly.length; j++) {
        const P = poly[j], Q = poly[(j + 1) % poly.length];
        const sp = side(P), sq = side(Q);
        if (sp >= -1e-9) next.push(P);
        if ((sp >= -1e-9) !== (sq >= -1e-9)) {
          const t = sp / (sp - sq);
          next.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
        }
      }
      poly = next;
    }
    return poly;
  };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ccw) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell));
  const ny = Math.max(1, Math.ceil((y1 - y0) / cell));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const poly = clipCell(
        x0 + (i * (x1 - x0)) / nx, y0 + (j * (y1 - y0)) / ny,
        x0 + ((i + 1) * (x1 - x0)) / nx, y0 + ((j + 1) * (y1 - y0)) / ny,
      );
      for (let v = 1; v + 1 < poly.length; v++) {
        tri(poly[0], poly[v], poly[v + 1], dTop); // top cap — CCW seen from +d
        tri(poly[0], poly[v + 1], poly[v], dBot); // bottom cap — flipped
      }
    }
  }
  const capEnd = dev.length / 3;
  const ring = resampleClosed(ccw, cell);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    // outward side wall (interior sits on the left of a→b seen from +d)
    dev.push(a[0], a[1], dTop, a[0], a[1], dBot, b[0], b[1], dBot);
    dev.push(a[0], a[1], dTop, b[0], b[1], dBot, b[0], b[1], dTop);
  }
  const devArr = new Float32Array(dev);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(devArr.length), 3));
  geo.addGroup(0, capEnd, 0);
  geo.addGroup(capEnd, devArr.length / 3 - capEnd, 1);
  return { geo, dev: devArr };
}

export interface GearPieceHandle {
  /** Orbit pivot (origin) — rotated by face/middle turns. */
  pivot: THREE.Object3D;
  /** Spin pivot (origin, child of pivot) — rotated about the slot's radial axis
   *  (which passes through the apex E, so the crown spins in place). */
  spin: THREE.Object3D;
  group: THREE.Group;
  /** Re-bake the fold-glide teeth from the spin pivot's current angle (reads
   *  the quaternion; cheap no-op when unchanged). GearCube calls this every
   *  updateMatrixWorld, so tween frames morph and rest frames cost nothing. */
  refreshCrown: () => void;
}

/** Build gear piece for HOME slot (r,s): fold-glide crown + per-tooth decals. */
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

  // FOLD-GLIDE TEETH (spec §0 hard requirement — see the header): geometry
  // lives in developed disc coords; the spin pivot's ANGLE (not its transform)
  // drives a per-vertex re-bake through foldPoint(), so at rest every tooth
  // lies flat IN a face sticker plane, coplanar with the disc, and mid-turn
  // the crown glides around the static disc, creasing over the arris. The
  // teeth are children of the ORBIT pivot — only the axisymmetric hub + cone
  // ride the spin pivot as rigid bodies.
  const F = slotFoldFrame(r, s);
  const crown = new THREE.Group();
  crown.userData.gearPiece = { type: 'gear', ring: r, id: s };
  pivot.add(crown);
  const trap = toothTrapezoid(TOOTH_TIP);
  const trapCcw = polyArea2(trap) > 0 ? trap : trap.slice().reverse();
  // the decal covers the WHOLE plate top (real tentacles are solid-colored
  // plastic — any black margin here reads as a collar between disc and
  // teeth); only a hair of inset so the walls don't z-fight the plate walls
  const decalCcw = offsetInward(roundCorners(trapCcw, 0.5), 0.25);
  const CELL = 1.8;
  const crownMeshes: Array<{ mesh: THREE.Mesh; dev: Float32Array }> = [];
  for (let k = 0; k < TEETH; k++) {
    const rot = k * pitch; // tooth k rests at developed angle 90° + k·60°
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const spun = (pts: V2[]): V2[] => pts.map(([x, y]) => [x * cr - y * sr, x * sr + y * cr]);
    const body = gridPrism(spun(trapCcw), 0, -PLATE_T, CELL);
    // positions are re-baked in place — keep a fixed generous bound (raycast)
    // instead of per-frame recomputes, and skip frustum culling entirely
    body.geo.boundingSphere = new THREE.Sphere(E.clone(), CROWN_BALL);
    const plate = new THREE.Mesh(body.geo, bodyMat);
    plate.userData.simRole = 'body';
    plate.frustumCulled = false;
    crown.add(plate);
    crownMeshes.push({ mesh: plate, dev: body.dev });

    // per-tooth decal (rides its gliding tooth — scrambled fans mix colors)
    const face = toothFace(k);
    const dec = gridPrism(spun(decalCcw), STICKER_LIFT + STICKER_DEPTH, STICKER_LIFT, CELL);
    dec.geo.boundingSphere = new THREE.Sphere(E.clone(), CROWN_BALL);
    const decal = makeSticker(dec.geo, stickerMat(GEAR_FACE_NAMES[face]), bodyMat, {
      simStickerNormal: V(FACE_AXIS[face]),
    });
    decal.frustumCulled = false;
    crown.add(decal);
    crownMeshes.push({ mesh: decal, dev: dec.dev });
  }
  // spin angle → vertex re-bake. The spin pivot only ever rotates about the
  // piece-local n̂ (GearCube's live local axis P₀⁻¹·r̂_slot equals n̂ in every
  // legal state — the crown always points outward), so the angle reads
  // straight off the quaternion.
  let lastTheta = Number.NaN;
  const vTmp = new THREE.Vector3();
  const refreshCrown = (): void => {
    const q = spin.quaternion;
    const theta = 2 * Math.atan2(q.x * n.x + q.y * n.y + q.z * n.z, q.w);
    if (theta === lastTheta) return;
    lastTheta = theta;
    const ct = Math.cos(theta), st = Math.sin(theta);
    for (const { mesh, dev } of crownMeshes) {
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < dev.length; i += 3) {
        const p0 = dev[i], q0 = dev[i + 1];
        foldPoint(F, p0 * ct - q0 * st, p0 * st + q0 * ct, dev[i + 2], vTmp);
        arr[i] = vTmp.x; arr[i + 1] = vTmp.y; arr[i + 2] = vTmp.z;
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
  };
  refreshCrown();

  // palm hub: full-revolution frustum of the lower cone t = HUB_T − rad out to
  // WEB_R, fully under the disc slab (top proud ≤ −COIN_T − COIN_GAP; in-face
  // reach inside the disc footprint), PLATE_T·√2 thick along n̂. Lathe profile
  // in (rad ⊥ n̂, y ∥ n̂) — CCW loop (see cornerCarves for the winding gotcha).
  const webTop = (rad: number): number => HUB_T - rad;
  const webBot = (rad: number): number => HUB_T - PLATE_T * Math.SQRT2 - rad;
  const latheBasis = new THREE.Matrix4().makeBasis(t, n, e).setPosition(E);
  const webProfile = [
    new THREE.Vector2(0.01, webBot(0.01)),
    new THREE.Vector2(WEB_R, webBot(WEB_R)),
    new THREE.Vector2(WEB_R, webTop(WEB_R)),
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
  // crown whirls around. The slab top rides ON the face plane, SHARING the
  // surface band with the tooth plates: disc + tentacles read as ONE flush
  // gear (user-locked), stickers level with every block sticker. Clearance is
  // constructive and purely in-plane: at every spin phase every crown point
  // inside the slab band keeps in-plane distance > COIN_R + COIN_GAP from the
  // gear center (a bearing), and along the edge the cap stays inside
  // |edge| ≤ COIN_R < CUT + SEAM, clear of the corner walls under every
  // relative edge-axis rotation. 3 tentacles per face half emerge flush from
  // the rim ring gap.
  const coinGroup = new THREE.Group();
  coinGroup.userData.gearPiece = { type: 'gear', ring: r, id: s };
  const coinTop = 0;          // slab top exactly ON the face plane — the disc
                              // sticker shares the band of every block sticker
  const coinBot = -COIN_T;
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

  // backing cone filling the slot throat behind the web; its apex starts deep
  // enough that it stays under the cap slab (which now dips COIN_T below the
  // face planes near the fold): proud = −6.5/√2 ≈ −4.6 < −COIN_T
  const coneL = 34;
  const coneGeo = new THREE.ConeGeometry(coneL, coneL, 24, 1, false);
  coneGeo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
  const cone = new THREE.Mesh(coneGeo, bodyMat);
  cone.position.copy(E.clone().sub(n.clone().multiplyScalar(6.5 + coneL / 2)));
  cone.userData.simRole = 'body';
  group.add(cone);

  return { pivot, spin, group, refreshCrown };
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
  // feet) opening toward the cap. BARE BLACK PLASTIC — the reference brackets
  // are unstickered, and colored feet read as stray dots around the center
  // (user-rejected). (r, s) = (radial from face center toward the gear,
  // tangent along the edge).
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
