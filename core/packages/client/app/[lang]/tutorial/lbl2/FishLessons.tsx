import { Alg } from 'cubing/alg';
import { VisualCube } from '@/components/VisualCube';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { FM_FIXED_COLOR, FM_IGNORED, mergeStickeringMaskFns, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { T, tr } from '@/i18n/tr';
import { LESSON_STICKERING, RIGHT_SUNE } from './content';
import { ALG_LESSONS } from './alg-lessons';
const suneName = pickStickering('3x3', LESSON_STICKERING['yellow-face'], 'sim');
const SUNE_THUMB_COLORS = stageStickerColors(3, mergeStickeringMaskFns([
  suneName ? stickeringMaskFn(3, suneName) ?? resolveStageMaskFn(3, suneName) : null,
  stickeringMaskFn(3, 'F2L'),
]), orientedCubeFaceColors('z2'));
export function FishOverview() {
  const setup = new Alg(RIGHT_SUNE).invert().toString();
  return <div className="lbl-middle-core lbl-fish-intro">
    <div className="lbl-middle-core-cases lbl-fish-parts">
      <figure>
        <VisualCube local stickerColors={SUNE_THUMB_COLORS} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!}
          view="plan" scheme="yogwrb" size={220} setup={setup} outlinedFacelets={[1, 3, 4, 5, 6, 7]}
          alt={tr({ zh: '顶面平面图，圈出组成小鱼的全部黄色格', en: 'Top view highlighting all yellow stickers forming the fish' })} />
        <figcaption><strong><T zh="小鱼" en="Fish" /></strong>
          <span><T zh="顶面的黄色格组成小鱼" en="The yellow stickers on top form a fish" /></span></figcaption>
      </figure>
      <figure>
        <VisualCube local stickerColors={SUNE_THUMB_COLORS} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!}
          view="plan" scheme="yogwrb" size={220} setup={setup} outlinedFacelets={[6]}
          alt={tr({ zh: '顶面平面图，圈出唯一朝黄的角格', en: 'Top view highlighting the only yellow corner on top' })} />
        <figcaption><strong><T zh="鱼头" en="Fish head" /></strong>
          <span><T zh="顶面唯一朝黄的角格" en="The only yellow corner sticker on top" /></span></figcaption>
      </figure>
      <figure>
        <VisualCube local stickerColors={SUNE_THUMB_COLORS} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!}
          view="plan" scheme="yogwrb" size={220} setup={setup} outlinePlanSides outlinedFacelets={[11, 20, 47]}
          alt={tr({ zh: '俯视图，圈出侧面的黄色角格', en: 'Top view highlighting the yellow corner stickers on the sides' })} />
        <figcaption><strong><T zh="鱼鳍" en="Fish fins" /></strong>
          <span><T zh="侧面的黄色角格" en="The yellow corner stickers on the sides" /></span></figcaption>
      </figure>
    </div>
  </div>;
}

export function FishRecognition() {
  const lesson = ALG_LESSONS.find(item => item.id === 'sune-learning')!;
  return <div className="lbl2-fish-recognition">
    <p className="lbl2-fish-recognition-rule"><T zh="先同时保证鱼头靠前且有鱼鳍朝前" en="First make sure the head is near the front and a fin faces forward." /></p>
    {lesson.algs.map(item => <figure key={item.alg}>
      <div className="lbl2-fish-views">
        <VisualCube local view="plan" size={200} setup={new Alg(item.alg).invert().toString()} stickerColors={SUNE_THUMB_COLORS}
          stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!} outlinePlanSides outlinedFacelets={item.left ? [8, 18] : [6, 20]} alt={tr(item.title)} />
      </div>
      <figcaption>
        <strong className="lbl2-direction-emphasis">{tr(item.title)}</strong>
        <p>{tr(item.naming)}</p>
      </figcaption>
    </figure>)}
  </div>;
}

export function FishThumbnail() {
  const colors = Array.from({ length: 54 }, (_, index) => [1, 3, 4, 5, 6, 7].includes(index)
    ? orientedCubeFaceColors('z2').U : FM_FIXED_COLOR[FM_IGNORED]!);
  return <VisualCube local view="plan" size={52} stickerColors={colors} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!} alt="" />;
}

