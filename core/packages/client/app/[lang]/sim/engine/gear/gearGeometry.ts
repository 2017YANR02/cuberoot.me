/**
 * Gear Cube geometry — pure three.js + CSG builders. No scene/camera concerns.
 *
 * A cube [-H, H]³ with layer cut planes at ±CUT (fat outer layers like the real
 * puzzle, not 3x3 thirds). Pieces:
 *  - 12 EDGE GEARS — ONE RIGID PIECE each (v12, user-locked 2026-07-17 with
 *    real-machine evidence, superseding the fold-glide tank-tread): a disc
 *    creased 90° over the arris. Six 60° PIE WEDGES (SVG-traced tentacle +
 *    half gullets of a scalloped web each, see crownSectorOutline) are
 *    fold-baked ONCE at build time and ride the SPIN pivot as a rigid body,
 *    whirling ±480° per flip about the slot's outward radial n̂. The crease
 *    is a MATERIAL feature on the dev q=0 diameter, directly under the black
 *    FOLD-LINE mark — fold line ≡ black line by construction. The user's
 *    physical puzzle settled this: in scrambled states the groove line leaves
 *    the arris (sharp 90° fold riding along with it), so at rest phases ±120°
 *    the piece does NOT hug the faces — it rests tilted, tentacle tips proud
 *    of the surface, the far half sunk into the slot throat, exactly like the
 *    bristling scrambled real cube. A rigid crease can only hug at 0°/180°
 *    (R(n̂,120°) maps no face plane onto a face plane), so the old spec §0
 *    "coplanar at every rest" hard rule was impossible on the real machine
 *    too; the machine tilts instead. 120° = 2 pitches, so rest SILHOUETTES
 *    repeat mod 120° in dev coords, and the per-wedge decals ride the rigid
 *    body, so scrambled fans mix colors and tilt together.
 *    A small palm hub + backing cone (axisymmetric about n̂) also ride the
 *    spin pivot; both hug the 45° slot-throat cone, which the spinning crown
 *    can never enter (each crown point keeps its axial height along n̂ and its
 *    axis distance — the swept solid is the revolve of the rest shape about
 *    n̂, strictly outside that cone).
 *  - 8 CORNERS: the block IS the INTERSECTION of its three sticker prisms
 *    (user's base-face construction, 2026-07-17 round 3): every body point
 *    projects into all three die-cut outlines, so NO view shows anything
 *    beyond that face's sticker silhouette (round 2's union let each column
 *    poke through the neighbouring views — user-rejected), and the deepened
 *    die-cut plates root the tile slabs into the intersection roof.
 *    Strictly ⊂ the old carved box, so all clearances inherit. Carves: (a) three
 *    RIGID-SWEEP LATHES — tight solids of revolution around the axes
 *    containing every crown's whole spin ∪ orbit sweep, DEEP because a
 *    tilted crown dives ~44 into the slot throat (crownSweepInnerRadius) —
 *    and (b) three thin WASHER rings carving exactly the center-arms' swept
 *    shell. Both constructive: a turning crown/arm can never touch a corner
 *    block. One splat sticker per face atop its own phase-sync-protected
 *    plate band.
 *  - 6 CENTERS: rounded cap + square sticker + 4 C-shaped spider arms (one toward
 *    each adjacent gear; bare black plastic — colored feet read as stray dots,
 *    user-rejected). The arms live entirely inside the washer rings; their
 *    radial reach is capped by the corner-tab shell (spec §3/§6).
 *  - CORE: a dark sphere riding the middle slab.
 *
 * Clearance invariants (locked by tests/gear_geometry.test.ts, fine-grained
 * offline sweep in scripts/gear/rigid_check.mjs):
 *  - corner/center/core bodies stay inside their move slabs (|coord| ≶ CUT ∓ SEAM);
 *  - at phase 0 the whole crown is coplanar with the faces (verified per-vertex
 *    through an independently re-derived fold map); phases ±120° rest TILTED
 *    by design (locked so nobody "fixes" them flush again);
 *  - crowns ⊂ ball(CROWN_BALL) at their edge midpoint E, and ⊂ the rigid-sweep
 *    lathe about their edge axis at EVERY spin angle (constructive corner-block
 *    clearance, orbit included — every crown↔block encounter is a relative
 *    rotation about the crown's own ê);
 *    face-layer and equator crown orbit circles pass ≥ 2·CROWN_BALL + 2 apart
 *    (ball-to-ball suffices — crowns hug the arris);
 *  - crown vs corner die-cut PLATES (the interdigitation zone) is phase-sync
 *    territory: a 3D numeric sweep covers rest tilts + full transits from
 *    every start phase;
 *  - crowns vs middle caps/arms/axles/core verified by the same numeric sweep
 *    over the whole turn with a full 360° spin scan (a rigid tilted crown is
 *    only 180°-periodic, not 60°).
 */
import * as THREE from 'three';
import { Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SIZE } from '../define';
import { CUBE_FILL } from '@/lib/cube-colors';
import { makeSticker, cubeFaceBasis, extrudeOntoFace, offsetInward, roundCorners, polyArea2, type V2 } from '../stickerGeom';

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
/** Tile-on-column embed: crown decals / fold bar / center sticker sink this
 *  far INTO their supporting column top, so no air slit shows edge-on (the
 *  old bottoms hovered at STICKER_LIFT over a top at 0 — a 0.5 background
 *  slit under every tile read as a floating decal). The corner sticker
 *  already embeds into its plate's 0.52 lip. Tops stay on the cube-wide
 *  sticker plane H + STICKER_LIFT + STICKER_DEPTH. */
const TILE_EMBED = 0.02;
/** Bent-coin cap slab: in-plane ring gap to the tooth roots + slab thickness. */
export const COIN_GAP = 0.6;
export const COIN_T = 4;
/** Tooth plate thickness (below the face planes). */
export const PLATE_T = 7;
/** Corner plate depth (v3 strict-intersection body) — deeper than the crown
 *  tooth plates (PLATE_T): the intersection body's roof is formed by the
 *  neighbouring outlines' top-edge walls at H − FOLD_LINE_HW − inset
 *  (≈ H − 9.5), so a PLATE_T-deep plate would float on a see-through slit.
 *  The die-cut plate digs to H − 9.8, embedding ~0.3 under the roof — the
 *  tile assembly (plate + sticker) roots into the body and the visible wall
 *  runs body → plate → sticker as one generatrix. The extended slab
 *  [H − CORNER_PLATE_T, H − PLATE_T] enlarges the phase-sync band; it is
 *  re-verified with THIS constant by scripts/gear/rigid_check.mjs (parses it
 *  from this source) + the MESH vitest. */
export const CORNER_PLATE_T = 9.8;
/** Slot-throat setback along n̂ (v12): the rigid crown's spin sweep reaches
 *  ρ = a − PLATE_T·√2 at axial depth a (the tilted plate's UNDERSIDE at p=0),
 *  so everything living in the throat — hub + backing cone, both slope-1
 *  cones about n̂ — must start at least this far in plus a margin, or the
 *  tilted crown shaves them (numerically −3.4 with the old 6.5 intercept). */
const THROAT_OFF = PLATE_T * Math.SQRT2 + 1.8;
/** Hub cone intercept along n̂ (hub top proud = −THROAT_OFF at the axis). */
const HUB_T = -THROAT_OFF;
/** Half-disc radius — user-locked: the disc center sits ON the arris (cap top
 *  on the face plane), its in-face reach is exactly COIN_R, and the round
 *  tooth tip reaches TOOTH_TIP = 62 — so COIN_R ≈ tipReach/2 (test-locked). */
export const COIN_R = 30.4;
/** Crease bend radius: material crossing dev q=0 wraps this tiny arc instead
 *  of tearing at the build-time bake — the real piece's sharp 90° fold with
 *  just enough roundover to shade cleanly. Teeth sit clear of it (exactly
 *  flat); only the wedge radial edges wrap it. */
export const FOLD_R = 1.2;
/** Ball bound of a whole crown around its edge midpoint E — a RIGID bound now:
 *  spin is a rotation about the axis through E, so it preserves every point's
 *  distance to E. */
export const CROWN_BALL = Math.hypot(TOOTH_TIP, PLATE_T) + 1.5;
/** RIGID-SWEEP LATHE (v12). The spinning crown's swept solid is the revolve of
 *  the creased rest shape about its own axis n̂: a point at dev (p,q,d) sits at
 *  axial depth a = (q−d)/√2 into the throat with transverse radius
 *  ρ = √(p² + (q+d)²/2), so ρ² + a² = p² + q² + d² — an EXACT ball
 *  BALL_S = hypot(TOOTH_TIP, PLATE_T), saturated by the deepest dive
 *  (p=0, q=TOOTH_TIP, d=−PLATE_T at AD = (TIP+PT)/√2 deep, ρ = RD =
 *  (TIP−PT)/√2). Every crown↔corner encounter is a relative rotation about
 *  the crown's own edge direction ê (equator gears have ê ∥ the turn axis;
 *  riding gears co-move with their layer's corners and never reach the far
 *  layer), so revolving the spin sweep about ê bounds ALL relative motion:
 *  min R about ê at |along| = x is
 *    x ≤ RD:      √((EDGE_R − AD)² + RD² − x²)   (the deep dive governs)
 *    RD < x ≤ B:  EDGE_R − √(BALL_S² − x²)       (the ball rim governs)
 *  (continuous at RD since AD² + RD² = BALL_S²). Corners are carved by exactly
 *  this lathe + wall margin — constructive: a whirling TILTED crown can never
 *  touch a corner block, mid-orbit included. The die-cut corner PLATES are
 *  added AFTER the carve and live inside the sweep on purpose — phase sync is
 *  what keeps the crown out of them (mesh_check/rigid_check verified). */
export const SWEEP_WALL = 1.5;
export function crownSweepInnerRadius(along: number): number {
  const AD = (TOOTH_TIP + PLATE_T) / Math.SQRT2;
  const RD = (TOOTH_TIP - PLATE_T) / Math.SQRT2;
  const BALL_S = Math.hypot(TOOTH_TIP, PLATE_T);
  const x = Math.min(Math.abs(along), BALL_S);
  return x <= RD
    ? Math.sqrt((EDGE_R - AD) * (EDGE_R - AD) + RD * RD - x * x)
    : EDGE_R - Math.sqrt(BALL_S * BALL_S - x * x);
}
/** Max |along| of the rigid sweep (the lathe's half-height before the wall). */
export const SWEEP_RHO = Math.hypot(TOOTH_TIP, PLATE_T);
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
 *  disc's two colored halves (user-locked: a FAT bar — matching the real
 *  puzzle's groove — that spins with the crown like the real puzzle's).
 *  Ends are ARCS of radius FOLD_LINE_R = the decal rim reach (RIM_R − the
 *  0.25 decal inset, user-locked 2026-07-17: a shorter bar leaves a colored
 *  decal sliver between its end and the rim; an arc end hugs the rim so the
 *  widened bar never overhangs the gullet plate). Half-width = the corner
 *  stickers' arris setback (H − max CORNER_POLY coord = 128 − 118.6), so the
 *  bar reads exactly as fat as the corners' black arris band (user-locked
 *  2026-07-17: 4.5 was visibly thinner than the corner band) — both
 *  test-locked. Strict-intersection corners: the arris band is an open
 *  notch between neighbouring tile plates — its across-arris width is
 *  still 2× this setback, so the parity is invariant. */
export const FOLD_LINE_R = RIM_R - 0.25;
export const FOLD_LINE_HW = 9.4;

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
 *  so the crease can pass anywhere through the middle at the build-time bake
 *  (a coarse cap would chord straight across the fold arc). `cellY` refines the
 *  q rows independently — a fold-straddling mesh needs rows dense against
 *  FOLD_R (and one exactly ON q=0) or its caps sag under neighbours that do
 *  sample the crease. Positions start at
 *  zero; buildGearPiece writes them once from the returned developed (p,q,d)
 *  triples through foldPoint().
 *  Groups follow the makeSticker convention: [0] caps, [1] side walls. */
function gridPrism(outline: V2[], dTop: number, dBot: number, cell: number, cellY = cell): { geo: THREE.BufferGeometry; dev: Float32Array } {
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
  const ny = Math.max(1, Math.ceil((y1 - y0) / cellY));
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
  const ring = resampleClosed(ccw, Math.min(cell, cellY));
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
   *  (which passes through the apex E, so the crown spins in place). The whole
   *  crease-baked crown rides it rigidly (v12). */
  spin: THREE.Object3D;
  group: THREE.Group;
}

/** Build gear piece for HOME slot (r,s): rigid creased crown + per-wedge decals. */
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

  // RIGID CREASED CROWN (v12 — see the header): the fold map runs ONCE here,
  // baking the developed pie wedges into the bent-coin rest shape, and the
  // whole crown rides the SPIN pivot as a rigid body (E lies on the spin axis
  // through the origin along n̂, so the origin-anchored spin rotates the crown
  // in place). The crease is baked along dev q=0 — a MATERIAL diameter that
  // whirls with the piece and rests rotated off the arris at phases ±120°,
  // exactly like the user's physical puzzle. Six 60° sectors (SVG tentacle +
  // half gullets of the scalloped web each) tile the whole disc, abutting at
  // the gullet midlines.
  const F = slotFoldFrame(r, s);
  const vTmp = new THREE.Vector3();
  const bake = (prism: { geo: THREE.BufferGeometry; dev: Float32Array }): THREE.BufferGeometry => {
    const pos = prism.geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < prism.dev.length; i += 3) {
      foldPoint(F, prism.dev[i], prism.dev[i + 1], prism.dev[i + 2], vTmp);
      arr[i] = vTmp.x; arr[i + 1] = vTmp.y; arr[i + 2] = vTmp.z;
    }
    // Walls keep the flat normals this computes; cap normals are then rewritten
    // with the fold map's ANALYTIC surface normal (flat zones = face normal,
    // arc zone = arc radial) — the non-indexed soup otherwise flat-shades the
    // crease roll-over into hard facet bands, where the corners' rounded
    // arrises (CSG, interpolated normals) shade as one smooth Phong bend.
    prism.geo.computeVertexNormals();
    const narr = (prism.geo.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array;
    const capVerts = prism.geo.groups[0].count;
    let dTop = -Infinity, dBot = Infinity;
    for (let v = 0; v < capVerts; v++) {
      const d = prism.dev[v * 3 + 2];
      if (d > dTop) dTop = d;
      if (d < dBot) dBot = d;
    }
    for (let v = 0; v < capVerts; v++) {
      const q = prism.dev[v * 3 + 1];
      const up = prism.dev[v * 3 + 2] > (dTop + dBot) / 2 ? 1 : -1;
      if (q >= FOLD_R) vTmp.copy(F.fPlus);
      else if (q <= -FOLD_R) vTmp.copy(F.fMinus);
      else {
        const a = (q / FOLD_R) * (Math.PI / 4);
        vTmp.copy(F.n).multiplyScalar(Math.cos(a)).addScaledVector(F.h, Math.sin(a));
      }
      narr[v * 3] = vTmp.x * up; narr[v * 3 + 1] = vTmp.y * up; narr[v * 3 + 2] = vTmp.z * up;
    }
    // tight rigid bound in geometry space — spin preserves distances to E
    prism.geo.boundingSphere = new THREE.Sphere(E.clone(), CROWN_BALL);
    return prism.geo;
  };
  const crown = new THREE.Group();
  group.add(crown);
  const sectorCcw = crownSectorOutline(0);
  // the decal covers the WHOLE plate top (real tentacles are solid-colored
  // plastic — any black margin here reads as a collar between disc and
  // teeth); only a hair of inset so the walls don't z-fight the plate walls.
  // The generator leaves the radial sector edges un-inset, so neighbouring
  // decals share those boundaries exactly — no background hairline mid-gullet.
  const decalCcw = crownSectorOutline(0.25);
  const CELL = 1.8;
  for (let k = 0; k < TEETH; k++) {
    const rot = k * pitch; // sector k's tooth rests at developed angle 90° + k·60°
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const spun = (pts: V2[]): V2[] => pts.map(([x, y]) => [x * cr - y * sr, x * sr + y * cr]);
    const plate = new THREE.Mesh(bake(gridPrism(spun(sectorCcw), 0, -PLATE_T, CELL)), bodyMat);
    plate.userData.simRole = 'body';
    crown.add(plate);

    // per-sector decal (rigid with its sector — scrambled fans mix colors and
    // tilt together; sector boundaries land ON the crease, so no decal
    // straddles it and each sector is single-colored). Its bottom sinks
    // TILE_EMBED into the plate top (d=0) — base-face prism model: the tile
    // roots into its own column instead of hovering a 0.5 slit above it. The
    // near-coincident caps only sag apart inside the fold-arc band (|q| <
    // FOLD_R), which the fold bar buries entirely, so no cap ever peeks
    // through; everywhere else both caps are exactly flat. Filling the slit
    // adds no in-plane silhouette (decal ⊂ plate) inside the crown's verified
    // height band, so the phase-sync clearances are untouched.
    const face = toothFace(k);
    const decal = makeSticker(
      bake(gridPrism(spun(decalCcw), STICKER_LIFT + STICKER_DEPTH, -TILE_EMBED, CELL)),
      stickerMat(GEAR_FACE_NAMES[face]), bodyMat,
      { simStickerNormal: V(FACE_AXIS[face]) },
    );
    crown.add(decal);
  }
  // FOLD-LINE MARK — the fat black groove between the disc's two colored
  // halves, straddling dev q=0: it sits exactly ON the baked crease, so the
  // visible black line IS the fold line (user-locked), and both whirl together
  // as one rigid feature. Its ends are rim-hugging ARCS flush with the decal
  // rim reach (see FOLD_LINE_R/HW); proud of the wedge decals by a hair so
  // the overlap never z-fights. Plain bodyMat — the bar must read as the
  // SAME plastic as the corner bodies (user-locked).
  // Fine q rows are load-bearing: the crease-adjacent decals hold EXACT
  // vertices on q=0 (their radial edges lie on the crease), so any bar cap
  // that chords the fold arc sags under them and the colored decals surface
  // through the bar's mid-line, splitting it into two strips. LINE_CELL_Q
  // must make ceil(2·FOLD_LINE_HW / cellY) EVEN (a row lands ON the crease,
  // float-ε) and keep the chord sag (≈0.06) under the 0.12 proudness.
  const LINE_CELL_Q = 0.5;
  const endA = Math.asin(FOLD_LINE_HW / FOLD_LINE_R);
  const barOutline: V2[] = [];
  const ARC_N = 12;
  for (let i = 0; i <= ARC_N; i++) {   // right end arc, CCW (−endA → +endA)
    const a = -endA + (2 * endA * i) / ARC_N;
    barOutline.push([FOLD_LINE_R * Math.cos(a), FOLD_LINE_R * Math.sin(a)]);
  }
  for (let i = 0; i <= ARC_N; i++) {   // left end arc, CCW (π−endA → π+endA)
    const a = Math.PI - endA + (2 * endA * i) / ARC_N;
    barOutline.push([FOLD_LINE_R * Math.cos(a), FOLD_LINE_R * Math.sin(a)]);
  }
  const lineMesh = new THREE.Mesh(
    bake(gridPrism(barOutline,
      STICKER_LIFT + STICKER_DEPTH + 0.12, -TILE_EMBED, CELL, LINE_CELL_Q)),
    bodyMat);
  lineMesh.userData.simRole = 'body';
  crown.add(lineMesh);

  // palm hub: full-revolution frustum of the lower cone t = HUB_T − rad out to
  // WEB_R — sunk past THROAT_OFF so the tilted crown's underside clears it,
  // PLATE_T·√2 thick along n̂. Lathe profile in (rad ⊥ n̂, y ∥ n̂) — the loop
  // MUST wind CCW in the (r, y) half-plane or the mesh is inside-out.
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

  // backing cone filling the slot throat behind the web; slope-1 about n̂ from
  // the THROAT_OFF intercept, so the tilted crown's underside (ρ = a −
  // PLATE_T·√2) always clears it by the 1.8 margin (rigid_check.mjs verifies)
  const coneL = 34;
  const coneGeo = new THREE.ConeGeometry(coneL, coneL, 24, 1, false);
  coneGeo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
  const cone = new THREE.Mesh(coneGeo, bodyMat);
  cone.position.copy(E.clone().sub(n.clone().multiplyScalar(THROAT_OFF + coneL / 2)));
  cone.userData.simRole = 'body';
  group.add(cone);

  return { pivot, spin, group };
}

// ── corners (CSG: rounded box − 3 rigid-sweep lathes − 3 arm washers) ───────────────
let carveBrushes: Brush[] | null = null;
function cornerCarves(ev: Evaluator): Brush[] {
  if (carveBrushes) return carveBrushes;
  const brushes: Brush[] = [];
  const SWEEP_TOP = SWEEP_RHO + SWEEP_WALL;
  for (const axis of [0, 1, 2]) {
    // rigid-sweep lathe: closed profile loop (inner edge follows
    // crownSweepInnerRadius, outer edge safely outside the cube), revolved
    // about this axis. LatheGeometry revolves about local Y. The loop MUST
    // wind CCW in the (r, y) half-plane — bottom out, up the outer wall, top
    // in, down the inner wall — or the brush is inside-out and the CSG
    // subtraction sprays sliver shards over the corner.
    const profile: THREE.Vector2[] = [];
    const N = 48;
    profile.push(new THREE.Vector2(200, -SWEEP_TOP), new THREE.Vector2(200, SWEEP_TOP));
    for (let i = 0; i <= N; i++) {
      const t = SWEEP_TOP - (2 * SWEEP_TOP * i) / N;
      profile.push(new THREE.Vector2(crownSweepInnerRadius(t) - SWEEP_WALL, t));
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

/** Is `p` inside the rigid-sweep lathe about `axis` (0=x,1=y,2=z), inflated m?
 *  (m < 0 shrinks the region — the containment test uses it to prove the crown
 *  stays inside the carve with margin at every spin angle.) */
export function inCrownSweep(p: THREE.Vector3, axis: number, m: number): boolean {
  const along = Math.abs(axis === 0 ? p.x : axis === 1 ? p.y : p.z);
  if (along > SWEEP_RHO + SWEEP_WALL + m) return false;
  const rad = axis === 0 ? Math.hypot(p.y, p.z) : axis === 1 ? Math.hypot(p.x, p.z) : Math.hypot(p.x, p.y);
  return rad > crownSweepInnerRadius(along) - SWEEP_WALL - m;
}

/** Corner sticker/plate outline — traced 1:1 from the user's reference SVG
 *  (`scripts/gear/gear-cube-reference.svg`, F face, top-right corner path
 *  M7386 9900) and CONJUGATE-CLIPPED against the v12 RIGID crown's synced
 *  transit sweep by `scripts/gear/mesh_check.mjs` (spin θ = φ0 ± (480/90)·ω,
 *  BOTH branches, ALL THREE start tilts φ0 ∈ {0,120,240}, full 360° of ω,
 *  0.5° frames — a tilted crown leans through 3D, so the old flat-footprint
 *  reasoning is gone). ABSOLUTE face coords for the (+,+) corner, CCW.
 *
 *  The corner is a GEAR here — its spikes interdigitate with the crown teeth
 *  and only phase sync keeps them apart (rest clearance +11.21 over all three
 *  tilts, transit +0.91, center-arm swept annuli 0 hits — re-locked in
 *  tests/gear_geometry.test.ts + scripts/gear/rigid_check.mjs; baked against
 *  the SVG-shaped SECTOR crown: scalloped web + parallel-sided tentacles, see
 *  crownSectorOutline).
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
  [116.5, 116.5], [115, 117.5], [113.3, 118.1], [111.2, 118.4], [107.6, 118.5],
  [68.4, 118.6], [65.5, 118.2], [64.8, 117.9], [64, 117.1], [63.6, 116.4],
  [63.5, 114.8], [63.6, 114], [64.2, 112.7], [69.1, 111.3], [70.8, 110.5],
  [71.6, 109.8], [72.1, 109], [72.4, 108.2], [72.6, 107.1], [72.5, 105.4],
  [72, 103.2], [65.4, 81.2], [63.5, 76.1], [62.7, 74.8], [61.9, 74],
  [60.3, 73.1], [56.6, 72], [53.5, 70.8], [50.5, 70.5], [49.3, 70.1],
  [48.5, 69.6], [47.9, 68.8], [47.5, 68], [47.4, 67.2], [47.5, 66.2],
  [47.8, 65.3], [48.4, 64.7], [49.2, 64.2], [51.2, 63.6], [58.5, 62.4],
  [60, 61.8], [61.1, 60.9], [62, 59.6], [62.5, 58.2], [63.9, 49.9],
  [64.5, 48.7], [65.2, 47.9], [66.5, 47.4], [68, 47.4], [69.1, 48],
  [69.9, 48.9], [70.5, 50.5], [70.7, 53.5], [71.9, 56.5], [73.2, 60.5],
  [73.7, 61.5], [74.3, 62.3], [75.2, 63], [76.7, 63.7],
  [82.8, 65.9], [103.2, 72], [105.3, 72.5], [106.8, 72.7], [107.9, 72.5],
  [108.8, 72.2], [109.7, 71.6], [110.6, 70.7], [111.6, 68.6], [112.8, 64.3],
  [114.4, 63.7], [115.6, 63.7], [116.8, 63.9], [118.3, 64.6], [118.4, 69.6],
  [118.5, 108.1], [118.3, 111.6], [118, 113.4], [117.4, 115.2],
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
  const faces = FACE_AXIS.map((_, f) => f).filter((f) =>
    FACE_AXIS[f][0] * signs[0] + FACE_AXIS[f][1] * signs[1] + FACE_AXIS[f][2] * signs[2] > 0);

  // STRICT-INTERSECTION BASE-FACE PRISMS (user-locked 2026-07-17 round 3,
  // "凸出来的部分根本就不是轮廓柱体的部分"): the body is the INTERSECTION
  // of the three sticker-outline prisms — round 2's UNION let every column
  // show through the other faces' silhouettes, exactly the protrusions the
  // user rejected. Now every body point projects into all three die-cut
  // shapes, so no view shows anything past that face's sticker outline; the
  // arris bands, the inner bulk and the old box are all gone (strictly ⊂
  // round 2 ⊂ the original carved box — every clearance inherits verbatim).
  // The intersection's roof is the neighbouring outlines' top-edge walls
  // (H − FOLD_LINE_HW − inset), which is why the plates below dig to
  // CORNER_PLATE_T — the tile assembly roots into the roof instead of
  // floating on a see-through slit.
  // Burr guards (kept from round 2): each prism is a single clean
  // ExtrudeGeometry whose end caps lie OUTSIDE every other prism's plan
  // range (caps get discarded whole — no cap ever splits against another
  // operand), and per-prism staggered insets (0.06/0.10/0.14) keep any two
  // operand faces off-plane even where the outline repeats a coordinate on
  // both axes — and every body wall a hair behind its uninset plate wall.
  let merged: Brush | null = null;
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    const { outline, basis } = cornerStickerOutline(ci, face);
    const prismGeo = extrudeOntoFace(offsetInward(outline, 0.06 + 0.04 * i),
      { ...basis, origin: basis.n.clone().multiplyScalar(lo) }, H - lo);
    const prism = new Brush(prismGeo);
    prism.updateMatrixWorld();
    merged = merged ? ev.evaluate(merged, prism, INTERSECTION) : prism;
  }
  let brush = merged!;
  for (const carve of cornerCarves(ev)) brush = ev.evaluate(brush, carve, SUBTRACTION);
  const body = new THREE.Mesh(brush.geometry.clone(), bodyMat);
  body.userData.simRole = 'body';
  group.add(body);

  for (const face of faces) {
    const { outline, basis } = cornerStickerOutline(ci, face);
    // die-cut face plate: the corner's own gear profile, CORNER_PLATE_T deep,
    // added AFTER the carve subtractions so the spikes survive the (worst-case)
    // lathe — phase sync is what really keeps the crown out of it (test-locked,
    // band re-verified at this depth). Top pokes 0.52 above the face so the
    // sticker bottom embeds without a gap; the bottom embeds under the
    // intersection body's roof, so the exposed wall runs body → plate →
    // sticker as one outline-shaped generatrix.
    const plateGeo = extrudeOntoFace(outline,
      { ...basis, origin: basis.n.clone().multiplyScalar(H - CORNER_PLATE_T) }, CORNER_PLATE_T + 0.52);
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
  // outline inset = the cap's r4 roll-off start, so the cap top is exactly flat
  // at H under the whole tile — root the tile TILE_EMBED into it (no 0.5 slit),
  // top on the cube-wide sticker plane
  const geo = extrudeOntoFace(outline,
    { u, v, n, origin: n.clone().multiplyScalar(H - TILE_EMBED) },
    STICKER_LIFT + STICKER_DEPTH + TILE_EMBED);
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
