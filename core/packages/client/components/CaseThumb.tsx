'use client';

/**
 * React adapter for the single case-thumbnail plan in `lib/alg_thumb_plan`.
 */
import { useMemo, type ReactNode } from 'react';
import type { AlgPuzzle, AlgSticker } from '@cuberoot/shared';
import { VisualCube } from '@/components/VisualCube';
import { PuzzleSVG } from '@/components/PuzzleSVG';
import { EnginePuzzleSVG } from '@/components/EnginePuzzleSVG';
import { caseThumbPlan, DEFAULT_ALG_CUBE_ORIENTATION } from '@/lib/alg_thumb_plan';
import type { CaseViewAngle } from '@/lib/alg_display';

export function CaseThumb({
  puzzle, set, sticker, alg, setup, size = 88, mask: maskOverride, local, loading,
  sq1BlackTop = true,
  simplifyRecognition = false,
  viewAngle = 'default',
  orientation = DEFAULT_ALG_CUBE_ORIENTATION,
  sq1Layer = 'both',
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
  /** Recolour an NxN diagram to the selected whole-cube holding orientation. */
  orientation?: string;
  /** Crop a Square-1 flat diagram to its top layer while keeping the shape centred. */
  sq1Layer?: 'both' | 'top';
}) {
  const plan = useMemo(() => caseThumbPlan({
    puzzle, set, sticker, alg, setup, mask: maskOverride, sq1BlackTop, simplifyRecognition, viewAngle, orientation,
  }), [puzzle, set, sticker, alg, setup, maskOverride, sq1BlackTop, simplifyRecognition, viewAngle, orientation]);

  // Square-1 flat SVGs stack two layers vertically. Render at 2x then crop the
  // upper half so a requested single layer keeps the same visual size as a full thumb.
  const cropTopLayer = plan.renderer === 'inline-svg'
    && plan.layout === 'stacked-layers'
    && sq1Layer === 'top';
  const renderSize = cropTopLayer ? size * 2 : size;
  let art: ReactNode;
  if (plan.renderer === 'inline-svg') {
    art = (
      <div
        className="puzzle-art"
        role="img"
        aria-label={plan.alt}
        style={{ width: renderSize, height: renderSize, display: 'inline-block', lineHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: plan.svg }}
      />
    );
  } else if (plan.renderer === 'asset') {
    art = (
      <img
        className="puzzle-art"
        src={plan.src}
        alt={plan.alt}
        width={plan.width}
        height={plan.height}
        loading={loading}
        style={{ width: renderSize, height: renderSize, display: 'inline-block', objectFit: 'contain' }}
      />
    );
  } else if (plan.renderer === 'engine') {
    art = <EnginePuzzleSVG kind={plan.puzzle} {...plan.driver} size={renderSize} />;
  } else if (plan.renderer === 'sr') {
    art = <PuzzleSVG kind={plan.kind} {...plan.driver} size={renderSize} />;
  } else {
    const p = plan.params;
    art = (
      <VisualCube
        algorithm={plan.algorithm}
        setup={plan.setup}
        view={p.view}
        mask={p.mask}
        faceletColors={p.faceletColors}
        faceletAlg={p.faceletAlg}
        scheme={p.scheme}
        hideGreySides={p.hideGreySides}
        planSimplify={p.planSimplify}
        size={renderSize}
        puzzleSize={p.puzzleSize}
        local={local}
        loading={loading}
      />
    );
  }

  if (!cropTopLayer) return art;
  return (
    <div style={{ width: size, height: size, overflow: 'hidden', lineHeight: 0 }}>
      <div style={{ width: renderSize, height: renderSize, transform: `translateX(-${size / 2}px)` }}>
        {art}
      </div>
    </div>
  );
}
