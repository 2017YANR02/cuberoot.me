import { describe, it, expect } from 'vitest';
import {
  H, CUT, SEAM, GEAR_B, WHEEL_T, R_OUT, R_ROOT, TEETH,
  SPLAT_LIFT, SPLAT_THICK, SPLAT_SIDE_LIFT, SPLAT_SIDE_DEPTH,
  R_BALL, R_BITE, RING_R, CORE_R, CAP_HALF,
  wheelRadiusAt, cornerStickerOutline,
} from '@/app/[lang]/sim/engine/gear/gearGeometry';
import { CORNER_POS, FACE_AXIS } from '@/app/[lang]/sim/engine/gear/gearState';

const RIM_MAX = R_OUT + SPLAT_LIFT + SPLAT_THICK;
const AXIAL_MAX = WHEEL_T / 2 + SPLAT_SIDE_LIFT + SPLAT_SIDE_DEPTH;

// ── numeric wheel sweep helpers (mirror .tmp/gear/derive2.mjs) ──────────────────────
// Wheels are too large for ball bounds: face-layer and equator wheels cross mid-turn
// with overlapping bounding balls, clearing only because the actual toothed solids
// pass each other. Sample one wheel's boundary against the other's solid over the
// whole turn and all 3×3 spin-phase combos (phases are independent state per ring).
const SPLAT_T = WHEEL_T - 9;
const CAP_IN_R = R_ROOT * 0.45;
const CAP_T = 12;
type V3 = [number, number, number];

function inWindow(th: number): boolean {
  const half = ((2 * Math.PI) / TEETH) * 2; // SPAN = 4 pitches
  const d1 = Math.abs((((th - Math.PI / 2 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  const d2 = Math.abs((((th + Math.PI / 2 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  return Math.min(d1, d2) < half;
}

/** Point-in-wheel-solid (wheel local frame, z = radial axis), spin s, inflated m. */
function insideWheel(x: number, y: number, z: number, s: number, m: number): boolean {
  const th = Math.atan2(y, x) - s;
  const rho = Math.hypot(x, y);
  const pr = wheelRadiusAt(th);
  if (rho < pr + m && Math.abs(z) < WHEEL_T / 2 + m) return true;
  if (inWindow(th)) {
    if (rho < pr + SPLAT_LIFT + SPLAT_THICK + m && Math.abs(z) < SPLAT_T / 2 + m) return true;
    if (rho > CAP_IN_R - m && rho < pr + SPLAT_LIFT + m &&
        z > WHEEL_T / 2 + SPLAT_SIDE_LIFT - m && z < WHEEL_T / 2 + SPLAT_SIDE_LIFT + SPLAT_SIDE_DEPTH + m) return true;
  }
  return false;
}

/** Boundary sample cloud of a wheel (material frame). */
function wheelCloud(): V3[] {
  const pts: V3[] = [];
  const N = TEETH * 14;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * 2 * Math.PI;
    const pr = wheelRadiusAt(th);
    const c = Math.cos(th), sn = Math.sin(th);
    for (const z of [-WHEEL_T / 2, 0, WHEEL_T / 2]) pts.push([pr * c, pr * sn, z]);
    for (let k = 1; k <= 5; k++) {
      const rr = (pr * k) / 5;
      pts.push([rr * c, rr * sn, WHEEL_T / 2], [rr * c, rr * sn, -WHEEL_T / 2]);
    }
    if (inWindow(th)) {
      const rb = pr + SPLAT_LIFT + SPLAT_THICK;
      for (const z of [-SPLAT_T / 2, 0, SPLAT_T / 2]) pts.push([rb * c, rb * sn, z]);
      const zc = WHEEL_T / 2 + SPLAT_SIDE_LIFT + SPLAT_SIDE_DEPTH;
      for (let k = 0; k <= 4; k++) {
        const rr = CAP_IN_R + ((pr + SPLAT_LIFT - CAP_IN_R) * k) / 4;
        pts.push([rr * c, rr * sn, zc]);
      }
      pts.push([(pr + SPLAT_LIFT) * c, (pr + SPLAT_LIFT) * sn, zc]);
    }
  }
  return pts;
}

// slot frames (columns e, t, n) for the pairs exercised during a U turn
const S2 = Math.SQRT1_2;
const SLOT_UF = { C: [0, GEAR_B, GEAR_B] as V3, e: [1, 0, 0] as V3, t: [0, S2, -S2] as V3, n: [0, S2, S2] as V3 };
const SLOT_FR = { C: [GEAR_B, 0, GEAR_B] as V3, e: [0, 1, 0] as V3, t: [-S2, 0, S2] as V3, n: [S2, 0, S2] as V3 };
const SLOT_FL = { C: [-GEAR_B, 0, GEAR_B] as V3, e: [0, 1, 0] as V3, t: [-S2, 0, -S2] as V3, n: [-S2, 0, S2] as V3 };
type Slot = typeof SLOT_UF;

const rotY = (a: number) => {
  const c = Math.cos(a), s = Math.sin(a);
  return (p: V3): V3 => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
};
const frameMul = (F: Slot, p: V3): V3 => [
  F.e[0] * p[0] + F.t[0] * p[1] + F.n[0] * p[2],
  F.e[1] * p[0] + F.t[1] * p[1] + F.n[1] * p[2],
  F.e[2] * p[0] + F.t[2] * p[1] + F.n[2] * p[2],
];
const frameMulT = (F: Slot, p: V3): V3 => [
  F.e[0] * p[0] + F.e[1] * p[1] + F.e[2] * p[2],
  F.t[0] * p[0] + F.t[1] * p[1] + F.t[2] * p[2],
  F.n[0] * p[0] + F.n[1] * p[1] + F.n[2] * p[2],
];
const rotZp = (a: number, p: V3): V3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
};
const PHASES = [0, Math.PI / 3, -Math.PI / 3];

/**
 * Locks the zero-interpenetration dimension invariants derived in .tmp/gear/derive.mjs.
 * A dimension tweak that silently breaks a clearance fails here, not on screen.
 */
describe('gear geometry clearance invariants', () => {
  it('corner bite tube contains the whole gear sweep with clearance', () => {
    // wheel + splats ⊂ ball(R_BALL) around the center; orbit+spin sweep ⊂ tube(ring, R_BALL)
    expect(R_BALL).toBeCloseTo(Math.hypot(RIM_MAX, AXIAL_MAX), 6);
    expect(R_BITE).toBeGreaterThanOrEqual(R_BALL + 3);
  });

  it('teeth poke slightly proud of the faces (the real gear cube is not a cube at rest)', () => {
    const tipMax = GEAR_B + (R_OUT + WHEEL_T / 2) / Math.SQRT2;
    expect(tipMax).toBeGreaterThan(H);
    expect(tipMax - H).toBeLessThan(0.12 * H); // but only slightly
  });

  it('inner teeth pierce the face plane (the reference front view "bridge" fragments)', () => {
    // the wheel's face-side teeth must show through the face between the center cap
    // and the corner plates — the signature look of the real puzzle's front view.
    const pierce = GEAR_B + (R_OUT + SPLAT_LIFT + SPLAT_THICK + WHEEL_T / 2 + SPLAT_SIDE_LIFT + SPLAT_SIDE_DEPTH / 2) / Math.SQRT2;
    expect(pierce).toBeGreaterThan(H + 2);
  });

  it('face-layer wheels clear the equator wheels mid-turn (toothed-solid sweep)', () => {
    // U turn: UF orbits about y at the face rate (−tπ, no spin); FR/FL orbit at the
    // middle rate (−tπ/2) and spin +tπ/3. All 3×3 initial phase combos are legal
    // states, so every combo must clear. Margin 1 unit.
    const cloud = wheelCloud();
    let worst = 0;
    for (const B of [SLOT_FR, SLOT_FL]) {
      for (const phA of PHASES) {
        for (const phB of PHASES) {
          for (let i = 0; i <= 24; i++) {
            const t = i / 24;
            const Rf = rotY(-t * Math.PI);
            const Rback = rotY((t * Math.PI) / 2);
            const sB = phB + (t * Math.PI) / 3;
            for (const p of cloud) {
              const lp = rotZp(phA, p);
              const w0 = frameMul(SLOT_UF, lp);
              const w = Rf([w0[0] + SLOT_UF.C[0], w0[1] + SLOT_UF.C[1], w0[2] + SLOT_UF.C[2]]);
              const q = Rback(w);
              const lb = frameMulT(B, [q[0] - B.C[0], q[1] - B.C[1], q[2] - B.C[2]]);
              if (insideWheel(lb[0], lb[1], lb[2], sB, 1.0)) worst++;
            }
          }
        }
      }
    }
    expect(worst).toBe(0);
  });

  it('face-layer wheels clear the middle caps, axles and core mid-turn', () => {
    // in the middle frame the UF wheel orbits about y at the relative rate −tπ/2;
    // the 4 side center caps, their axles and the core must never be touched.
    const cloud = wheelCloud();
    const M = 2;
    let worst = 0;
    for (const phA of PHASES) {
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const Rf = rotY(-t * Math.PI);
        const Rback = rotY((t * Math.PI) / 2);
        for (const p of cloud) {
          const lp = rotZp(phA, p);
          const w0 = frameMul(SLOT_UF, lp);
          const w = Rf([w0[0] + SLOT_UF.C[0], w0[1] + SLOT_UF.C[1], w0[2] + SLOT_UF.C[2]]);
          const [x, y, z] = Rback(w);
          for (const [a, b] of [[x, z], [z, x]]) {
            if (Math.abs(a) > H - CAP_T - M && Math.abs(a) < H + 4 &&
                Math.abs(b) < CAP_HALF + M && Math.abs(y) < CAP_HALF + M) worst++;
          }
          if (Math.hypot(y, z) < 5.5 + M && Math.abs(x) > CORE_R && Math.abs(x) < H - CAP_T + 4) worst++;
          if (Math.hypot(y, x) < 5.5 + M && Math.abs(z) > CORE_R && Math.abs(z) < H - CAP_T + 4) worst++;
          if (Math.hypot(x, y, z) < CORE_R + M) worst++;
        }
      }
    }
    expect(worst).toBe(0);
  });

  it('center caps + core stay inside every middle slab', () => {
    expect(CAP_HALF).toBeLessThan(CUT - SEAM);
    expect(CORE_R).toBeLessThan(CUT - SEAM);
  });

  it('center caps clear the face-gear sweep tube', () => {
    // U-cap corner vs a face gear orbiting about z (F/B moves): tube around
    // lat-circle {height GEAR_B about z, radius GEAR_B}.
    const capPt = [CAP_HALF, H, CAP_HALF];
    let minD = Infinity;
    for (let i = 0; i <= 400; i++) {
      const th = (i / 400) * 2 * Math.PI;
      const c = [GEAR_B * Math.cos(th), GEAR_B * Math.sin(th), GEAR_B];
      minD = Math.min(minD, Math.hypot(capPt[0] - c[0], capPt[1] - c[1], capPt[2] - c[2]));
    }
    expect(minD).toBeGreaterThan(R_BALL + 2);
  });

  it('wheel profile: 12 teeth, tooth centered at 90°, 60° spin is a profile symmetry', () => {
    expect(TEETH).toBe(12);
    expect(wheelRadiusAt(Math.PI / 2)).toBe(R_OUT);
    expect(wheelRadiusAt(Math.PI / 2 + Math.PI / TEETH)).toBe(R_ROOT); // mid-gullet
    for (let i = 0; i < 100; i++) {
      const a = (i / 100) * 2 * Math.PI;
      expect(wheelRadiusAt(a + Math.PI / 3)).toBeCloseTo(wheelRadiusAt(a), 9);
      expect(wheelRadiusAt(a)).toBeGreaterThanOrEqual(R_ROOT);
      expect(wheelRadiusAt(a)).toBeLessThanOrEqual(R_OUT);
    }
  });

  it('corner sticker outlines have no needle spikes (max turn angle bounded)', () => {
    // Skill hard requirement for curved sticker outlines: a needle spike is a
    // 120–180° reversal between consecutive segments; healthy rounded outlines
    // stay well below. Segments shorter than 0.75 units are merged first (the
    // ray-march + roundCorners sampling can emit near-duplicate points whose
    // direction is numeric noise, not geometry).
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

  it('bite tube reaches under the corner blocks (the visible concave scoop exists)', () => {
    // the ring circle passes at radius RING_R ≈ 1.02H; a corner's inner-bottom edge
    // point must be inside the tube (carved), its center region outside (survives).
    const carved = [0.9 * H, CUT + SEAM + 2, 0.9 * H];   // just above the cut plane, near the ring
    const carvedDist = Math.hypot(Math.hypot(carved[0], carved[2]) - RING_R, carved[1]);
    expect(carvedDist).toBeLessThan(R_BITE);
    const kept = [0.7 * H, 0.7 * H, 0.7 * H];
    for (const axis of [0, 1, 2]) {
      const along = kept[axis];
      const others = kept.filter((_, i) => i !== axis);
      const d = Math.hypot(Math.hypot(others[0], others[1]) - RING_R, along);
      expect(d).toBeGreaterThan(R_BITE);
    }
  });
});
