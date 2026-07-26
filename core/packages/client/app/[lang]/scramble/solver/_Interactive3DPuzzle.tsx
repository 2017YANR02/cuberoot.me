'use client';

/**
 * 可拖立体涂色画板 —— **非 NxN** 拼图版(金字塔 / 斜转)。
 *
 * 与 `_Interactive3DCube`(NxN,cuber 引擎 + Kociemba facelet 映射)是同一个交互、
 * 不同的贴纸寻址:
 *   · 渲染走 `/sim` 自有引擎(`mountSimWorld({ puzzle: 'pyraminx' | 'skewb' })`),
 *     **不挂 controller** —— 这里只涂色,一步都不许转,拖动一律是转视角。
 *   · 「命中的贴纸是第几格」不手抄坐标:引擎每张贴纸建构时就烙了 `userData.stickerKey`,
 *     而 `lib/puzzle-image` 的派生表 `ENGINE_SID_MAP` 把 canonical sid(`F3` / `U0`)
 *     映到那个 key,canonical sid 的面序 + 格序**恰好就是**两个求解器的 facelet 空间
 *     (金字塔 F D L R × 0..8、斜转 U R F D L B × 0..4)。于是
 *     `stickerKey → sid → facelet 下标` 是一次查表,零几何推断、零硬编码。
 *     表是从几何派生的(tests/_engine_mask_derive.ts 每次跑测重推),不会悄悄漂;
 *     本文件那条 sid↔facelet 的等价关系另有 tests/paint-3d-sid-map.test.ts 锁着。
 *
 * facelet(React state,与 2D 展开图画板共用同一个串)是唯一真值:每次它变,就把
 * 全部贴纸的**cap 材质**颜色刷一遍(材质在挂载时逐张 clone —— 引擎的 stickerMat 是按
 * 颜色缓存的共享实例,直接改会串色)。配色用 tnoodle 那套(PaintSpec.colors),所以
 * 立体画板、平面展开图、打乱预览图三者同色。
 *
 * three + 引擎全部动态 import,并且等第一帧画完才开始拉 —— 与 `_Interactive3DCube`
 * 同一条理由(import three 会在主线程上解析执行,不能撞在首屏绘制里)。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import type * as THREE from 'three';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import { Spinner } from '@/components/Spinner/Spinner';
import { useT } from '@/hooks/useT';
import { EMPTY_COLOR_HEX, usePainter, type FaceLetter, type PaintColor, type PaintSpec } from './_paint-shared';
import { PaintPalette, PaintActions } from './_PaintToolbar';

/** 引擎自有渲染 + 有派生 sid 表的拼图,目前这两个有画状态求解器。 */
export type PaintPuzzle3D = 'pyraminx' | 'skewb';

/** 起手阈值:小于这点位移算「点一下」(涂色),超过就是拖(转视角)。与 /sim 同值。 */
const DRAG_THRESHOLD_PX = 6;
/** = mapOrbitK(50):/sim 默认灵敏度那一档(求解器页不给灵敏度设置)。 */
const ORBIT_K = 0.01;

/** 一张贴纸:它自己的 cap 材质(clone 过,可独立改色)+ 它是 facelet 的第几格。 */
interface StickerRef {
  mesh: THREE.Mesh;
  mat: { color: THREE.Color };
  idx: number;
}

interface Engine {
  mount: SimMount;
  stickers: StickerRef[];
  raycaster: THREE.Raycaster;
  vec2: THREE.Vector2;
  orbit: typeof import('@/app/[lang]/sim/engine/viewControls').orbitScene;
  homeRot: { x: number; y: number; z: number };
}

/** 第一帧画完(rAF 在绘制前触发,所以要嵌套两层)。 */
const afterFirstPaint = (): Promise<void> => new Promise<void>((resolve) => {
  if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

export interface Interactive3DPuzzleProps {
  puzzle: PaintPuzzle3D;
  spec: PaintSpec;
  facelet: string;
  onChange: (next: string) => void;
  activeColor: PaintColor;
  onActiveColorChange: (c: PaintColor) => void;
  /** 色板上哪几个面。缺省 = 立方体 6 面(斜转);金字塔只有 F D L R。 */
  paletteFaces?: readonly FaceLetter[];
  pixelSize: number;
  onSolve?: (facelet: string) => void;
  solveLabel?: { zh: string; en: string };
  solveTitle?: { zh: string; en: string };
  hideSolve?: boolean;
  plainSolve?: boolean;
}

export default function Interactive3DPuzzle({
  puzzle, spec, facelet, onChange, activeColor, onActiveColorChange, paletteFaces, pixelSize,
  onSolve, solveLabel, solveTitle, hideSolve, plainSolve,
}: Interactive3DPuzzleProps) {
  const t = useT();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const { paint, rejectMsg } = usePainter({ facelet, onChange, activeColor, isZh, spec });
  // 贴纸的点击回调活在引擎闭包里,拿最新的 paint 要走 ref。
  const paintRef = useRef(paint);
  paintRef.current = paint;

  const hostRef = useRef<HTMLDivElement>(null);
  const engRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  // 转圈只在「慢到人能察觉」时才出现(chunk 命中缓存时几乎立刻就位)。
  const [showBusy, setShowBusy] = useState(false);
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setShowBusy(true), 250);
    return () => clearTimeout(id);
  }, [ready]);

  const colors = useMemo(
    () => spec.colors as Readonly<Record<FaceLetter, string>> | undefined,
    [spec.colors],
  );

  // ── 挂载(一次)──────────────────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanupPointers: (() => void) | null = null;

    void (async () => {
      await afterFirstPaint();
      if (cancelled) return;
      const [embed, view, three, mask] = await Promise.all([
        import('@/components/sim-embed/mountSimWorld'),
        import('@/app/[lang]/sim/engine/viewControls'),
        import('three'),
        import('@/lib/puzzle-image/puzzle-mask'),
      ]);
      if (cancelled) return;

      const mount = embed.mountSimWorld({ host, puzzle });

      // stickerKey → facelet 下标(canonical sid 的面序/格序 = 求解器的 facelet 空间)。
      const faces = mask.CANONICAL_FACES[puzzle];
      const perFace = spec.size / faces.length;
      const keyToIdx = new Map<string, number>();
      for (const [sid, key] of Object.entries(mask.ENGINE_SID_MAP[puzzle])) {
        const parsed = mask.parseStickerId(sid);
        if (!parsed) continue;
        const f = faces.indexOf(parsed.face);
        if (f < 0 || parsed.index >= perFace) continue;
        keyToIdx.set(key, f * perFace + parsed.index);
      }

      const stickers: StickerRef[] = [];
      mount.world.cube.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.simRole !== 'sticker') return;
        const idx = keyToIdx.get(String(mesh.userData.stickerKey));
        if (idx === undefined) return;
        // 引擎的 stickerMat 按颜色缓存 + 共享 → 必须 clone 一份,否则改一张串一片。
        const mats = mesh.material;
        const cap = (Array.isArray(mats) ? mats[0] : mats).clone();
        mesh.material = Array.isArray(mats) ? [cap, mats[1]] : cap;
        stickers.push({ mesh, mat: cap as unknown as { color: THREE.Color }, idx });
      });

      const eng: Engine = {
        mount,
        stickers,
        raycaster: new three.Raycaster(),
        vec2: new three.Vector2(),
        orbit: view.orbitScene,
        homeRot: {
          x: mount.world.scene.rotation.x,
          y: mount.world.scene.rotation.y,
          z: mount.world.scene.rotation.z,
        },
      };
      engRef.current = eng;

      // ── 指针:拖 = 转视角,点 = 涂色(右键置灰)。一步都不转魔方。
      const canvas = mount.renderer.domElement;
      let down = false;
      let moved = false;
      let button = 0;
      let downX = 0;
      let downY = 0;
      let lastX = 0;
      let lastY = 0;

      const pickIdx = (localX: number, localY: number): number | null => {
        const w = mount.world;
        eng.vec2.set((localX / w.width) * 2 - 1, -(localY / w.height) * 2 + 1);
        eng.raycaster.setFromCamera(eng.vec2, w.camera);
        w.scene.updateMatrixWorld();
        const hits = eng.raycaster.intersectObjects(eng.stickers.map((s) => s.mesh), false);
        if (hits.length === 0) return null;
        const hit = eng.stickers.find((s) => s.mesh === hits[0].object);
        return hit ? hit.idx : null;
      };

      const onDown = (e: PointerEvent): void => {
        const r = canvas.getBoundingClientRect();
        downX = e.clientX - r.left;
        downY = e.clientY - r.top;
        lastX = e.clientX;
        lastY = e.clientY;
        down = true;
        moved = false;
        button = e.button;
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      };

      const onMove = (e: PointerEvent): void => {
        if (!down) return;
        if (!moved) {
          const r = canvas.getBoundingClientRect();
          if (Math.hypot(e.clientX - r.left - downX, e.clientY - r.top - downY) < DRAG_THRESHOLD_PX) return;
          moved = true;
        }
        eng.orbit(mount.world, e.clientX - lastX, e.clientY - lastY, ORBIT_K);
        lastX = e.clientX;
        lastY = e.clientY;
      };

      const onUp = (e: PointerEvent): void => {
        if (down && !moved) {
          const idx = pickIdx(downX, downY);
          if (idx !== null) paintRef.current(idx, button === 0 ? undefined : 'X');
        }
        down = false;
        moved = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      };

      const onContextMenu = (e: MouseEvent): void => e.preventDefault();

      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove, { passive: false });
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('contextmenu', onContextMenu);
      cleanupPointers = () => {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('contextmenu', onContextMenu);
      };

      setReady(true); // → 触发下面的 facelet → 贴纸颜色同步
    })();

    return () => {
      cancelled = true;
      cleanupPointers?.();
      engRef.current?.mount.dispose();
      engRef.current = null;
    };
    // puzzle / spec.size 在一个实例的生命周期里不变(换拼图 = 换页面)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── facelet(唯一真值)→ 贴纸颜色 ──────────────────────────────────────
  useEffect(() => {
    const eng = engRef.current;
    if (!eng || !ready) return;
    for (const s of eng.stickers) {
      const ch = facelet[s.idx] as PaintColor;
      s.mat.color.set(ch === 'X' ? EMPTY_COLOR_HEX : (colors?.[ch as FaceLetter] ?? EMPTY_COLOR_HEX));
    }
    eng.mount.invalidate();
  }, [facelet, ready, colors]);

  const resetView = (): void => {
    const eng = engRef.current;
    if (!eng) return;
    const { scene } = eng.mount.world;
    scene.rotation.set(eng.homeRot.x, eng.homeRot.y, eng.homeRot.z);
    scene.updateMatrix();
    eng.mount.invalidate();
  };

  return (
    <div className="vc-p3d">
      <style>{INLINE_CSS}</style>
      <div className="vc-p3d-stage">
        <div
          ref={hostRef}
          className="vc-p3d-canvas"
          style={{ width: pixelSize, height: pixelSize }}
        />
        {!ready && showBusy && (
          <span className="vc-p3d-busy">
            <Spinner size={22} label={t('正在加载立体画板', 'Loading the 3D painter')} />
          </span>
        )}
        <button
          type="button"
          className="vc-p3d-reset"
          onClick={resetView}
          title={t('重置视角', 'Reset view')}
          aria-label={t('重置视角', 'Reset view')}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <PaintPalette
        activeColor={activeColor}
        onActiveColorChange={onActiveColorChange}
        colors={colors}
        faces={paletteFaces}
      />

      <p className="vc-p3d-hint">
        {t('点一下贴纸涂色(右键置灰),拖动转视角 —— 立体画板不转魔方。',
          'Tap a sticker to paint it (right-click to erase); drag to orbit — the 3D painter never turns the puzzle.')}
      </p>

      <PaintActions
        facelet={facelet}
        spec={spec}
        onChange={onChange}
        onSolve={onSolve}
        solveLabel={solveLabel}
        solveTitle={solveTitle}
        rejectMsg={rejectMsg}
        hideSolve={hideSolve}
        plainSolve={plainSolve}
      />
    </div>
  );
}

const INLINE_CSS = `
.vc-p3d { display: flex; flex-direction: column; align-items: center; gap: 0.7rem; width: 100%; }
.vc-p3d-stage { position: relative; line-height: 0; }
.vc-p3d-canvas {
  cursor: crosshair; touch-action: none; max-width: 100%;
  -webkit-user-select: none; user-select: none;
}
.vc-p3d-reset {
  position: absolute; top: 4px; right: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: var(--card); border: 1px solid var(--border-default);
  color: var(--muted-foreground); border-radius: 6px; cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}
.vc-p3d-reset:hover { border-color: var(--accent); color: var(--accent); }
.vc-p3d-busy {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--muted-foreground); pointer-events: none;
}
.vc-p3d-hint {
  font-size: 0.8rem; color: var(--muted-foreground); text-align: center;
  max-width: 26rem; line-height: 1.5;
}
`;
