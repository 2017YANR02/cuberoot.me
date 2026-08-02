/**
 * Shared scene-orbit helpers for /sim drag handlers. Every puzzle's "drag empty
 * space / miss the cube → rotate the whole view" fallback applies the same screen-
 * delta-to-scene-rotation math; centralizing it keeps the per-puzzle pointer code to
 * its own pick/resolve logic. NxN feeds its Controller's `onOrbit` in here too — its
 * 「自动转体」档 = `orbitSceneAutoRotate` (fold the view's excess into real
 * whole-puzzle turns); see SimPage onOrbit and the solver's 3D painters.
 */
import type World from './world';
import type { PuzzleKind } from './world';

/**
 * 引擎自己的初始视角(U 上 F 前 R 右)—— `World` 构造函数就摆这个姿势,任何「重置视角」
 * 按钮都该回到它。**单一源**:以前 world.ts 摆一份、二阶画板与预判板各硬抄一份 π/6 与
 * −π/4+π/16,改一处就漂。
 */
export const HOME_SCENE_ROT = { x: Math.PI / 6, y: -Math.PI / 4 + Math.PI / 16, z: 0 } as const;

/**
 * 正对一面的视角:左右 0° / 上下 0°,只看得见 F 面(= /sim 的 `?img_r=y0x0`)。
 *
 * 校准用的姿态。等轴视角同时露三个面,好看,但「魔方现在朝哪儿」得靠三个面的相对位置去
 * 脑补;正对一面时只要绿面不正、不满、不方,一眼就是歪的,把实体魔方摆正再按校准即可。
 */
export const FRONT_SCENE_ROT = { x: 0, y: 0, z: 0 } as const;

/**
 * 这个拼图的开局姿态。默认就是 `HOME_SCENE_ROT`,只有正十二面体要动偏航。
 *
 * 立方体系每 90° 对上一面,`HOME_SCENE_ROT` 的 −33.75° 是「主面朝我、右面露一条」的
 * 经典四分之三视角;五魔方绕竖轴 72° 才对上一面,同样的 −33.75° 正好卡在两面中间 ——
 * 开局看到的是一条棱,12 个面没有一个正对镜头。/sim 的 `defaultViewFor` 对五魔方也是
 * 把左右钉在 0°(正对一面),这里是同一条规矩的引擎侧单一源。
 */
export function homeSceneRot(kind: PuzzleKind): { x: number; y: number; z: number } {
  const { x, y, z } = HOME_SCENE_ROT;
  return { x, y: kind === 'megaminx' ? 0 : y, z };
}

/** /sim 默认灵敏度那一档的 orbit 系数(= 设置里 50 的 `mapOrbitK(50)`)。嵌入页不给
 *  灵敏度设置,一律钉这个值,别再各写一份 0.01。 */
export const ORBIT_K = 0.01;

/** 视角复位到这个拼图的开局姿态(`homeSceneRot`)。 */
export function resetSceneView(world: World): void {
  const home = homeSceneRot(world.puzzleKind);
  world.scene.rotation.set(home.x, home.y, home.z);
  world.scene.updateMatrix();
  world.dirty = true;
}

/** 俯仰钳位:视角永远正着看(±90° 就是正俯视 / 正仰视,两极的面照样点得到)。 */
function clampPitch(world: World): void {
  world.scene.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, world.scene.rotation.x));
}

/** Orbit the scene by a screen drag delta (dx, dy in px, scaled by `k`). Pitch (x) is
 *  clamped to ±90° so the cube never flips past vertical; yaw (y) is unbounded. Marks
 *  the world dirty so the next frame re-renders. */
export function orbitScene(world: World, dx: number, dy: number, k: number): void {
  world.scene.rotation.y += dx * k;
  world.scene.rotation.x += dy * k;
  clampPitch(world);
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
 * 「自动转体」折进拼图本体的那一步。
 *
 * `quantum` = 每积累多少视角折一次,必须是该拼图**真有**的整体转体角:立方体系(NxN /
 * 斜转)绕竖直轴 90°,正四面体绕顶点轴 120°(金字塔的 `y` = Uv)。给错角度折完拼图就歪
 * 在一个它本来到不了的姿态上。
 * `commit(positive)` 把它落到引擎:绕该轴的**世界正方向**转 `+quantum`(positive)或
 * `−quantum`。方向别猜 —— 折叠总是把视角往回退 `quantum`,补的本体转动就得是 `+quantum`。
 */
export interface BodyTurn {
  quantum: number;
  commit: (positive: boolean) => void;
}

/**
 * 自动转体折哪几根轴。偏航(`y`)恒折;俯仰(`x`)可选,给了就不钳俯仰。
 *
 * **偏航折得精确,俯仰折不精确。** 视角矩阵是 `Rx(pitch)·Ry(yaw)`:折偏航要补的本体转动
 * 正好绕 `Ry` 那根轴、与它可交换 → 复合姿态一丝不差;折俯仰要补的却是绕 `Ry(−yaw)·x̂` 的
 * 转动,只有 yaw 落在象限上时才等于世界 `x̂`,否则画面会跳一下(实测垂直拖过 90° 那一帧的
 * 像素差是邻帧的 3.6 倍)。所以纯视觉的画板只折偏航、俯仰钳住;`x` 档只留给 /sim ——
 * 它那档要把俯仰也**记成一步 x**,宁可跳也不能不记。
 */
export interface ViewTurns {
  y: BodyTurn;
  x?: BodyTurn;
}

/**
 * 把视角里超出 ±quantum 的那部分**折成整体转体**:每折一次就回调一次 `commit`,并把
 * `scene.rotation` 相应回退,所以画面连续、视角永远在 ±quantum 内(不会倒着看),而拼图
 * 本体真的转了 —— 灯光挂在 scene 上不跟着块走,于是转起来像实物在手里翻,而不是相机绕着
 * 飞。`safety` 是防御:一次拖动每轴最多折 8 次。
 */
export function foldViewIntoTurns(world: World, turns: ViewTurns): void {
  for (const axis of ['y', 'x'] as const) {
    const turn = turns[axis];
    if (!turn) continue;
    let safety = 8;
    while (world.scene.rotation[axis] > turn.quantum && safety-- > 0) {
      turn.commit(true);
      world.scene.rotation[axis] -= turn.quantum;
    }
    safety = 8;
    while (world.scene.rotation[axis] < -turn.quantum && safety-- > 0) {
      turn.commit(false);
      world.scene.rotation[axis] += turn.quantum;
    }
  }
  world.scene.updateMatrix();
  world.dirty = true;
}

/**
 * 「自动转体」= orbit + `foldViewIntoTurns`:/sim 设置里 `dragEmpty='orbit'` 的那档,
 * 也是求解器立体画板的拖拽档。没给 `turns.x` 就钳住俯仰(见 `ViewTurns`)。整体转体吃不下
 * 的拼图(SQ1 引擎没有这一步)用 `orbitScene` —— /sim 对它本来也就是那条路径。
 */
export function orbitSceneAutoRotate(
  world: World,
  dx: number,
  dy: number,
  k: number,
  turns: ViewTurns,
): void {
  world.scene.rotation.y += dx * k * yawSign(world.scene.rotation.x);
  world.scene.rotation.x += dy * k;
  if (!turns.x) clampPitch(world);
  foldViewIntoTurns(world, turns);
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
