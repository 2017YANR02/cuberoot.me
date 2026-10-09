/** Reproducible, browser-free geometry review. Run from core:
 * node --import tsx packages/client/scripts/pyraminx-duo/render.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildDuoCore, buildDuoPiece } from '@cuberoot/puzzle-render-core/engine/duo/duoGeometry';
import { APEX_UP_QUAT } from '@cuberoot/puzzle-render-core/engine/pyra/pyraGeometry';
import { HOME_SCENE_ROT } from '@cuberoot/puzzle-render-core/engine/viewControls';
import { exportSimSvgBsp } from '@cuberoot/puzzle-render-core/bsp';
import { exportSimSvgSchematic } from '@cuberoot/puzzle-render-core/schematic';

const scene = new THREE.Scene();
scene.rotation.set(HOME_SCENE_ROT.x, HOME_SCENE_ROT.y, HOME_SCENE_ROT.z);
const group = new THREE.Group();
group.quaternion.copy(APEX_UP_QUAT);
group.add(buildDuoCore());
const corners = Array.from({ length: 4 }, (_, i) => buildDuoPiece('corner', i));
const centres = Array.from({ length: 4 }, (_, i) => buildDuoPiece('centre', i));
for (const p of [...corners, ...centres]) group.add(p.pivot);
scene.add(group);
scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.75));
const light = new THREE.DirectionalLight(0xffffff, Math.PI * 0.4);
light.position.set(64, 192, 128);
scene.add(light);
const camera = new THREE.PerspectiveCamera(2 * Math.atan(1 / 5) * 180 / Math.PI, 1, 100, 1600);
camera.position.set(0, 0, 960);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
const world = { scene, camera, width: 1000, height: 1000 };
const directory = '.tmp/png/pyraminx-duo';
mkdirSync(directory, { recursive: true });
for (const fraction of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 1, 1).normalize(), -2 * Math.PI / 3 * fraction);
  corners[0].pivot.quaternion.copy(rotation);
  for (let i = 1; i < 4; i++) centres[i].pivot.quaternion.copy(rotation);
  scene.updateMatrixWorld(true);
  writeFileSync(`${directory}/U-${Math.round(fraction * 100)}.svg`, exportSimSvgBsp({ world, background: '#f7f7f7' }));
  if (fraction === 0 || fraction === 1) writeFileSync(`${directory}/schematic-${fraction}.svg`, exportSimSvgSchematic({ world }));
}
console.log(`Wrote six rigid-turn frames and two schematic views to ${directory}`);
