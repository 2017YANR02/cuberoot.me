/**
 * attachOrbitTap —— 嵌入式 3D 画布的那套指针手势,只有一份。
 *
 * 每个 /sim 嵌入点都要写同一段:pointerdown 记起点 → 超过阈值才算拖(否则是点一下)
 * → 拖就转视角 → pointerup 收尾,外加 `setPointerCapture` 的 try/catch、
 * `contextmenu` 拦截、四个 `removeEventListener`。抽走前这段在
 * `_Interactive3DPuzzle` / `_InteractiveSq1Board` / `recon/ReconPlayerBase`
 * 各写了一遍(~45 行 ×3),`ORBIT_K = 0.01` 更是全站五份。
 *
 * 拖动默认 `orbitScene`(pitch 钳 ±90°,永远正着看)。`freeOrbit` 走无界视角;给了
 * `autoRotate` 就升级成 /sim 的
 * 「自动转体」:偏航每积累一个量子就折成拼图**真正的整体转体**(金字塔绕顶点轴 120°、
 * 斜转绕竖直轴 90°),灯挂在 scene 上不跟着转,于是是拼图在手里翻而不是相机绕着飞。
 * 引擎没有整体转体这一步的拼图(SQ1)不给 `autoRotate`,落回 `orbitScene`。NxN 的自动转体
 * 不在这儿,它走 controller 的 `onOrbit` → 同一个 `orbitSceneAutoRotate`。
 *
 * 拼图本身要吃掉这次拖动(SQ1 拖层转、金字塔拖着转角)就实现 `onDragBegin`:返回
 * `true` = 我接管,手势不再 orbit,后续 move/up 走 `onDragMove` / `onDragEnd`。
 */
import {
  orbitScene, orbitSceneAutoRotate, orbitSceneFree, ORBIT_K, type ViewTurns,
} from '@/app/[lang]/sim/engine/viewControls';
import type World from '@/app/[lang]/sim/engine/world';

export interface OrbitTapOptions {
  world: World;
  /** 装事件的元素,一般是 `mount.renderer.domElement`。 */
  canvas: HTMLElement;
  /** orbit 系数,默认 `ORBIT_K`(/sim 灵敏度 50 那一档)。 */
  k?: number;
  /** 给了就走「自动转体」:偏航折成引擎真正的整体转体(俯仰仍钳 ±90°)。不给 = 纯视角。 */
  autoRotate?: ViewTurns;
  /** 无界纯视角:俯仰越过顶/底后继续累加。优先级高于 `autoRotate`。 */
  freeOrbit?: boolean;
  /** 起手阈值(px):小于它算「点一下」。默认 6,与 /sim 同值。 */
  threshold?: number;
  /**
   * 点一下(没拖动)。坐标是画布局部坐标;`button` 是 pointerdown 时的键
   * (0 左键 / 2 右键 —— 右键一般当「擦除」)。
   */
  onTap?: (localX: number, localY: number, button: number) => void;
  /**
   * 刚过阈值:返回 true = 这次拖动我接管(转层等),手势不 orbit;返回 false / 不实现
   * = 交给 orbit。`dx/dy` 是相对起点的位移。
   */
  onDragBegin?: (localX: number, localY: number, dx: number, dy: number) => boolean;
  /** 接管期间的每次移动(只在 `onDragBegin` 返回 true 后触发)。 */
  onDragMove?: (localX: number, localY: number) => void;
  /** 接管期间松手。 */
  onDragEnd?: () => void;
  /** 拦 `contextmenu`(右键涂色/擦除的页面要)。默认 true。 */
  preventContextMenu?: boolean;
}

/** 装上手势,返回卸载函数(卸干净所有监听)。 */
export function attachOrbitTap(opts: OrbitTapOptions): () => void {
  const {
    world, canvas, k = ORBIT_K, threshold = 6, autoRotate, freeOrbit = false,
    onTap, onDragBegin, onDragMove, onDragEnd, preventContextMenu = true,
  } = opts;

  let down = false;
  let moved = false;
  /** 拼图接管了这次拖动(onDragBegin 返回 true)。 */
  let captured = false;
  let button = 0;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;

  const local = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const onDown = (e: PointerEvent): void => {
    [downX, downY] = local(e);
    lastX = e.clientX;
    lastY = e.clientY;
    down = true;
    moved = false;
    captured = false;
    button = e.button;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 捕获不到就算了 */ }
  };

  const onMove = (e: PointerEvent): void => {
    if (!down) return;
    const [lx, ly] = local(e);
    if (captured) { onDragMove?.(lx, ly); return; }
    if (!moved) {
      const dx = lx - downX;
      const dy = ly - downY;
      if (Math.hypot(dx, dy) < threshold) return;
      moved = true;
      if (onDragBegin?.(downX, downY, dx, dy)) {
        captured = true;
        onDragMove?.(lx, ly);
        return;
      }
    }
    const [ox, oy] = [e.clientX - lastX, e.clientY - lastY];
    if (freeOrbit) orbitSceneFree(world, ox, oy, k);
    else if (autoRotate) orbitSceneAutoRotate(world, ox, oy, k, autoRotate);
    else orbitScene(world, ox, oy, k);
    lastX = e.clientX;
    lastY = e.clientY;
  };

  const onUp = (e: PointerEvent): void => {
    if (captured) onDragEnd?.();
    else if (down && !moved) onTap?.(downX, downY, button);
    down = false;
    moved = false;
    captured = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* 同上 */ }
  };

  const onContextMenu = (e: MouseEvent): void => e.preventDefault();

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove, { passive: false });
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  if (preventContextMenu) canvas.addEventListener('contextmenu', onContextMenu);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    if (preventContextMenu) canvas.removeEventListener('contextmenu', onContextMenu);
  };
}
