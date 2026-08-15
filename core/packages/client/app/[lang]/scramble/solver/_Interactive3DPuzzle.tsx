'use client';

/**
 * 可拖立体涂色画板 —— **非 NxN** 拼图版(金字塔 / 斜转)。
 *
 * 与 `_Interactive3DCube`(NxN,cuber 引擎 + Kociemba facelet map)是同一个交互、
 * 不同的贴纸寻址:
 *   · 渲染走 `/sim` 自有引擎(`mountSimWorld({ puzzle: 'pyraminx' | 'skewb' })`),
 *     **不挂 controller** —— 这里只涂色,一步都不许转,拖动一律是转视角。
 *   · 「命中的贴纸是第几格」不手抄坐标:引擎每张贴纸建构时就烙了 `userData.stickerKey`,
 *     而 `lib/puzzle-image` 的派生表 `ENGINE_SID_MAP` 把 canonical sid(`F3` / `U0`)
 *     映到那个 key,canonical sid 的面序 + 格序**恰好就是**两个求解器的 facelet 空间
 *     (金字塔 F D L R × 0..8、斜转 U R F D L B × 0..4)。于是
 *     `stickerKey → sid → facelet 下标` 是一次查表,零几何推断、零硬编码。
 *     表是从几何派生的(tests/_engine_mask_derive.ts 每次跑测重推),不会悄悄漂;
 *     本文件那条 sid↔facelet 的等价关系另有 tests/paint_3d_sid_map.test.ts 锁着。
 *
 * facelet(React state,与 2D 展开图画板共用同一个串)是唯一真值:每次它变,就把
 * 全部贴纸的**cap 材质**颜色刷一遍(材质在挂载时逐张 clone —— 引擎的 stickerMat 是按
 * 颜色缓存的共享实例,直接改会串色)。配色用 tnoodle 那套(PaintSpec.colors),所以
 * 立体画板、平面展开图、打乱预览图三者同色。
 *
 * 外壳(等第一帧 → 动态 import → 转圈 → 重置视角)走共享的 `<SimStage>`,指针
 * (拖=整体转体 / 点=涂色 / 右键=置灰)走共享的 `attachOrbitTap`,与二阶画板、SQ1
 * 转盘、recon 播放器同一份。这里只查看和涂色,拖动走 /sim「视角」档的无界 orbit:
 * 俯仰越过顶/底后仍可继续旋转,不会在 ±90° 卡住。
 *
 * 视角旋转只动 scene、不换贴纸身份:`stickerKey → facelet 下标` 那张表是按 mesh 建的,
 * 转过视角后同一屏幕位置命中的是**另一张**贴纸、于是涂到另一格 —— 与 NxN 画板同一套语义
 * (facelet 串永远是拼图自己那一帧,你只是把它转过来看别的面)。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type * as THREE from 'three';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import SimStage from '@/components/sim-embed/SimStage';
import { useT } from '@/hooks/useT';
import { EMPTY_COLOR_HEX, usePainter, type FaceLetter, type PaintColor, type PaintSpec } from './_paint-shared';
import { PaintPalette, PaintActions } from './_PaintToolbar';

/** 引擎自有渲染 + 有派生 sid 表的拼图,目前这两个有画状态求解器。 */
export type PaintPuzzle3D = 'pyraminx' | 'skewb';

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
  resetView: () => void;
}

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

  const engRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);

  const colors = useMemo(
    () => spec.colors as Readonly<Record<FaceLetter, string>> | undefined,
    [spec.colors],
  );

  // ── 引擎挂载(SimStage 等过第一帧才调,只调一次)────────────────────────
  const mountEngine = async (host: HTMLElement): Promise<() => void> => {
    const [embed, view, gesture, three, mask] = await Promise.all([
      import('@/components/sim-embed/mountSimWorld'),
      import('@/app/[lang]/sim/engine/viewControls'),
      import('@/components/sim-embed/orbitTapGesture'),
      import('three'),
      import('@/lib/puzzle-image/puzzle-mask'),
    ]);

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

    const raycaster = new three.Raycaster();
    const vec2 = new three.Vector2();
    engRef.current = {
      mount, stickers, raycaster, vec2,
      resetView: () => { view.resetSceneView(mount.world); mount.invalidate(); },
    };

    /** 画布局部坐标 → 命中的 facelet 下标(没打到贴纸就 null)。 */
    const pickIdx = (localX: number, localY: number): number | null => {
      const w = mount.world;
      vec2.set((localX / w.width) * 2 - 1, -(localY / w.height) * 2 + 1);
      raycaster.setFromCamera(vec2, w.camera);
      w.scene.updateMatrixWorld();
      const hits = raycaster.intersectObjects(stickers.map((s) => s.mesh), false);
      if (hits.length === 0) return null;
      const hit = stickers.find((s) => s.mesh === hits[0].object);
      return hit ? hit.idx : null;
    };

    const detach = gesture.attachOrbitTap({
      world: mount.world,
      canvas: mount.renderer.domElement,
      freeOrbit: true,
      onTap: (x, y, button) => {
        const idx = pickIdx(x, y);
        if (idx !== null) paintRef.current(idx, button === 0 ? undefined : 'X');
      },
    });

    return () => {
      detach();
      mount.dispose();
      engRef.current = null;
    };
  };

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

  return (
    <div className="vc-p3d">
      <style>{INLINE_CSS}</style>
      <SimStage
        size={pixelSize}
        mount={mountEngine}
        onReady={() => setReady(true)}
        onResetView={() => engRef.current?.resetView()}
        className="vc-p3d-stage"
      />

      <PaintPalette
        activeColor={activeColor}
        onActiveColorChange={onActiveColorChange}
        colors={colors}
        faces={paletteFaces}
      />

      <p className="vc-p3d-hint">
        {t('点一下贴纸涂色(右键置灰),拖动整体转体 —— 立体画板不会拧动任何一层。',
          'Tap a sticker to paint it (right-click to erase); drag to turn the whole puzzle — the 3D painter never twists a layer.')}
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
.vc-p3d-stage .sim-stage-canvas { cursor: crosshair; }
.vc-p3d-hint {
  font-size: 0.8rem; color: var(--muted-foreground); text-align: center;
  max-width: 26rem; line-height: 1.5;
}
`;
