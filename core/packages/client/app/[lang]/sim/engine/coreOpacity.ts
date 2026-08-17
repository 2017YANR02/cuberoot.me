/**
 * Uniform core/body opacity for every in-house 3D puzzle.
 *
 * NxN uses shared frame materials plus an ordered x-ray pass. The other engines
 * tag their body meshes with `simRole='body' | 'core'`; those materials are cloned
 * before changing opacity so a shared sticker-side material is never mutated.
 */
import * as THREE from 'three';
import Cubelet from './nxn/cubelet';
import { setRawMaterialOpacity } from './nxn/rawCore';

const translucentByBase = new WeakMap<THREE.Material, THREE.Material>();
const baseByTranslucent = new WeakMap<THREE.Material, THREE.Material>();

function translucentMaterial(material: THREE.Material, opacity: number): THREE.Material {
  const base = baseByTranslucent.get(material) ?? material;
  let clone = translucentByBase.get(base);
  if (!clone) {
    clone = base.clone();
    translucentByBase.set(base, clone);
    baseByTranslucent.set(clone, base);
  }
  clone.opacity = base.opacity * opacity;
  clone.transparent = opacity < 1 || base.transparent;
  clone.needsUpdate = true;
  return clone;
}

function materialOpacity(
  material: THREE.Material | THREE.Material[], opacity: number,
): THREE.Material | THREE.Material[] {
  const materials = Array.isArray(material) ? material : [material];
  const next = materials.map((m) => {
    const base = baseByTranslucent.get(m) ?? m;
    return opacity >= 1 ? base : translucentMaterial(base, opacity);
  });
  return Array.isArray(material) ? next : next[0];
}

/** Apply an absolute 0..100 body opacity. Invalid values are clamped at the entry. */
export function applyCoreOpacity(root: THREE.Object3D, percent: number): void {
  const opacity = Math.min(1, Math.max(0, Number.isFinite(percent) ? percent / 100 : 1));
  const nxn = root as THREE.Object3D & {
    instancedRenderer?: { xray: boolean };
  };

  if (nxn.instancedRenderer) {
    for (const material of [Cubelet.CORE, Cubelet.CORE_BASIC, Cubelet._PANEL_MAT]) {
      if (material.opacity === opacity && material.transparent === (opacity < 1)) continue;
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    }
    setRawMaterialOpacity(opacity);
    nxn.instancedRenderer.xray = opacity < 1;
    return;
  }

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const role = mesh.userData.simRole as string | undefined;
    if (role !== 'body' && role !== 'core') return;
    mesh.material = materialOpacity(mesh.material, opacity);
  });
}

/** Match /predict's transparent-view contract: hide the puzzle body and disable
 *  NxN's synthetic back-sticker hints so the real reverse stickers show through. */
export function applyPuzzleTransparency(root: THREE.Object3D, transparent: boolean): void {
  applyCoreOpacity(root, transparent ? 0 : 100);
  const nxn = root as THREE.Object3D & {
    instancedRenderer?: { hint: boolean };
  };
  if (nxn.instancedRenderer) nxn.instancedRenderer.hint = !transparent;
}
