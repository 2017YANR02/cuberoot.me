import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { chooseMarkedFingerPlan, fingerChannels, MarkedFingerMotion, type MarkedTurnRequest } from '@/app/[lang]/sim/engine/hands/markedFingerMotion';
import { MARKED_CLEARANCE, MARKED_FINGER_PROFILES } from '@/app/[lang]/sim/engine/hands/markedFingerPoses';
import { homeLeft, homeRight } from '@/app/[lang]/sim/engine/hands/handPoses';
import { approachCost, strokeTangent, type FingerBearing } from '@/app/[lang]/sim/engine/hands/strokeGeometry';
import { FINGER_NAMES } from '@/app/[lang]/sim/engine/hands/fingerCollision';
import type { FingerName } from '@/app/[lang]/sim/engine/hands/handModel';

const identity = () => new THREE.Quaternion();
const tips = Object.fromEntries((['L', 'R'] as const).map(side => [side,
  Object.fromEntries(FINGER_NAMES.map(finger => [finger, { tip: new THREE.Vector3(side === 'L' ? -100 : 100, 0, -100), distal: new THREE.Vector3(1, 0, 0), pad: new THREE.Vector3(0, 0, 1), nail: new THREE.Vector3(0, 0, -1) }])),
])) as Record<'L' | 'R', Record<FingerName, FingerBearing>>;
const request: MarkedTurnRequest = { axis: 'y', layers: [1, 2], dir: -1, quarters: 1, annotation: { finger: 'middle' } };

describe('marked gesture selection and lifecycle', () => {
  it('selects left or right from direction and current grip, with nail as an independent constraint', () => {
    const select = (r: MarkedTurnRequest, grips = { L: identity(), R: identity() }) => chooseMarkedFingerPlan(r, MARKED_FINGER_PROFILES, grips, tips);
    expect(select(request)).toMatchObject({ hand: 'L', profile: { contact: 'pad', finger: 'middle' } });
    // The independently measured reflected paths use the other hand.
    expect(select({ ...request, dir: 1 })).toMatchObject({ hand: 'R', mirrored: true });
    expect(select({ ...request, dir: 1, annotation: { contact: 'nail' } })).toMatchObject({ hand: 'L', profile: { contact: 'nail', finger: 'middle' } });
    // Ordinary wide turns keep their existing automatic selection.
    expect(select({ ...request, automatic: true, annotation: { finger: 'middle', contact: 'nail' } })).toBeNull();
    expect(select({ ...request, annotation: { finger: 'middle', contact: 'nail' } })).toMatchObject({ hand: 'R', mirrored: true });
    const up = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI / 2);
    const thumb = { ...request, axis: 'z' as const, dir: 1 as const, annotation: { finger: 'thumb' as const } };
    expect(select(thumb)).toBeNull();
    expect(select(thumb, { L: identity(), R: up })).toMatchObject({ hand: 'R', profile: { finger: 'thumb' } });
    expect(select({ ...thumb, dir: -1 }, { L: up, R: identity() })).toMatchObject({ hand: 'L', mirrored: true });
    expect(select({ ...request, quarters: 2 })).toBeNull();
    expect(select({ ...request, layers: [2] })).toMatchObject({ hand: 'L', profile: { id: 'middle-pad-upper' } });
    expect(select({ ...request, annotation: { finger: 'thumb', contact: 'nail' } })).toBeNull();
  });

  it('ranks the two available wide strokes by the loaded surface and finger flexion plane', () => {
    const turn: MarkedTurnRequest = { axis: 'z', layers: [1, 2], dir: 1, quarters: 1,
      annotation: {}, automatic: true };
    const grips = { R: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
      L: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2) };
    const initial = chooseMarkedFingerPlan(turn, MARKED_FINGER_PROFILES, grips, tips)!;
    expect(initial.candidates).toHaveLength(2);
    const alternatives = initial.candidates.map(c => chooseMarkedFingerPlan({
      ...turn, annotation: { finger: c.finger as 'middle' | 'thumb', contact: c.surface === 'nail' ? 'nail' : undefined },
    }, MARKED_FINGER_PROFILES, grips, tips)!);
    const seated = { L: { ...tips.L }, R: { ...tips.R } };
    for (const plan of alternatives) {
      const surface = plan.normal.clone().negate();
      seated[plan.hand][plan.profile.finger] = { tip: plan.start, distal: strokeTangent('z', 1, plan.start),
        pad: plan.profile.contact === 'pad' ? surface : surface.clone().negate(),
        nail: plan.profile.contact === 'nail' ? surface : surface.clone().negate() };
    }
    // Matching tip distances alone cannot distinguish these paths. Only turn
    // the surface of one finger away and the other calibrated path should win.
    for (const plan of alternatives) {
      const bearing = seated[plan.hand][plan.profile.finger];
      bearing[plan.profile.contact].negate();
      const choice = chooseMarkedFingerPlan(turn, MARKED_FINGER_PROFILES, grips, seated)!;
      expect(choice.hand).not.toBe(plan.hand);
      bearing[plan.profile.contact].negate();
      const tangent = strokeTangent('z', 1, plan.start);
      expect(approachCost(bearing, plan.start, plan.normal, plan.profile.contact, tangent)).toBeCloseTo(0);
      const across = new THREE.Vector3().crossVectors(tangent, bearing.pad).normalize();
      expect(approachCost({ ...bearing, distal: across }, plan.start, plan.normal, plan.profile.contact, tangent))
        .toBeGreaterThan(.5);
    }
  });

  it('retracts a cancelled preparation continuously and completes exactly once', () => {
    const plan = chooseMarkedFingerPlan(request, MARKED_FINGER_PROFILES, { L: identity(), R: identity() }, tips)!;
    const home = Object.fromEntries((['L', 'R'] as const).map(side => [side,
      Object.fromEntries(FINGER_NAMES.map(name => [name, fingerChannels((side === 'L' ? homeLeft() : homeRight()).fingers[name])])),
    ])) as Record<'L' | 'R', Record<FingerName, number[]>>;
    for (const elapsed of [80, 350, 500]) {
      const motion = new MarkedFingerMotion(plan, home, MARKED_CLEARANCE);
      motion.advance(elapsed);
      const before = FINGER_NAMES.map(name => motion.pose('L', name));
      motion.finish();
      expect(FINGER_NAMES.map(name => motion.pose('L', name))).toEqual(before);
      motion.advance(100); motion.finish(); motion.advance(400);
      expect(motion.done).toBe(true);
      for (const name of FINGER_NAMES) {
        motion.pose('L', name).forEach((v, i) => expect(v).toBeCloseTo(home.L[name][i], 8));
      }
    }
  });
});
