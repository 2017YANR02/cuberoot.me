import * as THREE from 'three';
import { SIZE } from '../define';
import type { FingerName, HandModel } from './handModel';
import { FINGER_NAMES } from './fingerCollision';
import type { Axis, HandGesture, HandGripNames, LayerClass } from './handsRig';

export type FingerBearing = {
  tip: THREE.Vector3;
  distal: THREE.Vector3;
  pad: THREE.Vector3;
  nail: THREE.Vector3;
};

/** Distal endpoint and palmar direction in the cube/rig frame. No camera axes. */
export function fingerBearing(model: HandModel, finger: FingerName, toCube: THREE.Matrix4): FingerBearing {
  const joint = model.fingers[finger];
  const matrix = toCube.clone().multiply(joint.tip.matrixWorld);
  const end = joint.tipOffset?.clone() ?? new THREE.Vector3(joint.segLens[2], 0, 0);
  const pad = new THREE.Vector3(0, 0, 1).transformDirection(matrix);
  const plate = model.nailMeshes?.find(mesh => mesh.userData.nail?.finger === finger);
  const nail = plate ? new THREE.Vector3(0, 0, -1).transformDirection(toCube.clone().multiply(plate.matrixWorld))
    : pad.clone().negate();
  return { distal: end.clone().transformDirection(matrix), tip: end.applyMatrix4(matrix), pad, nail };
}

export function handBearings(model: HandModel, toCube: THREE.Matrix4): Record<FingerName, FingerBearing> {
  return Object.fromEntries(FINGER_NAMES.map(name => [name, fingerBearing(model, name, toCube)])) as Record<FingerName, FingerBearing>;
}

export function strokeTangent(axis: Axis, dir: number, point: THREE.Vector3) {
  const rotation = new THREE.Vector3();
  rotation[axis] = -Math.sign(dir); // CubeGroup.AXIS_VECTOR uses negative local axes.
  return rotation.cross(point).normalize();
}

/** Relative approach effort in cubie widths. A hand can turn its distal surface
 * during preparation. Only the calibrated drive direction is a hard condition. */
export function approachCost(bearing: FingerBearing, start: THREE.Vector3, normal: THREE.Vector3,
  surface: 'pad' | 'nail', tangent: THREE.Vector3) {
  const hinge = new THREE.Vector3().crossVectors(bearing.distal, bearing.pad).normalize();
  const facing = THREE.MathUtils.clamp(bearing[surface].dot(normal), -1, 1);
  return bearing.tip.distanceTo(start) / SIZE + (1 + facing) / 2 + Math.abs(hinge.dot(tangent));
}

export type CalibratedStroke = {
  grip: 'home' | 'up' | 'down';
  gesture: Extract<HandGesture, { kind: 'flick' }>;
  slideUpper?: boolean;
  candidates?: { profile: string; hand: 'R' | 'L'; finger: FingerName; surface: 'pad' | 'nail'; cost: number }[];
  bearing?: { center: THREE.Vector3; normal: THREE.Vector3; tangent: THREE.Vector3 };
};

// Right-hand calibrated contact regions, expressed in cubie widths. Sweep
// points toward the next face. Reflecting both vectors reverses chirality.
interface StrokeRegion {
  center: readonly number[];
  normal: readonly number[];
  grip: CalibratedStroke['grip'];
  single: FingerName;
  relay?: readonly [FingerName, FingerName];
  style: Extract<HandGesture, { kind: 'flick' }>['style'];
}
const front: StrokeRegion = { center: [1, 1.5, 1], normal: [0, 1, 0], grip: 'down',
  single: 'index', relay: ['index', 'middle'], style: 'downPush' };
const bottom: StrokeRegion = { center: [1, -1.5, -1], normal: [0, -1, 0], grip: 'home',
  single: 'ring', relay: ['pinky', 'ring'], style: 'lowerHook' };
const back: StrokeRegion = { ...bottom, center: [1, 1, -1.5], normal: [0, 0, -1], grip: 'down' };
const upperWide: StrokeRegion = { center: [1, 0, -1.5], normal: [0, 0, -1], grip: 'home',
  single: 'index', style: 'indexHook' };

export function calibratedStroke(grips: HandGripNames, axis: Axis, cls: LayerClass, layers: readonly number[],
  dir: 1 | -1, quarters: number): CalibratedStroke | undefined {
  let region: StrokeRegion;
  if (axis === 'z' && cls === 'high' && quarters === 2) region = front;
  else if (axis === 'y' && cls === 'low') region = bottom;
  else if (axis === 'z' && cls === 'low') region = back;
  else if (axis === 'y' && cls === 'high' && layers.length === 2 && quarters === 1 &&
    grips.L === 'home' && grips.R === 'home') region = upperWide;
  else return;
  for (const hand of ['R', 'L'] as const) {
    const mirror = (xyz: readonly number[]) => new THREE.Vector3(xyz[0] * (hand === 'R' ? 1 : -1), xyz[1], xyz[2]);
    const center = mirror(region.center).multiplyScalar(SIZE);
    const layer = Math.min(2, Math.max(0, Math.round(center[axis] / SIZE) + 1));
    const tangent = strokeTangent(axis, dir, center);
    // At these four bearings the right hand sweeps toward R, and the left toward L.
    if (!layers.includes(layer) || tangent.x * (hand === 'R' ? 1 : -1) <= 0) continue;
    const relay = quarters === 2 ? region.relay : undefined;
    return { grip: region.grip, slideUpper: region === upperWide || undefined,
      gesture: { kind: 'flick', hand, finger: relay?.[0] ?? region.single, finger2: relay?.[1], style: region.style },
      bearing: { center, normal: mirror(region.normal), tangent } };
  }
}

/** The two down-grip F strokes act on opposite corners. Use the actual size's
 * corner centre in rig units; the hand rig keeps a constant outside width. */
export function frontCornerStroke(order: 2 | 4, dir: 1 | -1, grips: HandGripNames,
  bearings: Record<'L' | 'R', Record<FingerName, FingerBearing>>, thumbOnly: boolean): CalibratedStroke {
  const side = dir > 0 ? 'R' : 'L';
  const corner = SIZE * 1.5 * (1 - 1 / order);
  const choices = (['index', 'thumb'] as const).filter(finger => !thumbOnly || finger === 'thumb').map(finger => {
    const hand = finger === 'index' ? side : side === 'R' ? 'L' : 'R';
    const normal = new THREE.Vector3(0, finger === 'index' ? 1 : -1, 0);
    const center = new THREE.Vector3(hand === 'R' ? corner : -corner, normal.y * SIZE * 1.5, corner);
    const tangent = strokeTangent('z', dir, center);
    const style = finger === 'index' ? 'downPush' : 'thumbLift';
    const bearing = { center: center.clone().multiplyScalar(order / 3), normal, tangent };
    return { hand, finger, style, bearing, seated: grips[hand] === 'down',
      cost: approachCost(bearings[hand][finger], center, normal, 'pad', tangent) } as const;
  });
  const seated = choices.filter(c => c.seated);
  const candidates = (seated.length ? seated : choices).sort((a, b) => a.cost - b.cost);
  const { hand, finger, style, bearing } = candidates[0];
  return { grip: 'down', bearing, gesture: { kind: 'flick', hand, finger, style },
    candidates: candidates.map(c => ({ profile: c.style, finger: c.finger, hand: c.hand, surface: 'pad', cost: c.cost })) };
}
