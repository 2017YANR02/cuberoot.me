'use client';

/**
 * /predict 的题板 —— 一个可自由旋转、逐贴纸可点的 3D 魔方。
 *
 * 复用 /sim 的 WebGL 引擎(mountSimWorld + paintMode),不另造渲染器:
 *   - `paintMode` + `dragEmpty='view'`:任何拖拽都只转视角,绝不拧层;单击照旧派
 *     `taps`,于是「点某枚贴纸」就有了。答案可能落在背面,所以视角必须能转到底
 *     (两轴无界累加,不钳 pitch),再给一个复位按钮。
 *   - 不开 /sim 那套方位字母:这里六个中心是上了色的,颜色比字母更快读出方位,而
 *     字母浮在面正上方会正好压住贴纸。
 *   - 颜色逐贴纸给:`labels[i]` 是 facelet i 的引擎色标签('Blank' = 压暗的空格)。
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
import { yawSign } from '@/app/[lang]/sim/engine/viewControls';
import { timing } from '@/app/[lang]/sim/engine/tweenTiming';
import { Spinner } from '@/components/Spinner/Spinner';
import { tr } from '@/i18n/tr';
import { BLANK } from '../_lib/challenge';

/** 引擎自己的初始视角(U 上 F 前 R 右),复位就回这里。 */
const DEFAULT_ROT_X = Math.PI / 6;
const DEFAULT_ROT_Y = -Math.PI / 4 + Math.PI / 16;
/** 每拖 1px 转多少弧度,与 /sim 灵敏度默认值一致。 */
const ORBIT_K = 0.01;
/** 复盘动画每 90° 的帧数(引擎默认 30,这里快一档);挂载时设,卸载时还回去。 */
const PLAY_FRAMES = 16;

const NO_MOVES: readonly string[] = [];

/**
 * 「转到看得见某一面」的视角(pitch, yaw)。
 *
 * `scene.rotation` 是 z=0 的 XYZ 欧拉角,即 M = Rx(pitch)·Ry(yaw):yaw 先在方块自身
 * 坐标里转,Rx 再整体后仰。于是把某面转到镜头前只需让 Ry 把它的法向送到 +z:侧面靠
 * yaw(F=0 / R=-90° / B=180° / L=+90°),顶底靠 pitch(±90°)。都留 22.5° 余量,
 * 免得正对镜头变成一张没有立体感的平面图。
 */
const Q = Math.PI / 8;
const LOOK_AT: Record<string, readonly [number, number]> = {
  // 顶/底必须 yaw=0:正对 U/D 时 yaw 变成面内自转,给个 45° 就成了一个转 45° 的菱形,方向全乱。
  U: [Math.PI / 2 - Q, 0],
  D: [-Math.PI / 2 + Q, 0],
  F: [Q, -Q],
  B: [Q, Math.PI - Q],
  R: [Q, -Math.PI / 2 + Q],
  L: [Q, Math.PI / 2 - Q],
};

const FACE_NORMALS: Record<string, readonly [number, number, number]> = {
  U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0],
};

/** 某个面在这个姿态下有多正对镜头 —— 法向经 Rx(pitch)·Ry(yaw) 后的 z 分量,>0 = 看得见。 */
function towardCamera(face: string, pitch: number, yaw: number): number {
  const [x, y, z] = FACE_NORMALS[face];
  const zy = -x * Math.sin(yaw) + z * Math.cos(yaw); // Ry 之后的 z
  return y * Math.sin(pitch) + zy * Math.cos(pitch); // 再过 Rx
}

/**
 * 挑一个尽量把这几个面同时露出来的视角:先比露出几个,再比露出来的那些正不正对。
 *
 * 平手时比「看得见的部分之和」而不是最差的那一个 —— 目标面正好互为对面(F 与 B)时,
 * 后者会挑一个两面都只擦到边的折中角度,结果哪一面都看不清。
 */
function poseShowing(faces: readonly string[]): readonly [number, number] {
  let best: readonly [number, number] = [DEFAULT_ROT_X, DEFAULT_ROT_Y];
  if (faces.length === 0) return best;
  let bestScore = -Infinity;
  for (const pose of Object.values(LOOK_AT)) {
    const seen = faces.map((f) => towardCamera(f, pose[0], pose[1])).filter((z) => z > 0.15);
    const score = seen.length * 10 + seen.reduce((a, z) => a + z, 0);
    if (score > bestScore) { bestScore = score; best = pose; }
  }
  return best;
}

type BoardEngine = {
  mountSimWorld: (opts: { host: HTMLElement; interactive: boolean; perspective: number }) => SimMount;
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

/** 浏览器至少画过一帧后再拉引擎,免得 three 的解析卡在首屏那一帧里。 */
const afterFirstPaint = () => new Promise<void>((resolve) => {
  if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

export interface PredictBoardProps {
  /** 54 个引擎色标签,facelet(URFDLB)序;'Blank' = 压暗的空格(非目标块)。 */
  labels: readonly string[];
  onSticker: (faceletIndex: number) => void;
  /** 要露给玩家看的面(U/D/L/R/F/B),视角会转到尽量同时看见它们;`focusNonce` 变一次转一次。 */
  focusFaces?: readonly string[];
  focusNonce?: number;
  /** 复盘用的题面招式。 */
  moves?: readonly string[];
  /** 已经走到第几步:比上一次多 1 = 放一步动画,其余情况瞬时跳过去。 */
  step?: number;
}

export default function PredictBoard({
  labels, onSticker, focusFaces, focusNonce = 0, moves = NO_MOVES, step = 0,
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
      const mount = mountSimWorld({ host, interactive: true, perspective: 5.6 });
      mountRef.current = mount;
      const world: World = mount.world;

      const toucher = new TouchClass();
      toucher.init(mount.renderer.domElement, world.controller.touch);
      toucherRef.current = toucher;

      world.controller.dragEmpty = 'view';
      world.controller.paintMode = true;
      world.controller.onOrbit = (dx, dy) => {
        // 两轴都无界累加 —— 钳了 pitch 就翻不过顶/底,背面的答案就点不到。
        // yawSign 抵消上下颠倒那半圈的左右反向(与 /sim 同一处修正)。
        world.scene.rotation.y += dx * ORBIT_K * yawSign(world.scene.rotation.x);
        world.scene.rotation.x += dy * ORBIT_K;
        world.scene.updateMatrix();
        world.dirty = true;
      };
      world.controller.taps.push((index, face) => {
        if (index < 0 || face === null) return;
        const fi = reverseMap.get(`${index}_${face}`);
        if (fi !== undefined) onStickerRef.current(fi);
      });

      const onContextMenu = (e: MouseEvent) => e.preventDefault();
      mount.renderer.domElement.addEventListener('contextmenu', onContextMenu);

      // 转速是引擎的模块级全局(/sim 的约定是用完还回去)。
      const prevFrames = timing.frames;
      timing.frames = PLAY_FRAMES;

      setReady(true); // 触发下面的贴纸同步 effect

      cleanup = () => {
        timing.frames = prevFrames;
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
        cube.stick(faceletMap[i].cube, faceletMap[i].face, labels[i] ?? BLANK);
      }
      const done = moves.slice(0, step).join(' ');
      if (done) cube.twister.setup(done);
    }
    mount.invalidate();
  }, [labels, step, moves, ready, faceletMap]);

  const setView = (pitch: number, yaw: number) => {
    const world = mountRef.current?.world;
    if (!world) return;
    world.scene.rotation.x = pitch;
    world.scene.rotation.y = yaw;
    world.scene.rotation.z = 0;
    world.scene.updateMatrix();
    world.dirty = true;
  };

  /** 复位 = 回到「看得见这题」的角度(没给焦点面就回引擎默认视角)。 */
  const resetView = () => {
    const pose = poseShowing(focusFaces ?? []);
    setView(pose[0], pose[1]);
  };

  // 出题和「显示答案」都得把相关的面转到镜头前 —— 目标块很可能就在背面,不转等于没显示。
  useEffect(() => {
    if (!ready || !focusFaces?.length) return;
    const pose = poseShowing(focusFaces);
    setView(pose[0], pose[1]);
    // setView 只读 ref,不进依赖;nonce 变一次就转一次(同一批面也要能再转回去)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusNonce]);

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
