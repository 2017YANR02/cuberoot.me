import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  H, CUT, SEAM, TEETH, TOOTH_TIP, WEB_R, PLATE_T, FOLD_R,
  CROWN_BALL, EDGE_R, CORE_R, CAP_HALF,
  ARM_R0, ARM_R1, ARM_S, ARM_D, WASHER_IN, WASHER_OUT, WASHER_Y,
  SWEEP_RHO, SWEEP_WALL, TOOTH_HALF_ANG, TOOTH_ROOT, COIN_GAP, COIN_T, COIN_R, toothTrapezoid,
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

/** INDEPENDENT fold-glide map (re-derived from spec §0, NOT imported from the
 *  engine): developed disc coords (p = along the fold line ê, q = across it,
 *  q > 0 on facePlus, d = height above the surface) → world. |q| ≥ FOLD_R lies
 *  flat ON a face plane; |q| < FOLD_R wraps a FOLD_R arc around the arris
 *  (center E − FOLD_R·√2·n̂). This is the trusted oracle the engine's
 *  foldPoint() is judged against. */
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

/** Developed-plane samples of ONE canonical tooth (rest angle 90°): a polar
 *  grid over the trapezoid (conservative superset at the chord bases) PLUS the
 *  exact root/tip chord rows (the chords dip INSIDE the polar arcs — the root
 *  chord is the bearing's binding constraint). */
function toothDevSamples(): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let bi = -6; bi <= 6; bi++) {
    const beta = (bi / 6) * TOOTH_HALF_ANG;
    for (let ai = 0; ai <= 6; ai++) {
      const rad = TOOTH_ROOT + ((TOOTH_TIP - TOOTH_ROOT) * ai) / 6;
      pts.push([rad * Math.sin(beta), rad * Math.cos(beta)]);
    }
  }
  const sinA = Math.sin(TOOTH_HALF_ANG), cosA = Math.cos(TOOTH_HALF_ANG);
  for (let t = -6; t <= 6; t++) {
    pts.push([(t / 6) * TOOTH_ROOT * sinA, TOOTH_ROOT * cosA]); // root chord
    pts.push([(t / 6) * TOOTH_TIP * sinA, TOOTH_TIP * cosA]);   // tip chord
  }
  return pts;
}

const TOOTH_DEPTHS = [STICKER_TOP, 0, -PLATE_T];

/** World-space cloud of the whole gliding crown at developed spin angle θ:
 *  all 6 teeth through the fold map + the palm hub lathe revolved about n̂.
 *  Pass `base` to override the tooth samples (the default polar grid is a
 *  conservative superset that bulges past the tip chord). */
function crownCloud(r: number, s: number, theta: number, base: Array<[number, number]> = toothDevSamples()): V3[] {
  const fold = makeFold(r, s);
  const pts: V3[] = [];
  for (let k = 0; k < TEETH; k++) {
    const a0 = k * ((2 * Math.PI) / TEETH) + theta;
    const ca = Math.cos(a0), sa = Math.sin(a0);
    for (const [x, y] of base) {
      const p = x * ca - y * sa, q = x * sa + y * ca;
      for (const d of TOOTH_DEPTHS) pts.push(fold(p, q, d));
    }
  }
  // palm hub body: lathe profile extremes (incl. the apex) revolved about n̂
  // (rides the lower cone t = HUB_T − rad, fully under the disc slab)
  const E = gearSlotApex(r, s);
  const { e, t, n } = gearSlotBasis(r, s);
  const hubT = -(COIN_T + COIN_GAP) * Math.SQRT2;
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

/** Bent-coin cap cloud (home frame, world coords): rim + interior + sticker top
 *  of both half-discs. Rides the ORBIT pivot only — no spin phases apply. */
function coinCloud(r: number, s: number): V3[] {
  const E = gearSlotApex(r, s);
  const { e } = gearSlotBasis(r, s);
  const faces = gearSlotFaces(r, s);
  const fPlus = faces.find((f) => Math.sin(gearWindowAngle(r, s, f)) > 0)!;
  const fMinus = faces.find((f) => f !== fPlus)!;
  const coinTop = 0;          // slab top ON the face plane (unified skyline)
  const coinBot = -COIN_T;
  const pts: V3[] = [];
  const v = new THREE.Vector3();
  for (const [face, other] of [[fPlus, fMinus], [fMinus, fPlus]]) {
    const fHat = new THREE.Vector3(...FACE_AXIS[face]);
    const hHat = new THREE.Vector3(...FACE_AXIS[other]);
    for (let i = 0; i <= 16; i++) {
      const psi = -Math.PI / 2 + (Math.PI * i) / 16;
      for (const rf of [1, 0.6]) {
        const z = COIN_R * rf * Math.sin(psi);
        const a = Math.max(0.45, COIN_R * rf * Math.cos(psi));
        for (const h of [coinBot, coinTop, coinTop + STICKER_TOP]) {
          v.copy(E).addScaledVector(e, z).addScaledVector(hHat, coinTop - a).addScaledVector(fHat, h);
          pts.push([v.x, v.y, v.z]);
        }
      }
    }
  }
  return pts;
}

const rotY = (a: number) => {
  const c = Math.cos(a), s = Math.sin(a);
  return (p: V3): V3 => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
};
const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Locks the fold-glide crown invariants (spec .tmp/gear/GEAR_FRONT_SPEC.md §0/§6).
 * A dimension tweak that silently breaks a clearance fails here, not on screen.
 */
describe('gear geometry clearance invariants', () => {
  it('HARD (spec §0): at every rest phase the disc and all tentacles are coplanar', () => {
    // The user-locked hard requirement: the half-disc and its 3 tentacles per
    // face lie IN the same plane — the face sticker plane — at all three rest
    // phases. Every tooth vertex must sit EXACTLY at its depth offset from
    // one face plane (the disc slab top is the face plane itself, its sticker
    // top the same STICKER_TOP offset), and each tooth entirely on ONE face.
    const fold = makeFold(...UF);
    const faces = gearSlotFaces(...UF).map((f) => new THREE.Vector3(...FACE_AXIS[f]));
    const base = toothDevSamples();
    for (let phase = 0; phase < 3; phase++) {
      const theta = (phase * 2 * Math.PI) / 3;
      const ownerFaces: number[] = [];
      for (let k = 0; k < TEETH; k++) {
        const a0 = k * ((2 * Math.PI) / TEETH) + theta;
        const ca = Math.cos(a0), sa = Math.sin(a0);
        const owner = new Set<number>();
        for (const [x, y] of base) {
          const p = x * ca - y * sa, q = x * sa + y * ca;
          // rest teeth stay far clear of the crease zone — EXACTLY flat
          expect(Math.abs(q)).toBeGreaterThan(FOLD_R + 5);
          for (const d of TOOTH_DEPTHS) {
            const P = fold(p, q, d);
            const on = faces
              .map((f, i) => [i, P[0] * f.x + P[1] * f.y + P[2] * f.z - H] as const)
              .filter(([, proud]) => Math.abs(proud - d) < 1e-9);
            expect(on.length).toBe(1); // exactly in ONE face's offset plane
            owner.add(on[0][0]);
          }
        }
        expect(owner.size).toBe(1); // the whole tooth lies on a single face
        ownerFaces.push([...owner][0]);
      }
      // 3 tentacles per face half at every rest phase
      expect(ownerFaces.filter((f) => f === 0).length).toBe(3);
      expect(ownerFaces.filter((f) => f === 1).length).toBe(3);
    }
    // one spin step (120°) = a whole number of pitches, so the crown rests
    // identically after every move — and E sits on both face planes, so the
    // disc slab top IS the face plane (tooth tops coplanar with it)
    const E = gearSlotApex(...UF);
    for (const f of faces) expect(E.dot(f)).toBeCloseTo(H, 9);
    expect(120 % (360 / TEETH)).toBe(0);
  });

  it('crown (teeth + web) + coin cap stay inside ball(CROWN_BALL) at the apex', () => {
    const E = gearSlotApex(...UF);
    let worst = 0;
    for (const p of [...crownCloud(...UF, 0), ...coinCloud(...UF)]) {
      worst = Math.max(worst, Math.hypot(p[0] - E.x, p[1] - E.y, p[2] - E.z));
    }
    expect(worst).toBeLessThanOrEqual(CROWN_BALL);
  });

  it('gliding crown stays inside its shelf lathe at every spin angle (constructive corner clearance)', () => {
    // corners are carved by the glide-shelf lathe about each axis; the UF
    // crown (edge direction x̂) must live inside the about-x lathe with margin
    // at EVERY spin angle — the glide repeats each 60° pitch, so one pitch of
    // angles covers the whole 480°-per-flip whirl.
    const v = new THREE.Vector3();
    for (let ph = 0; ph <= 24; ph++) {
      for (const p of crownCloud(...UF, (ph / 24) * (Math.PI / 3))) {
        v.set(p[0], p[1], p[2]);
        expect(inCrownSweep(v, 0, -0.5)).toBe(true);
      }
    }
  });

  it('bent-coin cap: flush with the blocks, clear of corners and neighbours', () => {
    const axes = gearSlotFaces(...UF).map((f) => new THREE.Vector3(...FACE_AXIS[f]));
    // corner bodies+stickers can reach at most this far from the edge axis
    const cornerReach = Math.hypot(H + STICKER_TOP, H - 4) + 2;
    const v = new THREE.Vector3();
    for (const p of coinCloud(...UF)) {
      v.set(p[0], p[1], p[2]);
      // the slab never dips below −COIN_T nor rises above the sticker band —
      // the disc tops out level with every block sticker (unified skyline)
      const proud = Math.max(...axes.map((a) => v.dot(a) - H));
      expect(proud).toBeGreaterThanOrEqual(-COIN_T - 0.01);
      expect(proud).toBeLessThanOrEqual(STICKER_TOP + 0.01);
      // inside the trench the shelf lathe has already hollowed the corners
      // deeper than the cap dips; the fold ends stay clear of the corner
      // walls by the |edge| ≤ COIN_R < CUT + SEAM slab bound below
      expect(inCrownSweep(v, 0, -0.5) || Math.hypot(v.y, v.z) > cornerReach).toBe(true);
    }
    // two caps over the same face (perpendicular edges) stay apart in-plane
    expect(H).toBeGreaterThan(2 * COIN_R + 2);
    // the cap never leaves its middle slab along the edge axis: every relative
    // edge-axis rotation (R/L for a UF gear) preserves that coordinate, so
    // |edge| ≤ COIN_R < CUT + SEAM keeps it clear of the corner walls
    expect(COIN_R).toBeLessThan(CUT + SEAM - 2);
    // user-locked: the disc radius EQUALS the visible tentacle length — the
    // disc center sits ON the arris (cap top on the face plane), so the rim
    // is at COIN_R in-face and the flat tooth's tip chord at TOOTH_TIP·cos11°
    expect(TOOTH_TIP * Math.cos(TOOTH_HALF_ANG) - COIN_R).toBeCloseTo(COIN_R, 0);
  });

  it('one-piece bearing: teeth hug the disc rim but stay outside it at every spin angle', () => {
    // ring gap: the root chord sits COIN_GAP..2 outside the rim, so each
    // tentacle reads as grown on the disc with only a hairline seam
    const rootChord = TOOTH_ROOT * Math.cos(TOOTH_HALF_ANG);
    expect(rootChord - COIN_R).toBeGreaterThanOrEqual(COIN_GAP);
    expect(rootChord - COIN_R).toBeLessThan(2);
    // fold-crossing teeth also miss the OTHER half-slab: any tooth point that
    // enters a face's slab band (depth ≤ COIN_T) keeps in-plane distance
    // √(rootChord² − COIN_T²) > COIN_R from the gear center — analytic bound
    expect(Math.sqrt(rootChord * rootChord - COIN_T * COIN_T) - COIN_R).toBeGreaterThan(0.3);
    // numeric scan: at every spin angle, every tooth point inside either
    // face's slab band keeps in-plane distance > COIN_R + 0.25 — the crown
    // whirls around the static disc like a bearing
    const E = gearSlotApex(...UF);
    const faces = gearSlotFaces(...UF).map((f) => new THREE.Vector3(...FACE_AXIS[f]));
    const fold = makeFold(...UF);
    const base = toothDevSamples();
    const v = new THREE.Vector3();
    for (let ph = 0; ph <= 24; ph++) {
      const theta = (ph / 24) * (Math.PI / 3);
      for (let k = 0; k < TEETH; k++) {
        const a0 = k * ((2 * Math.PI) / TEETH) + theta;
        const ca = Math.cos(a0), sa = Math.sin(a0);
        for (const [x, y] of base) {
          const p = x * ca - y * sa, q = x * sa + y * ca;
          for (const d of TOOTH_DEPTHS) {
            const P = fold(p, q, d);
            v.set(P[0] - E.x, P[1] - E.y, P[2] - E.z);
            for (const fHat of faces) {
              const proud = v.dot(fHat);
              if (proud < -COIN_T - 0.25) continue; // under the slab — clear
              const inPlane = Math.sqrt(Math.max(0, v.lengthSq() - proud * proud));
              expect(inPlane).toBeGreaterThan(COIN_R + 0.25);
            }
          }
        }
      }
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

  it('face-layer crowns clear the middle caps, arms, axles and core mid-turn', () => {
    // in the middle frame the UF crown orbits about y at the relative rate −tπ/2.
    // A riding gear does not spin, but scan spin angles anyway (0..60°) so the
    // invariant also covers the equator gears' own whirl (480°/flip sweeps every
    // angle) — the glide repeats each 60° pitch, so one pitch suffices.
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
    const cloud: V3[] = [];
    for (let ph = 0; ph < 6; ph++) {
      for (const p of crownCloud(...UF, (ph / 6) * (Math.PI / 3))) cloud.push(p);
    }
    // the coin cap rides the same orbit spin-free — scan it through the same
    // relative turn (it hugs the arris far above every cap/arm/axle)
    for (const p of coinCloud(...UF)) cloud.push(p);
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
    // and the trench along the arris is wide enough to host the gliding teeth
    // (which reach TOOTH_TIP along the edge mid-crossing) — but no wider than
    // the shelf wall allows
    const channelAt = (y: number): number => {
      let x = 0;
      while (x < H && carved(new THREE.Vector3(x, y, H + 1))) x += 0.5;
      return x;
    };
    expect(channelAt(H - 4)).toBeGreaterThan(TOOTH_TIP);
    expect(channelAt(H - 4)).toBeLessThan(SWEEP_RHO + SWEEP_WALL + 2);
  });

  it('teeth: 6 isosceles trapezoids, radial legs through the center, gaps wider than both bases', () => {
    expect(TEETH).toBe(6);
    const trap = toothTrapezoid(TOOTH_TIP);
    expect(trap.length).toBe(4);
    const [oL, iL, iR, oR] = trap;
    // legs pass through the gear center: corner vectors are collinear (cross = 0)
    expect(oL[0] * iL[1] - oL[1] * iL[0]).toBeCloseTo(0, 9);
    expect(oR[0] * iR[1] - oR[1] * iR[0]).toBeCloseTo(0, 9);
    // isosceles: mirror-symmetric about the tooth axis
    expect(oL[0]).toBeCloseTo(-oR[0], 9);
    expect(oL[1]).toBeCloseTo(oR[1], 9);
    // bases are chords at TOOTH_ROOT and TOOTH_TIP
    expect(Math.hypot(oR[0], oR[1])).toBeCloseTo(TOOTH_TIP, 9);
    expect(Math.hypot(iR[0], iR[1])).toBeCloseTo(TOOTH_ROOT, 9);
    // the angular gap between neighbours beats the tooth width, so at EVERY
    // radius the gap chord is wider than the tooth chord — hence wider than
    // both bases compared at their own radii
    const gapHalf = Math.PI / TEETH - TOOTH_HALF_ANG;
    expect(gapHalf).toBeGreaterThan(TOOTH_HALF_ANG);
    const outerBase = 2 * TOOTH_TIP * Math.sin(TOOTH_HALF_ANG);
    const innerBase = 2 * TOOTH_ROOT * Math.sin(TOOTH_HALF_ANG);
    const outerGap = 2 * TOOTH_TIP * Math.sin(gapHalf);
    expect(outerGap).toBeGreaterThan(outerBase);
    expect(outerGap).toBeGreaterThan(innerBase);
    expect(2 * TOOTH_ROOT * Math.sin(gapHalf)).toBeGreaterThan(innerBase);
    // rest teeth sit 30° − 11° = 19° clear of the fold line, far outside the
    // FOLD_R crease zone: the rest geometry is EXACTLY flat (spec §0)
    expect(TOOTH_ROOT * Math.sin(Math.PI / 6 - TOOTH_HALF_ANG)).toBeGreaterThan(FOLD_R + 5);
    // the palm hub hides fully inside the disc footprint: its bottom rim's
    // in-face reach (2·WEB_R + |HUB_T| + PLATE_T·√2)/√2 stays under COIN_R
    const hubT = (COIN_T + COIN_GAP) * Math.SQRT2;
    expect((2 * WEB_R + hubT + PLATE_T * Math.SQRT2) / Math.SQRT2)
      .toBeLessThanOrEqual(COIN_R);
    // hub + backing cone never enter a corner slab along the edge axis, so
    // they need no carve: reach along ê < CUT + SEAM (cone base |ê| ≤ 34)
    expect(Math.max(WEB_R + 2, 34)).toBeLessThan(CUT + SEAM);
  });

  it('corner sticker outlines: CCW in-quadrant polygons, no needle reversals', () => {
    // The outline is now an exact die-cut polygon (traced from the reference
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
  // with the crown teeth; only the locked spin/orbit ratio (±480°/90°, issue
  // #32) keeps them apart. Derivation + finer 0.5° sweep in .tmp/gear/mesh_check.mjs
  // (offline: transit +0.93, rest +8.07, arms 0 hits).

  /** Min signed distance from a world point to any corner plate prism:
   *  polygon CORNER_POLY (per |in-plane| quadrant fold) × band
   *  [H − PLATE_T, H + sticker top]. Negative = inside a plate. */
  function plateClearance(x: number, y: number, z: number): number {
    const co = [x, y, z];
    let best = Infinity;
    for (let j = 0; j < 3; j++) {
      const h = Math.abs(co[j]);
      const dz = h < H - PLATE_T ? H - PLATE_T - h : h > H + STICKER_TOP ? h - (H + STICKER_TOP) : 0;
      if (dz > 4) continue;
      const a = Math.abs(co[(j + 1) % 3]), b = Math.abs(co[(j + 2) % 3]);
      let inside = false;
      let dEdge = Infinity;
      for (let i = 0, k = CORNER_POLY.length - 1; i < CORNER_POLY.length; k = i++) {
        const [xi, yi] = CORNER_POLY[i], [xj, yj] = CORNER_POLY[k];
        if ((yi > b) !== (yj > b) && a < ((xj - xi) * (b - yi)) / (yj - yi) + xi) inside = !inside;
        const ex = xj - xi, ey = yj - yi;
        const L2 = ex * ex + ey * ey;
        const t = L2 ? Math.max(0, Math.min(1, ((a - xi) * ex + (b - yi) * ey) / L2)) : 0;
        dEdge = Math.min(dEdge, Math.hypot(a - xi - t * ex, b - yi - t * ey));
      }
      const dIn = inside ? -dEdge : dEdge;
      const dd = dz === 0 ? dIn : dIn <= 0 ? dz : Math.hypot(dz, dIn);
      best = Math.min(best, dd);
    }
    return best;
  }

  it('MESH: the synced gliding crown clears every corner plate through full turns', () => {
    // Relative crown motion vs a corner: orbit ω about the edge axis with spin
    // θ = ±(480/90)·ω (the two relative branches: corner in / out of the
    // turning layer). A full 360° of ω covers all 4 start slots (120° per slot
    // step = 2 tooth pitches = tooth-identical). ω = 0 is the rest phase.
    const { e } = gearSlotBasis(...UF);
    expect(e.x).toBe(1); // UF edge direction is x̂ — the orbit axis below
    // exact-shape tooth samples: clamp the polar grid's tip arc onto the tip
    // chord (the default superset would bill the mesh for fictional material
    // bulging ≤ 1.14 past the chord and eat the real margin)
    const tipY = TOOTH_TIP * Math.cos(TOOTH_HALF_ANG);
    const exact = toothDevSamples().map(([x, y]): [number, number] => [x, Math.min(y, tipY)]);
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    let worst = Infinity;
    for (const ratio of [480 / 90, -480 / 90]) {
      for (let wDeg = 0; wDeg < 360; wDeg += 2) {
        const theta = (ratio * wDeg * Math.PI) / 180;
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (wDeg * Math.PI) / 180);
        for (const [px, py, pz] of crownCloud(...UF, theta, exact)) {
          v.set(px, py, pz).applyQuaternion(q);
          const c = plateClearance(v.x, v.y, v.z);
          if (c < worst) worst = c;
        }
      }
    }
    // offline fine-grained (0.5°, denser cloud) minimum is +0.93 — the
    // coarser test grid must stay comfortably positive; a real regression
    // (e.g. a wing regrowing into the transit band) goes ~−2
    expect(worst).toBeGreaterThan(0.5);
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
    const xs = CORNER_POLY.map((p) => p[0]), ys = CORNER_POLY.map((p) => p[1]);
    const inPoly = (a: number, b: number): boolean => {
      let inside = false;
      for (let i = 0, k = CORNER_POLY.length - 1; i < CORNER_POLY.length; k = i++) {
        const [xi, yi] = CORNER_POLY[i], [xj, yj] = CORNER_POLY[k];
        if ((yi > b) !== (yj > b) && a < ((xj - xi) * (b - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    for (let a = Math.min(...xs); a <= Math.max(...xs); a += 1) {
      for (let b = Math.min(...ys); b <= Math.max(...ys); b += 1) {
        if (!inPoly(a, b)) continue;
        for (let z = H - PLATE_T; z <= H + STICKER_TOP; z += 1) {
          expect(hit(a, b, z, 0.5)).toBe(false);
        }
      }
    }
  });
});
