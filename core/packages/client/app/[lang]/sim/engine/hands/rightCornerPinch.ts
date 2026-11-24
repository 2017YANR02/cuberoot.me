import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { HandGesture } from './handsRig';
import type Cube from '../nxn/cube';
import { FINGER_NAMES } from './fingerCollision';
import type { HandModel } from './handModel';
import type { HandPose } from './handPoses';
import { sampleFingerPose } from './markedFingerMotion';

export const RIGHT_PINCH_MOVES = ['R2', "U'", "S'", "U2'", 'S', "U'", 'R2'] as const;
const xAxis = new Vector3(1, 0, 0), yAxis = new Vector3(0, 1, 0), zAxis = new Vector3(0, 0, 1);
// U quarter turns completed at each step boundary. Neither S turn carries a corner.
const upperQuarters = [0, 0, 1, 1, 3, 3, 4, 4];
const rollPivot = new Vector3(60, -64, 0);
// Layer degrees, MCP/PIP/DIP flexion, MCP splay/roll, PIP roll/splay, metacarpal flexion/splay/roll.
const ringDrive = [
  [0.0, 0.563281, 0.193466, 0.52585, 0.235631, -0.232559, 0.120249, 0.185303, 0.288491, -0.043062, -0.033538],
  [3.0, 0.484155, 0.20264, 0.769339, 0.085644, -0.312929, 0.198869, 0.297414, 0.331408, -0.0164, -0.090606],
  [6.0, 0.524011, 0.182528, 0.941544, -0.038427, -0.421901, 0.236099, 0.165462, 0.304478, 0.049163, -0.154814],
  [7, 0.50567, 0.16331, 0.969304, -0.040855, -0.44196, 0.187246, 0.143732, 0.320586, 0.043546, -0.16653],
  [9.0, 0.482689, 0.134386, 1.027117, -0.045126, -0.480262, 0.095188, 0.126876, 0.346531, 0.026022, -0.181066],
  [10, 0.499692, 0.122262, 1.073913, -0.065191, -0.511397, 0.030919, 0.080442, 0.340317, 0.026738, -0.191042],
  [11, 0.499866, 0.122033, 1.114768, -0.08554, -0.549332, -0.026409, 0.030669, 0.337894, 0.026574, -0.201559],
  [12.0, 0.509934, 0.123277, 1.155988, -0.108561, -0.578119, -0.092405, -0.025001, 0.335307, 0.025617, -0.216676],
  [13, 0.529092, 0.101988, 1.108079, -0.094174, -0.551594, -0.099048, -0.031263, 0.32869, 0.035385, -0.189965],
  [15.0, 0.580624, 0.053203, 1.000589, -0.054122, -0.509597, -0.091154, -0.036656, 0.314475, 0.055262, -0.152542],
  [18.0, 0.637707, 0.109332, 0.901375, -0.054649, -0.488637, -0.127956, 0.000515, 0.290866, 0.053269, -0.102926],
  [21.0, 0.664542, 0.154137, 0.828487, -0.050687, -0.478634, -0.131476, 8.2e-05, 0.282509, 0.052235, -0.080567],
  [24.0, 0.696543, 0.203467, 0.765357, -0.00609, -0.432054, -0.121336, 0.001209, 0.261723, 0.046779, -0.057645],
  [27.0, 0.724579, 0.235283, 0.700084, 0.009883, -0.421869, -0.115854, -0.002507, 0.257241, 0.042652, -0.048451],
  [30.0, 0.755233, 0.273475, 0.651146, 0.054151, -0.382786, -0.105469, 0.004538, 0.245517, 0.025373, -0.033275],
  [33.0, 0.770097, 0.300131, 0.605977, 0.07134, -0.364637, -0.096626, 0.00741, 0.245664, 0.022518, -0.025778],
  [36.0, 0.790686, 0.316546, 0.552328, 0.107592, -0.325642, -0.07922, 0.010762, 0.249231, 0.011024, -0.022679],
  [39.0, 0.793395, 0.337, 0.5143, 0.101756, -0.337596, -0.098475, 0.022115, 0.249299, 0.015609, -0.025865],
  [42.0, 0.79719, 0.346907, 0.475427, 0.111348, -0.345755, -0.113582, 0.032012, 0.2526, 0.009116, -0.033737],
  [45.0, 0.801065, 0.354452, 0.440332, 0.135781, -0.360901, -0.131588, 0.050445, 0.259252, -0.019449, -0.054291],
];

export class RightCornerPinch {
  private readonly matrix = new Matrix4();
  private readonly bind = new Quaternion();
  private readonly frame = new Quaternion();
  private readonly roll = new Quaternion();
  private readonly axis = new Vector3();
  private readonly initial: number;
  private step: number | null = null;
  private reverse = false;
  private get stroke() { return this.step === 4; }
  private approach = 0;
  private hasTurned = false;
  private retreat = 0;

  constructor(private cube: Cube, completed: number) {
    const rotation = new Quaternion().setFromAxisAngle(yAxis, upperQuarters[completed] * Math.PI / 2);
    if (completed > 0 && completed < RIGHT_PINCH_MOVES.length) rotation.multiply(this.roll.setFromAxisAngle(xAxis, Math.PI));
    const slot = this.axis.set(1, -1, 1).applyQuaternion(rotation).round().addScalar(1);
    this.initial = cube.cubelets.get(slot.x + 3 * slot.y + 9 * slot.z)!.initial;
    cube.instancedRenderer.getCubeletRenderMatrix(this.initial, this.matrix);
    this.bind.setFromRotationMatrix(this.matrix).normalize().invert().multiply(rotation);
  }

  prepare(index: number, reverse = false): boolean {
    if (this.retreat > 0) return true;
    if (this.step !== index || this.reverse !== reverse) {
      this.hasTurned = false;
      this.approach = 0;
    }
    this.step = index;
    this.reverse = reverse;
    return this.stroke && !reverse && this.approach < 1;
  }

  matches(axis: string, layers: readonly number[], angle: number) {
    if (this.step === null || layers.length !== 1) return false;
    const token = RIGHT_PINCH_MOVES[this.step];
    const face = token[0];
    if (axis !== (face === 'R' ? 'x' : face === 'U' ? 'y' : 'z') || layers[0] !== (face === 'S' ? 1 : 2)) return false;
    return token.includes('2') || Math.sign(angle) === (token.endsWith("'") !== this.reverse ? -1 : 1);
  }

  driver(axis: string, layers: readonly number[], dir: number): HandGesture | undefined {
    if (layers.length !== 1) return;
    if (this.stroke && axis === 'z' && layers[0] === 1 && dir === (this.reverse ? -1 : 1))
      return { kind: 'flick', hand: 'R', finger: 'ring', style: 'hook' };
    if ((this.step === 1 || this.step === 3 || this.step === 5) && axis === 'y' && layers[0] === 2)
      return { kind: 'weld', hands: ['R'] };
  }

  advance(dt: number) {
    if (this.retreat > 0) {
      this.retreat = Math.max(0, this.retreat - dt / 280);
      return true;
    }
    if (this.step === null) return false;
    const face = RIGHT_PINCH_MOVES[this.step][0];
    const group = face === 'S' ? this.cube.table.groups.z[1] : this.cube.table.face(face);
    const angle = group.angle;
    if (angle !== 0) this.hasTurned = true;
    else if (this.hasTurned) {
      if (this.stroke && this.reverse) this.retreat = 1;
      this.step = null;
      this.hasTurned = false;
      this.approach = 0;
    }
    const moving = this.stroke && this.approach < 1;
    if (moving) this.approach = this.reverse ? 1 : Math.min(1, this.approach + dt / 280);
    return moving;
  }

  private updatePinchFrame() {
    this.cube.instancedRenderer.getCubeletRenderMatrix(this.initial, this.matrix);
    this.frame.setFromRotationMatrix(this.matrix).normalize().multiply(this.bind);
    return this.axis.copy(xAxis).applyQuaternion(this.frame);
  }

  applyLeftHome(model: HandModel, home: HandPose, reach: number) {
    model.group.position.copy(home.pos);
    model.group.quaternion.copy(home.quat);
    // Seat the stationary pads on F3 and B5. Curl the index out of the
    // upper corners' path and give its normal S-prime stroke control at U3.
    model.fingers.thumb.root.rotateY(-.004);
    model.fingers.middle.root.rotateY(-.010);
    const direction = this.updatePinchFrame();
    const yaw = MathUtils.euclideanModulo(Math.atan2(-direction.z, direction.x), 2 * Math.PI);
    const passage = MathUtils.smoothstep(yaw, 0, .65) * (1 - MathUtils.smoothstep(yaw, 3.70, 4.48));
    const lift = passage * (1 - MathUtils.smoothstep(reach, 0, .48));
    const index = model.fingers.index;
    index.root.rotateY(.61 * lift + .16 * (1 - passage) * Math.abs(Math.sin(2 * yaw)));
    index.root.rotateZ(.065 * lift);
    index.mid.rotateY(-1.25 * lift);
    index.tip.rotateY(-.067 * lift);
  }

  apply(model: HandModel, home: HandPose, restoreFingers: () => void) {
    restoreFingers();
    const direction = this.updatePinchFrame();
    // Roll around the opposing pads as the hand crosses the far side of U.
    this.roll.setFromAxisAngle(zAxis, -1.23 * MathUtils.smoothstep(-direction.x, 0, 1));
    model.fingers.thumb.root.rotateY(.003);
    model.fingers.middle.root.rotateY(-.010);
    const front = MathUtils.smoothstep(direction.z, 0, .72);
    model.fingers.index.root.rotateY(.30 + .80 * front);
    model.fingers.index.root.rotateZ(.20 * front);
    model.group.position.copy(home.pos);
    model.group.position.x -= 16;
    model.group.position.y -= 64;
    model.group.position.sub(rollPivot).applyQuaternion(this.roll).add(rollPivot).applyQuaternion(this.frame);
    model.group.quaternion.copy(this.frame).multiply(this.roll).multiply(home.quat);

    if (this.retreat > 0) {
      this.seatRing(model, 0, MathUtils.smoothstep(this.retreat, 0, 1));
      return;
    }
    if (!this.stroke) return;
    const travelled = MathUtils.radToDeg(Math.abs(this.cube.table.groups.z[1].angle));
    const degrees = this.reverse ? 90 - travelled : travelled;
    const weight = MathUtils.smoothstep(this.approach, 0, 1) * (1 - MathUtils.smoothstep(degrees, 45, 90));
    this.seatRing(model, degrees, weight);
  }

  private readonly euler = new Euler(0, 0, 0, 'YZX');
  private readonly joint = new Quaternion();
  private readonly inverse = new Quaternion();

  private seatRing(model: HandModel, degrees: number, weight: number) {
    const f = model.fingers.ring;
    const [mcp, pip, dip, splay, twist, midRoll, midSplay, metaCurl, metaSplay, metaRoll] = sampleFingerPose(ringDrive, degrees);
    const target = (x: number, y: number, z: number) => this.joint.setFromEuler(this.euler.set(x, y, z, 'YZX'));
    f.root.quaternion.slerp(target(-twist, -mcp, -splay).premultiply(f.rootBase), weight);
    // Arc around the supporting middle finger while entering or leaving L1.
    if (degrees === 0) {
      const lift = 4 * weight * (1 - weight);
      f.root.rotateY(.20 * lift);
      f.root.rotateZ(.10 * lift);
    }
    f.mid.quaternion.slerp(target(-midRoll, -pip, -midSplay), weight);
    f.tip.quaternion.slerp(target(0, -dip, 0), weight);
    if (f.meta && f.metaBase) f.meta.quaternion.slerp(target(-metaRoll, -metaCurl, -metaSplay)
      .premultiply(f.metaBase).multiply(this.inverse.copy(f.metaBase).invert()), weight);
  }
}

// Capture the actual seated home joints, including the rig's resting hinge limits.
export function capturePinchFingers(model: HandModel) {
  const joints = FINGER_NAMES.flatMap(name => {
    const f = model.fingers[name];
    return f.meta ? [f.meta, f.root, f.mid, f.tip] : [f.root, f.mid, f.tip];
  });
  const neutral = joints.map(joint => joint.quaternion.clone());
  return () => { joints.forEach((joint, i) => joint.quaternion.copy(neutral[i])); };
}
