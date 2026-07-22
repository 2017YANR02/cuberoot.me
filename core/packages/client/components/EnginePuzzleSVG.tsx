'use client';

/**
 * EnginePuzzleSVG — sq1 / megaminx / pyraminx / skewb 的 iso 静态图,/sim 引擎
 * headless 渲染(PLAN-sr-retirement §3 消费方切换):浏览器内建共享 World,
 * `twister.setup()` 重放 alg,走与 /sim 伴图同一 schematic 导出器 → 与 live sim
 * 同观感,无 SR_ANGLE_BASE 标定层。替代 sr-puzzlegen 的 `<PuzzleSVG>` iso 用法
 * (top / net 变体不在此:mega-top 是 sr 特有俯视、skewb-top 自绘、net 走服务端)。
 *
 * 服务端同构:server/src/routes/engine_render.ts(同 World 池/同两坑注释——
 * 手动 camera.updateMatrixWorld + 真实像素视口)。
 *
 * 引擎(three + World)懒 import(与 PuzzleSVG 懒 import sr 同款),SVG 字符串
 * 进模块级 LRU-ish 缓存(列表页几十张同图秒出)。
 */
import { useEffect, useRef, useState } from 'react';
import { invertAlg } from '@/lib/cube3';
import { invertSq1Alg, canonicalSq1Alg } from '@cuberoot/shared/sq1-notation';

export type EnginePuzzleKind = 'sq1' | 'megaminx' | 'pyraminx' | 'skewb';

type WorldT = import('@/app/[lang]/sim/engine/world').default;

const svgCache = new Map<string, string>();
const CACHE_CAP = 500;

let worldPromise: Promise<{
  world: WorldT;
  exportSchematic: typeof import('@/app/[lang]/sim/sim_svg_export_schematic').exportSimSvgSchematic;
  hasFacelets: typeof import('@/app/[lang]/sim/sim_svg_export_schematic').hasSchematicFacelets;
  sizeSvg: typeof import('@/lib/puzzle-image/engine-svg').sizeEngineSvg;
}> | null = null;

function getEngine() {
  if (!worldPromise) {
    worldPromise = Promise.all([
      import('@/app/[lang]/sim/engine/world'),
      import('@/app/[lang]/sim/sim_svg_export_schematic'),
      import('@/lib/puzzle-image/engine-svg'),
    ]).then(([w, ex, sz]) => ({
      world: new w.default(), // 纯静态图:不 attachInteraction(无指针消费)
      exportSchematic: ex.exportSimSvgSchematic,
      hasFacelets: ex.hasSchematicFacelets,
      sizeSvg: sz.sizeEngineSvg,
    }));
  }
  return worldPromise;
}

/** 同 server engine_render:World 复用 + setup 重放 + schematic 导出。 */
async function renderEngineSvg(kind: EnginePuzzleKind, forward: string, size: number): Promise<string | null> {
  const { world: w, exportSchematic, hasFacelets, sizeSvg } = await getEngine();
  if (w.puzzleKind !== kind) w.setPuzzle(kind);
  // 引擎默认视角(与 /sim 一致);headless 无渲染循环 → 手动刷相机 matrixWorld
  // (否则 camPos 读成原点,背面剔除全灭只剩剪影)。视口 = 真实像素(导出器坐标
  // 域是屏幕 px,1×1 会让 1px 封缝描边吞图)。
  w.scene.rotation.set(Math.PI / 6, -Math.PI / 4 + Math.PI / 16, 0);
  w.scene.updateMatrix();
  w.width = size; w.height = size;
  w.resize();
  w.camera.updateMatrixWorld(true);
  const tw = (w.cube as { twister: { setup(exp: string): void; finish(): void } }).twister;
  tw.setup(kind === 'sq1' && forward.trim() ? canonicalSq1Alg(forward) : forward);
  tw.finish();
  w.scene.updateMatrixWorld(true);
  if (!hasFacelets(w.scene)) return null;
  const svg = exportSchematic({
    world: w,
    inset: 0.15,          // /sim 面板「黑边」默认
    bodyColor: '#000000',
    bodyOpacity: 100,
    stickerOpacity: 100,
  });
  return sizeSvg(svg, size);
}

export function EnginePuzzleSVG({
  kind, alg, case: caseAlg, size = 88, className,
}: {
  kind: EnginePuzzleKind;
  alg?: string;
  case?: string;
  size?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  const forward = caseAlg && caseAlg.trim()
    ? (kind === 'sq1' ? invertSq1Alg(caseAlg) : invertAlg(caseAlg))
    : (alg ?? '');
  const key = `${kind}|${forward}|${size}`;
  const cached = svgCache.get(key);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    renderEngineSvg(kind, forward, size)
      .then((svg) => {
        if (cancelled || !svg) return;
        if (svgCache.size >= CACHE_CAP) svgCache.clear();
        svgCache.set(key, svg);
        setTick((n) => n + 1);
      })
      .catch((err) => console.warn('[EnginePuzzleSVG] render failed', kind, err));
    return () => { cancelled = true; };
  }, [key, cached, kind, forward, size]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
      {...(cached ? { dangerouslySetInnerHTML: { __html: cached } } : {})}
    />
  );
}
