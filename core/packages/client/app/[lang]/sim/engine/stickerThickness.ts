/**
 * Sticker thickness (立体贴片) toggle for the in-house engine puzzles. ON = the raised
 * rounded pillow each puzzle builds by default; OFF = the sticker squashed flat onto
 * the body (the flat-print look, the engine analogue of NxN's flat stickers).
 *
 * Generic + simRole-driven (like debugColors.ts) — the per-puzzle cost is only a
 * userData tag at build time, never branchy toggle logic here. Two sticker
 * architectures are handled off `userData`:
 *
 *  - World-baked (the makeSticker puzzles: Ivy / Dino / Redi / Rex / Heli / Skewb):
 *    the extrude basis is baked into the geometry (mesh transform is identity), so
 *    flattening projects every vertex toward the sticker's base plane along its
 *    stored outward normal `simStickerNormal`. The original positions are cached
 *    once in `userData.simPos0` so toggling is lossless either way.
 *
 *  - Local-z extrude (SQ1: stickers are individual meshes with their own transform,
 *    extruded along mesh-local +z): tagged `simFlatten:'scaleZ'`, flattened by
 *    scaling mesh-local z (the extrude axis) about the base plane at z=0.
 *
 * Stickers carrying neither tag are left untouched (safe no-op). Idempotent.
 */
import * as THREE from 'three';

/** Residual thickness when stickers are "flat": keep a thin sliver so the colored
 *  cap + dark side walls still read, instead of a z-fighting zero-height tile. */
const FLAT_FACTOR = 0.12;

export function applyStickerThickness(root: THREE.Object3D, thick: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.simRole !== 'sticker') return;

    // SQ1-style: local-z extrude, flatten by scaling the mesh's own z axis.
    if (mesh.userData.simFlatten === 'scaleZ') {
      mesh.scale.z = thick ? 1 : FLAT_FACTOR;
      return;
    }

    // World-baked: squash vertices toward the base plane along the outward normal.
    const n = mesh.userData.simStickerNormal as THREE.Vector3 | undefined;
    if (!n) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    let pos0 = mesh.userData.simPos0 as Float32Array | undefined;
    if (!pos0) { pos0 = arr.slice(); mesh.userData.simPos0 = pos0; }

    if (thick) {
      arr.set(pos0);
    } else {
      const nx = n.x, ny = n.y, nz = n.z;
      let base = Infinity;
      for (let i = 0; i < pos0.length; i += 3) {
        const d = pos0[i] * nx + pos0[i + 1] * ny + pos0[i + 2] * nz;
        if (d < base) base = d;
      }
      const k = 1 - FLAT_FACTOR;
      for (let i = 0; i < pos0.length; i += 3) {
        const d = pos0[i] * nx + pos0[i + 1] * ny + pos0[i + 2] * nz - base;
        arr[i] = pos0[i] - k * d * nx;
        arr[i + 1] = pos0[i + 1] - k * d * ny;
        arr[i + 2] = pos0[i + 2] - k * d * nz;
      }
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
  });
}
