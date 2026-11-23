'use client';

import { useEffect, useRef, useState } from 'react';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import { CUBE_FRAMING_EDGE } from '../components/InteractiveTutorial';
import ReadingFit from '../components/ReadingFit';
import VideoProgress from '../components/VideoProgress';
import { FL_GROUPS, FL_RECOGNITION_EXAMPLES, FL_VIEWS, flChapterTitle, flFirstLayerMask, flPalette, type FlPalette } from './lesson-data';

const turnTime = (index: number) => 2200 + index * 3000;
const turnDuration = 650;
const shotLength = (moves: number) => turnTime(moves - 1) + 3900;
let duration = 0;
const shots = FL_RECOGNITION_EXAMPLES.map(example => {
  const shot = { ...example, start: duration, alg: example.moves.join(' ') };
  duration += shotLength(example.moves.length);
  return shot;
});

const captions = {
  top: ({ reference, last }: FlPalette) => [
    { zh: `${reference.zh}当前在顶层，目标位置是底层右前`, en: `The ${reference.en} is on top. It belongs at bottom front-right.` },
    { zh: `转 U，把${reference.zh}摆到顶层左前`, en: `Turn U to move the ${reference.en} to top front-left.` },
    { zh: `${last.zh}还在底层，转 R 把它提上来`, en: `The ${last.en} is still on the bottom. Turn R to lift it.` },
    { zh: `${reference.zh}在顶层左前，两角都在顶层`, en: `The ${reference.en} is at top front-left, and both corners are on top.` },
  ],
  mixed: ({ reference, last }: FlPalette) => [
    { zh: `先摆好${reference.zh}，再看${last.zh}在哪一层`, en: `Align the ${reference.en} first, then check the layer of the ${last.en}.` },
    { zh: `转 R，把${reference.zh}摆到底层右前`, en: `Turn R to move the ${reference.en} to bottom front-right.` },
    { zh: `${last.zh}在顶层，转 U 把两角上下对齐`, en: `The ${last.en} is on top. Turn U to line up the two corners.` },
    { zh: '两个角在右前方上下对齐', en: 'The two corners line up at the front right.' },
  ],
  bottom: ({ reference }: FlPalette) => [
    { zh: `同样先把${reference.zh}摆到底层右前`, en: `Start by aligning the ${reference.en} at bottom front-right again.` },
    { zh: `转 R，把${reference.zh}摆到底层右前`, en: `Turn R to move the ${reference.en} to bottom front-right.` },
    { zh: '两角并排在右侧，从下方看底面', en: 'Both corners sit on the right. Look at the underside.' },
  ],
};

function RecognitionShot({ shot, time, playing, seekVersion, reducedMotion, orientation }: {
  shot: (typeof shots)[number];
  time: number;
  playing: boolean;
  seekVersion: number;
  reducedMotion: boolean;
  orientation: string;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const [ready, setReady] = useState(false);
  const lastFrame = useRef({ step: 0, seekVersion, initialized: false });
  const step = shot.moves.filter((_, index) => time >= turnTime(index)).length;
  const result = time >= turnTime(shot.moves.length - 1) + turnDuration + 950;
  const scene = result && shot.group === 'bottom' ? FL_VIEWS.bottom : FL_VIEWS.mixed;
  const captionIndex = result ? shot.moves.length + 1 : step;
  const palette = flPalette(orientation);
  const caption = captions[shot.group](palette)[captionIndex];
  const title = flChapterTitle(shot.group === 'top' ? 'top' : 'bottom', palette);
  const { code } = FL_GROUPS[shot.group];

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

  return <div className="course-grid">
    <div className="course-cube-column">
      <div className="course-cube" data-course-cube data-ready={ready}>
        <AlgPlayer ref={player} puzzle="2x2" engine="sim" set="" setup={shot.setup} alg={shot.alg}
          orientation={orientation} sceneRot={FL_VIEWS.mixed} controlMode="none" interactionMode="none" lockView hideResetView
          fillPane maxFramingEdge={CUBE_FRAMING_EDGE} moveDurationMs={turnDuration} stickeringAtStep={flFirstLayerMask}
          onReady={() => setReady(true)} />
      </div>
    </div>
    <div className="course-caption tutorial-single-caption">
      <ReadingFit pane layout="A">
        <div className="course-copy fl-video-caption" aria-live="polite" aria-atomic="true">
          <h2><T {...title} /></h2>
          <p>{result && <strong>{code} · </strong>}<T {...caption} /></p>
        </div>
      </ReadingFit>
    </div>
  </div>;
}

export default function RecognitionVideo({ orientation }: { orientation: string }) {
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
        clock.current = Math.min(duration, clock.current + Math.min(now - previous, 50));
        setTime(clock.current);
      }
      previous = now;
      if (clock.current < duration) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const seek = (next: number) => {
    clock.current = next;
    setTime(next);
    setSeekVersion(version => version + 1);
  };
  const shot = shots.findLast(item => time >= item.start) ?? shots[0];
  return <section className="fl-recognition-video" aria-label={tr({ zh: '识别视频', en: 'Recognition video' })} data-tutorial-mode="timeline">
    <div className="course-stage" data-course-stage data-tutorial-layout="A">
      <RecognitionShot key={shot.group} shot={shot} time={time - shot.start}
        playing={playing} seekVersion={seekVersion} reducedMotion={reducedMotion} orientation={orientation} />
    </div>
    <VideoProgress time={time} duration={duration} playing={playing} onPlayingChange={setPlaying}
      onSeek={seek} onReplay={() => seek(0)} />
  </section>;
}
