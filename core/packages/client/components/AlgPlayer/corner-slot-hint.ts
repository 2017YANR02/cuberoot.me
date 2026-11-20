import { BackSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, Shape, ShapeGeometry } from 'three';
import { SIZE } from '@cuberoot/puzzle-render-core/engine/define';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';

function roundedSticker(half: number, radius: number) {
  const path = new Shape();
  path.moveTo(-half + radius, -half);
  path.lineTo(half - radius, -half);
  path.quadraticCurveTo(half, -half, half, -half + radius);
  path.lineTo(half, half - radius);
  path.quadraticCurveTo(half, half, half - radius, half);
  path.lineTo(-half + radius, half);
  path.quadraticCurveTo(-half, half, -half, half - radius);
  path.lineTo(-half, -half + radius);
  path.quadraticCurveTo(-half, -half, -half + radius, -half);
  return new ShapeGeometry(path, 8);
}

export function attachCornerSlotHint(cube: Cube, slots: readonly number[], color: string, includeBackFacelets = false) {
  const n = cube.order;
  const halfOrder = (n - 1) / 2;
  const surface = (n / 2 + .06) * SIZE;
  const geometry = roundedSticker(SIZE * .45, SIZE * .09);
  const material = new MeshLambertMaterial({ color, transparent: true, depthWrite: false });
  const backMaterial = includeBackFacelets
    ? new MeshBasicMaterial({ color, side: BackSide, transparent: true, depthWrite: false })
    : null;
  const group = new Group();
  for (const slot of slots) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= n ** 3) continue;
    const x = slot % n;
    const y = Math.floor(slot / n) % n;
    const z = Math.floor(slot / (n * n));
    if (![x, y, z].every(index => index === 0 || index === n - 1)) continue;
    const xyz = [x, y, z].map(index => (index - halfOrder) * SIZE);
    const signs = xyz.map(Math.sign);
    // Each purple sticker lives on a fixed puzzle face, outside the rotating cubelets.
    for (const axis of [0, 1, 2] as const) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(xyz[0], xyz[1], xyz[2]);
      mesh.position.setComponent(axis, signs[axis] * surface);
      if (axis === 0) mesh.rotation.y = signs[axis] * Math.PI / 2;
      if (axis === 1) mesh.rotation.x = -signs[axis] * Math.PI / 2;
      if (axis === 2 && signs[axis] < 0) mesh.rotation.y = Math.PI;
      group.add(mesh);
      if (backMaterial) {
        const facelet = new Mesh(geometry, backMaterial);
        facelet.position.copy(mesh.position);
        facelet.rotation.copy(mesh.rotation);
        // The floating facelet is one cube width from the center.
        // Put the tint just inside its back-facing plane.
        facelet.position.setComponent(axis, signs[axis] * (n - .005) * SIZE);
        group.add(facelet);
      }
    }
  }
  cube.add(group);
  return {
    setOpacity(opacity: number) {
      material.opacity = opacity;
      if (backMaterial) backMaterial.opacity = opacity;
      group.visible = opacity > 0;
    },
    dispose() {
      cube.remove(group);
      geometry.dispose();
      material.dispose();
      backMaterial?.dispose();
    },
  };
}
