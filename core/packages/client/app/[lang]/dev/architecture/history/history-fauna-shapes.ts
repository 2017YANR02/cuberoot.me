import * as T from 'three';
import type { PaperScenery } from './history-scenery';

export type AnimalPoint = [number, number, number];
export type AnimalBuilder = (art: PaperScenery, root: T.Group) => void;

/** Shared paper primitives; every species supplies its own proportions and identifying anatomy. */
export function ellipsoid(art: PaperScenery, root: T.Object3D, color: string, center: AnimalPoint, scale: AnimalPoint) {
  const mesh = art.mesh(root, new T.SphereGeometry(1, 10, 7), color, center);
  mesh.scale.set(...scale);
  return mesh;
}

export function joint(root: T.Object3D, name: string, position: AnimalPoint) {
  const group = new T.Group(); group.name = name; group.position.set(...position); root.add(group);
  return group;
}

export function rod(art: PaperScenery, root: T.Object3D, color: string, from: AnimalPoint, to: AnimalPoint, radius = .06, tipRadius = radius) {
  const a = new T.Vector3(...from), b = new T.Vector3(...to), axis = b.clone().sub(a);
  const mesh = art.mesh(root, new T.CylinderGeometry(tipRadius, radius, axis.length(), 7), color);
  mesh.position.copy(a.add(b).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), axis.normalize());
  return mesh;
}

export function eyes(art: PaperScenery, root: T.Object3D, center: AnimalPoint, spread: number, size = .045) {
  for (const side of [-1, 1]) ellipsoid(art, root, art.palette.ink,
    [center[0], center[1], center[2] + side * spread], [size, size, size * .55]);
}
