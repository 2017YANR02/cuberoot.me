import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec3 } from './space-state';

export type MaterialFactory = (color: number, metalness?: number, roughness?: number, illumination?: number) => THREE.Material;
export type ShanghaiPolygon = { id: string; kind: 'building' | 'water' | 'green'; points: [number, number][]; holes?: [number, number][][]; height?: number; minHeight?: number; name?: string };

export function shanghaiShape(p: Pick<ShanghaiPolygon, 'points' | 'holes'>) {
  const s = new THREE.Shape(p.points.map(([x, z]) => new THREE.Vector2(x, -z)));
  s.holes = (p.holes ?? []).map(h => new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  return s;
}

// Repeated architectural and bridge members share one draw call per material.
// The owning ShanghaiScene disposes the merged meshes and factory materials.
export class CityGeometry {
  readonly group = new THREE.Group();
  private batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(g: THREE.BufferGeometry, m: THREE.Material, position: Vec3 = [0, 0, 0], rotation?: THREE.Quaternion) {
    if (rotation) g.applyQuaternion(rotation);
    g.translate(...position);
    if (g.index) { const unindexed = g.toNonIndexed(); g.dispose(); g = unindexed; }
    g.clearGroups();
    const batch = this.batches.get(m) ?? []; batch.push(g); this.batches.set(m, batch);
  }
  box(size: Vec3, at: Vec3, m: THREE.Material) { this.add(new THREE.BoxGeometry(...size), m, at); }
  beam(a: Vec3, b: Vec3, width: number, m: THREE.Material, depth = width, round = false) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start), length = direction.length();
    if (length < .0001) return;
    const g = round ? new THREE.CylinderGeometry(width / 2, width / 2, length, 8) : new THREE.BoxGeometry(width, length, depth);
    this.add(g, m, start.add(end).multiplyScalar(.5).toArray(), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  }
  extrude(p: Pick<ShanghaiPolygon, 'points' | 'holes'>, bottom: number, height: number, m: THREE.Material) {
    const g = new THREE.ExtrudeGeometry(shanghaiShape(p), { depth: height, bevelEnabled: false, steps: 1 });
    g.rotateX(-Math.PI / 2); this.add(g, m, [0, bottom, 0]);
  }
  finish() {
    for (const [material, parts] of this.batches) {
      const geometry = mergeGeometries(parts); parts.forEach(g => g.dispose());
      if (!geometry) throw new Error('City geometry merge failed');
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh);
    }
    this.batches.clear(); return this.group;
  }
}
