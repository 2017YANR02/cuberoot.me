/**
 * Shared CSG body builder for /sim corner-turning cube puzzles cut by SPHERES (Ivy,
 * Rex, future ones). A piece body = cube ∩ (the spheres it is inside) − (the rest); the
 * cutting sphere for a corner is an icosphere oriented so a 120° twist about that
 * corner's body diagonal is an EXACT symmetry of its tessellation — so the sphere is
 * invariant under the turn and the moving cap slides past the stationary pieces with
 * ZERO interpenetration (constructive, not "small"). One source of truth for both the
 * sphere orientation and the cell boolean, so a new sphere-cut puzzle only supplies its
 * sphere centres/radii + per-piece membership.
 */
import * as THREE from 'three';
import { Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';

// A 3-fold (face-centre) axis of a unit icosahedron — the axis we align with a corner's
// body diagonal so 120° rotations map the sphere's vertex set onto itself (~1e-7).
const _icoFace0 = new THREE.IcosahedronGeometry(1, 0).attributes.position;
const ICO_3FOLD = new THREE.Vector3()
  .add(new THREE.Vector3().fromBufferAttribute(_icoFace0, 0))
  .add(new THREE.Vector3().fromBufferAttribute(_icoFace0, 1))
  .add(new THREE.Vector3().fromBufferAttribute(_icoFace0, 2))
  .normalize();

/** Icosphere of `radius`/`detail` rotated so one of its 3-fold axes points along
 *  `dirUnit` ⇒ a 120° turn about `dirUnit` is an exact symmetry of the mesh (the
 *  cutting sphere stays invariant under its corner's turn → zero interpenetration). */
export function alignedSphereGeo(radius: number, dirUnit: THREE.Vector3, detail: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ICO_3FOLD, dirUnit));
  return geo;
}

/** Build one piece body = `cube` ∩ (spheres[i] for i in `inside`) − (the other spheres),
 *  via CSG. Returns a CLONED geometry (independent of the shared evaluator result).
 *  `ev.useGroups` should be false so a single material yields one merged group. */
export function cutCell(ev: Evaluator, cube: Brush, spheres: Brush[], inside: number[]): THREE.BufferGeometry {
  const insideSet = new Set(inside);
  let r: Brush = cube;
  for (const i of inside) r = ev.evaluate(r, spheres[i], INTERSECTION);
  for (let i = 0; i < spheres.length; i++) if (!insideSet.has(i)) r = ev.evaluate(r, spheres[i], SUBTRACTION);
  return r.geometry.clone();
}
