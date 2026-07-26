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
 *   - 颜色逐贴纸给:`labels[i]` 是 facelet i 的引擎色标签('Gray' = 灰底)。
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
import { Spinner } from '@/components/Spinner/Spinner';
import { tr } from '@/i18n/tr';

/** 引擎自己的初始视角(U 上 F 前 R 右),复位就回这里。 */
const DEFAULT_ROT_X = Math.PI / 6;
const DEFAULT_ROT_Y = -Math.PI / 4 + Math.PI / 16;
/** 每拖 1px 转多少弧度,与 /sim 灵敏度默认值一致。 */
const ORBIT_K = 0.01;

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
  /** 54 个引擎色标签,facelet(URFDLB)序;'Gray' = 灰底。 */
  labels: readonly string[];
  onSticker: (faceletIndex: number) => void;
}

export default function PredictBoard({ labels, onSticker }: PredictBoardProps) {
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

      setReady(true); // 触发下面的贴纸同步 effect

      cleanup = () => {
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

  // labels(唯一真源)→ 引擎贴纸。
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready) return;
    const cube = mount.world.cube as Cube;
    for (let i = 0; i < faceletMap.length; i++) {
      cube.stick(faceletMap[i].cube, faceletMap[i].face, labels[i] ?? 'Gray');
    }
    mount.invalidate();
  }, [labels, ready, faceletMap]);

  const resetView = () => {
    const world = mountRef.current?.world;
    if (!world) return;
    world.scene.rotation.x = DEFAULT_ROT_X;
    world.scene.rotation.y = DEFAULT_ROT_Y;
    world.scene.rotation.z = 0;
    world.scene.updateMatrix();
    world.dirty = true;
  };

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
