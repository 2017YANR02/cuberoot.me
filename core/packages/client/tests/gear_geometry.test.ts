import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  H, CUT, SEAM, TEETH, TOOTH_TIP, WEB_R, PLATEAU, D0, PLATE_T,
  CROWN_BALL, EDGE_R, CORE_R, CAP_HALF,
  ARM_R0, ARM_R1, ARM_S, ARM_D, WASHER_IN, WASHER_OUT, WASHER_Y,
  SWEEP_RHO, SWEEP_WALL, TOOTH_HALF_ANG, TOOTH_ROOT, toothTrapezoid,
  gearFacetFrame, gearSlotApex, gearSlotBasis, gearSlotFaces, gearWindowAngle,
  cornerStickerOutline, inCrownSweep,
} from '@/app/[lang]/sim/engine/gear/gearGeometry';
import { CORNER_POS, FACE_AXIS } from '@/app/[lang]/sim/engine/gear/gearState';

const CAP_T = 12;
const ARM_LIFT = 3.5;
type V3 = [number, number, number];

// slots used by the sweeps: UF = (ring 1, slot 0); FR = (0,0); FL = (0,3)
const UF: [number, number] = [1, 0];

/** Crown boundary cloud (home frame, world coords) for a slot: a grid over each
 *  trapezoid tooth plate (legs, chord bases, interior) at the three slab depths
 *  (sticker top / plateau plane / plate back), plus the palm web + sector decal
 *  lathe profile revolved. */
function crownCloud(r: number, s: number): V3[] {
  const E = gearSlotApex(r, s);
  const { e, t, n } = gearSlotBasis(r, s);
  const pts: V3[] = [];
  const v = new THREE.Vector3();
  const push = (): void => { pts.push([v.x, v.y, v.z]); };
  const inY = TOOTH_ROOT * Math.cos(TOOTH_HALF_ANG);  // inner chord height
  for (let k = 0; k < TEETH; k++) {
    const { m, g, w } = gearFacetFrame(r, s, k);
    const outY = TOOTH_TIP * Math.cos(TOOTH_HALF_ANG); // outer chord height
    for (let bi = -6; bi <= 6; bi++) {
      const beta = (bi / 6) * TOOTH_HALF_ANG;
      const aIn = inY / Math.cos(beta);
      const aOut = outY / Math.cos(beta);
      for (const a of [aIn, (aIn + aOut) / 2, aOut]) {
        const x = a * Math.sin(beta), y = a * Math.cos(beta);
        for (const d of [D0 + 0.5 + 2.6, D0, D0 - PLATE_T]) {
          v.set(
            E.x + w.x * x + g.x * y + m.x * d,
            E.y + w.y * x + g.y * y + m.y * d,
            E.z + w.z * x + g.z * y + m.z * d,
          );
          push();
        }
      }
    }
  }
  // palm web body + sector decals: lathe profile extremes revolved about n̂
  const rimRad = (WEB_R + D0) / Math.SQRT2;
  const secIn = 1.2;
  const prof: Array<[number, number]> = [
    [0.01, PLATEAU - PLATE_T * Math.SQRT2 - 0.01],
    [rimRad, PLATEAU - PLATE_T * Math.SQRT2 - rimRad],
    [rimRad, PLATEAU - rimRad],
    [rimRad - 0.6, PLATEAU + (0.5 + 2.6) * Math.SQRT2 - (rimRad - 0.6)],
    [secIn, PLATEAU + (0.5 + 2.6) * Math.SQRT2 - secIn],
  ];
  for (let i = 0; i < 24; i++) {
    const phi = (i / 24) * 2 * Math.PI;
    const u = e.clone().multiplyScalar(Math.cos(phi)).addScaledVector(t, Math.sin(phi));
    for (const [rad, ty] of prof) {
      v.copy(E).addScaledVector(u, rad).addScaledVector(n, ty);
      push();
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
 * Locks the umbrella-crown clearance invariants derived in .tmp/gear/derive4.mjs
 * (spec .tmp/gear/GEAR_FRONT_SPEC.md §6). A dimension tweak that silently breaks
 * a clearance fails here, not on screen.
 */
describe('gear geometry clearance invariants', () => {
  it('face-pointing teeth ride flat plateaus parallel to the two face planes', () => {
    // the folded-circle signature of the real puzzle: at rest each half of the
    // gear shows a flat half-gear over its face (3 tentacles per half). Tooth
    // k=0 (φ=90°) and k=3 (φ=270°) must have facet normal == face normal, so
    // their plates sit D0 above the face planes through the apex E.
    const faces = gearSlotFaces(...UF);
    const fPlus = faces.find((f) => Math.sin(gearWindowAngle(...UF, f)) > 0)!;
    const fMinus = faces.find((f) => f !== fPlus)!;
    const E = gearSlotApex(...UF);
    const m0 = gearFacetFrame(...UF, 0).m;
    const m3 = gearFacetFrame(...UF, 3).m;
    const n0 = new THREE.Vector3(...FACE_AXIS[fPlus]);
    const n3 = new THREE.Vector3(...FACE_AXIS[fMinus]);
    expect(m0.distanceTo(n0)).toBeLessThan(1e-12);
    expect(m3.distanceTo(n3)).toBeLessThan(1e-12);
    expect(E.dot(n0)).toBeCloseTo(H, 9);
    expect(E.dot(n3)).toBeCloseTo(H, 9);
    // one spin step (120°) = a whole number of pitches, so the crown rests
    // identically after every move
    expect((120 % (360 / TEETH))).toBe(0);
  });

  it('crown (plates + decals + hub) stays inside ball(CROWN_BALL) at its apex', () => {
    const E = gearSlotApex(...UF);
    let worst = 0;
    for (const p of crownCloud(...UF)) {
      worst = Math.max(worst, Math.hypot(p[0] - E.x, p[1] - E.y, p[2] - E.z));
    }
    expect(worst).toBeLessThanOrEqual(CROWN_BALL);
  });

  it('crown stays inside its sweep lathe (constructive corner clearance)', () => {
    // corners are carved by the lathe of the crown sweep about each axis; an
    // equator crown (FR, y-turns) must live inside the about-y lathe with margin,
    // at EVERY spin phase (the 480°-per-flip whirl passes through all of them).
    const spinAxis = gearSlotBasis(0, 0).n;
    const base = crownCloud(0, 0);
    const v = new THREE.Vector3();
    for (let ph = 0; ph < 8; ph++) {
      const q = new THREE.Quaternion().setFromAxisAngle(spinAxis, (ph / 8) * (Math.PI / 3));
      for (const p of base) {
        v.set(p[0], p[1], p[2]).applyQuaternion(q);
        expect(inCrownSweep(v, 1, -0.5)).toBe(true);
      }
    }
  });

  it('face-layer crowns clear the equator crowns (orbit circles, ball-to-ball)', () => {
    // during U the face crowns ride the circle {radius H, height H} about y while
    // the equator crowns ride {radius EDGE_R, height 0} — unlike the abandoned
    // 45°-disc model, ball-to-ball now clears with margin.
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
    // A riding gear does not spin, but scan spin phases anyway (0..60°) so the
    // invariant also covers the equator gears' own whirl (480°/flip sweeps every
    // phase) — the crown repeats each 60° pitch, so one pitch of phases suffices.
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
    const baseCloud = crownCloud(...UF);
    const spinAxis = gearSlotBasis(...UF).n;
    const cloud: V3[] = [];
    const v = new THREE.Vector3();
    for (let ph = 0; ph < 6; ph++) {
      const q = new THREE.Quaternion().setFromAxisAngle(spinAxis, (ph / 6) * (Math.PI / 3));
      for (const p of baseCloud) {
        v.set(p[0], p[1], p[2]).applyQuaternion(q);
        cloud.push([v.x, v.y, v.z]);
      }
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
    // and the fan channel on the face is wide enough to host the fan's reach
    // along the edge (SWEEP_RHO) — but no wider than the sweep wall allows
    const channelAt = (y: number): number => {
      let x = 0;
      while (x < H && carved(new THREE.Vector3(x, y, H + 1))) x += 0.5;
      return x;
    };
    expect(channelAt(H - 4)).toBeGreaterThan(SWEEP_RHO + 0.5);
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
    // teeth spring from under the palm rim
    expect(TOOTH_ROOT).toBeLessThan(WEB_R);
  });

  it('corner sticker outlines have no needle spikes (max turn angle bounded)', () => {
    // Skill hard requirement for curved sticker outlines: a needle spike is a
    // 120–180° reversal between consecutive segments; healthy rounded outlines
    // stay well below. Segments shorter than 0.75 units are merged first (the
    // ray-march sampling can emit near-duplicate points whose direction is
    // numeric noise, not geometry).
    for (let ci = 0; ci < 8; ci++) {
      const signs = CORNER_POS[ci];
      const faces = FACE_AXIS.map((_, f) => f).filter((f) =>
        FACE_AXIS[f][0] * signs[0] + FACE_AXIS[f][1] * signs[1] + FACE_AXIS[f][2] * signs[2] > 0);
      for (const face of faces) {
        const { outline } = cornerStickerOutline(ci, face);
        expect(outline.length).toBeGreaterThan(40);
        const pts: Array<[number, number]> = [];
        for (const p of outline) {
          const prev = pts[pts.length - 1];
          if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 0.75) pts.push([p[0], p[1]]);
        }
        let maxTurn = 0;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[(i - 1 + pts.length) % pts.length];
          const b = pts[i];
          const c = pts[(i + 1) % pts.length];
          const v1 = [b[0] - a[0], b[1] - a[1]];
          const v2 = [c[0] - b[0], c[1] - b[1]];
          const dot = v1[0] * v2[0] + v1[1] * v2[1];
          const l = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
          const turn = Math.acos(Math.max(-1, Math.min(1, dot / l)));
          maxTurn = Math.max(maxTurn, turn);
        }
        expect((maxTurn * 180) / Math.PI).toBeLessThan(60);
      }
    }
  });
});
