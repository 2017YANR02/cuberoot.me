import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Evaluator } from 'three-bvh-csg';
import {
  H, CUT, SEAM, TEETH, TOOTH_TIP, WEB_R, PLATE_T, FOLD_R,
  CROWN_BALL, EDGE_R, CORE_R, CAP_HALF,
  ARM_R0, ARM_R1, ARM_S, ARM_D, WASHER_IN, WASHER_OUT, WASHER_Y,
  SWEEP_RHO, SWEEP_WALL, RIM_R, TOOTH_HALF_W, TOOTH_FILLET_R, FOLD_LINE_R, FOLD_LINE_HW,
  COIN_R, CORNER_PLATE_T,
  crownSectorOutline, buildCornerPiece,
  gearSlotApex, gearSlotBasis, gearSlotFaces, gearWindowAngle,
  cornerStickerOutline, inCrownSweep, CORNER_POLY,
} from '@/app/[lang]/sim/engine/gear/gearGeometry';
import { CORNER_POS, FACE_AXIS } from '@/app/[lang]/sim/engine/gear/gearState';

const CAP_T = 12;
const ARM_LIFT = 3.5;
const STICKER_TOP = 0.5 + 2.6; // sticker plane offset above a face (lift + depth)
type V3 = [number, number, number];

// slots used by the sweeps: UF = (ring 1, slot 0) — its edge direction is x̂
const UF: [number, number] = [1, 0];

/** INDEPENDENT fold map (re-derived from spec §0, NOT imported from the
 *  engine): developed disc coords (p = along the crease ê, q = across it,
 *  q > 0 on facePlus, d = height above the surface) → world REST shape.
 *  |q| ≥ FOLD_R lies flat ON a face plane; |q| < FOLD_R wraps a FOLD_R arc
 *  around the arris. v12: this runs ONCE — the crease is a baked MATERIAL
 *  feature and the whole crown then moves rigidly. */
function makeFold(r: number, s: number): (p: number, q: number, d: number) => V3 {
  const E = gearSlotApex(r, s);
  const { e, n } = gearSlotBasis(r, s);
  const faces = gearSlotFaces(r, s);
  const fp = faces.find((f) => Math.sin(gearWindowAngle(r, s, f)) > 0)!;
  const fPlus = new THREE.Vector3(...FACE_AXIS[fp]);
  const fMinus = new THREE.Vector3(...FACE_AXIS[faces.find((f) => f !== fp)!]);
  const h = fPlus.clone().sub(fMinus).multiplyScalar(Math.SQRT1_2);
  return (p, q, d) => {
    const out = E.clone().addScaledVector(e, p);
    if (q >= FOLD_R) out.addScaledVector(fMinus, -q).addScaledVector(fPlus, d);
    else if (q <= -FOLD_R) out.addScaledVector(fPlus, q).addScaledVector(fMinus, d);
    else {
      const a = (q / FOLD_R) * (Math.PI / 4);
      out.addScaledVector(n, (FOLD_R + d) * Math.cos(a) - FOLD_R * Math.SQRT2)
        .addScaledVector(h, (FOLD_R + d) * Math.sin(a));
    }
    return [out.x, out.y, out.z];
  };
}

/** Rigid spin about the slot's outward radial n̂ THROUGH THE ORIGIN (E ∥ n̂, so
 *  this rotates the crown in place about its own axis) — the v12 motion model:
 *  the crease-baked rest shape moves as one rigid body. */
function makeSpin(r: number, s: number, theta: number): (p: V3) => V3 {
  const q = new THREE.Quaternion().setFromAxisAngle(gearSlotBasis(r, s).n, theta);
  const v = new THREE.Vector3();
  return (p) => {
    v.set(p[0], p[1], p[2]).applyQuaternion(q);
    return [v.x, v.y, v.z];
  };
}

/** Developed-plane samples of ONE canonical crown SECTOR (tooth axis at rest
 *  angle 90°, spanning polar 60°..120° — six of these tile the whole crown,
 *  scalloped web included): the engine's exact die-cut boundary (dense) plus
 *  an interior grid. The boundary carries the binding constraints (tip corners
 *  = the deepest transit reach). */
function toothDevSamples(step = 1.2): Array<[number, number]> {
  const outline = crownSectorOutline(0);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < outline.length; i++) {
    const A = outline[i], B = outline[(i + 1) % outline.length];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) pts.push([A[0] + ((B[0] - A[0]) * k) / n, A[1] + ((B[1] - A[1]) * k) / n]);
  }
  const inPoly = (x: number, y: number): boolean => {
    let inside = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, yi] = outline[i], [xj, yj] = outline[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const g = step * 1.8;
  for (let x = -22; x <= 22; x += g) {
    for (let y = 0.8; y <= TOOTH_TIP; y += g) if (inPoly(x, y)) pts.push([x, y]);
  }
  return pts;
}

const TOOTH_DEPTHS = [STICKER_TOP, 0, -PLATE_T];

/** World-space REST cloud of the whole creased crown (θ=0): all 6 wedges
 *  through the fold map + the palm hub lathe revolved about n̂ (sunk past the
 *  throat setback — independently re-derived: the tilted crown's underside
 *  reaches ρ = a − PLATE_T·√2, so the hub starts 1.8 under that line). */
function restCloud(r: number, s: number, base: Array<[number, number]> = toothDevSamples()): V3[] {
  const fold = makeFold(r, s);
  const pts: V3[] = [];
  for (let k = 0; k < TEETH; k++) {
    const a0 = k * ((2 * Math.PI) / TEETH);
    const ca = Math.cos(a0), sa = Math.sin(a0);
    for (const [x, y] of base) {
      const p = x * ca - y * sa, q = x * sa + y * ca;
      for (const d of TOOTH_DEPTHS) pts.push(fold(p, q, d));
    }
  }
  const E = gearSlotApex(r, s);
  const { e, t, n } = gearSlotBasis(r, s);
  const hubT = -(PLATE_T * Math.SQRT2 + 1.8);
  const prof: Array<[number, number]> = [
    [0.01, hubT - PLATE_T * Math.SQRT2 - 0.01],
    [WEB_R, hubT - PLATE_T * Math.SQRT2 - WEB_R],
    [WEB_R, hubT - WEB_R],
    [0.01, hubT - 0.01],
  ];
  const v = new THREE.Vector3();
  for (let i = 0; i < 24; i++) {
    const phi = (i / 24) * 2 * Math.PI;
    const u = e.clone().multiplyScalar(Math.cos(phi)).addScaledVector(t, Math.sin(phi));
    for (const [rad, ty] of prof) {
      v.copy(E).addScaledVector(u, rad).addScaledVector(n, ty);
      pts.push([v.x, v.y, v.z]);
    }
  }
  return pts;
}

/** Rigid crown cloud at spin angle θ. */
function crownCloud(r: number, s: number, theta: number, base?: Array<[number, number]>): V3[] {
  const spin = makeSpin(r, s, theta);
  return restCloud(r, s, base).map(spin);
}

const rotY = (a: number) => {
  const c = Math.cos(a), s = Math.sin(a);
  return (p: V3): V3 => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
};
const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Locks the v12 RIGID creased-crown invariants (spec scripts/gear/GEAR_FRONT_SPEC.md
 * §0/§6/§11). A dimension tweak that silently breaks a clearance fails here,
 * not on screen. Fine-grained offline oracle: scripts/gear/rigid_check.mjs.
 */
describe('gear geometry clearance invariants', () => {
  it('v12: phase 0 rests coplanar with the faces; phases ±120° rest TILTED (the point of the model)', () => {
    // At θ=0 the baked crease shape hugs both faces exactly (every vertex at
    // its depth offset from its owner face plane). At θ=±120° the same rigid
    // body CANNOT hug (R(n̂,120°) maps no face plane onto a face plane) — the
    // real puzzle rests tilted (user-verified: the groove leaves the arris,
    // sharp 90° fold riding along) and so must the sim. The tilt assert locks
    // the model so nobody "fixes" the gears flush again.
    const fold = makeFold(...UF);
    const facesRaw = gearSlotFaces(...UF);
    const faces = facesRaw.map((f) => new THREE.Vector3(...FACE_AXIS[f]));
    const fpIdx = facesRaw.findIndex((f) => Math.sin(gearWindowAngle(...UF, f)) > 0);
    const ownerFaces: number[] = [];
    for (let k = 0; k < TEETH; k++) {
      const a0 = k * ((2 * Math.PI) / TEETH);
      const ca = Math.cos(a0), sa = Math.sin(a0);
      const owner = new Set<number>();
      let tentacleQ = Infinity; // min |q| over the tentacle zone (y > 46)
      for (const [x, y] of toothDevSamples()) {
        const p = x * ca - y * sa, q = x * sa + y * ca;
        if (y > 46) tentacleQ = Math.min(tentacleQ, Math.abs(q));
        // the pie wedge reaches the crease at its radial edges — the exact-flat
        // guarantee applies to everything outside the crease arc
        if (Math.abs(q) < FOLD_R + 0.01) continue;
        const fi = q > 0 ? fpIdx : 1 - fpIdx; // fold convention: q>0 → facePlus
        const f = faces[fi];
        for (const d of TOOTH_DEPTHS) {
          const P = fold(p, q, d);
          expect(Math.abs(P[0] * f.x + P[1] * f.y + P[2] * f.z - H - d)).toBeLessThan(1e-9);
        }
        owner.add(fi);
      }
      expect(owner.size).toBe(1); // each wedge rests on a single face
      expect(tentacleQ).toBeGreaterThan(FOLD_R + 5);
      ownerFaces.push([...owner][0]);
    }
    expect(ownerFaces.filter((f) => f === 0).length).toBe(3);
    expect(ownerFaces.filter((f) => f === 1).length).toBe(3);
    // E sits on both face planes; 120° = whole pitches (dev silhouette repeats)
    const E = gearSlotApex(...UF);
    for (const f of faces) expect(E.dot(f)).toBeCloseTo(H, 9);
    expect(120 % (360 / TEETH)).toBe(0);
    // TILT lock: at θ=120° a tentacle tip stands far off BOTH face planes
    const spin = makeSpin(...UF, (2 * Math.PI) / 3);
    const tip = spin(fold(0, TOOTH_TIP, 0));
    const off = faces.map((f) => Math.abs(tip[0] * f.x + tip[1] * f.y + tip[2] * f.z - H));
    expect(Math.min(...off)).toBeGreaterThan(15);
  });

  it('fold line ≡ black line: the bar mark straddles the baked crease as one rigid feature', () => {
    // The crease lives at dev q=0; the bar spans |q| ≤ FOLD_LINE_HW, |p| ≤
    // FOLD_LINE_R and rides the same rigid body — coincidence is constructive.
    // The bar must cover the whole crease bend arc (so no colored decal sliver
    // peeks out along the fold) and its rim-hugging end arcs must run FLUSH
    // with the decal rim reach (RIM_R − 0.25 decal inset — user-locked: a
    // shorter bar leaves a colored sliver between its end and the rim).
    expect(FOLD_LINE_HW).toBeGreaterThan(FOLD_R + 1);
    expect(FOLD_LINE_R).toBeGreaterThan(COIN_R + 2);
    expect(FOLD_LINE_R).toBeCloseTo(RIM_R - 0.25, 6);
    // fat-bar parity (user-locked): half-width = the corner stickers' arris
    // setback, so the bar reads exactly as fat as the corners' black band
    expect(FOLD_LINE_HW).toBeCloseTo(H - Math.max(...CORNER_POLY.flat()), 6);
    // the end arcs must stay on the gullet rim arc (material out to RIM_R
    // underneath — no floating overhang): polar half-span < gullet half-span
    const fcx = TOOTH_HALF_W + TOOTH_FILLET_R;
    const rimEnd = Math.atan2(Math.sqrt((RIM_R + TOOTH_FILLET_R) ** 2 - fcx ** 2), fcx);
    expect(Math.asin(FOLD_LINE_HW / FOLD_LINE_R)).toBeLessThan(rimEnd - Math.PI / 3);
  });

  it('crown (wedges + hub) stays inside ball(CROWN_BALL) at the apex', () => {
    // rigid spin preserves distances to E, so θ=0 bounds every phase
    const E = gearSlotApex(...UF);
    let worst = 0;
    for (const p of restCloud(...UF)) {
      worst = Math.max(worst, Math.hypot(p[0] - E.x, p[1] - E.y, p[2] - E.z));
    }
    expect(worst).toBeLessThanOrEqual(CROWN_BALL);
  });

  it('rigid crown stays inside its sweep lathe at every spin angle (constructive corner-block clearance)', () => {
    // corners are carved by the rigid-sweep lathe about each axis; the UF
    // crown (edge direction x̂) must live inside the about-x lathe with margin
    // at EVERY spin angle. A tilted crown is only 180°-periodic, so scan the
    // full turn.
    const v = new THREE.Vector3();
    for (let ph = 0; ph < 24; ph++) {
      for (const p of crownCloud(...UF, (ph / 24) * 2 * Math.PI, toothDevSamples(2))) {
        v.set(p[0], p[1], p[2]);
        expect(inCrownSweep(v, 0, -0.5)).toBe(true);
      }
    }
  });

  it('pie-wedge crown: disc spins with the teeth, tiling is exact', () => {
    // Six full pie wedges tile disc + web + tentacles as ONE rigid surface —
    // no bearing ring, no seam circle on the face.
    const o = crownSectorOutline(0);
    const rs = o.map(([x, y]) => Math.hypot(x, y));
    // max reach keys the carve lathe / arm clearance / CROWN_BALL invariants
    expect(Math.max(...rs)).toBeLessThanOrEqual(TOOTH_TIP + 1e-6);
    expect(Math.max(...rs)).toBeGreaterThan(TOOTH_TIP - 0.1);
    // full wedge: reaches the gear center (the disc region spins too)
    expect(Math.min(...rs)).toBeLessThan(1e-9);
    // every non-apex vertex stays inside polar [60°, 120°] — six wedges tile
    // the disc exactly and neighbouring decals share their radial boundaries
    for (const [x, y] of o) {
      if (Math.hypot(x, y) < 1e-9) continue;
      const phi = (Math.atan2(y, x) * 180) / Math.PI;
      expect(phi).toBeGreaterThanOrEqual(60 - 1e-6);
      expect(phi).toBeLessThanOrEqual(120 + 1e-6);
    }
    // mirror-symmetric about the tooth axis
    for (const [x, y] of o) {
      let best = Infinity;
      for (const [u, w] of o) best = Math.min(best, Math.hypot(u + x, w - y));
      expect(best).toBeLessThan(1e-6);
    }
  });

  it('face-layer crowns clear the equator crowns (orbit circles, ball-to-ball)', () => {
    // during U the face crowns ride the circle {radius H, height H} about y while
    // the equator crowns ride {radius EDGE_R, height 0} — ball-to-ball clears
    // with margin (crowns hug the arris).
    let minD = Infinity;
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI;
      const c: V3 = [H * Math.sin(a), H, H * Math.cos(a)];
      for (let j = 0; j <= 360; j++) {
        const b = (j / 360) * 2 * Math.PI;
        const q: V3 = [EDGE_R * Math.sin(b), 0, EDGE_R * Math.cos(b)];
        minD = Math.min(minD, Math.hypot(c[0] - q[0], c[1] - q[1], c[2] - q[2]));
      }
    }
    expect(minD).toBeGreaterThan(2 * CROWN_BALL + 2);
  });

  it('crowns clear the middle caps, arms, axles and core mid-turn at every phase', () => {
    // in the middle frame the UF crown orbits about y at the relative rate −tπ/2.
    // v12: a rigid tilted crown is only 180°-periodic — scan the FULL spin
    // circle (covers riding gears at any scrambled phase AND the equator
    // gears' whirl).
    const AXES: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const arms: Array<{ nf: V3; rh: V3; ee: V3 }> = [];
    for (const nf of AXES.filter((a) => a[1] === 0)) {
      for (const rh of AXES) {
        if (Math.abs(dot3(rh, nf)) > 0.5) continue;
        arms.push({ nf, rh, ee: [
          nf[1] * rh[2] - nf[2] * rh[1], nf[2] * rh[0] - nf[0] * rh[2], nf[0] * rh[1] - nf[1] * rh[0],
        ] });
      }
    }
    const base = toothDevSamples(2.4);
    const cloud: V3[] = [];
    for (let ph = 0; ph < 12; ph++) {
      for (const p of crownCloud(...UF, (ph / 12) * 2 * Math.PI, base)) cloud.push(p);
    }
    const M = 2;
    let worst = 0;
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const Rf = rotY(-t * Math.PI);
      const Rback = rotY((t * Math.PI) / 2);
      for (const p0 of cloud) {
        const q = Rback(Rf(p0));
        const [x, y, z] = q;
        for (const [a, b] of [[x, z], [z, x]]) {
          if (Math.abs(a) > H - CAP_T - M && Math.abs(a) < H + 4 &&
              Math.abs(b) < CAP_HALF + M && Math.abs(y) < CAP_HALF + M) worst++;
        }
        for (const arm of arms) {
          const d = dot3(q, arm.nf);
          if (d < H - ARM_D - M || d > H + ARM_LIFT + M) continue;
          const r = dot3(q, arm.rh);
          if (r > ARM_R0 - M && r < ARM_R1 + ARM_LIFT + M && Math.abs(dot3(q, arm.ee)) < ARM_S + M) worst++;
        }
        if (Math.hypot(y, z) < 5.5 + M && Math.abs(x) > CORE_R && Math.abs(x) < H - CAP_T + 4) worst++;
        if (Math.hypot(y, x) < 5.5 + M && Math.abs(z) > CORE_R && Math.abs(z) < H - CAP_T + 4) worst++;
        if (Math.hypot(x, y, z) < CORE_R + M) worst++;
      }
    }
    expect(worst).toBe(0);
  });

  it('spider arms sit inside the washer rings (constructive corner clearance)', () => {
    // the washers carved out of the corners must contain the arms' whole swept
    // shell (revolve about the face-turn axis).
    for (const s of [-ARM_S, 0, ARM_S]) {
      for (const r of [ARM_R0, ARM_R1]) {
        for (const d of [H - ARM_D, H + ARM_LIFT]) {
          const rad = Math.hypot(s, d);
          expect(rad).toBeGreaterThan(WASHER_IN + 1);
          expect(rad).toBeLessThan(WASHER_OUT - 1);
          expect(r).toBeLessThan(WASHER_Y - 1);
        }
      }
    }
  });

  it('center caps + core stay inside every middle slab', () => {
    expect(CAP_HALF).toBeLessThan(CUT - SEAM);
    expect(CORE_R).toBeLessThan(CUT - SEAM);
  });

  it('corner keeps its bulk and its sticker anchor under the carves', () => {
    const carved = (p: THREE.Vector3): boolean => {
      for (const ax of [0, 1, 2]) {
        if (inCrownSweep(p, ax, 0)) return true;
        const along = ax === 0 ? p.x : ax === 1 ? p.y : p.z;
        const rad = ax === 0 ? Math.hypot(p.y, p.z) : ax === 1 ? Math.hypot(p.x, p.z) : Math.hypot(p.x, p.y);
        if (rad > WASHER_IN && rad < WASHER_OUT && Math.abs(along) < WASHER_Y) return true;
      }
      return false;
    };
    expect(carved(new THREE.Vector3(0.7 * H, 0.7 * H, 0.7 * H))).toBe(false);
    expect(carved(new THREE.Vector3(H - 10, H - 10, H - 10))).toBe(false);
    // and the trench along the arris is wide enough to host the whirling teeth
    // (which reach TOOTH_TIP along the edge mid-crossing) — but no wider than
    // the sweep wall allows
    const channelAt = (y: number): number => {
      let x = 0;
      while (x < H && carved(new THREE.Vector3(x, y, H + 1))) x += 0.5;
      return x;
    };
    expect(channelAt(H - 4)).toBeGreaterThan(TOOTH_TIP);
    expect(channelAt(H - 4)).toBeLessThan(SWEEP_RHO + SWEEP_WALL + 2);
  });

  it('corner strict-intersection body: inside every outline, roots the plates, no burr shards', () => {
    // v3 base-face construction: the body is the INTERSECTION of the three
    // sticker-outline prisms — nothing may poke past ANY face's die-cut
    // silhouette (round 2's union showed neighbouring columns through each
    // face view, user-rejected). The die-cut plate bottom must reach below
    // the intersection roof (H − FOLD_LINE_HW − max inset 0.14), or the tile
    // assembly floats on a see-through slit.
    expect(H - CORNER_PLATE_T).toBeLessThan(H - FOLD_LINE_HW - 0.14);
    const ev = new Evaluator();
    ev.useGroups = false;
    const { group } = buildCornerPiece(0, ev);
    const body = group.children[0] as THREE.Mesh;
    const pos = body.geometry.getAttribute('position') as THREE.BufferAttribute;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      for (const c of [Math.abs(pos.getX(i)), Math.abs(pos.getY(i)), Math.abs(pos.getZ(i))]) {
        if (c < lo) lo = c;
        if (c > hi) hi = c;
      }
    }
    // EVERY |coord| inside the outline's max reach — the intersection really
    // ran on all three axes (and any burr shard sprayed outside trips it: the
    // round-2 rounded-box INTERSECTION emitted a sliver vertex 0.19 out).
    expect(hi).toBeLessThan(H - FOLD_LINE_HW + 0.2);
    // …the body must still RISE past the deepened plate bottom (tile roots
    // in), and its inner reach starts at the outline minimum — the sub-47
    // inner bulk of the old box is really stripped.
    expect(hi).toBeGreaterThan(H - CORNER_PLATE_T);
    expect(lo).toBeGreaterThan(Math.min(...CORNER_POLY.flat()) - 0.2);
  });

  it('teeth: 6 SVG-shaped tentacles, parallel flanks, gullet scallop between them', () => {
    expect(TEETH).toBe(6);
    const o = crownSectorOutline(0);
    // parallel-sided tentacle: the flank runs at |x| = TOOTH_HALF_W over a
    // real span (SVG: constant width 17 from r≈52 to the tip zone)
    const flankPts = o.filter(([x, y]) => Math.abs(Math.abs(x) - TOOTH_HALF_W) < 1e-6 && y > 46);
    expect(Math.max(...flankPts.map((p) => p[1])) - Math.min(...flankPts.map((p) => p[1]))).toBeGreaterThan(8);
    // the scallop rim shows between tentacles: a real arc run at RIM_R
    const rimPts = o.filter(([x, y]) => Math.abs(Math.hypot(x, y) - RIM_R) < 1e-6);
    expect(rimPts.length).toBeGreaterThan(8);
    // the tentacle stands proud of the rim by a visible margin
    expect(TOOTH_TIP - RIM_R).toBeGreaterThan(12);
    // the decal outline insets material boundaries but SHARES the radial
    // wedge edges (no background hairline between neighbouring decals)
    const d = crownSectorOutline(0.25);
    const rMaxD = Math.max(...d.map(([x, y]) => Math.hypot(x, y)));
    expect(rMaxD).toBeLessThan(TOOTH_TIP - 0.2);
    const onEdge = (pts: Array<[number, number]>, ang: number): number =>
      pts.filter(([x, y]) => Math.hypot(x, y) > 1e-9 &&
        Math.abs(Math.atan2(y, x) - ang) < 1e-9).length;
    for (const ang of [Math.PI / 3, (2 * Math.PI) / 3]) {
      expect(onEdge(d, ang)).toBeGreaterThan(0);
      expect(onEdge(o, ang)).toBeGreaterThan(0);
    }
    // hub + backing cone never enter a corner slab along the edge axis, so
    // the block-carve lathe never needs to cover them: reach along ê < CUT +
    // SEAM (cone base |ê| ≤ 34)
    expect(Math.max(WEB_R + 2, 34)).toBeLessThan(CUT + SEAM);
  });

  it('corner sticker outlines: CCW in-quadrant polygons, no needle reversals', () => {
    // The outline is an exact die-cut polygon (traced from the reference
    // SVG + conjugate-clipped), so honest 90°-ish die-cut corners are fine;
    // what must never appear is a needle REVERSAL (≥ 120° turn) — those render
    // as hairline cracks. Also every vertex must stay on the corner block
    // (inside [CUT+SEAM, H]²) in the right quadrant, wound CCW.
    for (let ci = 0; ci < 8; ci++) {
      const signs = CORNER_POS[ci];
      const faces = FACE_AXIS.map((_, f) => f).filter((f) =>
        FACE_AXIS[f][0] * signs[0] + FACE_AXIS[f][1] * signs[1] + FACE_AXIS[f][2] * signs[2] > 0);
      for (const face of faces) {
        const { outline } = cornerStickerOutline(ci, face);
        expect(outline.length).toBeGreaterThanOrEqual(30);
        let area2 = 0;
        for (let i = 0; i < outline.length; i++) {
          const [x0, y0] = outline[i];
          const [x1, y1] = outline[(i + 1) % outline.length];
          area2 += x0 * y1 - x1 * y0;
          expect(Math.abs(x0)).toBeGreaterThan(CUT + SEAM + 2);
          expect(Math.abs(x0)).toBeLessThan(H - 4);
          expect(Math.abs(y0)).toBeGreaterThan(CUT + SEAM + 2);
          expect(Math.abs(y0)).toBeLessThan(H - 4);
        }
        expect(area2).toBeGreaterThan(0);
        let maxTurn = 0;
        for (let i = 0; i < outline.length; i++) {
          const a = outline[(i - 1 + outline.length) % outline.length];
          const b = outline[i];
          const c = outline[(i + 1) % outline.length];
          const v1 = [b[0] - a[0], b[1] - a[1]];
          const v2 = [c[0] - b[0], c[1] - b[1]];
          const dot = v1[0] * v2[0] + v1[1] * v2[1];
          const l = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
          const turn = Math.acos(Math.max(-1, Math.min(1, dot / l)));
          maxTurn = Math.max(maxTurn, turn);
        }
        expect((maxTurn * 180) / Math.PI).toBeLessThan(120);
      }
    }
  });

  // ── the corner is a GEAR: phase-synced meshing, not swept-volume avoidance ──
  // Its die-cut plates (CORNER_POLY prisms, tooth-plate deep) interdigitate
  // with the crown teeth; only the locked spin/orbit ratio (±300°/90°, Jaap's
  // GT sheet) keeps them apart. v12: transits start from every rest tilt φ0 —
  // derivation + finer 0.5° sweep in scripts/gear/mesh_check.mjs +
  // scripts/gear/rigid_check.mjs.

  /** Signed in-plane distance to a quadrant polygon (+ outside, − inside). */
  function polySigned(poly: Array<readonly [number, number]>, a: number, b: number): number {
    let inside = false;
    let dEdge = Infinity;
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[k];
      if ((yi > b) !== (yj > b) && a < ((xj - xi) * (b - yi)) / (yj - yi) + xi) inside = !inside;
      const ex = xj - xi, ey = yj - yi;
      const L2 = ex * ex + ey * ey;
      const t = L2 ? Math.max(0, Math.min(1, ((a - xi) * ex + (b - yi) * ey) / L2)) : 0;
      dEdge = Math.min(dEdge, Math.hypot(a - xi - t * ex, b - yi - t * ey));
    }
    return inside ? -dEdge : dEdge;
  }

  /** Min signed distance from a world point to any corner plate prism:
   *  CORNER_POLY (per |in-plane| quadrant fold) × band [H − CORNER_PLATE_T,
   *  H + sticker top]. Negative = inside a plate. */
  const PLATE_PRISMS = [
    { poly: CORNER_POLY, lo: H - CORNER_PLATE_T, hi: H + STICKER_TOP },
  ];
  function plateClearance(x: number, y: number, z: number): number {
    const co = [x, y, z];
    let best = Infinity;
    for (let j = 0; j < 3; j++) {
      const h = Math.abs(co[j]);
      const a = Math.abs(co[(j + 1) % 3]), b = Math.abs(co[(j + 2) % 3]);
      for (const pr of PLATE_PRISMS) {
        const dz = h < pr.lo ? pr.lo - h : h > pr.hi ? h - pr.hi : 0;
        if (dz > 4) continue;
        const dIn = polySigned(pr.poly, a, b);
        const dd = dz === 0 ? dIn : dIn <= 0 ? dz : Math.hypot(dz, dIn);
        best = Math.min(best, dd);
      }
    }
    return best;
  }

  it('MESH: the synced rigid crown clears every corner plate through full turns from every rest tilt', () => {
    // Relative crown motion vs a corner: orbit ω about the edge axis with
    // rigid spin θ = φ0 ± (300/90)·ω (the two relative branches; φ0 = the
    // scrambled start tilt — rest tilts are multiples of 60°, and the creased
    // crown shape is 180°-symmetric, so {0,60,120} covers every start shape).
    // A full 360° of ω covers all 4 start slots; ω = 0 is the rest phase.
    const { e } = gearSlotBasis(...UF);
    expect(e.x).toBe(1); // UF edge direction is x̂ — the orbit axis below
    const rest = restCloud(...UF, toothDevSamples(1.6));
    const n = gearSlotBasis(...UF).n;
    const spinQ = new THREE.Quaternion();
    const orbitQ = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const X = new THREE.Vector3(1, 0, 0);
    let worst = Infinity;
    for (const ratio of [300 / 90, -300 / 90]) {
      for (const phi0 of [0, 60, 120]) {
        for (let wDeg = 0; wDeg < 360; wDeg += 2) {
          spinQ.setFromAxisAngle(n, ((phi0 + ratio * wDeg) * Math.PI) / 180);
          orbitQ.setFromAxisAngle(X, (wDeg * Math.PI) / 180);
          for (const p of rest) {
            v.set(p[0], p[1], p[2]).applyQuaternion(spinQ).applyQuaternion(orbitQ);
            const c = plateClearance(v.x, v.y, v.z);
            if (c < worst) worst = c;
          }
        }
      }
    }
    // The fins are re-baked to the transit LIMIT (mesh_check MARGIN 0.5) —
    // they reach the gear with just the tiny meshing gap the user asked for.
    // The authoritative fine sweep (rigid_check.mjs, 0.25° + denser cloud +
    // the fold-bar-top depth) bottoms at ~0.27; this coarser 2° grid must
    // stay clearly POSITIVE (a real regression — a spike regrowing into the
    // transit band — goes ~−1). Threshold 0.15 < the true 0.27 so the coarse
    // grid never claims a clearance the fine oracle can't back.
    expect(worst).toBeGreaterThan(0.15);
  });

  it('MESH: center-arm swept annuli never enter a corner plate (static, all phases)', () => {
    // Arms (C-plates z ∈ [H−ARM_D, H], r ∈ [ARM_R0, ARM_R1], |s| ≤ ARM_S) and
    // the center cap orbit about each cube axis; their swept shells are true
    // annuli (no phase escape — centers reach every relative angle), so the
    // plates must clear them STATICALLY, margin included.
    const hit = (x: number, y: number, z: number, m: number): boolean => {
      const co = [x, y, z];
      for (let ax = 0; ax < 3; ax++) {
        const along = Math.abs(co[ax]);
        const rad = Math.hypot(co[(ax + 1) % 3], co[(ax + 2) % 3]);
        if (along <= ARM_R1 + m && along >= ARM_R0 - m &&
            rad >= H - ARM_D - m && rad <= Math.hypot(ARM_S, H) + m) return true;
        if (along <= ARM_S + m &&
            rad >= Math.hypot(ARM_R0, H - ARM_D) - m && rad <= Math.hypot(ARM_R1, H) + m) return true;
        if (along <= CAP_HALF + m && rad >= H - CAP_T - m && rad <= Math.hypot(CAP_HALF, H) + m) return true;
      }
      return false;
    };
    for (const pr of PLATE_PRISMS) {
      const xs = pr.poly.map((p) => p[0]), ys = pr.poly.map((p) => p[1]);
      for (let a = Math.min(...xs); a <= Math.max(...xs); a += 1) {
        for (let b = Math.min(...ys); b <= Math.max(...ys); b += 1) {
          if (polySigned(pr.poly, a, b) >= 0) continue;
          for (let z = pr.lo; z <= pr.hi + 1; z += 1) {
            expect(hit(a, b, z, 0.5)).toBe(false);
          }
        }
      }
    }
  });
});
