'use client';

import { useMemo } from 'react';
import { Axis, buildSimpleOptions, renderCubeSVG } from '@cuberoot/visualcube';
import { stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { tr } from '@/i18n/tr';
import { MIDDLE_LEFT_SETUP, MIDDLE_RIGHT_SETUP } from './content';

/** Use the existing cube renderer's sticker-to-sticker arrows, including camera projection. */
export function MiddleCaseDiagram({ left = false, size = 200 }: { left?: boolean; size?: number }) {
  const svg = useMemo(() => renderCubeSVG({
    ...buildSimpleOptions({ view: 'iso', size, sch: 'yogwrb', setup: left ? MIDDLE_LEFT_SETUP : MIDDLE_RIGHT_SETUP }),
    stickerColors: stageStickerColors(3, stickeringMaskFn(3, 'F2L'), orientedCubeFaceColors('z2')),
    viewportRotations: [[Axis.Y, left ? -30 : 30], [Axis.X, -30]],
    // The renderer projects every arrow point through the first sticker's face, so
    // the arrow stays on F: from the top edge's front sticker down to its slot.
    arrows: left ? 'F1F3-s8' : 'F1F5-s8',
    defaultArrowColor: 'white',
  }), [left, size]);
  return <span className="puzzle-art" role="img" aria-label={left
    ? tr({ zh: '顶层棱进入左侧槽', en: 'The top edge goes into the left slot' })
    : tr({ zh: '顶层棱进入右侧槽', en: 'The top edge goes into the right slot' })}
    style={{ display: 'inline-block', width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function MiddleCases() {
  return <div className="lbl-middle-core">
    <div className="lbl-middle-core-cases">
      {[false, true].map(left => <figure key={String(left)}>
        <MiddleCaseDiagram left={left} />
        <figcaption><strong>{left ? tr({ zh: '去左', en: 'Insert left' }) : tr({ zh: '去右', en: 'Insert right' })}</strong>
          <span>{left ? tr({ zh: '三楼的绿红棱要移到左下方的二楼，叫去左', en: 'Moving the green-red edge from the third floor down to the second floor on the left is called inserting left.' })
            : tr({ zh: '三楼的绿橙棱要移到右下方的二楼，叫去右', en: 'Moving the green-orange edge from the third floor down to the second floor on the right is called inserting right.' })}</span>
        </figcaption>
      </figure>)}
    </div>
  </div>;
}
