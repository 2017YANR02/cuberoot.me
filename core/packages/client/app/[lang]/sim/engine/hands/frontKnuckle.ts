import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import type { FingerCurl } from './handPoses';
import { segmentAxialRotation, type HandModel } from './handModel';

const metaAxis = new Vector3();
const proximalAxis = new Vector3();
const local = new Quaternion();
const rotation = new Quaternion();
const angles = new Euler(0, 0, 0, 'YZX');
const lateralComfort = MathUtils.degToRad(18);
const twistComfort = MathUtils.degToRad(16);
const axialComfort = MathUtils.degToRad(27.5);

/** Share excess MCP rotation along the two adjoining bone axes. Each
 * compensating rotation is about the line joining two joint centers, so
 * the knuckle, PIP, distal frame and contact patch keep their trajectories. */
export function easeFingerKnuckle(finger: HandModel['fingers']['index'], weight: number): number {
  if (!finger.meta) return 0;
  const basis = finger.rootBase;
  local.copy(basis).invert().multiply(finger.root.quaternion);
  angles.setFromQuaternion(local, 'YZX');
  const splay = angles.z;
  const twist = angles.x;
  const axial = segmentAxialRotation(local, finger.mid.position) ?? 0;
  const excessAxial = axial - MathUtils.clamp(axial, -axialComfort, axialComfort);
  const excessSplay = splay - MathUtils.clamp(splay, -lateralComfort, lateralComfort);
  const excessTwist = twist - MathUtils.clamp(twist, -twistComfort, twistComfort);
  const skinWeight = MathUtils.smoothstep(Math.max(Math.abs(splay), Math.abs(twist), Math.abs(angles.y) - .50), .24, .68);
  if (Math.abs(excessSplay) + Math.abs(excessTwist) + Math.abs(excessAxial) < 1e-6) return skinWeight * weight;

  metaAxis.copy(finger.root.position).normalize();
  proximalAxis.copy(finger.mid.position).normalize();
  // The proximal roll axis is local X. A small metacarpal roll changes both
  // MCP splay and twist in a flexion-dependent proportion in the binding basis.
  const probe = .001;
  rotation.setFromAxisAngle(metaAxis, -probe);
  local.copy(basis).invert().multiply(rotation).multiply(finger.root.quaternion);
  angles.setFromQuaternion(local, 'YZX');
  const dz = (angles.z - splay) / probe;
  const dx = (angles.x - twist) / probe;
  const da = ((segmentAxialRotation(local, finger.mid.position) ?? axial) - axial) / probe;
  const slope = dz * excessSplay + dx * excessTwist + da * excessAxial;
  const metaRoll = weight * MathUtils.clamp(-slope / (dz * dz + dx * dx + da * da + .45), -.26, .26);
  const proximalRoll = weight * MathUtils.clamp(-.55 * (excessTwist + dx * metaRoll) - .45 * (excessAxial + da * metaRoll), -.24, .24);
  rotation.setFromAxisAngle(metaAxis, metaRoll);
  finger.meta.quaternion.multiply(rotation);
  finger.root.quaternion.premultiply(rotation.invert());
  rotation.setFromAxisAngle(proximalAxis, proximalRoll);
  finger.root.quaternion.multiply(rotation);
  finger.mid.quaternion.premultiply(rotation.invert());
  return skinWeight * weight;
}

/** Measure the remaining roll from the hand's gripping pose as well as bind.
 * A flexed and splayed proximal phalanx can have little bind-axis twist
 * while the skin still turns substantially from the grip. Keep the nail frame. */
export function alignFrontIndex(finger: HandModel['fingers']['index'], home: FingerCurl, side: number, weight: number): number {
  local.copy(finger.rootBase).invert().multiply(finger.root.quaternion);
  const bind = segmentAxialRotation(local, finger.mid.position) ?? 0;
  angles.set((home.twist ?? 0) * side, -home.curl[0], home.splay * side, 'YZX');
  local.premultiply(rotation.setFromEuler(angles).invert());
  const grip = segmentAxialRotation(local, finger.mid.position) ?? 0;
  const gripExcess = grip - MathUtils.clamp(grip, -.18, .18);
  const bindExcess = bind - MathUtils.clamp(bind, -.31, .31);
  // A roll removed at the MCP also changes the local PIP frame. Keep that
  // joint close to its flexion hinge when preserving the nail orientation.
  const pip = finger.mid.quaternion;
  const hingeSwing = 2 * Math.atan2(Math.hypot(pip.x, pip.z), Math.hypot(pip.w, pip.y));
  const remaining = Math.max(0, MathUtils.degToRad(10) - hingeSwing);
  const requested = weight * MathUtils.clamp(-gripExcess - bindExcess, -.23, .23);
  const correction = MathUtils.clamp(requested, -remaining, remaining);
  if (Math.abs(correction) < 1e-7) return requested;
  rotation.setFromAxisAngle(proximalAxis.copy(finger.mid.position).normalize(), correction);
  finger.root.quaternion.multiply(rotation);
  finger.mid.quaternion.premultiply(rotation.invert());
  return requested - correction;
}
