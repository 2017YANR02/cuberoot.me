import * as THREE from 'three';
import type Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import Cubelet from '@cuberoot/puzzle-render-core/engine/nxn/cubelet';
import { FACE, SIZE, STICKER_INNER, STICKER_CORNER_RADIUS } from '@cuberoot/puzzle-render-core/engine/define';
import { OUTLINE_DEFAULT, OUTLINE_WIDTH } from '@cuberoot/puzzle-render-core/engine/nxn/stickerOutline';

const SIDES = [
  { face: FACE.F, x: 1, z: 2, angle: 0 },
  { face: FACE.R, x: 2, z: 1, angle: Math.PI / 2 },
  { face: FACE.B, x: 1, z: 0, angle: Math.PI },
  { face: FACE.L, x: 0, z: 1, angle: -Math.PI / 2 },
] as const;

/** Only top petals of the bottom color count; an ordinary solved top edge is not a daisy match. */
export function alignedDaisyFaces(cube: Cube): FACE[] {
  if (cube.order !== 3 || cube.twister.backlog > 0
    || [...cube.locks.values()].some(lock => lock.size > 0)) return [];
  const bottom = cube.cubelets.get(10)?.getColor(FACE.D);
  if (!bottom || bottom === '?') return [];
  return SIDES.filter(({ face, x, z }) => {
    const edge = cube.cubelets.get(x + 6 + z * 9);
    const center = cube.cubelets.get(x + 3 + z * 9);
    return edge?.getColor(FACE.U) === bottom
      && edge.getColor(face) !== '?' && edge.getColor(face) === center?.getColor(face);
  }).map(({ face }) => face);
}

function roundedRect(path: THREE.Path, width: number, height: number, radius: number) {
  const x = width / 2, y = height / 2;
  path.moveTo(-x + radius, -y);
  path.lineTo(x - radius, -y);
  path.quadraticCurveTo(x, -y, x, -y + radius);
  path.lineTo(x, y - radius);
  path.quadraticCurveTo(x, y, x - radius, y);
  path.lineTo(-x + radius, y);
  path.quadraticCurveTo(-x, y, -x, y - radius);
  path.lineTo(-x, -y + radius);
  path.quadraticCurveTo(-x, -y, -x + radius, -y);
  path.closePath();
}

/** One continuous frame per aligned edge/center pair, using the prediction trainer's outline style. */
export function attachDaisyAlignment(cube: Cube) {
  const shape = new THREE.Shape();
  roundedRect(shape, STICKER_INNER, STICKER_INNER + SIZE, STICKER_CORNER_RADIUS);
  const hole = new THREE.Path();
  roundedRect(hole, STICKER_INNER - 2 * OUTLINE_WIDTH, STICKER_INNER + SIZE - 2 * OUTLINE_WIDTH,
    Math.max(0, STICKER_CORNER_RADIUS - OUTLINE_WIDTH));
  shape.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({ color: OUTLINE_DEFAULT, depthWrite: false });
  Cubelet._STICKER.computeBoundingBox();
  const depth = Cubelet._STICKER.boundingBox!.max.z * (cube.instancedRenderer.thickness ? SIZE / 2 : 1);
  const frames = SIDES.map(({ face, angle }) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `daisy-alignment-${FACE[face]}`;
    mesh.rotation.y = angle;
    mesh.position.set(Math.sin(angle) * (SIZE * 1.5 + depth + 0.1), SIZE / 2,
      Math.cos(angle) * (SIZE * 1.5 + depth + 0.1));
    mesh.visible = false;
    mesh.raycast = () => {};
    cube.add(mesh);
    return { mesh, face };
  });
  return {
    hasMatch: () => frames.some(({ mesh }) => mesh.visible),
    update() {
      const aligned = alignedDaisyFaces(cube);
      let changed = false;
      for (const { mesh, face } of frames) {
        const visible = aligned.includes(face);
        if (mesh.visible !== visible) { mesh.visible = visible; changed = true; }
      }
      return changed;
    },
    dispose() {
      for (const { mesh } of frames) cube.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
