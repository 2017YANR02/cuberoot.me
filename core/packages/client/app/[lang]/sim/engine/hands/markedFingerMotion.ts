import * as THREE from 'three';
import type { FingerAnnotation } from '@/lib/alg-finger-marks';
import type { FingerName, HandModel } from './handModel';
import type { FingerCurl } from './handPoses';

type Side = 'L' | 'R';
type Axis = 'x' | 'y' | 'z';
export type FingerChannels = readonly number[];
export type FingerPoseRows = readonly (readonly number[])[];
export type ClearanceKey = 'y-high' | 'y-low' | 'z-high' | 'z-low';
export type ClearancePoses = Record<ClearanceKey, readonly FingerChannels[]>;
const FINGERS: readonly FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const HALF_PI = Math.PI / 2;
const unit = (axis: Axis): THREE.Vector3 => new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);

/** Author-space channels, shared by both mirrored MANO hands. */
export function fingerChannels(pose: FingerCurl): number[] {
  return [...pose.curl, pose.splay, pose.twist ?? 0, pose.meta?.[0] ?? 0, pose.meta?.[1] ?? 0, pose.meta?.[2] ?? 0,
    pose.mid?.[0] ?? 0, pose.mid?.[1] ?? 0];
}

export interface MarkedFingerProfile {
  id: string;
  side: Side;
  finger: 'middle' | 'thumb';
  contact: 'pad' | 'nail';
  /** Rotation about world +x from home. */
  gripAngle: number;
  axis: 'y' | 'z';
  dir: 1 | -1;
  start: readonly [number, number, number];
  normal: readonly [number, number, number];
  destination: readonly [number, number, number];
  contactVertex: number;
  /** Layer angles at which a pad roll begins, transfers to the nail and settles. */
  nailTransfer?: readonly [start: number, transfer: number, end: number];
  /** Only enable a mirror after its actual skin and nail contacts pass. */
  mirrorSafe?: boolean;
  approach: FingerPoseRows;
  turn: FingerPoseRows;
  support?: Partial<Record<FingerName, FingerChannels>>;
  /** Stationary sticker contacts covered by the distal pads. */
  supportContacts?: Partial<Record<FingerName, { vertex: number; mirroredVertex?: number; point: readonly [number, number, number] }>>;
  /** Progress, wrist translation/XYZ rotation, five fingers' channels, then optional elbow lift along the profile's Y axis. */
  handApproach?: FingerPoseRows;
  handTurn: FingerPoseRows;
  handReturn: FingerPoseRows;
}

export interface MarkedTurnRequest {
  axis: Axis;
  layers: readonly number[];
  dir: 1 | -1;
  quarters: number;
  annotation: FingerAnnotation;
}

export interface MarkedFingerPlan {
  profile: MarkedFingerProfile;
  request: MarkedTurnRequest;
  hand: Side;
  rotation: THREE.Quaternion;
  mirrored: boolean;
  start: THREE.Vector3;
  normal: THREE.Vector3;
  destination: THREE.Vector3;
  clearance: Record<Side, ClearanceKey>;
}

function clearanceKey(axis: Axis, layers: readonly number[], grip: THREE.Quaternion): ClearanceKey | null {
  const n = unit(axis).applyQuaternion(grip.clone().invert());
  const localAxis = Math.abs(n.y) > .999 ? 'y' : Math.abs(n.z) > .999 ? 'z' : null;
  if (!localAxis) return null;
  const high = layers.includes(2) === (n[localAxis] > 0);
  return `${localAxis}-${high ? 'high' : 'low'}`;
}

/** Filter mechanically eligible gestures, then choose from the current hands.
 * No algorithm name, token index, or formatting tag participates in selection.
 */
export function chooseMarkedFingerPlan(
  request: MarkedTurnRequest, profiles: readonly MarkedFingerProfile[],
  grips: Record<Side, THREE.Quaternion>, tips: Record<Side, Record<FingerName, THREE.Vector3>>,
): MarkedFingerPlan | null {
  if (request.quarters !== 1 || request.layers.length !== 2 || request.layers.includes(0) === request.layers.includes(2)) return null;
  const keys = { L: clearanceKey(request.axis, request.layers, grips.L), R: clearanceKey(request.axis, request.layers, grips.R) };
  if (!keys.L || !keys.R) return null;
  const contact = request.annotation.contact ?? 'pad';
  let best: { plan: MarkedFingerPlan; cost: number } | undefined;
  for (const profile of profiles) {
    // The pose program must cover the full visual turn, including any release.
    if (profile.handTurn.at(-1)![0] < 90) continue;
    if (profile.contact !== contact || (request.annotation.finger && request.annotation.finger !== profile.finger)) continue;
    for (const mirrored of [false, true]) for (let quarter = 0; quarter < 4; quarter++) {
      if (mirrored && profile.mirrorSafe === false) continue;
      const rotation = new THREE.Quaternion().setFromAxisAngle(unit('x'), quarter * HALF_PI);
      const transform = (v: readonly number[]) => {
        const point = new THREE.Vector3(v[0], v[1], v[2]);
        if (mirrored) point.x *= -1;
        return point.applyQuaternion(rotation);
      };
      const axis = transform(unit(profile.axis).toArray());
      const targetAxis: Axis = Math.abs(axis.y) > .999 ? 'y' : 'z';
      if (targetAxis !== request.axis) continue;
      const layers = axis[targetAxis] > 0 ? [1, 2] : [0, 1];
      const dir = profile.dir * Math.sign(axis[targetAxis]) * (mirrored ? -1 : 1);
      if (dir !== request.dir || !layers.every(layer => request.layers.includes(layer))) continue;
      const hand = mirrored ? (profile.side === 'R' ? 'L' : 'R') : profile.side;
      const targetGrip = new THREE.Quaternion().setFromAxisAngle(unit('x'), profile.gripAngle + quarter * HALF_PI);
      if (grips[hand].angleTo(targetGrip) > .01) continue;
      const start = transform(profile.start), normal = transform(profile.normal), destination = transform(profile.destination);
      // A nail must push toward the contacted cubie's adjacent face. Merely
      // reversing an existing pad gesture does not establish this condition.
      const turnAxis = unit(request.axis).multiplyScalar(-request.dir);
      if (contact === 'nail' && (Math.abs(normal.dot(destination)) > .01
        || new THREE.Vector3().crossVectors(turnAxis, start).dot(destination) <= 0)) continue;
      const cost = tips[hand][profile.finger].distanceToSquared(start);
      const plan: MarkedFingerPlan = { profile, request, hand, rotation, mirrored, start, normal, destination,
        clearance: { L: keys.L, R: keys.R } };
      if (!best || cost < best.cost) best = { plan, cost };
    }
  }
  return best?.plan ?? null;
}

export function sampleFingerPose(rows: FingerPoseRows, progress: number): number[] {
  const t = Math.max(rows[0][0], Math.min(rows[rows.length - 1][0], progress));
  let low = 0, high = rows.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (rows[mid][0] <= t) low = mid; else high = mid;
  }
  const a = rows[low], b = rows[high], blend = a === b ? 0 : (t - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((value, i) => value + (b[i + 1] - value) * blend);
}

const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const blend = (a: FingerChannels, b: FingerChannels, t: number) => a.map((v, i) => v + (b[i] - v) * t);

const MARKED_RETURN_MS = 500;
const CONTACT_RELEASE_END = .7;
// Animation budgets for the retreat, in rig units and radians per second.
const PALM_TRAVEL_SPEED = 1800;
const PALM_ROTATION_SPEED = 11;
const JOINT_ROTATION_SPEED = 13;
const returnTimingCache = new WeakMap<FingerPoseRows, readonly (readonly [number, number])[]>();

/** Keep the original phase on both hands, so the contact and handoff order
 * remain the same. Give each calibrated segment enough time for its actual
 * movement, independent of how densely its poses were sampled. */
function markedReturnTiming(rows: FingerPoseRows): readonly (readonly [number, number])[] {
  const cached = returnTimingCache.get(rows);
  if (cached) return cached;
  const timing: [number, number][] = [[0, 0]];
  let elapsed = 0;
  const rotationBound = (a: FingerChannels, b: FingerChannels, ...channels: number[]) =>
    channels.reduce((angle, i) => angle + Math.abs(b[i] - a[i]), 0);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    // Invert smoothstep to recover the original phase of this pose.
    const phase = CONTACT_RELEASE_END * (.5 - Math.sin(Math.asin(1 - 2 * b[0]) / 3));
    const palmTravel = Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]);
    let jointRotation = 0;
    for (let j = 0; j < FINGERS.length; j++) {
      const c = 7 + 10 * j;
      jointRotation = Math.max(jointRotation,
        rotationBound(a, b, c, c + 3, c + 4),
        rotationBound(a, b, c + 1, c + 8, c + 9),
        Math.abs(b[c + 2] - a[c + 2]),
        rotationBound(a, b, c + 5, c + 6, c + 7));
    }
    elapsed += Math.max((phase - timing[i - 1][1]) * MARKED_RETURN_MS,
      1000 * palmTravel / PALM_TRAVEL_SPEED,
      1000 * rotationBound(a, b, 4, 5, 6) / PALM_ROTATION_SPEED,
      1000 * jointRotation / JOINT_ROTATION_SPEED);
    timing.push([elapsed, phase]);
  }
  timing.push([elapsed + (1 - CONTACT_RELEASE_END) * MARKED_RETURN_MS, 1]);
  returnTimingCache.set(rows, timing);
  return timing;
}

function returnPhase(timing: readonly (readonly [number, number])[], time: number): number {
  let low = 0, high = timing.length - 1;
  if (time >= timing[high][0]) return 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (timing[mid][0] <= time) low = mid; else high = mid;
  }
  const [start, a] = timing[low], [end, b] = timing[high];
  return a + (b - a) * (time - start) / (end - start);
}

/** One preparation/turn/return lifecycle; frame angles remain the cube's
 * source of truth. Coupled wrist/finger poses preserve stationary supports.
 */
export class MarkedFingerMotion {
  // A right-layer weld leaves the left hand free to establish or release its support.
  supportReady = false;
  holdSupport = false;
  /** Right-hand F2/B0 pinch established before the preceding R2′. */
  topPinch: number | null = null;
  preparation = 0;
  returning = 0;
  degrees = 0;
  finished = false;
  started = false;
  private supportAtFinish = 1;
  private endpointPending = false;
  private returnElapsed = 0;
  private sampledRows: FingerPoseRows | null = null;
  private sampledProgress = NaN;
  private sampledPose: number[] | null = null;
  constructor(readonly plan: MarkedFingerPlan, private home: Record<Side, Record<FingerName, FingerChannels>>, private clearance: ClearancePoses) {}
  get preparingPinch(): boolean { return !this.finished && this.topPinch !== null && this.topPinch < 1; }
  matches(request: MarkedTurnRequest): boolean {
    const planned = this.plan.request;
    return planned.axis === request.axis && planned.dir === request.dir && planned.quarters === request.quarters
      && planned.layers.length === request.layers.length && planned.layers.every(layer => request.layers.includes(layer))
      && planned.annotation.finger === request.annotation.finger && planned.annotation.contact === request.annotation.contact;
  }
  get preparing(): boolean { return this.preparation < 1 && !this.finished; }
  get retreating(): boolean { return this.finished && this.returning < 1; }
  get done(): boolean { return this.finished && this.returning === 1; }
  get contact(): 'pad' | 'nail' {
    const { contact, nailTransfer } = this.plan.profile;
    return nailTransfer && this.degrees >= nailTransfer[1] ? 'nail' : contact;
  }
  advance(dt: number): void {
    if (this.endpointPending) return;
    if (!this.finished) {
      this.preparation = Math.min(1, this.preparation + dt / 500);
      return;
    }
    this.returnElapsed += dt;
    this.returning = this.started
      ? returnPhase(markedReturnTiming(this.plan.profile.handReturn), this.returnElapsed)
      : Math.min(1, this.returnElapsed / MARKED_RETURN_MS);
  }
  turn(angle: number): void { this.started = true; this.degrees = Math.abs(angle) * 180 / Math.PI; }
  completeTurn(): void {
    // A rendered frame may stop just short of 90° before the cube bakes the
    // turn. The first baked frame must still show contact at that endpoint.
    if (this.started) { this.degrees = 90; this.endpointPending = true; }
    this.finish();
  }
  didDisplay(): void { this.endpointPending = false; }
  finish(): void {
    if (this.finished) return;
    this.supportAtFinish = smooth(this.preparation / .4);
    this.finished = true;
  }
  restartSupportReturn(): void {
    this.topPinch = null;
    this.holdSupport = false;
    this.returnElapsed = this.returning = 0;
  }
  private handPose(): number[] | null {
    const profile = this.plan.profile;
    const releasing = this.finished && !this.endpointPending && !(this.holdSupport && this.started);
    const approach = !this.started || this.preparing;
    const rows = approach ? profile.handApproach : releasing ? profile.handReturn : profile.handTurn;
    if (!rows) return null;
    const progress = approach && this.supportReady ? 1 : approach ? this.preparation * (this.finished ? 1 - smooth(this.returning) : 1)
      : releasing ? smooth(Math.min(1, this.returning / CONTACT_RELEASE_END)) : this.degrees;
    if (rows !== this.sampledRows || progress !== this.sampledProgress) {
      this.sampledRows = rows;
      this.sampledProgress = progress;
      this.sampledPose = sampleFingerPose(rows, progress);
    }
    return this.sampledPose;
  }
  /** Returns whether the calibrated path carries the forearm with the grip. */
  applyWrist(side: Side, group: THREE.Object3D, elbow: THREE.Vector3): boolean {
    if (side !== this.plan.hand) return false;
    const pose = this.handPose();
    if (!pose) return false;
    const lift = pose[6 + FINGERS.length * 10];
    const [x, y, z, rx, ry, rz] = pose;
    if (!(x || y || z || rx || ry || rz || lift)) return lift !== undefined;
    const delta = new THREE.Vector3(x, y, z);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
    if (this.plan.mirrored) {
      delta.x *= -1;
      rotation.y *= -1; rotation.z *= -1;
    }
    delta.applyQuaternion(this.plan.rotation);
    rotation.premultiply(this.plan.rotation).multiply(this.plan.rotation.clone().invert());
    group.position.add(delta);
    group.quaternion.premultiply(rotation);
    // Move the forearm target with a rigid grip slide so the wrist hinge
    // keeps its angle. Other calibrated wrist motion uses the resting elbow.
    if (lift) elbow.add(delta.set(0, lift, 0).applyQuaternion(this.plan.rotation));
    return lift !== undefined;
  }
  pose(side: Side, finger: FingerName, preserveGrip = false): FingerChannels {
    const profile = this.plan.profile, home = this.home[side][finger];
    if (preserveGrip) return home;
    const full = side === this.plan.hand ? this.handPose() : null;
    if (full) {
      const offset = 6 + FINGERS.indexOf(finger) * 10;
      const target = full.slice(offset, offset + 10);
      return this.finished && this.started && !this.holdSupport
        ? blend(target, home, smooth((this.returning - CONTACT_RELEASE_END) / (1 - CONTACT_RELEASE_END))) : target;
    }
    if (side === this.plan.hand && finger === profile.finger) {
      if (this.finished) {
        const progress = smooth(Math.min(1, this.returning / CONTACT_RELEASE_END));
        // Cancelling or replacing a prepared mark retraces its approach. Do
        // not jump to the released pose before a turn has even started.
        return sampleFingerPose(profile.approach, smooth((this.preparation - .4) / .6) * (1 - progress));
      }
      if (this.preparing) return sampleFingerPose(profile.approach, smooth((this.preparation - .4) / .6));
      return sampleFingerPose(profile.turn, this.degrees);
    }
    const target = side === this.plan.hand && profile.support?.[finger]
      ? profile.support[finger]! : this.clearance[this.plan.clearance[side]][FINGERS.indexOf(finger)];
    // Re-establish the other hand's grip before releasing this hand's fixed
    // supports. Both hands must not reset their supporting fingers together.
    const returnProgress = side === this.plan.hand ? (this.returning - CONTACT_RELEASE_END) / (1 - CONTACT_RELEASE_END) : this.returning / .3;
    const amount = this.finished ? this.supportAtFinish * (1 - smooth(returnProgress)) : smooth(this.preparation / .4);
    return blend(home, target, amount);
  }
}

/** Check the actual mesh at the end of preparation, including the nail's own
 * surface normal. This also rejects stale calibration after an asset change.
 */
export function markedStartContact(model: HandModel, reference: THREE.Object3D, plan: MarkedFingerPlan): { distance: number; facing: number; point: number[] } | null {
  model.group.updateWorldMatrix(true, true);
  const profile = plan.profile;
  const mesh = profile.contact === 'nail' ? model.nailMeshes?.find(mesh => mesh.userData.nail.finger === profile.finger)
    : model.meshes.find(mesh => (mesh as THREE.SkinnedMesh).isSkinnedMesh);
  if (!mesh) return null;
  const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal'), vertex = profile.contactVertex;
  const toReference = reference.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  if (profile.contact === 'nail') {
    // Procedurally generated left/right nails have different vertex ordering.
    // Use the real dorsal surface rather than mirroring a vertex number.
    const index = mesh.geometry.index;
    if (!index) return null;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(toReference);
    const points = new Map<number, { point: THREE.Vector3; normal: THREE.Vector3 }>();
    for (let i = 0; i < position.count; i++) if (normal.getZ(i) < -.5) points.set(i, {
      point: new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(toReference),
      normal: new THREE.Vector3().fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize(),
    });
    const triangle = new THREE.Triangle(), closest = new THREE.Vector3(), weights = new THREE.Vector3();
    let best: { distance: number; facing: number; point: number[] } | null = null;
    for (let i = 0; i < index.count; i += 3) {
      const a = points.get(index.getX(i)), b = points.get(index.getX(i + 1)), c = points.get(index.getX(i + 2));
      if (!a || !b || !c) continue;
      triangle.set(a.point, b.point, c.point).closestPointToPoint(plan.start, closest);
      triangle.getBarycoord(closest, weights);
      const facing = a.normal.clone().multiplyScalar(weights.x).addScaledVector(b.normal, weights.y)
        .addScaledVector(c.normal, weights.z).normalize().dot(plan.normal);
      const distance = closest.distanceTo(plan.start);
      if (facing <= -.9 && (!best || distance < best.distance)) best = { distance, facing, point: closest.toArray() };
    }
    return best;
  }
  if (vertex < 0 || vertex >= position.count) return null;
  const p = new THREE.Vector3().fromBufferAttribute(position, vertex), n = new THREE.Vector3().fromBufferAttribute(normal, vertex).add(p);
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
    (mesh as THREE.SkinnedMesh).applyBoneTransform(vertex, p);
    (mesh as THREE.SkinnedMesh).applyBoneTransform(vertex, n);
  }
  p.applyMatrix4(toReference); n.applyMatrix4(toReference).sub(p).normalize();
  return { distance: p.distanceTo(plan.start), facing: n.dot(plan.normal), point: p.toArray() };
}
