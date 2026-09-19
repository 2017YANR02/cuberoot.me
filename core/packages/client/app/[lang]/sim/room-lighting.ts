import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Scoped studio lighting: switching back restores the simulator's original presentation. */
export function lightRoomCube(renderer: THREE.WebGLRenderer, scene: THREE.Scene, order: number) {
  const previous = {
    environment: scene.environment, intensity: scene.environmentIntensity,
    shadows: renderer.shadowMap.enabled, shadowType: renderer.shadowMap.type,
    toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
  };
  const existing: [THREE.Light, number][] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Light) { existing.push([object, object.intensity]); object.intensity *= 0.12; }
  });
  const studio = new RoomEnvironment(), generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, 0.04);
  studio.dispose(); generator.dispose();
  scene.environment = environment.texture; scene.environmentIntensity = 0.32;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const key = new THREE.DirectionalLight('#fff0d7', 3.6);
  key.position.set(order * 74, order * 100, order * 120);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const extent = order * 55;
  Object.assign(key.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: order * 380 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = 0.12; key.shadow.bias = -0.00008;
  const fill = new THREE.HemisphereLight('#e2eef6', '#8a6950', 0.48);
  const rim = new THREE.DirectionalLight('#d8eaf6', 0.8);
  rim.position.set(-order * 90, order * 45, -order * 65);
  scene.add(key, key.target, fill, rim);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const [light, intensity] of existing) light.intensity = intensity;
    scene.remove(key, key.target, fill, rim); key.dispose(); fill.dispose(); rim.dispose();
    scene.environment = previous.environment; scene.environmentIntensity = previous.intensity;
    renderer.shadowMap.enabled = previous.shadows; renderer.shadowMap.type = previous.shadowType;
    renderer.toneMapping = previous.toneMapping; renderer.toneMappingExposure = previous.exposure;
    environment.dispose();
  };
}
