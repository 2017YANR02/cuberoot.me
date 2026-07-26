'use client';

/**
 * Rotatable 3D state painter — reuses the /sim cuber WebGL engine
 * (huazhechen/cuber) verbatim, in a "paint mode", instead of drawing our own
 * cube. The engine is order-generic (world.order = spec.n), so the same painter
 * serves 3×3 (default) and 2×2 (`spec={CUBE2_PAINT}`):
 *
 *   - controller.paintMode + dragEmpty='view'  → every drag orbits the view,
 *     never twists a layer; a tap still fires controller.taps. Orbit is the same
 *     unbounded two-axis accumulation /sim's「视角」mode uses, so the cube can be
 *     spun freely in any direction (no ±90° pitch clamp).
 *   - taps → map (cubelet index, world face) → facelet index → paintSticker.
 *   - facelet (React state, shared with the 2D net) is the source of truth; on
 *     every change we push all 6n² sticker labels into the cube via cube.stick.
 *     Cube.serialize()'s ordering is the standard Kociemba URFDLB facelet, so
 *     FACELET_MAP (which mirrors it) round-trips painted state to the solver.
 *
 * three (0.183: ~740KB minified, ~0.2MB over the wire) + the cuber engine are
 * dynamically imported so they stay out of the COEP-isolated solver's initial
 * bundle. Since 立体 is the DEFAULT view, that load is *scheduled* rather than
 * awaited straight from mount — see preloadPaintEngine below.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import type * as THREE from 'three';
import type World from '@/app/[lang]/sim/engine/world';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import type Toucher from '@/app/[lang]/sim/Toucher';
import { yawSign } from '@/app/[lang]/sim/engine/viewControls'; // pure math, no three import
import { Spinner } from '@/components/Spinner/Spinner';
import { onIdle } from '@/lib/on-idle';

/**
 * three + cuber engine, fetched once per page load and shared by every painter
 * instance (2×2 / 3×3, and remounts when the user tabs away and back).
 *
 * Deliberately NOT awaited straight from the mount effect: importing three also
 * *parses and executes* it on the main thread, which would land in the middle of
 * the solver's first paint. `afterFirstPaint()` lets the shell (tabs, palette,
 * canvas frame) hit the screen first; the download then overlaps with whatever the
 * user does next. All four modules are fetched in ONE Promise.all — the previous
 * three → world/interaction → Toucher waterfall cost two extra round trips for no
 * reason. Callers that know 3D is off-screen (2D / scramble / recon views) can
 * call preloadPaintEngine() during idle so switching to 立体 is instant — the
 * cached promise makes that a no-op if it's already in flight.
 */
type PaintEngine = {
  THREE: typeof THREE;
  World: typeof World;
  attachInteraction: (w: World) => World;
  Toucher: typeof Toucher;
};
let enginePromise: Promise<PaintEngine> | null = null;

export function preloadPaintEngine(): Promise<PaintEngine> {
  enginePromise ??= (async () => {
    const [three, world, interaction, toucher] = await Promise.all([
      import('three'),
      import('@/app/[lang]/sim/engine/world'),
      import('@/app/[lang]/sim/worldInteraction'),
      import('@/app/[lang]/sim/Toucher'),
    ]);
    return {
      THREE: three,
      World: world.default,
      attachInteraction: interaction.attachInteraction,
      Toucher: toucher.default,
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

/** Resolve after the browser has painted at least one frame (rAF fires pre-paint,
 *  so a nested rAF is the earliest "the pixels are up" signal). */
const afterFirstPaint = () => new Promise<void>((resolve) => {
  if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});
import {
  FACES, CUBE3_PAINT, usePainter, type FaceLetter, type PaintColor, type PaintSpec,
} from './_paint-shared';
import { PaintPalette, PaintActions } from './_PaintToolbar';

// facelet idx (URFDLB) → (cubelet position index, local face). Shared with
// /predict's board — see components/sim-embed/faceletMap.
import { buildFaceletMap, buildReverseFaceletMap } from '@/components/sim-embed/faceletMap';

// Default view (the cuber engine's own initial scene.rotation — U top, F front, R right).
const DEFAULT_ROT_X = Math.PI / 6;
const DEFAULT_ROT_Y = -Math.PI / 4 + Math.PI / 16;
const ORBIT_K = 0.01; // radians per px dragged — /sim 灵敏度默认(mapOrbitK(50))同值

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
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const { paint, rejectMsg } = usePainter({ facelet, onChange, activeColor, isZh, spec });
  // taps fire from the engine's closure; keep the latest paint()/onActiveColorChange reachable by ref.
  const paintRef = useRef(paint);
  useEffect(() => { paintRef.current = paint; }, [paint]);
  const onActiveColorChangeRef = useRef(onActiveColorChange);
  useEffect(() => { onActiveColorChangeRef.current = onActiveColorChange; }, [onActiveColorChange]);

  // Order-dependent sticker maps. The mount effect runs once, so it reads them
  // through a ref (a component instance never changes cube order in practice).
  const faceletMap = useMemo(() => buildFaceletMap(spec.n), [spec.n]);
  const reverseMap = useMemo(() => buildReverseFaceletMap(faceletMap), [faceletMap]);
  const mapsRef = useRef({ faceletMap, reverseMap, spec });
  useEffect(() => { mapsRef.current = { faceletMap, reverseMap, spec }; }, [faceletMap, reverseMap, spec]);

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const toucherRef = useRef<Toucher | null>(null);
  const [ready, setReady] = useState(false);
  // 转圈只在「慢到人能察觉」时才出现:chunk 命中缓存时 3D 几乎立刻就位,先闪一下
  // spinner 比空着更吵。250ms 是常见的 spinner-delay 阈值。
  const [showBusy, setShowBusy] = useState(false);
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setShowBusy(true), 250);
    return () => clearTimeout(id);
  }, [ready]);

  // Mount the cuber engine once (dynamic import keeps three out of the initial bundle).
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      await afterFirstPaint();
      if (cancelled) return;
      const { THREE, World, attachInteraction, Toucher } = await preloadPaintEngine();
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) return;

      const world = new World();
      attachInteraction(world); // 指针控制器 client 注入(engine 核心已 headless 化)
      if (world.order !== mapsRef.current.spec.n) world.order = mapsRef.current.spec.n;
      worldRef.current = world;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.autoClear = false;
      renderer.setClearColor(0xffffff, 0);
      renderer.setPixelRatio(window.devicePixelRatio);
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);
      renderer.domElement.style.outline = 'none';
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.display = 'block';

      const toucher = new Toucher();
      toucher.init(renderer.domElement, world.controller.touch);
      toucherRef.current = toucher;

      // Paint mode: drags orbit (never twist), taps paint.
      world.controller.dragEmpty = 'view';
      world.controller.paintMode = true;
      world.controller.onOrbit = (dx, dy) => {
        const w = worldRef.current;
        if (!w) return;
        // /sim 的「视角」模式:两轴都无界累加,可以一直转下去 —— 不钳 pitch 到 ±90°
        // (钳了就翻不过顶/底,看不到 D 面外沿),也不把跨 90° 折成 x/y 整体转。
        // yawSign 抵消上下颠倒那半圈的左右反向(与 /sim 同一处修正)。
        w.scene.rotation.y += dx * ORBIT_K * yawSign(w.scene.rotation.x);
        w.scene.rotation.x += dy * ORBIT_K;
        w.scene.updateMatrix();
        w.dirty = true;
      };
      world.controller.taps.push((index, face, tapOpts) => {
        if (index < 0 || face === null) return;
        const { reverseMap: rev, spec: sp } = mapsRef.current;
        const fi = rev.get(`${index}_${face}`);
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
      renderer.domElement.addEventListener('contextmenu', onContextMenu);

      const resize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        world.width = w;
        world.height = h;
        world.resize();
        renderer.setSize(w, h, true);
        world.dirty = true;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);

      let raf = 0;
      const loop = () => {
        if (world.dirty) {
          renderer.clear();
          renderer.render(world.scene, world.camera);
          world.dirty = false;
        }
        raf = requestAnimationFrame(loop);
      };
      loop();

      setReady(true); // triggers the facelet→cube sync effect

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.domElement.removeEventListener('contextmenu', onContextMenu);
        world.controller.stop();
        toucher.destroy();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        (world.cube as Cube).dispose?.();
        worldRef.current = null;
        rendererRef.current = null;
        toucherRef.current = null;
      };
      if (cancelled) cleanup();
    })();

    return () => { cancelled = true; cleanup?.(); };
  }, []);

  // facelet (source of truth) → cube sticker labels. 'X' → 'Gray' (unknown label
  // falls back to COLORS.Gray in the renderer).
  useEffect(() => {
    const world = worldRef.current;
    if (!world || !ready) return;
    const cube = world.cube as Cube;
    for (let i = 0; i < faceletMap.length; i++) {
      const e = faceletMap[i];
      const ch = facelet[i];
      cube.stick(e.cube, e.face, ch === 'X' ? 'Gray' : ch);
    }
    world.dirty = true;
  }, [facelet, ready, faceletMap]);

  const resetView = () => {
    const world = worldRef.current;
    if (!world) return;
    world.scene.rotation.x = DEFAULT_ROT_X;
    world.scene.rotation.y = DEFAULT_ROT_Y;
    world.scene.rotation.z = 0;
    world.scene.updateMatrix();
    world.dirty = true;
  };

  return (
    <div className="vc-cube3d">
      <style>{INLINE_CSS}</style>
      <div className="vc-cube3d-body">
        <div className="vc-cube3d-stage-wrap">
          <div className="vc-cube3d-stage">
            <div
              ref={containerRef}
              className="vc-cube3d-canvas"
              style={{ width: pixelSize, height: pixelSize }}
            />
            {!ready && showBusy && (
              <span className="vc-cube3d-busy">
                <Spinner size={22} label={t('正在加载立体画板', 'Loading the 3D painter')} />
              </span>
            )}
            <button
              type="button"
              className="vc-cube3d-reset"
              onClick={resetView}
              title={t('重置视角', 'Reset view')}
              aria-label={t('重置视角', 'Reset view')}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

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
.vc-cube3d-stage-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
}
.vc-cube3d-stage { position: relative; line-height: 0; }
.vc-cube3d-canvas {
  cursor: crosshair;
  touch-action: none;
  -webkit-user-select: none; user-select: none;
  background: rgba(255,255,255,0.025);
  border-radius: 8px;
  overflow: hidden;
}
.vc-cube3d-reset {
  position: absolute; top: 8px; right: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: var(--panel-sub, #2a2a2a);
  border: 1px solid var(--border, #444);
  color: var(--text-muted, #aaa);
  border-radius: 6px; cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}
.vc-cube3d-reset:hover { border-color: var(--accent, #ff8800); color: var(--accent, #ff8800); }
.vc-cube3d-busy {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted, #888);
  pointer-events: none;
}
`;
