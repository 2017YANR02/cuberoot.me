/** Apply /sim's core opacity to cubing.js Cube3D and PuzzleGeometry renderers. */
import type * as THREE from 'three';

type Material = THREE.Material;
type MaterialHolder = { material: Material | Material[] };

const translucentByPuzzle = new WeakMap<object, WeakMap<Material, Material>>();
const baseByTranslucent = new WeakMap<Material, Material>();

function materialAtOpacity(material: Material, opacity: number, copies: WeakMap<Material, Material>): Material {
  const base = baseByTranslucent.get(material) ?? material;
  if (base.opacity === opacity && base.transparent === (opacity < 1)) return base;
  let clone = copies.get(base);
  if (!clone) {
    clone = base.clone();
    copies.set(base, clone);
    baseByTranslucent.set(clone, base);
  }
  clone.opacity = opacity;
  clone.transparent = opacity < 1;
  clone.needsUpdate = true;
  return clone;
}

function setHolderOpacity(holder: MaterialHolder, opacity: number, copies: WeakMap<Material, Material>): void {
  holder.material = Array.isArray(holder.material)
    ? holder.material.map((m) => materialAtOpacity(m, opacity, copies))
    : materialAtOpacity(holder.material, opacity, copies);
}

const afterRenderTurn = (): Promise<void> => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

export function applyTwistyPuzzleCoreOpacity(obj: object, opacity: number): boolean {
  const foundationAware = obj as THREE.Object3D & {
    experimentalUpdateOptions?: (opts: { showFoundation: boolean }) => void;
    experimentalFoundationMeshes?: MaterialHolder[];
    materialArray1?: Material[];
    materialArray2?: Material[];
    scheduleRenderCallback?: () => void;
  };
  const cubeFoundations = foundationAware.experimentalFoundationMeshes;
  const pgFoundations = foundationAware.materialArray1 && foundationAware.materialArray2;
  if (!cubeFoundations && !pgFoundations) return false;

  let copies = translucentByPuzzle.get(obj);
  if (!copies) {
    copies = new WeakMap();
    translucentByPuzzle.set(obj, copies);
  }
  foundationAware.experimentalUpdateOptions?.({ showFoundation: opacity > 0 });
  if (cubeFoundations) {
    for (const mesh of cubeFoundations) setHolderOpacity(mesh, opacity, copies);
  }
  // PG3D reserves material groups 6/7 for the two foundation draw passes.
  if (foundationAware.materialArray1 && foundationAware.materialArray2 && opacity > 0) {
    foundationAware.materialArray1[6] = materialAtOpacity(foundationAware.materialArray1[6], opacity, copies);
    foundationAware.materialArray2[7] = materialAtOpacity(foundationAware.materialArray2[7], opacity, copies);
  }
  foundationAware.scheduleRenderCallback?.();
  return true;
}

/**
 * cubing.js exposes foundation visibility but not fractional opacity. Its two 3D
 * implementations do expose their live foundation meshes/material slots, so the
 * slider uses the official show/hide path and then replaces only those materials.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyTwistyCoreOpacity(
  player: any, percent: number, isCurrent: () => boolean = () => true,
): Promise<void> {
  const opacity = Math.min(1, Math.max(0, Number.isFinite(percent) ? percent / 100 : 1));
  const sceneModel = player?.experimentalModel?.twistySceneModel;
  try { sceneModel?.foundationDisplay?.set(opacity === 0 ? 'none' : 'auto'); } catch { /* */ }

  await afterRenderTurn();
  if (!isCurrent()) return;
  const puzzleObject = await player?.experimentalCurrentThreeJSPuzzleObject?.();
  if (!isCurrent()) return;
  if (puzzleObject && applyTwistyPuzzleCoreOpacity(puzzleObject, opacity)) return;

  // Older cubing.js builds lack the direct getter; fall back to the vantage scene.
  const vantage = player?.experimentalCurrentVantage
    ? await player.experimentalCurrentVantage()
    : await player?.experimentalGet?.vantage?.();
  const scene = await vantage?.scene?.scene?.();
  if (!scene || !isCurrent()) return;

  scene.traverse((obj: THREE.Object3D) => {
    applyTwistyPuzzleCoreOpacity(obj, opacity);
  });
}
