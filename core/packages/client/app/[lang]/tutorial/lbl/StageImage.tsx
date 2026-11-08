import { VisualCube } from '@/components/VisualCube';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { stickeringMaskFn, mergeStickeringMaskFns, FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { LESSON_STICKERING } from './content';
import { withBrightCenters } from './cross-display';

function colorsFor(stage: string, brightCenters = false) {
  const name = pickStickering('3x3', LESSON_STICKERING[stage] ?? 'centers-only', 'sim');
  const mask = name ? stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name) : null;
  const combined = mergeStickeringMaskFns([mask, stage.startsWith('yellow-') || stage.endsWith('-position') ? stickeringMaskFn(3, 'F2L') : null]);
  return stageStickerColors(3, stage === 'cross' || stage === 'corners' || brightCenters ? withBrightCenters(combined) : combined, orientedCubeFaceColors('z2'));
}
export function StageImage({ stage, size = 120, brightCenters = false, view = 'iso' }: { stage: string; size?: number; brightCenters?: boolean; view?: 'iso' | 'plan' }) {
  return <VisualCube local size={size} view={view} stickerColors={colorsFor(stage, brightCenters)} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]}
    setup={stage === 'daisy' ? 'F2 R2 B2 L2' : ''} alt="" />;
}
