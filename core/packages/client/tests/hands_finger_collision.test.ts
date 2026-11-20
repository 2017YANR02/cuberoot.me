import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FingerObstacle, trianglesCross } from '@/app/[lang]/sim/engine/hands/fingerCollision';

const triangle = (points: number[][]) => new THREE.Triangle(...points.map(p => new THREE.Vector3(...p)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
const face = (t: THREE.Triangle) => ({ triangle: t, box: new THREE.Box3().setFromPoints([t.a, t.b, t.c]) });

describe('finger surface collision validation', () => {
  const flat = triangle([[0, 0, 0], [4, 0, 0], [0, 4, 0]]);
  it('detects a crossing even though no vertex lies on the other surface', () => {
    const crossing = triangle([[1, 1, -1], [1, 1, 1], [3, 1, 1]]);
    expect(trianglesCross(flat, crossing)).toBe(true);
    expect(trianglesCross(crossing, flat)).toBe(true);
  });
  it('rejects disjoint triangles with overlapping bounding boxes', () => {
    const separate = triangle([[3, 3, -1], [3, 3, 1], [4, 4, 0]]);
    expect(face(flat).box.intersectsBox(face(separate).box)).toBe(true);
    expect(trianglesCross(flat, separate)).toBe(false);
  });
  it('finds a crossing inside a subdivided obstacle tree', () => {
    const faces = Array.from({ length: 20 }, (_, i) => face(triangle([[i * 10, 0, 0], [i * 10 + 4, 0, 0], [i * 10, 4, 0]])));
    const crossing = face(triangle([[71, 1, -1], [71, 1, 1], [73, 1, 1]]));
    expect(new FingerObstacle(faces).intersections([crossing])).toBe(1);
  });
});
