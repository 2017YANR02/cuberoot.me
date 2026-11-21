'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { Color } from 'three';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import TutorialCubeCallout from '../components/TutorialCubeCallout';
import { TUTORIAL_STICKER_PURPLE } from '../components/tutorial-colors';
import ConceptVideoHelp, { ConceptVideoScene, type ConceptVideoFrame } from './ConceptVideoHelp';
import { TWO_BY_TWO_ORIENTATION, TWO_BY_TWO_SAMPLE } from './lesson-data';

type Text = { zh: string; en: string };
type Fish = 'right' | 'left';
type Focus = 'head' | 'fins';
type Shot = { at: number; caption: Text } & (
  | { fish: Fish; focus?: Focus }
  | { fish: 'both' }
);

const [rightFish, leftFish] = TWO_BY_TWO_SAMPLE[1].sections;
const title = { zh: '辨识左鱼和右鱼', en: 'Recognize left and right fish' };
const grayAt = 2700;
const countAt = 5400;
const headAt = 9600;
const pulsePeriod = 920;
const headPauseAt = headAt + 2.5 * pulsePeriod;
const finsAt = headPauseAt + 800;
const orbitDuration = 6400;
const alignRightAt = finsAt + orbitDuration;
const rightTurnAt = alignRightAt + 650;
const showRightAt = rightTurnAt + 1000;
const alignLeftAt = showRightAt + 2800;
const leftTurnAt = alignLeftAt + 550;
const showLeftAt = leftTurnAt + 1000;
const compareAt = showLeftAt + 2900;
const duration = compareAt + 3400;
const turnDuration = 850;
const openingView = { x: Math.PI / 6, y: -Math.PI / 6, z: 0 };
const frontPitch = Math.PI / 5;
const countPitch = Math.PI * 0.31;
const frontYaw = -Math.PI / 10;
const graySticker = FM_FIXED_COLOR[FM_IGNORED]!;
const fullColors = stageStickerColors(2, null, orientedCubeFaceColors(TWO_BY_TWO_ORIENTATION));
const yellowSticker = fullColors[0];
const purple = new Color(TUTORIAL_STICKER_PURPLE);
const pulseColors = Array.from({ length: 17 }, (_, index) =>
  '#' + new Color(yellowSticker).lerp(purple, index / 16).getHexString());

const shots: readonly Shot[] = [
  { at: 0, fish: 'right',
    caption: { zh: '底层复原后，顶面只有一格黄，这就是小鱼', en: 'With the first layer solved, one yellow sticker on top makes a fish' } },
  { at: grayAt, fish: 'right',
    caption: { zh: '只看黄色，把其他颜色隐去', en: 'Look only at yellow and hide the other colors' } },
  { at: countAt, fish: 'right',
    caption: { zh: '看顶面，1 格黄、3 格灰，就是小鱼', en: 'On top, one yellow and three gray stickers make a fish' } },
  { at: headAt, fish: 'right', focus: 'head',
    caption: { zh: '顶面唯一的黄格叫鱼头', en: 'The only yellow sticker on top is the fish head' } },
  { at: finsAt, fish: 'right', focus: 'fins',
    caption: { zh: '顶层侧面的三格黄叫鱼鳍', en: 'The three yellow stickers on the sides are the fins' } },
  { at: alignRightAt, fish: 'right',
    caption: { zh: '转顶层，让鱼头靠前，正面也看到一片鱼鳍', en: 'Turn the top so the head is near you and one fin faces you' } },
  { at: showRightAt, fish: 'right',
    caption: { zh: '鱼头在左前，正面的鱼鳍在右，是右鱼', en: 'Front-left head and front-right fin make a right fish' } },
  { at: alignLeftAt, fish: 'left',
    caption: { zh: '换一个例子，仍然让鱼头靠前、鱼鳍朝前', en: 'Try another case. Bring the head and one fin to the front again' } },
  { at: showLeftAt, fish: 'left',
    caption: { zh: '鱼头在右前，正面的鱼鳍在左，是左鱼', en: 'Front-right head and front-left fin make a left fish' } },
  { at: compareAt, fish: 'both',
    caption: { zh: '正面鱼鳍在左是左鱼，在右是右鱼', en: 'Front fin on the left means left fish. On the right it means right fish' } },
];

function clipFor(section: typeof rightFish) {
  const setup = section.exercise.setup;
  const alignedSetup = section.guided.algorithm.demoSetup;
  const turn = alignedSetup.slice(setup.length).trim();
  // Highlight the same physical sticker even as it changes slots during a turn.
  const cube = new CubeData(2, Object.fromEntries(AllFaces.map(face => [face,
    Array.from({ length: 4 }, (_, index) => Face[face] + index),
  ])));
  for (const move of parseAlgorithm(setup)) cube.turn(move);
  const yellow = (face: Face) => cube.faces[face].filter((sticker: string) => sticker.startsWith('U')) as string[];
  const head = yellow(Face.U);
  const fins = AllFaces.filter(face => face !== Face.U && face !== Face.D).flatMap(yellow);
  for (const move of parseAlgorithm(turn)) cube.turn(move);
  return { setup, alignedSetup, turn, head, fins, frontFin: yellow(Face.F) };
}

const fishClips = { right: clipFor(rightFish), left: clipFor(leftFish) };

function transitionAt(time: number, start: number, duration: number) {
  const portion = Math.min(1, Math.max(0, (time - start) / duration));
  return portion * portion * (3 - 2 * portion);
}

function cameraAt(time: number, reducedMotion: boolean) {
  if (time < finsAt) {
    const tilt = reducedMotion ? Number(time >= countAt) : transitionAt(time, countAt + 250, 1400);
    return { x: openingView.x + (countPitch - openingView.x) * tilt, y: openingView.y + (frontYaw - openingView.y) * tilt };
  }
  if (time >= alignRightAt) return { x: frontPitch, y: frontYaw };

  const tilt = reducedMotion ? 1 : transitionAt(time, finsAt + 350, 480);
  const orbit = reducedMotion ? Math.floor(4 * (time - finsAt) / orbitDuration) / 4
    : transitionAt(time, finsAt + 600, orbitDuration - 1000);
  return { x: countPitch + (frontPitch - countPitch) * tilt, y: frontYaw + 2 * Math.PI * orbit };
}

function FishCube({ fish, time, playing, shot, seekVersion, reducedMotion, art }: {
  fish: Fish;
  time: number;
  playing: boolean;
  shot: Shot;
  seekVersion: number;
  reducedMotion: boolean;
  art: RefObject<HTMLDivElement | null>;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const requestedTurn = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const comparison = shot.fish === 'both';
  const active = comparison || shot.fish === fish;
  const focus = shot.fish === fish ? shot.focus : undefined;
  const clip = fishClips[fish];
  const turnAt = fish === 'right' ? rightTurnAt : leftTurnAt;
  const aligned = time >= (fish === 'right' ? showRightAt : showLeftAt);
  const turning = active && time >= turnAt && !aligned;
  const showFront = time >= alignRightAt;
  const shade = fish === 'left' || reducedMotion
    ? Number(fish === 'left' || time >= grayAt) : transitionAt(time, grayAt + 250, 1100);
  const headCue = shot.at === headAt;
  const focusedStickers = focus && (!headCue || time < headPauseAt) ? clip[focus] : undefined;
  const pulse = focusedStickers && (headCue || focus === 'fins');
  const phase = (time - shot.at) / pulsePeriod + (focus === 'fins' ? 0.5 : 0);
  const highlightColor = pulse && !reducedMotion
    ? pulseColors[Math.round(8 + 8 * Math.cos(phase * 2 * Math.PI))]
    : TUTORIAL_STICKER_PURPLE;
  const overrides = useMemo(() => {
    const gray = new Color(graySticker);
    return Object.fromEntries(fullColors.map((color, index) => {
      const id = Face[Math.floor(index / 4)] + index % 4;
      if (focusedStickers?.includes(id)) return [id, highlightColor];
      if (index < 4 || shade === 0) return [id, color];
      if (shade === 1) return [id, graySticker];
      return [id, '#' + new Color(color).lerp(gray, shade).getHexString()];
    }));
  }, [shade, focusedStickers, highlightColor]);
  const { x, y } = fish === 'right' ? cameraAt(time, reducedMotion) : { x: frontPitch, y: frontYaw };

  useEffect(() => {
    if (ready) player.current?.setSceneRotation?.({ x, y, z: 0 });
  }, [ready, x, y]);

  useEffect(() => {
    if (ready) player.current?.setAnimationPaused?.(!playing);
  }, [ready, playing]);

  useEffect(() => {
    const handle = player.current;
    if (!ready || !handle || aligned || requestedTurn.current === seekVersion) return;
    if (requestedTurn.current !== null) {
      const adapter = handle.getPlayer();
      if (adapter) adapter.timestamp = 0;
      requestedTurn.current = null;
    }
    if (turning && playing && !reducedMotion) {
      handle.playMove?.(0);
      requestedTurn.current = seekVersion;
    }
  }, [ready, aligned, turning, playing, seekVersion, reducedMotion]);

  const label = fish === 'left' ? leftFish.title : rightFish.title;
  const showCallouts = ready && active && aligned && !comparison;
  const headSide = fish === 'right' ? 'left' : 'right';
  return <figure className="concept-video-diagram" data-fish={fish} data-active={active} aria-hidden={!active}>
    <div className="concept-video-cube" aria-hidden="true">
      <AlgPlayer ref={player} puzzle="2x2" engine="sim" set="" alg={aligned ? '' : clip.turn}
        setup={aligned ? clip.alignedSetup : clip.setup} orientation={TWO_BY_TWO_ORIENTATION}
        sceneRot={openingView} stickerColorOverrides={overrides} moveDurationMs={turnDuration}
        interactionMode="none" controlMode="none" hideResetView onReady={() => setReady(true)} fillPane
        stageOverlay={showCallouts && <>
          <TutorialCubeCallout paneRef={art} side={headSide} player={player} targetStickers={clip.head}
            requireAnchor fontSize=".875rem">
            <T zh="鱼头" en="Head" />
          </TutorialCubeCallout>
          <TutorialCubeCallout paneRef={art} side={headSide === 'left' ? 'right' : 'left'}
            player={player} targetStickers={clip.frontFin} requireAnchor fontSize=".875rem">
            <T zh="鱼鳍" en="Fin" />
          </TutorialCubeCallout>
        </>} />
    </div>
    <figcaption style={{ visibility: showFront && active ? undefined : 'hidden' }}>
      <span><T zh="正面（F）" en="Front (F)" /></span>
      {comparison && <strong>{tr(label)}</strong>}
    </figcaption>
  </figure>;
}

function FishScene(frame: ConceptVideoFrame) {
  const art = useRef<HTMLDivElement>(null);
  const shot = shots.findLast(item => item.at <= frame.time) ?? shots[0];
  return <ConceptVideoScene compare={shot.fish === 'both'} caption={shot.caption} artRef={art}>
    {(['left', 'right'] as const).map(fish => <FishCube key={fish} fish={fish} shot={shot} art={art} {...frame} />)}
  </ConceptVideoScene>;
}

export default function FishRecognitionHelp() {
  return <ConceptVideoHelp title={title} duration={duration} scene={frame => <FishScene {...frame} />}
    label={{ zh: '辨识视频', en: 'Watch video' }} />;
}
