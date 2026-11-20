import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { WRIST_LOCAL, segmentAxialRotation, type HandModel } from './handModel';
import type { SmplxBody } from './smplxBody';

type BodyArm = ReturnType<SmplxBody['measureArm']>;
const degrees = MathUtils.radToDeg;

/** Post-IK diagnostic only. Centers are world coordinates, joint channels are
 * relative to the authored binding basis (degrees), including rest flexion. */
export function measureFinalHandPose(model: HandModel, virtualRoll: number, body: BodyArm | null) {
  const { group, forearm, radialAxis } = model;
  group.updateWorldMatrix(true, true);
  const wrist = group.localToWorld(WRIST_LOCAL.clone());
  const fingers = Object.fromEntries(Object.entries(model.fingers).map(([name, f]) => {
    const channels = (rotation: Quaternion, rest = 0) => {
      const e = new Euler().setFromQuaternion(rotation, 'YZX');
      return { flex: degrees(rest - e.y), splay: degrees(e.z * model.side), twist: degrees(e.x * model.side) };
    };
    const root = f.rootBase.clone().invert().multiply(f.root.quaternion);
    const axial = segmentAxialRotation(root, f.mid.position);
    const end = f.tipOffset?.clone() ?? new Vector3(f.segLens[2], 0, 0);
    // The thumb root controls opposition at the CMC; its MCP is the next joint.
    // Express the proximal phalanx direction in the *current metacarpal*
    // frame. A wrist turn or roll about the proximal shaft cannot change it.
    const thumb = name === 'thumb';
    const proximal = thumb ? f.tip.position.clone().applyQuaternion(f.mid.quaternion)
      : f.mid.position.clone().applyQuaternion(f.root.quaternion);
    const reference = thumb ? f.mid.position : f.meta ? f.root.position : f.mid.position.clone().applyQuaternion(f.rootBase);
    const x = reference.clone().normalize();
    const z = new Vector3(0, 0, 1).addScaledVector(x, -x.z).normalize();
    const y = new Vector3().crossVectors(z, x);
    proximal.normalize();
    const joint = thumb ? f.mid.quaternion : root;
    const twist = segmentAxialRotation(joint, thumb ? f.tip.position : f.mid.position);
    const knuckleLine = {
      flex: degrees(Math.atan2(proximal.dot(z), proximal.dot(x))),
      splay: degrees(Math.asin(MathUtils.clamp(proximal.dot(y), -1, 1))) * model.side,
      axialTwist: twist === null ? null : degrees(twist) * model.side,
    };
    return [name, {
      knuckleLine,
      centers: [f.meta, f.root, f.mid, f.tip].filter(j => j !== undefined)
        .map(j => new Vector3().setFromMatrixPosition(j.matrixWorld).toArray()).concat([end.applyMatrix4(f.tip.matrixWorld).toArray()]),
      metacarpal: f.meta && f.metaBase ? channels(f.metaBase.clone().invert().multiply(f.meta.quaternion).multiply(f.metaBase)) : null,
      root: { ...channels(root), axialTwist: axial === null ? null : degrees(axial) * model.side },
      middle: channels(f.mid.quaternion, f.restBend?.[0]), distal: channels(f.tip.quaternion, f.restBend?.[1]),
    }];
  }));
  const base = { wristCenter: wrist.toArray(), fingers, body };
  if (!forearm || !radialAxis) return { ...base, wrist: null };
  const delta = forearm.bone.quaternion.clone().multiply(forearm.bindQuat.clone().invert());
  const back = body ? new Vector3(...body.elbow).sub(wrist).normalize()
    .applyQuaternion(group.getWorldQuaternion(new Quaternion()).invert()) : forearm.bindDir.clone().applyQuaternion(delta);
  const palmar = new Vector3().crossVectors(forearm.bindDir, radialAxis).normalize();
  if (palmar.z < 0) palmar.negate();
  const forward = back.dot(forearm.bindDir);
  return { ...base, wrist: {
    bend: degrees(back.angleTo(forearm.bindDir)), flex: degrees(Math.atan2(back.dot(palmar), forward)),
    radialProjection: degrees(Math.asin(MathUtils.clamp(back.dot(radialAxis), -1, 1))),
    forearmTwist: degrees(body?.forearmTwist ?? virtualRoll),
    twistReference: body ? 'upper-arm' : 'virtual-upper-arm', forearmQuaternion: body?.forearmQuaternion ?? forearm.bone.getWorldQuaternion(new Quaternion()).toArray(),
  } };
}
