/**
 * Hint facelets (提示贴片 背面) for the in-house engine puzzles — the engine analogue
 * of NxN's `instancedRenderer.hint`. For every colored sticker we attach a faded,
 * BackSide "ghost" copy floating beyond the body along the sticker's outward normal.
 * BackSide means only the ghosts on the FAR side of the puzzle render (their front
 * faces point away from the camera), so you see the hidden back faces' colors around
 * the silhouette — exactly like alg.cubing.net / cubing.js hint stickers.
 *
 * Generic + simRole-driven (like stickerThickness.ts / debugColors.ts): rides the
 * `simRole='sticker'` + `simStickerNormal` (makeSticker puzzles) / `simFlatten='scaleZ'`
 * (SQ1) tags already on every sticker. Each ghost is a CHILD of its sticker mesh, so
 * it follows the piece through turns for free. Built lazily on first enable, then just
 * toggled visible. Idempotent.
 *
 * Two sticker architectures (mirrors stickerThickness.ts):
 *  - World-baked (makeSticker: Ivy/Dino/Redi/Rex/Heli/Skewb): the mesh transform is
 *    identity (scale 1), so the ghost is offset by `simStickerNormal * dist`.
 *  - Local-z extrude (SQ1): the sticker mesh carries a thickness `scale.z`; offsetting
 *    along local +z gets scaled by it, so we divide by scale.z to keep a constant
 *    world push (recomputed each apply in case thickness toggled).
 */
import * as THREE from 'three';

/** ghost color = MIX*sticker + (1-MIX)*bg — faded toward the backdrop (matches NxN). */
const HINT_FACE_MIX = 0.35;
/** Push distance as a fraction of the puzzle's bounding radius (NxN floats its hint
 *  plane at ~2× the face distance; ~0.9R out from a surface sticker lands near there). */
const PUSH_FACTOR = 0.9;

function stickerCapColor(mesh: THREE.Mesh): THREE.Color | null {
  const m = mesh.material;
  const mat = (Array.isArray(m) ? m[0] : m) as THREE.Material & { color?: THREE.Color };
  return mat?.color ? mat.color.clone() : null;
}

export function applyHintFacelets(root: THREE.Object3D, on: boolean, bgHex?: string): void {
  const bg = new THREE.Color(bgHex && bgHex.length ? bgHex : 0xffffff);

  // Bounding radius (cached) — measured once before any ghost exists.
  let radius = root.userData.simHintRadius as number | undefined;
  if (radius === undefined) {
    const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
    radius = sphere.radius || 1;
    root.userData.simHintRadius = radius;
  }
  const dist = radius * PUSH_FACTOR;

  // Collect stickers first (don't mutate the tree mid-traverse).
  const stickers: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.userData.simRole === 'sticker') stickers.push(mesh);
  });

  for (const mesh of stickers) {
    const isSq1 = mesh.userData.simFlatten === 'scaleZ';
    let ghost = mesh.userData.simHint as THREE.Mesh | undefined;

    if (!ghost) {
      if (!on) continue; // build lazily on first enable
      const col = stickerCapColor(mesh);
      const dir = isSq1
        ? new THREE.Vector3(0, 0, 1)
        : (mesh.userData.simStickerNormal as THREE.Vector3 | undefined)?.clone();
      if (!col || !dir) continue;
      dir.normalize();
      const ghMat = new THREE.MeshBasicMaterial({ color: col.lerp(bg, 1 - HINT_FACE_MIX), side: THREE.BackSide });
      ghost = new THREE.Mesh(mesh.geometry.clone(), ghMat);
      ghost.raycast = () => {}; // purely visual — never intercept drag picking
      ghost.userData.simHintGhost = true;
      mesh.add(ghost);
      mesh.userData.simHint = ghost;
    }

    ghost.visible = on;
    if (on) {
      // Refresh position (SQ1 scale.z may have changed) + color (theme / face colors).
      const sz = isSq1 ? (mesh.scale.z || 1) : 1;
      const dir = isSq1
        ? new THREE.Vector3(0, 0, 1)
        : (mesh.userData.simStickerNormal as THREE.Vector3).clone().normalize();
      ghost.position.copy(dir).multiplyScalar(dist / sz);
      const col = stickerCapColor(mesh);
      if (col) (ghost.material as THREE.MeshBasicMaterial).color.copy(col.lerp(bg, 1 - HINT_FACE_MIX));
    }
  }
}
