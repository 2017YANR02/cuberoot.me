/**
 * Shared scene-orbit helpers for /sim drag handlers. Every puzzle's "drag empty
 * space / miss the cube → rotate the whole view" fallback applies the same screen-
 * delta-to-scene-rotation math; centralizing it keeps the per-puzzle pointer code to
 * its own pick/resolve logic. NxN feeds its Controller's `onOrbit` in here too — its
 * 「自动转体」档 = `orbitSceneAutoRotate` (fold the view's ±90° excess into real
 * whole-cube y/x twists); see SimPage onOrbit and the solver's 3D painter.
 */
import type World from './world';

/**
 * 引擎自己的初始视角(U 上 F 前 R 右)—— `World` 构造函数就摆这个姿势,任何「重置视角」
 * 按钮都该回到它。**单一源**:以前 world.ts 摆一份、二阶画板与预判板各硬抄一份 π/6 与
 * −π/4+π/16,改一处就漂。
 */
export const HOME_SCENE_ROT = { x: Math.PI / 6, y: -Math.PI / 4 + Math.PI / 16, z: 0 } as const;

/** /sim 默认灵敏度那一档的 orbit 系数(= 设置里 50 的 `mapOrbitK(50)`)。嵌入页不给
 *  灵敏度设置,一律钉这个值,别再各写一份 0.01。 */
export const ORBIT_K = 0.01;

/** 视角复位到 `HOME_SCENE_ROT`。 */
export function resetSceneView(world: World): void {
  world.scene.rotation.set(HOME_SCENE_ROT.x, HOME_SCENE_ROT.y, HOME_SCENE_ROT.z);
  world.scene.updateMatrix();
  world.dirty = true;
}

/** Orbit the scene by a screen drag delta (dx, dy in px, scaled by `k`). Pitch (x) is
 *  clamped to ±90° so the cube never flips past vertical; yaw (y) is unbounded. Marks
 *  the world dirty so the next frame re-renders. */
export function orbitScene(world: World, dx: number, dy: number, k: number): void {
  world.scene.rotation.y += dx * k;
  world.scene.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, world.scene.rotation.x + dy * k));
  world.scene.updateMatrix();
  world.dirty = true;
}

/**
 * 无界 orbit:两轴都一直累加,可以翻过顶/底继续转(涂色板要的 —— 钳在 ±90° 就看不到
 * D 面外沿、点不到背面的贴纸)。`yawSign` 抵消上下颠倒那半圈的左右反向。
 * 需要「永远正着看」的场合(看图播放器 / drag-empty 转视角)用上面的 `orbitScene`。
 */
export function orbitSceneFree(world: World, dx: number, dy: number, k: number): void {
  world.scene.rotation.y += dx * k * yawSign(world.scene.rotation.x);
  world.scene.rotation.x += dy * k;
  world.scene.updateMatrix();
  world.dirty = true;
}

/**
 * 把视角里超出 ±90° 的那部分**折成整体转体**:每折一个 90° 就回调一次 `commit`,并把
 * `scene.rotation` 相应回退,所以画面连续、视角永远在 ±90° 内(不会倒着看),而拼图本体
 * 真的转了 —— 灯光挂在 scene 上不跟着块走,于是转起来像实物在手里翻,而不是相机绕着飞。
 *
 * `commit(axis, reverse)` 由调用方落成引擎的整体转体(NxN = `TwistAction('y'|'x', reverse)`,
 * 瞬时 + force)。`safety` 是防御:一次拖动最多折 8 个 90°。
 */
export function foldViewIntoTwists(
  world: World,
  commit: (axis: 'x' | 'y', reverse: boolean) => void,
  axes: readonly ('x' | 'y')[] = ['y', 'x'],
): void {
  const Q = Math.PI / 2;
  for (const axis of axes) {
    let safety = 8;
    while (world.scene.rotation[axis] > Q && safety-- > 0) {
      commit(axis, true);
      world.scene.rotation[axis] -= Q;
    }
    safety = 8;
    while (world.scene.rotation[axis] < -Q && safety-- > 0) {
      commit(axis, false);
      world.scene.rotation[axis] += Q;
    }
  }
  world.scene.updateMatrix();
  world.dirty = true;
}

/**
 * 「自动转体」= orbit + `foldViewIntoTwists`:/sim 设置里 `dragEmpty='orbit'` 的那档,
 * 也是求解器立体画板的拖拽档。整体转体吃不下的拼图(角转 / 棱转 / SQ1 引擎没有整体转体
 * 这一步)用 `orbitScene` —— /sim 对它们本来也就是那条路径。
 */
export function orbitSceneAutoRotate(
  world: World,
  dx: number,
  dy: number,
  k: number,
  commit: (axis: 'x' | 'y', reverse: boolean) => void,
): void {
  world.scene.rotation.y += dx * k * yawSign(world.scene.rotation.x);
  world.scene.rotation.x += dy * k;
  foldViewIntoTwists(world, commit);
}

/** Sign to apply to a horizontal drag delta before it lands in `scene.rotation.y`.
 *
 *  `scene.rotation` is an 'XYZ' euler with z=0, i.e. M = Rx(pitch)·Ry(yaw): yaw spins
 *  about the cube's OWN up-axis, which Rx then tilts. Once pitch passes ±90° that axis
 *  points down in world space, so the same dx reads as the opposite direction on screen
 *  ("D 面朝上时左右拖反了"). cos(pitch) < 0 is exactly the upside-down half — negate there.
 *  Modes that keep pitch inside ±90° (orbitScene's clamp, NxN's commit-at-90° orbit/rotate)
 *  always get +1, so this is a no-op for them. */
export function yawSign(pitch: number): number {
  return Math.cos(pitch) < 0 ? -1 : 1;
}

/** Snap the scene orientation to the nearest 90° about each axis — the release behavior
 *  for the "drag empty space = rotate" setting, so the cube settles to an axis-aligned
 *  pose instead of a tilted one. */
export function snapViewToQuadrant(world: World): void {
  const q = Math.PI / 2;
  world.scene.rotation.y = Math.round(world.scene.rotation.y / q) * q;
  world.scene.rotation.x = Math.round(world.scene.rotation.x / q) * q;
  world.scene.updateMatrix();
  world.dirty = true;
}
