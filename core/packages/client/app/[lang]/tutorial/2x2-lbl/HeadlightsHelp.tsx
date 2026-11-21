'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { Color } from 'three';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { tr } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';
import { TUTORIAL_STICKER_PURPLE } from '../components/tutorial-colors';
import ConceptVideoHelp, { ConceptVideoScene, type ConceptVideoFrame } from './ConceptVideoHelp';
import { TWO_BY_TWO_ORIENTATION, TWO_BY_TWO_SAMPLE } from './lesson-data';

const [headlights, noHeadlights] = TWO_BY_TWO_SAMPLE[2].sections;
const title = { zh: '什么是眼？', en: 'What are headlights?' };
const eyeFocusAt = 3000;
const noEyesAt = 7200;
const compareAt = 13900;
const duration = 18900;
const openingView = { x: Math.PI / 6, y: -Math.PI / 9, z: 0 };
const eyesAtFront = `${headlights.exercise.setup} y2`;
const shots = [
  { at: 0, caption: { zh: '顶面全黄以后，观察四个侧面的顶排。', en: 'Once the top is all yellow, look at the top row of each side.' } },
  { at: eyeFocusAt, caption: { zh: '同一侧面的顶排，两格颜色相同，就是一对眼。', en: 'Two matching stickers in the top row of the same side make a pair of headlights.' } },
  { at: noEyesAt, caption: { zh: '绕一圈看。如果每个侧面的顶排都是两种颜色，就是无眼。', en: 'Look around all four sides. If every top row has two different colors, there are no headlights.' } },
  { at: compareAt, caption: { zh: '有眼就把眼放右。无眼就先做一次公式造眼。', en: 'Put headlights on the right. If there are none, do the algorithm once to make them.' } },
];

// Record the home identities of the two front stickers so the player colors only that pair.
const stickerIds = new CubeData(2, Object.fromEntries(AllFaces.map(face => [face,
  Array.from({ length: 4 }, (_, index) => Face[face] + index),
])));
for (const move of parseAlgorithm(eyesAtFront)) stickerIds.turn(move);
const frontEyes = stickerIds.faces[Face.F].slice(0, 2) as string[];
const colors = orientedCubeFaceColors(TWO_BY_TWO_ORIENTATION);
const purple = new Color(TUTORIAL_STICKER_PURPLE);

function ease(progress: number) {
  const fraction = Math.min(1, Math.max(0, progress));
  return fraction * fraction * (3 - 2 * fraction);
}

function HeadlightsCube({ hasEyes, time, compare, reducedMotion }: {
  hasEyes: boolean;
  time: number;
  compare: boolean;
  reducedMotion: boolean;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const [ready, setReady] = useState(false);
  const active = compare || (hasEyes ? time < noEyesAt : time >= noEyesAt);
  const focus = compare ? 1 : reducedMotion ? Number(time >= eyeFocusAt) : ease((time - eyeFocusAt) / 450);
  const orbit = (time - noEyesAt - 500) / (compareAt - noEyesAt - 900);
  const yaw = !hasEyes && active && !compare
    ? openingView.y + 2 * Math.PI * (reducedMotion ? Math.floor(Math.min(.99, Math.max(0, orbit)) * 4) / 4 : ease(orbit))
    : openingView.y * (1 - .55 * focus);
  const pitch = hasEyes ? openingView.x - .17 * focus : openingView.x;
  const overrides = useMemo(() => hasEyes && focus > 0 ? Object.fromEntries(frontEyes.map(sticker => [
    sticker, '#' + new Color(colors[sticker[0] as CubeFace]).lerp(purple, focus).getHexString(),
  ])) : undefined, [hasEyes, focus]);

  useEffect(() => {
    if (ready && active) player.current?.setSceneRotation?.({ x: pitch, y: yaw, z: 0 });
  }, [ready, active, pitch, yaw]);

  return <figure className="concept-video-diagram" data-active={active} aria-hidden={!active}>
    <div className="concept-video-cube" aria-hidden="true">
      <AlgPlayer ref={player} puzzle="2x2" engine="sim" set="" alg=""
        setup={hasEyes ? eyesAtFront : noHeadlights.exercise.setup} orientation={TWO_BY_TWO_ORIENTATION}
        sceneRot={openingView} stickerColorOverrides={overrides}
        interactionMode="none" controlMode="none" hideResetView onReady={() => setReady(true)} fillPane />
    </div>
    <figcaption style={{ visibility: compare ? undefined : 'hidden' }}>
      <strong>{tr(hasEyes ? headlights.title : noHeadlights.title)}</strong>
    </figcaption>
  </figure>;
}

function headlightsScene({ time, reducedMotion }: ConceptVideoFrame) {
  const compare = time >= compareAt;
  const shot = shots.findLast(item => item.at <= time) ?? shots[0];
  return <ConceptVideoScene compare={compare} caption={shot.caption}>
    <HeadlightsCube hasEyes time={time} compare={compare} reducedMotion={reducedMotion} />
    <HeadlightsCube hasEyes={false} time={time} compare={compare} reducedMotion={reducedMotion} />
  </ConceptVideoScene>;
}

export default function HeadlightsHelp() {
  return <ConceptVideoHelp title={title} duration={duration} scene={headlightsScene} label={title} />;
}
