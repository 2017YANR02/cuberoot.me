'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { MathUtils } from 'three';
import { Settings } from '@app-foundation/icons/lucide';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { dimStickerColors } from '@/components/AlgPlayer/sticker-hint-fade';
import { T, tr } from '@/i18n/tr';
import { CUBE_FRAMING_EDGE } from '../components/InteractiveTutorial';
import ReadingFit from '../components/ReadingFit';
import TutorialCubeCallout from '../components/TutorialCubeCallout';
import VideoProgress from '../components/VideoProgress';
import {
  FL_CASES, FL_CHAPTERS, FL_LAST_STICKERS, FL_RECOGNITION_EXAMPLES, FL_REFERENCE_STICKERS, FL_TWISTS, FL_VIEWS,
  FL_WGO_HOME, FL_WRG_HOME, flBottomColorDirection, flFirstLayerMask, flPalette, flSectionHeading, flSectionId, type FlChapter,
} from './lesson-data';
import { FL_LEFT_BACK, FL_LEFT_FRONT } from './left-pair';

const turnDuration = 650;
const layerSceneDuration = 4200;
const layerExamples = {
  top: FL_RECOGNITION_EXAMPLES[0].setup,
  bottom: FL_RECOGNITION_EXAMPLES[1].end.setup,
};

type Text = { zh: string; en: string };
export type PlaybackFrame = {
  time: number;
  playing: boolean;
  seekVersion: number;
  reducedMotion: boolean;
};

export function VideoCube({ setup, alg, step, scene, dimmedStickers, dimOpacity = 0, calloutPane, settingsOpacity = 0,
  colors, renderOverlay,
  playing, seekVersion, reducedMotion, orientation }: {
  setup: string;
  alg: string;
  step: number;
  scene: (typeof FL_VIEWS)[keyof typeof FL_VIEWS];
  dimmedStickers?: readonly string[];
  dimOpacity?: number;
  calloutPane?: RefObject<HTMLDivElement | null>;
  settingsOpacity?: number;
  colors?: Readonly<Record<string, string>>;
  renderOverlay?: (player: RefObject<AlgPlayerHandle | null>) => ReactNode;
  orientation: string;
} & Omit<PlaybackFrame, 'time'>) {
  const player = useRef<AlgPlayerHandle>(null);
  const [ready, setReady] = useState(false);
  const [initialScene] = useState(scene);
  const lastFrame = useRef({ step: 0, seekVersion, initialized: false });
  const stickerColorOverrides = useMemo(() => dimmedStickers && dimOpacity > 0
    ? { ...colors, ...dimStickerColors(dimmedStickers, orientation, dimOpacity) } : colors, [colors, dimmedStickers, dimOpacity, orientation]);
  useEffect(() => {
    const handle = player.current;
    if (!ready || !handle) return;
    const previous = lastFrame.current;
    const continuous = previous.initialized && previous.seekVersion === seekVersion;
    if (continuous && step === previous.step) return;
    if (continuous && playing && !reducedMotion && step === previous.step + 1) {
      handle.playMove?.(step - 1);
    } else {
      const adapter = handle.getPlayer();
      if (adapter) adapter.timestamp = step;
    }
    lastFrame.current = { step, seekVersion, initialized: true };
  }, [playing, ready, reducedMotion, seekVersion, step]);

  useEffect(() => {
    if (ready) player.current?.setAnimationPaused?.(!playing);
  }, [playing, ready]);
  useEffect(() => {
    if (ready) player.current?.setSceneRotation?.(scene);
  }, [ready, scene]);
  const settingsStyle = settingsOpacity > 0 ? { '--fl-settings-opacity': settingsOpacity } as CSSProperties : undefined;
  return <div className="course-cube" data-course-cube data-ready={ready}
    data-settings-transition={settingsStyle ? '' : undefined} style={settingsStyle}>
    <AlgPlayer ref={player} puzzle="2x2" engine="sim" set="" setup={setup} alg={alg}
      orientation={orientation} sceneRot={initialScene} controlMode="none" interactionMode="none" lockView hideResetView
      fillPane maxFramingEdge={CUBE_FRAMING_EDGE} moveDurationMs={turnDuration} stickeringAtStep={flFirstLayerMask}
      stickerColorOverrides={stickerColorOverrides}
      stageOverlay={ready && <>
        {renderOverlay?.(player)}
        {calloutPane && <>
          <TutorialCubeCallout className="fl-corner-callout" paneRef={calloutPane} side="left" player={player} cubeRadiusRatio={.31}
            targetStickers={FL_REFERENCE_STICKERS} requireAnchor>
            <T zh="第三角块" en="Third corner" />
          </TutorialCubeCallout>
          <TutorialCubeCallout className="fl-corner-callout" paneRef={calloutPane} side="right" player={player} cubeRadiusRatio={.31}
            targetStickers={FL_LAST_STICKERS} requireAnchor>
            <T zh="第四角块" en="Fourth corner" />
          </TutorialCubeCallout>
        </>}
      </>}
      onReady={() => setReady(true)} />
    {settingsStyle && <div className="fl-settings-illustration" aria-hidden="true">
      <Settings strokeWidth={1.5} />
    </div>}
  </div>;
}

export function VideoScene({ cube, title, caption, cubePane }: {
  cube: ReactNode;
  title: Text;
  caption: ReactNode;
  cubePane?: RefObject<HTMLDivElement | null>;
}) {
  return <div className="course-grid">
    <div className="course-cube-column" ref={cubePane}>
      {cube}
    </div>
    <div className="course-caption tutorial-single-caption">
      <ReadingFit pane layout="A">
        <div className="course-copy fl-video-caption" aria-live="polite" aria-atomic="true">
          <h2><T {...title} /></h2>
          <p>{caption}</p>
        </div>
      </ReadingFit>
    </div>
  </div>;
}

export function FirstLayerVideo({ label, length, renderScene }: {
  label: Text;
  length: number;
  renderScene: (frame: PlaybackFrame) => ReactNode;
}) {
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [playing, setPlaying] = useState(!reducedMotion);
  const [time, setTime] = useState(0);
  const [seekVersion, setSeekVersion] = useState(0);
  const clock = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      if (!document.hidden) {
        clock.current = Math.min(length, clock.current + Math.min(50, Math.max(0, now - previous)));
        setTime(clock.current);
      }
      previous = now;
      if (clock.current < length) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [length, playing]);

  const seek = (next: number) => {
    clock.current = next;
    setTime(next);
    setSeekVersion(version => version + 1);
  };
  return <section className="fl-recognition-video" aria-label={tr(label)} data-tutorial-mode="timeline">
    <div className="course-stage" data-course-stage data-tutorial-layout="A">
      {renderScene({ time, playing, seekVersion, reducedMotion })}
    </div>
    <VideoProgress time={time} duration={length} playing={playing} onPlayingChange={setPlaying}
      onSeek={seek} onReplay={() => seek(0)} />
  </section>;
}

export default function RecognitionVideo({ orientation }: { orientation: string }) {
  const { reference } = flPalette(orientation);
  return <FirstLayerVideo label={{ zh: '识别视频', en: 'Recognition video' }} length={2 * layerSceneDuration}
    renderScene={({ time, ...playback }) => {
      const chapter = time < layerSceneDuration ? 'top' : 'bottom';
      const caption = chapter === 'top'
        ? { zh: `看整颗${reference.zh}，它在魔方的上排`, en: `Look at the whole ${reference.en}. It is in the upper row.` }
        : { zh: `这次${reference.zh}在魔方的下排`, en: `This time, the ${reference.en} is in the lower row.` };
      return <VideoScene title={FL_CHAPTERS[chapter].title}
        cube={<VideoCube key={chapter} setup={layerExamples[chapter]} alg="" step={0} scene={leftView}
          dimmedStickers={FL_LAST_STICKERS} dimOpacity={1}
          orientation={orientation} {...playback} />}
        caption={<T {...caption} />} />;
    }} />;
}

const cornerGuideExample = FL_RECOGNITION_EXAMPLES[0];
const firstLayerCorners = [
  { home: FL_LEFT_BACK, stickers: [FACE.D, FACE.B, FACE.L].map(face => engineHomeSid(FL_LEFT_BACK, face, 2)) },
  { home: FL_LEFT_FRONT, stickers: [FACE.D, FACE.F, FACE.L].map(face => engineHomeSid(FL_LEFT_FRONT, face, 2)) },
  { home: FL_WRG_HOME, stickers: FL_REFERENCE_STICKERS },
  { home: FL_WGO_HOME, stickers: FL_LAST_STICKERS },
];
const dimOtherCorners = (home: number) => firstLayerCorners.flatMap(corner => corner.home === home ? [] : corner.stickers);
const twistSceneDuration = 3500;
const twistFadeMs = 280;

export const twistVideoLabel = { zh: '公式组识别', en: 'Algorithm group recognition' };

export function TwistRecognitionVideo({ chapter, orientation }: { chapter: FlChapter; orientation: string }) {
  const palette = flPalette(orientation);
  const bottom = palette.color('D');
  const mutedFourth = useMemo(() => dimStickerColors(FL_LAST_STICKERS, orientation, 1), [orientation]);
  const examples = FL_TWISTS.map(twist => FL_CASES[chapter].find(item => item.sectionId === flSectionId(chapter, twist))!);
  const scene = chapter === 'top' ? FL_VIEWS.top : FL_VIEWS.bottom;
  const placementCue = chapter === 'top'
    ? { zh: `第三角块已经在顶层左前。只看它的${bottom.zh}格朝向`, en: `Corner 3 is at top front-left. Look at its ${bottom.en} sticker.` }
    : { zh: `第三角块已经在底层右前。UD、DD 都看它的${bottom.zh}格朝向`, en: `Corner 3 is at bottom front-right. Use its ${bottom.en} sticker for both UD and DD.` };
  const finishCue = chapter === 'top'
    ? { zh: '选好分类后，再对照第四角块的位置和朝向找公式', en: 'After choosing the group, match the fourth corner’s position and orientation to find the algorithm.' }
    : { zh: '选好分类后，按第四角块所在层找 UD 或 DD，再对照它的朝向', en: 'After choosing the group, find UD or DD by the fourth corner’s layer, then match its orientation.' };

  return <FirstLayerVideo label={twistVideoLabel} length={5 * twistSceneDuration}
    renderScene={({ time, ...playback }) => {
      const shot = Math.min(4, Math.floor(time / twistSceneDuration));
      const index = Math.min(2, Math.max(0, shot - 1));
      const twist = FL_TWISTS[index];
      const direction = flBottomColorDirection(chapter, twist);
      const opening = shot === 0;
      const closing = shot === 4;
      const title = opening ? { zh: '先看第三角块', en: 'Start with corner 3' }
        : closing ? { zh: '再看第四角块', en: 'Then look at corner 4' }
          : flSectionHeading(chapter, twist, palette);
      const caption = opening ? placementCue : closing ? finishCue : {
        zh: `底色${direction.zh}是${twist.symbol}组`,
        en: `The bottom-color sticker faces ${direction.en} in group ${twist.symbol}.`,
      };
      const opacity = closing
        ? playback.reducedMotion ? 0 : 1 - MathUtils.smoothstep(time, 4 * twistSceneDuration, 4 * twistSceneDuration + 700)
        : 1;
      const distanceToSwap = Math.min(Math.abs(time - 2 * twistSceneDuration), Math.abs(time - 3 * twistSceneDuration));
      const thirdFade = playback.reducedMotion ? 0 : 1 - MathUtils.smoothstep(distanceToSwap, 0, twistFadeMs);
      return <VideoScene title={title} caption={<T {...caption} />}
        cube={<VideoCube setup={examples[index].setup} alg="" step={0} scene={scene} orientation={orientation}
          colors={thirdFade > 0 ? mutedFourth : undefined}
          dimmedStickers={thirdFade > 0 ? FL_REFERENCE_STICKERS : FL_LAST_STICKERS}
          dimOpacity={thirdFade || opacity} {...playback} />} />;
    }} />;
}
const frontView = { ...FL_VIEWS.mixed, y: -Math.PI / 12 };
const leftView = { ...frontView, y: Math.PI / 9 };
const viewAdjustmentDuration = 650;
const bottomRevealPitch = -Math.PI / 8;
const cornerFadeDuration = 900;
const cornerRestoreStart = 3900;
const cornerSceneDuration = 4900;
const recapStart = 4 * cornerSceneDuration;
const recapTurnAt = 1500;
const recapFadeStart = recapTurnAt + turnDuration;
const recapFadeEnd = 5400;
const settingsStart = recapStart + 6400;
const recapDimmedStickers = [...firstLayerCorners[0].stickers, ...firstLayerCorners[1].stickers];
type CornerGuideScene = {
  start: number;
  view: typeof FL_VIEWS.mixed;
  dimmedStickers?: readonly string[];
  recap?: boolean;
  settings?: boolean;
};
const cornerGuideScenes: CornerGuideScene[] = [
  { start: 0, view: leftView, dimmedStickers: dimOtherCorners(FL_LEFT_BACK) },
  { start: cornerSceneDuration, view: leftView, dimmedStickers: dimOtherCorners(FL_LEFT_FRONT) },
  { start: 2 * cornerSceneDuration, view: frontView, dimmedStickers: dimOtherCorners(FL_WRG_HOME) },
  { start: 3 * cornerSceneDuration, view: FL_VIEWS.mixed, dimmedStickers: dimOtherCorners(FL_WGO_HOME) },
  { start: recapStart, view: frontView, dimmedStickers: recapDimmedStickers, recap: true },
  { start: settingsStart, view: frontView, settings: true },
];

export function CornerIdentificationVideo({ orientation }: { orientation: string }) {
  const cubePane = useRef<HTMLDivElement>(null);
  const { color, reference, last } = flPalette(orientation);
  const bottom = color('D');
  const front = color('F');
  const back = color('B');
  const copy = [
    { title: { zh: '第一角块', en: 'First corner' },
      caption: { zh: '左侧已经归位的两个角块中，底层左后的是第一角块',
        en: 'Of the two solved corners on the left, the first corner is at bottom back-left.' } },
    { title: { zh: '第二角块', en: 'Second corner' },
      caption: { zh: '底层左前已经归位的是第二角块', en: 'The solved corner at bottom front-left is the second corner.' } },
    { title: { zh: `第三角块 · ${reference.zh}`, en: `Third corner · ${reference.en}` },
      caption: { zh: `目标位置是底层右前，带有底色（${bottom.zh}）和前色（${front.zh}）`,
        en: `It belongs at bottom front-right and has the bottom color (${bottom.en}) and the front color (${front.en}).` } },
    { title: { zh: `第四角块 · ${last.zh}`, en: `Fourth corner · ${last.en}` },
      caption: { zh: `目标位置是底层右后，带有底色（${bottom.zh}）和后色（${back.zh}）`,
        en: `It belongs at bottom back-right and has the bottom color (${bottom.en}) and the back color (${back.en}).` } },
    { title: { zh: '按归位的位置辨认', en: 'Identify each piece by its destination' },
      caption: { zh: '角块转到别处，仍按它归位后的位置叫第三角块、第四角块',
        en: 'After a turn, each corner keeps its number because its destination stays the same.' } },
    { title: { zh: '更换底面和前面颜色', en: 'Change the bottom and front colors' },
      caption: { zh: '你可以在教程设置里更换底面和前面的颜色，角块仍按归位位置编号',
        en: 'You can change the bottom and front colors in Tutorial settings. The corners are still numbered by where they belong.' } },
  ];

  return <FirstLayerVideo label={{ zh: '角块讲解', en: 'Corner guide' }} length={settingsStart + 3900}
    renderScene={({ time, ...playback }) => {
      const index = Math.max(0, cornerGuideScenes.findLastIndex(scene => time >= scene.start));
      const { start, view, dimmedStickers, recap, settings } = cornerGuideScenes[index];
      const localTime = time - start;
      const fadeStart = recap ? recapFadeStart : viewAdjustmentDuration;
      const restoreAt = recap ? recapFadeEnd : cornerRestoreStart;
      const dimOpacity = playback.reducedMotion
        ? Number(localTime >= fadeStart && localTime < restoreAt)
        : Math.min(
          MathUtils.smoothstep(localTime, fadeStart, fadeStart + cornerFadeDuration),
          1 - MathUtils.smoothstep(localTime, restoreAt, restoreAt + cornerFadeDuration),
        );
      const previousView = cornerGuideScenes[index - 1]?.view;
      const progress = Math.min(localTime / viewAdjustmentDuration, 1);
      const revealBottom = dimmedStickers && !recap && dimOpacity > 0;
      const adjustYaw = previousView && previousView.y !== view.y && progress < 1 && !playback.reducedMotion;
      const scene = revealBottom
        ? { ...view, x: MathUtils.lerp(view.x, bottomRevealPitch, dimOpacity) }
        : adjustYaw
          ? { ...view, y: MathUtils.lerp(previousView.y, view.y, 1 - (1 - progress) ** 2) }
          : view;
      const showCallouts = recap && localTime >= recapFadeStart + cornerFadeDuration / 2 && localTime < restoreAt;
      const settingsOpacity = settings ? playback.reducedMotion ? 1 : MathUtils.smoothstep(localTime, 0, cornerFadeDuration) : 0;
      const usesExample = recap || settings;
      const { title, caption } = copy[index];
      return <VideoScene title={title} cubePane={cubePane}
        cube={<VideoCube key={usesExample ? 'example' : 'solved'} setup={usesExample ? cornerGuideExample.setup : ''}
          alg={usesExample ? cornerGuideExample.moves[0] : ''} step={settings || (recap && localTime >= recapTurnAt) ? 1 : 0}
          scene={scene} dimmedStickers={dimmedStickers} dimOpacity={dimOpacity}
          calloutPane={showCallouts ? cubePane : undefined} settingsOpacity={settingsOpacity}
          orientation={orientation} {...playback} />}
        caption={<T {...caption} />} />;
    }} />;
}
