import { VisualCube } from '@/components/VisualCube';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { T, tr } from '@/i18n/tr';

export function LastLayerTermDiagram({ wall, size = 220 }: { wall: boolean; size?: number }) {
  // Semantic diagrams isolate the side-row stickers defining each term.
  const colors = Array<string>(54).fill(FM_FIXED_COLOR[FM_IGNORED]!);
  const scheme = orientedCubeFaceColors('z2');
  for (let i = 0; i < 9; i++) colors[i] = scheme.U;
  colors[18] = colors[20] = scheme.F;
  if (wall) colors[19] = scheme.F;
  return <VisualCube local view="iso" size={size} stickerColors={colors}
    outlinedFacelets={wall ? [18, 19, 20] : [18, 20]}
    alt={tr(wall ? { zh: '圈出侧面顶层三个同色格：墙', en: 'Wall: three matching stickers in a side’s top row' }
      : { zh: '圈出侧面顶层两端的同色角格：眼', en: 'Headlights: matching corner stickers at both ends of a side’s top row' })} />;
}

export default function LastLayerTerms({ wall }: { wall: boolean }) {
  return <div className="lbl-middle-core">
    <figure>
      <LastLayerTermDiagram wall={wall} />
      <figcaption><strong>{wall ? <T zh="墙" en="Wall" /> : <T zh="眼" en="Headlights" />}</strong>
        <span>{wall ? <T zh="侧面顶层三个格同色，叫作墙" en="Three matching stickers in a side’s top row form a wall" />
          : <T zh="侧面顶层两端的角格同色，叫作眼" en="Matching corner stickers at both ends of a side’s top row form headlights" />}</span>
      </figcaption>
    </figure>
  </div>;
}
