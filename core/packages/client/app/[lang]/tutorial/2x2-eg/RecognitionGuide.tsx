'use client';

import { Face } from '@cuberoot/visualcube';
import { T, tr } from '@/i18n/tr';
import { TopDiagram } from './diagrams';
import { recognitionFacelets, upperSideFacelets, type EgColorRelation, type RecognitionAnswer,
  type RecognitionCheck, type RecognitionExample, type RecognitionMethod } from './case-comparison';
import { egPalette, useEgOrientation, type EgColorName } from './orientation';

const relations: Record<EgColorRelation, { zh: string; en: string }> = {
  same: { zh: '同色', en: 'Same color' },
  adjacent: { zh: '邻色', en: 'Adjacent colors' },
  opposite: { zh: '对色', en: 'Opposite colors' },
};
const sideNames = {
  [Face.F]: { zh: '前面', en: 'front' }, [Face.R]: { zh: '右面', en: 'right' },
  [Face.L]: { zh: '左面', en: 'left' }, [Face.B]: { zh: '后面', en: 'back' },
};
const topPositions = [
  { zh: '左后', en: 'back-left' }, { zh: '右后', en: 'back-right' },
  { zh: '左前', en: 'front-left' }, { zh: '右前', en: 'front-right' },
];

function stickerName(sticker: number) {
  const face = Math.floor(sticker / 4) as Face.U | keyof typeof sideNames;
  const index = sticker % 4;
  if (face === Face.U) {
    const position = topPositions[index];
    return { zh: `顶面${position.zh}格`, en: `top ${position.en} sticker` };
  }
  const side = sideNames[face];
  return index === 0
    ? { zh: `${side.zh}顶排左格`, en: `${side.en} upper-left sticker` }
    : { zh: `${side.zh}顶排右格`, en: `${side.en} upper-right sticker` };
}

export function recognitionInstruction(check: RecognitionCheck, top: EgColorName) {
  if (check.kind === 'bars') return { zh: '数四个侧面顶排的同色棒。', en: 'Count the matching pairs in the upper side rows.' };
  if (check.kind === 'top-yellows') return { zh: `看顶面朝上的${top.zh}格在哪。`, en: `Check where the upward-facing ${top.en} stickers are.` };
  const [first, second] = check.pair;
  const face = Math.floor(first / 4) as Face.U | keyof typeof sideNames;
  if (face !== Face.U && face === Math.floor(second / 4)) {
    const side = sideNames[face];
    return { zh: `看${side.zh}顶排的两格。`, en: `Compare the two stickers in the ${side.en} upper row.` };
  }
  const a = stickerName(first);
  const b = stickerName(second);
  return { zh: `看${a.zh}和${b.zh}。`, en: `Compare the ${a.en} and the ${b.en}.` };
}

export function recognitionAnswer(answer: RecognitionAnswer, top: EgColorName) {
  if (typeof answer === 'number') return tr({ zh: `${answer} 条同色棒`, en: answer === 1 ? '1 matching pair' : `${answer} matching pairs` });
  if (!Array.isArray(answer)) return tr(relations[answer]);
  if (!answer.length) return tr({ zh: `顶面没有${top.zh}格`, en: `No ${top.en} stickers on top` });
  const positions = answer.map(index => topPositions[index]);
  return tr({ zh: `${top.zh}格在${positions.map(item => item.zh).join('、')}`, en: `${top.en} at ${positions.map(item => item.en).join(' and ')}` });
}

export function RecognitionReference({ anchor, bottomBar }: {
  anchor: RecognitionMethod['anchor']; bottomBar?: boolean;
}) {
  const top = egPalette(useEgOrientation()).name('U');
  return <p>
    {bottomBar && <T zh="先把底层的同色棒放在后面。" en="Keep the bottom bar at the back. " />}
    {anchor.kind === 'side'
      ? <T zh={`把顶排${anchor.relation === 'opposite' ? '对色' : '同色'}的一面摆在${sideNames[anchor.face].zh}。`}
          en={`Put the ${anchor.relation === 'opposite' ? 'opposite-color' : 'matching'} upper pair at the ${sideNames[anchor.face].en}.`} />
      : anchor.facelets.length === 4 && anchor.facelets.every(index => index < 4)
        ? <T zh={`${top.zh}面朝上。`} en={`Hold ${top.en} on top.`} />
        : <T zh={`把顶面和侧面的${top.zh}格对齐到图中的位置。`} en={`Match the ${top.en} stickers on the top and sides to the diagram.`} />}
    <T zh="图的下方是正面。" en=" The front is at the bottom of the diagram." />
  </p>;
}

export function RecognitionDiagram({ check, example, method, focused, keepReference = false, outlineStickers = true, size = 144 }: {
  check: RecognitionCheck; example: RecognitionExample; method: RecognitionMethod; focused: boolean;
  keepReference?: boolean; outlineStickers?: boolean; size?: number;
}) {
  const keyStickers = recognitionFacelets(check, example);
  const anchor = method.anchor;
  const visible = check.kind === 'bars' ? upperSideFacelets
    : anchor.kind === 'side' ? [...anchor.pair, ...keyStickers]
    : keepReference ? [...anchor.facelets, ...keyStickers] : keyStickers;
  const outline = outlineStickers ? keyStickers : undefined;
  if (focused && !outlineStickers) return <TopDiagram setup={example.setup} size={size} visibleFacelets={visible} />;
  return <div className="eg-case-compare-art" data-key-stickers-only={focused}>
    <span aria-hidden={focused}>
      <TopDiagram setup={example.setup} size={size} outlinedFacelets={outline} />
    </span>
    <span className="eg-case-compare-art-focused" aria-hidden={!focused}>
      <TopDiagram setup={example.setup} size={size} outlinedFacelets={outline} visibleFacelets={visible} />
    </span>
  </div>;
}
