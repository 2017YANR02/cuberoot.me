'use client';

/**
 * React adapter for the single case-thumbnail plan in `lib/alg_thumb_plan`.
 */
import { useMemo } from 'react';
import type { AlgPuzzle, AlgSticker } from '@cuberoot/shared';
import { VisualCube } from '@/components/VisualCube';
import { PuzzleSVG } from '@/components/PuzzleSVG';
import { EnginePuzzleSVG } from '@/components/EnginePuzzleSVG';
import { caseThumbPlan } from '@/lib/alg_thumb_plan';
import type { CaseViewAngle } from '@/lib/alg_display';

export function CaseThumb({
  puzzle, set, sticker, alg, setup, size = 88, mask: maskOverride, local, loading,
  sq1BlackTop = true,
  simplifyRecognition = false,
  viewAngle = 'default',
}: {
  puzzle: AlgPuzzle;
  set: string;
  sticker: AlgSticker;
  alg: string;
  setup?: string;
  size?: number;
  mask?: string;
  /** NxN 走本地渲染(瞬时、与同屏其它图同帧出现)。见 `VisualCube` 的 `local`。 */
  local?: boolean;
  /**
   * `<img>` 路径的原生加载提示。首屏之外的长网格传 'lazy' —— 视口外的图根本不发请求。
   * 首屏可见的图别传(懒加载会推迟它)。`local` 渲染时无意义(没有请求可省)。
   */
  loading?: 'lazy' | 'eager';
  /** Square-1 flat thumbnails default to the common black-top colour scheme. */
  sq1BlackTop?: boolean;
  /** Show only the strongest recognition features on supported 3x3 plan views. */
  simplifyRecognition?: boolean;
  /** Rotate an applicable last-layer case by U / U2 / U' while keeping its solution coherent. */
  viewAngle?: CaseViewAngle;
}) {
  const plan = useMemo(() => caseThumbPlan({
    puzzle, set, sticker, alg, setup, mask: maskOverride, sq1BlackTop, simplifyRecognition, viewAngle,
  }), [puzzle, set, sticker, alg, setup, maskOverride, sq1BlackTop, simplifyRecognition, viewAngle]);

  if (plan.renderer === 'inline-svg') {
    return (
      <div
        className="puzzle-art"
        role="img"
        aria-label={plan.alt}
        style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: plan.svg }}
      />
    );
  }
  if (plan.renderer === 'asset') {
    return (
      <img
        className="puzzle-art"
        src={plan.src}
        alt={plan.alt}
        width={plan.width}
        height={plan.height}
        loading={loading}
        style={{ width: size, height: size, display: 'inline-block', objectFit: 'contain' }}
      />
    );
  }
  if (plan.renderer === 'engine') {
    return <EnginePuzzleSVG kind={plan.puzzle} {...plan.driver} size={size} />;
  }
  if (plan.renderer === 'sr') {
    return <PuzzleSVG kind={plan.kind} {...plan.driver} size={size} />;
  }
  const p = plan.params;
  return (
    <VisualCube
      algorithm={plan.algorithm}
      setup={plan.setup}
      view={p.view}
      mask={p.mask}
      scheme={p.scheme}
      hideGreySides={p.hideGreySides}
      planSimplify={p.planSimplify}
      size={size}
      puzzleSize={p.puzzleSize}
      local={local}
      loading={loading}
    />
  );
}
