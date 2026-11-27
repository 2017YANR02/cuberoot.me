'use client';

import { useEffect, useRef, useState } from 'react';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import ConceptVideoHelp, { ConceptVideoScene } from '../2x2-lbl/ConceptVideoHelp';
import { BottomRecognitionDiagram, TopDiagram } from './diagrams';
import { EG_BOTTOM_ROW_LABELS, EG_SETS, EG_SHAPES, egCase, type EgCase } from './lesson-data';
import { egPalette, useEgOrientation } from './orientation';

const shotMs = 3600;
const openingView = { x: Math.PI / 6, y: Math.PI / 5, z: 0 };
const topFacelets = [0, 1, 2, 3];
const bottomExamples = EG_SETS.map(set => ({ ...set, setup: egCase(set.id, 'S+R').setup }));

function ObservationCube({ setup, orientation, bottom, time, reducedMotion }: {
  setup: string; orientation: string; bottom: boolean; time: number; reducedMotion: boolean;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const [ready, setReady] = useState(false);
  const progress = Math.min(1, Math.max(0, (time - 400) / (shotMs - 900)));
  const turn = reducedMotion ? Number(progress === 1) : progress * progress * (3 - 2 * progress);
  const endPitch = bottom ? -Math.PI / 7 : Math.PI / 3;
  const x = openingView.x + (endPitch - openingView.x) * turn;
  const y = openingView.y + Math.PI / 3 * turn;

  useEffect(() => {
    if (ready) player.current?.setSceneRotation?.({ x, y, z: 0 });
  }, [ready, x, y]);

  return <AlgPlayer ref={player} puzzle="2x2" engine="sim" set="" setup={setup} alg=""
    orientation={orientation} sceneRot={openingView} interactionMode="none" controlMode="none"
    hideResetView fillPane onReady={() => setReady(true)} />;
}

export default function GroupSelectionVideoHelp({ bottom, target }: { bottom: boolean; target: EgCase }) {
  const orientation = useEgOrientation();
  const top = egPalette(orientation).name('U');
  const shape = EG_SHAPES.find(item => item.id === target.shape)!;
  const label = bottom
    ? { zh: '底层示范', en: 'Bottom demo' }
    : { zh: '顶层示范', en: 'Top demo' };
  const opening = bottom
    ? { zh: '底面同色后，数四个侧面有几个底排的两格颜色相同',
      en: 'Once the bottom face is complete, count the side faces whose bottom two stickers match' }
    : { zh: `识别顶层形状时，只看${top.zh}格`, en: `Focus on the ${top.en} stickers to recognize the top shape` };
  const shots = bottom ? bottomExamples.map(({ id, name, setup }) => ({
    caption: { zh: `${EG_BOTTOM_ROW_LABELS[id].zh}，选 ${name}`,
      en: `${EG_BOTTOM_ROW_LABELS[id].en} means ${name}` },
    art: <BottomRecognitionDiagram setup={setup} />,
  })) : [{
    caption: { zh: `先数朝上的顶色格，这个盘面有 ${shape.count} 格`,
      en: `First count the ${top.en} stickers facing up. This cube has ${shape.count} on top` },
    art: <TopDiagram setup={target.setup} size={160} topOnly visibleFacelets={topFacelets} decorative />,
  }, {
    caption: { zh: `再看侧面的${top.zh}格，用这个形状对照各组的小图`,
      en: `Then look at the ${top.en} stickers on the sides and match the full pattern to a group diagram` },
    art: <TopDiagram setup={target.setup} size={160} topOnly decorative />,
  }];

  return <ConceptVideoHelp label={label} title={label} duration={(shots.length + 1) * shotMs}
    scene={({ time, reducedMotion }) => {
      const shot = shots[Math.min(shots.length - 1, Math.floor(time / shotMs) - 1)];
      return <ConceptVideoScene compare={false} caption={shot?.caption ?? opening}>
        <div className="concept-video-cube eg-selection-video-art" aria-hidden="true">
          {shot?.art ?? <ObservationCube setup={target.setup} orientation={orientation}
            bottom={bottom} time={time} reducedMotion={reducedMotion} />}
        </div>
      </ConceptVideoScene>;
    }} />;
}
