import { ArrowDown, ArrowRight } from '@app-foundation/icons/lucide';
import { VisualCube } from '@/components/VisualCube';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { stickeringMaskFn, FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { tr, T } from '@/i18n/tr';

const stages = [
  { mask: 'fl', title: { zh: '底层', en: 'Bottom layer' }, steps: [
    { zh: '做小花', en: 'Make the daisy' },
    { zh: '白十字', en: 'White cross' },
    { zh: '底层角块', en: 'Bottom corners' },
  ] },
  { mask: 'f2l', title: { zh: '中层', en: 'Middle layer' }, steps: [
    { zh: '中层棱块', en: 'Middle edges' },
  ] },
  { mask: '', title: { zh: '顶层', en: 'Top layer' }, steps: [
    { zh: '黄十字', en: 'Yellow cross' },
    { zh: '黄面', en: 'Yellow face' },
    { zh: '角位置', en: 'Position corners' },
    { zh: '棱位置', en: 'Position edges' },
  ] },
].map(stage => {
  const name = pickStickering('3x3', stage.mask, 'sim');
  const mask = name ? stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name) : null;
  const colors = stageStickerColors(3, mask, orientedCubeFaceColors('z2'));
  if (stage.mask === 'f2l') colors[4] = orientedCubeFaceColors('z2').U;
  return { ...stage, colors };
});

export default function IntroLesson() {
  return <div className="lbl-chapter-overview lbl-method-intro" aria-label={tr({ zh: '层先法整体介绍', en: 'About layer-by-layer solving' })}>
        <p><T zh="层先法（LBL），就是从下往上，一层一层复原魔方。" en="Layer-by-layer solving (LBL) solves the cube one layer at a time, from bottom to top." /></p>
        <div className="lbl-intro-route">
          {stages.map((stage, index) => <div className="lbl-intro-route-step" key={stage.title.en}>
            {index > 0 && <ArrowRight size={22} aria-hidden="true" style={{ gridColumn: index * 2, gridRow: 1 }} />}
            <figure style={{ gridColumn: index * 2 + 1, gridRow: 1 }}><VisualCube local view="iso" size={144} setup="" stickerColors={stage.colors} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]} alt={tr(stage.title)} />
              <figcaption>{tr(stage.title)}</figcaption></figure>
            {stage.steps.length > 0 && <div className="lbl-intro-substeps" style={{ gridColumn: index * 2 + 1, gridRow: 2 }}>
              <ArrowDown size={22} aria-hidden="true" />
              <ol aria-label={tr(stage.title)}>{stage.steps.map(item => <li key={item.en}>{tr(item)}</li>)}</ol>
            </div>}
          </div>)}
        </div>
  </div>;
}
