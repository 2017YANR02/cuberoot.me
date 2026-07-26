'use client';

/**
 * Rotatable 3D state painter — reuses the /sim cuber WebGL engine
 * (huazhechen/cuber) verbatim, in a "paint mode", instead of drawing our own
 * cube. The engine is order-generic (world.order = spec.n), so the same painter
 * serves 3×3 (default) and 2×2 (`spec={CUBE2_PAINT}`):
 *
 *   - controller.paintMode + dragEmpty='orbit' → every drag orbits the view,
 *     never twists a layer; a tap still fires controller.taps. Orbit is /sim's
 *    「自动转体」(`orbitSceneAutoRotate`): every 90° of yaw excess is folded into a
 *     real whole-cube y twist, so the cube turns under fixed lighting like a physical
 *     puzzle in hand instead of the camera flying around a cube whose shading never
 *     changes. Pitch stays clamped to ±90° (bird's-eye / worm's-eye, so U and D are
 *     still one tap away) — folding it isn't seamless, see viewControls `ViewTurns`.
 *   - taps → (current slot, world face) → the cubelet living there → its HOME
 *     address (initial index, local face) → facelet index → paintSticker. That
 *     detour is what makes painting survive the whole-cube twists above: facelet
 *     ↔ engine addressing (`faceletMap`, `cube.stick`) is home-based, and after a
 *     y/x twist the slot the finger hit is no longer the cubelet's home slot.
 *   - facelet (React state, shared with the 2D net) is the source of truth; on
 *     every change we push all 6n² sticker labels into the cube via cube.stick.
 *     Cube.serialize()'s ordering is the standard Kociemba URFDLB facelet, so
 *     FACELET_MAP (which mirrors it) round-trips painted state to the solver.
 *
 * 渲染器生命周期走共享的 `mountSimWorld`,外壳(等第一帧 → 转圈 → 重置视角)走共享的
 * `<SimStage>` —— 与金字塔/斜转画板、SQ1 转盘、预判题板同一份。NxN 的**拾取**仍走
 * cuber controller 的 `taps`(instanced 渲染,raycast 只给 instanceId,拿不到贴纸),
 * 这点与异形画板的 raycast 路线是真差异,不强合。
 *
 * three(0.183: ~740KB minified, ~0.2MB over the wire)+ 引擎全部动态 import,所以
 * COEP 隔离的求解器页初始包里没有它们。立体是**默认**视图,所以那次加载是被 SimStage
 * 排到第一帧之后,而不是从 mount 直接 await。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import type Toucher from '@/app/[lang]/sim/Toucher';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import SimStage from '@/components/sim-embed/SimStage';
import { onIdle } from '@/lib/on-idle';

/**
 * mountSimWorld(内含 three + 引擎)、Toucher、视角助手,每个页面加载只拉一次,
 * 所有画板实例共享(2×2 / 3×3,以及用户切走再切回来的重挂载)。
 *
 * 三个模块一次 `Promise.all` 拉完 —— 以前 three → world/interaction → Toucher 是
 * 串行瀑布,白白多两个往返。知道 3D 此刻不在屏上的调用方(2D / 打乱 / 复盘视图)可以
 * 在空闲时 `preloadPaintEngine()` 预热,切到「立体」就不用等;已经在飞的话缓存的
 * promise 让它是个空操作。
 */
type PaintEngine = {
  mountSimWorld: typeof import('@/components/sim-embed/mountSimWorld').mountSimWorld;
  Toucher: typeof Toucher;
  orbitSceneAutoRotate: typeof import('@/app/[lang]/sim/engine/viewControls').orbitSceneAutoRotate;
  resetSceneView: typeof import('@/app/[lang]/sim/engine/viewControls').resetSceneView;
  TwistAction: typeof import('@/app/[lang]/sim/engine/nxn/twister').TwistAction;
  /** /sim 默认灵敏度那一档。 */
  orbitK: number;
};
let enginePromise: Promise<PaintEngine> | null = null;

export function preloadPaintEngine(): Promise<PaintEngine> {
  enginePromise ??= (async () => {
    const [embed, toucher, view, twister] = await Promise.all([
      import('@/components/sim-embed/mountSimWorld'),
      import('@/app/[lang]/sim/Toucher'),
      import('@/app/[lang]/sim/engine/viewControls'),
      import('@/app/[lang]/sim/engine/nxn/twister'),
    ]);
    return {
      mountSimWorld: embed.mountSimWorld,
      Toucher: toucher.default,
      orbitSceneAutoRotate: view.orbitSceneAutoRotate,
      resetSceneView: view.resetSceneView,
      TwistAction: twister.TwistAction,
      orbitK: view.ORBIT_K,
    };
  })();
  return enginePromise;
}

/** Warm the engine during idle from a view that ISN'T 立体 (2D / scramble / recon),
 *  so switching to it never shows the spinner. No-op while 立体 is on screen — the
 *  painter itself is already loading, and preloadPaintEngine dedupes anyway. */
export function useIdlePreloadPaintEngine(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    return onIdle(() => { void preloadPaintEngine(); }, { timeout: 4000 });
  }, [enabled]);
}

import {
  FACES, CUBE3_PAINT, usePainter, type FaceLetter, type PaintColor, type PaintSpec,
} from './_paint-shared';
import { PaintPalette, PaintActions } from './_PaintToolbar';

// facelet idx (URFDLB) → (cubelet position index, local face). Shared with
// /predict's board — see components/sim-embed/faceletMap.
import { buildFaceletMap, buildReverseFaceletMap } from '@/components/sim-embed/faceletMap';

export interface Interactive3DCubeProps {
  facelet: string;
  /** Cube order + legality model. Defaults to 3×3. */
  spec?: PaintSpec;
  onChange: (next: string) => void;
  activeColor: PaintColor;
  onActiveColorChange: (c: PaintColor) => void;
  pixelSize: number;
  onSolve?: (facelet: string) => void;
  solveLabel?: { zh: string; en: string };
  solveTitle?: { zh: string; en: string };
  onSecondaryAction?: (facelet: string) => void;
  secondaryActionLabel?: { zh: string; en: string };
  secondaryActionTitle?: { zh: string; en: string };
  secondaryBusy?: boolean;
  optimalToggle?: { value: boolean; onChange: (v: boolean) => void };
  hideSolve?: boolean;
  plainSolve?: boolean;
}

export default function Interactive3DCube({
  facelet, spec = CUBE3_PAINT, onChange, activeColor, onActiveColorChange, pixelSize, onSolve, solveLabel, solveTitle,
  onSecondaryAction, secondaryActionLabel, secondaryActionTitle, secondaryBusy, optimalToggle, hideSolve, plainSolve,
}: Interactive3DCubeProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const { paint, rejectMsg } = usePainter({ facelet, onChange, activeColor, isZh, spec });
  // taps fire from the engine's closure; keep the latest paint()/onActiveColorChange reachable by ref.
  const paintRef = useRef(paint);
  useEffect(() => { paintRef.current = paint; }, [paint]);
  const onActiveColorChangeRef = useRef(onActiveColorChange);
  useEffect(() => { onActiveColorChangeRef.current = onActiveColorChange; }, [onActiveColorChange]);

  // Order-dependent sticker maps. The mount runs once, so it reads them through
  // a ref (a component instance never changes cube order in practice).
  const faceletMap = useMemo(() => buildFaceletMap(spec.n), [spec.n]);
  const reverseMap = useMemo(() => buildReverseFaceletMap(faceletMap), [faceletMap]);
  const mapsRef = useRef({ faceletMap, reverseMap, spec });
  useEffect(() => { mapsRef.current = { faceletMap, reverseMap, spec }; }, [faceletMap, reverseMap, spec]);

  const mountRef = useRef<SimMount | null>(null);
  const resetViewRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);

  const mountEngine = async (host: HTMLElement): Promise<() => void> => {
    const {
      mountSimWorld, Toucher: TouchClass, orbitSceneAutoRotate, resetSceneView, TwistAction, orbitK,
    } = await preloadPaintEngine();

    // 画板一律满像素比(涂色要看清贴纸边界),所以不吃 mountSimWorld 默认的 2× 上限。
    const mount = mountSimWorld({
      host,
      puzzle: mapsRef.current.spec.n,
      interactive: true,
      pixelRatioCap: Number.POSITIVE_INFINITY,
    });
    mountRef.current = mount;
    const world = mount.world;
    const cube = world.cube as Cube;

    // 重置视角 = 视角回家 **且** 把自动转体累计的整体转体退回去(涂色板的姿态就是这两样),
    // 否则按了「重置」魔方还歪着(白面朝右),用户会以为按钮坏了。cube.reset() 只动位置 /
    // 朝向,贴纸颜色挂在 cubelet 上不受影响。
    resetViewRef.current = () => { cube.reset(); resetSceneView(world); mount.invalidate(); };

    const toucher = new TouchClass();
    toucher.init(mount.renderer.domElement, world.controller.touch);

    // Paint mode: drags orbit (never twist a layer), taps paint. 「自动转体」= 左右拖每积累
    // 90° 就折成真正的整体 y 转体(与 /sim 同一份 foldViewIntoTurns);上下拖钳在 ±90°
    // (那里正好正俯视 / 正仰视,U/D 照样点得到)—— 俯仰折叠在非象限偏航下会跳一帧,画板
    // 不记步、没有非折不可的理由,就不折。理由与实测见 viewControls 的 `ViewTurns`。
    world.controller.dragEmpty = 'orbit';
    world.controller.paintMode = true;
    world.controller.onOrbit = (dx, dy) => {
      orbitSceneAutoRotate(world, dx, dy, orbitK, {
        y: {
          quantum: Math.PI / 2,
          commit: (positive) => cube.twister.twist(new TwistAction('y', positive, 1), true, true),
        },
      });
    };
    world.controller.taps.push((slot, face, tapOpts) => {
      if (slot < 0 || face === null) return;
      const { reverseMap: rev, spec: sp } = mapsRef.current;
      // 手指点到的是**当前**槽位 + **世界**面;facelet 表是 home 寻址(initial 索引 + 本地面)。
      // 没转过体时两者恒等,转过体后必须经这枚 cubelet 换算回去。
      const cubelet = cube.cubelets.get(slot);
      if (!cubelet) return;
      const fi = rev.get(`${cubelet.initial}_${cubelet.getFace(face)}`);
      if (fi === undefined) return;
      const per = sp.n * sp.n;
      if (sp.fixedCenters && fi % per === (per - 1) / 2) {
        // center (fixed) — tapping it picks its color instead of painting.
        if (tapOpts.button === 0) onActiveColorChangeRef.current(FACES[Math.floor(fi / per)] as FaceLetter);
        return;
      }
      paintRef.current(fi, tapOpts.button === 2 ? 'X' : undefined);
    });

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    mount.renderer.domElement.addEventListener('contextmenu', onContextMenu);

    return () => {
      mount.renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      toucher.destroy();
      mount.dispose();
      mountRef.current = null;
    };
  };

  // facelet (source of truth) → cube sticker labels. 'X' → 'Gray' (unknown label
  // falls back to COLORS.Gray in the renderer).
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready) return;
    const cube = mount.world.cube as Cube;
    for (let i = 0; i < faceletMap.length; i++) {
      const e = faceletMap[i];
      const ch = facelet[i];
      cube.stick(e.cube, e.face, ch === 'X' ? 'Gray' : ch);
    }
    mount.invalidate();
  }, [facelet, ready, faceletMap]);

  return (
    <div className="vc-cube3d">
      <style>{INLINE_CSS}</style>
      <div className="vc-cube3d-body">
        <SimStage
          size={pixelSize}
          mount={mountEngine}
          onReady={() => setReady(true)}
          onResetView={() => resetViewRef.current()}
          className="vc-cube3d-stage"
        />

        <PaintPalette activeColor={activeColor} onActiveColorChange={onActiveColorChange} />
      </div>

      <PaintActions
        facelet={facelet}
        spec={spec}
        onChange={onChange}
        onSolve={onSolve}
        solveLabel={solveLabel}
        solveTitle={solveTitle}
        onSecondaryAction={onSecondaryAction}
        secondaryActionLabel={secondaryActionLabel}
        secondaryActionTitle={secondaryActionTitle}
        secondaryBusy={secondaryBusy}
        optimalToggle={optimalToggle}
        rejectMsg={rejectMsg}
        hideSolve={hideSolve}
        plainSolve={plainSolve}
      />
    </div>
  );
}

const INLINE_CSS = `
.vc-cube3d {
  display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
  width: 100%;
}
.vc-cube3d-body {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem;
}
.vc-cube3d-stage .sim-stage-canvas {
  cursor: crosshair;
  background: rgba(255,255,255,0.025);
  border-radius: 8px;
  overflow: hidden;
}
`;
