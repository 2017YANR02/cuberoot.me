'use client';

/**
 * /predict 的题板 —— 一个可自由旋转、逐贴纸可点的 3D 魔方。
 *
 * 复用 /sim 的 WebGL 引擎(mountSimWorld + paintMode),不另造渲染器:
 *   - `paintMode` + `dragEmpty='view'`:任何拖拽都只转视角,绝不拧层;单击照旧派
 *     `taps`,于是「点某枚贴纸」就有了。答案可能落在背面,所以视角必须能转到底
 *     (两轴无界累加,不钳 pitch),再给一个复位按钮。
 *   - 起始视角恒为 `HOME_SCENE_ROT`(= /sim 打开时那个 U 上 F 前 R 右)。以前是「按题目
 *     所在的面自动挑一个角度」,结果每出一题朝向都不一样,连自己在看哪一面都得先认;
 *     现在朝向钉死,背面靠提示贴片读(下条),要转自己拖。
 *   - 方位字母常驻(`faceHints: true`,= /sim 设置里「字母」开着的状态,本页不给开关):
 *     题面大半格子是压暗的,只靠颜色认方位不够,U/D/L/R/F/B 得一直看得见。引擎里
 *     `show()` 只设目标透明度、`tick` 每帧淡入,没人 `hide()` 就一直亮着。
 *   - 提示贴片常驻(`instancedRenderer.hint`,= /sim 设置里「提示贴片」开着的状态,本页
 *     同样不给开关):背对镜头那三面的贴纸会在方块外侧浮一层影子,所以朝向钉死也读得到
 *     背面。影子色走同一套阶段遮罩(`computeHintColor` 内部就是 `resolveStickerColor`),
 *     于是灰掉的格子影子也是灰的 —— 只有目标那枚的影子亮着。
 *   - 颜色逐贴纸给:`labels[i]` 是 facelet i 的引擎色标签(整盘真实颜色)。
 *   - 「只亮该找的那一枚」不靠改色,靠 /sim 那套阶段遮罩:`setStickering` 把 `bright`
 *     留满色、`dim` 压半、其余压成 FM_IGNORED 灰;遮罩定义在还原帧上 → 复盘转动时
 *     这三档自己跟着块走。
 *   - 复盘动画不另算盘面:题板一律「起点上色 + 真转招式」,让引擎自己把贴纸转过去
 *     (`twister.push` 逐步动画 / `setup` 瞬时跳转)。`cube.stick` 按**原始位置**寻址,
 *     所以每次改色必须先 `setup('')` 复位几何,再按当前步重放回去。
 *
 * three + 引擎走动态 import,不进首包(和 /scramble/solver 的立体画板同一条路)。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
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
import { FM_OUTLINE, FM_DIM, FM_IGNORED } from '@/app/[lang]/sim/engine/nxn/stickering';

/** 复盘动画每 90° 的帧数(引擎默认 30,这里快一档);挂载时设,卸载时还回去。 */
const PLAY_FRAMES = 16;

const NO_MOVES: readonly string[] = [];
const NO_FACELETS: readonly number[] = [];

/** 提示贴片的底色 = 页面背景(影子按它预混,免得棋盘/深浅背景透过来);跟着主题翻。 */
function pageBackdrop(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
}

type BoardEngine = {
  mountSimWorld: (opts: {
    host: HTMLElement; interactive: boolean; perspective: number; faceHints: boolean;
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

export interface PredictBoardProps {
  /** 54 个引擎色标签,facelet(URFDLB)序 —— 整盘的真实颜色,空串 = 用块自己的色。 */
  labels: readonly string[];
  /** 满色的 facelet:题面点名的那枚贴纸(+ 已答对的落点记号)。空 = 整盘原色不加遮罩。 */
  bright?: readonly number[];
  /** 压暗(各自颜色减半)的 facelet:目标块剩下的那几枚 —— 看得出是同一块,又不抢那枚。 */
  dim?: readonly number[];
  onSticker: (faceletIndex: number) => void;
  /** 变一次就把视角复位回 `HOME_SCENE_ROT`(页面上的「恢复默认」按的就是它)。 */
  viewResetNonce?: number;
  /** 复盘用的题面招式。 */
  moves?: readonly string[];
  /** 已经走到第几步:比上一次多 1 = 放一步动画,其余情况瞬时跳过去。 */
  step?: number;
}

export default function PredictBoard({
  labels, bright = NO_FACELETS, dim = NO_FACELETS, onSticker,
  viewResetNonce = 0, moves = NO_MOVES, step = 0,
}: PredictBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<SimMount | null>(null);
  const toucherRef = useRef<Toucher | null>(null);
  const [ready, setReady] = useState(false);
  const [showBusy, setShowBusy] = useState(false);

  const faceletMap = useMemo(() => buildFaceletMap(3), []);
  const reverseMap = useMemo(() => buildReverseFaceletMap(faceletMap), [faceletMap]);

  // taps 从引擎闭包里回调,拿 ref 读最新的 onSticker。
  const onStickerRef = useRef(onSticker);
  useEffect(() => { onStickerRef.current = onSticker; }, [onSticker]);

  /** 上一次同步到引擎的 (labels, step),用来判断这次是「走了一步」还是「整个换了」。 */
  const lastSyncRef = useRef<{ labels: readonly string[]; step: number } | null>(null);

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
      // faceHints:方位字母强制常驻(本页不给 toggle)。字母浮在 2.6×SIZE 处,取景半径
      // 是 3×SIZE,不会顶出画框。
      const mount = mountSimWorld({ host, interactive: true, perspective: 5.6, faceHints: true });
      mountRef.current = mount;
      const world: World = mount.world;

      const toucher = new TouchClass();
      toucher.init(mount.renderer.domElement, world.controller.touch);
      toucherRef.current = toucher;

      world.controller.dragEmpty = 'view';
      world.controller.paintMode = true;
      // 无界 orbit(两轴一直累加,含 yawSign 修正)—— 钳了 pitch 就翻不过顶/底,
      // 背面的答案就点不到。题板故意**不**走求解器画板那档「自动转体」:那档会把视角
      // 折成真的整体转体,而这里整盘题面(labels/stickering)是按 home 面序喂进来的。
      world.controller.onOrbit = (dx, dy) => orbitSceneFree(world, dx, dy, ORBIT_K);
      world.controller.taps.push((index, face) => {
        if (index < 0 || face === null) return;
        const fi = reverseMap.get(`${index}_${face}`);
        if (fi !== undefined) onStickerRef.current(fi);
      });

      // 提示贴片强制常驻(本页不给 toggle):朝向钉死在 home,背对镜头那三面只能靠它读。
      // 影子色 = 贴纸色与页面背景预混,所以主题一翻要重新注入一次底色。
      const cube = world.cube as Cube;
      cube.instancedRenderer.setHintBackdrop(pageBackdrop());
      cube.instancedRenderer.hint = true;
      const syncBackdrop = () => {
        cube.instancedRenderer.setHintBackdrop(pageBackdrop());
        mount.invalidate();
      };
      const themeObserver = new MutationObserver(syncBackdrop);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      darkQuery.addEventListener('change', syncBackdrop);

      const onContextMenu = (e: MouseEvent) => e.preventDefault();
      mount.renderer.domElement.addEventListener('contextmenu', onContextMenu);

      // 转速是引擎的模块级全局(/sim 的约定是用完还回去)。
      const prevFrames = timing.frames;
      timing.frames = PLAY_FRAMES;

      setReady(true); // 触发下面的贴纸同步 effect

      cleanup = () => {
        timing.frames = prevFrames;
        themeObserver.disconnect();
        darkQuery.removeEventListener('change', syncBackdrop);
        mount.renderer.domElement.removeEventListener('contextmenu', onContextMenu);
        toucher.destroy();
        mount.dispose();
        mountRef.current = null;
        toucherRef.current = null;
      };
      if (cancelled) cleanup();
    })();

    return () => { cancelled = true; cleanup?.(); };
  }, [reverseMap]);

  /**
   * 颜色 + 复盘进度只能有一个同步口。
   *
   * 分成两个 effect 试过,结果是同一步被走了两遍(改色那边要「按当前步重放」把位置
   * 补回来,走步那边又推了同一招,`F2` 的题转完回到原地、`R'` 变成 `R2`)。所以合成
   * 一个:只有「labels 没变 + 步数正好 +1」才放动画,其余一律整盘重来一次。
   */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready) return;
    const cube = mount.world.cube as Cube;
    const last = lastSyncRef.current;
    lastSyncRef.current = { labels, step };

    if (last && last.labels === labels && step === last.step + 1 && step > 0) {
      cube.twister.push(moves[step - 1]); // push 自己排队,不会因为还在转而丢招
    } else {
      // stick 按原始位置寻址,转过之后再上色会贴到别的块上 —— 先复位再上色。
      cube.twister.setup('');
      for (let i = 0; i < faceletMap.length; i++) {
        cube.stick(faceletMap[i].cube, faceletMap[i].face, labels[i] ?? '');
      }
      const done = moves.slice(0, step).join(' ');
      if (done) cube.twister.setup(done);
    }
    mount.invalidate();
  }, [labels, step, moves, ready, faceletMap]);

  /**
   * 只亮目标块 = /sim 的阶段遮罩(`setStickering`),不是另一套改色:遮罩键在还原帧的
   * 贴纸上,复盘转动时高亮自己跟着块跑;上色那条路(`stick`)照旧给整盘真实颜色,
   * 两者正交,所以这个 effect 不碰几何、也不会吃掉动画。
   *
   * 三档,不是两档:
   *   `FM_OUTLINE`(满色 + 描边)= 题面点名的那一枚。光靠满色在灰底上还不够跳 ——
   *     描边给它一圈高亮框,而颜色留着不动(这块板子问的就是「那枚什么色的贴纸」,
   *     换色的记号法在这里等于把题干抹了);
   *   `FM_DIM`(自己的颜色减半)= 目标块剩下的贴纸 + 六个中心 —— 前者得看得出这几枚
   *     是同一块,后者是方位参照(压暗才不跟目标抢);
   *   `FM_IGNORED`(整片 #666 灰)= 其余 40 来格,和上游那版一样是灰底。
   */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready) return;
    const cube = mount.world.cube as Cube;
    // /sim 把压暗的白钉在 #dddddd(免得跟 ignored 灰撞),可那跟满色白根本分不出 ——
    // 这块板子上白中心、白目标可能同时在场,压暗的白得一眼是暗的。
    cube.instancedRenderer.dimWhite = '#aaaaaa';
    const sid = (f: number) => engineHomeSid(faceletMap[f].cube, faceletMap[f].face, 3);
    const full = new Set(bright.map(sid));
    const half = new Set(dim.map(sid));
    cube.instancedRenderer.setStickering(
      full.size === 0 && half.size === 0 ? null : (initial, face) => {
        const s = engineHomeSid(initial, face, 3);
        return full.has(s) ? FM_OUTLINE : half.has(s) ? FM_DIM : FM_IGNORED;
      },
    );
    mount.invalidate();
  }, [bright, dim, ready, faceletMap]);

  /** 复位 = 回到 /sim 打开时那个姿势(U 上 F 前 R 右),`HOME_SCENE_ROT` 单一源。 */
  const resetView = () => {
    const world = mountRef.current?.world;
    if (world) resetSceneView(world);
  };

  // 页面上的「恢复默认」也复位视角(拖歪了不用再去找题板角上那颗按钮)。
  useEffect(() => {
    if (!ready || viewResetNonce === 0) return;
    resetView();
    // resetView 只读 ref,不进依赖;nonce 变一次复位一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, viewResetNonce]);

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
