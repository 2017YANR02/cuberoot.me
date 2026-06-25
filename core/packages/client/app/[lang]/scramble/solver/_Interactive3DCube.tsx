'use client';

/**
 * Rotatable 3D state painter for the 3×3 solver — reuses the /sim cuber WebGL
 * engine (huazhechen/cuber) verbatim, in a "paint mode", instead of drawing our
 * own cube. The engine renders an order-3 cube; we drive it as a pure painter:
 *
 *   - controller.paintMode + dragEmpty='view'  → every drag orbits the view,
 *     never twists a layer; a tap still fires controller.taps.
 *   - taps → map (cubelet index, world face) → facelet index → paintSticker.
 *   - facelet (React state, shared with the 2D net) is the source of truth; on
 *     every change we push all 54 sticker labels into the cube via cube.stick.
 *     Cube.serialize()'s ordering is the standard Kociemba URFDLB facelet, so
 *     FACELET_MAP (which mirrors it) round-trips painted state to the solver.
 *
 * three (~1.2MB) + the cuber engine are dynamically imported in the mount effect
 * so they stay out of the COEP-isolated solver's initial bundle (only loaded
 * when the user opens 立体图).
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import type * as THREE from 'three';
import type World from '@/app/[lang]/sim/engine/world';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import type Toucher from '@/app/[lang]/sim/Toucher';
import { usePainter, type PaintColor } from './_paint-shared';
import PaintToolbar from './_PaintToolbar';

// cuber FACE enum: L0 R1 D2 U3 B4 F5
const FACE = { L: 0, R: 1, D: 2, U: 3, B: 4, F: 5 } as const;

// facelet idx (URFDLB) → (cubelet position index, local face) for a never-twisted
// order-3 cube. Mirrors Cube.serialize()'s loops exactly (verified U/R against
// the Kociemba CORNER_FACELET table in facelet.ts).
const FACELET_MAP: { cube: number; face: number }[] = (() => {
  const N = 3, out: { cube: number; face: number }[] = [];
  const idx = (x: number, y: number, z: number) => z * N * N + y * N + x;
  let x: number, y: number, z: number;
  y = N - 1; for (z = 0; z < N; z++) for (x = 0; x < N; x++) out.push({ cube: idx(x, y, z), face: FACE.U });
  x = N - 1; for (y = N - 1; y >= 0; y--) for (z = N - 1; z >= 0; z--) out.push({ cube: idx(x, y, z), face: FACE.R });
  z = N - 1; for (y = N - 1; y >= 0; y--) for (x = 0; x < N; x++) out.push({ cube: idx(x, y, z), face: FACE.F });
  y = 0; for (z = N - 1; z >= 0; z--) for (x = 0; x < N; x++) out.push({ cube: idx(x, y, z), face: FACE.D });
  x = 0; for (y = N - 1; y >= 0; y--) for (z = 0; z < N; z++) out.push({ cube: idx(x, y, z), face: FACE.L });
  z = 0; for (y = N - 1; y >= 0; y--) for (x = N - 1; x >= 0; x--) out.push({ cube: idx(x, y, z), face: FACE.B });
  return out;
})();

// (cubelet index, face) → facelet idx, for the tap handler.
const REVERSE_MAP: Map<string, number> = (() => {
  const m = new Map<string, number>();
  FACELET_MAP.forEach((e, i) => m.set(`${e.cube}_${e.face}`, i));
  return m;
})();

// Default view (the cuber engine's own initial scene.rotation — U top, F front, R right).
const DEFAULT_ROT_X = Math.PI / 6;
const DEFAULT_ROT_Y = -Math.PI / 4 + Math.PI / 16;
const ORBIT_K = 0.008; // radians per px dragged

export interface Interactive3DCubeProps {
  facelet: string;
  onChange: (next: string) => void;
  activeColor: PaintColor;
  onActiveColorChange: (c: PaintColor) => void;
  pixelSize: number;
  onSolve?: (facelet: string) => void;
  solveLabel?: { zh: string; en: string };
  hideSolve?: boolean;
}

export default function Interactive3DCube({
  facelet, onChange, activeColor, onActiveColorChange, pixelSize, onSolve, solveLabel, hideSolve,
}: Interactive3DCubeProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const { paint, rejectMsg } = usePainter({ facelet, onChange, activeColor, isZh });
  // taps fire from the engine's closure; keep the latest paint() reachable by ref.
  const paintRef = useRef(paint);
  useEffect(() => { paintRef.current = paint; }, [paint]);

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const toucherRef = useRef<Toucher | null>(null);
  const [ready, setReady] = useState(false);

  // Mount the cuber engine once (dynamic import keeps three out of the initial bundle).
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const THREE = await import('three');
      const { default: World } = await import('@/app/[lang]/sim/engine/world');
      const { default: Toucher } = await import('@/app/[lang]/sim/Toucher');
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) return;

      const world = new World();
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
        w.scene.rotation.y += dx * ORBIT_K;
        w.scene.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, w.scene.rotation.x + dy * ORBIT_K));
        w.scene.updateMatrix();
        w.dirty = true;
      };
      world.controller.taps.push((index, face) => {
        if (index < 0 || face === null) return;
        const fi = REVERSE_MAP.get(`${index}_${face}`);
        if (fi === undefined || fi % 9 === 4) return; // unknown or center (fixed)
        paintRef.current(fi);
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
    for (let i = 0; i < 54; i++) {
      const e = FACELET_MAP[i];
      const ch = facelet[i];
      cube.stick(e.cube, e.face, ch === 'X' ? 'Gray' : ch);
    }
    world.dirty = true;
  }, [facelet, ready]);

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
      <div className="vc-cube3d-stage">
        <div
          ref={containerRef}
          className="vc-cube3d-canvas"
          style={{ width: pixelSize, height: pixelSize }}
        />
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
      <span className="vc-cube3d-hint">{t('拖动旋转 · 点击贴纸涂色', 'Drag to rotate · tap a sticker to paint')}</span>

      <PaintToolbar
        facelet={facelet}
        activeColor={activeColor}
        onActiveColorChange={onActiveColorChange}
        onChange={onChange}
        onSolve={onSolve}
        solveLabel={solveLabel}
        rejectMsg={rejectMsg}
        hideSolve={hideSolve}
      />
    </div>
  );
}

const INLINE_CSS = `
.vc-cube3d {
  display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
  width: 100%;
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
.vc-cube3d-hint {
  font-size: 0.78rem; color: var(--text-muted, #888);
}
`;
