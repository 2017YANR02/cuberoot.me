import { expect, it } from 'vitest';
import * as THREE from 'three';
import MagicCube from '@cuberoot/puzzle-render-core/engine/magic/MagicCube';
import { SIZE } from '@cuberoot/puzzle-render-core/engine/define';
import { exportSimSvgBspWithDebug, type OrderedScreenPoly } from '@cuberoot/puzzle-render-core/bsp';
import { magicStepCount } from '@cuberoot/puzzle-solvers/magic';

type Sample = { x: number; y: number };
type InkMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
const IMAGE_SIZE = 1000;

function containsPoint(pts: number[], { x, y }: Sample): boolean {
  let inside = false;
  const count = pts.length / 3;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = pts[i * 3], yi = pts[i * 3 + 1];
    const xj = pts[j * 3], yj = pts[j * 3 + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function visibleHighlightSamples(cube: MagicCube, camera: THREE.PerspectiveCamera, inks: InkMesh[], color: string): Sample[] {
  const raycaster = new THREE.Raycaster();
  const samples: Sample[] = [];
  for (const mesh of inks) {
    if (mesh.material.color.getHexString() !== color) continue;
    const positions = mesh.geometry.getAttribute('position');
    const stride = Math.max(3, Math.floor(positions.count / 15 / 3) * 3);
    for (let i = 0; i < positions.count; i += stride) {
      // Triangle interiors avoid shared-edge ambiguity. Raycasting checks the
      // nearest actual surface, independently of BSP's coplanar painter order.
      const projected = new THREE.Vector3(
        (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3,
        (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3,
        (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3,
      ).applyMatrix4(mesh.matrixWorld).project(camera);
      raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
      const nearest = raycaster.intersectObject(cube, true)[0]?.object;
      if (!(nearest instanceof THREE.Mesh) || !(nearest.material instanceof THREE.MeshBasicMaterial)
        || nearest.material.color.getHexString() !== color) continue;
      samples.push({ x: (projected.x * 0.5 + 0.5) * IMAGE_SIZE, y: (0.5 - projected.y * 0.5) * IMAGE_SIZE });
    }
  }
  return samples;
}

function wrongColorCount(order: OrderedScreenPoly[], samples: Sample[], expected: string): number {
  return samples.filter(sample => {
    for (let i = order.length - 1; i >= 0; i--) {
      if (containsPoint(order[i].pts, sample)) return order[i].fill !== expected;
    }
    return true;
  }).length;
}

it.each([
  { puzzle: 'magic', side: 'front', sampleCount: 213, missingOrderErrors: 213 },
  { puzzle: 'magic', side: 'back', sampleCount: 218, missingOrderErrors: 218 },
  { puzzle: 'mmagic', side: 'front', sampleCount: 378, missingOrderErrors: 310 },
  { puzzle: 'mmagic', side: 'back', sampleCount: 329, missingOrderErrors: 329 },
] as const)('$puzzle $side: BSP preserves visible highlights and detects missing ink order', ({ puzzle, side, sampleCount, missingOrderErrors }) => {
  const cube = new MagicCube(puzzle);
  try {
    cube.renderPosition(side === 'front' ? 0 : magicStepCount(puzzle));
    const scene = new THREE.Scene();
    scene.add(cube, new THREE.AmbientLight(0xffffff, Math.PI));
    // Use the simulator's framing and camera distance, looking straight at
    // each endpoint. Its BSP tolerance exceeds the ink layers' depth spacing.
    const distance = (puzzle === 'magic' ? 3.25 : 4.25) * 5 * SIZE;
    const camera = new THREE.PerspectiveCamera(2 * Math.atan(0.2) * 180 / Math.PI, 1, distance - SIZE * 5, distance + SIZE * 8);
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    const world = { scene, camera, width: IMAGE_SIZE, height: IMAGE_SIZE };
    const inks = cube.tiles.flatMap(tile => tile.children.filter((child): child is InkMesh =>
      child instanceof THREE.Mesh && child.userData.simRole === 'artwork'));
    const color = puzzle === 'magic' ? 'fff1aa' : 'ffffff';
    const samples = visibleHighlightSamples(cube, camera, inks, color);
    expect(samples.length).toBe(sampleCount);
    expect(wrongColorCount(exportSimSvgBspWithDebug({ world }).order, samples, `#${color}`)).toBe(0);

    // Negative control: reproduce the original visible regression without
    // moving any geometry or changing the independent raycast samples.
    for (const mesh of inks) mesh.renderOrder = 0;
    expect(wrongColorCount(exportSimSvgBspWithDebug({ world }).order, samples, `#${color}`)).toBe(missingOrderErrors);
  } finally {
    cube.dispose();
  }
});
