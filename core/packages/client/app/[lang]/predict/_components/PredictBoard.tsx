'use client';

/**
 * /predict 的题板 —— 一个可自由旋转、逐贴纸可点的 3D 拼图。
 *
 * 复用 /sim 的 WebGL 引擎(mountSimWorld),不另造渲染器。所有拼图共用同一套口径:
 *   - 起始视角恒为 `homeSceneRot(拼图)`(= /sim 打开时那个姿势)。以前是「按题目所在的面
 *     自动挑一个角度」,结果每出一题朝向都不一样,连自己在看哪一面都得先认;现在朝向
 *     钉死,要转自己拖,另给一个复位按钮。
 *   - 颜色逐贴纸给:`labels[i]` 是**本位第 i 格**的颜色(整盘真实颜色)。题板一律
 *     「还原态上色 + 真转公式」,让引擎自己把贴纸转过去(`twister.push` 逐步动画 /
 *     `setup` 瞬时跳转),复盘不另算盘面。
 *   - 「只亮该找的那一枚」是三档:满色 = 题面点名的那枚,压暗(自己的颜色减半)=
 *     同块的其余贴纸 + 方位锚,其余一律 `#666` 灰。灰色档跟 /sim 的阶段遮罩同一个色值。
 *
 * 两条渲染路径,因为引擎的两族拼图根本不是一种画法:
 *   · **NxN**(二 ~ 七阶)—— 贴纸是 InstancedMesh,没有逐张 mesh。走 /sim 自己那套:
 *     `cube.stick` 上色 + `setStickering` 三档遮罩(遮罩键在还原帧的贴纸上,复盘转动时
 *     高亮自己跟着块跑),外加方位字母 + 提示贴片(背对镜头那三面的贴纸会在方块外侧浮
 *     一层影子;透明模式会关掉这层影子,改为直接透过 0% 块身读背面)。
 *   · **五魔方 / 金字塔 / 斜转 / 枫叶** —— 每张贴纸是独立 mesh,那就直接改它自己的材质色(引擎的
 *     stickerMat 按颜色缓存 + 共享,所以必须逐张 clone 一份,否则改一张串一片)。颜色挂在
 *     mesh 上,天然跟着块走,和 NxN 那套遮罩是同一个语义。这几个拼图没有提示贴片,背面
 *     要拖过去看;方位提示改用浮在外侧的字母 —— 金字塔是四个顶点(U/L/R/B,正好是它的
 *     转动记号),五魔方是十二个面名(题面那套,不是引擎的 PG 名,见 `puzzle.hints`)。
 *
 * three + 引擎走动态 import,不进首包(和 /scramble/solver 的立体画板同一条路)。
 * 换拼图时页面用 `key` 整块重挂,所以这里不必处理「挂载中途换拼图」。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type * as THREE from 'three';
import type World from '@/app/[lang]/sim/engine/world';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import type Toucher from '@/app/[lang]/sim/Toucher';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import { buildFaceletMap, buildReverseFaceletMap } from '@/components/sim-embed/faceletMap';
import { ORBIT_K, orbitSceneFree, resetSceneView } from '@/app/[lang]/sim/engine/viewControls';
import { afterFirstPaint } from '@/components/sim-embed/SimStage';
import { timing } from '@/app/[lang]/sim/engine/tweenTiming';
import { Spinner } from '@/components/Spinner/Spinner';
import { tr } from '@/i18n/tr';
import { engineHomeSid } from '@/app/[lang]/sim/engine/nxn/netIndex';
import { applyPuzzleTransparency } from '@/app/[lang]/sim/engine/coreOpacity';
import { FM_OUTLINE, FM_DIM, FM_IGNORED, FM_FIXED_COLOR, dimFaceletColor } from '@/app/[lang]/sim/engine/nxn/stickering';
import { PREDICT_FILL, type PredictColor } from '../_lib/colors';
import type { PredictPuzzle } from '../_lib/puzzles';

/** 复盘动画每 90° 的帧数(引擎默认 30,这里快一档);挂载时设,卸载时还回去。 */
const PLAY_FRAMES = 16;

const NO_MOVES: readonly string[] = [];
const NO_FACELETS: readonly number[] = [];

/** /sim 把压暗的白钉在 #dddddd(免得跟 ignored 灰撞),可那跟满色白根本分不出 ——
 *  这块板子上白中心、白目标可能同时在场,压暗的白得一眼是暗的。 */
const DIM_WHITE = '#aaaaaa';
const IGNORED_GREY = FM_FIXED_COLOR[FM_IGNORED] ?? '#666666';

/** 提示贴片的底色 = 页面背景(影子按它预混,免得棋盘/深浅背景透过来);跟着主题翻。 */
function pageBackdrop(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
}

/** 一格三档遮罩下画出来的颜色(非 NxN 路径自己算,NxN 交给引擎的遮罩层)。 */
function shadedColor(label: string, tier: 'bright' | 'dim' | 'ignored'): string {
  if (tier === 'ignored') return IGNORED_GREY;
  const base = PREDICT_FILL[label as PredictColor] ?? IGNORED_GREY;
  if (tier === 'bright') return base;
  return base.toLowerCase() === '#ffffff' ? DIM_WHITE : dimFaceletColor(base);
}

type BoardEngine = {
  mountSimWorld: (opts: {
    host: HTMLElement; puzzle?: World['puzzleKind']; interactive: boolean; perspective: number;
    faceHints: boolean; onFrame?: (world: World, dt: number) => boolean;
  }) => SimMount;
  Toucher: typeof Toucher;
};

let enginePromise: Promise<BoardEngine> | null = null;

export function preloadBoardEngine(): Promise<BoardEngine> {
  enginePromise ??= (async () => {
    const [mount, toucher] = await Promise.all([
      import('@/components/sim-embed/mountSimWorld'),
      import('@/app/[lang]/sim/Toucher'),
    ]);
    return { mountSimWorld: mount.mountSimWorld, Toucher: toucher.default };
  })();
  return enginePromise;
}

/** 上色 + 遮罩这两件事,两条渲染路径各自实现;其余(复盘、视角、手势)是共用的。 */
interface Painter {
  /** 整盘上色。`labels[i]` = 本位第 i 格的颜色字母。 */
  colors(labels: readonly string[]): void;
  /** 三档遮罩。入参是**本位格号**,和 labels 同一个空间。 */
  tiers(bright: readonly number[], dim: readonly number[]): void;
}

export interface PredictBoardProps {
  puzzle: PredictPuzzle;
  /** 每一格的颜色字母(本位格序)—— 整盘真实颜色,空串 = 用块自己的色。 */
  labels: readonly string[];
  /** 满色的格:题面点名的那枚贴纸(+ 已答对的落点记号)。空 = 整盘原色不加遮罩。 */
  bright?: readonly number[];
  /** 压暗(各自颜色减半)的格:同块的其余贴纸 + 方位锚。 */
  dim?: readonly number[];
  onSticker: (slot: number) => void;
  /** 复盘用的题面公式。 */
  moves?: readonly string[];
  /** 已经走到第几步:比上一次多 1 = 放一步动画,其余情况瞬时跳过去。 */
  step?: number;
  /** true = 内核 0% 且关闭提示贴片;false = 内核 100% 且恢复提示贴片。 */
  transparent?: boolean;
  /** 每次成功出新题递增,让题板回到默认视角。 */
  viewResetSeq?: number;
}

export default function PredictBoard({
  puzzle, labels, bright = NO_FACELETS, dim = NO_FACELETS, onSticker,
  moves = NO_MOVES, step = 0, transparent = true, viewResetSeq = 0,
}: PredictBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<SimMount | null>(null);
  const painterRef = useRef<Painter | null>(null);
  const [ready, setReady] = useState(false);
  const [showBusy, setShowBusy] = useState(false);

  const order = typeof puzzle.sim === 'number' ? puzzle.sim : 0;

  // taps 从引擎闭包里回调,拿 ref 读最新的 onSticker。
  const onStickerRef = useRef(onSticker);
  useEffect(() => { onStickerRef.current = onSticker; }, [onSticker]);

  /** 上一次同步到引擎的 (labels, step),用来判断这次是「走了一步」还是「整个换了」。 */
  const lastSyncRef = useRef<{ labels: readonly string[]; step: number } | null>(null);

  /**
   * 喂引擎的那串。绝大多数拼图题面记号 = 引擎记号,这里就是原串;只有五魔方的引擎
   * 面名(PG 的 `C A I BF E`)读不出方位,题面用魔友那套,喂之前翻一次。
   * 一格一步对齐(一个题面 token → 一段引擎 token 串),所以 `step` 的口径不变。
   */
  const engineMoves = useMemo(
    () => (puzzle.engineMove ? moves.map(puzzle.engineMove) : moves),
    [puzzle, moves],
  );

  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setShowBusy(true), 250);
    return () => clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      await afterFirstPaint();
      if (cancelled) return;
      const { mountSimWorld, Toucher: TouchClass } = await preloadBoardEngine();
      if (cancelled) return;
      const host = containerRef.current;
      if (!host) return;

      // perspective 比引擎默认(5)松一档:题板是正方形,转到角对角时立方体最长,
      // 松一点才不会顶到画布边。
      // 方位字母:立方体族强制常驻(本页不给 toggle)。题面大半格子是灰的,只靠颜色
      // 认方位不够。金字塔不是六面体,它的方位提示是四个顶点字母,另行打开(见下)。
      // 方位字母的淡入要每帧 tick。立方体族那份(`world.faceHints`)mountSimWorld 自己
      // 代劳;非立方体族的是 solid painter 挂上来的(金字塔的顶点字母 / 五魔方的面名),
      // 由它往这儿塞 tick。
      const frameTicks: ((dt: number) => boolean)[] = [];
      const mount = mountSimWorld({
        host,
        puzzle: puzzle.sim,
        interactive: order > 0,
        perspective: 5.6,
        faceHints: puzzle.cubeLike,
        onFrame: (_w: World, dt: number) => {
          let dirty = false;
          for (const tick of frameTicks) if (tick(dt)) dirty = true;
          return dirty;
        },
      });
      mountRef.current = mount;
      const world: World = mount.world;
      // 题面方位字母是 HUD:可见面整枚压在最上层,背面按朝向整枚隐藏。
      // 不再交给深度缓冲逐像素切字,否则斜视时灰色块身会“啃掉” F 等字母。
      world.faceHints.setCameraOverlay(true);
      // World 的构造函数只知道立方体那个姿势(它还没被 setPuzzle 过),开局要摆的是**这个
      // 拼图**的姿态 —— 五魔方在立方体角度下是一条棱正对镜头,12 个面全是斜的。
      resetSceneView(world);

      const disposers: (() => void)[] = [];

      // Toucher 是 NxN controller 的输入口(它把指针事件翻成 controller 的 TouchAction)。
      // 别的拼图没有 controller,`controller.touch` 是 undefined —— 照装的话 Toucher 会拿
      // 一个 undefined 当回调,一点画布就 `this.callback is not a function`。那几个拼图的
      // 指针走 mountSolidPainter 里的 attachOrbitTap,这里不该再插一层。
      const touch = world.controller?.touch;
      if (touch) {
        const toucher = new TouchClass();
        toucher.init(mount.renderer.domElement, touch);
        disposers.push(() => toucher.destroy());
      }

      painterRef.current = order > 0
        ? await mountNxnPainter(world, order, mount, onStickerRef, disposers)
        : await mountSolidPainter(puzzle, world, mount, onStickerRef, disposers, frameTicks);
      applyPuzzleTransparency(world.cube, transparent);
      // NxN 的 frame 材质是模块级共享;离开题板前还原,避免同一页稍后挂的引擎
      // 在自己的设置 effect 落地前闪过透明首帧。
      disposers.push(() => applyPuzzleTransparency(world.cube, false));

      const onContextMenu = (e: MouseEvent) => e.preventDefault();
      mount.renderer.domElement.addEventListener('contextmenu', onContextMenu);

      // 转速是引擎的模块级全局(/sim 的约定是用完还回去)。
      const prevFrames = timing.frames;
      timing.frames = PLAY_FRAMES;

      setReady(true); // 触发下面的贴纸同步 effect

      cleanup = () => {
        timing.frames = prevFrames;
        for (const d of disposers) d();
        mount.renderer.domElement.removeEventListener('contextmenu', onContextMenu);
        mount.dispose();
        mountRef.current = null;
        painterRef.current = null;
      };
      if (cancelled) cleanup();
    })();

    return () => { cancelled = true; cleanup?.(); };
    // 换拼图 = 页面换 key 整块重挂,所以这里只在首挂跑一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 颜色 + 复盘进度只能有一个同步口。
   *
   * 分成两个 effect 试过,结果是同一步被走了两遍(改色那边要「按当前步重放」把位置
   * 补回来,走步那边又推了同一步,`F2` 的题转完回到原地、`R'` 变成 `R2`)。所以合成
   * 一个:只有「labels 没变 + 步数正好 +1」才放动画,其余一律整盘重来一次。
   */
  useEffect(() => {
    const mount = mountRef.current;
    const painter = painterRef.current;
    if (!mount || !painter || !ready) return;
    const twister = (mount.world.cube as { twister: { setup(a: string): void; push(a: string): void } }).twister;
    const last = lastSyncRef.current;
    lastSyncRef.current = { labels, step };

    if (last && last.labels === labels && step === last.step + 1 && step > 0) {
      twister.push(engineMoves[step - 1]); // push 自己排队,不会因为还在转而丢一步
    } else {
      // 上色按**本位**寻址,转过之后再上色会贴到别的块上 —— 先复位再上色。
      twister.setup('');
      painter.colors(labels);
      const done = engineMoves.slice(0, step).join(' ');
      if (done) twister.setup(done);
    }
    mount.invalidate();
  }, [labels, step, engineMoves, ready]);

  /** 三档遮罩不碰几何,所以答对一枚就换记号也不会吃掉复盘动画。 */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !painterRef.current || !ready) return;
    painterRef.current.tiers(bright, dim);
    mount.invalidate();
  }, [bright, dim, ready]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready) return;
    applyPuzzleTransparency(mount.world.cube, transparent);
    if (order > 0) {
      const cube = mount.world.cube as Cube;
      if (!transparent) cube.instancedRenderer.setHintBackdrop(pageBackdrop());
    }
    mount.invalidate();
  }, [transparent, ready, order]);

  /** 复位 = 回到 /sim 打开时那个姿势,`homeSceneRot` 单一源。 */
  const resetView = useCallback(() => {
    const world = mountRef.current?.world;
    if (world) {
      resetSceneView(world);
      mountRef.current?.invalidate();
    }
  }, []);

  // 出题可能早于 3D 引擎 ready;把 ready 放进依赖,冷启时也会在
  // 题板真正挂载后执行同一个复位入口。
  useEffect(() => { resetView(); }, [resetView, viewResetSeq, ready]);

  return (
    <div className="predict-board">
      <div ref={containerRef} className="predict-board-canvas" />
      {!ready && showBusy && (
        <span className="predict-board-busy">
          <Spinner size={22} label={tr({ zh: '正在加载题板', en: 'Loading the board' })} />
        </span>
      )}
      <button
        type="button"
        className="predict-board-reset"
        onClick={resetView}
        title={tr({ zh: '复位视角', en: 'Reset view' })}
        aria-label={tr({ zh: '复位视角', en: 'Reset view' })}
      >
        <RotateCcw size={15} />
      </button>
    </div>
  );
}

// ─── NxN:instanced 贴纸,走 /sim 自己的上色 + 阶段遮罩 ───────────────────

async function mountNxnPainter(
  world: World, order: number, mount: SimMount,
  onStickerRef: React.RefObject<(slot: number) => void>,
  disposers: (() => void)[],
): Promise<Painter> {
  const faceletMap = buildFaceletMap(order);
  const reverseMap = buildReverseFaceletMap(faceletMap);
  const cube = world.cube as Cube;

  world.controller.dragEmpty = 'view';
  world.controller.paintMode = true;
  // 无界 orbit(两轴一直累加,含 yawSign 修正)—— 钳了 pitch 就翻不过顶/底,
  // 背面的答案就点不到。故意**不**走求解器画板那档「自动转体」:那档会把视角折成真的
  // 整体转体,而这里整盘题面(labels / 遮罩)是按 home 面序喂进来的。
  world.controller.onOrbit = (dx, dy) => orbitSceneFree(world, dx, dy, ORBIT_K);
  world.controller.taps.push((index, face) => {
    if (index < 0 || face === null) return;
    const fi = reverseMap.get(`${index}_${face}`);
    if (fi !== undefined) onStickerRef.current(fi);
  });

  // 非透明模式用提示贴片补背面;透明模式由上层同步 effect 关掉,直接透过块身读背贴纸。
  // 影子色 = 贴纸色与页面背景预混,所以主题一翻要重新注入一次底色。
  cube.instancedRenderer.setHintBackdrop(pageBackdrop());
  cube.instancedRenderer.hint = true;
  cube.instancedRenderer.dimWhite = DIM_WHITE;
  const syncBackdrop = () => {
    cube.instancedRenderer.setHintBackdrop(pageBackdrop());
    mount.invalidate();
  };
  const themeObserver = new MutationObserver(syncBackdrop);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkQuery.addEventListener('change', syncBackdrop);
  disposers.push(() => {
    themeObserver.disconnect();
    darkQuery.removeEventListener('change', syncBackdrop);
  });

  const sid = (f: number) => engineHomeSid(faceletMap[f].cube, faceletMap[f].face, order);

  return {
    colors(labels) {
      for (let i = 0; i < faceletMap.length; i++) {
        cube.stick(faceletMap[i].cube, faceletMap[i].face, labels[i] ?? '');
      }
    },
    tiers(bright, dim) {
      // 遮罩键在还原帧的贴纸上,复盘转动时高亮自己跟着块跑;上色那条路(`stick`)照旧给
      // 整盘真实颜色,两者正交。
      const full = new Set(bright.map(sid));
      const half = new Set(dim.map(sid));
      cube.instancedRenderer.setStickering(
        full.size === 0 && half.size === 0 ? null : (initial, face) => {
          const s = engineHomeSid(initial, face, order);
          return full.has(s) ? FM_OUTLINE : half.has(s) ? FM_DIM : FM_IGNORED;
        },
      );
    },
  };
}

// ─── 五魔方 / 金字塔 / 斜转 / 枫叶:逐张贴纸 mesh,直接改材质色 ────────────

/** 贴纸正面那份材质:三个拼图各用各的(Phong / Lambert),这里只用到「有 color」。 */
type CapMaterial = THREE.Material & { color: THREE.Color };

async function mountSolidPainter(
  puzzle: PredictPuzzle, world: World, mount: SimMount,
  onStickerRef: React.RefObject<(slot: number) => void>,
  disposers: (() => void)[],
  frameTicks: ((dt: number) => boolean)[],
): Promise<Painter> {
  const [three, gesture, slotMap, outline, hintsMod, define] = await Promise.all([
    import('three'),
    import('@/components/sim-embed/orbitTapGesture'),
    import('./engineSlotMap'),
    import('./solidOutline'),
    import('@/app/[lang]/sim/engine/face_hints'),
    import('@/app/[lang]/sim/engine/define'),
  ]);

  const meshes = slotMap.collectStickerMeshes(puzzle, world.cube);
  // 引擎的 stickerMat 按颜色缓存 + 共享 → 必须逐张 clone,否则改一张串一片。
  const caps = meshes.map((mesh) => {
    const mats = mesh.material;
    const cap = (Array.isArray(mats) ? mats[0] : mats).clone() as CapMaterial;
    mesh.material = Array.isArray(mats) ? [cap, mats[1]] : cap;
    return cap;
  });
  disposers.push(() => { for (const c of caps) c.dispose(); });

  // 高亮框(= NxN 的 FM_OUTLINE)。只有真被点名的贴纸才需要,所以按需建、建完留着复用。
  const frames = new Array<ReturnType<typeof outline.attachStickerFrame>>(meshes.length).fill(null);
  const framed = (i: number): (typeof frames)[number] => {
    frames[i] ??= (() => {
      // 材质克隆自这张贴纸自己那份(同型号才和贴纸一个受光观感);dispose 归这里管。
      const mat = caps[i].clone() as CapMaterial;
      mat.color.set(outline.OUTLINE_DEFAULT);
      return outline.attachStickerFrame(meshes[i], mat);
    })();
    return frames[i];
  };
  disposers.push(() => {
    for (const f of frames) {
      if (!f) continue;
      f.patch.removeFromParent();
      f.material.dispose();
      f.geometry.dispose();
    }
  });

  // 金字塔的方位提示 = 四个顶点字母(U/L/R/B),正好就是它的转动记号,引擎自带那份直接用。
  if (puzzle.id === 'pyraminx') {
    world.pyraHints.setCameraOverlay(true);
    world.pyraHints.show();
    frameTicks.push((dt) => world.pyraHints.tick(dt, world.camera));
  }

  // 五魔方的十二个面名:引擎自带的 `world.megaHints` 写的是 PG 名(`C A I BF E`),和题面
  // 对不上,所以照同一套排版(`MEGA_HINT_LAYOUT`)另烤一份题面面名的字母贴上去。
  if (puzzle.hints) {
    const labels = new hintsMod.default(
      define.SIZE,
      puzzle.hints.map((h) => ({ letter: h.letter, dir: new three.Vector3(...h.dir) })),
      hintsMod.MEGA_HINT_LAYOUT.distanceMul,
      hintsMod.MEGA_HINT_LAYOUT.sizeMul,
    );
    world.scene.add(labels);
    labels.setCameraOverlay(true);
    labels.show();
    frameTicks.push((dt) => labels.tick(dt, world.camera));
    disposers.push(() => {
      labels.removeFromParent();
      labels.traverse((obj) => {
        const mat = (obj as THREE.Sprite).material as THREE.SpriteMaterial | undefined;
        mat?.map?.dispose();
        mat?.dispose();
      });
    });
  }

  const raycaster = new three.Raycaster();
  const pointer = new three.Vector2();
  const detach = gesture.attachOrbitTap({
    world,
    canvas: mount.renderer.domElement,
    // 不给 autoRotate:这块板子只转视角,一步都不许拧,也不许把视角折成整体转体
    //(题面 labels / 遮罩是按 home 面序喂的,折进本体姿态就对不上了)。
    onTap: (x, y) => {
      pointer.set((x / world.width) * 2 - 1, -(y / world.height) * 2 + 1);
      raycaster.setFromCamera(pointer, world.camera);
      world.scene.updateMatrixWorld();
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit) return;
      const slot = meshes.indexOf(hit.object as (typeof meshes)[number]);
      if (slot >= 0) onStickerRef.current(slot);
    },
  });
  disposers.push(detach);

  let shownLabels: readonly string[] = [];
  let full = new Set<number>();
  let half = new Set<number>();
  const repaint = (): void => {
    const plain = full.size === 0 && half.size === 0;
    for (let i = 0; i < caps.length; i++) {
      const label = shownLabels[i] ?? '';
      if (!label) continue;
      // 与 NxN 同语义:颜色照旧是贴纸自己的(玩家要读出它是什么色),只在边缘扣一圈框。
      const wanted = !plain && full.has(i);
      caps[i].color.set(shadedColor(label, plain || full.has(i)
        ? 'bright' : half.has(i) ? 'dim' : 'ignored'));
      const frame = wanted ? framed(i) : frames[i];
      if (frame) frame.patch.visible = wanted;
    }
  };

  return {
    colors(labels) { shownLabels = labels; repaint(); },
    tiers(bright, dim) { full = new Set(bright); half = new Set(dim); repaint(); },
  };
}
