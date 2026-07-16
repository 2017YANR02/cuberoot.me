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

  it('gear wheel stays inside its two face slabs (plane-separated from the middle)', () => {
    const minFaceCoord = GEAR_B - (RIM_MAX + AXIAL_MAX) / Math.SQRT2;
    expect(minFaceCoord).toBeGreaterThan(CUT + SEAM);
  });

  it('teeth poke slightly proud of the faces (the real gear cube is not a cube at rest)', () => {
    const tipMax = GEAR_B + (R_OUT + WHEEL_T / 2) / Math.SQRT2;
    expect(tipMax).toBeGreaterThan(H);
    expect(tipMax - H).toBeLessThan(0.12 * H); // but only slightly
  });

  it('face-riding gears clear the equator gears mid-turn (ball-to-ball)', () => {
    // in the middle frame a face gear orbits ±90° about the move axis along the
    // lat-circle {height GEAR_B, radius GEAR_B}; nearest approach to an equator
    // gear center happens at 45° relative (verified numerically in derive.mjs).
    let minD = Infinity;
    for (let i = 0; i <= 400; i++) {
      const t = -Math.PI / 2 * (i / 400);
      const c = [GEAR_B * Math.cos(t), GEAR_B, -GEAR_B * Math.sin(t)]; // UR gear under U
      for (const g of [[GEAR_B, 0, GEAR_B], [GEAR_B, 0, -GEAR_B], [-GEAR_B, 0, GEAR_B], [-GEAR_B, 0, -GEAR_B]]) {
        minD = Math.min(minD, Math.hypot(c[0] - g[0], c[1] - g[1], c[2] - g[2]));
      }
    }
    expect(minD).toBeGreaterThan(2 * R_BALL + 2);
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

  it('wheel profile: 18 teeth, tooth centered at 90°, 60° spin is a profile symmetry', () => {
    expect(TEETH).toBe(18);
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
