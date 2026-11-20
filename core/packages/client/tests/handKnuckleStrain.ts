import * as THREE from 'three';
import { expect } from 'vitest';
import type { FingerName, HandModel } from '@/app/[lang]/sim/engine/hands/handModel';

// Measure the same material edges through the stroke, including skin shared
// with the palm. Rigid bone centers alone cannot detect a pinched knuckle.
export function knuckleStrain(model: HandModel, finger: FingerName) {
  model.group.updateMatrixWorld(true);
  const mesh = model.meshes.find(m => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh;
  const geometry = mesh.geometry, positions = geometry.getAttribute('position');
  const bones = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight');
  const root = model.fingers[finger].root.getWorldPosition(new THREE.Vector3());
  const radius = .52 * model.fingers[finger].mid.getWorldPosition(new THREE.Vector3()).distanceTo(root);
  const read = (i: number, p: THREE.Vector3) =>
    mesh.applyBoneTransform(i, p.fromBufferAttribute(positions, i)).applyMatrix4(mesh.matrixWorld);
  const points = new Map<number, THREE.Vector3>();
  for (let i = 0; i < positions.count; i++) {
    let influence = 0;
    for (let k = 0; k < 4; k++) {
      if (mesh.skeleton.bones[bones.getComponent(i, k)].name.startsWith(finger + '-'))
        influence += weights.getComponent(i, k);
    }
    if (influence <= .08) continue;
    const p = read(i, new THREE.Vector3());
    if (p.distanceTo(root) < radius) points.set(i, p);
  }
  const edges = new Map<number, { a: THREE.Vector3; b: THREE.Vector3; rest: number }>();
  const indices = geometry.index!;
  for (let i = 0; i < indices.count; i += 3) for (let k = 0; k < 3; k++) {
    const u = indices.getX(i + k), v = indices.getX(i + (k + 1) % 3);
    const a = points.get(u), b = points.get(v);
    if (!a || !b) continue;
    const rest = a.distanceTo(b);
    if (rest > 1) edges.set(Math.min(u, v) * positions.count + Math.max(u, v), { a, b, rest });
  }
  expect(edges.size).toBeGreaterThan(0);
  return () => {
    model.group.updateMatrixWorld(true);
    for (const [i, p] of points) read(i, p);
    let min = Infinity, max = 0;
    for (const { a, b, rest } of edges.values()) {
      const ratio = a.distanceTo(b) / rest;
      min = Math.min(min, ratio); max = Math.max(max, ratio);
    }
    return { min, max };
  };
}
