import * as THREE from 'three';
import type { Axis, HandSide, GripName } from './handsRig';
import type { FingerJoints, HandModel, FingerName } from './handModel';
import { FingerSurfaceSampler, FINGER_NAMES } from './fingerCollision';
import { SIZE } from '../define';
import { applyPocketFingerPose } from './pocketFingerContact';
import { homeWideIndex, WIDE_SUPPORT_SEATS } from './wideSupportPoses';
import { fingerChannels, sampleFingerPose, timedPosePhase, type ClearanceKey } from './markedFingerMotion';
import { homeWideSlideY, seatedRing, wideParkedIndex } from './markedFingerPoses';
import { homeLeft } from './handPoses';
import { nailPoints } from './gestureContactTrace';

const homeFingers = homeLeft().fingers;
const upperHome = Object.fromEntries(FINGER_NAMES.map(name => [name, fingerChannels(homeFingers[name])])) as Record<FingerName, number[]>;
// The spare index parks outside the upper slab. The spare middle finger
// clears its back edge while the ring and thumb seat on the bottom row.
const upperPark: Partial<Record<FingerName, number[]>> = {
  // The Gc slide ends closer to the seam than the other wide grips.
  thumb: [1.69334, .13203, .04676, .61816, 2.33098, 0, 0, 0, -.28048, -.29424],
  ring: seatedRing,
  index: wideParkedIndex,
  middle: [.68, .57, .19, .19, .21, 0, 0, 0, 0, 0],
};

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

// Invert the seat easing at each authored knot. Joint travel can be large
// across two nearby knots, especially when the middle finger clears a corner.
function slideTiming(seat: (typeof WIDE_SUPPORT_SEATS)[ClearanceKey], crossGrip: boolean) {
  const knots = new Set<number>([0, 1]);
  for (const rows of Object.values(seat.fingers)) for (const row of rows) knots.add(row[0]);
  const timing: [number, number][] = [[0, 0]];
  let previous = FINGER_NAMES.map(name => sampleFingerPose(seat.fingers[name], 0));
  let elapsed = 0, progress = 0;
  for (const knot of [...knots].sort((a, b) => a - b)) {
    const inverse = .5 - Math.sin(Math.asin(1 - 2 * knot) / 3);
    const next = crossGrip ? .18 + .64 * inverse : inverse;
    const poses = FINGER_NAMES.map(name => sampleFingerPose(seat.fingers[name], knot));
    let duration = (next - progress) * 440;
    for (let i = 0; i < poses.length; i++) {
      const delta = poses[i].map((value, j) => Math.abs(value - previous[i][j]));
      const rotation = Math.max(delta[0] + delta[3] + delta[4], delta[1] + delta[5] + delta[6], delta[2]);
      duration = Math.max(duration, rotation * 1000 / 13);
    }
    elapsed += duration;
    if (duration > 0) timing.push([elapsed, next]);
    previous = poses;
    progress = next;
  }
  if (crossGrip) timing.push([elapsed + 440 * (1 - progress), 1]);
  else timing[timing.length - 1][1] = 1;
  // Redistribute the existing slide beat. The cube can start on its usual
  // frame and a cancelled preparation retraces the same path in reverse.
  const duration = timing[timing.length - 1][0];
  for (const key of timing) key[0] *= 440 / duration;
  return timing;
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
  private readonly timing?: [number, number][];
  private elapsed = 0;

  constructor(readonly axis: Axis, readonly high: boolean, readonly hand: HandSide,
    grip: THREE.Quaternion, anchors: FingerName[], travel: number, gripName: GripName | null, order = 3, readonly homeUpper = false) {
    const local = new THREE.Vector3();
    local[axis] = high ? 1 : -1;
    local.applyQuaternion(grip.clone().invert());
    const a = Math.abs(local.y) > .999 ? 'y' : Math.abs(local.z) > .999 ? 'z' : null;
    this.frontHome = axis === 'z' && high && gripName === 'home';
    this.seatThumb = axis === 'x' && (!anchors.length || travel > 0);
    if (homeUpper) {
      this.shift.y = homeWideSlideY;
    } else if (this.frontHome) {
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
    if (this.seat) this.timing = slideTiming(this.seat, this.crossGrip);
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
    this.anchors = homeUpper ? ['thumb', 'ring'] : this.frontHome ? ['index', 'ring'] : this.seat?.anchors ?? (this.seatThumb ? ['thumb', 'index'] : anchors);
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
    // Keep the free middle nail outside the corner until it has curled.
    const entry = this.seat?.clearFirst ? 18 * (1 - THREE.MathUtils.smoothstep(this.poseProgress, .20, .32)) : 0;
    return (this.hand === 'R' ? 1 : -1) * (this.edgeClearance + entry) * amount;
  }
  homeUpperPose(name: FingerName, driving: boolean) {
    if (driving && name === 'index') return undefined;
    const start = upperHome[name], end = upperPark[name];
    if (!end) return start;
    const seat = THREE.MathUtils.smoothstep(this.progress, .6, 1);
    return start.map((v, i) => THREE.MathUtils.lerp(v, end[i], seat));
  }
  private readonly correction = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  seatIndex(f: FingerJoints, mirror: number, degrees: number, weight: number) {
    const [rx, ry, rz, mid, mx, my, mz] = sampleFingerPose(homeWideIndex, degrees);
    const w = weight * this.weight;
    this.euler.set(rx * mirror * w, ry * w, rz * mirror * w, 'YZX');
    f.root.quaternion.multiply(this.correction.setFromEuler(this.euler));
    f.mid.rotation.y += mid * w;
    if (f.meta && f.metaBase) {
      this.euler.set(mx * mirror * w, my * w, mz * mirror * w, 'YZX');
      this.correction.setFromEuler(this.euler).premultiply(f.metaBase);
      this.correction.multiply(this.inverseBase.copy(f.metaBase).invert());
      f.meta.quaternion.multiply(this.correction);
    }
  }
  clearRearMiddle(finger: FingerJoints, remaining: number) {
    if (this.seat !== WIDE_SUPPORT_SEATS['z-low'] || !remaining) return;
    // The thinner fixed row on a 4×4 brings the middle nail to its edge.
    // Release that pad as the thumb and index establish the support.
    const lift = THREE.MathUtils.smoothstep(this.poseProgress, .70, 1) * remaining;
    applyPocketFingerPose(finger, [.084, .049, .049, -.021], lift, this.hand === 'R' ? 1 : -1);
  }
  private readonly inverseBase = new THREE.Quaternion();
  get slideWeight() {
    if (this.homeUpper) return THREE.MathUtils.smoothstep(this.progress, 0, .6);
    return this.seat?.clearFirst ? THREE.MathUtils.clamp((this.poseProgress - .32) / .36, 0, 1) : this.poseProgress;
  }
  pose(name: FingerName) {
    if (this.seat) return sampleFingerPose(this.seat.fingers[name], this.poseProgress);
    if (this.seatThumb && name === 'thumb') return sampleFingerPose(WIDE_SUPPORT_SEATS['y-high'].fingers.thumb, this.weight);
    return undefined;
  }
  get weight() { return THREE.MathUtils.smoothstep(this.progress, 0, 1); }
  advance(dt: number) {
    if (this.timing) {
      this.elapsed = THREE.MathUtils.clamp(this.elapsed + (this.returning ? -dt : dt), 0, this.timing[this.timing.length - 1][0]);
      this.progress = timedPosePhase(this.timing, this.elapsed);
      return;
    }
    const longSlide = !this.frontHome && (this.seat || this.shift.lengthSq() > 0);
    this.progress = this.moves ? THREE.MathUtils.clamp(this.progress + (this.returning ? -dt : dt) / (longSlide ? 440 : 120), 0, 1)
      : this.returning ? 0 : 1;
  }
}
