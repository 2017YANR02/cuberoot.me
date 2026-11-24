import { Euler, MathUtils, Matrix4, Quaternion, Vector3, type Object3D, type SkinnedMesh } from 'three';
import { sampleFingerPose } from './markedFingerMotion';
import { innerSliceBraces } from './innerSliceBraces';
import { reverseInnerX, reverseInnerXReturn, lowerInnerY, lowerInnerYReturn } from './innerReverseRelay';
import { innerPadRelay, innerPadRelayReturn } from './innerPadRelay';
import { innerRingStroke } from './innerRingStroke';
import { innerQuarterSeats, leftInner, rightInner, middlePair } from './fourLayerSlicePoses';
import { frontIndexSeat, backWideSeat, upperWideSeat, upperInnerRelaySeat, wideIndexRelease, innerMiddleRelease,
  innerQuarterIndexRelease, innerQuarterMiddleRelease } from './fourLayerFlickPoses';
import { applyPocketFingerPose, seatPocketFinger } from './pocketFingerContact';
import { SIZE } from '../define';
import type { FingerJoints, FingerName, HandModel } from './handModel';
import type { Axis, HandSide } from './handsRig';

const half = SIZE * 1.5;
const tile = half / 2;
const axes = ['x', 'y', 'z'] as const;
const names: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

// Stationary front strip during a home three-layer back flick. The thumb
// presses its front face and the index hooks over the upper edge.
const backSupport = {
  thumb: [-.0419, -.0106, -.0254, -.1291, -.0656],
  index: [-.0081, .0276, .0405, .054, -.1101],
  ring: [-.00566, .003, -.03115, .00115, -.01855],
};

// Keep the idle middle clear of the index sweep and the rotating corners.
const backMiddleClearance = [.28053, -.00542, .19942, -.02016, -.06638, .11726, .26452, .00592];
// The lower relay keeps the opposing middle pad on the upper stationary strip.
const lowerRelayMiddle = [-0.123938, 0.093735, 0.126049, -0.291164, -0.466993, -0.477195, 0.400174, -0.25767];
const upperMiddleRetreat = [.03428, -.00156, .02397, -.00257, .00497, .00295, .00579, -.01740];
const upperMiddleClearance = [.01304, .0016, -.00132, -.00077, -.00217];

// Coordinates in the frame of the moving layers, at the start of the stroke.
type StickerTarget = { normalAxis: 'u' | 'v'; normal: number; tangent: number; axial: number };
type Band = readonly [number, number];
type Landmark = { p: Vector3; pad: boolean; vertex?: number };
type Segment = { joint: Object3D; points: Landmark[]; surface: Landmark[]; deepest?: Landmark; matrix: Matrix4 };

/** Skin and nail landmarks in joint-local coordinates. The fitted pose always
 * rotates bones; MANO applies its skinning and pose correctives afterwards. */
function landmarks(model: HandModel, name: FingerName, mesh: SkinnedMesh) {
  const f = model.fingers[name];
  const segments: Segment[] = [f.root, f.mid, f.tip].map(joint => ({ joint, points: [], surface: [], matrix: new Matrix4() }));
  const { skinIndex, skinWeight, position } = mesh.geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    let k = 0;
    for (let j = 1; j < 4; j++) if (skinWeight.getComponent(i, j) > skinWeight.getComponent(i, k)) k = j;
    const bone = mesh.skeleton.bones[skinIndex.getComponent(i, k)];
    if (!bone.name.startsWith(name + '-')) continue;
    let parent: Object3D | null = bone;
    while (parent && !segments.some(s => s.joint === parent)) parent = parent.parent;
    const segment = segments.find(s => s.joint === parent);
    if (!segment) continue;
    const p = new Vector3().fromBufferAttribute(position, i);
    mesh.applyBoneTransform(i, p).applyMatrix4(mesh.matrixWorld);
    segment.joint.worldToLocal(p);
    segment.points.push({ p, vertex: i, pad: segment.joint === f.tip && p.z >= 0 });
  }
  const nail = model.nailMeshes?.find(n => n.userData.nail.finger === name);
  if (nail) {
    const pos = nail.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const p = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(nail.matrixWorld);
      segments[2].points.push({ p: f.tip.worldToLocal(p), pad: false });
    }
  }
  // Retain extrema in 26 directions. UV duplicates and nail tessellation
  // should not change the weight of a contact or the cost of a frame.
  for (const segment of segments) {
    const hull = new Set<Landmark>();
    for (const set of [segment.points, segment.points.filter(p => p.pad)]) {
      if (!set.length) continue;
      for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
        if (!x && !y && !z) continue;
        const d = new Vector3(x, y, z);
        hull.add(set.reduce((a, b) => a.p.dot(d) > b.p.dot(d) ? a : b));
      }
    }
    segment.surface = segment.points;
    segment.points = [...hull];
  }
  return segments;
}

export interface FourLayerStroke {
  axis: Axis;
  layers: readonly number[];
  angle: number;
  dir: number;
  returning: boolean;
}

/** Three coaxial boxes in rig space: the moving slab, and the stationary
 * material on either side. The cube normalizes the edge length to 3*SIZE.
 * Using the solid envelope keeps the digit clear of seams between pieces. */
class Slabs {
  u: Axis = 'y';
  v: Axis = 'z';
  axis: Axis = 'x';
  lo = 0;
  hi = 0;
  sin = 0;
  cos = 1;
  set(stroke: FourLayerStroke) {
    this.axis = stroke.axis;
    const i = axes.indexOf(stroke.axis);
    this.u = axes[(i + 1) % 3];
    this.v = axes[(i + 2) % 3];
    this.lo = -half + Math.min(...stroke.layers) * tile;
    this.hi = -half + (1 + Math.max(...stroke.layers)) * tile;
    this.cos = Math.cos(stroke.angle);
    this.sin = Math.sin(stroke.angle);
  }
  /** Choose a finite sticker on an exposed face at the requested depth. */
  stickerAt(p: Vector3, band: Band): StickerTarget {
    const u = p[this.u] * this.cos - p[this.v] * this.sin;
    const v = p[this.u] * this.sin + p[this.v] * this.cos;
    const centerOfTile = (coordinate: number) =>
      (MathUtils.clamp(Math.floor((coordinate + half) / tile), 0, 3) + .5) * tile - half;
    const normalIsU = Math.abs(u) > Math.abs(v);
    return {
      normalAxis: normalIsU ? 'u' : 'v',
      normal: Math.sign(normalIsU ? u : v) * (half + .75),
      tangent: centerOfTile(normalIsU ? v : u),
      axial: centerOfTile(MathUtils.clamp(p[this.axis], band[0], band[1])),
    };
  }

  distanceToStickerSq(p: Vector3, target: StickerTarget, band: Band) {
    const u = p[this.u] * this.cos - p[this.v] * this.sin;
    const v = p[this.u] * this.sin + p[this.v] * this.cos;
    const normal = target.normalAxis === 'u' ? u : v;
    const tangent = target.normalAxis === 'u' ? v : u;
    const inset = tile / 2 - 3;
    const alongFace = Math.max(0, Math.abs(tangent - target.tangent) - inset);
    const a = p[this.axis];
    const acrossFace = Math.max(0, Math.abs(a - target.axial) - inset, band[0] - a, a - band[1]);
    return (normal - target.normal) ** 2 + alongFace ** 2 + acrossFace ** 2;
  }

  depth(p: Vector3) {
    const a = p[this.axis], u = p[this.u], v = p[this.v];
    const fixedFace = half - Math.max(Math.abs(u), Math.abs(v));
    const low = this.lo > -half ? Math.min(this.lo - a, a + half, fixedFace) : -Infinity;
    const high = this.hi < half ? Math.min(a - this.hi, half - a, fixedFace) : -Infinity;
    const ru = u * this.cos - v * this.sin, rv = u * this.sin + v * this.cos;
    return Math.max(low, high, Math.min(a - this.lo, this.hi - a, half - Math.max(Math.abs(ru), Math.abs(rv))));
  }
}

export function isEquatorBand(axis: Axis | null, layers: readonly number[]): boolean {
  return axis === 'y' && layers.length === 2 && layers.includes(1) && layers.includes(2);
}

export type InnerBraceProfile = keyof typeof innerSliceBraces.R;

const wristInverse = new Quaternion(), localNormal = new Vector3();

/** Choose the stationary strip in the wrist's neutral frame. After a quarter
 * wrist turn, a horizontal strip can be a front/back strip for that hand. */
export function innerBraceProfile(stroke: FourLayerStroke, grip: Quaternion, driver: boolean, padRelay: boolean): InnerBraceProfile {
  localNormal.set(0, 0, 0)[stroke.axis] = 1;
  localNormal.applyQuaternion(wristInverse.copy(grip).invert());
  if (Math.abs(localNormal.x) > .7) {
    if (!driver || stroke.axis !== 'x') return 'outerX';
    return padRelay ? 'innerXRelay' : 'innerX';
  }
  if (Math.abs(localNormal.y) > .7) {
    const high = (stroke.layers[0] === 2) === (localNormal.y > 0);
    return high ? 'lowerY' : 'upperY';
  }
  return driver ? 'backZ' : 'frontZ';
}

// Peak palm excursions during entry and withdrawal, measured in the rig
// frame. The two MANO hands have different clearance at the index knuckle.
const innerRingApproach = {
  lowerRelay: { L: [-29, 0, -10], R: [29, 0, -10] },
  nailQuarter: { L: [-42, -38, -15], R: [42, -38, -15] },
  nailRelay: { L: [-53, -54, -8], R: [84, -8, -5] },
  padRelay: { L: [-34, 0, -4], R: [54, 3, -6] },
} as const;

export function innerRingApproachOffset(axis: Axis, dir: number, relay: boolean, side: HandSide) {
  const paths = axis === 'y' ? innerRingApproach.lowerRelay : !relay ? innerRingApproach.nailQuarter
    : dir < 0 ? innerRingApproach.nailRelay : innerRingApproach.padRelay;
  return paths[side];
}

export class FourLayerContact {
  private stroke?: FourLayerStroke;
  private readonly targets = new Map<FingerName, StickerTarget>();
  private readonly seats = new Map<FingerName, { joints: Object3D[]; home: Quaternion[] }>();
  private digits: Map<FingerName, Segment[]>;
  private slabs = new Slabs();
  private point = new Vector3();
  private toRig = new Matrix4();
  private rot = new Euler();
  private q = new Quaternion();
  private base = new Quaternion();
  private inverse = new Matrix4();

  private refresh(segments: Segment[]) {
    // A dominant-bone approximation from the home grip drifts on bent
    // fingers. Start each local fit at the current skinned surface instead.
    let deepest = -Infinity;
    for (const segment of segments) {
      this.inverse.copy(segment.joint.matrixWorld).invert().multiply(this.mesh.matrixWorld);
      segment.matrix.multiplyMatrices(this.toRig, segment.joint.matrixWorld);
      let depth = -Infinity;
      segment.deepest = undefined;
      for (const sample of segment.surface) {
        if (sample.vertex !== undefined) {
          sample.p.fromBufferAttribute(this.mesh.geometry.attributes.position, sample.vertex);
          this.mesh.applyBoneTransform(sample.vertex, sample.p).applyMatrix4(this.inverse);
        }
        const penetration = this.slabs.depth(this.point.copy(sample.p).applyMatrix4(segment.matrix));
        if (penetration > depth) {
          depth = penetration;
          segment.deepest = sample;
        }
      }
      deepest = Math.max(deepest, depth);
    }
    return deepest;
  }

  constructor(private model: HandModel, private mesh: SkinnedMesh) {
    model.group.updateWorldMatrix(true, false);
    model.group.updateMatrixWorld(true);
    this.digits = new Map(names.map(name => [name, landmarks(model, name, mesh)]));
    for (const name of names) {
      const f = model.fingers[name];
      const joints = f.meta ? [f.meta, f.root, f.mid, f.tip] : [f.root, f.mid, f.tip];
      this.seats.set(name, { joints, home: joints.map(j => j.quaternion.clone()) });
    }
  }

  private brace(profile: InnerBraceProfile, side: HandSide, primary: FingerName | undefined,
    secondary: FingerName | undefined, weight: number, lowerRelay: boolean) {
    for (const [name, { joints, home }] of this.seats) {
      if (name === primary || name === secondary) continue;
      if (lowerRelay && name === 'middle' && secondary === 'pinky' && joints.length === 4) {
        this.poseInnerDigit(name, lowerRelayMiddle, side === 'R' ? 1 : -1, weight);
        continue;
      }
      // The middle sweeps past the ring knuckle on an upper-inner relay.
      // Open the metacarpal during preparation so the ring can stay still.
      const clearRelay = profile === 'lowerY' && name === 'ring' && secondary === 'middle';
      const mirror = side === 'R' ? 1 : -1;
      const [roll, flex, splay, pip, dip] = clearRelay ? [.18 * mirror, 0, 0, -.08, -.13] : innerSliceBraces[side][profile][name];
      const root = joints.length - 3;
      if (root) {
        this.rot.set(0, clearRelay ? .24 : 0, clearRelay ? .24 * mirror : 0, 'XYZ');
        joints[0].quaternion.slerp(this.q.setFromEuler(this.rot).premultiply(home[0]), weight);
      }
      this.rot.set(roll, flex, splay, 'YZX');
      joints[root].quaternion.slerp(this.q.setFromEuler(this.rot).premultiply(home[root]), weight);
      this.rot.set(0, pip, 0);
      joints[root + 1].quaternion.slerp(this.q.setFromEuler(this.rot).premultiply(home[root + 1]), weight);
      this.rot.set(0, dip, 0);
      joints[root + 2].quaternion.slerp(this.q.setFromEuler(this.rot).premultiply(home[root + 2]), weight);
      if (profile === 'lowerY' && name === 'ring' && !clearRelay) {
        joints[root].rotateZ(.15 * mirror * weight);
      }
    }
  }

  private poseInnerDigit(name: 'middle' | 'ring' | 'pinky', pose: number[], mirror: number, weight: number) {
    const seat = this.seats.get(name)!;
    const [mx, my, mz, flex, splay, roll, pip, dip] = pose;
    this.rot.set(mx * mirror, my, mz * mirror, 'XYZ');
    seat.joints[0].quaternion.slerp(this.q.setFromEuler(this.rot).premultiply(seat.home[0]), weight);
    this.rot.set(roll * mirror, flex, splay * mirror, 'YZX');
    seat.joints[1].quaternion.slerp(this.q.setFromEuler(this.rot).premultiply(seat.home[1]), weight);
    this.rot.set(0, pip, 0);
    seat.joints[2].quaternion.slerp(this.q.setFromEuler(this.rot).premultiply(seat.home[2]), weight);
    this.rot.set(0, dip, 0);
    seat.joints[3].quaternion.slerp(this.q.setFromEuler(this.rot).premultiply(seat.home[3]), weight);
  }

  apply(stroke: FourLayerStroke, driver: HandSide | undefined, primary: FingerName | undefined,
    secondary: FingerName | undefined, weight: number, side: HandSide, home: boolean, supportHome: boolean, profile?: InnerBraceProfile) {
    const { layers, axis, angle } = stroke;
    if (layers.length === 4 || !weight) return;
    const inner = !layers.includes(0) && !layers.includes(3);
    const singleInner = inner && layers.length === 1;
    const equatorRelay = side === driver && home && primary === 'index' && secondary === 'middle' && isEquatorBand(axis, layers);
    if (equatorRelay) profile = 'lowerY';
    const lowerRelay = singleInner && axis === 'y' && layers[0] === 1 && home;
    if (profile) this.brace(profile, side, side === driver ? primary : undefined, side === driver ? secondary : undefined, weight, lowerRelay);
    if (singleInner && side !== driver) return;
    if ((profile === 'innerXRelay' || lowerRelay) && driver === side && primary === 'ring' && secondary === 'pinky'
      && this.model.fingers.ring.meta && this.model.fingers.pinky.meta) {
      const travel = MathUtils.radToDeg(Math.abs(angle)), mirror = side === 'R' ? 1 : -1;
      const curve = lowerRelay ? lowerInnerY : stroke.dir < 0 ? reverseInnerX : innerPadRelay;
      const retreat = lowerRelay ? lowerInnerYReturn : stroke.dir < 0 ? reverseInnerXReturn : innerPadRelayReturn;
      for (const name of ['ring', 'pinky'] as const) {
        const pose = sampleFingerPose(curve[name], travel);
        if (stroke.returning) {
          const clearance = sampleFingerPose(retreat[name], 1 - weight);
          const relay = MathUtils.smoothstep(travel, 90, 180);
          for (let i = 0; i < pose.length; i++) pose[i] = pose[i] * weight + clearance[i] * relay;
        }
        this.poseInnerDigit(name, pose, mirror, stroke.returning ? 1 : weight);
      }
      return;
    }
    if (inner && driver === side && !secondary && (home || profile === 'innerX')) {
      const degrees = Math.min(90, MathUtils.radToDeg(Math.abs(angle)));
      if (singleInner && axis === 'x' && primary === 'ring' && this.model.fingers.ring.meta) {
        const travel = stroke.dir > 0 ? degrees : 90 - degrees;
        const pose = sampleFingerPose(innerRingStroke, travel);
        this.poseInnerDigit('ring', pose, side === 'L' ? 1 : -1, weight);
        return;
      }
      let curve, travel = degrees;
      if (axis === 'x' && primary === 'ring') {
        curve = layers.length === 2 ? middlePair : side === 'R' ? rightInner : leftInner;
        const forward = side === 'R' ? stroke.dir > 0 : stroke.dir < 0;
        travel = forward ? degrees : 90 - degrees;
      } else if (axis !== 'x' && supportHome && layers.length === 1) {
        curve = innerQuarterSeats[axis][layers[0] === 1 ? 0 : 1][stroke.dir < 0 ? 0 : 1];
      }
      if (curve) {
        for (const name of names) {
          const rows = curve[name];
          if (rows && (!singleInner || name === primary)) seatPocketFinger(this.model.fingers[name], rows, travel, weight);
        }
        return;
      }
    }
    if (this.stroke !== stroke) {
      this.stroke = stroke;
      this.targets.clear();
    }
    this.slabs.set(stroke);
    this.toRig.copy(this.model.group.parent!.matrixWorld).invert();
    this.model.group.updateWorldMatrix(true, false);
    this.model.group.updateMatrixWorld(true);
    const handOnSlab = side === driver;
    const homeFlick = driver && home && supportHome && primary === 'index';
    const wideFlick = homeFlick && !secondary && layers.length === 3;
    const backFlick = wideFlick && axis === 'z' && !layers.includes(3);
    const upperFlick = wideFlick && axis === 'y' && !layers.includes(0);
    let flickSeats;
    if (equatorRelay) {
      // Both rows move together. Drive the same upper stripe all the way
      // through the handoff, independent of the other hand's grip.
      flickSeats = upperInnerRelaySeat;
    } else if (handOnSlab && homeFlick) {
      if (backFlick) flickSeats = backWideSeat;
      else if (upperFlick) flickSeats = upperWideSeat;
      else if (axis === 'y' && layers.length === 1 && layers[0] === 2 && secondary === 'middle') {
        flickSeats = upperInnerRelaySeat;
      }
    }
    for (const [name, segments] of this.digits) {
      if ((singleInner || equatorRelay) && name !== primary && name !== secondary) continue;
      if (homeFlick && handOnSlab && !secondary && name === 'index'
        && axis === 'z' && layers.length === 1 && layers[0] === 3) {
        seatPocketFinger(this.model.fingers.index, frontIndexSeat, MathUtils.radToDeg(Math.abs(angle)), weight, side === 'R' ? 1 : -1);
        continue;
      }
      const path = flickSeats?.[name];
      if (path) {
        const finger = this.model.fingers[name], travel = MathUtils.radToDeg(Math.abs(angle));
        // Blend from the displayed pose during setup and recovery. Both
        // driving fingers use the same physical layer angle during a relay.
        const [mx, my, mz, rx, ry, rz, mid, tip] = sampleFingerPose(path, travel);
        const mirror = side === 'R' ? 1 : -1;
        finger.meta?.quaternion.slerp(this.q.setFromEuler(this.rot.set(mx * mirror, my, mz * mirror, 'YZX')), weight);
        finger.root.quaternion.slerp(this.q.setFromEuler(this.rot.set(rx * mirror, ry, rz * mirror, 'YZX')), weight);
        finger.mid.quaternion.slerp(this.q.setFromEuler(this.rot.set(0, mid, 0)), weight);
        finger.tip.quaternion.slerp(this.q.setFromEuler(this.rot.set(0, tip, 0)), weight);
        continue;
      }
      let band: Band | undefined;
      const finger = secondary && Math.abs(angle) > Math.PI / 2 ? secondary : primary;
      const frontThumb = handOnSlab && name === 'thumb' && primary === 'thumb'
        && axis === 'z' && layers.length === 1 && layers[0] === 3;
      if (frontThumb) {
        const corner = half - tile / 2;
        band = [corner - 17, corner + 17];
        this.targets.set(name, { normalAxis: 'v', normal: -half - .75, tangent: side === 'R' ? corner : -corner, axial: corner });
      } else if (handOnSlab && name === finger && (inner || layers.length > 1)) {
        // On a wide flick a pad can bridge the seam between layers.
        let center = (this.slabs.lo + this.slabs.hi) / 2;
        if (!inner) center = layers.includes(3) ? tile : -tile;
        else if (layers.length === 2 && axis === 'x') center = (side === 'R' ? 1 : -1) * tile / 2;
        band = [center - 9, center + 9];
      } else if (handOnSlab && !primary && axis === 'x' && layers.length > 1) {
        const sign = layers.includes(3) ? 1 : -1;
        const inside = sign > 0 ? this.slabs.lo : this.slabs.hi;
        let center;
        if (name === 'middle') center = inside + sign * tile / 2;
        else if (name === 'thumb') center = sign * (half - tile / 2);
        else if (name === 'ring' && layers.length === 3) center = inside + sign * tile * 1.5;
        if (center !== undefined) band = [center - 17, center + 17];
      }
      this.refresh(segments);
      if (!frontThumb && band && (!this.targets.has(name) || angle === 0)) {
        let nearest = Infinity;
        for (const segment of segments) {
          segment.matrix.multiplyMatrices(this.toRig, segment.joint.matrixWorld);
          for (const sample of segment.points) {
            if (!sample.pad) continue;
            this.point.copy(sample.p).applyMatrix4(segment.matrix);
            const candidate = this.slabs.stickerAt(this.point, band);
            const distance = this.slabs.distanceToStickerSq(this.point, candidate, band);
            if (distance < nearest) {
              nearest = distance;
              this.targets.set(name, candidate);
            }
          }
        }
      }
      const digit = this.model.fingers[name];
      this.fit(digit, segments, band, this.targets.get(name), weight, name === 'thumb');
      // At full seating, blending weights can put the real skin inside the
      // slab even when the rigid landmarks have cleared it. Refit from the
      // resulting skin once, while the cube is still displaying this angle.
      if (weight === 1) {
        digit.root.updateWorldMatrix(false, true);
        if (this.refresh(segments) > .25) this.fit(digit, segments, band, this.targets.get(name), 1, name === 'thumb', true);
      }
      if (backFlick && !handOnSlab && (name === 'thumb' || name === 'index' || name === 'ring')) {
        applyPocketFingerPose(digit, backSupport[name], weight, side === 'R' ? 1 : -1);
      } else if (backFlick && handOnSlab && !stroke.returning && name === 'middle') {
        applyPocketFingerPose(digit, backMiddleClearance, weight, side === 'R' ? 1 : -1);
      } else if (upperFlick && handOnSlab && name === 'middle') {
        applyPocketFingerPose(digit, upperMiddleClearance, weight, side === 'R' ? 1 : -1);
      }
    }
  }

  releaseFlick(axis: Axis, layers: readonly number[], relay: boolean, angle: number, elapsed: number, side: HandSide) {
    const mirror = side === 'R' ? 1 : -1;
    if (!relay && layers.length === 3) {
      const travel = MathUtils.smoothstep(angle, 0, Math.PI / 2);
      if (axis === 'z' && !layers.includes(3)) {
        const hold = 1 - MathUtils.smoothstep(elapsed, .737, .98);
        applyPocketFingerPose(this.model.fingers.middle, backMiddleClearance, hold, mirror);
      } else if (axis === 'y' && !layers.includes(0)) {
        const clearance = MathUtils.smoothstep(elapsed, .5, .66) * (1 - MathUtils.smoothstep(elapsed, .89, 1));
        applyPocketFingerPose(this.model.fingers.middle, upperMiddleRetreat, clearance, mirror);
        seatPocketFinger(this.model.fingers.index, wideIndexRelease, elapsed, travel, mirror);
      } else {
        return;
      }
      const spread = MathUtils.smoothstep(elapsed, .2, .5) * (1 - MathUtils.smoothstep(elapsed, .9, 1));
      const splay = axis === 'z' ? -.4 : -.2;
      this.model.fingers.index.root.rotateZ(splay * mirror * spread * travel);
    } else if (axis === 'y' && relay && (layers.length === 1 && layers[0] === 2 || isEquatorBand(axis, layers))) {
      const travel = MathUtils.smoothstep(angle, Math.PI / 2, Math.PI);
      const firstQuarter = MathUtils.smoothstep(angle, 0, Math.PI / 2) * (1 - travel);
      if (firstQuarter > 0) {
        seatPocketFinger(this.model.fingers.index, innerQuarterIndexRelease, elapsed, firstQuarter, mirror);
        seatPocketFinger(this.model.fingers.middle, innerQuarterMiddleRelease, elapsed, firstQuarter, mirror);
      }
      const clearance = MathUtils.smoothstep(elapsed, 0, .12) * (1 - MathUtils.smoothstep(elapsed, .4, .62));
      this.model.fingers.index.root.rotateZ(-.14 * mirror * travel * clearance);
      seatPocketFinger(this.model.fingers.middle, innerMiddleRelease, elapsed, travel, mirror);
    }
  }

  private fit(f: FingerJoints, segments: Segment[], band: Band | undefined, target: StickerTarget | undefined, weight: number, thumb: boolean, refine = false) {
    const root = f.root, mid = f.mid;
    this.base.copy(root.quaternion);
    const midY = mid.rotation.y;
    const vars = [0, 0, 0];
    const score = () => {
      root.quaternion.copy(this.base).multiply(this.q.setFromEuler(this.rot.set(0, vars[0], vars[1], 'YZX')));
      mid.rotation.y = midY + vars[2];
      root.updateWorldMatrix(false, true);
      let worst = 0, distance = Infinity;
      for (const segment of segments) {
        segment.matrix.multiplyMatrices(this.toRig, segment.joint.matrixWorld);
        if (segment.deepest) {
          this.point.copy(segment.deepest.p).applyMatrix4(segment.matrix);
          worst = Math.max(worst, this.slabs.depth(this.point) + .65);
        }
        for (const { p, pad } of segment.points) {
          this.point.copy(p).applyMatrix4(segment.matrix);
          worst = Math.max(worst, this.slabs.depth(this.point) + .35);
          if (band && pad && target) {
            distance = Math.min(distance, this.slabs.distanceToStickerSq(this.point, target, band));
          }
        }
      }
      const contact = Number.isFinite(distance) ? distance : 0;
      return 640 * worst * worst + contact + 24 * (vars[0] ** 2 + vars[1] ** 2 + vars[2] ** 2);
    };
    let best = score();
    if (best < .16) return;
    const bounds = refine ? [.08, .08, .08] : [.52, .32, .65];
    const maxBend = (thumb ? 95 : 130) * Math.PI / 180 - (f.restBend?.[0] ?? 0);
    for (const step of [.16, .08, .04, .02, .01]) {
      for (let i = 0; i < vars.length; i++) {
        const previous = vars[i];
        let winner = previous;
        for (const direction of [-1, 1]) {
          const v = previous + step * direction;
          if (Math.abs(v) > bounds[i] || i === 2 && (midY + v > -.03 || midY + v < -maxBend)) continue;
          vars[i] = v;
          const cost = score();
          if (cost < best) { best = cost; winner = v; }
        }
        vars[i] = winner;
      }
    }
    root.quaternion.copy(this.base).multiply(this.q.setFromEuler(this.rot.set(0, vars[0] * weight, vars[1] * weight, 'YZX')));
    mid.rotation.y = midY + vars[2] * weight;
  }
}
