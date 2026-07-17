/**
 * Gear Cube geometry — pure three.js + CSG builders. No scene/camera concerns.
 *
 * A cube [-H, H]³ with layer cut planes at ±CUT (fat outer layers like the real
 * puzzle, not 3x3 thirds). Pieces:
 *  - 12 EDGE GEARS, two nested parts (photo matched, user-locked):
 *    (a) FOLD-GLIDE CROWN — six 60° SECTORS (SVG-traced tentacle + half
 *    gullets of a scalloped web each, see crownSectorOutline) defined in the
 *    DEVELOPED disc plane: the bent coin unrolled flat, fold line = the arris
 *    direction. HARD REQUIREMENT (spec §0, user-locked):
 *    at every rest phase the half-disc and its 3 tentacles must lie IN the
 *    face sticker planes. A rigid spinning crown can NEVER satisfy that —
 *    R(n̂, 120°) maps no face normal onto a face normal — so the sectors are
 *    NOT rigid children of the spin pivot: the spin angle θ (read off the spin
 *    pivot's quaternion each frame) rotates them in developed coords
 *    only, then foldPoint() bends the developed plane 90° over the arris
 *    (a tiny FOLD_R arc at the crease). At rest (θ ≡ 0 mod 120°) every
 *    tentacle lies FLAT on one face, its top and
 *    decal exactly coplanar with the disc slab and every block sticker; mid-
 *    turn the teeth glide around the static disc like a tank tread, creasing
 *    over the edge — the real puzzle's bent teeth rolling over the arris.
 *    120° = 2 pitches, so the crown rests identically after every move, and
 *    the decals ride their sectors, so scrambled fans mix colors. A small palm
 *    hub + backing cone (axisymmetric about n̂) stay on the spin pivot proper.
 *    (b) THE DISC SPINS TOO (user-locked 2026-07-17, superseding the static
 *    axle-cap model): each sector is a full PIE WEDGE down to the gear center,
 *    so disc + web + tentacles are ONE fold-glide surface spinning its 480°
 *    together — a wedge silhouette is 60°-periodic, so rest invariance is
 *    free, and with no relative disc↔crown rotation there is no bearing ring
 *    and no seam circle on the face. The disc region's decoration = the black
 *    FOLD-LINE mark (its ends poke past the disc zone), riding the same
 *    re-bake. Corner clearance for the new center material is constructive:
 *    |edge| ≤ dev radius under every spin angle, so material at r < CUT + SEAM
 *    never reaches a corner slab, and material at r ≥ TOOTH_ROOT lives inside
 *    the crown-sweep lathe shell the corners were already carved by.
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
 *  - crowns ⊂ ball(CROWN_BALL) at their edge midpoint; the gliding wedges ⊂
 *    the glide shelf (the two face-plane slabs) at EVERY spin angle, so the
 *    shelf lathe carved out of the corners is constructive;
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
import { makeSticker, cubeFaceBasis, extrudeOntoFace, roundCorners, polyArea2, type V2 } from '../stickerGeom';

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

import {
  FACE_AXIS, GEAR_FACE_NAMES, CORNER_POS, CENTER_POS, RING_SLOT_POS,
} from './gearState';

/** Cube half-side (world units). Frames like the other engine cubes (Dino/Heli). */
export const H = SIZE * 2; // 128

// ── dimensions (derived + verified; scripts/gear/GEAR_FRONT_SPEC.md §6) ──────────────
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
/** Half-disc radius — user-locked: the disc center sits ON the arris (cap top
 *  on the face plane), its in-face reach is exactly COIN_R, and the round
 *  tooth tip reaches TOOTH_TIP = 62 — so COIN_R ≈ tipReach/2 (test-locked). */
export const COIN_R = 30.4;
/** Fold-glide bend radius: crease-crossing material wraps this tiny arc
 *  instead of tearing (the map stays continuous through the fold). Rest teeth
 *  sit clear of the fold and are EXACTLY flat (the spec §0 hard requirement);
 *  the scalloped web's sector edges do reach the fold at rest — they wrap the
 *  arris through the same continuous crease arc the mid-glide crown uses
 *  (matches the real gear's rim wrapping the cube edge). */
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
 *  through other pieces mid-turn — refuted numerically; spec §6).
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

// ── crown silhouette (per 60° sector, in facet-plane coords around the apex) ────────
/** The crown's die-cut plate is 6 identical 60° SECTORS (tooth axis centered),
 *  traced from the user's reference SVG (scripts/gear/gear-cube-reference.svg,
 *  measured by scripts/gear/edge_trace.mjs): a scalloped WEB rim at RIM_R
 *  between parallel-sided round-tipped tentacles (constant half-width
 *  TOOTH_HALF_W — the SVG teeth are NOT trapezoids: slimmer at the tip, wider
 *  at the root than the old 22° wedge). Everything is 60°-periodic, so the
 *  mod-3 rest phases keep an identical silhouette (issue #32 invariant); the
 *  SVG's own 45/135° tentacle angles would need an 8-tooth crown and are
 *  mechanism-locked out. Sector boundaries sit at the gullet midlines
 *  (0°/180° land exactly ON the arris), so every sector stays on one face at
 *  rest — per-sector decals never straddle the fold.
 *  Radial invariants are untouched: inner arc = TOOTH_ROOT (the in-plane
 *  bearing ring vs the static coin cap), max reach = TOOTH_TIP (corner-carve
 *  lathe, center-arm clearance, CROWN_BALL all keyed to it). */
export const TOOTH_ROOT = 32;
/** Scalloped web rim radius between tentacles (SVG: 43–45). */
export const RIM_R = 44;
/** Tentacle half-width — constant along the flank (SVG: width 17 from r≈52 to the tip). */
export const TOOTH_HALF_W = 8.5;
/** Tentacle tip corner radius (SVG: rounded-rectangle tip, not a semicircle). */
export const TOOTH_TIP_CR = 3.5;
/** Concave fillet radius where a flank meets the web rim. */
export const TOOTH_FILLET_R = 5;
/** Fold-line mark: half-length and half-width of the black groove between the
 *  disc's two colored halves (user-locked: both ends poke a little past the
 *  disc zone; the mark spins with the crown like the real puzzle's). */
export const FOLD_LINE_R = 34;
export const FOLD_LINE_HW = 1.8;

/** One crown sector outline — a full PIE WEDGE from the gear center (tooth
 *  axis at 90°, spanning polar 60°..120°), dense CCW polygon in (ŵ, ĝ) facet
 *  coords. Six wedges tile disc + web + tentacles as ONE spinning surface:
 *  the disc is NOT a separate static axle cap (user-locked 2026-07-17: the
 *  folded half-disc spins its 480° with the crown, so there is no relative
 *  disc↔web rotation, no bearing ring, and no black seam circle on the face).
 *  `inset` shrinks the material boundary (rim/flanks/tip) for the decal — the
 *  radial wedge edges stay put so neighbouring decals share their boundary
 *  exactly (no hairline background seam at rest). */
export function crownSectorOutline(inset = 0): V2[] {
  const RIM = RIM_R - inset;
  const W = TOOTH_HALF_W - inset;
  const TIP = TOOTH_TIP - inset;
  const FR = TOOTH_FILLET_R;
  const CR = TOOTH_TIP_CR;
  const STEP = 0.05; // radians ≈ 0.6–2.2 units of arc, fine enough for the grid
  const pts: V2[] = [];
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number): void => {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / STEP));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  // fillet circle tangent to the rim (externally) and the flank line x = ±W
  const fcx = W + FR;
  const fcy = Math.sqrt((RIM + FR) * (RIM + FR) - fcx * fcx);
  const rimEnd = Math.atan2(fcy, fcx); // polar angle of the rim↔fillet tangency
  // tip chord height chosen so the CORNER ARCS peak exactly at radius TIP —
  // the max-reach invariants (carve lathe, arms, CROWN_BALL) key off TOOTH_TIP
  const tipY = CR + Math.sqrt((TIP - CR) * (TIP - CR) - (W - CR) * (W - CR));
  const D60 = Math.PI / 3, D120 = (2 * Math.PI) / 3;
  // outer boundary, φ increasing (CCW about the origin):
  arc(0, 0, RIM, D60, rimEnd);                                   // right gullet rim
  arc(fcx, fcy, FR, rimEnd + Math.PI, Math.PI);                  // right fillet (concave)
  pts.push([W, tipY - CR]);                                      // right flank up
  arc(W - CR, tipY - CR, CR, 0, Math.PI / 2);                    // right tip corner
  pts.push([-(W - CR), tipY]);                                   // tip chord
  arc(-(W - CR), tipY - CR, CR, Math.PI / 2, Math.PI);           // left tip corner
  pts.push([-W, fcy]);                                           // left flank down
  arc(-fcx, fcy, FR, 2 * Math.PI, 2 * Math.PI - rimEnd);         // left fillet (concave)
  arc(0, 0, RIM, Math.PI - rimEnd, D120);                        // left gullet rim
  pts.push([0, 0]);                                              // pie apex (gear center)
  const out: V2[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  return polyArea2(out) > 0 ? out : out.slice().reverse();
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

/** Grid-subdivided prism over a developed outline (CONCAVE OK — the crown
 *  sectors have an inner arc and fillets): the caps are cut into ~cell² tiles
 *  so the fold-glide crease can pass ANYWHERE through the middle (a coarse cap
 *  would chord straight across the arris mid-crossing). Fixed topology —
 *  positions start at zero and are (re)written from the returned developed
 *  (p,q,d) triples by foldPoint() on every spin-angle change.
 *  Groups follow the makeSticker convention: [0] caps, [1] side walls. */
function gridPrism(outline: V2[], dTop: number, dBot: number, cell: number): { geo: THREE.BufferGeometry; dev: Float32Array } {
  const ccw = polyArea2(outline) > 0 ? outline : outline.slice().reverse();
  const dev: number[] = [];
  const tri = (a: V2, b: V2, c: V2, d: number): void => {
    dev.push(a[0], a[1], d, b[0], b[1], d, c[0], c[1], d);
  };
  // clip the (possibly concave) outline against one convex cell rect —
  // Sutherland–Hodgman with the RECT as the clip region, so outline concavity
  // is fine (the old convex-outline-as-clipper form shaved cells near the
  // sector's inner arc: a far edge's half-plane wrongly clips local cells)
  const clipCell = (x0: number, y0: number, x1: number, y1: number): V2[] => {
    let poly: V2[] = ccw;
    const planes: Array<(P: V2) => number> = [
      (P) => P[0] - x0, (P) => x1 - P[0], (P) => P[1] - y0, (P) => y1 - P[1],
    ];
    for (const side of planes) {
      if (!poly.length) break;
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
  // ear-clip triangulation (cell polys are small but can be concave where a
  // fillet or the inner arc crosses the cell); falls back to a fan on the
  // degenerate slivers SH bridging can produce
  const earClip = (poly: V2[], d: number, flip: boolean): void => {
    const emit = (a: V2, b: V2, c: V2): void => (flip ? tri(a, c, b, d) : tri(a, b, c, d));
    const idx = poly.map((_, i) => i);
    const cross = (a: V2, b: V2, c: V2): number =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    let guard = poly.length * poly.length + 8;
    while (idx.length > 3 && guard-- > 0) {
      let clipped = false;
      for (let k = 0; k < idx.length; k++) {
        const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
        const A = poly[ia], B = poly[ib], C = poly[ic];
        if (cross(A, B, C) <= 1e-12) continue; // reflex or degenerate
        let blocked = false;
        for (const io of idx) {
          if (io === ia || io === ib || io === ic) continue;
          const P = poly[io];
          if (cross(A, B, P) >= -1e-12 && cross(B, C, P) >= -1e-12 && cross(C, A, P) >= -1e-12) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        emit(A, B, C);
        idx.splice(k, 1);
        clipped = true;
        break;
      }
      if (!clipped) break; // numerically stuck — fan out the rest below
    }
    if (idx.length >= 3) {
      for (let k = 1; k + 1 < idx.length; k++) emit(poly[idx[0]], poly[idx[k]], poly[idx[k + 1]]);
    }
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
      if (poly.length < 3) continue;
      earClip(poly, dTop, false); // top cap — CCW seen from +d
      earClip(poly, dBot, true);  // bottom cap — flipped
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

  // FOLD-GLIDE CROWN (spec §0 hard requirement — see the header): geometry
  // lives in developed disc coords; the spin pivot's ANGLE (not its transform)
  // drives a per-vertex re-bake through foldPoint(), so at rest every sector
  // lies flat IN a face sticker plane, coplanar with the disc, and mid-turn
  // the crown glides around the static disc, creasing over the arris. The
  // sectors are children of the ORBIT pivot — only the axisymmetric hub + cone
  // ride the spin pivot as rigid bodies. Six 60° sectors (SVG tentacle + half
  // gullets of the scalloped web each) tile the whole annulus [TOOTH_ROOT,
  // RIM_R/TOOTH_TIP], abutting at the gullet midlines.
  const F = slotFoldFrame(r, s);
  const crown = new THREE.Group();
  crown.userData.gearPiece = { type: 'gear', ring: r, id: s };
  pivot.add(crown);
  const sectorCcw = crownSectorOutline(0);
  // the decal covers the WHOLE plate top (real tentacles are solid-colored
  // plastic — any black margin here reads as a collar between disc and
  // teeth); only a hair of inset so the walls don't z-fight the plate walls.
  // The generator leaves the radial sector edges un-inset, so neighbouring
  // decals share those boundaries exactly — no background hairline mid-gullet.
  const decalCcw = crownSectorOutline(0.25);
  const CELL = 1.8;
  const crownMeshes: Array<{ mesh: THREE.Mesh; dev: Float32Array }> = [];
  for (let k = 0; k < TEETH; k++) {
    const rot = k * pitch; // sector k's tooth rests at developed angle 90° + k·60°
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const spun = (pts: V2[]): V2[] => pts.map(([x, y]) => [x * cr - y * sr, x * sr + y * cr]);
    const body = gridPrism(spun(sectorCcw), 0, -PLATE_T, CELL);
    // positions are re-baked in place — keep a fixed generous bound (raycast)
    // instead of per-frame recomputes, and skip frustum culling entirely
    body.geo.boundingSphere = new THREE.Sphere(E.clone(), CROWN_BALL);
    const plate = new THREE.Mesh(body.geo, bodyMat);
    plate.userData.simRole = 'body';
    plate.frustumCulled = false;
    crown.add(plate);
    crownMeshes.push({ mesh: plate, dev: body.dev });

    // per-sector decal (rides its gliding sector — scrambled fans mix colors;
    // sector boundaries land ON the arris at rest, so no decal straddles the
    // fold and each sector is single-colored)
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
  // FOLD-LINE MARK — the black groove between the disc's two colored halves.
  // A decoration OF the piece: it rides the same fold-glide re-bake, so it
  // spins its 480° with the crown and rests rotated after moves like the real
  // puzzle's. Slightly longer than the disc's visual radius so both ends poke
  // a little past it into the web (user-locked); proud of the wedge decals by
  // a hair so the overlap never z-fights.
  const lineDec = gridPrism(
    [[-FOLD_LINE_R, -FOLD_LINE_HW], [FOLD_LINE_R, -FOLD_LINE_HW],
     [FOLD_LINE_R, FOLD_LINE_HW], [-FOLD_LINE_R, FOLD_LINE_HW]],
    STICKER_LIFT + STICKER_DEPTH + 0.12, STICKER_LIFT, CELL);
  lineDec.geo.boundingSphere = new THREE.Sphere(E.clone(), CROWN_BALL);
  const lineMesh = new THREE.Mesh(lineDec.geo, bodyMat);
  lineMesh.userData.simRole = 'body';
  lineMesh.frustumCulled = false;
  crown.add(lineMesh);
  crownMeshes.push({ mesh: lineMesh, dev: lineDec.dev });
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

/** Corner sticker/plate outline — traced 1:1 from the user's reference SVG
 *  (`scripts/gear/gear-cube-reference.svg`, F face, top-right corner path
 *  M7386 9900) and CONJUGATE-CLIPPED against the fold-glide crown's synced
 *  transit footprint by `scripts/gear/mesh_check.mjs` (spin/orbit ±480°/90°, both branches,
 *  full 360°, 0.5° frames). ABSOLUTE face coords for the (+,+) corner, CCW.
 *
 *  The corner is a GEAR here — its spikes interdigitate with the crown teeth
 *  and only phase sync keeps them apart (rest clearance +12.21, transit +0.64,
 *  center-arm swept annuli 0 hits — all re-locked in tests/gear_geometry.test.ts;
 *  baked against the SVG-shaped SECTOR crown: scalloped web + parallel-sided
 *  tentacles, see crownSectorOutline).
 *  Built by MINIMAL SMOOTH DEFORMATION of the SVG outline: safe stretches are
 *  the SVG verbatim; offending stretches shift inward along a window-smoothed
 *  normal field by a smoothed upper envelope of the required clearance (G1,
 *  never less than required); the two wing-knob pockets (a gliding tooth
 *  reaches |along| ≤ 62.75 at plate heights, so their inner reaches are
 *  impossible with 6-tooth crowns) are bridged along the safety level set,
 *  leaving smooth stubs. The two pointy leftovers where the transit wall
 *  meets an SVG flank (head's top-left beak + its diagonal-twin tab) get a
 *  TARGETED FILLET (Bezier cut, r_eff ≈ 7 — matching the SVG's own head
 *  corners), then a CONSTRAINED FAIRING pass (normal-only curvature
 *  diffusion, floored at the safety field, erosion capped 0.9) melts every
 *  verbatim↔deformed junction into one continuous fillet — without it the
 *  spike flanks keep an S-shaped shoulder where the warp ramps in (reads
 *  as a notch up close). */
export const CORNER_POLY: V2[] = [
  [116.5, 116.5], [115.3, 117.3], [113.8, 118], [111.9, 118.3], [109.4, 118.5],
  [70.6, 118.6], [68.2, 118.4], [66.6, 117.9], [65.6, 116.9], [65, 115.6],
  [65.1, 114.2], [65.7, 112.4], [69.7, 111.1], [71.3, 110.1], [71.8, 109.5],
  [72.3, 108.5], [72.6, 107.5], [72.6, 106.3], [72.3, 104.4], [71.4, 101.1],
  [65.8, 82.7], [63.8, 77], [63.2, 75.6], [62.5, 74.6], [61.8, 73.9],
  [60.7, 73.3], [58.4, 72.6], [49.9, 70.8], [48.4, 70.3], [47.2, 69.6],
  [46.2, 68.8], [45.4, 67.6], [45.3, 66.5], [45.5, 65.6], [46.4, 64.8],
  [47.7, 64.2], [58.1, 62.5], [59.7, 62], [60.9, 61.1], [61.9, 59.8],
  [62.5, 58.2], [63.9, 49.2], [64.3, 47.3], [64.8, 46.4], [65.3, 45.8],
  [65.9, 45.4], [66.7, 45.3], [67.6, 45.5], [68.9, 46.3], [69.6, 47.1],
  [70.2, 48.3], [71, 50.8], [72.7, 58.8], [73.5, 61.2], [74.6, 62.6],
  [76.8, 63.8],
  [82.6, 65.8], [101.1, 71.4], [104.3, 72.3], [106.2, 72.7], [107.3, 72.6],
  [108.4, 72.4], [109.3, 71.9], [110, 71.4], [111, 70.1], [112.5, 66.7],
  [113, 66.1], [113.8, 65.5], [114.6, 65.3], [116.1, 65.3], [117.1, 65.7],
  [118.3, 66.4], [118.5, 71.6], [118.5, 108.2], [118.3, 111.6], [118, 113.4],
  [117.4, 115.2],
];

/** CORNER_POLY mirrored into corner `ci`'s quadrant on face `face`, CCW, plus
 *  the face basis. Fixed shape — no runtime shrinking: the polygon is verified
 *  offline (and test-locked) against every carve and every synced crown/arm
 *  sweep, so a misfit is a geometry regression, not a layout fallback. */
export function cornerStickerOutline(ci: number, face: number): { outline: V2[]; basis: { u: THREE.Vector3; v: THREE.Vector3; n: THREE.Vector3; origin: THREE.Vector3 } } {
  const signs = CORNER_POS[ci];
  const n = V(FACE_AXIS[face]);
  const { u, v } = cubeFaceBasis(FACE_AXIS[face] as unknown as number[]);
  const vert = new THREE.Vector3(signs[0], signs[1], signs[2]);
  const sgnA = Math.sign(vert.dot(u)), sgnB = Math.sign(vert.dot(v));
  const poly: V2[] = CORNER_POLY.map(([a, b]) => [sgnA * a, sgnB * b]);
  return {
    outline: polyArea2(poly) > 0 ? poly : poly.slice().reverse(),
    basis: { u, v, n, origin: n.clone().multiplyScalar(H + STICKER_LIFT) },
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
    // die-cut face plate: the corner's own gear profile, tooth-plate deep, added
    // AFTER the carve subtractions so the spikes survive the (worst-case) lathe —
    // phase sync is what really keeps the crown out of them (test-locked). Top
    // pokes 0.52 above the face so the sticker bottom embeds without a gap.
    const plateGeo = extrudeOntoFace(outline,
      { ...basis, origin: basis.n.clone().multiplyScalar(H - PLATE_T) }, PLATE_T + 0.52);
    const plate = new THREE.Mesh(plateGeo, bodyMat);
    plate.userData.simRole = 'body';
    group.add(plate);
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
