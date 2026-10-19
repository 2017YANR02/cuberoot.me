'use client';

import { useState } from 'react';
import { Axis, type ICubeOptions } from '@cuberoot/visualcube';
import { FM_IGNORED, FM_REGULAR } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { VisualCube } from '@/components/VisualCube';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { tr, T } from '@/i18n/tr';
import { getLblAlgGroups } from './alg-cues';

export const BASIC_GUIDE_TOPICS = [
  { id: 'layers', title: { zh: '认楼层', en: 'The layers' } },
  { id: 'moves', title: { zh: '怎么转', en: 'How to turn' } },
] as const;
const colors = orientedCubeFaceColors('z2');
const leftView: NonNullable<ICubeOptions['viewportRotations']> = [[Axis.Y, -30], [Axis.X, -25]];
const rightScene = { x: 25 * Math.PI / 180, y: -30 * Math.PI / 180, z: 0 };
const leftScene = { ...rightScene, y: -rightScene.y };
const layers = [
  { height: 2, title: { zh: '三楼', en: 'Third floor' }, name: { zh: '顶层', en: 'Top layer' } },
  { height: 1, title: { zh: '二楼', en: 'Second floor' }, name: { zh: '中层', en: 'Middle layer' } },
  { height: 0, title: { zh: '一楼', en: 'First floor' }, name: { zh: '底层', en: 'Bottom layer' } },
].map(layer => ({
  ...layer,
  // The renderer's solved-piece index is x + y * 3 + z * 9.
  colors: stageStickerColors(3, piece => Math.floor(piece / 3) % 3 === layer.height ? FM_REGULAR : FM_IGNORED, colors),
}));
const faces = [
  { base: 'R', move: 'R', divisor: 1, layer: 2, title: { zh: '右层', en: 'Right layer' } },
  { base: 'L', move: 'L', divisor: 1, layer: 0, title: { zh: '左层', en: 'Left layer' } },
  { base: 'U', move: 'U', divisor: 3, layer: 2, title: { zh: '顶层', en: 'Top layer' } },
  { base: 'F', move: 'F', divisor: 9, layer: 2, title: { zh: '前层', en: 'Front layer' } },
].map(face => ({
  ...face,
  colors: stageStickerColors(3, piece => Math.floor(piece / face.divisor) % 3 === face.layer ? FM_REGULAR : FM_IGNORED, colors),
}));
const variants = [
  { suffix: '', title: { zh: '转一下', en: 'One quarter-turn' }, detail: { zh: '顺时针 90°', en: 'Clockwise 90°' } },
  { suffix: "'", title: { zh: '反着转一下', en: 'Turn the other way' }, detail: { zh: '′：逆时针 90°', en: '′: counterclockwise 90°' } },
  { suffix: '2', title: { zh: '转两下', en: 'Two quarter-turns' }, detail: { zh: '2：半圈，180°', en: '2: a half-turn, 180°' } },
];

function ColorDot({ color }: { color: string }) {
  return <span className="lbl-guide-color" style={{ backgroundColor: color }} aria-hidden="true" />;
}

export default function BasicsGuide({ section }: { section: typeof BASIC_GUIDE_TOPICS[number]['id'] }) {
  const [move, setMove] = useState('R');
  const [playRequest, setPlayRequest] = useState(0);
  const face = faces.find(item => item.base === move[0]) ?? faces[0];
  const cue = getLblAlgGroups('structure', move.endsWith('2') && move !== 'U2' ? face.base : move)[0][0].cue;
  const operation = move === 'U' ? { zh: '勾', en: 'Hook' }
    : move === "U'" ? { zh: '回', en: 'Back' }
    : move.endsWith('2') && move !== 'U2' ? { zh: `${cue.zh}${cue.zh}`, en: `${cue.en} twice` }
      : cue;
  const selectMove = (nextMove: string) => {
    setMove(nextMove);
    setPlayRequest(request => request + 1);
  };
  return <div className="lbl-basics-guide">
    <div id="lbl-guide-content" className="lbl-guide-content">
      {section === 'layers' && <div className="lbl-guide-layers">
        <h3><T zh="从下往上，一二三楼" en="Count up from the bottom" /></h3>
        <div className="lbl-guide-floor-grid">
          {layers.map(layer => <figure key={layer.height}>
            <VisualCube local view="iso" stickerColors={layer.colors} size={160} alt={`${tr(layer.title)} · ${tr(layer.name)}`} />
            <figcaption><strong>{tr(layer.title)}</strong><span>{tr(layer.name)}</span></figcaption>
          </figure>)}
        </div>
        <p className="lbl-guide-basement"><ColorDot color={colors.D} /><T zh="底面叫“地下室”，白色朝下。" en="The bottom face is the “basement”, with white facing down." /></p>
      </div>}
      {section === 'moves' && <div className="lbl-guide-moves">
        <div className="lbl-guide-move-preview">
          <div className="lbl-guide-player">
            <AlgPlayer key={move} puzzle="3x3" engine="sim" set="" alg={move} startSolved orientation="z2" sceneRot={face.base === 'L' ? leftScene : rightScene} controlMode="none" hideResetView autoPlay playRequest={playRequest} fillPane moveDurationMs={1350} />
          </div>
          <p className="lbl-guide-current-move" aria-live="polite"><code>{move.replace("'", '′')}</code>{tr(operation)}</p>
        </div>
        <div className="lbl-guide-move-copy">
          <div className="lbl-guide-face-grid" role="group" aria-label={tr({ zh: '选择要观察的面', en: 'Choose a face to watch' })}>
            {faces.map(item => <button className="lbl-button" type="button" key={item.base} aria-label={tr(item.title)} aria-pressed={face.base === item.base} onClick={() => selectMove(face.base === item.base ? move : item.move)}>
              <VisualCube local view="iso" stickerColors={item.colors} viewportRotations={item.base === 'L' ? leftView : undefined} size={76} alt={tr(item.title)} />
              <span>{tr(item.title)}</span>
            </button>)}
          </div>
          <p className="lbl-guide-direction"><T zh="顺时针 / 逆时针：正对正在转的面判断。" en="Judge clockwise or counterclockwise by looking straight at the face you are turning." /></p>
          <div className="lbl-guide-variants" role="group" aria-label={tr({ zh: '选择转动方式', en: 'Choose a turn' })}>
            {variants.map(variant => <button className="lbl-button" type="button" key={variant.suffix} aria-pressed={move === face.base + variant.suffix} onClick={() => selectMove(face.base + variant.suffix)}>
              <span><code>{face.base}{variant.suffix.replace("'", '′')}</code></span>
              <strong>{tr(variant.title)}</strong><small>{tr(variant.detail)}</small>
            </button>)}
          </div>
        </div>
      </div>}
    </div>
    {section === 'moves' && <div className="lbl-guide-extra">
      <p><code>y / y′</code><T zh="整颗魔方左 / 右转体" en="Rotate the whole cube left / right" /></p>
      <p><code>f / f′</code><T zh="前面两层一起压 / 提" en="Lower / lift the front two layers together" /></p>
    </div>}
  </div>;
}
