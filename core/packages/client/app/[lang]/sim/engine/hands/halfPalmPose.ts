import * as THREE from 'three';
import type { FingerName, HandModel } from './handModel';
import { sampleFingerPose } from './markedFingerMotion';
import { HalfPalmContactSkin } from './halfPalmContactSkin';

// One passing upper corner in a right half grip. Columns are layer degrees,
// thumb splay (upward/downward winding), middle and ring flexion (downward
// winding), and ring flexion (upward winding). Joint offsets are in radians.
const UPPER_RELAY_CLEARANCE = [
  [0, 0, 0, 0, 0, 0],
  [6, .033, .040, 0, 0, 0],
  [12, .077, .062, 0, 0, 0],
  [18, .096, .072, 0, 0, 0],
  [24, .095, .066, 0, 0, 0],
  [33, .070, .037, 0, 0, 0],
  [42, .044, 0, 0, 0, 0],
  [48, .020, 0, .004, .004, 0],
  [54, 0, 0, .044, .046, 0],
  [60, 0, 0, .082, .097, 0],
  [66, 0, 0, .099, .117, 0],
  [72, 0, 0, .087, .110, 0],
  [78, 0, 0, .056, .080, .006],
  [84, 0, 0, .025, .041, .016],
  [90, 0, 0, 0, 0, 0],
] as const;

// Right-hand fits to the four material stickers carried through a half turn.
// The upper ring pad is close to the F sticker rim, so a small in-plane roll
// gives the index more room. The lower grip can shift outward as a unit.
const STANDARD_SEATS = {
  up: {
    pitch: 1.1297, yaw: 14.2399, roll: -1.0515,
    offset: new THREE.Vector3(-20.4676, 7.4997, 22.1746),
    flex: [0.255, 3.13, 3.38, 0.32],
    distalFlex: [0, -2.43, -8.553, 0],
  },
  down: {
    pitch: -4.4186, yaw: 4.9521, roll: 7.7636,
    offset: new THREE.Vector3(-35.623, -1.228, 9.7034),
    flex: [0.058, -1.19, -1.78, 1.91],
    distalFlex: [0, -2.658, -0.116, -1.32],
  },
};
// Swivel the fitted hand about the ring pad. A slight tilt lets the index
// close toward the hand side while keeping the upper palm facing upward.
const toRadians = THREE.MathUtils.degToRad;
const upperSwivel = new THREE.Quaternion().setFromEuler(new THREE.Euler(
  toRadians(.786), toRadians(.092), toRadians(3.862), 'ZYX',
));
const up = STANDARD_SEATS.up;
const baseFacing = new THREE.Euler(toRadians(up.pitch), toRadians(up.yaw), toRadians(up.roll), 'ZYX');
const upperFacing = new THREE.Euler().setFromQuaternion(new THREE.Quaternion()
  .setFromEuler(baseFacing).premultiply(upperSwivel), 'ZYX');
const upperTilt = new THREE.Vector3(upperFacing.x - baseFacing.x, upperFacing.y - baseFacing.y, upperFacing.z - baseFacing.z);
const UPPER_PAD_BEND = {
  thumb: { middle: -.24, distal: 0 },
  index: { middle: 3.342, distal: -7.909 },
  middle: { middle: 0.335, distal: -0.724 },
} as const;
const upperRingPad = new THREE.Vector3(91.550572, 77.600009, 97.619892);
const upperSeatShift = up.offset.clone().sub(upperRingPad).applyQuaternion(upperSwivel)
  .add(upperRingPad).sub(up.offset);
// Sweeping layers need a narrower working grip than the resting seat. Both
// keep four material contacts; interpolate before the neighboring column passes.
const WORKING_SEATS = {
  up:   { pitch: .53, yaw: 8.17, roll: -10.14, offset: new THREE.Vector3(-29.19, 14.24, 12.91), flex: [-.09, 1.54, -1.14, .18] },
  down: { pitch: -.51, yaw: 8.62, roll: 4.29, offset: new THREE.Vector3(-24.82, -11.17, 13.72), flex: [-.10, .53, -1.15, .83] },
};
// Local root rotation vectors and hinge increments (degrees) during the vertical
// slide. Thumb and middle pads follow B/F; the index follows the middle
// finger to keep their nail edges apart. The two ulnar fingers yield slightly.
const BOTTOM_FINGERS = {
  up: {
    index: [0, 2.5, -3, 0, 0],
    thumb: [-1.281, -4.946, 9.349, 0.373, 0.235],
    middle: [2.555, 2.724, -3.819, -1.531, 1.557],
    ring: [-0.018, 1.05, -0.176, 0.206, 0.063],
    pinky: [0, 1.25, 0, 1, 0],
  },
  down: {
    index: [0, 3, -12, 0, 0],
    thumb: [-1.509, -5.336, 8.534, 3.727, -0.638],
    middle: [1.954, 3.196, -11.624, 3.391, 1.065],
    ring: [-0.152, 4.809, -0.041, 3.206, 1.391],
    pinky: [0, 1.25, 0, 1, 0],
  },
} as const;
// Thumb CMC and MCP rotations in their local frames (YZX, radians).
// Roll the thumb pad along its own sticker while the adjacent column passes.
const CARRIED_THUMB = {
  up:   { cmc: [-.06855, .27636, .07192], mcp: [-.05541, -.51932, .25746] },
  down: { cmc: [.00983, .12172, .14649], mcp: [.01720, -.27119, .16066] },
} as const;
type HingeLimits = { middleMin: number; middleMax: number; distalMax: number };
// Local rotation vectors at the root, then PIP and DIP hinge increments (degrees).
const TOP_PINCH = {
  thumb: [1.514, -.769, 7.37, -.533, -6.242],
  index: [-.0574, .366, -.2098, -.3898, -.5302],
  middle: [-.339, 2.725, 1.107, 1.951, .636],
  ring: [-.101, 1.669, -.007, 1.175, .354],
  pinky: [0, 1.25, 0, 1, 0],
} as const;
const FINGERS: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
// Fitted on the right MANO skeleton against the uncorrected signed half turn.
const UPWARD_DISTAL_FLEX = [0, 7.5, 17.1, 10.9, 3].map(THREE.MathUtils.degToRad);
const LOCAL_FLEX_AXIS = new THREE.Vector3(0, 1, 0);
// Right-hand endpoint fits in degrees. First choose the thumb bend plane
// and its two link rolls. The other fingers use MCP twist, splay and a
// metacarpal roll around the fixed root-to-PIP chord. Mirror axial signs.
const HALF_JOINTS = {
  up: {
    thumb: [-49.1, -24.7, -2.2],
    index: [9.9, 7.4, 26],
    middle: [10.7, 0, 13.4],
    ring: [1.2, 0.8, 9.4],
    pinky: [5, -1.1, 6.9],
  },
  down: {
    thumb: [0, 4, 3],
    index: [-7, -2, -6],
    middle: [-4, 1, 0],
    ring: [1, 1, 1],
    pinky: [0, 4, 4],
  },
} as const;
export const HALF_PALM_MCP_SPLAY = THREE.MathUtils.degToRad(25);
export const HALF_PALM_MCP_TWIST = THREE.MathUtils.degToRad(18);

/** Tilt a half-turn palm about the thumb base. The metacarpal/proximal
 * links compensate for four fingers, following contact-anchored distal frames;
 * upward pads may swivel in-plane while the thumb keeps its opposing grip.
 * The thumb uses its CMC/MCP links. Joint origins and bone lengths stay fixed. */
export class HalfPalmPose {
  readonly baseQuaternion = new THREE.Quaternion();
  readonly contactSkin: HalfPalmContactSkin;
  private readonly targets = FINGERS.map(() => ({ position: new THREE.Vector3(), mid: new THREE.Vector3(), quaternion: new THREE.Quaternion() }));
  private readonly euler = new THREE.Euler();
  private readonly chains: { root: THREE.Object3D; mid: THREE.Object3D; tip: THREE.Object3D }[];
  private readonly rotation = new THREE.Quaternion();
  private readonly parent = new THREE.Quaternion();
  private readonly decomposedPosition = new THREE.Vector3();
  private readonly decomposedScale = new THREE.Vector3();
  private readonly local = new THREE.Quaternion();
  private readonly pivot = new THREE.Vector3();
  private readonly root = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly inverseMcpBases: THREE.Quaternion[];
  private readonly metacarpals: { side: number; sagittal: number; restSplay: number; restFlex: number }[];
  private readonly chord = new THREE.Vector3();
  private readonly proximal = new THREE.Vector3();
  private readonly sourceMeta = new THREE.Quaternion();
  private readonly sourceMcp = new THREE.Quaternion();
  private readonly reachRoots = FINGERS.map(() => new THREE.Vector3());
  private readonly reach = new Float64Array(FINGERS.length);
  private readonly shift = new THREE.Vector3();
  private readonly worldToParent = new THREE.Matrix3();
  private readonly inverseParent = new THREE.Matrix4();
  readonly extendedBack = new THREE.Vector3();
  private readonly inverseHalfTurnFrame: THREE.Quaternion;

  constructor(
    private readonly model: HandModel,
    private readonly fingerLimits: HingeLimits,
    private readonly thumbLimits: HingeLimits,
  ) {
    this.inverseHalfTurnFrame = new THREE.Quaternion(1, 0, 0, 0).multiply(model.group.quaternion).normalize().invert();
    this.contactSkin = new HalfPalmContactSkin(model);
    this.inverseMcpBases = FINGERS.map(name => model.fingers[name].rootBase.clone().invert());
    this.metacarpals = FINGERS.map((name, i) => {
      const axis = model.fingers[name].root.position.clone().normalize().applyQuaternion(this.inverseMcpBases[i]);
      const side = THREE.MathUtils.clamp(axis.y, -1, 1);
      return { side, sagittal: Math.hypot(axis.x, axis.z), restSplay: Math.asin(side), restFlex: Math.atan2(-axis.z, axis.x) };
    });
    this.chains = FINGERS.map(name => {
      const f = model.fingers[name];
      return f.meta ? { root: f.meta, mid: f.root, tip: f.mid } : f;
    });
  }

  placeStandard(weight: number, winding: number, switching: boolean, transport?: THREE.Quaternion, reseating = false, working = 0): void {
    const group = this.model.group;
    const { up, down } = STANDARD_SEATS;
    const t = (1 + winding) / 2;
    // Across a direct branch switch both seats are present. On an approach
    // from home the lower branch follows its original trajectory throughout.
    const pivotWeight = switching ? t : Math.max(0, winding);
    const mirror = -this.model.side;
    const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(down.pitch, up.pitch, t))
      + upperTilt.x * pivotWeight;
    const yaw = mirror * (THREE.MathUtils.degToRad(THREE.MathUtils.lerp(down.yaw, up.yaw, t))
      + upperTilt.y * pivotWeight);
    const roll = mirror * (THREE.MathUtils.degToRad(THREE.MathUtils.lerp(down.roll, up.roll, t))
      + upperTilt.z * pivotWeight);
    // Derive the wrist aim from the fitted pads. In the completed hand frame
    // the outward cube X axis runs along the intersection of the F and D planes.
    this.rotation.setFromEuler(this.euler.set(pitch, yaw, roll, 'ZYX'));
    this.extendedBack.set(mirror, 0, 0).applyQuaternion(this.rotation.invert()).applyQuaternion(this.inverseHalfTurnFrame);
    const work = winding < 0 ? WORKING_SEATS.down : WORKING_SEATS.up;
    const radians = THREE.MathUtils.degToRad(1);
    this.rotation.setFromEuler(this.euler.set(
      THREE.MathUtils.lerp(pitch, work.pitch * radians, working) * weight,
      THREE.MathUtils.lerp(yaw, work.yaw * radians * mirror, working) * weight,
      THREE.MathUtils.lerp(roll, work.roll * radians * mirror, working) * weight, 'ZYX'));
    if (transport) {
      // Express the seat transform in the moving layer's frame.
      this.rotation.premultiply(transport).multiply(this.parent.copy(transport).invert());
    }
    group.position.applyQuaternion(this.rotation);
    const clearance = switching || reseating ? 0 : 28 * (1 - weight);
    this.shift.lerpVectors(down.offset, up.offset, t).addScaledVector(upperSeatShift, pivotWeight).lerp(work.offset, working);
    // As the pads roll between half grips, the ring pad passes the outer
    // corner of its sticker. Bring it in briefly, then seat it outward again.
    const inset = switching ? 3.3 * (1 - winding * winding) : 0;
    this.shift.x = mirror * (this.shift.x + clearance - inset);
    this.shift.multiplyScalar(weight);
    if (transport) this.shift.applyQuaternion(transport);
    group.position.add(this.shift);
    group.quaternion.premultiply(this.rotation);
    // Close each supporting pad onto its carried sticker around the existing
    // middle hinge, keeping the knuckle row and relaxed fifth finger intact.
    const edgePass = switching ? (1 - winding * winding) * THREE.MathUtils.smoothstep(winding, -.45, .3) : 0;
    for (let i = 0; i < up.flex.length; i++) {
      const name = FINGERS[i], finger = this.model.fingers[name];
      // The opposing thumb settles as the index and middle pads roll.
      const padBend = name === 'ring' || name === 'pinky' ? undefined : UPPER_PAD_BEND[name];
      const seated = THREE.MathUtils.lerp(down.flex[i], up.flex[i], t) + (padBend?.middle ?? 0) * pivotWeight;
      // The index and ring pads roll past the outer F edge at different
      // heights. Tiny sagittal corrections keep their skin on the sticker.
      let clearanceDegrees = 0;
      if (name === 'index') clearanceDegrees = .58 + .67 * THREE.MathUtils.smoothstep(winding, .50, .715);
      if (name === 'ring') clearanceDegrees = 1.16 + .36 * THREE.MathUtils.smoothstep(winding, .35, .60);
      const flex = weight * radians * (THREE.MathUtils.lerp(seated, work.flex[i], working) + clearanceDegrees * edgePass);
      const limits = FINGERS[i] === 'thumb' ? this.thumbLimits : this.fingerLimits;
      finger.mid.rotation.y = THREE.MathUtils.clamp(finger.mid.rotation.y + flex,
        (finger.restBend?.[0] ?? 0) - limits.middleMax, -limits.middleMin);
      const distalFlex = (1 - working) * weight * THREE.MathUtils.degToRad(THREE.MathUtils.lerp(down.distalFlex[i], up.distalFlex[i], t) + (padBend?.distal ?? 0) * pivotWeight);
      finger.tip.rotation.y = THREE.MathUtils.clamp(finger.tip.rotation.y + distalFlex,
        (finger.restBend?.[1] ?? 0) - limits.distalMax, -.03);
    }
  }

  liftPinch(weight: number, wristAngle: number, clearance: number, elbow: THREE.Vector3, seat: number): void {
    // Translate in the R layer's frame. The same F2 and B0 material points
    // rotate onto B6 and F8 while thumb and index retain their local pose.
    const lift = 32 * weight;
    this.shift.set(0, Math.cos(wristAngle) * lift, -Math.sin(wristAngle) * lift);
    this.model.group.position.add(this.shift);
    elbow.add(this.shift);
    for (const name of FINGERS) {
      const amount = name === 'thumb' || name === 'index' ? weight : weight * clearance;
      const [x, y, z, mid, tip] = TOP_PINCH[name];
      this.axis.set(x, y, z);
      const radians = THREE.MathUtils.degToRad(amount);
      const angle = this.axis.length() * radians;
      const finger = this.model.fingers[name];
      finger.root.quaternion.multiply(this.rotation.setFromAxisAngle(this.axis.normalize(), angle));
      finger.mid.rotateY(mid * radians);
      finger.tip.rotateY(tip * radians);
    }
    // Roll the thumb pad across the seam while resuming the standard half grip.
    const thumbRoll = 4 * weight * seat * (.4 + 1.15 * weight * weight);
    this.model.fingers.thumb.mid.rotateY(THREE.MathUtils.degToRad(thumbRoll));
  }

  clearUpperRelay(order: number, winding: number, layerAngle: number, weight: number): void {
    const phase = THREE.MathUtils.radToDeg(Math.abs(layerAngle)) % 90;
    const [upThumb, downThumb, downMiddle, downRing, upRing] = sampleFingerPose(UPPER_RELAY_CLEARANCE, phase);
    const { thumb, middle, ring } = this.model.fingers;
    if (order > 2) {
      thumb.root.rotateZ((winding > 0 ? upThumb : downThumb) * weight);
      if (winding < 0) middle.root.rotateY(downMiddle * weight);
    }
    ring.root.rotateY((winding < 0 ? downRing : order > 2 ? upRing : 0) * weight);
  }

  slideToBottomRow(progress: number, winding: number): void {
    const pose = winding < 0 ? BOTTOM_FINGERS.down : BOTTOM_FINGERS.up;
    const radians = THREE.MathUtils.degToRad(progress), mirror = -this.model.side;
    this.model.group.position.y -= 35.6 * progress;
    for (const name of FINGERS) {
      const finger = this.model.fingers[name], [x, y, z, middle, distal] = pose[name];
      this.axis.set(x * mirror, y, z * mirror);
      const angle = this.axis.length() * radians;
      finger.root.quaternion.multiply(this.rotation.setFromAxisAngle(this.axis.normalize(), angle));
      const limits = name === 'thumb' ? this.thumbLimits : this.fingerLimits;
      const midY = finger.mid.rotation.y, tipY = finger.tip.rotation.y;
      // The rolling middle pad clears the seam halfway down the F column.
      const seamLift = winding > 0 && name === 'middle' ? 4.75 * (1 - progress) : 0;
      finger.mid.rotateY(THREE.MathUtils.clamp(midY + (middle + seamLift) * radians,
        (finger.restBend?.[0] ?? 0) - limits.middleMax, -limits.middleMin) - midY);
      finger.tip.rotateY(THREE.MathUtils.clamp(tipY + distal * radians,
        (finger.restBend?.[1] ?? 0) - limits.distalMax, -.03) - tipY);
    }
  }

  rollCarriedThumb(signedWeight: number, layerAngle: number): void {
    const { cmc, mcp } = signedWeight < 0 ? CARRIED_THUMB.down : CARRIED_THUMB.up;
    const w = Math.abs(signedWeight), mirrored = -this.model.side * w;
    // While the upper grip rolls onto its pads, the distal index borders
    // the corner. Rock the grip around the layer axis and follow the F plane.
    if (signedWeight > 0) {
      const rock = 4 * w * (1 - w), group = this.model.group, mirror = -this.model.side;
      const radians = THREE.MathUtils.degToRad(rock);
      this.rotation.setFromEuler(this.euler.set(-.488 * radians, -1.864 * mirror * radians,
        1.975 * mirror * radians, 'ZYX'));
      this.parent.setFromAxisAngle(this.axis.set(-1, 0, 0), layerAngle);
      this.rotation.premultiply(this.parent).multiply(this.local.copy(this.parent).invert());
      this.pivot.set(64 * mirror, 0, 0);
      group.position.sub(this.pivot).applyQuaternion(this.rotation).add(this.pivot);
      group.quaternion.premultiply(this.rotation);
      this.shift.set((2.35 * w + 3.426 * rock) * mirror, 0, -.095 * rock);
      group.position.add(this.shift.applyQuaternion(this.parent));
    }
    const thumb = this.model.fingers.thumb;
    this.euler.set(cmc[0] * mirrored, cmc[1] * w, cmc[2] * mirrored, 'YZX');
    thumb.root.quaternion.multiply(this.rotation.setFromEuler(this.euler));
    this.euler.set(mcp[0] * mirrored, mcp[1] * w, mcp[2] * mirrored, 'YZX');
    thumb.mid.quaternion.multiply(this.rotation.setFromEuler(this.euler));
  }

  apply(weight: number, winding: number): void {
    this.baseQuaternion.copy(this.model.group.quaternion);
    if (weight < 1e-8) return;
    // Wait until the upward grip is near its settled contact face before
    // swivelling the pads. During the regrip the nearest face can change.
    const contactTurn = THREE.MathUtils.smoothstep(winding, .8, 1);
    this.contactSkin.capture(weight, -5.6 * Math.PI / 180 * weight * contactTurn,
      Math.max(0, winding));
    const { group, fingers } = this.model;
    group.updateWorldMatrix(true, true);
    const mirrored = this.model.side === -1 ? 1 : -1;
    const up = Math.max(0, winding) * weight, down = Math.max(0, -winding) * weight;
    this.chains.forEach((chain, i) => {
      this.targets[i].position.setFromMatrixPosition(chain.tip.matrixWorld);
      this.targets[i].mid.setFromMatrixPosition(chain.mid.matrixWorld);
      chain.tip.matrixWorld.decompose(this.from, this.targets[i].quaternion, this.to);
      // Redistribute flexion about the distal joint. Moving its parent around
      // that pivot and counter-rotating the distal link preserves the pad frame.
      const finger = fingers[FINGERS[i]];
      const remainingFlex = this.fingerLimits.distalMax + finger.tip.rotation.y - (finger.restBend?.[1] ?? 0);
      const flex = finger.meta ? Math.min(UPWARD_DISTAL_FLEX[i] * up, Math.max(0, remainingFlex)) : 0;
      if (flex) {
        const distal = finger.tip;
        this.pivot.setFromMatrixPosition(distal.matrixWorld);
        this.axis.copy(LOCAL_FLEX_AXIS).applyQuaternion(this.targets[i].quaternion);
        this.rotation.setFromAxisAngle(this.axis, flex);
        for (const point of [this.targets[i].position, this.targets[i].mid])
          point.sub(this.pivot).applyQuaternion(this.rotation).add(this.pivot);
        this.targets[i].quaternion.premultiply(this.rotation);
        distal.quaternion.premultiply(this.rotation.setFromAxisAngle(LOCAL_FLEX_AXIS, -flex));
      }
      this.contactSkin.turn.transform(FINGERS[i], this.targets[i].position, this.targets[i].quaternion);
      this.contactSkin.turn.transform(FINGERS[i], this.targets[i].mid);
    });
    this.pivot.setFromMatrixPosition(fingers.thumb.root.matrixWorld);
    group.parent?.worldToLocal(this.pivot);
    // +y is U, +z is F. Up also yaws toward F so the palm, rather than its
    // back, faces a front observer; down faces B. Mirror about x=0.
    this.rotation.setFromEuler(this.euler.set(0, (up * 44 - down * 27) * mirrored * Math.PI / 180,
      -up * mirrored * Math.PI * 24 / 180, 'XYZ'));
    group.position.sub(this.pivot).applyQuaternion(this.rotation).add(this.pivot);
    group.quaternion.premultiply(this.rotation);
    // Rotation around the palm normal preserves its facing while aligning
    // the knuckle row. Offset the wrist to keep all three web spaces open.
    group.rotateZ(THREE.MathUtils.degToRad(-18.75 * up - 2 * down) * mirrored);
    group.position.x += (-37.7 * up + 15 * down) * mirrored;
    group.position.y += -30.8 * up + 7 * down;
    group.position.z += 34.5 * up - 22 * down;
    // On the way up, the source grip opens near 90°. Move the palm along
    // the knuckle row before closing, so reaching the same pads cannot
    // push the intermediate joints onto the extended side of the hinge.
    const clearance = up > 0 ? weight * Math.sin(Math.PI * winding) ** 2 : 0;
    if (clearance) {
      const middle = winding - .5;
      this.shift.set(-62, (-4 + 114 * middle) * mirrored, 20 + 138 * middle).applyQuaternion(group.quaternion);
      group.position.addScaledVector(this.shift, clearance);
    }
    group.updateWorldMatrix(true, true);

    // The reach pass only translates the palm. Segment lengths stay
    // constant and every joint receives the same world-space displacement,
    // so accumulate it before updating the hierarchy once.
    this.shift.set(0, 0, 0);
    for (let i = 0; i < this.chains.length; i++) {
      const finger = this.chains[i], root = this.reachRoots[i];
      root.setFromMatrixPosition(finger.root.matrixWorld);
      this.mid.setFromMatrixPosition(finger.mid.matrixWorld);
      this.tip.setFromMatrixPosition(finger.tip.matrixWorld);
      const a = root.distanceTo(this.mid), b = this.mid.distanceTo(this.tip);
      // Reserve a little bend at the fifth knuckle. At full extension its
      // bend plane is singular and the PIP has to take the residual twist.
      this.reach[i] = FINGERS[i] === 'pinky' && up > 0
        ? Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(THREE.MathUtils.degToRad(29.3) * up))
        : a + b;
    }
    for (let pass = 0; pass < 12; pass++) {
      let largest = 0;
      for (let i = 0; i < this.chains.length; i++) {
        this.root.copy(this.reachRoots[i]).add(this.shift);
        this.axis.copy(this.targets[i].position).sub(this.root);
        const excess = this.axis.length() - (this.reach[i] - 1e-6);
        if (excess <= 1e-6) continue;
        largest = Math.max(largest, excess);
        this.shift.addScaledVector(this.axis.normalize(), excess + 1e-6);
      }
      if (largest < 1e-6) break;
    }
    if (this.shift.lengthSq() > 0) {
      if (group.parent) this.shift.applyMatrix3(this.worldToParent.setFromMatrix4(
        this.inverseParent.copy(group.parent.matrixWorld).invert(),
      ));
      group.position.add(this.shift);
      group.updateWorldMatrix(false, true);
    }

    // Keep the calibrated support-finger spacing at the end of the regrip.
    // In transit the contact targets can cross the bend plane, so approach
    // the settled solution from the flexion branch of the constrained chain.
    const settled = winding >= 0 ? 1 : THREE.MathUtils.smoothstep(Math.min(weight, -winding), .55, 1);
    const fit = winding >= 0 ? HALF_JOINTS.up : HALF_JOINTS.down;
    const fitWeight = mirrored * Math.PI / 180 * weight * Math.abs(winding);
    // Let the opposing thumb turn about its two rigid links as the palm
    // passes underneath. The IP otherwise extends to hold the original pad.
    const thumbClearance = mirrored * Math.PI / 180 * clearance;
    for (let i = 0; i < FINGERS.length; i++) {
      const finger = this.chains[i], target = this.targets[i], joints = fingers[FINGERS[i]];
      this.root.setFromMatrixPosition(finger.root.matrixWorld);
      this.mid.setFromMatrixPosition(finger.mid.matrixWorld);
      this.tip.setFromMatrixPosition(finger.tip.matrixWorld);
      const a = this.root.distanceTo(this.mid), b = this.mid.distanceTo(this.tip);
      this.axis.copy(target.position).sub(this.root);
      const distance = THREE.MathUtils.clamp(this.axis.length(), Math.abs(a - b) + 1e-6, a + b - 1e-6);
      this.axis.normalize();
      const meta = i !== 0 ? joints.meta : undefined;
      if (!meta || settled > 0) {
        if (meta) {
          this.sourceMeta.copy(meta.quaternion);
          this.sourceMcp.copy(joints.root.quaternion);
        }
        this.pole.copy(target.mid).sub(this.root);
        this.pole.addScaledVector(this.axis, -this.pole.dot(this.axis));
        if (this.pole.lengthSq() < 1e-10) this.pole.set(Math.abs(this.axis.x) < .8 ? 1 : 0, Math.abs(this.axis.x) < .8 ? 0 : 1, 0).cross(this.axis);
        this.pole.normalize();
        if (i === 0) this.pole.applyAxisAngle(this.axis, fit.thumb[0] * fitWeight - 52 * thumbClearance);
        const along = (a * a + distance * distance - b * b) / (2 * distance);
        const height = Math.sqrt(Math.max(0, a * a - along * along));
        this.elbow.copy(this.root).addScaledVector(this.axis, along).addScaledVector(this.pole, height);
        this.swing(finger.root, this.from.copy(this.mid).sub(this.root), this.to.copy(this.elbow).sub(this.root));
        if (!meta && i !== 0) this.limitMcp(i);
        this.mid.setFromMatrixPosition(finger.mid.matrixWorld);
        this.tip.setFromMatrixPosition(finger.tip.matrixWorld);
        this.swing(finger.mid, this.from.copy(this.tip).sub(this.mid), this.to.copy(target.position).sub(this.mid));
        if (meta) {
          meta.quaternion.slerp(this.sourceMeta, 1 - settled);
          joints.root.quaternion.slerp(this.sourceMcp, 1 - settled);
          meta.updateWorldMatrix(false, false);
        }
      }
      if (meta) this.solveMcp(i, meta, a, b, distance, fit[FINGERS[i]], fitWeight);
      if (i === 0) {
        this.rollLink(joints.root, joints.mid, fit.thumb[1] * fitWeight);
        this.rollLink(joints.mid, joints.tip, fit.thumb[2] * fitWeight + 42 * thumbClearance);
        joints.root.updateWorldMatrix(false, true);
      }
      finger.tip.parent!.matrixWorld.decompose(this.decomposedPosition, this.parent, this.decomposedScale);
      this.parent.invert();
      finger.tip.quaternion.copy(this.parent).multiply(target.quaternion);
      finger.tip.updateWorldMatrix(false, true);
    }
  }

  /** Solve both links together using the pre-IK MCP pose as the seed.
   * In the author's YZX frame the proximal link projects onto the palm
   * axis as cos(flex - center) cos(splay) cos(restSplay)
   * + sin(splay) sin(restSplay). This gives the flexion needed for reach
   * at a bounded splay while remaining on the same bend branch. */
  private solveMcp(index: number, meta: THREE.Object3D, a: number, b: number, distance: number, fit: readonly number[], fitWeight: number): void {
    const finger = this.model.fingers[FINGERS[index]];
    const { side, sagittal, restSplay, restFlex } = this.metacarpals[index];
    this.local.copy(this.inverseMcpBases[index]).multiply(finger.root.quaternion);
    this.euler.setFromQuaternion(this.local, 'YZX');
    const twist = THREE.MathUtils.clamp(this.euler.x + fit[0] * fitWeight, -HALF_PALM_MCP_TWIST, HALF_PALM_MCP_TWIST);
    const linkDot = THREE.MathUtils.clamp((distance * distance - a * a - b * b) / (2 * a * b), -1, 1);
    const span = Math.acos(linkDot), complement = Math.PI - span;
    const reachableSplay = THREE.MathUtils.clamp(this.euler.z + fit[1] * fitWeight,
      Math.max(restSplay - span, -restSplay - complement), Math.min(restSplay + span, -restSplay + complement));
    const splay = THREE.MathUtils.clamp(reachableSplay, -HALF_PALM_MCP_SPLAY, HALF_PALM_MCP_SPLAY);
    const bend = Math.acos(THREE.MathUtils.clamp(
      (linkDot - side * Math.sin(splay)) / Math.max(1e-8, sagittal * Math.cos(splay)), -1, 1,
    ));
    this.euler.set(twist, restFlex - bend, splay, 'YZX');
    finger.root.quaternion.setFromEuler(this.euler).premultiply(finger.rootBase);
    this.chord.copy(finger.root.position).add(
      this.proximal.copy(finger.mid.position).applyQuaternion(finger.root.quaternion),
    ).normalize();
    meta.matrixWorld.decompose(this.decomposedPosition, this.parent, this.decomposedScale);
    this.axis.applyQuaternion(this.parent.invert());
    meta.quaternion.multiply(this.rotation.setFromUnitVectors(this.chord, this.axis));
    meta.quaternion.multiply(this.rotation.setFromAxisAngle(this.chord, fit[2] * fitWeight));
    meta.updateWorldMatrix(false, true);
  }

  private rollLink(parent: THREE.Object3D, child: THREE.Object3D, angle: number): void {
    this.rotation.setFromAxisAngle(this.chord.copy(child.position).normalize(), angle);
    parent.quaternion.multiply(this.rotation);
    child.quaternion.premultiply(this.rotation.invert());
  }

  private limitMcp(index: number): void {
    const finger = this.model.fingers[FINGERS[index]];
    this.local.copy(this.inverseMcpBases[index]).multiply(finger.root.quaternion);
    this.euler.setFromQuaternion(this.local, 'YZX');
    const twist = THREE.MathUtils.clamp(this.euler.x, -HALF_PALM_MCP_TWIST, HALF_PALM_MCP_TWIST);
    const splay = THREE.MathUtils.clamp(this.euler.z, -HALF_PALM_MCP_SPLAY, HALF_PALM_MCP_SPLAY);
    if (twist === this.euler.x && splay === this.euler.z) return;
    this.euler.set(twist, this.euler.y, splay, 'YZX');
    finger.root.quaternion.setFromEuler(this.euler).premultiply(finger.rootBase);
    finger.root.updateWorldMatrix(false, true);
  }

  private swing(joint: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3): void {
    this.rotation.setFromUnitVectors(from.normalize(), to.normalize());
    joint.parent!.matrixWorld.decompose(this.decomposedPosition, this.parent, this.decomposedScale);
    this.local.copy(this.parent).invert().multiply(this.rotation).multiply(this.parent);
    joint.quaternion.premultiply(this.local);
    joint.updateWorldMatrix(false, true);
  }
}
