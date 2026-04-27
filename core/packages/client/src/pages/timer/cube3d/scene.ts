/**
 * Pure three.js scene builder for the 3D cube preview.
 *
 * `createScene(n, sizePx)` builds a scene + camera + renderer + the surface
 * cubies of an NxN cube. Each cubie is a single `BoxGeometry` mesh with a
 * shared geometry and six per-face materials drawn from a tiny colour pool.
 *
 * Visual gap between stickers: each cubie is rendered at scale ~0.92 and
 * the renderer is configured with `alpha:true`, so the page background
 * shows through the gaps.
 *
 * The returned `applyState(state)` re-points each cubie's face material at
 * the matching colour, keeping allocation churn minimal. `dispose()` tears
 * everything down.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import type { CubeFaces } from '../cube/state.ts';
import type { Face } from '../cube/moves.ts';
import { WCA_COLORS } from '../cube/colors.ts';
import {
  INTERNAL_COLOR,
  colorsForCubie,
} from './state_to_colors.ts';

/** How much of a unit cubie is visible (the rest becomes the inter-cubie gap). */
const CUBIE_SCALE = 0.92;

export interface SceneHandles {
  scene: THREE.Scene;
  /** The Group containing every cubie. Rotate this for cube-wide spins
   *  (e.g. auto-rotate) without disturbing camera or lights. */
  cubeRoot: THREE.Group;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** Re-color all cubies based on a fresh CubeFaces state. */
  applyState: (state: CubeFaces, palette?: Record<Face, string>) => void;
  /** Request a single render of the current scene. */
  requestRender: () => void;
  /** Resize renderer & camera to the new CSS size. */
  resize: (sizePx: number) => void;
  /** Dispose everything: geometries, materials, renderer, DOM canvas. */
  dispose: () => void;
}

/**
 * Create a scene rendering an NxN cube. The caller is responsible for
 * appending `renderer.domElement` to the host DOM and for calling
 * `requestRender()` (or installing an animation loop).
 */
export function createScene(
  n: number,
  sizePx: number,
  palette: Record<Face, string> = WCA_COLORS,
): SceneHandles {
  const scene = new THREE.Scene();
  scene.background = null;

  // Camera: classic 3/4 view from +X+Y+Z. Distance scales with N so larger
  // cubes still fit comfortably in frame.
  const fov = 35;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  const camDist = n * 2.6 + 1.5;
  camera.position.set(camDist * 0.7, camDist * 0.65, camDist * 0.85);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(sizePx, sizePx, false);
  renderer.setClearColor(0x000000, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minDistance = camDist * 0.6;
  controls.maxDistance = camDist * 1.6;
  controls.rotateSpeed = 0.7;
  controls.target.set(0, 0, 0);

  // Lights: MeshBasicMaterial doesn't react to lights, but we keep them
  // around in case a future material swap wants them. Cost is negligible.
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.4);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // Material pool keyed by hex. WCA palette gives 6 sticker colours + 1
  // internal dark = 7 materials total for the whole cube.
  const matPool = new Map<string, THREE.MeshBasicMaterial>();
  function getMat(hex: string): THREE.MeshBasicMaterial {
    let m = matPool.get(hex);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: hex });
      matPool.set(hex, m);
    }
    return m;
  }
  // Pre-warm pool so the dark/internal entry exists even if no surface
  // cubie ever uses it (defensive).
  getMat(INTERNAL_COLOR);

  // Shared geometry for all cubies — one BoxGeometry, scaled down on each
  // mesh's `scale` property so the gap shows.
  const geom = new THREE.BoxGeometry(1, 1, 1);

  type Cubie = {
    mesh: THREE.Mesh;
    i: number;
    j: number;
    k: number;
  };
  const cubies: Cubie[] = [];

  const off = (n - 1) / 2;
  const cubeRoot = new THREE.Group();
  scene.add(cubeRoot);

  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        const isSurface =
          i === 0 || i === n - 1 ||
          j === 0 || j === n - 1 ||
          k === 0 || k === n - 1;
        if (!isSurface) continue;

        const mats: THREE.MeshBasicMaterial[] = [
          getMat(INTERNAL_COLOR), getMat(INTERNAL_COLOR),
          getMat(INTERNAL_COLOR), getMat(INTERNAL_COLOR),
          getMat(INTERNAL_COLOR), getMat(INTERNAL_COLOR),
        ];
        const mesh = new THREE.Mesh(geom, mats);
        mesh.position.set(i - off, j - off, k - off);
        mesh.scale.setScalar(CUBIE_SCALE);
        cubeRoot.add(mesh);

        cubies.push({ mesh, i, j, k });
      }
    }
  }

  function applyState(state: CubeFaces, p: Record<Face, string> = palette): void {
    for (const cu of cubies) {
      const cols = colorsForCubie(state, n, cu.i, cu.j, cu.k, p);
      const mats = cu.mesh.material as THREE.MeshBasicMaterial[];
      for (let s = 0; s < 6; s++) {
        mats[s] = getMat(cols[s]);
      }
    }
  }

  function requestRender(): void {
    renderer.render(scene, camera);
  }

  function resize(px: number): void {
    renderer.setSize(px, px, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }

  function dispose(): void {
    controls.dispose();
    geom.dispose();
    for (const m of matPool.values()) m.dispose();
    matPool.clear();
    renderer.dispose();
    if (renderer.forceContextLoss) {
      try { renderer.forceContextLoss(); } catch { /* ignore */ }
    }
    // Detach cubies from scene so GC can collect them.
    while (cubeRoot.children.length) cubeRoot.remove(cubeRoot.children[0]);
    scene.remove(cubeRoot);
  }

  return {
    scene,
    cubeRoot,
    camera,
    renderer,
    controls,
    applyState,
    requestRender,
    resize,
    dispose,
  };
}
