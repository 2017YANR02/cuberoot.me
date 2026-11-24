'use client';

import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Check } from '@app-foundation/icons/lucide';
import { MathUtils } from 'three';
import type { AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import TutorialCubeCallout from '../components/TutorialCubeCallout';
import { FirstLayerVideo, VideoCube, VideoScene } from './RecognitionVideo';
import {
  FL_LAST_STICKERS, FL_RECOGNITION_EXAMPLES, FL_REFERENCE_STICKERS, FL_TWISTS, FL_VIEWS,
  createFlAlignmentDemo, flCaseGroups, type FlChapter,
} from './lesson-data';

export const alignmentVideoLabel = { zh: '摆位示范', en: 'Alignment demo' };

const turnMs = 1050; // Leave time for the full animation of a half turn.
const introMs = 3300;
const slotPreviewMs = 650;
const slotPreviewMoves = ['U', 'U', 'U'];
const introTitle = { zh: '正确的起手位', en: 'Correct starting position' };
const thirdTitle = { zh: '摆第三角块', en: 'Place the third corner' };
const fourthTitle = { zh: '摆第四角块', en: 'Place the fourth corner' };
const alreadyAligned = { zh: '已经摆对了', en: 'Already aligned' };
const aligned = { zh: '摆对了', en: 'Aligned' };
const allowedPosition = { zh: '这个位置可以', en: 'This position works' };
const anotherAllowedPosition = { zh: '这个位置也可以', en: 'This position also works' };

function cornerCallout(paneRef: RefObject<HTMLDivElement | null>, corner: 'third' | 'fourth', message: ReactNode) {
  if (!message) return undefined;
  const third = corner === 'third';
  return (player: RefObject<AlgPlayerHandle | null>) =>
    <TutorialCubeCallout className="fl-corner-callout fl-alignment-callout" paneRef={paneRef}
      side={third ? 'left' : 'right'} player={player} cubeRadiusRatio={.27}
      targetStickers={third ? FL_REFERENCE_STICKERS : FL_LAST_STICKERS}>
      {message}
    </TutorialCubeCallout>;
}

type DemoProps = { chapter: FlChapter; orientation: string };

function ThirdCornerDemo({ chapter, orientation }: DemoProps) {
  const top = chapter === 'top';
  const [example] = useState(() => createFlAlignmentDemo(top ? 'top' : 'mixed'));
  const cubePane = useRef<HTMLDivElement>(null);
  const exampleAt = introMs + (top ? slotPreviewMs * slotPreviewMoves.length : 0);
  const turnAt = exampleAt + 1800;
  const confirmedAt = turnAt + turnMs;
  const move = example.moves[0];
  const scene = top ? FL_VIEWS.top : FL_VIEWS.mixed;
  const intro = top
    ? { zh: '第三角块在顶层左前，左侧角对保持归位', en: 'The third corner is at top front-left. The left pair stays solved.' }
    : { zh: '第三角块在底层右前，左侧角对保持归位', en: 'The third corner is at bottom front-right. The left pair stays solved.' };
  const turn = top
    ? { zh: `这个例子转 ${move}，把第三角块摆到顶层左前`, en: `In this example, turn ${move} to bring the third corner to top front-left.` }
    : { zh: '第三角块在底层右后，转 R 把它摆到底层右前', en: 'The third corner is at bottom back-right. Turn R to bring it to bottom front-right.' };
  const done = top
    ? { zh: '第三角块已到顶层左前', en: 'The third corner is now at top front-left.' }
    : { zh: '第三角块已到底层右前', en: 'The third corner is now at bottom front-right.' };

  return <FirstLayerVideo label={alignmentVideoLabel} length={confirmedAt + introMs} renderScene={({ time, ...playback }) => {
    const opening = time < introMs;
    const playingExample = time >= exampleAt;
    const confirmed = time >= confirmedAt;
    const step = playingExample ? Number(time >= turnAt) : opening ? 0 : 1 + Math.floor((time - introMs) / slotPreviewMs);
    const caption = opening ? intro : confirmed ? done : playingExample ? turn : {
      zh: '第三角块在这三个位置时，转顶层就能把它摆到左前',
      en: 'From any of these three slots, a top turn brings the third corner to front-left.',
    };
    const bubble = opening ? <T {...alreadyAligned} /> : confirmed
      ? <Check size={18} aria-label={tr(aligned)} role="img" />
      : top && playingExample && time < turnAt ? <T zh="第三角块" en="Third corner" /> : null;
    return <VideoScene title={opening ? introTitle : thirdTitle} caption={<T {...caption} />} cubePane={cubePane}
      cube={<VideoCube key={playingExample ? 'example' : 'preview'}
        setup={playingExample ? example.setup : example.end.setup}
        alg={playingExample ? move : top ? slotPreviewMoves.join(' ') : ''}
        step={step} scene={scene} orientation={orientation} dimmedStickers={FL_LAST_STICKERS} dimOpacity={1}
        {...playback} reducedMotion={playback.reducedMotion || !playingExample}
        renderOverlay={cornerCallout(cubePane, 'third', bubble)} />} />;
  }} />;
}

const topLiftSetup = FL_RECOGNITION_EXAMPLES[0].end.setup + " R'";
const [ud, dd] = flCaseGroups('bottom', FL_TWISTS[0]).map(({ cases }) => cases[0].setup);
const udAlignSetup = ud + " U'";
const firstTurnAt = 3400;
const firstConfirmedAt = firstTurnAt + turnMs;
const secondAt = firstConfirmedAt + 2400;
const secondTurnAt = secondAt + 1500;
const secondConfirmedAt = secondTurnAt + turnMs;

function FourthCornerDemo({ chapter, orientation }: DemoProps) {
  const top = chapter === 'top';
  const cubePane = useRef<HTMLDivElement>(null);
  return <FirstLayerVideo label={alignmentVideoLabel} length={(top ? secondConfirmedAt : secondAt) + introMs}
    renderScene={({ time, ...playback }) => {
      const second = time >= secondAt;
      const showingDD = second && !top;
      const resetting = second && top && time < secondTurnAt;
      const confirmed = showingDD ? time >= secondAt + 280 : time >= (second ? secondConfirmedAt : firstConfirmedAt);
      const step = showingDD ? 0 : second ? (resetting ? 2 : 3) : Number(time >= firstTurnAt);
      const dimFourth = playback.reducedMotion ? 0 : Math.max(
        1 - MathUtils.smoothstep(time, 0, 850),
        top ? 0 : 1 - MathUtils.smoothstep(Math.abs(time - secondAt), 0, 280),
      );
      let caption;
      if (showingDD) {
        caption = { zh: '第四角块在底层右后（DD），保持原位', en: 'For DD, leave the fourth corner at bottom back-right.' };
      } else if (!top) {
        caption = confirmed
          ? { zh: '第四角块在第三角块正上方，这是 UD 的起手位', en: 'The fourth corner is directly above the third. This is the UD starting position.' }
          : { zh: '第四角块在顶层（UD），转 U 把它摆到第三角块正上方', en: 'For UD, turn U to bring the fourth corner directly above the third.' };
      } else if (second) {
        caption = confirmed
          ? { zh: '第四角块到了顶层右后，这个位置也符合起手要求', en: 'The fourth corner is at top back-right, another valid starting position.' }
          : { zh: '从同一个起手位转 R2，把第四角块提到顶层右后', en: 'From the same starting position, turn R2 to lift the fourth corner to top back-right.' };
      } else {
        caption = confirmed
          ? { zh: '第四角块到了顶层右前，第三角块仍在顶层左前', en: 'The fourth corner is at top front-right. The third stays at top front-left.' }
          : { zh: '转 R，把第四角块从底层提到顶层右前', en: 'Turn R to lift the fourth corner from the bottom layer to top front-right.' };
      }
      return <VideoScene title={fourthTitle} caption={<T {...caption} />} cubePane={cubePane}
        cube={<VideoCube setup={top ? topLiftSetup : showingDD ? dd : udAlignSetup}
          alg={top ? "R R' R2" : showingDD ? '' : 'U'}
          step={step} scene={FL_VIEWS.mixed} orientation={orientation}
          dimmedStickers={FL_LAST_STICKERS} dimOpacity={dimFourth}
          {...playback} reducedMotion={playback.reducedMotion || resetting}
          renderOverlay={cornerCallout(cubePane, 'fourth',
            confirmed ? <T {...(second ? anotherAllowedPosition : allowedPosition)} /> : null)} />} />;
    }} />;
}

export default function AlignmentVideo({ chapter, orientation, corner }: DemoProps & { corner: 'third' | 'fourth' }) {
  return corner === 'third' ? <ThirdCornerDemo chapter={chapter} orientation={orientation} />
    : <FourthCornerDemo chapter={chapter} orientation={orientation} />;
}
