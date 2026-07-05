/**
 * createBackView — a second WebGL renderer that views a cuber-engine World
 * from behind: the camera is the main view orbited 180° about the cube's
 * (tilted) up axis, so U stays on top and only F↔B / L↔R swap. Used by the
 * /sim back-view mini window and the recon cuber players.
 *
 * THREE + cubeletSize are passed in (not statically imported) so this module
 * stays out of bundles until the caller dynamically imports three — matching
 * how SimPage / the recon players lazy-load the cuber engine.
 */
import type * as THREE_NS from 'three';
import type World from './world';

export interface BackView {
  /** The overlay canvas — caller appends it into its framed host element. */
  domElement: HTMLCanvasElement;
  /** Render the shared scene from behind. Call right after the main render. */
  render(world: World): void;
  /** Resize the square viewport (CSS px). */
  setSize(px: number): void;
  /** Release the GL context + detach the canvas. */
  dispose(): void;
}

export function createBackView(
  THREE: typeof THREE_NS,
  cubeletSize: number,
  sizePx: number,
): BackView {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(sizePx, sizePx, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  const camera = new THREE.PerspectiveCamera(50, 1, 1, cubeletSize * 32);
  camera.layers.enable(1); // 手部补光层(无手时该层为空,零开销)
  const up = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const target = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const box = new THREE.Box3();
  const sceneSavedMat = new THREE.Matrix4();
  const sceneSavedQuat = new THREE.Quaternion();

  return {
    domElement: renderer.domElement,
    setSize(px: number) {
      renderer.setSize(px, px, false);
    },
    render(world: World) {
      // Mirror the main resize() framing for a square aspect.
      const isSq1 = world.puzzleKind === 'sq1';
      // 手开着时:取景对齐主视图 3.9,near/far 按手部真包络 10/11×cubelet 放宽
      // (HAND_SCALE 2.2 真人手比例),且 near 钳正 —— perspective 滑杆低段 distance 仅
      // 7.8×cubelet,「distance − 8」为负 = 投影矩阵损坏乱切面(与主视图同款修法)。
      const handsOn = world.hands?.isEnabled === true && world.puzzleKind === 3;
      const refHalf = cubeletSize * (isSq1 ? 4.6 : handsOn ? 3.9 : 3);
      const persp = world.perspective;
      const minv = 1 / (world.scale * persp);
      const distance = refHalf * persp;
      camera.fov = (2 * Math.atan(minv) * 180) / Math.PI;
      camera.aspect = 1;
      camera.near = Math.max(distance - cubeletSize * (handsOn ? 10 : isSq1 ? 5 : 4), cubeletSize * 0.4);
      camera.far = distance + cubeletSize * (handsOn ? 11 : 8);
      // Target + orbit pivot = the cube's own centre, so a scrambled / bumpy cube
      // (mirror cube pieces bulge off-centre) stays pinned to the window centre. A
      // *world-space* AABB of the scene-tilted cube has its extremes jump between
      // corners as a layer sweeps mid-turn → the centre wobbles → the mini cube
      // "蹦来蹦去". So compute the AABB in the scene's *untilted* frame instead (the
      // cube is axis-aligned there: a symmetric cube's centre stays put during a turn,
      // a bumpy cube's moves smoothly), then map the centre back through the real
      // scene transform. The camera offset is pan-free (0,0,distance), so panning the
      // main view doesn't drift the mini cube either.
      if (world.cube) {
        const scene = world.scene;
        sceneSavedMat.copy(scene.matrix);
        sceneSavedQuat.copy(scene.quaternion);
        scene.quaternion.identity();
        scene.updateMatrix();
        scene.updateMatrixWorld(true);
        // InstancedMesh caches its boundingBox and won't refresh it when instance
        // matrices change, so clear it to force a per-instance recompute.
        world.cube.traverse((o) => {
          const im = o as THREE_NS.InstancedMesh;
          if (im.isInstancedMesh) im.boundingBox = null;
        });
        box.setFromObject(world.cube);
        box.getCenter(target);
        scene.quaternion.copy(sceneSavedQuat);
        scene.updateMatrix();
        scene.updateMatrixWorld(true);
        target.applyMatrix4(sceneSavedMat);
      } else {
        target.set(0, 0, 0);
      }
      // Orbit the main camera 180° about the cube's up axis (model +Y after the
      // scene tilt), pivoting on the target — keeps the same downward tilt (U stays
      // on top) while swinging round to the opposite face.
      up.set(0, 1, 0).applyQuaternion(world.scene.quaternion).normalize();
      quat.setFromAxisAngle(up, Math.PI);
      camera.position.copy(offset.set(0, 0, distance).applyQuaternion(quat)).add(target);
      camera.up.set(0, 1, 0).applyQuaternion(quat);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      renderer.render(world.scene, camera);
    },
    dispose() {
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
