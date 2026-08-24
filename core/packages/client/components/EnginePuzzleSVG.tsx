'use client';

/**
 * EnginePuzzleSVG — sq1 / megaminx / pyraminx / skewb 的 iso 静态图。
 * 实际渲染懒加载共享包的唯一实现；本组件只保留公式方向换算、缓存和 React 生命周期。
 */
import { useEffect, useRef, useState } from 'react';
import { invertAlg } from '@/lib/cube3';
import { invertSq1Alg } from '@cuberoot/shared/sq1-notation';

export type EnginePuzzleKind = 'sq1' | 'megaminx' | 'pyraminx' | 'skewb';

const svgCache = new Map<string, string>();
const CACHE_CAP = 500;

let rendererPromise: Promise<typeof import('@cuberoot/puzzle-render-core/iso-svg').renderPuzzleIsoSvg> | null = null;

function getRenderer() {
  if (!rendererPromise) {
    rendererPromise = import('@cuberoot/puzzle-render-core/iso-svg')
      .then(({ renderPuzzleIsoSvg }) => renderPuzzleIsoSvg);
  }
  return rendererPromise;
}

/** `case`(=公式,逆着看)→ 正向 setup。两条消费路(本组件 / PDF 导出)同一份换算。 */
export function engineForwardAlg(kind: EnginePuzzleKind, driver: { alg?: string; case?: string }): string {
  const c = driver.case;
  if (c && c.trim()) return kind === 'sq1' ? invertSq1Alg(c) : invertAlg(c);
  return driver.alg ?? '';
}

/** 浏览器与服务端共用 `@cuberoot/puzzle-render-core/iso-svg` 的唯一渲染实现。 */
export async function renderEngineSvg(kind: EnginePuzzleKind, forward: string, size: number): Promise<string | null> {
  const render = await getRenderer();
  return render(kind, forward, undefined, size);
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

  const forward = engineForwardAlg(kind, { alg, case: caseAlg });
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
