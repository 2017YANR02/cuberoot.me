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

  return {
    domElement: renderer.domElement,
    setSize(px: number) {
      renderer.setSize(px, px, false);
    },
    render(world: World) {
      // Per-puzzle framing so this mini fills its (square) box ~like the left image panel
      // (the sr-puzzlegen 2D companion, which sits at ~84–91% of its box). Each value below
      // was measured so the 3D body fills the same fraction its own left image does — the two
      // corner minis read as the same size (the reported bug: pyramid huge on the left / tiny
      // on the right). These are TIGHTER than world.resize()'s main-view refHalf on purpose:
      // the main viewport is roomy so it can afford margin, but in a 170px window that margin
      // reads as "too small". The old constant (sq1 4.6 / else 3) both under-framed pyraminx
      // (≈65%) AND over-framed the exotic solids to the point of clipping (dino/skewb spilled
      // the box at refHalf 3). NxN stays 3 — recon cuber players share this helper and are
      // always 3x3; ivy/mirror fall through to 3 too (already ~0.82). Hands keep the wide 3.9
      // frame (wrist + forearm/sleeve ring out past the cube); its near/far margins follow.
      const isSq1 = world.puzzleKind === 'sq1';
      const handsOn = world.hands?.isEnabled === true && world.puzzleKind === 3;
      const k = world.puzzleKind;
      const refHalfU = handsOn ? 3.9
        : k === 'pyraminx' ? 2.45
        : isSq1 ? 3.85
        : k === 'megaminx' ? 3.3
        : k === 'fto' ? 3.2
        : (k === 'dino' || k === 'redi' || k === 'rex' || k === 'heli' || k === 'gear'
           || k === 'skewb') ? 3.6
        : 3;
      const refHalf = cubeletSize * refHalfU;
      const persp = world.perspective;
      const minv = 1 / (world.scale * persp);
      const distance = refHalf * persp;
      camera.fov = (2 * Math.atan(minv) * 180) / Math.PI;
      camera.aspect = 1;
      camera.near = Math.max(distance - cubeletSize * (handsOn ? 13 : isSq1 ? 5 : 4), cubeletSize * 0.4);
      camera.far = distance + cubeletSize * (handsOn ? 13.5 : 8);
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
        // Zero the scene's LOCAL matrix directly (not via scene.quaternion.identity()
        // + .copy() restore) — round-tripping through .quaternion also re-derives
        // .rotation (Euler), and Three.js's decomposition isn't guaranteed to pick
        // the same one of its two equivalent branches back. The restored quaternion
        // (hence the actual render) comes out byte-identical either way, but a
        // silently "relabeled" .rotation.x/.y can land outside NxN's onOrbit ±90°
        // bookkeeping range — the next background drag then mis-reads it as
        // already-out-of-range and folds the difference into spurious recorded
        // moves. matrixAutoUpdate=false stops updateMatrixWorld() from recomputing
        // .matrix from .quaternion/.position/.scale under us while we manually swap
        // .matrix to/from identity, so .rotation is never touched at all here.
        const prevAutoUpdate = scene.matrixAutoUpdate;
        scene.matrixAutoUpdate = false;
        scene.matrix.identity();
        scene.updateMatrixWorld(true);
        // InstancedMesh caches its boundingBox and won't refresh it when instance
        // matrices change, so clear it to force a per-instance recompute.
        world.cube.traverse((o) => {
          const im = o as THREE_NS.InstancedMesh;
          if (im.isInstancedMesh) im.boundingBox = null;
        });
        box.setFromObject(world.cube);
        box.getCenter(target);
        scene.matrix.copy(sceneSavedMat);
        scene.updateMatrixWorld(true);
        scene.matrixAutoUpdate = prevAutoUpdate;
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
