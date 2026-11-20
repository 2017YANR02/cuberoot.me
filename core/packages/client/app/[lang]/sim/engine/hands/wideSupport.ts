import * as THREE from 'three';
import type { Axis, HandSide, GripName } from './handsRig';
import type { HandModel, FingerName } from './handModel';
import { FingerSurfaceSampler, FINGER_NAMES } from './fingerCollision';
import { SIZE } from '../define';
import { WIDE_SUPPORT_SEATS } from './wideSupportPoses';
import { sampleFingerPose, type ClearanceKey } from './markedFingerMotion';
import { nailPoints } from './gestureContactTrace';

const axes = ['x', 'y', 'z'] as const;
const samplers = new WeakMap<HandModel, FingerSurfaceSampler>();

/** Check real pad vertices on opposing faces of the stationary slab, once
 * while selecting the gesture. A pad merely grazing a seam is insufficient. */
export function inspectWideGrip(model: HandModel, toRig: THREE.Matrix4, axis: Axis, fixedSign: number, order = 3) {
  const anchors: FingerName[] = [];
  let travel = 0;
  if (!model.meshes.some(mesh => (mesh as THREE.SkinnedMesh).isSkinnedMesh)) return { anchors, travel };
  let sampler = samplers.get(model);
  if (!sampler) { sampler = new FingerSurfaceSampler(model); samplers.set(model, sampler); }
  const touched = new Map<string, FingerName>();
  const [u, v] = axes.filter(a => a !== axis);
  const cut = SIZE * 1.5 - SIZE * 3 / order;
  for (const finger of FINGER_NAMES) {
    const skin = sampler.samplePoints(finger);
    for (const p of skin) p.point.applyMatrix4(toRig);
    const shell = nailPoints(model, finger, toRig);
    for (const { point } of [...skin, ...shell]) {
      if (Math.hypot(point[u], point[v]) < SIZE * 1.5 * Math.SQRT2 + 1)
        travel = Math.max(travel, cut + 1 - fixedSign * point[axis]);
    }
    for (const { point, pad } of skin) {
      if (!pad || fixedSign * point[axis] < cut + 2) continue;
      for (const a of [u, v]) {
        if (Math.abs(Math.abs(point[a]) - 1.5 * SIZE) > 2.5
          || axes.some(t => t !== a && Math.abs(point[t]) > 1.5 * SIZE - 2)) continue;
        const sign = Math.sign(point[a]), opposing = touched.get(a + -sign);
        if (opposing && opposing !== finger && !anchors.length) anchors.push(opposing, finger);
        touched.set(a + sign, finger);
      }
    }
  }
  return { anchors, travel };
}

export class WideSupport {
  progress = 0;
  returning = false;
  readonly shift = new THREE.Vector3();
  readonly seat?: (typeof WIDE_SUPPORT_SEATS)[ClearanceKey];
  readonly seatThumb: boolean;
  readonly frontHome: boolean;
  private readonly edgeClearance: number;
  private readonly crossGrip: boolean;
  readonly anchors: readonly FingerName[];

  constructor(readonly axis: Axis, readonly high: boolean, readonly hand: HandSide,
    grip: THREE.Quaternion, anchors: FingerName[], travel: number, gripName: GripName | null, order = 3) {
    const local = new THREE.Vector3();
    local[axis] = high ? 1 : -1;
    local.applyQuaternion(grip.clone().invert());
    const a = Math.abs(local.y) > .999 ? 'y' : Math.abs(local.z) > .999 ? 'z' : null;
    this.frontHome = axis === 'z' && high && gripName === 'home';
    this.seatThumb = axis === 'x' && (!anchors.length || travel > 0);
    if (this.frontHome) {
      // Index and ring already brace the stationary back face. Lift along it
      // while the thumb releases its normal pressure on the rotating front.
      this.shift.y = 2;
    } else if ((!anchors.length || travel > 0) && a) {
      this.seat = WIDE_SUPPORT_SEATS[`${a}-${local[a] > 0 ? 'high' : 'low'}`];
      this.shift.fromArray(this.seat.shift);
      if (hand === 'L') this.shift.x *= -1;
      this.shift.applyQuaternion(grip);
    }
    this.crossGrip = !!this.seat && (this.seat.clearFirst || gripName === 'halfDown');
    this.edgeClearance = 0;
    if (this.seat?.clearFirst) {
      this.edgeClearance = gripName === 'halfDown' ? 58 : local.z > 0 ? 46 : 18;
    } else if (this.seat && gripName === 'halfDown') {
      this.edgeClearance = local.y < 0 ? 36 : 5;
    }
    // The fixed strip on a four-layer cube is narrower by SIZE/4.
    const extra = order === 4 ? SIZE / 4 : 0;
    if (axis === 'x' && travel > 0) this.shift.x = (high ? -1 : 1) * Math.min(travel, 2.5 + extra);
    else if (this.seat && extra > 0) this.shift[axis] += (high ? -1 : 1) * Math.min(extra, travel);
    this.anchors = this.frontHome ? ['index', 'ring'] : this.seat?.anchors ?? (this.seatThumb ? ['thumb', 'index'] : anchors);
    if (!this.moves) this.progress = 1;
  }

  get moves() { return !!this.seat || this.seatThumb || this.shift.lengthSq() > 0; }
  // Carry the grip along the side edge before threading the fingertips
  // around it. Reverse exactly the same path on return or cancelled setup.
  get poseProgress() {
    return this.crossGrip ? THREE.MathUtils.smoothstep(this.progress, .18, .82) : this.weight;
  }
  get lateralClearance() {
    const amount = THREE.MathUtils.smoothstep(this.progress, 0, .18)
      * (1 - THREE.MathUtils.smoothstep(this.progress, .82, 1));
    return (this.hand === 'R' ? 1 : -1) * this.edgeClearance * amount;
  }
  get slideWeight() { return this.seat?.clearFirst ? THREE.MathUtils.clamp((this.poseProgress - .32) / .36, 0, 1) : this.poseProgress; }
  pose(name: FingerName) {
    if (this.seat) return sampleFingerPose(this.seat.fingers[name], this.poseProgress);
    if (this.seatThumb && name === 'thumb') return sampleFingerPose(WIDE_SUPPORT_SEATS['y-high'].fingers.thumb, this.weight);
    return undefined;
  }
  get weight() { return THREE.MathUtils.smoothstep(this.progress, 0, 1); }
  advance(dt: number) {
    const longSlide = !this.frontHome && (this.seat || this.shift.lengthSq() > 0);
    this.progress = this.moves ? THREE.MathUtils.clamp(this.progress + (this.returning ? -dt : dt) / (longSlide ? 440 : 120), 0, 1)
      : this.returning ? 0 : 1;
  }
}
