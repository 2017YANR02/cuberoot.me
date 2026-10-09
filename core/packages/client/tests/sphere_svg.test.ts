import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import sharp from 'sharp';
import { exportSimSvg, simSceneSignature } from '@/app/[lang]/sim/sim_svg_export';

const WIDTH = 320;
const RADIUS = 30;
const PALETTE = [[255, 0, 0], [0, 255, 0], [0, 0, 255]] as const;

/** Uniform colors isolate occlusion from lighting and curved color boundaries.
 * Positions and the 45-degree R slice match the sphere-cubie mechanism, while
 * the visibility oracle below intersects analytic spheres, not mesh triangles.
 */
function sphereScene(angle: number) {
  const scene = new THREE.Scene();
  scene.rotation.set(0.4, 0.6, 0);
  const centers: THREE.Vector3[] = [];
  for (let z = -1; z <= 1; z++) {
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const center = new THREE.Vector3(x * 64, y * 64, z * 64);
        if (x === 1) center.applyAxisAngle(new THREE.Vector3(1, 0, 0), angle);
        centers.push(center);
      }
    }
  }
  const geometry = new THREE.SphereGeometry(RADIUS, 32, 24);
  const normals = new Float32Array(centers.length * 3);
  const colors = new Float32Array(centers.length * 3);
  for (let i = 0; i < centers.length; i++) {
    normals[i * 3 + 2] = 1;
    colors[i * 3 + i % 3] = 1;
  }
  geometry.setAttribute('aRawN0', new THREE.InstancedBufferAttribute(normals, 3));
  const faceColors = new THREE.InstancedBufferAttribute(colors, 3);
  geometry.setAttribute('aRawC0', faceColors);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, centers.length);
  mesh.userData.simSphereCubie = true;
  centers.forEach((center, i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(center)));
  scene.add(mesh);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000);
  camera.position.set(0, 0, 560);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  centers.forEach((center) => center.applyQuaternion(scene.quaternion));
  return {
    world: { scene, camera, width: WIDTH, height: WIDTH },
    centers, mesh, faceColors,
    dispose: () => { mesh.dispose(); geometry.dispose(); material.dispose(); },
  };
}

function closestSphere(fixture: ReturnType<typeof sphereScene>, x: number, y: number): number {
  const { camera } = fixture.world;
  const direction = new THREE.Vector3((x + 0.5) / WIDTH * 2 - 1, 1 - (y + 0.5) / WIDTH * 2, 0.5)
    .unproject(camera).sub(camera.position).normalize();
  let nearest = Infinity;
  let index = -1;
  fixture.centers.forEach((center, i) => {
    const offset = camera.position.clone().sub(center);
    const b = direction.dot(offset);
    const discriminant = b * b - offset.lengthSq() + RADIUS * RADIUS;
    if (discriminant < 0) return;
    const distance = -b - Math.sqrt(discriminant);
    if (distance > 0 && distance < nearest) { nearest = distance; index = i; }
  });
  return index;
}

async function occlusionMismatches(fixture: ReturnType<typeof sphereScene>) {
  const svg = exportSimSvg({ world: fixture.world });
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mismatches: Array<{ x: number; y: number; expected: readonly number[]; actual: number[] }> = [];
  let samples = 0;
  for (let y = 4; y < WIDTH - 4; y += 4) {
    for (let x = 4; x < WIDTH - 4; x += 4) {
      const index = closestSphere(fixture, x, y);
      if (index < 0) continue;
      // Ignore the 3px silhouette band: polygonal approximation, SVG strokes and
      // antialiasing legitimately differ from the exact smooth sphere there.
      if ([[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dy]) => closestSphere(fixture, x + dx, y + dy) !== index)) continue;
      const offset = (y * info.width + x) * info.channels;
      const actual = [...data.subarray(offset, offset + 3)];
      const expected = PALETTE[index % PALETTE.length];
      samples++;
      // SVG triangle-edge antialiasing can mix a few bytes from the layer below.
      // The dominant RGB channel identifies the actual visible sphere exactly.
      if (actual.indexOf(Math.max(...actual)) !== index % PALETTE.length) {
        mismatches.push({ x, y, expected, actual });
      }
    }
  }
  return { samples, mismatches };
}

describe('sphere cubie SVG', () => {
  it.each([0, Math.PI / 4])('matches analytic sphere occlusion at R angle %s', async (angle) => {
    const fixture = sphereScene(angle);
    try {
      const result = await occlusionMismatches(fixture);
      expect(result.samples).toBe(angle === 0 ? 1514 : 1493);
      expect(result.mismatches).toEqual([]);
    } finally { fixture.dispose(); }
  });

  it('refreshes the companion signature when only the sphere face palette changes', () => {
    const fixture = sphereScene(0);
    try {
      const before = simSceneSignature(fixture.world);
      fixture.faceColors.setXYZ(0, 0, 1, 0);
      fixture.faceColors.needsUpdate = true;
      expect(simSceneSignature(fixture.world)).not.toBe(before);
    } finally { fixture.dispose(); }
  });
});
