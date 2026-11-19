import { VisualCube } from '@/components/VisualCube';
import { ArrowLeftRight } from '@app-foundation/icons/lucide';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { CUBE_FILL } from '@/lib/cube-colors';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { T, tr } from '@/i18n/tr';
import ReadingFit from '../components/ReadingFit';

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

export function HeadlightsTerms() {
  return <div className="lbl-content lbl-content-pieces" data-tutorial-layout="A">
    <section className="lbl-demonstration lbl-headlights-demonstration">
      <div className="lbl-headlights-diagram"><LastLayerTermDiagram wall={false} size={320} /></div>
    </section>
    <section className="lbl-explanation"><ReadingFit pane>
      <p className="lbl-lead"><T zh="眼" en="Headlights" /></p>
      <p><T zh="侧面顶层两端的角格同色，叫作眼" en="Matching corner stickers at both ends of a side’s top row form headlights" /></p>
    </ReadingFit></section>
  </div>;
}

export default function LastLayerTerms() {
  return <div className="lbl-middle-core">
    <div className="lbl-middle-core-cases lbl-edge-terms">
      <figure>
        <div className="lbl-edge-term-art"><LastLayerTermDiagram wall size={248} /></div>
        <figcaption><strong><T zh="墙" en="Wall" /></strong>
          <span><T zh="侧面顶层三个格同色，叫作墙" en="Three matching stickers in a side’s top row form a wall" /></span>
        </figcaption>
      </figure>
      <figure>
        <div className="lbl-edge-term-art" aria-hidden="true">
          <div className="lbl-opposite-color-diagram">
            {([[CUBE_FILL.B, CUBE_FILL.F], [CUBE_FILL.R, CUBE_FILL.L]]).map(([left, right]) => (
              <div className="lbl-opposite-color-pair" key={left}>
                <span style={{ backgroundColor: left }} />
                <ArrowLeftRight size={24} />
                <span style={{ backgroundColor: right }} />
              </div>
            ))}
          </div>
        </div>
        <figcaption>
          <strong><T zh="对色" en="Opposite colors" /></strong>
          <span><T zh="复原后，相对两面的颜色互为对色" en="On a solved cube, the colors on opposite faces are opposite colors." /></span>
          <span><T zh="标准配色中，蓝和绿、红和橙互为对色" en="In the standard color scheme, blue is opposite green, and red is opposite orange." /></span>
        </figcaption>
      </figure>
    </div>
  </div>;
}
