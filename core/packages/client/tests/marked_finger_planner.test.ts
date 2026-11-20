import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { chooseMarkedFingerPlan, fingerChannels, MarkedFingerMotion, type MarkedTurnRequest } from '@/app/[lang]/sim/engine/hands/markedFingerMotion';
import { MARKED_CLEARANCE, MARKED_FINGER_PROFILES } from '@/app/[lang]/sim/engine/hands/markedFingerPoses';
import { homeLeft, homeRight } from '@/app/[lang]/sim/engine/hands/handPoses';
import { FINGER_NAMES } from '@/app/[lang]/sim/engine/hands/fingerCollision';
import type { FingerName } from '@/app/[lang]/sim/engine/hands/handModel';

const identity = () => new THREE.Quaternion();
const tips = Object.fromEntries((['L', 'R'] as const).map(side => [side,
  Object.fromEntries(FINGER_NAMES.map(finger => [finger, new THREE.Vector3(side === 'L' ? -100 : 100, 0, -100)])),
])) as Record<'L' | 'R', Record<FingerName, THREE.Vector3>>;
const request: MarkedTurnRequest = { axis: 'y', layers: [1, 2], dir: -1, quarters: 1, annotation: { finger: 'middle' } };

describe('marked gesture selection and lifecycle', () => {
  it('selects left or right from direction and current grip, with nail as an independent constraint', () => {
    const select = (r: MarkedTurnRequest, grips = { L: identity(), R: identity() }) => chooseMarkedFingerPlan(r, MARKED_FINGER_PROFILES, grips, tips);
    expect(select(request)).toMatchObject({ hand: 'L', profile: { contact: 'pad', finger: 'middle' } });
    // Mirroring skin/nail geometry does not preserve the calibrated contacts.
    expect(select({ ...request, dir: 1 })).toBeNull();
    expect(select({ ...request, dir: 1, annotation: { contact: 'nail' } })).toMatchObject({ hand: 'L', profile: { contact: 'nail', finger: 'middle' } });
    // The procedural right nail is not a surface-exact mirror of the left.
    expect(select({ ...request, annotation: { finger: 'middle', contact: 'nail' } })).toBeNull();
    const up = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI / 2);
    const thumb = { ...request, axis: 'z' as const, dir: 1 as const, annotation: { finger: 'thumb' as const } };
    expect(select(thumb)).toBeNull();
    expect(select(thumb, { L: identity(), R: up })).toMatchObject({ hand: 'R', profile: { finger: 'thumb' } });
    expect(select({ ...thumb, dir: -1 }, { L: up, R: identity() })).toBeNull();
    expect(select({ ...request, quarters: 2 })).toBeNull();
    expect(select({ ...request, layers: [2] })).toBeNull();
    expect(select({ ...request, annotation: { finger: 'thumb', contact: 'nail' } })).toBeNull();
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
