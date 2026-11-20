import * as THREE from 'three';
import type { HandModel } from './handModel';

const rays = ['index', 'middle', 'ring', 'pinky'] as const;
// Rig envelopes for the supported palm surface, in radial-to-ulnar order.
// The fifth ray can cup around the cube more than the second and third.
const excursion = [8, 7, 12, 18].map(THREE.MathUtils.degToRad);

/** Bind four rigid longitudinal supports to the central palm. MANO's wrist
 * influence otherwise stays behind while the metacarpals cup around the grip.
 * Work in mesh bind coordinates before the loader aligns the two hands. */
export function bindPalmArch(source: THREE.Group, bones: THREE.Bone[], geometry: THREE.BufferGeometry) {
  const wrist = bones.findIndex(b => b.name === 'wrist');
  const supports = rays.map(name => {
    const base = bones.find(b => b.name === name + '-finger-metacarpal')!;
    const knuckle = bones.find(b => b.name === name + '-finger-phalanx-proximal')!;
    const axis = knuckle.position.clone().sub(base.position);
    const bone = new THREE.Bone();
    bone.name = 'palm-support-' + name;
    bone.position.copy(base.position);
    source.add(bone);
    const index = bones.push(bone) - 1;
    return { name, bone, index, axis, proximal: bones.indexOf(knuckle), lengthSq: axis.lengthSq() };
  });
  const positions = geometry.getAttribute('position'), indices = geometry.getAttribute('skinIndex');
  const weights = geometry.getAttribute('skinWeight'), point = new THREE.Vector3(), offset = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    let donor = -1, spare = 0;
    for (let k = 0; k < 4; k++) {
      if (indices.getComponent(i, k) === wrist && weights.getComponent(i, k) > .55) donor = k;
      if (weights.getComponent(i, k) < weights.getComponent(i, spare)) spare = k;
    }
    if (donor < 0 || weights.getComponent(i, spare) >= .015) continue;
    point.fromBufferAttribute(positions, i);
    // Material on the palm side of an MCP should follow its metacarpal,
    // not be dragged forward by the flexing proximal phalanx. Pick the
    // contribution to split before reducing to the four GPU skin slots.
    let best = 0, supportIndex = -1, split = donor;
    for (const { bone, index, axis, lengthSq, proximal } of supports) {
      offset.subVectors(point, bone.position);
      const t = offset.dot(axis) / lengthSq;
      const radius = offset.addScaledVector(axis, -t).length() / Math.sqrt(lengthSq);
      const envelope = THREE.MathUtils.smoothstep(t, .10, .38) * (1 - THREE.MathUtils.smoothstep(t, .74, .96))
        * (1 - THREE.MathUtils.smoothstep(radius, .16, .40));
      if (!envelope) continue;
      let sourceSlot = donor, share = .18;
      for (let k = 0; k < 4; k++) {
        if (indices.getComponent(i, k) === proximal && k !== spare) { sourceSlot = k; share = .12; break; }
      }
      const transfer = envelope * share * weights.getComponent(i, sourceSlot);
      if (transfer > best) { best = transfer; supportIndex = index; split = sourceSlot; }
    }
    const small = weights.getComponent(i, spare);
    const transfer = best * (1 - THREE.MathUtils.smoothstep(small, 0, .015));
    if (transfer <= small) continue;
    weights.setComponent(i, split, weights.getComponent(i, split) - transfer);
    indices.setComponent(i, spare, supportIndex);
    weights.setComponent(i, spare, small + transfer);
  }
  return (model: HandModel) => {
    const rest = supports.map(({ bone }) => { model.group.attach(bone); return bone.quaternion.clone(); });
    model.palmSupports = supports.map(({ bone, axis }) => ({ bone, end: axis.clone() }));
    const rotation = new THREE.Quaternion();
    return () => {
      for (const [i, { name, bone }] of supports.entries()) {
        const driver = model.fingers[name].meta!.quaternion;
        const angle = 2 * Math.acos(Math.min(1, Math.abs(driver.w)));
        // tanh keeps the response continuous up to the limit, including on return.
        const fraction = angle < 1e-8 ? 1 : excursion[i] * Math.tanh(angle / excursion[i]) / angle;
        rotation.identity().slerp(driver, fraction).multiply(rest[i]);
        bone.quaternion.copy(rotation);
        bone.updateWorldMatrix(true, false);
      }
    };
  };
}
